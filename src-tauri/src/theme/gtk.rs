use super::SystemTheme;
use std::process::Command;

// GNOME accent color mapping to hex values
const ACCENT_COLORS: &[(&str, &str)] = &[
    ("blue", "#3584e4"),
    ("teal", "#2190a4"),
    ("green", "#3a944a"),
    ("yellow", "#c88800"),
    ("orange", "#ed5b00"),
    ("red", "#e01b24"),
    ("pink", "#d56199"),
    ("purple", "#9141ac"),
    ("slate", "#6f7070"),
];

// Dark theme colors (Catppuccin-inspired)
const DARK_COLORS: ThemeColors = ThemeColors {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    surface: "#181825",
    surface_variant: "#313244",
    border: "#45475a",
};

// Light theme colors
const LIGHT_COLORS: ThemeColors = ThemeColors {
    background: "#eff1f5",
    foreground: "#4c4f69",
    surface: "#e6e9ef",
    surface_variant: "#ccd0da",
    border: "#bcc0cc",
};

struct ThemeColors {
    background: &'static str,
    foreground: &'static str,
    surface: &'static str,
    surface_variant: &'static str,
    border: &'static str,
}

pub fn get_gtk_theme() -> Result<SystemTheme, String> {
    let theme_name = get_gsetting("org.gnome.desktop.interface", "gtk-theme")
        .unwrap_or_else(|| "Unknown".to_string());

    let accent_name = get_gsetting("org.gnome.desktop.interface", "accent-color")
        .unwrap_or_else(|| "blue".to_string());

    let color_scheme = get_gsetting("org.gnome.desktop.interface", "color-scheme")
        .unwrap_or_else(|| "default".to_string());

    let is_dark = color_scheme.contains("dark") || theme_name.to_lowercase().contains("dark");

    let accent_hex = get_accent_color(&accent_name);
    let colors = if is_dark { &DARK_COLORS } else { &LIGHT_COLORS };

    Ok(SystemTheme {
        name: theme_name,
        background: colors.background.to_string(),
        foreground: colors.foreground.to_string(),
        accent: accent_hex.to_string(),
        surface: colors.surface.to_string(),
        surface_variant: colors.surface_variant.to_string(),
        border: colors.border.to_string(),
    })
}

/// Get a gsettings value using the command line
fn get_gsetting(schema: &str, key: &str) -> Option<String> {
    Command::new("gsettings")
        .args(["get", schema, key])
        .output()
        .ok()
        .map(|output| {
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .trim_matches('\'')
                .to_string()
        })
}

/// Get accent color hex from name, with fallback to blue
fn get_accent_color(name: &str) -> &'static str {
    ACCENT_COLORS
        .iter()
        .find(|(key, _)| *key == name)
        .map(|(_, hex)| *hex)
        .unwrap_or("#3584e4") // Default to blue
}
