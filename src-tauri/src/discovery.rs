use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::Path;
use tauri::Emitter;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::ZipArchive;

const MAX_ZIP_FILES: usize = 1000;
const MAX_EXTRACT_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100MB

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub enum ImageFormat {
    JPG,
    PNG,
    WebP,
    BMP,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ProcessStatus {
    Pending,
    Processing,
    Done,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub format: ImageFormat,
    pub status: ProcessStatus,
    pub optimized_size: Option<u64>,
    pub optimized_path: Option<String>,
    pub error: Option<String>,
    pub selected: bool,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    pub items: Vec<FileItem>,
    pub errors: Vec<String>,
}

pub fn get_format(path: &Path) -> Option<ImageFormat> {
    use std::io::Read;

    // First check extension to filter out obvious non-images quickly
    let ext = path.extension()?.to_str()?.to_lowercase();
    let likely_format = match ext.as_str() {
        "jpg" | "jpeg" => Some(ImageFormat::JPG),
        "png" => Some(ImageFormat::PNG),
        "webp" => Some(ImageFormat::WebP),
        "bmp" => Some(ImageFormat::BMP),
        _ => None,
    };

    // If extension is not one we support, we might skip reading for performance,
    // OR we could respect the user's wish if they selected "All Files".
    // For now, let's strictly require a supported extension AND valid magic number
    // to match the previous behavior of "supported extension".
    likely_format.as_ref()?;

    // Read header (magic bytes)
    let mut file = fs::File::open(path).ok()?;
    let mut buffer = [0; 12];
    if file.read_exact(&mut buffer).is_err() {
        return None;
    }

    // Check Magic Numbers
    // JPG: FF D8 FF
    if buffer.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(ImageFormat::JPG);
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if buffer.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(ImageFormat::PNG);
    }
    // BMP: 42 4D (BM)
    if buffer.starts_with(&[0x42, 0x4D]) {
        return Some(ImageFormat::BMP);
    }
    // WebP: RIFF ... WEBP
    // 0-3: RIFF, 8-11: WEBP
    if buffer.starts_with(b"RIFF") && &buffer[8..12] == b"WEBP" {
        return Some(ImageFormat::WebP);
    }

    // If Magic Number doesn't match a known format, return None (Invalid File)
    // even if extension was correct.
    None
}

pub fn create_file_item(path: &Path) -> Option<FileItem> {
    let format = get_format(path)?;

    // Validate that it's actually an image by trying to detect its format from header
    // This is faster than open()
    if image::ImageFormat::from_path(path).is_err() {
        return None;
    }

    let metadata = std::fs::metadata(path).ok()?;

    Some(FileItem {
        id: Uuid::new_v4().to_string(),
        name: path.file_name()?.to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        size: metadata.len(),
        format,
        status: ProcessStatus::Pending,
        optimized_size: None,
        optimized_path: None,
        error: None,
        selected: true,
    })
}

fn process_path(
    path: &Path,
    app: &tauri::AppHandle,
    state: &tauri::State<'_, crate::processing::AppState>,
    result: &mut DiscoveryResult,
) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "zip" {
        handle_zip(path, app, state, result);
    } else if let Some(item) = create_file_item(path) {
        result.items.push(item);
    } else {
        // Log skipped files that are not common system files to avoid noise
        let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
        if !filename.starts_with('.') && !filename.is_empty() {
            let _ = app.emit(
                "log",
                format!(
                    "Skipping {:?}: Not a supported or valid image format.",
                    filename
                ),
            );
        }
    }
}

fn handle_zip(
    zip_path: &Path,
    app: &tauri::AppHandle,
    state: &tauri::State<'_, crate::processing::AppState>,
    result: &mut DiscoveryResult,
) {
    let zip_file = match fs::File::open(zip_path) {
        Ok(f) => f,
        Err(e) => {
            result
                .errors
                .push(format!("Error opening ZIP {:?}: {}", zip_path, e));
            return;
        }
    };

    let mut archive = match ZipArchive::new(zip_file) {
        Ok(a) => a,
        Err(e) => {
            result
                .errors
                .push(format!("Error reading ZIP file {:?}: {}", zip_path, e));
            return;
        }
    };

    // Zip Bomb protection
    if archive.len() > MAX_ZIP_FILES {
        result.errors.push(format!(
            "ZIP {:?} ignored: contains more than {} files.",
            zip_path, MAX_ZIP_FILES
        ));
        return;
    }

    let temp_dir = match tempfile::Builder::new().prefix("imglyze_").tempdir() {
        Ok(td) => td,
        Err(e) => {
            result.errors.push(format!(
                "Failed to create temporary directory for ZIP: {}",
                e
            ));
            return;
        }
    };

    let extract_dir = temp_dir.path().to_path_buf();

    // Store temp_dir in state so it persists until app exit
    if let Ok(mut dirs) = state.temp_dirs.lock() {
        dirs.push(temp_dir);
    }

    let _ = app.emit(
        "log",
        format!(
            "Extracting ZIP {:?}...",
            zip_path.file_name().unwrap_or_default()
        ),
    );

    for i in 0..archive.len() {
        // Emit progress periodically
        if i % 10 == 0 || i == archive.len() - 1 {
            let _ = app.emit("extraction-progress", (i + 1, archive.len()));
        }

        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                result
                    .errors
                    .push(format!("Error accessing file #{} in ZIP: {}", i, e));
                continue;
            }
        };

        if file.size() > MAX_EXTRACT_FILE_SIZE {
            result.errors.push(format!(
                "File {:?} in ZIP ignored: exceeds {}MB.",
                file.name(),
                MAX_EXTRACT_FILE_SIZE / 1024 / 1024
            ));
            continue;
        }

        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            let _ = fs::create_dir_all(&outpath);
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    let _ = fs::create_dir_all(p);
                }
            }

            let mut outfile = match fs::File::create(&outpath) {
                Ok(f) => f,
                Err(e) => {
                    result.errors.push(format!(
                        "Error creating extracted file {:?}: {}",
                        outpath, e
                    ));
                    continue;
                }
            };

            if let Err(e) = io::copy(&mut file, &mut outfile) {
                result
                    .errors
                    .push(format!("Error extracting file {:?}: {}", outpath, e));
                continue;
            }

            if let Some(item) = create_file_item(&outpath) {
                result.items.push(item);
            }
        }
    }
}

#[tauri::command]
pub async fn discover_files(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::processing::AppState>,
    paths: Vec<String>,
) -> Result<DiscoveryResult, String> {
    let msg = format!("Starting discovery on {} paths...", paths.len());
    let _ = app.emit("log", &msg);

    let mut result = DiscoveryResult {
        items: Vec::new(),
        errors: Vec::new(),
    };

    for path_str in paths {
        let path = Path::new(&path_str);
        if path.is_file() {
            process_path(path, &app, &state, &mut result);
        } else if path.is_dir() {
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                if entry.path().is_file() {
                    process_path(entry.path(), &app, &state, &mut result);
                }
            }
        }
    }

    let msg_done = format!("Discovery complete: {} files found.", result.items.len());
    let _ = app.emit("log", msg_done);
    Ok(result)
}
