use crate::infrastructure::encoders;
use image::DynamicImage;
use oxipng::{optimize_from_memory, Options};

pub fn find_best_quality(
    original_img: &DynamicImage,
    target_ext: &str,
    initial_quality: f32,
    target_limit: u64,
) -> Result<(Vec<u8>, Option<String>), String> {
    let mut best_data = None;
    let mut warning = None;

    // For PNG, we switch to Quantization Search (0-100 quality).
    // For JPG/WebP, we search Quality (0-initial).
    let is_png_quant = target_ext == "png";
    let search_start = if is_png_quant {
        100
    } else {
        initial_quality as u8
    };

    let mut low = 0;
    let mut high = search_start;
    let mut best_q = 0;

    // Helper closure to encode at specific quality
    let encode_fn = |q: u8, optimize: bool| -> Result<Vec<u8>, String> {
        match target_ext {
            "png" => encoders::quantize_png_with_quality(original_img, q, optimize),
            "jpg" | "jpeg" => encoders::encode_jpeg(original_img, q),
            "webp" => encoders::encode_webp(original_img, q as f32),
            _ => Ok(vec![]),
        }
    };

    while low <= high {
        let mid = low + (high - low) / 2;
        if mid == 0 {
            break;
        }

        // Optimize = FALSE inside loop for speed
        let data = encode_fn(mid, false)?;

        if (data.len() as u64) <= target_limit {
            // Fits! Try higher quality
            best_data = Some(data);
            best_q = mid;
            low = mid + 1;
        } else {
            // Too big
            if mid == 0 {
                break;
            }
            high = mid.saturating_sub(1);
        }
    }

    match best_data {
        Some(data) => {
            if is_png_quant {
                warning = Some(format!("Quantized (Q={}) to meet limit.", best_q));
                // OPTIMIZE ONCE at the end
                let options = Options {
                    strip: oxipng::StripChunks::Safe,
                    ..Default::default()
                };

                match optimize_from_memory(&data, &options) {
                    Ok(optimized) => Ok((optimized, warning)),
                    Err(e) => {
                        tracing::warn!(error = ?e, "oxipng final optimization failed");
                        Ok((data, warning))
                    }
                }
            } else {
                Ok((data, warning))
            }
        }
        None => {
            let min_quality = if is_png_quant { 30 } else { 20 };
            let fallback = encode_fn(min_quality, false)?;

            let warning = Some(format!(
                "Could not meet {}KB limit. Using minimum quality (Q={}).",
                target_limit / 1024,
                min_quality
            ));
            Ok((fallback, warning))
        }
    }
}
