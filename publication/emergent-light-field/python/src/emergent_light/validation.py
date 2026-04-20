"""Validation experiments for the Emergent Light Field paper.

Four experiment families, matching the paper's four theorems:

  1. Linearity + shift-equivariance (Thm 2.1)
  2. Projection recovery (Thm 3.1)
  3. Classification performance (Thm 4.1)
  4. Day/night invariance + model sensitivity (Thm 5.1)
"""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np

from emergent_light.membrane import (
    CLASS_NAMES,
    DURATION_S,
    GRID_H,
    GRID_W,
    N_OMEGA,
    N_SAMPLES,
    Source,
    build_membrane,
    make_time_grid,
    pixel_spectrum,
    source_time_series,
    synthesise_sources,
)


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
        return f"{x:.6e}"
    return str(x)


def _entry_leq(category, name, computed, ceiling, notes=""):
    c = float(computed)
    r = float(ceiling)
    rel = abs(c - r) / abs(r) if r != 0 else abs(c)
    return ValidationEntry(
        category=category,
        name=name,
        computed=_fmt(c),
        reference=f"<= {_fmt(r)}",
        relative_error=_fmt(rel),
        tolerance=f"<= {_fmt(r)}",
        passed=c <= r,
        notes=notes,
    )


def _entry_geq(category, name, computed, floor, notes=""):
    c = float(computed)
    r = float(floor)
    rel = abs(c - r) / abs(r) if r != 0 else abs(c)
    return ValidationEntry(
        category=category,
        name=name,
        computed=_fmt(c),
        reference=f">= {_fmt(r)}",
        relative_error=_fmt(rel),
        tolerance=f">= {_fmt(r)}",
        passed=c >= r,
        notes=notes,
    )


# -----------------------------------------------------------------------------
# Experiment 1: Linearity + shift-equivariance
# -----------------------------------------------------------------------------


def experiment_linearity() -> list[ValidationEntry]:
    results: list[ValidationEntry] = []
    t_grid = make_time_grid()

    src1 = 0.5 + 0.8 * np.sin(2 * np.pi * 5 * t_grid / DURATION_S)
    src2 = 0.3 + 0.2 * np.cos(2 * np.pi * 9 * t_grid / DURATION_S)

    combo = 2.0 * src1 + 3.0 * src2
    lin_err = float(np.max(np.abs(
        np.fft.rfft(combo) - (2.0 * np.fft.rfft(src1) + 3.0 * np.fft.rfft(src2))
    )))
    results.append(_entry_leq(
        "linearity",
        "FFT linearity (residual)",
        lin_err,
        1e-9,
        notes="max |F(2 s1 + 3 s2) - (2 F s1 + 3 F s2)|",
    ))

    shift = 37
    shifted = np.roll(src1, shift)
    base_spec = np.abs(np.fft.rfft(src1)) ** 2
    shifted_spec = np.abs(np.fft.rfft(shifted)) ** 2
    shift_rel = float(np.max(np.abs(shifted_spec - base_spec)) / max(base_spec.max(), 1e-12))
    results.append(_entry_leq(
        "linearity",
        "|F|^2 invariance under time shift",
        shift_rel,
        1e-10,
        notes=f"time shift = {shift} samples",
    ))

    model = np.full_like(t_grid, 0.1)
    obs_a = model + src1
    obs_b = model + src2
    combined_residual = (obs_a + obs_b) - (model + model)
    separate_sum = (obs_a - model) + (obs_b - model)
    residual_eq_err = float(np.max(np.abs(combined_residual - separate_sum)))
    results.append(_entry_leq(
        "linearity",
        "Residual linearity under source addition",
        residual_eq_err,
        1e-12,
    ))

    return results


# -----------------------------------------------------------------------------
# Experiment 2: Projection recovery
# -----------------------------------------------------------------------------


def experiment_projection() -> list[ValidationEntry]:
    results: list[ValidationEntry] = []
    t_grid = make_time_grid()

    pulsar = Source(id="p", kind="pulsar", pixel=(0, 0), flux=1.0, period=2000.0)
    sig = source_time_series(pulsar, t_grid)
    sig = sig - sig.mean()
    spec = pixel_spectrum(sig, np.zeros_like(sig))
    k_fund = int(round(DURATION_S / pulsar.period))
    narrow_idx = set()
    for h in range(1, 4):
        for k in range(max(h * k_fund - 2, 0), h * k_fund + 3):
            if k < spec.size:
                narrow_idx.add(k)
    fraction = float(sum(spec[k] for k in narrow_idx) / max(spec.sum(), 1e-12))
    results.append(_entry_geq(
        "projection",
        f"Pulsar narrow-band fraction (k_fund={k_fund})",
        fraction,
        0.5,
        notes=f"fraction = {fraction:.3f}",
    ))

    exo = Source(id="e", kind="exoplanet", pixel=(0, 0),
                 flux=1.0, period=20000.0, duration=1800.0)
    sig_e = source_time_series(exo, t_grid)
    sig_e = sig_e - sig_e.mean()
    spec_e = pixel_spectrum(sig_e, np.zeros_like(sig_e))
    k0 = max(1, int(round(DURATION_S / exo.period)))
    comb_idx = set()
    for h in range(1, 6):
        for k in range(max(h * k0 - 1, 0), h * k0 + 2):
            if k < spec_e.size:
                comb_idx.add(k)
    comb_fraction = float(sum(spec_e[k] for k in comb_idx) / max(spec_e.sum(), 1e-12))
    results.append(_entry_geq(
        "projection",
        f"Exoplanet comb fraction (k0={k0})",
        comb_fraction,
        0.5,
        notes=f"comb fraction = {comb_fraction:.3f}",
    ))

    # Stars are DC-dominated: spectrum of a constant signal concentrates
    # in k = 0 under the Hann window.
    star = Source(id="s", kind="star", pixel=(0, 0), flux=1.0)
    sig_s = source_time_series(star, t_grid)
    spec_s = pixel_spectrum(sig_s, np.zeros_like(sig_s))
    dc_fraction = float(spec_s[0] / max(spec_s.sum(), 1e-12))
    results.append(_entry_geq(
        "projection",
        "Star DC-dominated (spec[0] fraction)",
        dc_fraction,
        0.75,
        notes=f"dc_fraction = {dc_fraction:.4f}",
    ))

    sat = Source(id="st", kind="satellite", pixel=(0, 0), flux=1.0,
                 transits=[k * 10800.0 for k in range(8)])
    sig_sat = source_time_series(sat, t_grid)
    sig_sat = sig_sat - sig_sat.mean()
    spec_sat = pixel_spectrum(sig_sat, np.zeros_like(sig_sat))
    max_bin_fraction = float(spec_sat.max() / max(spec_sat.sum(), 1e-12))
    results.append(_entry_leq(
        "projection",
        "Satellite broadband (max-bin fraction)",
        max_bin_fraction,
        0.15,
        notes=f"max bin = {max_bin_fraction:.3f}",
    ))

    return results


# -----------------------------------------------------------------------------
# Experiment 3: Classification recall + FPR
# -----------------------------------------------------------------------------


def experiment_classification() -> list[ValidationEntry]:
    results: list[ValidationEntry] = []
    sources = synthesise_sources()
    mem = build_membrane(sources, sun_alt=-0.3)

    source_pixels = {src.pixel: src.kind for src in sources}
    per_correct = {c: 0 for c in CLASS_NAMES}
    per_total = {c: 0 for c in CLASS_NAMES}

    total_powers = np.array(
        [[mem["classes"][dy, dx]["total_power"] for dx in range(GRID_W)]
         for dy in range(GRID_H)]
    )
    threshold = 0.05 * total_powers.max()

    false_positives = 0
    empty = 0
    for dy in range(GRID_H):
        for dx in range(GRID_W):
            cls = mem["classes"][dy, dx]
            gt = source_pixels.get((dx, dy))
            if gt is not None:
                per_total[gt] += 1
                if cls["kind"] == gt:
                    per_correct[gt] += 1
            else:
                empty += 1
                if cls["total_power"] > threshold and cls["kind"] in CLASS_NAMES:
                    false_positives += 1

    for c in CLASS_NAMES:
        recall = per_correct[c] / max(per_total[c], 1)
        results.append(_entry_geq(
            "classification",
            f"recall[{c}]",
            recall,
            0.70,
            notes=f"{per_correct[c]}/{per_total[c]}",
        ))

    overall = sum(per_correct.values()) / max(sum(per_total.values()), 1)
    results.append(_entry_geq(
        "classification",
        "overall recall",
        overall,
        0.90,
        notes=f"{sum(per_correct.values())}/{sum(per_total.values())}",
    ))

    fpr = false_positives / max(empty, 1)
    results.append(_entry_leq(
        "classification",
        "false positive rate",
        fpr,
        5e-3,
        notes=f"{false_positives} FPs / {empty} empty pixels",
    ))

    return results


# -----------------------------------------------------------------------------
# Experiment 4: Day/night invariance + model sensitivity
# -----------------------------------------------------------------------------


def experiment_invariance() -> list[ValidationEntry]:
    results: list[ValidationEntry] = []
    sources = synthesise_sources()

    rng_night = np.random.default_rng(7)
    rng_noon = np.random.default_rng(7)
    mem_night = build_membrane(sources, sun_alt=-1.0, noise_rng=rng_night)
    mem_noon = build_membrane(sources, sun_alt=+1.0, noise_rng=rng_noon)

    diff = np.abs(mem_night["spectra"] - mem_noon["spectra"])
    max_spec = np.max(np.abs(mem_night["spectra"]))
    rel_diff = float(diff.max() / max(max_spec, 1e-12))
    results.append(_entry_leq(
        "invariance",
        "day/night spectrum max rel. diff",
        rel_diff,
        1e-10,
        notes="sun alt -1 vs +1",
    ))

    agree = 0
    total = GRID_H * GRID_W
    for dy in range(GRID_H):
        for dx in range(GRID_W):
            if mem_night["classes"][dy, dx]["kind"] == mem_noon["classes"][dy, dx]["kind"]:
                agree += 1
    results.append(_entry_geq(
        "invariance",
        "day/night classification agreement",
        agree / total,
        0.9999,
        notes=f"{agree}/{total} pixels",
    ))

    for eta in [0.00, 0.01, 0.05, 0.10, 0.25]:
        rng_eta = np.random.default_rng(7)
        mem = build_membrane(sources, sun_alt=-0.3,
                             model_perturbation=eta, noise_rng=rng_eta)
        correct = 0
        for src in sources:
            cls = mem["classes"][src.pixel[1], src.pixel[0]]
            if cls["kind"] == src.kind:
                correct += 1
        recall = correct / len(sources)
        expected = max(0.2, 0.95 - 2.5 * eta)
        results.append(_entry_geq(
            "invariance",
            f"recall at eta={eta:.2f}",
            recall,
            expected,
            notes=f"recall should be >= {expected:.2f}",
        ))

    return results


# -----------------------------------------------------------------------------
# Runner and I/O
# -----------------------------------------------------------------------------


def run_all() -> list[ValidationEntry]:
    return [
        *experiment_linearity(),
        *experiment_projection(),
        *experiment_classification(),
        *experiment_invariance(),
    ]


def write_json(results, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in results], f, indent=2)


def write_csv(results, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(results[0]).keys()))
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))


def summary(results):
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    by_cat = {}
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


def format_report(results):
    lines = []
    for cat in ["linearity", "projection", "classification", "invariance"]:
        subset = [r for r in results if r.category == cat]
        if not subset:
            continue
        lines.append(f"\n## {cat}")
        for r in subset:
            status = "PASS" if r.passed else "FAIL"
            lines.append(f"  [{status}] {r.name:<50s} computed={r.computed:<16s} {r.reference}")
            if r.notes:
                lines.append(f"         {r.notes}")
    s = summary(results)
    lines.append("\n## summary")
    lines.append(f"  {s['passed']}/{s['total']} passed ({100 * s['pass_rate']:.1f}%)")
    for cat, c in s["by_category"].items():
        lines.append(f"  {cat:<15s}: {c['passed']}/{c['total']}")
    return "\n".join(lines)
