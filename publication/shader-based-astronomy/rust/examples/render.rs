//! Example: run the pipeline for 60 frames, write the last one to PNG.

use anyhow::Result;
use shader_astronomy::{Pipeline, PipelineConfig};

fn main() -> Result<()> {
    env_logger::init();

    let config = PipelineConfig::default();
    let mut pipeline = pollster::block_on(Pipeline::new(&config))?;

    let start = std::time::Instant::now();
    for frame in 0..60 {
        pipeline.step()?;
        if frame % 10 == 0 {
            println!("frame {frame}: elapsed {:?}", start.elapsed());
        }
    }
    let elapsed = start.elapsed();
    println!("60 frames in {elapsed:?} => {:.1} Hz", 60.0 / elapsed.as_secs_f64());

    let bytes = pipeline.read_framebuffer()?;
    let (w, h) = config.screen_res;
    let img = image::RgbaImage::from_raw(w, h, bytes).ok_or_else(|| {
        anyhow::anyhow!("framebuffer size mismatch: {} bytes for {}x{}", 0u32, w, h)
    })?;
    img.save("output.png")?;
    println!("wrote output.png ({} x {})", w, h);

    Ok(())
}
