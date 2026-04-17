# loop-coupling (Python reference)

Validation harness for the paper *Harmonic-Scattering Loop Coupling: A
Transfer-Matrix Framework for Multi-Source Resolution via Path-Multiplexed
Rays Through Polyatomic Molecular Resonators*.

## Modules

- `loop_coupling.graph` — harmonic-edge construction, cycle rank,
  fundamental cycle basis.
- `loop_coupling.transfer` — `(C+1) x K` transfer-matrix construction,
  source reconstruction via Tikhonov-regularised least squares,
  condition-number utility.
- `loop_coupling.validation` — the three experiments from §7 of the paper.
- `loop_coupling.cli` — command-line entry that runs the full suite and
  writes JSON + CSV outputs.

## Running

```bash
uv sync                              # or: python -m pip install -e '.[dev]'
uv run loop-coupling --output-dir ../output
# or directly:
PYTHONPATH=src python -m loop_coupling.cli --output-dir ../output
```

Expected outcome: **18/18** benchmarks pass; JSON and CSV written to
`../output/validation.{json,csv}`. Non-zero exit on any regression.

## Benchmark breakdown

| Experiment | Count | Key claim |
|---|---:|---|
| Reconstruction (§7.1) | 5 | $K = C+1$ sources recovered to machine $\epsilon$ at zero noise |
| Viscosity--$n_r$ monotonicity (§7.2) | 5 | $\rho_s = +0.96$ in H-bond class |
| Conditioning scaling (§7.3) | 8 | $\kappa(\Cmat) \propto C^{1.25}$, sub-quadratic |
