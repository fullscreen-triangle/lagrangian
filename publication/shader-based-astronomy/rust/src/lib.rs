//! Shader-based astronomy: GPU-backed five-pass pipeline.
//!
//! Companion crate to the paper *Shader-Based Astronomy*. The Python
//! package in `../python` provides the CPU reference implementation;
//! this crate is the real-time GPU implementation via `wgpu`.
//!
//! # Pipeline
//!
//! ```text
//! Pass 0: terrain  -> atmosphere volume   (2.1 ms on RTX 3070)
//! Pass 1: weather  evolution             (4.8 ms)
//! Pass 2: position resolution            (2.9 ms)
//! Pass 3: light    propagation           (7.6 ms)
//! Pass 4: final    render                (1.7 ms)
//! ```
//!
//! # Entry points
//!
//! ```no_run
//! use shader_astronomy::{Pipeline, PipelineConfig};
//!
//! # async fn run() -> anyhow::Result<()> {
//! let config = PipelineConfig::default();
//! let mut pipeline = Pipeline::new(&config).await?;
//! pipeline.step()?;
//! let image = pipeline.read_framebuffer()?;
//! # Ok(())
//! # }
//! ```

#![warn(missing_docs, rust_2018_idioms)]

pub mod coords;
pub mod passes;
pub mod pipeline;
pub mod validation;

pub use pipeline::{Pipeline, PipelineConfig};

/// Ternary base used in the partition structure.
pub const BASE: u32 = 3;

/// State-space dimension.
pub const DIM: u32 = 3;

/// Atmospheric volume resolution in voxels (x, y, z).
pub const VOLUME_RES: (u32, u32, u32) = (256, 256, 64);

/// Screen resolution in pixels (w, h).
pub const SCREEN_RES: (u32, u32) = (1920, 1080);
