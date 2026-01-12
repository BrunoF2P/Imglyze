use crate::application::discovery::FileItem;

use crate::domain::models::{BatchSettings, OutputMode};
use std::fs;
use std::path::{Path, PathBuf};

pub fn prepare_output_directory(
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

pub fn get_target_path(
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
