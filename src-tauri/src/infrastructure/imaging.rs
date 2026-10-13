use crate::domain::models::{ResizeFilter, ResizeMode, ResizeSettings};
use image::{DynamicImage, GenericImageView};
use std::path::Path;

pub const MAX_PIXELS: u64 = 100_000_000;

pub fn load_image(path: &Path) -> Result<DynamicImage, String> {
    if path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("svg"))
    {
        let data = std::fs::read(path).map_err(|e| e.to_string())?;
        let options = resvg::usvg::Options {
            image_href_resolver: resvg::usvg::ImageHrefResolver {
                resolve_string: Box::new(|_, _| None),
                ..Default::default()
            },
            ..Default::default()
        };
        let tree = resvg::usvg::Tree::from_data(&data, &options).map_err(|e| e.to_string())?;
        let size = tree.size().to_int_size();
        if u64::from(size.width()) * u64::from(size.height()) > MAX_PIXELS {
            return Err("SVG exceeds the 100 megapixel limit".into());
        }
        let mut pixmap = resvg::tiny_skia::Pixmap::new(size.width(), size.height())
            .ok_or("Cannot allocate SVG image")?;
        resvg::render(
            &tree,
            resvg::tiny_skia::Transform::identity(),
            &mut pixmap.as_mut(),
        );
        // tiny-skia stores premultiplied alpha, image expects straight alpha.
        for pixel in pixmap.data_mut().as_chunks_mut::<4>().0 {
            let alpha = u32::from(pixel[3]);
            for channel in &mut pixel[..3] {
                *channel = (u32::from(*channel) * 255 + alpha / 2)
                    .checked_div(alpha)
                    .unwrap_or(0)
                    .min(255) as u8;
            }
        }
        return image::RgbaImage::from_raw(size.width(), size.height(), pixmap.take())
            .map(DynamicImage::ImageRgba8)
            .ok_or("Invalid SVG buffer".into());
    }
    let mut reader = image::ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(512 * 1024 * 1024);
    limits.max_image_width = Some(32768);
    limits.max_image_height = Some(32768);
    reader.limits(limits);
    let img = reader
        .decode()
        .map_err(|e| format!("Failed to decode image: {e}"))?;
    if u64::from(img.width()) * u64::from(img.height()) > MAX_PIXELS {
        return Err("Image exceeds the 100 megapixel limit".into());
    }
    Ok(img)
}

pub fn resize_dimensions(
    width: u32,
    height: u32,
    settings: &ResizeSettings,
) -> Result<(u32, u32), String> {
    let ratio = match settings.mode {
        ResizeMode::Original => return Ok((width, height)),
        ResizeMode::Fit => {
            if settings.width == 0 || settings.height == 0 {
                return Err("Resize bounds must be positive".into());
            }
            (f64::from(settings.width) / f64::from(width))
                .min(f64::from(settings.height) / f64::from(height))
                .min(1.0)
        }
        ResizeMode::Percent => {
            if !settings.percent.is_finite() || settings.percent <= 0.0 || settings.percent > 100.0
            {
                return Err("Resize percent must be > 0 and <= 100".into());
            }
            settings.percent / 100.0
        }
    };
    Ok((
        (f64::from(width) * ratio).round().max(1.0) as u32,
        (f64::from(height) * ratio).round().max(1.0) as u32,
    ))
}

pub fn resize(img: DynamicImage, settings: &ResizeSettings) -> Result<DynamicImage, String> {
    let (width, height) = resize_dimensions(img.width(), img.height(), settings)?;
    if (width, height) == img.dimensions() {
        return Ok(img);
    }
    let source = DynamicImage::ImageRgba8(img.into_rgba8());
    let mut dest = DynamicImage::new_rgba8(width, height);
    let filter = match settings.filter {
        ResizeFilter::Lanczos3 => fast_image_resize::FilterType::Lanczos3,
        ResizeFilter::CatmullRom => fast_image_resize::FilterType::CatmullRom,
    };
    fast_image_resize::Resizer::new()
        .resize(
            &source,
            &mut dest,
            &fast_image_resize::ResizeOptions::new()
                .resize_alg(fast_image_resize::ResizeAlg::Convolution(filter)),
        )
        .map_err(|e| format!("Resize failed: {e}"))?;
    Ok(dest)
}

pub fn fidelity(reference: &DynamicImage, encoded: &[u8]) -> Result<f64, String> {
    let decoded = image::load_from_memory(encoded).map_err(|e| e.to_string())?;
    // Bounded luminance sample, compared at output dimensions after resizing.
    let a = reference.thumbnail(512, 512).to_luma8();
    let b = decoded.thumbnail(512, 512).to_luma8();
    image_compare::gray_similarity_structure(&image_compare::Algorithm::MSSIMSimple, &a, &b)
        .map(|result| result.score.clamp(0.0, 1.0) * 100.0)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fit_preserves_ratio_and_never_upscales() {
        let s = ResizeSettings {
            mode: ResizeMode::Fit,
            width: 1200,
            height: 1200,
            ..Default::default()
        };
        assert_eq!(resize_dimensions(4000, 2000, &s).unwrap(), (1200, 600));
        assert_eq!(resize_dimensions(300, 100, &s).unwrap(), (300, 100));
    }
    #[test]
    fn percent_is_validated_and_minimum_is_one_pixel() {
        let mut s = ResizeSettings {
            mode: ResizeMode::Percent,
            percent: 50.0,
            ..Default::default()
        };
        assert_eq!(resize_dimensions(1, 1, &s).unwrap(), (1, 1));
        s.percent = f64::NAN;
        assert!(resize_dimensions(100, 100, &s).is_err());
        s.percent = 0.0;
        assert!(resize_dimensions(100, 100, &s).is_err());
    }
    #[test]
    fn identical_png_has_full_fidelity() {
        let img = DynamicImage::new_rgb8(32, 32);
        let data = crate::infrastructure::encoders::encode_png(&img, false).unwrap();
        assert!((fidelity(&img, &data).unwrap() - 100.0).abs() < 0.001);
    }
    #[test]
    fn one_pixel_png_has_finite_fidelity() {
        let img = DynamicImage::new_rgba8(1, 1);
        let data = crate::infrastructure::encoders::encode_png(&img, false).unwrap();
        assert_eq!(fidelity(&img, &data).unwrap(), 100.0);
    }
    #[test]
    fn svg_cannot_embed_a_local_image() {
        let dir = tempfile::tempdir().unwrap();
        let secret = dir.path().join("secret.png");
        image::RgbaImage::from_pixel(4, 4, image::Rgba([255, 0, 0, 255]))
            .save(&secret)
            .unwrap();
        let svg = dir.path().join("input.svg");
        std::fs::write(&svg, format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><image href="{}" width="4" height="4"/></svg>"#, secret.to_string_lossy())).unwrap();
        assert!(load_image(&svg)
            .unwrap()
            .to_rgba8()
            .pixels()
            .all(|p| p[3] == 0));
    }
}
