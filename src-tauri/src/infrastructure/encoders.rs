use image::{DynamicImage, GenericImageView};
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
        let size_mb = buf.len() as f64 / 1_000_000.0;

        tracing::debug!(
            size_mb = format!("{:.1}", size_mb),
            "Optimizing PNG with oxipng (parallel + max compression)"
        );

        // Preset 6 (maximum compression) with parallel + zopfli enabled
        // Parallel processing makes maximum compression feasible
        let mut options = oxipng::Options::from_preset(4);
        options.strip = oxipng::StripChunks::Safe;

        match oxipng::optimize_from_memory(&buf, &options) {
            Ok(optimized) => {
                let reduction = ((buf.len() - optimized.len()) as f64 / buf.len() as f64) * 100.0;
                tracing::info!(
                    original_size = buf.len(),
                    optimized_size = optimized.len(),
                    reduction_percent = format!("{:.1}", reduction),
                    "PNG optimization complete"
                );
                Ok(optimized)
            }
            Err(e) => {
                tracing::warn!(error = ?e, "oxipng failed, using unoptimized");
                Ok(buf)
            }
        }
    } else {
        Ok(buf)
    }
}

/// Encode image to JPEG format with specified quality
/// Uses mozjpeg for better compression (10-30% better than standard)
pub fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    tracing::debug!(quality = quality, "Encoding to JPEG with mozjpeg");

    // Check image dimensions for safety (prevent memory explosion)
    let (width, height) = img.dimensions();
    const MAX_PIXELS: u32 = 50_000 * 50_000; // 50k x 50k max
    if width as u64 * height as u64 > MAX_PIXELS as u64 {
        return Err(format!(
            "Image too large for JPEG encoding: {}x{} (max {}x{})",
            width, height, MAX_PIXELS, MAX_PIXELS
        ));
    }

    // Optimize: only convert if not already RGB8
    let rgb = match img {
        image::DynamicImage::ImageRgb8(rgb) => rgb.clone(),
        _ => img.to_rgb8(),
    };

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

    // CRITICAL FIX: Ensure pixels.len() is multiple of 4
    let expected_len = width * height * 4;
    if pixels.len() != expected_len {
        return Err(format!(
            "Pixel data corruption: expected {} bytes, got {}",
            expected_len,
            pixels.len()
        ));
    }

    // Convert raw u8 pixels to imagequant RGBA structs
    let mut image_data = Vec::with_capacity(width * height);
    for chunk in pixels.chunks_exact(4) {
        image_data.push(imagequant::RGBA::new(
            chunk[0], chunk[1], chunk[2], chunk[3],
        ));
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

    // Optionally optimize with oxipng (fast preset)
    if optimize {
        let mut options = oxipng::Options::from_preset(2); // Fast preset
        options.strip = oxipng::StripChunks::Safe;

        oxipng::optimize_from_memory(&buf, &options).map_err(|e| format!("OxiPNG error: {}", e))
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
        "png" => {
            // Use quantization if quality < 100, otherwise lossless
            if quality < 100.0 {
                quantize_png_with_quality(img, quality as u8, optimize_png)
            } else {
                encode_png(img, optimize_png)
            }
        }
        "jpg" | "jpeg" => encode_jpeg(img, quality as u8),
        "webp" => encode_webp(img, quality),
        "bmp" => encode_bmp(img),
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    fn create_test_image(width: u32, height: u32) -> DynamicImage {
        let img = RgbImage::from_fn(width, height, |x, y| {
            Rgb([(x % 256) as u8, (y % 256) as u8, 128])
        });
        DynamicImage::ImageRgb8(img)
    }

    #[test]
    fn test_encode_png_without_optimization() {
        let img = create_test_image(100, 100);
        let result = encode_png(&img, false);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        // PNG magic number
        assert_eq!(&data[0..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn test_encode_png_with_optimization() {
        let img = create_test_image(100, 100);
        let result = encode_png(&img, true);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        assert_eq!(&data[0..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn test_encode_jpeg() {
        let img = create_test_image(100, 100);
        let result = encode_jpeg(&img, 85);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        // JPEG magic number
        assert_eq!(&data[0..2], b"\xFF\xD8");
    }

    #[test]
    fn test_encode_jpeg_quality_range() {
        let img = create_test_image(50, 50);

        // Low quality should produce smaller file
        let low_q = encode_jpeg(&img, 20).unwrap();
        // High quality should produce larger file
        let high_q = encode_jpeg(&img, 90).unwrap();

        assert!(low_q.len() < high_q.len());
    }

    #[test]
    fn test_encode_jpeg_quality_validation() {
        // Test that encoding works at various quality levels
        let img = create_test_image(100, 100);
        assert!(encode_jpeg(&img, 1).is_ok());
        assert!(encode_jpeg(&img, 100).is_ok());
    }

    #[test]
    fn test_encode_webp() {
        let img = create_test_image(100, 100);
        let result = encode_webp(&img, 80.0);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        // WebP magic number (RIFF)
        assert_eq!(&data[0..4], b"RIFF");
        assert_eq!(&data[8..12], b"WEBP");
    }

    #[test]
    fn test_encode_bmp() {
        let img = create_test_image(50, 50);
        let result = encode_bmp(&img);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        // BMP magic number
        assert_eq!(&data[0..2], b"BM");
    }

    #[test]
    fn test_quantize_png_with_quality() {
        let img = create_test_image(100, 100);
        let result = quantize_png_with_quality(&img, 80, false);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert!(!data.is_empty());
        assert_eq!(&data[0..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn test_encode_image_dispatcher() {
        let img = create_test_image(50, 50);

        // Test PNG dispatch
        assert!(encode_image(&img, "png", 100.0, false).is_ok());

        // Test JPEG dispatch
        assert!(encode_image(&img, "jpg", 85.0, false).is_ok());
        assert!(encode_image(&img, "jpeg", 85.0, false).is_ok());

        // Test WebP dispatch
        assert!(encode_image(&img, "webp", 80.0, false).is_ok());

        // Test BMP dispatch
        assert!(encode_image(&img, "bmp", 100.0, false).is_ok());

        // Test unsupported format
        let result = encode_image(&img, "tiff", 100.0, false);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported format"));
    }

    #[test]
    fn test_png_quantization_below_100() {
        let img = create_test_image(50, 50);
        let result = encode_image(&img, "png", 80.0, false);
        assert!(result.is_ok());
    }
}
