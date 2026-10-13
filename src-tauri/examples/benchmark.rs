use imglyze_lib::application::{
    batch_processor::{estimate_path_memory, process_single_file},
    discovery::{get_format, FileItem},
};
use imglyze_lib::domain::models::{
    AdvancedSettings, BatchSettings, OutputMode, ProcessStatus, ResizeSettings,
};
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Instant};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let fixture = args.first().is_some_and(|s| s == "--fixture");
    let root = PathBuf::from(
        args.get(1)
            .ok_or("Usage: benchmark --fixture OUTPUT_DIR | --folder INPUT_DIR")?,
    );
    if fixture {
        std::fs::create_dir_all(&root)?;
        for i in 0..12u32 {
            let img = image::RgbImage::from_fn(1024, 768, |x, y| {
                image::Rgb([
                    ((x / 4 + y / 8 + i * 11) % 256) as u8,
                    ((x / 16 + y / 3 + i * 7) % 256) as u8,
                    ((x / 6 + y / 12 + i * 13) % 256) as u8,
                ])
            });
            img.save(root.join(format!("sample-{i:02}.png")))?;
        }
    } else if args.first().is_none_or(|s| s != "--folder") {
        return Err("Expected --fixture or --folder".into());
    }
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&root) {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }
        if fixture
            && (entry.path().parent() != Some(root.as_path())
                || !entry.file_name().to_string_lossy().starts_with("sample-")
                || entry.path().extension().is_none_or(|ext| ext != "png"))
        {
            continue;
        }
        let Some(format) = get_format(entry.path()) else {
            continue;
        };
        files.push(FileItem {
            id: files.len().to_string(),
            name: entry.file_name().to_string_lossy().into(),
            path: entry.path().to_string_lossy().into(),
            size: entry.metadata()?.len(),
            format,
            status: ProcessStatus::Pending,
            optimized_size: None,
            optimized_path: None,
            error: None,
            selected: true,
            fidelity: None,
            relative_path: None,
            original_preview: None,
        });
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    if files.is_empty() {
        return Err("No supported images".into());
    }
    let settings = Arc::new(BatchSettings {
        resize: ResizeSettings::default(),
        measure_quality: true,
        global_preset: "balanced".into(),
        advanced_mode: true,
        format_presets: ["JPG", "PNG", "WebP", "BMP", "AVIF", "SVG"]
            .map(|f| {
                (
                    f.into(),
                    AdvancedSettings {
                        target_format: "WebP".into(),
                        quality: 80.,
                        keep_metadata: false,
                        max_file_size: None,
                    },
                )
            })
            .into_iter()
            .collect::<HashMap<_, _>>(),
        output_mode: OutputMode::Folder,
        output_format: None,
        output_zip_name: None,
        output_path: None,
        output_suffix: None,
    });
    let mut results = Vec::new();
    for workers in [1, num_cpus::get_physical().clamp(1, 8)] {
        let start = Instant::now();
        let budget = Arc::new(tokio::sync::Semaphore::new(768));
        let mut jobs = tokio::task::JoinSet::new();
        let mut sizes = 0usize;
        let mut scores = Vec::new();
        for file in files.iter().cloned() {
            if jobs.len() >= workers {
                let (bytes, score) = jobs.join_next().await.unwrap()??;
                sizes += bytes;
                scores.push(score);
            }
            let permit = budget
                .clone()
                .acquire_many_owned(estimate_path_memory(&file.path, file.size))
                .await?;
            let cfg = settings.clone();
            jobs.spawn_blocking(move || {
                let _permit = permit;
                let (data, _, score) = process_single_file(&file, &cfg)?;
                Ok::<_, String>((data.len(), score.unwrap_or(0.)))
            });
        }
        while let Some(result) = jobs.join_next().await {
            let (bytes, score) = result??;
            sizes += bytes;
            scores.push(score);
        }
        results.push(serde_json::json!({"workers": workers, "seconds": start.elapsed().as_secs_f64(),
            "outputBytes": sizes, "meanSsimPercent": scores.iter().sum::<f64>() / scores.len() as f64}));
    }
    if fixture {
        let (data, _, _) = process_single_file(&files[0], &settings)?;
        std::fs::write(root.join("comparison.webp"), data)?;
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "corpus": if fixture { "synthetic gradients; not photographic" } else { "user folder" },
            "profile": if cfg!(debug_assertions) { "debug" } else { "release" },
            "os": std::env::consts::OS, "arch": std::env::consts::ARCH,
            "physicalCpus": num_cpus::get_physical(), "files": files.len(),
            "inputBytes": files.iter().map(|f| f.size).sum::<u64>(),
            "settings": &*settings, "runs": results
        }))?
    );
    Ok(())
}
