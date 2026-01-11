#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Initialize tracing subscriber for structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "imglyze=debug,info".into()),
        )
        .with_target(false)
        .with_file(true)
        .with_line_number(true)
        .init();

    tracing::info!("Starting Imglyze application");
    imglyze_lib::run()
}
