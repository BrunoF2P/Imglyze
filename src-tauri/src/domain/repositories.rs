use image::DynamicImage;

pub trait ImageRepository {
    fn load_image(&self, path: &str) -> Result<DynamicImage, String>;
    fn save_image(&self, path: &str, data: &[u8]) -> Result<(), String>;
    fn read_bytes(&self, path: &str) -> Result<Vec<u8>, String>;
}
