# shader-astronomy (Python reference)

CPU reference implementation of the five-pass pipeline for prototyping,
numerical validation, and cross-checking the Rust GPU implementation.

The functions here are intentionally naive: readability and match to the
paper equations comes before performance. Production execution happens
on the GPU in the Rust crate.

## Modules

- `shader_astronomy.coords` — the S-entropy coordinate system $(S_k, S_t, S_e)$
  and its inverse.
- `shader_astronomy.passes` — CPU reference for the five pipeline passes.
- `shader_astronomy.validation` — the twelve benchmarks from Section 6 of the
  paper, plus pytest harness hooks.

## Running validation

```bash
uv run pytest -v                           # all 12 benchmarks
uv run pytest tests/test_validation.py -v  # just the paper's table
```
