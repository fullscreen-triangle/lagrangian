"""Transfer-matrix construction and source reconstruction for looped rays.

The matrix has rows indexed by path (row 0 = direct path, rows 1..C = fundamental
cycles) and columns indexed by source. Row c for source k is

    A[c, k] = alpha_c(direction_k) * exp(i * 2 pi * omega_c * wavelength_k)

where omega_c is the characteristic frequency of path c (direct-path bypass
frequency for c = 0, cycle-characteristic frequency for c >= 1) and alpha_c is
an angular coupling factor given by |n . (mu_i x mu_j)| averaged over the
path's edges. Distinct path frequencies give linearly independent rows
whenever the source wavelengths are distinct.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from loop_coupling.graph import HarmonicEdge, fundamental_cycles


@dataclass
class Source:
    """A synthetic source specified by direction and wavelength."""

    direction: np.ndarray  # shape (3,), unit vector
    wavelength: float  # same length unit as 1/omega
    amplitude: complex = 1.0 + 0j


def _dipole_orientation(seed: int) -> np.ndarray:
    """Deterministic pseudo-random unit vector per mode index."""
    rng = np.random.default_rng(seed + 17)
    v = rng.standard_normal(3)
    return v / np.linalg.norm(v)


def _angular_weight(direction: np.ndarray, edge: HarmonicEdge) -> float:
    """|n . (mu_i x mu_j)| — standard molecular angular-selection factor."""
    mu_i = _dipole_orientation(edge.i)
    mu_j = _dipole_orientation(edge.j)
    cross = np.cross(mu_i, mu_j)
    norm = np.linalg.norm(cross) or 1.0
    return float(abs(np.dot(direction, cross / norm)))


def _path_characteristic_freq(
    path: list[HarmonicEdge] | None,
    omega: np.ndarray,
    bypass_freq: float | None = None,
) -> float:
    """Characteristic frequency of a path — direct path uses bypass freq;
    cycles use the mean of constituent edge characteristic frequencies."""
    if path is None or len(path) == 0:
        if bypass_freq is None:
            return float(np.mean(omega))
        return bypass_freq
    return float(np.mean([e.characteristic_freq(omega) for e in path]))


def _path_angular_weight(
    path: list[HarmonicEdge] | None,
    direction: np.ndarray,
    default_seed: int = 0,
) -> float:
    """Angular coupling — direct path uses a fixed orientation; cycles average."""
    if path is None or len(path) == 0:
        ref = _dipole_orientation(default_seed)
        return float(abs(np.dot(direction, ref)))
    vals = [_angular_weight(direction, e) for e in path]
    return float(np.mean(vals))


def build_transfer_matrix(
    omega: np.ndarray,
    edges: list[HarmonicEdge],
    sources: list[Source],
    c_units: float = 1.0,
    bypass_offset: float = 0.3,
) -> np.ndarray:
    """Construct the (C+1) x K transfer matrix.

    Row 0: direct path, characteristic frequency offset slightly from the mode spectrum.
    Rows 1..C: fundamental cycles, characteristic frequency = mean of cycle edges.

    Parameters
    ----------
    omega : (N,) mode frequencies
    edges : harmonic edges
    sources : list of K sources
    c_units : conversion between wavelength and 1/frequency (dimensionless scale)
    bypass_offset : fractional displacement of the direct-path frequency from
                    mean(omega), to keep row 0 distinguishable from cycle rows
    """
    cycles = fundamental_cycles(len(omega), edges)
    C = len(cycles)
    K = len(sources)

    # Row characteristic frequencies (dimensionless, normalised to mean(omega))
    mean_omega = float(np.mean(omega))
    row_freqs: list[float] = []
    row_freqs.append(mean_omega * (1.0 + bypass_offset))  # direct path
    for cyc in cycles:
        row_freqs.append(_path_characteristic_freq(cyc, omega))

    # Pre-compute angular weights (C+1, K)
    alpha = np.zeros((C + 1, K), dtype=np.float64)
    for k, src in enumerate(sources):
        alpha[0, k] = max(_path_angular_weight(None, src.direction, default_seed=0), 0.15)
        for c, cyc in enumerate(cycles, start=1):
            alpha[c, k] = max(_path_angular_weight(cyc, src.direction), 0.15)

    # Phase matrix: 2 pi * row_freq[c] * wavelength[k] / c_units
    lambdas = np.array([s.wavelength for s in sources], dtype=np.float64)
    freqs = np.array(row_freqs, dtype=np.float64)
    phase = 2.0 * np.pi * np.outer(freqs, lambdas) / c_units

    A = alpha * np.exp(1j * phase)
    amps = np.array([s.amplitude for s in sources], dtype=np.complex128)
    return A * amps[np.newaxis, :]


def reconstruct_sources(
    A: np.ndarray,
    I: np.ndarray,
    regularisation: float = 0.0,
) -> np.ndarray:
    """Recover source amplitudes by least-squares / ridge regression."""
    if regularisation > 0.0:
        AtA = A.conj().T @ A
        reg = regularisation * np.eye(AtA.shape[0])
        return np.linalg.solve(AtA + reg, A.conj().T @ I)
    return np.linalg.lstsq(A, I, rcond=None)[0]


def condition_number(A: np.ndarray) -> float:
    svals = np.linalg.svd(A, compute_uv=False)
    if svals[-1] < 1e-300:
        return float("inf")
    return float(svals[0] / svals[-1])
