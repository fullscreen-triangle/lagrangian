"""Reproduce every row of the paper's Section 6 validation table."""

from __future__ import annotations

import pytest

from shader_astronomy import validation


@pytest.mark.parametrize("bench", validation.run_all(), ids=lambda b: b.name)
def test_benchmark(bench: validation.Benchmark) -> None:
    """Every benchmark in the paper must pass its stated tolerance."""
    assert bench.passed, (
        f"{bench.name}: computed={bench.computed:.6e} "
        f"reference={bench.reference:.6e} rel_err={bench.relative_error:.3e} "
        f"tolerance={bench.tolerance:.3e}"
    )


def test_report_renders() -> None:
    """The validation report formatter produces non-empty output."""
    report = validation.format_report(validation.run_all())
    assert "PASS" in report or "FAIL" in report
    assert len(report.splitlines()) > 5
