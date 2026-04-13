// Pass 0: terrain -> atmospheric S-entropy volume.
// Mirrors shader_astronomy.passes.pass0_terrain_to_atmosphere.

struct Uniforms {
  time_s:        f32,
  dt_s:          f32,
  diffusion_k:   f32,
  wavelength_nm: f32,
  camera_pos:    vec4<f32>,
  sun_dir:       vec4<f32>,
  volume_res:    vec4<u32>,
}

@group(0) @binding(0) var<uniform>      u:      Uniforms;
@group(0) @binding(1) var               terrain: texture_2d<f32>;
@group(0) @binding(2) var               terrain_smp: sampler;
@group(0) @binding(3) var               atmos_out: texture_storage_3d<rgba32float, write>;

const K_B:       f32 = 1.380649e-23;
const E_KIN_MIN: f32 = 1.0e-21;
const E_KIN_MAX: f32 = 2.0e-20;
const RHO_0:     f32 = 1.225;
const K_REF:     f32 = 2.9e-4;

fn atmospheric_density(z_m: f32) -> f32 {
  let rho_dry     = 1.205   * exp(-z_m / 8500.0);
  let rho_vapour  = 0.013   * exp(-z_m / 2000.0);
  let rho_trace   = 0.001   * exp(-z_m / 5000.0);
  let rho_aerosol = 1.5e-5  * exp(-z_m / 1500.0);
  return rho_dry + rho_vapour + rho_trace + rho_aerosol;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let res = u.volume_res.xyz;
  if (gid.x >= res.x || gid.y >= res.y || gid.z >= res.z) { return; }

  let dz     = 500.0;
  let z_m    = f32(gid.z) * dz;
  let rho    = atmospheric_density(z_m);
  let n_ref  = 1.0 + K_REF * rho / RHO_0;

  // Tropospheric lapse
  let t_k = max(216.65, 288.15 - 0.0065 * z_m);
  let e_kin = 1.5 * K_B * t_k;
  let s_k = clamp((e_kin - E_KIN_MIN) / (E_KIN_MAX - E_KIN_MIN), 0.0, 1.0);
  let s_t = clamp(1.0 - f32(gid.z) / f32(res.z), 0.0, 1.0);
  let s_e = clamp(s_k * 0.9 + 0.1 * rho / RHO_0, 0.0, 1.0);

  textureStore(atmos_out, vec3<i32>(gid), vec4<f32>(s_k, s_t, s_e, n_ref));
}
