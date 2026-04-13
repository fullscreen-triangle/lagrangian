# Universal Partition-Depth Observatory

Reference implementation and validation harness accompanying the paper
*"Dimensionless Reduction of the Gravitational Constant: A Framework for
G as a Computable Quantity from Bounded Phase-Space Partition Structure."*

## Core claim

$G$ is computable via three independent routes (oscillation-ratio,
category-fixed-point, partition-density) that converge to a common value
with precision $(d+1)^{-n}$ in the number of oscillation cycles $n$. At
$n = 8$ the three routes match CODATA; at $n = 27$ they reach fp64
machine precision; at $n = 56$ (6.1 ns of caesium integration) they
exceed the Planck-time interval count.

## Layout

```
.
├── universal-partition-depth-observatory.tex   Paper source
├── references.bib                              Bibliography
├── python/                                     Prototyping + validation
└── rust/                                       High-precision implementation
```

## Quick start

### Python (prototyping + CODATA comparison)

```bash
cd python
uv sync
uv run pytest                                # unit tests
uv run python -m gthree.cli --n 8            # compute G at n=8
uv run python -m gthree.cli --n 27 --report  # high-precision + full report
```

### Rust (arbitrary-precision, production path)

```bash
cd rust
cargo build --release
cargo run --release --bin compute-g -- --n 27
cargo test --release
cargo bench
```

## Falsification criteria

The paper's framework is falsified if:

1. The three routes disagree by more than $(d+1)^{-n}$ at matched $n$.
2. Computed $G$ at $n = 27$ departs from future sub-CODATA measurements
   by more than $10^{-16}$ fractionally.
3. Predicted cosmological $\dot G / G \approx -5 \times 10^{-11}$ yr$^{-1}$
   is excluded by future lunar-laser-ranging precision.

Any of these outcomes shows up as a failing test in this repository.
