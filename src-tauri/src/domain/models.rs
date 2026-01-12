use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicU8;

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

pub struct AppState {
    pub processing_status: AtomicU8, // 0 = Running, 1 = Paused, 2 = Cancelled
    pub processing_notify: std::sync::Arc<tokio::sync::Notify>,
    pub temp_dirs: std::sync::Mutex<Vec<tempfile::TempDir>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            processing_status: AtomicU8::new(0),
            processing_notify: std::sync::Arc::new(tokio::sync::Notify::new()),
            temp_dirs: std::sync::Mutex::new(Vec::new()),
        }
    }
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
    #[serde(default)]
    pub max_file_size: Option<u64>,
    #[serde(default)]
    pub keep_metadata: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchSettings {
    pub global_preset: String,
    pub advanced_mode: bool,
    pub format_presets: std::collections::HashMap<String, AdvancedSettings>,
    pub output_mode: OutputMode,
    #[serde(default)]
    pub output_format: Option<ImageFormat>,
    #[serde(default)]
    pub output_zip_name: Option<String>,
    #[serde(default)]
    pub output_path: Option<String>,
    #[serde(default)]
    pub output_suffix: Option<String>,
}
