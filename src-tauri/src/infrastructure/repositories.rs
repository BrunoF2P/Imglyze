use crate::domain::repositories::ImageRepository;
use image::DynamicImage;
use std::fs;

pub struct FsImageRepository;

impl ImageRepository for FsImageRepository {
    fn load_image(&self, path: &str) -> Result<DynamicImage, String> {
        image::open(path).map_err(|e| format!("Failed to open image '{}': {}", path, e))
    }

    fn save_image(&self, path: &str, data: &[u8]) -> Result<(), String> {
        fs::write(path, data).map_err(|e| format!("Failed to write to '{}': {}", path, e))
    }

    fn read_bytes(&self, path: &str) -> Result<Vec<u8>, String> {
        fs::read(path).map_err(|e| format!("Failed to read bytes from '{}': {}", path, e))
    }
}
