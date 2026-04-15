// Pass 1: S-entropy evolution step (weather dynamics).

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
@group(0) @binding(1) var atmos_in:  texture_3d<f32>;
@group(0) @binding(2) var atmos_out: texture_storage_3d<rgba32float, write>;

@compute @workgroup_size(8, 8, 4)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let res = u.volume_res.xyz;
  if (gid.x >= res.x || gid.y >= res.y || gid.z >= res.z) { return; }

  let c = vec3<i32>(gid);
  let s = textureLoad(atmos_in, c, 0);

  // Central-difference Laplacian on (s_k, s_t, s_e) channels.
  let lap_x = textureLoad(atmos_in, clamp(c + vec3<i32>(1, 0, 0), vec3<i32>(0), vec3<i32>(res) - 1), 0)
            + textureLoad(atmos_in, clamp(c - vec3<i32>(1, 0, 0), vec3<i32>(0), vec3<i32>(res) - 1), 0);
  let lap_y = textureLoad(atmos_in, clamp(c + vec3<i32>(0, 1, 0), vec3<i32>(0), vec3<i32>(res) - 1), 0)
            + textureLoad(atmos_in, clamp(c - vec3<i32>(0, 1, 0), vec3<i32>(0), vec3<i32>(res) - 1), 0);
  let lap_z = textureLoad(atmos_in, clamp(c + vec3<i32>(0, 0, 1), vec3<i32>(0), vec3<i32>(res) - 1), 0)
            + textureLoad(atmos_in, clamp(c - vec3<i32>(0, 0, 1), vec3<i32>(0), vec3<i32>(res) - 1), 0);

  let lap = (lap_x + lap_y + lap_z) - 6.0 * s;
  let new_s = s + u.diffusion_k * u.dt_s * lap;

  textureStore(atmos_out, c, vec4<f32>(
    clamp(new_s.x, 0.0, 1.0),
    clamp(new_s.y, 0.0, 1.0),
    clamp(new_s.z, 0.0, 1.0),
    s.w  // preserve refractive index (updated in Pass 0)
  ));
}
