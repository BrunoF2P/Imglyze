pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod theme;

use theme::SystemTheme;

#[tauri::command]
async fn get_system_theme() -> Result<SystemTheme, String> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(theme) = theme::get_kde_theme() {
            return Ok(theme);
        }

        if let Ok(theme) = theme::get_gtk_theme() {
            return Ok(theme);
        }
    }

    #[cfg(target_os = "windows")]
    {
        return theme::get_windows_theme();
    }

    #[cfg(target_os = "macos")]
    {
        return theme::get_macos_theme();
    }

    Err("Unsupported platform".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(domain::models::AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_system_theme,
            application::discovery::discover_files,
            application::batch_processor::run_batch,
            application::batch_processor::set_processing_status,
            application::commands::generate_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
