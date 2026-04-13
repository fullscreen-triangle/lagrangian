//! Pipeline orchestration: device init, texture allocation, dispatch loop.

use anyhow::{Context, Result};
use wgpu::util::DeviceExt;

use crate::passes::{GlobalUniforms, PASS0_WGSL, PASS1_WGSL, PASS3_WGSL, PASS4_WGSL};
use crate::{SCREEN_RES, VOLUME_RES};

/// User-configurable pipeline parameters.
#[derive(Debug, Clone)]
pub struct PipelineConfig {
    /// Atmospheric volume resolution (x, y, z).
    pub volume_res: (u32, u32, u32),
    /// Output screen resolution (w, h).
    pub screen_res: (u32, u32),
    /// Wavelength for Rayleigh/Mie, nanometres.
    pub wavelength_nm: f32,
    /// Time step for weather evolution, seconds.
    pub dt_s: f32,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            volume_res: VOLUME_RES,
            screen_res: SCREEN_RES,
            wavelength_nm: 550.0,
            dt_s: 1.0,
        }
    }
}

/// Five-pass GPU pipeline handle.
pub struct Pipeline {
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: PipelineConfig,
    atmosphere_tex: wgpu::Texture,
    atmosphere_next: wgpu::Texture,
    framebuffer: wgpu::Texture,
    uniform_buf: wgpu::Buffer,
    time_s: f32,
}

impl Pipeline {
    /// Initialise the pipeline: acquire an adapter, create the device,
    /// allocate textures and bind groups, compile shader modules.
    pub async fn new(config: &PipelineConfig) -> Result<Self> {
        let instance = wgpu::Instance::default();
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                ..Default::default()
            })
            .await
            .context("no suitable GPU adapter found")?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("shader-astronomy device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::MemoryUsage,
                },
                None,
            )
            .await?;

        let (vx, vy, vz) = config.volume_res;
        let (sw, sh) = config.screen_res;

        let atmosphere_tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("atmosphere volume"),
            size: wgpu::Extent3d { width: vx, height: vy, depth_or_array_layers: vz },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D3,
            format: wgpu::TextureFormat::Rgba32Float,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let atmosphere_next = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("atmosphere volume (double buffer)"),
            ..atmosphere_tex.descriptor()
        });

        let framebuffer = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("framebuffer"),
            size: wgpu::Extent3d { width: sw, height: sh, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba16Float,
            usage: wgpu::TextureUsages::STORAGE_BINDING
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        let uniforms = GlobalUniforms {
            time_s: 0.0,
            dt_s: config.dt_s,
            diffusion_k: 1.0e-2,
            wavelength_nm: config.wavelength_nm,
            camera_pos: [0.0, 0.0, 1.7, 1.0],
            sun_dir: [0.0, 0.0, 1.0, 0.0],
            volume_res: [vx, vy, vz, 0],
        };
        let uniform_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("global uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Compile shader modules (errors at compile time if WGSL is malformed).
        let _pass0 = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("pass0 terrain"),
            source: wgpu::ShaderSource::Wgsl(PASS0_WGSL.into()),
        });
        let _pass1 = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("pass1 weather"),
            source: wgpu::ShaderSource::Wgsl(PASS1_WGSL.into()),
        });
        let _pass3 = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("pass3 light"),
            source: wgpu::ShaderSource::Wgsl(PASS3_WGSL.into()),
        });
        let _pass4 = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("pass4 render"),
            source: wgpu::ShaderSource::Wgsl(PASS4_WGSL.into()),
        });

        Ok(Self {
            device,
            queue,
            config: config.clone(),
            atmosphere_tex,
            atmosphere_next,
            framebuffer,
            uniform_buf,
            time_s: 0.0,
        })
    }

    /// Execute one frame of the five-pass pipeline.
    pub fn step(&mut self) -> Result<()> {
        self.time_s += self.config.dt_s;
        let uniforms = GlobalUniforms {
            time_s: self.time_s,
            dt_s: self.config.dt_s,
            diffusion_k: 1.0e-2,
            wavelength_nm: self.config.wavelength_nm,
            camera_pos: [0.0, 0.0, 1.7, 1.0],
            sun_dir: [0.0, 0.0, 1.0, 0.0],
            volume_res: [
                self.config.volume_res.0,
                self.config.volume_res.1,
                self.config.volume_res.2,
                0,
            ],
        };
        self.queue.write_buffer(&self.uniform_buf, 0, bytemuck::bytes_of(&uniforms));

        // Swap double-buffered atmosphere textures.
        std::mem::swap(&mut self.atmosphere_tex, &mut self.atmosphere_next);

        // Actual dispatch logic: encode command buffer, bind pipelines, dispatch
        // workgroups, submit. Omitted here for brevity of scaffolding — the
        // full dispatch chain reads from atmosphere_tex, writes to
        // atmosphere_next, then writes the final frame to framebuffer.
        let encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("frame") });
        self.queue.submit(std::iter::once(encoder.finish()));
        Ok(())
    }

    /// Read back the current framebuffer as an RGBA8 byte buffer.
    pub fn read_framebuffer(&self) -> Result<Vec<u8>> {
        let (w, h) = self.config.screen_res;
        // Full implementation: copy from GPU texture to a mapped staging
        // buffer, await, convert fp16 → u8. Stub for scaffolding.
        Ok(vec![0u8; (w * h * 4) as usize])
    }
}

/// Helper: clone a texture descriptor so we can allocate a sibling.
trait TextureDescriptorExt {
    fn descriptor(&self) -> wgpu::TextureDescriptor<'static>;
}

impl TextureDescriptorExt for wgpu::Texture {
    fn descriptor(&self) -> wgpu::TextureDescriptor<'static> {
        wgpu::TextureDescriptor {
            label: None,
            size: self.size(),
            mip_level_count: self.mip_level_count(),
            sample_count: self.sample_count(),
            dimension: self.dimension(),
            format: self.format(),
            usage: self.usage(),
            view_formats: &[],
        }
    }
}
