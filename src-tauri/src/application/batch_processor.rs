use crate::application::discovery::FileItem;
use crate::domain::models::{AppState, BatchSettings, OutputMode, ProcessStatus};
use crate::domain::repositories::ImageRepository;
use crate::domain::services::optimizer;
use crate::infrastructure::repositories::FsImageRepository;
use crate::infrastructure::{archive, encoders, imaging, metadata, paths};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchOutcome {
    pub cancelled: bool,
    pub successes: usize,
    pub errors: usize,
    pub output_path: Option<String>,
}

#[tauri::command]
pub fn set_processing_status(status: u8, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if status > 2 {
        return Err("Invalid processing status".into());
    }
    state.processing_status.store(status, Ordering::SeqCst);
    state.processing_notify.notify_waiters();
    Ok(())
}

pub fn validate_settings(settings: &BatchSettings) -> Result<(), String> {
    imaging::resize_dimensions(100, 100, &settings.resize)?;
    for cfg in settings.format_presets.values() {
        if !cfg.quality.is_finite() || !(1.0..=100.0).contains(&cfg.quality) {
            return Err("Quality must be between 1 and 100".into());
        }
        if !matches!(
            cfg.target_format.as_str(),
            "Original" | "JPG" | "PNG" | "WebP" | "BMP" | "AVIF"
        ) {
            return Err("Unsupported output format".into());
        }
        if cfg
            .max_file_size
            .is_some_and(|s| s == 0 || s > u64::MAX / 1024)
        {
            return Err("Invalid target file size".into());
        }
    }
    for value in [
        settings.output_suffix.as_deref(),
        settings.output_zip_name.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if value.is_empty() || value.contains(['/', '\\']) || value == "." || value == ".." {
            return Err("Output name must not contain path separators".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn run_batch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    items: Vec<FileItem>,
    settings: BatchSettings,
) -> Result<BatchOutcome, String> {
    validate_settings(&settings)?;
    if state.batch_active.swap(true, Ordering::SeqCst) {
        return Err("A batch is already running".into());
    }
    let _active_guard = scopeguard::guard((), |_| {
        state.batch_active.store(false, Ordering::SeqCst);
    });
    state.processing_status.store(0, Ordering::SeqCst);
    let selected: Vec<_> = items.into_iter().filter(|item| item.selected).collect();
    if selected.is_empty() {
        return Err("Select at least one image".into());
    }
    let (mut output_dir, zip_mode) = paths::prepare_output_directory(&settings, &selected)?;
    if zip_mode {
        std::fs::remove_dir(&output_dir).map_err(|e| e.to_string())?;
        let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
        output_dir = dir.path().to_path_buf();
        state.temp_dirs.lock().map_err(|e| e.to_string())?.push(dir);
    }
    let preview_dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let preview_root = preview_dir.path().to_path_buf();
    state
        .temp_dirs
        .lock()
        .map_err(|e| e.to_string())?
        .push(preview_dir);
    let jobs = plan_outputs(selected, &settings, &output_dir)?;
    let workers = num_cpus::get_physical().clamp(1, 8);
    // Each worker reserves estimated decode/encoder memory from a 768 MiB budget.
    let memory = state.memory_budget.clone();
    let mut pending = jobs.into_iter();
    let mut tasks = tokio::task::JoinSet::new();
    let mut successes = 0;
    let mut errors = 0;
    let mut processed_paths = Vec::new();
    let mut finished = false;
    let mut worker_error = None;
    loop {
        while tasks.len() < workers && !finished {
            if !check_status(&state).await {
                finished = true;
                break;
            }
            let Some((mut item, target)) = pending.next() else {
                finished = true;
                break;
            };
            let estimate = estimated_memory(&item);
            let permit = memory
                .clone()
                .acquire_many_owned(estimate)
                .await
                .map_err(|e| e.to_string())?;
            if !check_status(&state).await {
                finished = true;
                break;
            }
            item.status = ProcessStatus::Processing;
            let _ = app.emit("file-processed", &item);
            let cfg = settings.clone();
            let root = preview_root.clone();
            let handle = app.clone();
            tasks.spawn_blocking(move || {
                let _permit = permit;
                let result = (|| {
                    let (data, warning, fidelity) = process_single_file(&item, &cfg)?;
                    if handle
                        .state::<AppState>()
                        .processing_status
                        .load(Ordering::SeqCst)
                        == 2
                    {
                        return Err("Cancelled before saving".to_string());
                    }
                    if path_identity(&target) == path_identity(Path::new(&item.path)) {
                        let snapshot = root.join(format!(
                            "{}.{}",
                            item.id,
                            format!("{:?}", item.format).to_lowercase()
                        ));
                        std::fs::copy(&item.path, &snapshot).map_err(|e| e.to_string())?;
                        handle
                            .asset_protocol_scope()
                            .allow_file(&snapshot)
                            .map_err(|e| e.to_string())?;
                        item.original_preview = Some(snapshot.to_string_lossy().into());
                    }
                    if cfg.output_mode == OutputMode::Replace {
                        FsImageRepository.save_image(&target.to_string_lossy(), &data)?;
                    } else {
                        FsImageRepository.save_new_image(&target.to_string_lossy(), &data)?;
                    }
                    handle
                        .asset_protocol_scope()
                        .allow_file(&target)
                        .map_err(|e| e.to_string())?;
                    item.optimized_size = Some(data.len() as u64);
                    item.optimized_path = Some(target.to_string_lossy().into());
                    item.fidelity = fidelity;
                    if let Some(warning) = warning {
                        let _ = handle.emit("log", warning);
                    }
                    Ok(())
                })();
                match result {
                    Ok(()) => item.status = ProcessStatus::Done,
                    Err(e) => {
                        item.status = ProcessStatus::Error;
                        item.error = Some(e);
                    }
                }
                let _ = handle.emit("file-processed", &item);
                (item, target)
            });
        }
        let Some(result) = tasks.join_next().await else {
            break;
        };
        let (item, path) = match result {
            Ok(value) => value,
            Err(error) => {
                finished = true;
                worker_error = Some(format!("Worker failed: {error}"));
                continue;
            }
        };
        if matches!(item.status, ProcessStatus::Done) {
            successes += 1;
            processed_paths.push(path);
        } else {
            errors += 1;
        }
    }
    if let Some(error) = worker_error {
        return Err(error);
    }
    let mut cancelled = state.processing_status.load(Ordering::SeqCst) == 2;
    let output_path = if zip_mode && successes > 0 && !cancelled {
        let app = app.clone();
        let zip_settings = settings.clone();
        let output_dir = output_dir.clone();
        let result = tauri::async_runtime::spawn_blocking(move || {
            archive::finalize_zip(&app, &zip_settings, &output_dir, &processed_paths)
        })
        .await
        .map_err(|e| e.to_string())?;
        cancelled = state.processing_status.load(Ordering::SeqCst) == 2;
        if let Err(error) = result {
            if !cancelled {
                return Err(error);
            }
        }
        if cancelled {
            None
        } else {
            Some(
                settings
                    .output_path
                    .as_ref()
                    .map(PathBuf::from)
                    .unwrap_or_else(std::env::temp_dir)
                    .join(
                        settings
                            .output_zip_name
                            .as_deref()
                            .unwrap_or("images_optimized.zip"),
                    )
                    .to_string_lossy()
                    .into(),
            )
        }
    } else if matches!(settings.output_mode, OutputMode::Folder) {
        Some(output_dir.to_string_lossy().into())
    } else {
        None
    };
    let _ = app.emit(
        "log",
        format!("Completed: {successes} successes, {errors} errors"),
    );
    Ok(BatchOutcome {
        cancelled,
        successes,
        errors,
        output_path,
    })
}

async fn check_status(state: &AppState) -> bool {
    loop {
        let notified = state.processing_notify.notified();
        match state.processing_status.load(Ordering::SeqCst) {
            2 => return false,
            1 => {
                tokio::select! { _ = notified => {}, _ = tokio::time::sleep(std::time::Duration::from_millis(150)) => {} }
            }
            _ => return true,
        }
    }
}

fn estimated_memory(item: &FileItem) -> u32 {
    estimate_path_memory(&item.path, item.size)
}

pub fn estimate_path_memory(path: &str, size: u64) -> u32 {
    let pixels = image::image_dimensions(path)
        .ok()
        .map(|(w, h)| u64::from(w) * u64::from(h))
        .unwrap_or(imaging::MAX_PIXELS);
    ((pixels
        .saturating_mul(24)
        .saturating_add(size.saturating_mul(2)))
        / (1024 * 1024)
        + 64)
        .clamp(64, 768) as u32
}

fn path_identity(path: &Path) -> PathBuf {
    if let Ok(canonical) = path.canonicalize() {
        return canonical;
    }
    match (path.parent(), path.file_name()) {
        (Some(parent), Some(name)) => path_identity(parent).join(name),
        _ => path.to_path_buf(),
    }
}

pub fn plan_outputs(
    items: Vec<FileItem>,
    settings: &BatchSettings,
    output_dir: &Path,
) -> Result<Vec<(FileItem, PathBuf)>, String> {
    let sources: HashSet<_> = items
        .iter()
        .map(|i| path_identity(Path::new(&i.path)))
        .collect();
    let mut reserved = HashSet::new();
    items
        .into_iter()
        .map(|item| {
            let (_, ext, _, _) = get_item_settings(&item, settings);
            let mut target = paths::get_target_path(&item, settings, output_dir, &ext);
            if settings.output_mode == OutputMode::Replace {
                if (path_identity(&target) != path_identity(Path::new(&item.path))
                    && (target.exists() || sources.contains(&path_identity(&target))))
                    || !reserved.insert(path_identity(&target))
                {
                    return Err(format!("Output collision: {}", target.display()));
                }
            } else {
                let base = target.clone();
                let mut counter = 1;
                while target.exists()
                    || sources.contains(&path_identity(&target))
                    || !reserved.insert(path_identity(&target))
                {
                    let stem = base.file_stem().unwrap_or_default().to_string_lossy();
                    target = base.with_file_name(format!("{stem}_{counter}.{ext}"));
                    counter += 1;
                }
            }
            Ok((item, target))
        })
        .collect()
}

fn get_item_settings(
    item: &FileItem,
    settings: &BatchSettings,
) -> (f32, String, Option<u64>, bool) {
    let cfg = settings.format_presets.get(&format!("{:?}", item.format));
    let quality = cfg
        .map(|c| c.quality)
        .unwrap_or(match settings.global_preset.as_str() {
            "high_quality" => 95.0,
            "lossless" => 100.0,
            _ => 80.0,
        });
    let target = cfg
        .filter(|_| settings.advanced_mode)
        .map(|c| c.target_format.as_str())
        .unwrap_or("Original");
    let ext = if target == "Original" {
        if matches!(item.format, crate::domain::models::ImageFormat::SVG) {
            "png".into()
        } else {
            format!("{:?}", item.format).to_lowercase()
        }
    } else {
        target.to_lowercase()
    };
    (
        quality,
        ext,
        cfg.filter(|_| settings.advanced_mode)
            .and_then(|c| c.max_file_size),
        cfg.is_some_and(|c| c.keep_metadata),
    )
}

pub type ProcessedImage = (Vec<u8>, Option<String>, Option<f64>);

pub fn process_single_file(
    item: &FileItem,
    settings: &BatchSettings,
) -> Result<ProcessedImage, String> {
    let (quality, ext, max_size, keep_metadata) = get_item_settings(item, settings);
    let img = imaging::resize(
        imaging::load_image(Path::new(&item.path))?,
        &settings.resize,
    )?;
    let initial = encoders::encode_image(&img, &ext, quality, true)?;
    let (mut data, mut warning) = if max_size.is_some_and(|s| initial.len() as u64 > s * 1024) {
        optimizer::find_best_quality(&img, &ext, quality, max_size.unwrap() * 1024)?
    } else {
        (initial, None)
    };
    if keep_metadata {
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
            let original = std::fs::read(&item.path).map_err(|e| e.to_string())?;
            data = metadata::apply_metadata(&original, &data, &ext)?;
        } else {
            warning = Some("Metadata preservation is unavailable for this output format".into());
        }
    }
    if max_size.is_some_and(|s| data.len() as u64 > s * 1024) {
        warning = Some("The output exceeds the requested size limit".into());
    }
    let fidelity = if settings.measure_quality {
        Some(imaging::fidelity(&img, &data)?)
    } else {
        None
    };
    Ok((data, warning, fidelity))
}

#[tauri::command]
pub async fn preview_image(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    mut item: FileItem,
    settings: BatchSettings,
) -> Result<FileItem, String> {
    validate_settings(&settings)?;
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let (_, ext, _, _) = get_item_settings(&item, &settings);
    let target = dir.path().join(format!("preview.{ext}"));
    let permit = state
        .memory_budget
        .clone()
        .acquire_many_owned(estimated_memory(&item))
        .await
        .map_err(|e| e.to_string())?;
    let source = item.clone();
    let (data, _, fidelity) = tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        process_single_file(&source, &settings)
    })
    .await
    .map_err(|e| e.to_string())??;
    std::fs::write(&target, &data).map_err(|e| e.to_string())?;
    app.asset_protocol_scope()
        .allow_file(&target)
        .map_err(|e| e.to_string())?;
    item.optimized_size = Some(data.len() as u64);
    item.optimized_path = Some(target.to_string_lossy().into());
    item.fidelity = fidelity;
    state.temp_dirs.lock().map_err(|e| e.to_string())?.push(dir);
    Ok(item)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::discovery::create_file_item;
    use crate::domain::models::{AdvancedSettings, ResizeMode, ResizeSettings};

    fn settings() -> BatchSettings {
        serde_json::from_value(serde_json::json!({
            "globalPreset": "balanced", "advancedMode": true,
            "formatPresets": {}, "outputMode": "Folder"
        }))
        .unwrap()
    }

    #[test]
    fn pipeline_resizes_encodes_avif_and_measures_quality() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.png");
        image::RgbaImage::from_pixel(64, 32, image::Rgba([190, 70, 20, 128]))
            .save(&source)
            .unwrap();
        let item = create_file_item(&source).unwrap();
        let mut config = settings();
        config.resize = ResizeSettings {
            mode: ResizeMode::Percent,
            percent: 50.0,
            ..Default::default()
        };
        config.measure_quality = true;
        config.format_presets.insert(
            "PNG".into(),
            AdvancedSettings {
                target_format: "AVIF".into(),
                quality: 90.0,
                max_file_size: None,
                keep_metadata: false,
            },
        );
        let (encoded, _, score) = process_single_file(&item, &config).unwrap();
        let result = image::load_from_memory(&encoded).unwrap();
        assert_eq!((result.width(), result.height()), (32, 16));
        assert!((result.to_rgba8().get_pixel(0, 0)[3] as i16 - 128).abs() <= 2);
        assert!(score.unwrap() > 90.0);
        assert_eq!(image::image_dimensions(&source).unwrap(), (64, 32));
    }

    #[test]
    fn outputs_preserve_hierarchy_and_never_overwrite_existing_files() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.png");
        image::RgbaImage::new(8, 8).save(&source).unwrap();
        let mut item = create_file_item(&source).unwrap();
        item.relative_path = Some("album/source.png".into());
        let output = dir.path().join("output");
        std::fs::create_dir_all(output.join("album")).unwrap();
        std::fs::write(output.join("album/source.png"), b"keep").unwrap();
        let planned = plan_outputs(vec![item.clone(), item], &settings(), &output).unwrap();
        assert_eq!(planned[0].1, output.join("album/source_1.png"));
        assert_eq!(planned[1].1, output.join("album/source_2.png"));
        assert_eq!(
            std::fs::read(output.join("album/source.png")).unwrap(),
            b"keep"
        );
    }

    #[test]
    fn replace_rejects_aliases_of_the_same_file() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("photo.png");
        image::RgbImage::new(8, 8).save(&source).unwrap();
        let alias = dir.path().join(".").join("photo.png");
        let mut config = settings();
        config.output_mode = OutputMode::Replace;
        assert!(plan_outputs(
            vec![
                create_file_item(&source).unwrap(),
                create_file_item(&alias).unwrap()
            ],
            &config,
            dir.path(),
        )
        .is_err());
    }

    #[test]
    fn replace_rejects_conversion_over_another_source() {
        let dir = tempfile::tempdir().unwrap();
        let png = dir.path().join("photo.png");
        let jpg = dir.path().join("photo.jpg");
        image::RgbImage::new(8, 8).save(&png).unwrap();
        image::RgbImage::new(8, 8).save(&jpg).unwrap();
        let mut config = settings();
        config.output_mode = OutputMode::Replace;
        config.format_presets.insert(
            "PNG".into(),
            AdvancedSettings {
                target_format: "JPG".into(),
                quality: 80.0,
                max_file_size: None,
                keep_metadata: false,
            },
        );
        assert!(plan_outputs(
            vec![
                create_file_item(&png).unwrap(),
                create_file_item(&jpg).unwrap()
            ],
            &config,
            dir.path()
        )
        .is_err());
    }

    #[test]
    fn invalid_parameters_are_rejected_before_processing() {
        let mut config = settings();
        config.output_suffix = Some("../oops".into());
        assert!(validate_settings(&config).is_err());
        config.output_suffix = None;
        config.resize.mode = ResizeMode::Percent;
        config.resize.percent = f64::NAN;
        assert!(validate_settings(&config).is_err());
    }

    #[tokio::test]
    async fn cancellation_wakes_a_paused_batch() {
        let state = AppState::default();
        state.processing_status.store(1, Ordering::SeqCst);
        let wait = check_status(&state);
        let cancel = async {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            state.processing_status.store(2, Ordering::SeqCst);
            state.processing_notify.notify_waiters();
        };
        let (running, _) = tokio::join!(wait, cancel);
        assert!(!running);
    }
}
