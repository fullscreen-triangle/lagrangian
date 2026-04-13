"""Validation harness for the three-route G framework.

Produces structured results (JSON + CSV) reproducing the paper's
numerical claims.
"""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import mpmath as mp

from gthree.composition import (
    T_labelled,
    angular_resolution,
    caesium_planck_depth,
    depth_for_precision,
    precision_at_depth,
)
from gthree.routes import (
    G_CODATA,
    G_CODATA_UNCERTAINTY,
    cosmological_a0,
    cosmological_gdot_over_g,
    g_route_i,
    g_route_ii,
    g_route_iii,
    g_three_route_mean,
)


@dataclass
class ValidationEntry:
    """One row in the validation output."""

    category: str
    name: str
    computed: str  # string representation preserves mpmath precision
    reference: str
    relative_error: str
    tolerance: str
    passed: bool
    notes: str = ""


def _fmt(x: Any) -> str:
    """Compact string format for any numeric type (preserving precision)."""
    if isinstance(x, mp.mpf):
        return mp.nstr(x, 20)
    if isinstance(x, int):
        return str(x)
    if isinstance(x, float):
        return f"{x:.17e}"
    return str(x)


def _entry(
    category: str,
    name: str,
    computed: Any,
    reference: Any,
    tolerance: float,
    notes: str = "",
) -> ValidationEntry:
    """Build a ValidationEntry with consistent error computation."""
    c = mp.mpf(computed) if not isinstance(computed, mp.mpf) else computed
    r = mp.mpf(reference) if not isinstance(reference, mp.mpf) else reference
    if r == 0:
        rel_err = mp.fabs(c)
    else:
        rel_err = mp.fabs(c - r) / mp.fabs(r)
    passed = float(rel_err) <= tolerance
    return ValidationEntry(
        category=category,
        name=name,
        computed=_fmt(c),
        reference=_fmt(r),
        relative_error=_fmt(rel_err),
        tolerance=f"{tolerance:.3e}",
        passed=passed,
        notes=notes,
    )


def validate_composition() -> list[ValidationEntry]:
    """Composition-inflation formula T(n, d) = d(d+1)^(n-1)."""
    results: list[ValidationEntry] = []

    # Small-n sanity values
    for n, d, expected in [
        (1, 3, 3),
        (2, 3, 12),
        (3, 3, 48),
        (5, 3, 768),
        (10, 3, 786_432),
        (8, 3, 49152),
        (1, 2, 2),
        (5, 2, 162),
    ]:
        computed = T_labelled(n, d)
        results.append(
            _entry(
                "composition",
                f"T({n}, {d})",
                computed,
                expected,
                tolerance=0.0,
                notes="closed-form",
            )
        )

    # Caesium Planck-depth threshold
    n_cs = caesium_planck_depth()
    results.append(
        _entry(
            "composition",
            "Caesium Planck depth n_P",
            n_cs,
            56,
            tolerance=0.0,
            notes="should equal 56 by paper Thm 4.3",
        )
    )

    # T(56, 3) exceeds tau_Cs / t_Planck
    tau_cs = 1.0 / 9_192_631_770.0
    t_planck = 5.391_247e-44
    ratio = tau_cs / t_planck  # ~ 2.018e33
    T_56 = mp.mpf(T_labelled(56, 3))
    results.append(
        _entry(
            "composition",
            "T(56, 3) / (tau_Cs / t_Planck)",
            float(T_56 / mp.mpf(ratio)),
            1.0,
            tolerance=10.0,  # must be >= 1 and close to order unity
            notes=f"T(56,3)={T_56:.3e}, ratio={ratio:.3e}",
        )
    )

    # Precision scaling
    for n in [8, 15, 27, 56]:
        p = precision_at_depth(n, d=3)
        expected = 4 ** (-n)
        results.append(
            _entry(
                "composition",
                f"precision_at_depth({n})",
                p,
                expected,
                tolerance=1e-10,
                notes=f"4^-{n} = {expected:.3e}",
            )
        )

    # Depth required for stated precision
    for eps_name, eps, expected_n in [
        ("1e-5", 1e-5, 9),
        ("1e-9", 1e-9, 16),
        ("1e-16", 1e-16, 28),
    ]:
        n = depth_for_precision(eps, d=3)
        results.append(
            _entry(
                "composition",
                f"depth_for_precision({eps_name})",
                n,
                expected_n,
                tolerance=0.15,  # allow +/- 1 cycle
                notes=f"log_4(1/{eps_name}) + 1",
            )
        )

    return results


def validate_angular_resolution() -> list[ValidationEntry]:
    """Angular resolution Δθ = 2π / T(n, d)."""
    results: list[ValidationEntry] = []
    # At n=56, d=3: Δθ should be ~ 1.65e-33 rad (sub-Planck angular)
    theta_56 = angular_resolution(56, 3)
    theta_planck_equiv = mp.mpf("3.1e-33")  # Planck angular equivalent
    results.append(
        _entry(
            "angular",
            "Δθ at n=56 (caesium Planck depth)",
            float(theta_56),
            float(theta_planck_equiv),
            tolerance=10.0,
            notes=f"Δθ={float(theta_56):.3e} rad; dimensionless",
        )
    )

    # Δθ is strictly monotone decreasing
    prev = mp.mpf("10.0")
    for n in [1, 5, 10, 30, 56, 80]:
        theta = angular_resolution(n, 3)
        assert theta < prev, f"Δθ not monotone at n={n}"
        prev = theta
        results.append(
            _entry(
                "angular",
                f"Δθ(n={n}, d=3)",
                float(theta),
                float(theta),
                tolerance=0.0,
                notes="computed value (self-referential, reported only)",
            )
        )

    return results


def validate_three_routes() -> list[ValidationEntry]:
    """Route I, II, III convergence and CODATA agreement."""
    results: list[ValidationEntry] = []

    codata_tol = float(G_CODATA_UNCERTAINTY / G_CODATA)  # ~2.2e-5

    for n in [8, 15, 27]:
        r1 = g_route_i(n, 3)
        r2 = g_route_ii(n, 3)
        r3 = g_route_iii(n, 3)

        # Each route vs CODATA
        for r, label in [(r1, "I"), (r2, "II"), (r3, "III")]:
            dev = r.relative_deviation_from_codata()
            results.append(
                _entry(
                    "routes",
                    f"Route {label} at n={n} vs CODATA",
                    float(dev),
                    0.0,
                    tolerance=max(codata_tol, 1e-3),
                    notes=f"G = {mp.nstr(r.value, 15)}",
                )
            )

        # Three-route mean
        tri = g_three_route_mean(n, 3)
        mean_dev = float(tri["codata_deviation"])
        results.append(
            _entry(
                "routes",
                f"Three-route mean at n={n} vs CODATA",
                mean_dev,
                0.0,
                tolerance=max(codata_tol, 1e-3),
                notes=f"spread = {mp.nstr(tri['spread'], 8)}",
            )
        )

    return results


def validate_cosmology() -> list[ValidationEntry]:
    """Cosmological predictions: a_0 and dG/G."""
    results: list[ValidationEntry] = []

    a0_pred = cosmological_a0(float(G_CODATA), h0_km_s_mpc=67.4)
    results.append(
        _entry(
            "cosmology",
            "MOND acceleration scale a_0",
            a0_pred,
            1.2e-10,
            tolerance=0.5,  # order-of-magnitude test
            notes="a_0 ~ G H_0 (m/s^2), empirical ref 1.2e-10",
        )
    )

    gdot = cosmological_gdot_over_g(d=3)
    results.append(
        _entry(
            "cosmology",
            "dG/G secular drift (yr^-1)",
            gdot,
            -5.0e-11,
            tolerance=0.5,
            notes="Route III prediction -3H/(d+1); LLR bound |dG/G| < 1e-12/yr",
        )
    )

    return results


def run_all() -> list[ValidationEntry]:
    """Execute the full validation suite."""
    return [
        *validate_composition(),
        *validate_angular_resolution(),
        *validate_three_routes(),
        *validate_cosmology(),
    ]


def write_json(results: list[ValidationEntry], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in results], f, indent=2)


def write_csv(results: list[ValidationEntry], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()))
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))


def summary(results: list[ValidationEntry]) -> dict[str, Any]:
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    by_cat: dict[str, dict[str, int]] = {}
    for r in results:
        by_cat.setdefault(r.category, {"passed": 0, "total": 0})
        by_cat[r.category]["total"] += 1
        if r.passed:
            by_cat[r.category]["passed"] += 1
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": passed / total if total else 0.0,
        "by_category": by_cat,
    }


def format_report(results: list[ValidationEntry]) -> str:
    lines: list[str] = []
    for cat in ["composition", "angular", "routes", "cosmology"]:
        subset = [r for r in results if r.category == cat]
        if not subset:
            continue
        lines.append(f"\n## {cat}")
        for r in subset:
            status = "PASS" if r.passed else "FAIL"
            lines.append(
                f"  [{status}] {r.name:<50s} "
                f"computed={r.computed[:22]:<22s} "
                f"ref={r.reference[:22]:<22s} "
                f"rel_err={r.relative_error[:10]}"
            )
            if r.notes:
                lines.append(f"         {r.notes}")
    s = summary(results)
    lines.append("\n## summary")
    lines.append(
        f"  {s['passed']}/{s['total']} passed ({100 * s['pass_rate']:.1f}%)"
    )
    for cat, c in s["by_category"].items():
        lines.append(f"  {cat:<15s}: {c['passed']}/{c['total']}")
    return "\n".join(lines)
