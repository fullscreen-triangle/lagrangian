// Pass 4: ACES filmic tone map + gamma correction.

@group(0) @binding(0) var src:     texture_2d<f32>;
@group(0) @binding(1) var src_smp: sampler;
@group(0) @binding(2) var dst:     texture_storage_2d<rgba16float, write>;

fn aces_filmic(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(dst);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }

  let uv = vec2<f32>(f32(gid.x), f32(gid.y)) / vec2<f32>(dims);
  let col = textureSampleLevel(src, src_smp, uv, 0.0).xyz;
  let tonemapped = aces_filmic(col);
  let gamma = pow(tonemapped, vec3<f32>(1.0 / 2.2));
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(gamma, 1.0));
}
