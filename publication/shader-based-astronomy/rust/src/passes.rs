//! Pass identifiers and per-pass uniform buffer layouts.
//!
//! WGSL shader source lives in `src/shaders/` and is included at
//! compile time via `include_str!`.

use bytemuck::{Pod, Zeroable};

/// Five-pass pipeline stages.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pass {
    /// Pass 0: terrain → atmosphere coupling.
    TerrainToAtmosphere,
    /// Pass 1: weather-step S-entropy evolution.
    WeatherStep,
    /// Pass 2: categorical triangulation.
    PositionResolve,
    /// Pass 3: light ray-march.
    LightPropagation,
    /// Pass 4: tone-map + gamma.
    FinalRender,
}

/// Uniforms common to all passes.
#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct GlobalUniforms {
    /// Wall time since pipeline start, seconds.
    pub time_s: f32,
    /// Time step, seconds.
    pub dt_s: f32,
    /// Diffusion coefficient.
    pub diffusion_k: f32,
    /// Wavelength, nm.
    pub wavelength_nm: f32,
    /// Camera position (world-space).
    pub camera_pos: [f32; 4],
    /// Sun direction (unit vector).
    pub sun_dir: [f32; 4],
    /// Volume resolution (x, y, z, padding).
    pub volume_res: [u32; 4],
}

/// WGSL source for each pass.
pub const PASS0_WGSL: &str = include_str!("shaders/pass0_terrain.wgsl");
/// WGSL source.
pub const PASS1_WGSL: &str = include_str!("shaders/pass1_weather.wgsl");
/// WGSL source.
pub const PASS2_WGSL: &str = include_str!("shaders/pass2_position.wgsl");
/// WGSL source.
pub const PASS3_WGSL: &str = include_str!("shaders/pass3_light.wgsl");
/// WGSL source.
pub const PASS4_WGSL: &str = include_str!("shaders/pass4_render.wgsl");
