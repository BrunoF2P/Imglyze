use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicU8;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub enum ImageFormat {
    JPG,
    PNG,
    WebP,
    BMP,
    AVIF,
    SVG,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ProcessStatus {
    Pending,
    Processing,
    Done,
    Error,
}

pub struct AppState {
    pub batch_active: std::sync::atomic::AtomicBool,
    pub processing_status: AtomicU8, // 0 = Running, 1 = Paused, 2 = Cancelled
    pub processing_notify: std::sync::Arc<tokio::sync::Notify>,
    pub memory_budget: std::sync::Arc<tokio::sync::Semaphore>,
    pub thumbnail_slots: std::sync::Arc<tokio::sync::Semaphore>,
    pub temp_dirs: std::sync::Mutex<Vec<tempfile::TempDir>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            batch_active: std::sync::atomic::AtomicBool::new(false),
            processing_status: AtomicU8::new(0),
            processing_notify: std::sync::Arc::new(tokio::sync::Notify::new()),
            memory_budget: std::sync::Arc::new(tokio::sync::Semaphore::new(768)),
            thumbnail_slots: std::sync::Arc::new(tokio::sync::Semaphore::new(2)),
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
pub struct ResizeSettings {
    #[serde(default)]
    pub mode: ResizeMode,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_width")]
    pub height: u32,
    #[serde(default = "default_percent")]
    pub percent: f64,
    #[serde(default)]
    pub filter: ResizeFilter,
}
impl Default for ResizeSettings {
    fn default() -> Self {
        Self {
            mode: ResizeMode::Original,
            width: 1920,
            height: 1920,
            percent: 100.0,
            filter: ResizeFilter::Lanczos3,
        }
    }
}
fn default_width() -> u32 {
    1920
}
fn default_percent() -> f64 {
    100.0
}
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub enum ResizeMode {
    #[default]
    Original,
    Fit,
    Percent,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub enum ResizeFilter {
    #[default]
    Lanczos3,
    CatmullRom,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchSettings {
    #[serde(default)]
    pub resize: ResizeSettings,
    #[serde(default)]
    pub measure_quality: bool,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        assert_eq!(
            state
                .processing_status
                .load(std::sync::atomic::Ordering::Relaxed),
            0
        );
    }

    #[test]
    fn test_image_format_serialization() {
        let format = ImageFormat::JPG;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"JPG\"");

        let deserialized: ImageFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ImageFormat::JPG);
    }

    #[test]
    fn test_process_status() {
        let status = ProcessStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"Pending\"");
    }

    #[test]
    fn test_output_mode_variants() {
        assert_eq!(serde_json::to_string(&OutputMode::ZIP).unwrap(), "\"ZIP\"");
        assert_eq!(
            serde_json::to_string(&OutputMode::Folder).unwrap(),
            "\"Folder\""
        );
        assert_eq!(
            serde_json::to_string(&OutputMode::Replace).unwrap(),
            "\"Replace\""
        );
        assert_eq!(
            serde_json::to_string(&OutputMode::Suffix).unwrap(),
            "\"Suffix\""
        );
    }

    #[test]
    fn test_advanced_settings_serialization() {
        let settings = AdvancedSettings {
            target_format: "Original".to_string(),
            quality: 85.0,
            max_file_size: Some(500),
            keep_metadata: false,
        };

        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("targetFormat"));
        assert!(json.contains("quality"));
        assert!(json.contains("maxFileSize"));
        assert!(json.contains("keepMetadata"));
    }

    #[test]
    fn test_batch_settings_default_values() {
        let json = r#"{
            "globalPreset": "balanced",
            "advancedMode": false,
            "formatPresets": {},
            "outputMode": "Replace"
        }"#;

        let settings: BatchSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.global_preset, "balanced");
        assert!(!settings.advanced_mode);
        assert_eq!(settings.output_mode, OutputMode::Replace);
        assert!(settings.output_zip_name.is_none());
        assert!(settings.output_path.is_none());
        assert!(settings.output_suffix.is_none());
    }
}
