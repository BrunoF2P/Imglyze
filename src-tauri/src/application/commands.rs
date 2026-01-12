use image::GenericImageView;

pub trait Command {
    fn execute(&self) -> Result<(), String>;
    fn undo(&self) -> Result<(), String>;
}

#[tauri::command]
pub async fn generate_thumbnail(path: String) -> Result<Vec<u8>, String> {
    use image::imageops::FilterType;
    use std::io::Cursor;

    tracing::debug!("Generating thumbnail for: {}", path);

    // Read the image
    let img = image::open(&path).map_err(|e| format!("Failed to open image: {}", e))?;

    // Calculate dimensions maintaining aspect ratio
    let (width, height) = img.dimensions();
    let thumb_width = 100;
    let thumb_height = (height as f64 / width as f64 * thumb_width as f64) as u32;

    // Resize
    let thumbnail = img.resize(thumb_width, thumb_height, FilterType::Lanczos3);

    // Convert to JPEG
    let mut buf = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    Ok(buf.into_inner())
}
