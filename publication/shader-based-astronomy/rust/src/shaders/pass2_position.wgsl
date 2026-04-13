// Pass 2: Categorical triangulation (Newton-Raphson, 5 iters).

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
@group(0) @binding(1) var atmos: texture_3d<f32>;
@group(0) @binding(2) var<storage, read> sat_sigma: array<vec4<f32>, 8>;
@group(0) @binding(3) var<storage, read_write> out_pos: array<vec4<f32>, 1>;

fn sample_atmos_at(p: vec3<f32>) -> vec3<f32> {
  let c = vec3<i32>(p * vec3<f32>(u.volume_res.xyz));
  let c_clamped = clamp(c, vec3<i32>(0), vec3<i32>(u.volume_res.xyz) - 1);
  return textureLoad(atmos, c_clamped, 0).xyz;
}

@compute @workgroup_size(1)
fn main() {
  var pos = u.camera_pos.xyz;
  let sigma_local = sample_atmos_at(pos);

  for (var iter = 0u; iter < 5u; iter = iter + 1u) {
    var mean_sigma = vec3<f32>(0.0);
    for (var i = 0u; i < 8u; i = i + 1u) {
      mean_sigma = mean_sigma + sat_sigma[i].xyz;
    }
    mean_sigma = mean_sigma / 8.0;
    let correction = mean_sigma - sigma_local;
    pos = pos - 0.1 * correction;
  }

  out_pos[0] = vec4<f32>(pos, 1.0);
}
