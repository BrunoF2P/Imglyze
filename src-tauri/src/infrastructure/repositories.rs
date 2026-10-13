use crate::domain::repositories::ImageRepository;
use image::DynamicImage;
use std::fs;

pub struct FsImageRepository;

impl FsImageRepository {
    pub fn save_new_image(&self, path: &str, data: &[u8]) -> Result<(), String> {
        save_atomic(path, data, false)
    }
}

fn save_atomic(path: &str, data: &[u8], replace: bool) -> Result<(), String> {
    use std::io::Write;
    let destination = std::path::Path::new(path);
    let parent = destination
        .parent()
        .ok_or("Output has no parent directory")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(data).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    if replace {
        temp.persist(destination)
    } else {
        temp.persist_noclobber(destination)
    }
    .map_err(|e| format!("Failed to save image: {e}"))?;
    Ok(())
}

impl ImageRepository for FsImageRepository {
    fn load_image(&self, path: &str) -> Result<DynamicImage, String> {
        image::open(path).map_err(|e| format!("Failed to open image '{}': {}", path, e))
    }

    fn save_image(&self, path: &str, data: &[u8]) -> Result<(), String> {
        save_atomic(path, data, true)
    }

    fn read_bytes(&self, path: &str) -> Result<Vec<u8>, String> {
        fs::read(path).map_err(|e| format!("Failed to read bytes from '{}': {}", path, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saving_a_new_output_never_overwrites_a_racing_file() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("photo.png");
        fs::write(&path, b"existing").unwrap();
        assert!(FsImageRepository
            .save_new_image(path.to_str().unwrap(), b"new")
            .is_err());
        assert_eq!(fs::read(&path).unwrap(), b"existing");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 1);
    }
}
