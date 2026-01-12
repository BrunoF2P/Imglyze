use crate::domain::models::BatchSettings;
use fs2::free_space;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::SystemTime;
use tauri::Emitter;
use zip::write::FileOptions;

/// RAII guard for temporary files - auto-deletes on drop unless persisted.
struct ScopedTempFile(PathBuf);

impl ScopedTempFile {
    fn new(path: PathBuf) -> Self {
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    /// Moves the temporary file to its final destination and prevents deletion.
    fn persist(self, dest: &Path) -> Result<(), String> {
        if let Err(rename_err) = fs::rename(&self.0, dest) {
            // Fallback for cross-partition moves
            fs::copy(&self.0, dest).map_err(|copy_err| {
                format!(
                    "Failed to finalize ZIP (rename: {}, copy: {})",
                    rename_err, copy_err
                )
            })?;
        }
        // Prevent Drop cleanup on success
        std::mem::forget(self);
        Ok(())
    }
}

impl Drop for ScopedTempFile {
    fn drop(&mut self) {
        if self.0.exists() {
            if let Err(e) = fs::remove_file(&self.0) {
                tracing::warn!(
                    path = ?self.0,
                    error = ?e,
                    "Failed to cleanup temporary ZIP file"
                );
            }
        }
    }
}

pub fn finalize_zip(
    app: &tauri::AppHandle,
    settings: &BatchSettings,
    output_dir: &Path,
    processed_paths: &[PathBuf],
    cancel_token: Option<Arc<AtomicBool>>,
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

    match create_zip(app, processed_paths, &zip_dest, cancel_token) {
        Ok(_) => {
            app.emit("log", "ZIP created successfully.")
                .map_err(|e| format!("Failed to emit log: {}", e))?;

            fs::remove_dir_all(output_dir)
                .map_err(|e| format!("Failed to cleanup temp dir: {}", e))?;

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
    app: &tauri::AppHandle,
    files: &[PathBuf],
    dest: &Path,
    cancel_token: Option<Arc<AtomicBool>>,
) -> Result<(), String> {
    // Use timestamp to avoid conflicts with orphaned temp files
    let timestamp = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let temp_zip_path = dest.with_extension(format!("zip.tmp.{}", timestamp));
    let temp_file_guard = ScopedTempFile::new(temp_zip_path.clone());

    let file = fs::File::create(temp_file_guard.path())
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;

    let mut zip = zip::ZipWriter::new(file);
    let total = files.len();
    let mut seen_names = HashSet::new();

    for (i, path) in files.iter().enumerate() {
        if let Some(ref token) = cancel_token {
            if token.load(Ordering::Relaxed) {
                return Err("Operation cancelled by user".into());
            }
        }

        let original_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| format!("Invalid filename: {:?}", path))?;

        // Prevent Zip Slip attacks
        if original_name.contains("..")
            || original_name.contains('/')
            || original_name.contains('\\')
        {
            return Err(format!("Unsafe filename detected: {}", original_name));
        }

        // Handle duplicate filenames
        let mut name = original_name.to_string();
        let mut counter = 1;
        while !seen_names.insert(name.clone()) {
            let stem = Path::new(original_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = Path::new(original_name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");

            name = if ext.is_empty() {
                format!("{}_{}", stem, counter)
            } else {
                format!("{}_{}.{}", stem, counter, ext)
            };
            counter += 1;
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
                    if let Ok(datetime) = zip::DateTime::try_from(offset_dt) {
                        options = options.last_modified_time(datetime);
                    }
                }
            }
        }

        zip.start_file(&name, options)
            .map_err(|e| format!("Failed to start file {}: {}", name, e))?;

        let mut file =
            fs::File::open(path).map_err(|e| format!("Failed to open {}: {}", name, e))?;

        std::io::copy(&mut file, &mut zip)
            .map_err(|e| format!("Failed to write {}: {}", name, e))?;

        if let Err(e) = app.emit("zip_progress", (i + 1, total)) {
            tracing::warn!(error = ?e, "Failed to emit ZIP progress");
        }
    }

    // finish() consumes zip and closes the file handle
    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    // Move temp file to final destination
    temp_file_guard.persist(dest)?;

    Ok(())
}
