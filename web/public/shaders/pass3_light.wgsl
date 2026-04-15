// Pass 3: ray-march with Rayleigh + Mie scattering.

struct Uniforms {
  time_s:        f32,
  dt_s:          f32,
  diffusion_k:   f32,
  wavelength_nm: f32,
  camera_pos:    vec4<f32>,
  sun_dir:       vec4<f32>,
  volume_res:    vec4<u32>,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var atmos:   texture_3d<f32>;
@group(0) @binding(2) var atmos_smp: sampler;
@group(0) @binding(3) var out_img: texture_storage_2d<rgba16float, write>;

const PI: f32 = 3.14159265358979;
const MAX_STEPS: u32 = 256u;
const STEP_M:    f32 = 100.0;

fn camera_ray(uv: vec2<f32>) -> vec3<f32> {
  let fov = 1.2;
  let aspect = 16.0 / 9.0;
  let dir = vec3<f32>(
    (uv.x * 2.0 - 1.0) * aspect * tan(fov * 0.5),
    (uv.y * 2.0 - 1.0) * tan(fov * 0.5),
    1.0
  );
  return normalize(dir);
}

fn rayleigh_beta(n: f32, lambda_m: f32, n_mol: f32) -> f32 {
  let num = 8.0 * PI * PI * PI * (n * n - 1.0) * (n * n - 1.0);
  let den = 3.0 * n_mol * pow(lambda_m, 4.0);
  return num / den;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(out_img);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }

  let uv = vec2<f32>(f32(gid.x), f32(gid.y)) / vec2<f32>(dims);
  let ray_dir = camera_ray(uv);

  var pos = u.camera_pos.xyz;
  var t   = 1.0;
  var col = vec3<f32>(0.0);
  let lambda_m = u.wavelength_nm * 1.0e-9;
  let n_mol    = 2.5e25;

  for (var i = 0u; i < MAX_STEPS; i = i + 1u) {
    pos = pos + ray_dir * STEP_M;
    let uvw = pos / vec3<f32>(u.volume_res.xyz * u32(STEP_M));
    if (any(uvw < vec3<f32>(0.0)) || any(uvw > vec3<f32>(1.0))) { break; }
    let s = textureSampleLevel(atmos, atmos_smp, uvw, 0.0);
    let n_ref = s.w;

    let beta_r = rayleigh_beta(n_ref, lambda_m, n_mol);
    let beta_m = 1.0e-5;
    let alpha  = 1.0e-6;
    let ext    = alpha + beta_r + beta_m;
    t = t * exp(-ext * STEP_M);

    let cos_theta = dot(ray_dir, u.sun_dir.xyz);
    let phase_r   = 0.75 * (1.0 + cos_theta * cos_theta);
    col = col + t * (beta_r * phase_r + beta_m) * STEP_M;

    if (t < 0.001) { break; }
  }

  textureStore(out_img, vec2<i32>(gid.xy), vec4<f32>(col, 1.0));
}
