use image::DynamicImage;
use std::io::Cursor;
use tracing;

/// Encode image to PNG format
/// If optimize is true, applies oxipng optimization
pub fn encode_png(img: &DynamicImage, optimize: bool) -> Result<Vec<u8>, String> {
    tracing::debug!(optimize = optimize, "Encoding to PNG");

    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| {
            tracing::error!(error = %e, "PNG encoding failed");
            format!("PNG encoding error: {}", e)
        })?;

    if optimize {
        tracing::debug!("Optimizing PNG with oxipng");
        let options = oxipng::Options::default();
        Ok(oxipng::optimize_from_memory(&buf, &options).unwrap_or(buf))
    } else {
        Ok(buf)
    }
}

/// Encode image to JPEG format with specified quality
/// Uses mozjpeg for better compression (10-30% better than standard)
pub fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    tracing::debug!(quality = quality, "Encoding to JPEG with mozjpeg");

    let rgb = img.to_rgb8();
    let (width, height) = rgb.dimensions();

    let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
    comp.set_size(width as usize, height as usize);
    comp.set_quality(quality as f32);
    comp.set_optimize_coding(true); // Enable entropy optimization
    comp.set_progressive_mode(); // Progressive JPEGs for better UX

    let mut data = comp.start_compress(Vec::new()).map_err(|e| {
        tracing::error!(error = ?e, "mozjpeg compress error");
        format!("mozjpeg compress error: {:?}", e)
    })?;

    data.write_scanlines(rgb.as_raw()).map_err(|e| {
        tracing::error!(error = ?e, "mozjpeg write error");
        format!("mozjpeg write error: {:?}", e)
    })?;

    data.finish().map_err(|e| {
        tracing::error!(error = ?e, "mozjpeg finish error");
        format!("mozjpeg finish error: {:?}", e)
    })
}

/// Encode image to WebP format with specified quality
pub fn encode_webp(img: &DynamicImage, quality: f32) -> Result<Vec<u8>, String> {
    tracing::debug!(quality = quality, "Encoding to WebP");

    let encoder = webp::Encoder::from_image(img).map_err(|e| {
        tracing::error!(error = ?e, "WebP encoder error");
        format!("WebP encoder error: {:?}", e)
    })?;
    let memory = encoder.encode(quality);
    Ok(memory.to_vec())
}

/// Encode image to BMP format
pub fn encode_bmp(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Bmp)
        .map_err(|e| format!("BMP encoding error: {}", e))?;
    Ok(buf)
}

/// Quantize and encode PNG with quality control
/// This allows PNG compression by reducing color palette
pub fn quantize_png_with_quality(
    img: &DynamicImage,
    quality: u8,
    optimize: bool,
) -> Result<Vec<u8>, String> {
    let rgba = img.to_rgba8();
    let width = rgba.width() as usize;
    let height = rgba.height() as usize;
    let pixels = rgba.as_raw();

    let mut attributes = imagequant::Attributes::new();
    attributes
        .set_quality(0, quality)
        .map_err(|_| "Failed to set quality".to_string())?;

    // Convert raw u8 pixels to imagequant RGBA structs
    let mut image_data = Vec::with_capacity(pixels.len() / 4);
    for chunk in pixels.chunks(4) {
        if chunk.len() == 4 {
            image_data.push(imagequant::RGBA::new(
                chunk[0], chunk[1], chunk[2], chunk[3],
            ));
        }
    }

    let mut image = attributes
        .new_image(image_data, width, height, 0.0)
        .map_err(|_| "Failed to create imagequant image".to_string())?;

    let mut quantization_result = attributes
        .quantize(&mut image)
        .map_err(|_| "Failed to quantize".to_string())?;

    let (palette, pixels) = quantization_result
        .remapped(&mut image)
        .map_err(|_| "Failed to remap image".to_string())?;

    // Encode to PNG with palette
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut buf, width as u32, height as u32);
        encoder.set_color(png::ColorType::Indexed);
        encoder.set_depth(png::BitDepth::Eight);

        // Build palette and transparency data
        let mut png_palette = Vec::new();
        let mut png_trns = Vec::new();

        for px in &palette {
            png_palette.push(px.r);
            png_palette.push(px.g);
            png_palette.push(px.b);
        }
        for px in &palette {
            png_trns.push(px.a);
        }

        encoder.set_palette(&png_palette);
        encoder.set_trns(&png_trns);

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG Header error: {}", e))?;
        writer
            .write_image_data(&pixels)
            .map_err(|e| format!("PNG Write error: {}", e))?;
    }

    // Optionally optimize with oxipng
    if optimize {
        let options = oxipng::Options::default();
        Ok(oxipng::optimize_from_memory(&buf, &options)
            .map_err(|e| format!("OxiPNG error: {}", e))?)
    } else {
        Ok(buf)
    }
}

/// Main encoding dispatcher - routes to appropriate encoder
pub fn encode_image(
    img: &DynamicImage,
    format: &str,
    quality: f32,
    optimize_png: bool,
) -> Result<Vec<u8>, String> {
    match format {
        "png" => encode_png(img, optimize_png),
        "jpg" | "jpeg" => encode_jpeg(img, quality as u8),
        "webp" => encode_webp(img, quality),
        "bmp" => encode_bmp(img),
        _ => Err(format!("Unsupported format: {}", format)),
    }
}
