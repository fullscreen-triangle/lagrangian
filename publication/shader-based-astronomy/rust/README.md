# shader-astronomy (Rust)

GPU implementation of the five-pass astronomy pipeline via `wgpu`.

## Layout

```
src/
├── lib.rs         Crate root, public re-exports
├── coords.rs      S-entropy coordinates (mirrors Python)
├── passes.rs      Pass enum + WGSL source inclusion
├── pipeline.rs    Device init, texture allocation, dispatch loop
├── validation.rs  CPU benchmarks from the paper
└── shaders/
    ├── pass0_terrain.wgsl
    ├── pass1_weather.wgsl
    ├── pass2_position.wgsl
    ├── pass3_light.wgsl
    └── pass4_render.wgsl
examples/render.rs   60-frame render -> PNG
tests/validation.rs  Paper benchmark tests
benches/pipeline.rs  Criterion microbench
```

## Build

```bash
cargo build --release
cargo test --release
cargo run --release --example render
cargo bench
```

The example `render` output `output.png` is a 1920x1080 rendering of the
synthetic sky produced by 60 frames of pipeline evolution.

## Cross-check against Python

The CPU paths here match the Python reference in
`../python/src/shader_astronomy/` within machine epsilon. Any numerical
regression in the Rust implementation should fail one of the benchmarks in
`tests/validation.rs` before reaching review.
