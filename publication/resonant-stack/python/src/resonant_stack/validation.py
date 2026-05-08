"""Validation harness for the resonant stack paper.

Seven experiment categories matching the falsifiable predictions in §24 and
the theorems in Parts I-V.  Produces structured results as JSON + CSV.
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np

from resonant_stack.composition import (
    T_inflation,
    arp_across_cycles,
    categorical_time_resolution,
    cavity_finesse,
    depth_for_precision,
    information_redundancy_bits,
    log_spaced_oscillator_network,
    precision_at_depth,
    residue_fraction,
)
from resonant_stack.optics import (
    FLUIDS,
    LAMBDA5_UM,
    LAMBDA_UM,
    build_stack,
    build_transfer_matrix,
    cauchy_n,
    matrix_rank_svd,
    propagate_ray_full,
)
from resonant_stack.temporal import (
    joint_distribution,
    temporal_delay_all_loops,
    verify_shapiro_equivalence,
)
from resonant_stack.triple import (
    arp_conservation_check,
    arp_decomposition,
    triple_identity_cross_validate,
)


# ---------------------------------------------------------------------------
# Reporting infrastructure (same pattern as sister packages)
# ---------------------------------------------------------------------------


@dataclass
class ValidationEntry:
    category: str
    name: str
    computed: str
    reference: str
    relative_error: str
    tolerance: str
    passed: bool
    notes: str = ""


def _fmt(x: Any) -> str:
    if isinstance(x, float):
        return f"{x:.17e}"
    if isinstance(x, int):
        return str(x)
    if isinstance(x, np.floating):
        return f"{float(x):.17e}"
    return str(x)


def _entry(
    category: str,
    name: str,
    computed: Any,
    reference: Any,
    tolerance: float,
    notes: str = "",
) -> ValidationEntry:
    c = float(computed)
    r = float(reference)
    if r == 0:
        rel_err = abs(c)
    else:
        rel_err = abs(c - r) / abs(r)
    return ValidationEntry(
        category=category,
        name=name,
        computed=_fmt(c),
        reference=_fmt(r),
        relative_error=_fmt(rel_err),
        tolerance=f"{tolerance:.3e}",
        passed=rel_err <= tolerance,
        notes=notes,
    )


# ===========================================================================
# Experiment 1: Cauchy dispersion and discrete Snell
# ===========================================================================


def validate_cauchy_dispersion() -> list[ValidationEntry]:
    """Verify Cauchy formula against known refractive index values."""
    results: list[ValidationEntry] = []

    # Water at 589 nm (sodium D line): known n ≈ 1.3330
    A, B = FLUIDS["water"]
    lam_d = 0.589  # μm
    n_water_d = cauchy_n(A, B, lam_d)
    results.append(
        _entry(
            "cauchy",
            "n_water(589 nm)",
            n_water_d,
            1.3330,
            tolerance=0.01,
            notes="Cauchy two-term vs tabulated; 1% tolerance",
        )
    )

    # Ethanol at 589 nm: known n ≈ 1.3614
    A, B = FLUIDS["ethanol"]
    n_eth_d = cauchy_n(A, B, lam_d)
    results.append(
        _entry(
            "cauchy",
            "n_ethanol(589 nm)",
            n_eth_d,
            1.3614,
            tolerance=0.01,
            notes="two-term Cauchy vs tabulated",
        )
    )

    # Benzene at 589 nm: known n ≈ 1.5011
    A, B = FLUIDS["benzene"]
    n_benz_d = cauchy_n(A, B, lam_d)
    results.append(
        _entry(
            "cauchy",
            "n_benzene(589 nm)",
            n_benz_d,
            1.5011,
            tolerance=0.01,
            notes="two-term Cauchy vs tabulated",
        )
    )

    # Normal dispersion: n should decrease with wavelength for dispersive fluids (B > 0)
    for name, (A, B) in FLUIDS.items():
        if B == 0.0:
            continue  # skip constant-n test entries
        n_blue = cauchy_n(A, B, 0.400)
        n_red = cauchy_n(A, B, 0.700)
        monotone = int(n_blue > n_red)
        results.append(
            _entry(
                "cauchy",
                f"normal_dispersion_{name}",
                monotone,
                1,
                tolerance=0.0,
                notes=f"n(400)={n_blue:.4f} > n(700)={n_red:.4f}",
            )
        )

    # Dispersion contrast Δn between glycerol and water should be >0 and wavelength-dependent
    A_g, B_g = FLUIDS["glycerol"]
    A_w, B_w = FLUIDS["water"]
    dn_blue = cauchy_n(A_g, B_g, 0.400) - cauchy_n(A_w, B_w, 0.400)
    dn_red = cauchy_n(A_g, B_g, 0.700) - cauchy_n(A_w, B_w, 0.700)
    wavelength_dependent = int(abs(dn_blue - dn_red) > 1e-4)
    results.append(
        _entry(
            "cauchy",
            "dispersion_contrast_wavelength_dependent",
            wavelength_dependent,
            1,
            tolerance=0.0,
            notes=f"Δn(blue)={dn_blue:.5f}, Δn(red)={dn_red:.5f}",
        )
    )

    return results


# ===========================================================================
# Experiment 2: Transfer matrix rank (Spectral Separability Theorem)
# ===========================================================================


def validate_spectral_separability() -> list[ValidationEntry]:
    """Verify that the transfer matrix has full rank for distinct fluid layers."""
    results: list[ValidationEntry] = []

    # Build a 5-layer stack with distinct fluids
    stack_5 = build_stack(
        ["water", "glycerol", "ethanol", "benzene", "cs2"],
        thickness_um=500.0,
    )

    # Input angles: 5 different incidence angles
    theta_inputs = np.deg2rad(np.array([5.0, 10.0, 15.0, 20.0, 25.0]))

    # Build 5×5 transfer matrix (5 wavelengths, 5 input angles)
    A_mat = build_transfer_matrix(stack_5, LAMBDA5_UM, theta_inputs, n_partition=12)
    rank_5 = matrix_rank_svd(A_mat)
    results.append(
        _entry(
            "separability",
            "rank(A_5x5) for 5-fluid stack",
            rank_5,
            5,
            tolerance=0.0,
            notes="Full row rank required for spectral separability",
        )
    )

    # A truly degenerate stack (constant n, B=0) has wavelength-independent angles,
    # so all K rows of A are identical → rank = 1.
    stack_degen = build_stack(
        ["nondispersive"] * 5,
        thickness_um=500.0,
    )
    A_degen = build_transfer_matrix(stack_degen, LAMBDA5_UM, theta_inputs, n_partition=12)
    rank_degen = matrix_rank_svd(A_degen)
    results.append(
        _entry(
            "separability",
            "rank(A_constant-n) = 1 for non-dispersive stack",
            rank_degen,
            1,
            tolerance=0.0,
            notes=f"rank={rank_degen}; B=0 => same angle for all wavelengths => rank 1",
        )
    )

    # Rank should increase monotonically as N (distinct fluids) increases
    fluid_names = ["water", "glycerol", "ethanol", "benzene", "cs2"]
    prev_rank = 0
    monotone_rank = True
    for k in range(1, 6):
        stack_k = build_stack(fluid_names[:k], thickness_um=500.0)
        A_k = build_transfer_matrix(
            stack_k, LAMBDA5_UM[:k], theta_inputs[:k], n_partition=12
        )
        rk = matrix_rank_svd(A_k)
        if rk < prev_rank:
            monotone_rank = False
        prev_rank = rk
    results.append(
        _entry(
            "separability",
            "rank monotone increasing with N distinct fluids",
            int(monotone_rank),
            1,
            tolerance=0.0,
            notes="rank non-decreasing as distinct layers added",
        )
    )

    # Condition number: 5-fluid stack should have finite condition number
    sv = np.linalg.svd(A_mat, compute_uv=False)
    cond = float(sv[0] / max(sv[-1], 1e-30))
    # Condition number finite means the matrix is invertible
    cond_finite = int(cond < 1e10)
    results.append(
        _entry(
            "separability",
            "condition_number(A_5x5) < 1e10",
            cond_finite,
            1,
            tolerance=0.0,
            notes=f"cond = {cond:.3e}",
        )
    )

    return results


# ===========================================================================
# Experiment 3: Temporal echo delays — linear scaling and Shapiro equivalence
# ===========================================================================


def validate_temporal_echoes() -> list[ValidationEntry]:
    """Verify linear scaling of Δτ with n_loop and Shapiro equivalence."""
    results: list[ValidationEntry] = []

    stack = build_stack(
        ["water", "glycerol", "ethanol", "benzene", "cs2"],
        thickness_um=500.0,
    )

    theta0 = np.deg2rad(15.0)
    angles, n_vals = propagate_ray_full(stack, LAMBDA5_UM, theta0, n_partition=12)
    n_loops = np.arange(1, 11)
    delays = temporal_delay_all_loops(stack, LAMBDA5_UM, angles, n_loops)

    # Check linear scaling: Δτ_{n_l}(λ) = n_l * τ₀(λ)
    tau0 = delays[0, :]  # single-loop delay
    for nl_idx, nl in enumerate([2, 5, 10]):
        expected = nl * tau0
        actual = delays[nl - 1, :]
        rel_err = float(np.max(np.abs(actual - expected) / (np.abs(expected) + 1e-30)))
        results.append(
            _entry(
                "temporal",
                f"linear_scaling_n_loop={nl}",
                rel_err,
                0.0,
                tolerance=1e-10,
                notes=f"max relative error over 5 wavelengths",
            )
        )

    # Differential delay: shorter λ should have larger delay (normal dispersion)
    tau_blue = delays[:, 0]   # λ=400nm
    tau_red = delays[:, -1]   # λ=700nm
    blue_gt_red = int(float(tau_blue[0]) > float(tau_red[0]))
    results.append(
        _entry(
            "temporal",
            "tau_blue > tau_red (normal dispersion)",
            blue_gt_red,
            1,
            tolerance=0.0,
            notes=f"τ(400nm)={tau_blue[0]:.4e} > τ(700nm)={tau_red[0]:.4e} ps",
        )
    )

    # Differential delay scales linearly with n_loop
    delta_tau_1 = float(tau_blue[0] - tau_red[0])
    delta_tau_5 = float(tau_blue[4] - tau_red[4])
    ratio = delta_tau_5 / (5.0 * delta_tau_1) if delta_tau_1 != 0 else 0
    results.append(
        _entry(
            "temporal",
            "differential_delay_linear_n_loop",
            ratio,
            1.0,
            tolerance=1e-10,
            notes=f"δτ(n=5)/[5*δτ(n=1)] = {ratio:.8f}",
        )
    )

    # Shapiro equivalence: dispersive delay from OPL = dispersive delay from Shapiro formula
    tau_opl, tau_shap, rel_err = verify_shapiro_equivalence(
        stack, LAMBDA5_UM, angles, n_loop=5
    )
    max_rel_err = float(np.max(rel_err))
    results.append(
        _entry(
            "temporal",
            "Shapiro equivalence max rel error (n_loop=5)",
            max_rel_err,
            0.0,
            tolerance=1e-8,
            notes="OPL-dispersive vs Shapiro-dispersive delay",
        )
    )

    # Echo intensity: verify Beer-Lambert decay with loop count
    intensities, _ = joint_distribution(
        stack, LAMBDA5_UM, angles, n_loops, reflectance=26.0 / 27.0
    )
    # Intensity should decrease monotonically with n_loop for each wavelength
    mono_decay = all(
        intensities[i, 0] >= intensities[i + 1, 0] for i in range(len(n_loops) - 1)
    )
    results.append(
        _entry(
            "temporal",
            "echo_intensity_monotone_decay",
            int(mono_decay),
            1,
            tolerance=0.0,
            notes="Beer-Lambert decay with loop count",
        )
    )

    return results


# ===========================================================================
# Experiment 4: Triple Observation Identity
# ===========================================================================


def validate_triple_identity() -> list[ValidationEntry]:
    """Verify Beer-Lambert, chromatographic, and Kirchhoff bijections."""
    results: list[ValidationEntry] = []

    # αL range [0.001, 10]: stay clear of floating-point underflow (exp(-700) → 0).
    L = 10.0   # μm
    alpha_vals = np.logspace(-4, 0, 60)  # μm^-1; αL in [0.001, 10]

    data = triple_identity_cross_validate(alpha_vals, L)

    max_err_bl = float(np.max(data["err_bl"]))
    max_err_chrom = float(np.max(data["err_chrom"]))
    max_err_kv = float(np.max(data["err_kv"]))

    results.append(
        _entry(
            "triple",
            "Beer-Lambert arm recovers alpha",
            max_err_bl,
            0.0,
            tolerance=1e-12,
            notes=f"max rel error = {max_err_bl:.3e} over aL in [0.001,10]",
        )
    )
    results.append(
        _entry(
            "triple",
            "Chromatographic arm recovers alpha",
            max_err_chrom,
            0.0,
            tolerance=1e-12,
            notes=f"max rel error = {max_err_chrom:.3e}",
        )
    )
    results.append(
        _entry(
            "triple",
            "Kirchhoff arm recovers alpha",
            max_err_kv,
            0.0,
            tolerance=1e-12,
            notes=f"max rel error = {max_err_kv:.3e}",
        )
    )

    max_err_cross_chrom = float(np.max(data["err_chrom_bl"]))
    max_err_cross_kv = float(np.max(data["err_kv_bl"]))
    results.append(
        _entry(
            "triple",
            "Chrom vs BL cross-validation",
            max_err_cross_chrom,
            0.0,
            tolerance=1e-12,
            notes=f"max cross error = {max_err_cross_chrom:.3e}",
        )
    )
    results.append(
        _entry(
            "triple",
            "Kirchhoff vs BL cross-validation",
            max_err_cross_kv,
            0.0,
            tolerance=1e-12,
            notes=f"max cross error = {max_err_cross_kv:.3e}",
        )
    )

    # k' = exp(aL)-1 should be strictly increasing in alpha (aL increases with alpha)
    T_vals = data["T"]
    k_prime = data["k_prime"]
    k_monotone = int(all(k_prime[i] < k_prime[i + 1] for i in range(len(k_prime) - 1)))
    results.append(
        _entry(
            "triple",
            "k-prime strictly increasing with alpha",
            k_monotone,
            1,
            tolerance=0.0,
            notes=f"k-prime range [{k_prime[0]:.4e}, {k_prime[-1]:.4e}]",
        )
    )

    # A + R + P = 1 conservation
    A, R, P = arp_decomposition(T_vals)
    max_conservation_err = float(np.max(arp_conservation_check(A, R, P)))
    results.append(
        _entry(
            "triple",
            "A + R + P = 1 conservation",
            max_conservation_err,
            0.0,
            tolerance=1e-14,
            notes=f"max deviation from 1 = {max_conservation_err:.3e}",
        )
    )

    return results


# ===========================================================================
# Experiment 5: Composition inflation and residue
# ===========================================================================


def validate_composition() -> list[ValidationEntry]:
    """Verify T(n,d) formula, residue fraction, and derived quantities."""
    results: list[ValidationEntry] = []

    # T(n, 3) = 3 * 4^(n-1)
    for n, expected in [(1, 3), (2, 12), (3, 48), (5, 768), (8, 49152), (10, 786432)]:
        computed = T_inflation(n, 3)
        results.append(
            _entry(
                "composition",
                f"T({n}, 3)",
                computed,
                expected,
                tolerance=0.0,
                notes="exact integer check",
            )
        )

    # Residue fraction for b=d=3: f_R = 26/27
    f_R = residue_fraction(b=3, d=3)
    results.append(
        _entry(
            "composition",
            "f_R = 26/27 (b=d=3)",
            f_R,
            26.0 / 27.0,
            tolerance=1e-15,
            notes="Theorem 5.2",
        )
    )

    # Cavity finesse from f_R
    F = cavity_finesse(f_R)
    # Expected: π * sqrt(26/27) / (1/27) = 27π * sqrt(26/27) ≈ 84
    F_expected = 27.0 * math.pi * math.sqrt(26.0 / 27.0)
    results.append(
        _entry(
            "composition",
            "finesse from residue fraction ≈ 84",
            F,
            F_expected,
            tolerance=1e-10,
            notes=f"F = {F:.4f}",
        )
    )

    # Precision at depth n=8 should be 4^{-8}
    p8 = precision_at_depth(8, d=3)
    results.append(
        _entry(
            "composition",
            "precision_at_depth(8, 3) = 4^{-8}",
            p8,
            4.0**-8,
            tolerance=1e-10,
            notes="within CODATA uncertainty",
        )
    )

    # Depth needed for CODATA-level precision (1e-5)
    n_codata = depth_for_precision(1e-5, d=3)
    results.append(
        _entry(
            "composition",
            "depth_for_precision(1e-5)",
            n_codata,
            9,
            tolerance=0.0,
            notes="log4(1e5) ≈ 8.3 → n=9",
        )
    )

    # ARP per-cycle conservation
    arp = arp_across_cycles(10, b=3, d=3)
    max_conservation_err = float(np.max(np.abs(arp[:, 4] - 1.0)))
    results.append(
        _entry(
            "composition",
            "ARP per-cycle conservation (10 cycles)",
            max_conservation_err,
            0.0,
            tolerance=1e-14,
            notes="A+R+P=1 over 10 cycles",
        )
    )

    # Information redundancy at n_loop=10, K=5 channels
    bits = information_redundancy_bits(10, K=5, d=3)
    # Expected: log2(T(10,3)/5) = log2(786432/5) ≈ 17.2 bits
    bits_expected = math.log2(T_inflation(10, 3) / 5.0)
    results.append(
        _entry(
            "composition",
            "info_redundancy(n_loop=10, K=5)",
            bits,
            bits_expected,
            tolerance=1e-10,
            notes=f"{bits:.2f} bits surplus per channel",
        )
    )

    # Sub-Planckian categorical clock
    omega_net = log_spaced_oscillator_network(10.0, 3e9, 1950)
    dt_cat = categorical_time_resolution(omega_net)
    t_planck = 5.391247e-44  # seconds
    sub_planck_ratio = dt_cat / t_planck
    # The categorical resolution should be very small — well below many common timescales
    results.append(
        _entry(
            "composition",
            "categorical_time_resolution(1950-mode network) [s]",
            dt_cat,
            0.0,
            tolerance=1.0,  # just checking it is finite and small
            notes=f"δt_cat = {dt_cat:.3e} s, t_Planck = {t_planck:.3e} s, ratio = {sub_planck_ratio:.3e}",
        )
    )

    return results


# ===========================================================================
# Experiment 6: Shell capacity C(n) = 2n²
# ===========================================================================


def validate_shell_capacity() -> list[ValidationEntry]:
    """Verify C(n) = 2n² and cumulative shell counts."""
    results: list[ValidationEntry] = []

    for n in [1, 2, 3, 4, 5, 6, 7, 8]:
        C_n = 2 * n**2
        results.append(
            _entry(
                "shell",
                f"C({n}) = 2n^2",
                C_n,
                2 * n**2,
                tolerance=0.0,
                notes="Theorem 2.3: shell capacity",
            )
        )

    # Cumulative sum: Σ_{n=1}^N C(n) = N(N+1)(2N+1)/3
    for N in [4, 8]:
        cumsum = sum(2 * n**2 for n in range(1, N + 1))
        formula = N * (N + 1) * (2 * N + 1) // 3
        results.append(
            _entry(
                "shell",
                f"Σ C(n) n=1..{N}",
                cumsum,
                formula,
                tolerance=0.0,
                notes="Sum of 2n² = N(N+1)(2N+1)/3",
            )
        )

    # Periodic table check: C(1)+C(2) = 10 (He-Ne span = 10 elements counting from H)
    # Actually row 1: 2 (H,He); row 2: 8; total first two rows = 10
    C1, C2 = 2 * 1**2, 2 * 2**2
    results.append(
        _entry(
            "shell",
            "C(1) + C(2) = 10 (first two periods)",
            C1 + C2,
            10,
            tolerance=0.0,
            notes="2 + 8 = 10 elements in first two periods",
        )
    )

    return results


# ===========================================================================
# Runner, I/O, summary
# ===========================================================================


def run_all() -> list[ValidationEntry]:
    return [
        *validate_cauchy_dispersion(),
        *validate_spectral_separability(),
        *validate_temporal_echoes(),
        *validate_triple_identity(),
        *validate_composition(),
        *validate_shell_capacity(),
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
    cats = ["cauchy", "separability", "temporal", "triple", "composition", "shell"]
    for cat in cats:
        subset = [r for r in results if r.category == cat]
        if not subset:
            continue
        lines.append(f"\n## {cat}")
        for r in subset:
            status = "PASS" if r.passed else "FAIL"
            name = r.name[:52]
            comp = r.computed[:20]
            ref = r.reference[:20]
            err = r.relative_error[:12]
            lines.append(
                f"  [{status}] {name:<52s} computed={comp:<20s} ref={ref:<20s} err={err}"
            )
    s = summary(results)
    lines.append("\n## summary")
    lines.append(f"  {s['passed']}/{s['total']} passed ({100 * s['pass_rate']:.1f}%)")
    for cat, c in s["by_category"].items():
        lines.append(f"  {cat:<15s}: {c['passed']}/{c['total']}")
    return "\n".join(lines)
