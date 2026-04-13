# Shader-Based Astronomy

Reference implementation and validation harness accompanying the paper
*"Shader-Based Astronomy: GPU Fragment Shaders as Computational Measurement
Apparatus for Celestial Observation."*

## Layout

```
.
├── shader-based-astronomy.tex    Paper source
├── references.bib                Bibliography
├── python/                       Reference implementation + validation (CPU)
└── rust/                         Production implementation (GPU via wgpu)
```

The Python package is a numerically explicit CPU reference used to verify
numerical claims in the paper. The Rust crate is the real-time
WebGPU-based implementation.

## Quick start

### Python (reference + validation)

```bash
cd python
uv sync              # or: python -m pip install -e '.[dev]'
uv run pytest        # runs the paper's 12 validation benchmarks
```

### Rust (GPU implementation)

```bash
cd rust
cargo build --release
cargo run --release --example render
cargo test --release
```

## Validation targets

The `python/tests/` suite reproduces every numerical claim in Section 6
of the paper:

| Observable | Target error |
|---|---|
| Rayleigh $\lambda^{-4}$ exponent | < 1% |
| Zenith optical depth | machine $\epsilon$ |
| Refractive index profile (0-10 km) | < 1% |
| GPS orbital radius | < 0.01% |
| Beer's law transmittance | machine $\epsilon$ |
| Mie scattering peak | < 5% |
| Centimetre positioning | within spec |

## License

Research code. Reach out before redistributing.
