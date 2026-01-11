use super::SystemTheme;
use std::fs;

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

/// Parser state for KDE config sections
#[derive(Debug, PartialEq)]
enum Section {
    None,
    General,
    ColorsWindow,
    ColorsSelection,
    ColorsView,
}

pub fn get_kde_theme() -> Result<SystemTheme, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
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
    let mut current_section = Section::None;

    for line in content.lines() {
        let line = line.trim();

        // Update current section
        current_section = match line {
            "[General]" => Section::General,
            "[Colors:Window]" => Section::ColorsWindow,
            "[Colors:Selection]" => Section::ColorsSelection,
            "[Colors:View]" => Section::ColorsView,
            s if s.starts_with('[') => Section::None,
            _ => current_section, // Keep current section
        };

        // Parse values based on current section
        match current_section {
            Section::General => {
                if let Some(name) = line.strip_prefix("Name=") {
                    colors.scheme_name = name.to_string();
                }
            }
            Section::ColorsWindow => {
                if let Some(color) = line.strip_prefix("BackgroundNormal=") {
                    colors.window_background = parse_kde_color_value(color)?;
                } else if let Some(color) = line.strip_prefix("ForegroundNormal=") {
                    colors.window_foreground = parse_kde_color_value(color)?;
                } else if let Some(color) = line.strip_prefix("BackgroundAlternate=") {
                    colors.alternate_background = parse_kde_color_value(color)?;
                }
            }
            Section::ColorsSelection => {
                if let Some(color) = line.strip_prefix("BackgroundNormal=") {
                    colors.selection_background = parse_kde_color_value(color)?;
                }
            }
            Section::ColorsView => {
                if let Some(color) = line.strip_prefix("BackgroundNormal=") {
                    colors.view_background = parse_kde_color_value(color)?;
                }
            }
            Section::None => {} // Ignore lines outside known sections
        }
    }

    // Apply defaults for missing values
    apply_defaults(&mut colors);

    Ok(colors)
}

fn parse_kde_color_value(value: &str) -> Result<String, String> {
    let rgb: Vec<u8> = value
        .split(',')
        .filter_map(|s| s.trim().parse().ok())
        .collect();

    if rgb.len() != 3 {
        return Err(format!("Invalid RGB values: {}", value));
    }

    Ok(format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
}

fn apply_defaults(colors: &mut KdeColors) {
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
    if colors.scheme_name.is_empty() {
        colors.scheme_name = "KDE".to_string();
    }
}
