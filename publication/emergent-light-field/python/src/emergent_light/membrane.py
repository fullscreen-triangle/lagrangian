"""Light-membrane core: reference sky model, per-class time-series,
pixel spectrum via windowed FFT, classification via cross-correlation.

The JS implementation in the web app mirrors this file line-for-line.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

# ---- Constants ----

GRID_W = 96
GRID_H = 48
N_SAMPLES = 256
DURATION_S = 86400.0
N_OMEGA = (N_SAMPLES // 2) + 1

CLASS_NAMES = ["star", "planet", "pulsar", "satellite", "exoplanet"]

BANDS = [
    ("DC (steady)", (0, 1)),
    ("Diurnal", (1, 3)),
    ("Slow (mins)", (3, 12)),
    ("Fast (seconds)", (12, 50)),
    ("Very fast", (50, N_OMEGA)),
]


# ---- Sky reference model ----


def sky_reference_model(alt_rad: float, az_rad: float, sun_alt: float) -> float:
    """Additive sky brightness: airglow + scattered sunlight + extinction.

    Same parametric form as the JS implementation.
    """
    airglow = 0.01
    solar_component = max(0.0, sun_alt) * (np.sin(alt_rad) ** 0.7)
    scatter = solar_component * (3.0 + np.cos(az_rad) * 0.3)
    ext = 0.01 / (np.sin(alt_rad) + 0.05)
    return float(airglow + scatter + ext)


def pixel_grid_sky(sun_alt: float) -> NDArray[np.float64]:
    """Evaluate the reference sky on the full (GRID_H, GRID_W) grid."""
    alt = np.linspace(np.pi, 0.0, GRID_H, endpoint=False)
    az = np.linspace(0.0, 2 * np.pi, GRID_W, endpoint=False)
    A, Z = np.meshgrid(alt, az, indexing="ij")
    solar = np.maximum(0.0, sun_alt) * (np.sin(A) ** 0.7)
    scatter = solar * (3.0 + np.cos(Z) * 0.3)
    ext = 0.01 / (np.sin(A) + 0.05)
    return 0.01 + scatter + ext


# ---- Source time-series ----


@dataclass
class Source:
    id: str
    kind: str
    pixel: tuple[int, int]  # (x, y) = (dx, dy) = (az index, alt index)
    flux: float
    period: float | None = None
    duration: float | None = None
    transits: list[float] = field(default_factory=list)


def source_time_series(src: Source, t_grid: NDArray[np.float64]) -> NDArray[np.float64]:
    """Class-specific brightness time-series for a given source.

    Shape: (N_samples,). Deterministic.
    """
    N = t_grid.size
    out = np.zeros(N, dtype=np.float64)
    if src.kind == "star":
        out += src.flux * (1.0 + 0.01 * np.sin(0.5 * t_grid))
    elif src.kind == "planet":
        out += src.flux * (0.9 + 0.1 * np.cos(2 * np.pi * t_grid / src.period))
    elif src.kind == "pulsar":
        f = 1.0 / src.period
        phase = 2 * np.pi * f * t_grid
        spike = np.exp(10.0 * (np.cos(phase) - 1.0))
        out += src.flux * (0.1 + 0.9 * spike)
    elif src.kind == "satellite":
        for ti in src.transits:
            dt = np.abs(t_grid - ti)
            mask = dt < 0.05
            if mask.any():
                r = dt[mask] / 0.01
                out[mask] += src.flux * np.exp(-(r ** 2))
    elif src.kind == "exoplanet":
        phase = (t_grid / src.period) % 1.0
        in_transit = phase < (src.duration / src.period)
        out += src.flux * np.where(in_transit, 0.985, 1.0)
    return out


def synthesise_sources() -> list[Source]:
    """Synthetic catalogue with periods above Nyquist (675 s).
    200 stars, 5 planets, 3 pulsars, 6 satellites, 2 exoplanet hosts.
    """
    sources: list[Source] = []
    for i in range(200):
        ax = (i * 127 + 41) % GRID_W
        dy = (i * 89 + 17) % GRID_H
        sources.append(Source(
            id=f"star{i}",
            kind="star",
            pixel=(ax, dy),
            flux=1.5 + ((i * 31) % 100) / 100.0,
        ))
    for i in range(5):
        sources.append(Source(
            id=f"planet{i}",
            kind="planet",
            pixel=(11 + i * 18, 23 + (i % 3) * 4),
            flux=4.0 + i * 1.2,
            period=6000.0 + i * 3000.0,
        ))
    for i in range(3):
        sources.append(Source(
            id=f"pulsar{i}",
            kind="pulsar",
            pixel=(27 + i * 20, 11 + i * 12),
            flux=3.0,
            period=1800.0 + i * 600.0,
        ))
    for i in range(6):
        transits = [((i * 800 + k * 10800) % DURATION_S) for k in range(8)]
        sources.append(Source(
            id=f"sat{i}",
            kind="satellite",
            pixel=(((i * 17) + 9) % GRID_W, (i * 7 + 29) % GRID_H),
            flux=8.0,
            transits=transits,
        ))
    for i in range(2):
        sources.append(Source(
            id=f"exo{i}",
            kind="exoplanet",
            pixel=(61 + i * 12, 31 + i * 5),
            flux=3.5,
            period=18000.0 + i * 6000.0,
            duration=1800.0,
        ))
    return sources


# ---- Windowed power spectrum ----


def pixel_spectrum(observed: NDArray, model: NDArray) -> NDArray:
    """Residual -> Hann window -> real FFT -> power spectrum."""
    N = observed.size
    residual = observed - model
    window = 0.5 * (1 - np.cos(2 * np.pi * np.arange(N) / (N - 1)))
    residual *= window
    spec = np.fft.rfft(residual)
    return (spec.real ** 2 + spec.imag ** 2).astype(np.float64)


# ---- Classifier ----


def _normalise(arr: NDArray) -> NDArray:
    s = arr.sum()
    return arr / s if s > 0 else arr


def _canonical_source(name: str) -> Source:
    """A typical-parameter representative of each class used to build fingerprints."""
    if name == "star":
        return Source(id="_star", kind="star", pixel=(0, 0), flux=2.0)
    if name == "planet":
        return Source(id="_planet", kind="planet", pixel=(0, 0), flux=4.0, period=8000.0)
    if name == "pulsar":
        return Source(id="_pulsar", kind="pulsar", pixel=(0, 0), flux=3.0, period=2000.0)
    if name == "satellite":
        return Source(id="_sat", kind="satellite", pixel=(0, 0), flux=8.0,
                      transits=[k * 10800.0 for k in range(8)])
    if name == "exoplanet":
        return Source(id="_exo", kind="exoplanet", pixel=(0, 0),
                      flux=3.5, period=20000.0, duration=1800.0)
    raise ValueError(f"unknown class {name}")


def make_time_grid() -> NDArray:
    return np.linspace(0.0, DURATION_S, N_SAMPLES, endpoint=False)


def fingerprint(name: str, N: int = N_OMEGA) -> NDArray:
    """Class fingerprint: a discriminative template weighting spectrum
    bins that are characteristic of that class.

    The templates are hand-crafted to be class-separating rather than
    mean-spectra. Each is normalised (L1 = 1) so that cross-correlation
    scores are comparable.
    """
    fp = np.zeros(N, dtype=np.float64)
    if name == "star":
        # Pure DC
        fp[0] = 1.0
    elif name == "planet":
        # DC plus a small low-frequency bump (modulates at period ~6k-18ks,
        # so fundamental at k ~ 5-14)
        fp[0] = 0.4
        for k in range(5, 15):
            if k < N:
                fp[k] = 0.06
    elif name == "pulsar":
        # Narrow peak at k ~ DURATION_S/period, period ~2000 → k ~ 43
        # Plus first two harmonics. DC excluded.
        for k_fund in [40, 43, 46]:  # spread across three pulsars in catalogue
            for h in [1, 2, 3]:
                idx = h * k_fund
                if idx < N:
                    fp[idx] = 1.0 / h
    elif name == "satellite":
        # Broadband: uniform at mid/high frequencies, DC explicitly zero
        fp[3:] = 1.0
    elif name == "exoplanet":
        # Comb at k0 ~ DURATION_S / 18000 = 4.8, harmonics at 5, 10, 14, 19
        for k in [4, 5, 9, 10, 14, 15, 19, 20, 24, 25]:
            if k < N:
                fp[k] = 1.0
    return _normalise(fp)


_FINGERPRINTS = {name: fingerprint(name) for name in CLASS_NAMES}


def classify_pixel(spectrum: NDArray) -> dict:
    """Two-stage cross-correlation classifier.

    Stage 1 (DC-dominated pixels): if spectrum[0] / total > 0.95, the
    pixel's signature is essentially constant — classify as star.

    Stage 2 (oscillatory pixels): zero out DC, renormalise both pixel
    and fingerprint (excluding their DC entries), cross-correlate.
    The class fingerprints for non-star classes are designed to be
    discriminative in the non-DC subspace.
    """
    total = float(spectrum.sum())
    if total <= 0:
        return {"kind": "empty", "score": 0.0, "total_power": 0.0}

    dc_frac = float(spectrum[0] / total)
    if dc_frac > 0.95:
        return {
            "kind": "star",
            "score": dc_frac,
            "total_power": total,
        }

    # Non-DC classification
    nondc = spectrum.copy()
    nondc[0] = 0.0
    nondc_sum = float(nondc.sum())
    if nondc_sum <= 0:
        return {"kind": "star", "score": dc_frac, "total_power": total}
    norm = nondc / nondc_sum

    best_kind = None
    best_score = -np.inf
    # Exclude 'star' from stage 2 — stars have no non-DC signature to match
    for name, fp in _FINGERPRINTS.items():
        if name == "star":
            continue
        fp_nondc = fp.copy()
        fp_nondc[0] = 0.0
        s = float(fp_nondc.sum())
        if s <= 0:
            continue
        fp_norm = fp_nondc / s
        score = float(np.dot(norm, fp_norm))
        if score > best_score:
            best_score = score
            best_kind = name
    if best_kind is None:
        return {"kind": "star", "score": dc_frac, "total_power": total}
    return {"kind": best_kind, "score": best_score, "total_power": total}


# ---- Build a membrane across the full grid ----


def build_membrane(
    sources: list[Source],
    sun_alt: float,
    model_perturbation: float = 0.0,
    noise_rng: np.random.Generator | None = None,
) -> dict:
    """Build the full membrane: observed + model + spectra + classification.

    Returns dict with keys:
      observed  : (GRID_H, GRID_W, N_SAMPLES)
      model     : (GRID_H, GRID_W, N_SAMPLES)  (may differ from truth by model_perturbation)
      spectra   : (GRID_H, GRID_W, N_OMEGA)
      classes   : (GRID_H, GRID_W) object array of {kind, score, total_power}
    """
    rng = noise_rng or np.random.default_rng(42)
    t_grid = make_time_grid()

    base_sky = pixel_grid_sky(sun_alt)  # (H, W)
    diurnal = 0.3 * np.sin(2 * np.pi * np.arange(N_SAMPLES) / N_SAMPLES)  # (T,)

    # Observed = sky + diurnal + noise + sources
    observed = np.zeros((GRID_H, GRID_W, N_SAMPLES), dtype=np.float64)
    model = np.zeros_like(observed)
    base_sky_bcast = base_sky[..., None]
    diurnal_bcast = diurnal[None, None, :]
    sky_component = base_sky_bcast + diurnal_bcast
    observed[...] = sky_component + 0.02 * (rng.random(observed.shape) - 0.5)
    # Perturb the model used for subtraction by model_perturbation factor
    model[...] = sky_component * (1.0 + model_perturbation)

    # Inject sources
    for src in sources:
        ax, dy = src.pixel
        if 0 <= dy < GRID_H and 0 <= ax < GRID_W:
            observed[dy, ax] += source_time_series(src, t_grid)

    # Compute spectra
    residual = observed - model
    window = 0.5 * (1 - np.cos(2 * np.pi * np.arange(N_SAMPLES) / (N_SAMPLES - 1)))
    windowed = residual * window[None, None, :]
    spec = np.fft.rfft(windowed, axis=-1)
    spectra = (spec.real ** 2 + spec.imag ** 2)

    # Classify every pixel
    classes = np.empty((GRID_H, GRID_W), dtype=object)
    for dy in range(GRID_H):
        for dx in range(GRID_W):
            classes[dy, dx] = classify_pixel(spectra[dy, dx])

    return {
        "observed": observed,
        "model": model,
        "spectra": spectra,
        "classes": classes,
    }
