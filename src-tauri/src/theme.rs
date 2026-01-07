use serde::Serialize;
use std::fs;

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

#[derive(Default)]
struct KdeColors {
    scheme_name: String,
    window_background: String,
    window_foreground: String,
    alternate_background: String,
    selection_background: String,
    view_background: String,
    window_frame: String,
}

pub fn get_kde_theme() -> Result<SystemTheme, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    // Checking possible locations for kdeglobals
    let kdeglobals = format!("{}/.config/kdeglobals", home);

    let content =
        fs::read_to_string(&kdeglobals).map_err(|e| format!("Failed to read kdeglobals: {}", e))?;

    let colors = parse_kde_colors(&content)?;

    Ok(SystemTheme {
        name: colors.scheme_name,
        background: colors.window_background,
        foreground: colors.window_foreground,
        accent: colors.selection_background,
        surface: colors.view_background,
        surface_variant: colors.alternate_background,
        border: colors.window_frame,
    })
}

fn parse_kde_colors(content: &str) -> Result<KdeColors, String> {
    let mut colors = KdeColors::default();
    let mut in_colors_window = false;
    let mut in_colors_selection = false;
    let mut in_colors_view = false;
    let mut in_general = false;

    for line in content.lines() {
        let line = line.trim();
        if line == "[Colors:Window]" {
            in_colors_window = true;
            in_colors_selection = false;
            in_colors_view = false;
            in_general = false;
            continue;
        } else if line == "[Colors:Selection]" {
            in_colors_window = false;
            in_colors_selection = true;
            in_colors_view = false;
            in_general = false;
            continue;
        } else if line == "[Colors:View]" {
            in_colors_window = false;
            in_colors_selection = false;
            in_colors_view = true;
            in_general = false;
            continue;
        } else if line == "[General]" {
            in_colors_window = false;
            in_colors_selection = false;
            in_colors_view = false;
            in_general = true;
            continue;
        } else if line.starts_with('[') {
            in_colors_window = false;
            in_colors_selection = false;
            in_colors_view = false;
            in_general = false;
            continue;
        }

        if in_colors_window {
            if line.starts_with("BackgroundNormal=") {
                colors.window_background = parse_kde_color(line)?;
            } else if line.starts_with("ForegroundNormal=") {
                colors.window_foreground = parse_kde_color(line)?;
            } else if line.starts_with("BackgroundAlternate=") {
                colors.alternate_background = parse_kde_color(line)?;
            }
        }

        if in_colors_selection && line.starts_with("BackgroundNormal=") {
            colors.selection_background = parse_kde_color(line)?;
        }

        if in_colors_view && line.starts_with("BackgroundNormal=") {
            colors.view_background = parse_kde_color(line)?;
        }

        if in_general && line.starts_with("Name=") {
            colors.scheme_name = line.split('=').nth(1).unwrap_or("KDE").to_string();
        }
    }

    // Default fallbacks if keys missing
    if colors.window_background.is_empty() {
        colors.window_background = "#ffffff".to_string();
    }
    if colors.window_foreground.is_empty() {
        colors.window_foreground = "#000000".to_string();
    }
    if colors.selection_background.is_empty() {
        colors.selection_background = "#3daee9".to_string();
    }
    if colors.view_background.is_empty() {
        colors.view_background = colors.window_background.clone();
    }
    if colors.window_frame.is_empty() {
        colors.window_frame = colors.window_background.clone();
    }

    Ok(colors)
}

fn parse_kde_color(line: &str) -> Result<String, String> {
    let parts: Vec<&str> = line.split('=').collect();
    if parts.len() != 2 {
        return Err("Invalid color format".to_string());
    }

    let rgb: Vec<u8> = parts[1]
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    if rgb.len() != 3 {
        return Err("Invalid RGB values".to_string());
    }

    Ok(format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
}

pub fn get_gtk_theme() -> Result<SystemTheme, String> {
    use std::process::Command;

    let theme_name = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_matches('\'')
                .to_string()
        })
        .unwrap_or_else(|_| "Unknown".to_string());

    let accent_name = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "accent-color"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_matches('\'')
                .to_string()
        })
        .unwrap_or_else(|_| "blue".to_string());

    let color_scheme = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_matches('\'')
                .to_string()
        })
        .unwrap_or_else(|_| "default".to_string());

    let is_dark = color_scheme.contains("dark") || theme_name.to_lowercase().contains("dark");

    // Mapping GNOME accent names to hex
    let accent_hex = match accent_name.as_str() {
        "blue" => "#3584e4",
        "teal" => "#2190a4",
        "green" => "#3a944a",
        "yellow" => "#c88800",
        "orange" => "#ed5b00",
        "red" => "#e01b24",
        "pink" => "#d56199",
        "purple" => "#9141ac",
        "slate" => "#6f7070",
        _ => "#3584e4",
    };

    Ok(SystemTheme {
        name: theme_name,
        background: if is_dark {
            "#1e1e2e".to_string()
        } else {
            "#eff1f5".to_string()
        },
        foreground: if is_dark {
            "#cdd6f4".to_string()
        } else {
            "#4c4f69".to_string()
        },
        accent: accent_hex.to_string(),
        surface: if is_dark {
            "#181825".to_string()
        } else {
            "#e6e9ef".to_string()
        },
        surface_variant: if is_dark {
            "#313244".to_string()
        } else {
            "#ccd0da".to_string()
        },
        border: if is_dark {
            "#45475a".to_string()
        } else {
            "#bcc0cc".to_string()
        },
    })
}

pub fn get_windows_theme() -> Result<SystemTheme, String> {
    // Stub
    Ok(SystemTheme {
        name: "Windows".to_string(),
        background: "#ffffff".to_string(),
        foreground: "#000000".to_string(),
        accent: "#0078d7".to_string(),
        surface: "#f3f3f3".to_string(),
        surface_variant: "#e5e5e5".to_string(),
        border: "#dcdcdc".to_string(),
    })
}

pub fn get_macos_theme() -> Result<SystemTheme, String> {
    // Stub
    Ok(SystemTheme {
        name: "macOS".to_string(),
        background: "#ffffff".to_string(),
        foreground: "#000000".to_string(),
        accent: "#007aff".to_string(),
        surface: "#f6f6f6".to_string(),
        surface_variant: "#ededed".to_string(),
        border: "#d1d1d1".to_string(),
    })
}
