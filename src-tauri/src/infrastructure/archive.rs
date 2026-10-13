use crate::domain::models::BatchSettings;
use fs2::free_space;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};
use zip::write::FileOptions;

pub fn finalize_zip(
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

    app.emit("log", format!("Creating ZIP file: {:?}", zip_dest))
        .map_err(|e| format!("Failed to emit log: {}", e))?;

    verify_disk_space(processed_paths, &zip_dest)?;

    match create_zip(
        processed_paths,
        output_dir,
        &zip_dest,
        || {
            app.state::<crate::domain::models::AppState>()
                .processing_status
                .load(Ordering::SeqCst)
                == 2
        },
        |done, total| {
            let _ = app.emit("zip_progress", (done, total));
        },
    ) {
        Ok(_) => {
            app.emit("log", "ZIP created successfully.")
                .map_err(|e| format!("Failed to emit log: {}", e))?;

            Ok(())
        }
        Err(e) => {
            app.emit(
                "log",
                format!(
                    "ZIP creation failed: {}. Processed files kept in {:?}",
                    e, output_dir
                ),
            )
            .ok();
            Err(e)
        }
    }
}

fn verify_disk_space(files: &[PathBuf], dest: &Path) -> Result<(), String> {
    let total_size: u64 = files
        .iter()
        .filter_map(|p| fs::metadata(p).ok())
        .map(|m| m.len())
        .sum();

    let required = (total_size as f64 * 1.1) as u64;

    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create output directory: {}", e))?;
        }

        let available = free_space(parent)
            .map_err(|e| format!("Failed to check available disk space: {}", e))?;

        if available < required {
            return Err(format!(
                "Insufficient disk space. Required: ~{:.2} MB, Available: {:.2} MB",
                required as f64 / 1_048_576.0,
                available as f64 / 1_048_576.0
            ));
        }
    }

    Ok(())
}

fn create_zip(
    files: &[PathBuf],
    root: &Path,
    dest: &Path,
    cancelled: impl Fn() -> bool,
    progress: impl Fn(usize, usize),
) -> Result<(), String> {
    let mut temporary =
        tempfile::NamedTempFile::new_in(dest.parent().ok_or("Missing destination directory")?)
            .map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(temporary.as_file_mut());
    let total = files.len();
    let mut seen_names = HashSet::new();

    for (i, path) in files.iter().enumerate() {
        if cancelled() {
            return Err("Operation cancelled by user".into());
        }
        let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;
        if !relative
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)))
        {
            return Err("Unsafe archive path".into());
        }
        let name = relative.to_string_lossy().replace('\\', "/");
        if !seen_names.insert(name.clone()) {
            return Err("Duplicate archive path".into());
        }

        let metadata = fs::metadata(path)
            .map_err(|e| format!("Failed to read metadata for {}: {}", name, e))?;

        // Images are already compressed, use Stored method
        let mut options: FileOptions<()> =
            FileOptions::default().compression_method(zip::CompressionMethod::Stored);

        // Preserve modification time (ZIP format uses UTC)
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                if let Ok(offset_dt) =
                    time::OffsetDateTime::from_unix_timestamp(duration.as_secs() as i64)
                {
                    if let Ok(datetime) = zip::DateTime::from_date_and_time(
                        offset_dt.year() as u16,
                        offset_dt.month() as u8,
                        offset_dt.day(),
                        offset_dt.hour(),
                        offset_dt.minute(),
                        offset_dt.second(),
                    ) {
                        options = options.last_modified_time(datetime);
                    }
                }
            }
        }

        zip.start_file(&name, options)
            .map_err(|e| format!("Failed to start file {}: {}", name, e))?;

        let mut file =
            fs::File::open(path).map_err(|e| format!("Failed to open {}: {}", name, e))?;

        use std::io::{Read, Write};
        let mut buffer = [0u8; 65536];
        loop {
            if cancelled() {
                return Err("Operation cancelled by user".into());
            }
            let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if count == 0 {
                break;
            }
            zip.write_all(&buffer[..count]).map_err(|e| e.to_string())?;
        }
        progress(i + 1, total);
    }

    // finish() consumes zip and closes the file handle
    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    // Move temp file to final destination
    if cancelled() {
        return Err("Operation cancelled by user".into());
    }
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary
        .persist_noclobber(dest)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn archive_preserves_same_names_in_different_directories() {
        let dir = tempfile::tempdir().unwrap();
        let paths: Vec<_> = ["a/photo.png", "b/photo.png"]
            .into_iter()
            .map(|name| {
                let path = dir.path().join(name);
                fs::create_dir_all(path.parent().unwrap()).unwrap();
                fs::write(&path, b"image").unwrap();
                path
            })
            .collect();
        let dest = dir.path().join("result.zip");
        create_zip(&paths, dir.path(), &dest, || false, |_, _| {}).unwrap();
        let mut zip = zip::ZipArchive::new(fs::File::open(dest).unwrap()).unwrap();
        assert_eq!(zip.len(), 2);
        assert_eq!(zip.by_index(0).unwrap().name().unwrap(), "a/photo.png");
        assert_eq!(zip.by_index(1).unwrap().name().unwrap(), "b/photo.png");
    }
    #[test]
    fn cancellation_leaves_no_partial_archive_and_keeps_existing_destination() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("photo.png");
        let dest = dir.path().join("result.zip");
        fs::write(&file, b"image").unwrap();
        fs::write(&dest, b"keep").unwrap();
        assert!(create_zip(&[file], dir.path(), &dest, || true, |_, _| {}).is_err());
        assert_eq!(fs::read(dest).unwrap(), b"keep");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 2);
    }
}
