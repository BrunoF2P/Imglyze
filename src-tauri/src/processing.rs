use crate::discovery::{FileItem, ImageFormat, ProcessStatus};
use crate::encoders;
use oxipng::{optimize_from_memory, Options};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use tauri::Emitter;

pub struct AppState {
    pub processing_status: AtomicU8, // 0 = Running, 1 = Paused, 2 = Cancelled
    pub temp_dirs: std::sync::Mutex<Vec<tempfile::TempDir>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            processing_status: AtomicU8::new(0),
            temp_dirs: std::sync::Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn set_processing_status(status: u8, state: tauri::State<'_, AppState>) {
    println!("Backend: Status changed to {}", status);
    state.processing_status.store(status, Ordering::SeqCst);
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum OutputMode {
    ZIP,
    Folder,
    Replace,
    Suffix,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedSettings {
    pub target_format: String, // "Original" or "JPG", "PNG", etc.
    pub quality: f32,
    pub max_file_size: Option<u64>,
    pub keep_metadata: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchSettings {
    pub global_preset: String,
    pub advanced_mode: bool,
    pub format_presets: std::collections::HashMap<String, AdvancedSettings>,
    pub output_mode: OutputMode,
    pub output_format: Option<ImageFormat>,
    pub output_zip_name: Option<String>,
    pub output_path: Option<String>,
    pub output_suffix: Option<String>,
}

pub fn process_single_file(
    item: &FileItem,
    initial_quality: f32,
    target_ext: &str,
    output_path: &Path,
    max_size_kb: Option<u64>,
    keep_metadata: bool,
) -> Result<(u64, Option<String>), String> {
    tracing::debug!(
        file_path = %item.path,
        target_format = target_ext,
        quality = initial_quality,
        max_size = ?max_size_kb,
        "Starting file processing"
    );

    let original_img = image::open(&item.path).map_err(|e| {
        tracing::error!(error = %e, "Failed to open image");
        format!("Failed to open image: {}", e)
    })?;
    let max_bytes = max_size_kb.map(|k| k * 1024);

    // Initial check with requested settings using encoders module
    let initial_attempt = match target_ext {
        "png" => encoders::encode_png(&original_img, false)?,
        "jpg" | "jpeg" => encoders::encode_jpeg(&original_img, initial_quality as u8)?,
        "webp" => encoders::encode_webp(&original_img, initial_quality)?,
        "bmp" => encoders::encode_bmp(&original_img)?,
        _ => {
            tracing::warn!(format = target_ext, "Unsupported format requested");
            return Err(format!("Unsupported format: {}", target_ext));
        }
    };

    tracing::debug!(
        initial_size = initial_attempt.len(),
        "Initial encoding complete"
    );

    // If fits OR no max size, just optimize (if PNG) and return
    if max_bytes.is_none() || (initial_attempt.len() as u64) <= max_bytes.unwrap() {
        let final_data = if target_ext == "png" {
            // Now we optimize once
            let options = Options::default(); // or max if quality=100
            optimize_from_memory(&initial_attempt, &options).unwrap_or(initial_attempt)
        } else {
            initial_attempt
        };

        // Apply metadata if requested
        let final_with_metadata = if keep_metadata {
            apply_metadata(&item.path, &final_data, target_ext)?
        } else {
            final_data
        };

        fs::write(output_path, &final_with_metadata)
            .map_err(|e| format!("Failed to write: {}", e))?;
        return Ok((final_with_metadata.len() as u64, None));
    }

    // --- BINARY SEARCH STRATEGY ---
    // If we are here, file is too big.
    let target_limit = max_bytes.unwrap();
    let mut best_data = None;
    let mut warning = None;

    // For PNG, we switch to Quantization Search (0-100 quality).
    // For JPG/WebP, we search Quality (0-initial).
    let is_png_quant = target_ext == "png";
    let search_start = if is_png_quant {
        100
    } else {
        initial_quality as u8
    };

    let mut low = 0;
    let mut high = search_start;
    let mut best_q = 0;

    let encode_fn = |q: u8, optimize: bool| -> Result<Vec<u8>, String> {
        match target_ext {
            "png" => encoders::quantize_png_with_quality(&original_img, q, optimize),
            "jpg" | "jpeg" => encoders::encode_jpeg(&original_img, q),
            "webp" => encoders::encode_webp(&original_img, q as f32),
            _ => Ok(vec![]), // Should not happen
        }
    };

    while low <= high {
        let mid = low + (high - low) / 2;
        if mid == 0 {
            low = 1;
            continue;
        } // safe guard

        // Optimize = FALSE inside loop for speed
        let data = encode_fn(mid, false)?;

        if (data.len() as u64) <= target_limit {
            // Fits! Try higher quality
            best_data = Some(data);
            best_q = mid;
            low = mid + 1;
        } else {
            // Too big
            if mid == 0 {
                break;
            }
            high = mid - 1;
        }
    }

    let final_data = match best_data {
        Some(data) => {
            if is_png_quant {
                warning = Some(format!("Quantized (Q={}) to meet limit.", best_q));
                // OPTIMIZE ONCE at the end
                let options = Options::default();
                optimize_from_memory(&data, &options).unwrap_or(data)
            } else {
                data
            }
        }
        None => {
            warning = Some(format!("Could not meet {}KB limit.", max_size_kb.unwrap()));
            encode_fn(5, false)? // Return min quality result
        }
    };

    // Apply metadata if requested
    let final_with_metadata = if keep_metadata {
        apply_metadata(&item.path, &final_data, target_ext)?
    } else {
        final_data
    };

    fs::write(output_path, &final_with_metadata).map_err(|e| format!("Failed to write: {}", e))?;
    Ok((final_with_metadata.len() as u64, warning))
}

fn apply_metadata(
    original_path: &str,
    optimized_data: &[u8],
    target_ext: &str,
) -> Result<Vec<u8>, String> {
    use img_parts::{jpeg::Jpeg, png::Png, ImageEXIF};
    use std::io::Cursor;

    // Only support JPEG and PNG for metadata copying
    match target_ext {
        "jpg" | "jpeg" => {
            // Read original JPEG metadata
            let original_bytes = fs::read(original_path)
                .map_err(|e| format!("Failed to read original for metadata: {}", e))?;

            let original_jpeg = Jpeg::from_bytes(original_bytes.into())
                .map_err(|e| format!("Failed to parse original JPEG: {}", e))?;

            // Parse optimized JPEG
            let mut optimized_jpeg = Jpeg::from_bytes(optimized_data.to_vec().into())
                .map_err(|e| format!("Failed to parse optimized JPEG: {}", e))?;

            // Copy EXIF data if present
            if let Some(exif) = original_jpeg.exif() {
                optimized_jpeg.set_exif(Some(exif.clone()));
            }

            // Return modified JPEG bytes
            let mut output = Cursor::new(Vec::new());
            optimized_jpeg
                .encoder()
                .write_to(&mut output)
                .map_err(|e| format!("Failed to write JPEG with metadata: {}", e))?;

            Ok(output.into_inner())
        }
        "png" => {
            // Read original PNG metadata
            let original_bytes = fs::read(original_path)
                .map_err(|e| format!("Failed to read original for metadata: {}", e))?;

            let original_png = Png::from_bytes(original_bytes.into())
                .map_err(|e| format!("Failed to parse original PNG: {}", e))?;

            // Parse optimized PNG
            let mut optimized_png = Png::from_bytes(optimized_data.to_vec().into())
                .map_err(|e| format!("Failed to parse optimized PNG: {}", e))?;

            // Copy EXIF data if present
            if let Some(exif) = original_png.exif() {
                optimized_png.set_exif(Some(exif.clone()));
            }

            // Return modified PNG bytes
            let mut output = Cursor::new(Vec::new());
            optimized_png
                .encoder()
                .write_to(&mut output)
                .map_err(|e| format!("Failed to write PNG with metadata: {}", e))?;

            Ok(output.into_inner())
        }
        _ => {
            // For other formats, just return the data as-is
            Ok(optimized_data.to_vec())
        }
    }
}

pub fn resolve_settings(preset: &str, item_format: &ImageFormat) -> (f32, String) {
    let p_lower = preset.to_lowercase();
    let quality = if p_lower.contains("95") {
        95.0
    } else if p_lower.contains("lossless") {
        100.0
    } else {
        80.0
    };

    let target_ext = match item_format {
        ImageFormat::JPG => "jpg".to_string(),
        ImageFormat::PNG => "png".to_string(),
        ImageFormat::WebP => "webp".to_string(),
        ImageFormat::BMP => "bmp".to_string(),
    };

    (quality, target_ext)
}

fn prepare_output_directory(
    settings: &BatchSettings,
    items: &[FileItem],
) -> Result<(PathBuf, bool), String> {
    let (output_dir, is_zip_mode) = match settings.output_mode {
        OutputMode::ZIP => (
            std::env::temp_dir().join(format!("imglyze_{}", uuid::Uuid::new_v4())),
            true,
        ),
        OutputMode::Folder => {
            let path = if let Some(p) = &settings.output_path {
                PathBuf::from(p)
            } else {
                // Default to "optimized" folder in the first file's directory
                if let Some(first) = items.first() {
                    let source_path = Path::new(&first.path);
                    source_path
                        .parent()
                        .unwrap_or_else(|| Path::new("."))
                        .join("optimized")
                } else {
                    std::env::temp_dir().join("imglyze_output")
                }
            };
            (path, false)
        }
        _ => (PathBuf::new(), false),
    };

    if (is_zip_mode || settings.output_mode == OutputMode::Folder) && !output_dir.exists() {
        fs::create_dir_all(&output_dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    Ok((output_dir, is_zip_mode))
}

async fn handle_pause_cancel(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
) -> Result<(), String> {
    loop {
        let status = state.processing_status.load(Ordering::SeqCst);
        if status == 2 {
            let _ = app.emit("log", "Processing cancelled by user.");
            return Err("Cancelled".to_string());
        }
        if status == 1 {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            continue;
        }
        break;
    }
    Ok(())
}

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
        let (q, ext) = resolve_settings(&settings.global_preset, &item.format);
        (q, ext, None, false)
    }
}

fn get_target_path(
    item: &FileItem,
    settings: &BatchSettings,
    output_dir: &Path,
    target_ext: &str,
) -> PathBuf {
    let file_stem = Path::new(&item.name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");

    match settings.output_mode {
        OutputMode::ZIP | OutputMode::Folder => {
            output_dir.join(format!("{}.{}", file_stem, target_ext))
        }
        OutputMode::Replace => PathBuf::from(&item.path).with_extension(target_ext),
        OutputMode::Suffix => {
            let original_path = Path::new(&item.path);
            let parent = original_path.parent().unwrap_or_else(|| Path::new("."));
            let suffix = settings.output_suffix.as_deref().unwrap_or("_opt");
            parent.join(format!("{}{}.{}", file_stem, suffix, target_ext))
        }
    }
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

    state.processing_status.store(0, Ordering::SeqCst);

    let (output_dir, is_zip_mode) = prepare_output_directory(&settings, &items)?;

    let msg = format!("Starting processing. Mode: {:?}", settings.output_mode);
    let _ = app.emit("log", msg);

    let mut success_count = 0;
    let mut error_count = 0;
    let mut processed_paths = Vec::new();

    for mut item in items {
        if !item.selected {
            continue;
        }

        if handle_pause_cancel(&app, &state).await.is_err() {
            return Ok(());
        }

        let (quality, target_ext, max_size, keep_metadata) = get_item_settings(&item, &settings);
        let target_path = get_target_path(&item, &settings, &output_dir, &target_ext);

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

        match process_single_file(
            &item,
            quality,
            &target_ext,
            &target_path,
            max_size,
            keep_metadata,
        ) {
            Ok((new_size, warning)) => {
                success_count += 1;
                item.status = ProcessStatus::Done;
                item.optimized_size = Some(new_size);
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
        finalize_zip(&app, &settings, &output_dir, &processed_paths)?;
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

fn finalize_zip(
    app: &tauri::AppHandle,
    settings: &BatchSettings,
    output_dir: &Path,
    processed_paths: &[PathBuf],
) -> Result<(), String> {
    let zip_dest = settings
        .output_path
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(
            settings
                .output_zip_name
                .as_deref()
                .unwrap_or("images_optimized.zip"),
        );

    let _ = app.emit("log", format!("Creating ZIP file: {:?}", zip_dest));

    match create_zip(processed_paths, &zip_dest) {
        Ok(_) => {
            let _ = app.emit("log", "ZIP created successfully.");
        }
        Err(e) => {
            let _ = app.emit("log", format!("Failed to create ZIP: {}", e));
        }
    }

    // Cleanup temp dir
    let _ = fs::remove_dir_all(output_dir);
    Ok(())
}

fn create_zip(files: &[PathBuf], dest: &Path) -> Result<(), String> {
    let file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for path in files {
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            zip.start_file(name, options).map_err(|e| e.to_string())?;
            let data = fs::read(path).map_err(|e| e.to_string())?;
            use std::io::Write;
            zip.write_all(&data).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}
