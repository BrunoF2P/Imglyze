use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct SystemTheme {
    pub name: String,
    pub background: String,
    pub foreground: String,
    pub accent: String,
    pub surface: String,
    pub surface_variant: String,
    pub border: String,
}

pub mod gtk;
pub mod kde;

// Re-export for convenience
pub use gtk::get_gtk_theme;
pub use kde::get_kde_theme;
