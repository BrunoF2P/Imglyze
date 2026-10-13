use crate::domain::models::AppState;
use tauri::Manager;

pub trait Command {
    fn execute(&self) -> Result<(), String>;
    fn undo(&self) -> Result<(), String>;
}

#[tauri::command]
pub async fn generate_thumbnail(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let slot = state
        .thumbnail_slots
        .clone()
        .acquire_owned()
        .await
        .map_err(|e| e.to_string())?;
    let estimate = super::batch_processor::estimate_path_memory(
        &path,
        std::fs::metadata(&path).map_err(|e| e.to_string())?.len(),
    );
    let memory = state
        .memory_budget
        .clone()
        .acquire_many_owned(estimate)
        .await
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let (_slot, _memory) = (slot, memory);
        let img = crate::infrastructure::imaging::load_image(std::path::Path::new(&path))?;
        let thumbnail = img.thumbnail(100, 100).to_rgb8();
        let mut buf = std::io::Cursor::new(Vec::new());
        thumbnail
            .write_to(&mut buf, image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
        Ok(buf.into_inner())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn prepare_comparison_image(
    app: tauri::AppHandle,
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let extension = std::path::Path::new(&path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(extension.as_str(), "avif" | "svg") {
        app.asset_protocol_scope()
            .allow_file(&path)
            .map_err(|e| e.to_string())?;
        return Ok(path);
    }
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let target = dir.path().join("comparison.png");
    let memory = state
        .memory_budget
        .clone()
        .acquire_many_owned(super::batch_processor::estimate_path_memory(
            &path,
            std::fs::metadata(&path).map_err(|e| e.to_string())?.len(),
        ))
        .await
        .map_err(|e| e.to_string())?;
    let destination = target.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _memory = memory;
        crate::infrastructure::imaging::load_image(std::path::Path::new(&path))?
            .save_with_format(destination, image::ImageFormat::Png)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;
    app.asset_protocol_scope()
        .allow_file(&target)
        .map_err(|e| e.to_string())?;
    state.temp_dirs.lock().map_err(|e| e.to_string())?.push(dir);
    Ok(target.to_string_lossy().into())
}
