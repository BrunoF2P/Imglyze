use img_parts::{jpeg::Jpeg, png::Png, Bytes, ImageEXIF, ImageICC};
use std::io::Cursor;
use tracing;

/// Apply metadata from original image bytes to optimized image
pub fn apply_metadata(
    original_bytes: &[u8],
    optimized_data: &[u8],
    target_ext: &str,
) -> Result<Vec<u8>, String> {
    match target_ext {
        "jpg" | "jpeg" => copy_jpeg_metadata(original_bytes, optimized_data),
        "png" => copy_png_metadata(original_bytes, optimized_data),
        "webp" => copy_webp_metadata(optimized_data),
        _ => {
            tracing::debug!(format = target_ext, "Metadata not supported for format");
            Ok(optimized_data.to_vec())
        }
    }
}

fn copy_jpeg_metadata(original_bytes: &[u8], optimized_data: &[u8]) -> Result<Vec<u8>, String> {
    tracing::debug!("Copying JPEG metadata");

    // CRITICAL FIX: Use Bytes::from to avoid unnecessary copies
    // Bytes is a reference-counted buffer that can be cloned cheaply
    let original_jpeg = Jpeg::from_bytes(Bytes::from(original_bytes.to_vec()))
        .map_err(|e| format!("Failed to parse original JPEG: {}", e))?;

    let mut optimized_jpeg = Jpeg::from_bytes(Bytes::from(optimized_data.to_vec()))
        .map_err(|e| format!("Failed to parse optimized JPEG: {}", e))?;

    let mut metadata_copied = std::collections::HashSet::new();

    // 1. Copy EXIF (via trait)
    if let Some(exif) = original_jpeg.exif() {
        optimized_jpeg.set_exif(Some(exif.clone()));
        metadata_copied.insert("EXIF");
    }

    // 2. Copy ICC (via trait)
    if let Some(icc) = original_jpeg.icc_profile() {
        optimized_jpeg.set_icc_profile(Some(icc.clone()));
        metadata_copied.insert("ICC");
    }

    // 3. Manual copy for XMP, IPTC, Comments
    let segments = original_jpeg.segments();
    for segment in segments {
        let marker = segment.marker();
        let contents = segment.contents();

        match marker {
            // XMP (APP1 + "http://ns.adobe.com/xap/1.0/")
            0xE1 if contents.starts_with(b"http://ns.adobe.com/xap/1.0/") => {
                let new_segment =
                    img_parts::jpeg::JpegSegment::new_with_contents(marker, contents.clone());
                optimized_jpeg.segments_mut().push(new_segment);
                metadata_copied.insert("XMP");
            }
            // IPTC (APP13 + "Photoshop 3.0")
            0xED if contents.starts_with(b"Photoshop 3.0") => {
                let new_segment =
                    img_parts::jpeg::JpegSegment::new_with_contents(marker, contents.clone());
                optimized_jpeg.segments_mut().push(new_segment);
                metadata_copied.insert("IPTC");
            }
            // Comment (COM - 0xFE)
            0xFE => {
                let new_segment =
                    img_parts::jpeg::JpegSegment::new_with_contents(marker, contents.clone());
                optimized_jpeg.segments_mut().push(new_segment);
                metadata_copied.insert("Comment");
            }
            _ => {}
        }
    }

    if !metadata_copied.is_empty() {
        let types: Vec<&str> = metadata_copied.iter().copied().collect();
        tracing::info!(
            types = types.join(", "),
            "JPEG metadata copied successfully"
        );
    }

    let mut output = Cursor::new(Vec::new());
    optimized_jpeg
        .encoder()
        .write_to(&mut output)
        .map_err(|e| format!("Failed to write JPEG with metadata: {}", e))?;

    Ok(output.into_inner())
}

fn copy_png_metadata(original_bytes: &[u8], optimized_data: &[u8]) -> Result<Vec<u8>, String> {
    tracing::debug!("Copying PNG metadata");

    let original_png = Png::from_bytes(Bytes::from(original_bytes.to_vec()))
        .map_err(|e| format!("Failed to parse original PNG: {}", e))?;

    let mut optimized_png = Png::from_bytes(Bytes::from(optimized_data.to_vec()))
        .map_err(|e| format!("Failed to parse optimized PNG: {}", e))?;

    let mut metadata_copied = std::collections::HashSet::new();

    // 1. Copy EXIF
    if let Some(exif) = original_png.exif() {
        optimized_png.set_exif(Some(exif.clone()));
        metadata_copied.insert("EXIF".to_owned());
    }

    // 2. Copy ICC
    if let Some(icc) = original_png.icc_profile() {
        optimized_png.set_icc_profile(Some(icc.clone()));
        metadata_copied.insert("ICC".to_string());
    }

    // 3. Manual chunks for XMP/Text
    for chunk in original_png.chunks() {
        let kind = chunk.kind();
        let contents = chunk.contents();
        let type_str = String::from_utf8_lossy(&kind);

        // Copy iTXt (XML, XMP), tEXt (Keywords), zTXt (Compressed text)
        match type_str.as_ref() {
            "iTXt" | "tEXt" | "zTXt" => {
                let new_chunk = img_parts::png::PngChunk::new(kind, contents.clone());
                optimized_png.chunks_mut().push(new_chunk);
                metadata_copied.insert(type_str.to_string());
            }
            _ => {}
        }
    }

    if !metadata_copied.is_empty() {
        let types: Vec<String> = metadata_copied.into_iter().collect();
        tracing::info!(types = types.join(", "), "PNG metadata copied successfully");
    }

    let mut output = Cursor::new(Vec::new());
    optimized_png
        .encoder()
        .write_to(&mut output)
        .map_err(|e| format!("Failed to write PNG with metadata: {}", e))?;

    Ok(output.into_inner())
}

fn copy_webp_metadata(optimized_data: &[u8]) -> Result<Vec<u8>, String> {
    // WebP metadata copying not yet implemented
    // Return data as-is without unnecessary copy
    tracing::debug!("WebP metadata copying not implemented, returning optimized data");
    Ok(optimized_data.to_vec())
}
