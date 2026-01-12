use crate::application::discovery::FileItem;
use crate::domain::models::{AdvancedSettings, AppState, BatchSettings, ProcessStatus};
use crate::domain::repositories::ImageRepository;
use crate::domain::services::optimizer;
use crate::infrastructure::archive;
use crate::infrastructure::encoders;
use crate::infrastructure::metadata;
use crate::infrastructure::paths;
use crate::infrastructure::repositories::FsImageRepository;
use std::sync::atomic::Ordering;
use tauri::Emitter;

#[tauri::command]
pub fn set_processing_status(status: u8, state: tauri::State<'_, AppState>) {
    println!("Backend: Status changed to {}", status);
    state.processing_status.store(status, Ordering::Relaxed);
    // Notify anyone waiting (e.g., check_status loop)
    state.processing_notify.notify_waiters();
}

#[tauri::command]
pub async fn run_batch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    items: Vec<FileItem>,
    settings: BatchSettings,
) -> Result<(), String> {
    // Validate Settings
    if settings.advanced_mode {
        for (fmt, cfg) in &settings.format_presets {
            if cfg.quality < 0.0 || cfg.quality > 100.0 {
                return Err(format!("Invalid quality for {}: must be 0-100", fmt));
            }
            if let Some(size) = cfg.max_file_size {
                if size == 0 {
                    return Err(format!("Invalid max file size for {}: must be > 0", fmt));
                }
            }
        }
    }

    state.processing_status.store(0, Ordering::Relaxed);

    let (output_dir, is_zip_mode) = paths::prepare_output_directory(&settings, &items)?;

    let msg = format!("Starting processing. Mode: {:?}", settings.output_mode);
    let _ = app.emit("log", msg);

    let mut success_count = 0;
    let mut error_count = 0;
    let mut processed_paths = Vec::new();

    for mut item in items {
        if !item.selected {
            continue;
        }

        if check_status(&app, &state).await.is_err() {
            return Ok(());
        }

        let (quality, target_ext, max_size, keep_metadata) = get_item_settings(&item, &settings);
        let target_path = paths::get_target_path(&item, &settings, &output_dir, &target_ext);

        let _ = app.emit(
            "log",
            format!(
                "Processing {} -> {} (Format: {}, Quality: {}%)",
                item.name,
                target_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy(),
                target_ext.to_uppercase(),
                quality
            ),
        );

        match process_single_file(&item, quality, &target_ext, max_size, keep_metadata) {
            Ok((data, warning)) => {
                // Save file using Repository
                let repo = FsImageRepository;
                if let Err(e) = repo.save_image(target_path.to_str().unwrap(), &data) {
                    error_count += 1;
                    let _ = app.emit("log", format!("Error saving {}: {}", item.name, e));
                    continue;
                }

                success_count += 1;
                item.status = ProcessStatus::Done;
                item.optimized_size = Some(data.len() as u64);
                item.optimized_path = Some(target_path.to_string_lossy().to_string());
                processed_paths.push(target_path.clone());

                let _ = app.emit(
                    "log",
                    format!(
                        "Success: {} -> {:?}",
                        item.name,
                        target_path.file_name().unwrap_or_default()
                    ),
                );
                if let Some(w) = warning {
                    let _ = app.emit("log", w);
                }
            }
            Err(e) => {
                error_count += 1;
                item.status = ProcessStatus::Error;
                item.error = Some(e.clone());
                let _ = app.emit("log", format!("Error processing {}: {}", item.name, e));
            }
        }

        let _ = app.emit("file-processed", &item);
    }

    if is_zip_mode && success_count > 0 {
        archive::finalize_zip(&app, &settings, &output_dir, &processed_paths, None)?;
    }

    let _ = app.emit(
        "log",
        format!(
            "Processing complete. Successes: {}, Errors: {}",
            success_count, error_count
        ),
    );
    Ok(())
}

async fn check_status(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
) -> Result<(), String> {
    loop {
        let status = state.processing_status.load(Ordering::Relaxed);
        match status {
            2 => {
                let _ = app.emit("log", "Processing cancelled by user.");
                return Err("Cancelled".to_string());
            }
            1 => {
                state.processing_notify.notified().await;
                // Verifica novamente após acordar
            }
            _ => break,
        }
    }
    Ok(())
}

// Logic to determine settings for specific item
fn get_item_settings(
    item: &FileItem,
    settings: &BatchSettings,
) -> (f32, String, Option<u64>, bool) {
    if settings.advanced_mode {
        let adv = settings
            .format_presets
            .get(&format!("{:?}", item.format))
            .cloned()
            .unwrap_or(AdvancedSettings {
                target_format: "Original".to_string(),
                quality: 80.0,
                max_file_size: None,
                keep_metadata: false,
            });

        let ext = if adv.target_format == "Original" {
            format!("{:?}", item.format).to_lowercase()
        } else {
            adv.target_format.to_lowercase()
        };
        (adv.quality, ext, adv.max_file_size, adv.keep_metadata)
    } else {
        // Simple logic inline or extracted
        let p_lower = settings.global_preset.to_lowercase();
        let quality = if p_lower.contains("95") {
            95.0
        } else if p_lower.contains("lossless") {
            100.0
        } else {
            80.0
        };
        let ext = format!("{:?}", item.format).to_lowercase();
        (quality, ext, None, false)
    }
}

fn process_single_file(
    item: &FileItem,
    initial_quality: f32,
    target_ext: &str,
    max_size_kb: Option<u64>,
    keep_metadata: bool,
) -> Result<(Vec<u8>, Option<String>), String> {
    let _repo = FsImageRepository;

    // Read original file ONCE (for both processing and metadata)
    let original_bytes =
        std::fs::read(&item.path).map_err(|e| format!("Failed to read image: {}", e))?;

    let original_img = image::load_from_memory(&original_bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let max_bytes = max_size_kb.map(|k| k * 1024);

    // Initial check
    let initial_attempt = match target_ext {
        "png" => encoders::encode_png(&original_img, true)?, // Enable optimization
        "jpg" | "jpeg" => encoders::encode_jpeg(&original_img, initial_quality as u8)?,
        "webp" => encoders::encode_webp(&original_img, initial_quality)?,
        "bmp" => encoders::encode_bmp(&original_img)?,
        _ => return Err(format!("Unsupported format: {}", target_ext)),
    };

    let (final_data, warning) =
        if max_bytes.map_or(true, |limit| (initial_attempt.len() as u64) <= limit) {
            // Already optimized in encode_png if PNG
            let data = initial_attempt;
            (data, None)
        } else {
            // Needs optimization loop
            optimizer::find_best_quality(
                &original_img,
                target_ext,
                initial_quality,
                max_bytes.unwrap(),
            )?
        };

    // Apply Metadata (pass original bytes, not path)
    let final_with_meta = if keep_metadata {
        metadata::apply_metadata(&original_bytes, &final_data, target_ext)?
    } else {
        final_data
    };

    Ok((final_with_meta, warning))
}
