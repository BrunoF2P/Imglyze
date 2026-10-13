pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod theme;

#[tauri::command]
async fn get_system_theme(window: tauri::Window) -> Result<tauri::Theme, String> {
    window.theme().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(domain::models::AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_system_theme,
            application::discovery::discover_files,
            application::batch_processor::run_batch,
            application::batch_processor::set_processing_status,
            application::commands::generate_thumbnail,
            application::commands::prepare_comparison_image,
            application::batch_processor::preview_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
