"""Composition inflation, residue fraction, and related quantities.

Implements §§4, 5 of the paper.
"""

from __future__ import annotations

import math

import numpy as np
from numpy.typing import NDArray


# ---------------------------------------------------------------------------
# Composition inflation: T(n, d) = d * (d+1)^(n-1)
# ---------------------------------------------------------------------------


def T_inflation(n: int, d: int) -> int:
    """Number of distinguishable trajectory histories after n cycles in d dimensions."""
    return d * (d + 1) ** (n - 1)


def T_inflation_float(n: int, d: int) -> float:
    return float(T_inflation(n, d))


def inflation_ratio(n: int, d: int) -> float:
    """T(n+1, d) / T(n, d) = d+1."""
    return float(d + 1)


# ---------------------------------------------------------------------------
# Residue fraction and finesse
# ---------------------------------------------------------------------------


def residue_fraction(b: int, d: int) -> float:
    """f_R = (b^d - 1) / b^d.  For b=d=3: 26/27."""
    bd = b**d
    return (bd - 1) / bd


def cavity_finesse(f_R: float) -> float:
    """F = π * sqrt(f_R) / (1 - f_R)."""
    return math.pi * math.sqrt(f_R) / (1.0 - f_R)


def finesse_from_reflectance(R: float) -> float:
    """Standard Fabry-Perot finesse: F = π * sqrt(R) / (1 - R)."""
    return math.pi * math.sqrt(R) / (1.0 - R)


# ---------------------------------------------------------------------------
# Precision bound: (d+1)^{-n}
# ---------------------------------------------------------------------------


def precision_at_depth(n: int, d: int = 3) -> float:
    """Truncation error bound = (d+1)^{-n}."""
    return (d + 1) ** (-n)


def depth_for_precision(eps: float, d: int = 3) -> int:
    """Minimum n such that (d+1)^{-n} <= eps."""
    if eps <= 0:
        raise ValueError("eps must be positive")
    return math.ceil(math.log(1.0 / eps) / math.log(d + 1))


# ---------------------------------------------------------------------------
# A + R + P decomposition across cycles
# ---------------------------------------------------------------------------


def arp_across_cycles(n_cycles: int, b: int = 3, d: int = 3) -> NDArray:
    """Track A, R, P over n_cycles with base-b partition in d dimensions.

    At each cycle: A_new = f_A (newly actualised), R grows, P decreases.
    f_A = 1 / b^d (one cell actualised out of b^d)
    f_R = (b^d - 1) / b^d (residue fraction per cycle)

    Starting with P = 1, A = 0, R = 0:
    After cycle k:
      A(k) = cumulative actualised = 1 - P(k)  — but this grows without bound.

    We track the SINGLE-CYCLE decomposition at each step:
    A_cycle(k) = 1/b^d (fraction actualised this cycle)
    R_cycle(k) = R_prev + f_R * (remaining potential)
    P_cycle(k) = P_prev - A_cycle(k) ...

    Actually the natural interpretation: we start with potential P_0 = 1.
    Each cycle actualises fraction 1/b^d of remaining P and adds it to A.
    Remainder stays as potential (or transitions to residue on second cycle).

    For simplicity we use: at each cycle k, of the remaining P_{k-1}:
    - fraction 1/b^d becomes newly actualised (added to A)
    - fraction (b^d-1)/b^d transitions to residue R
    - P_k = 0 (potential fully consumed in each cycle)

    This gives: A(k) = 1/b^d * P_{k-1}, R(k) = R(k-1) + (b^d-1)/b^d * P_{k-1}
    P(0) = 1, then P(k) = 0 for k >= 1 in this model.

    A simpler model: each cycle we track the CYCLE's own ARP:
    A_k = 1/b^d, R_k = (b^d-1)/b^d, P_k = 0 (potential carried forward from outer scope)
    Cumulative: A_total = sum A_k = k/b^d, conservation per cycle: A+R+P=1.
    """
    f_A = 1.0 / b**d
    f_R = (b**d - 1) / b**d
    f_P = 0.0  # all potential resolved within each cycle

    cycles = np.arange(1, n_cycles + 1, dtype=float)
    A_cum = cycles * f_A  # cumulative actualised (unbounded, but per-cycle A = f_A)
    R_cum = cycles * f_R  # cumulative residue
    P_cum = np.zeros(n_cycles)  # potential fully resolved

    # Per-cycle conservation check: A_cycle + R_cycle + P_cycle = 1
    A_per = f_A * np.ones(n_cycles)
    R_per = f_R * np.ones(n_cycles)
    P_per = np.zeros(n_cycles)
    conservation = A_per + R_per + P_per  # should be 1.0

    return np.column_stack([cycles, A_per, R_per, P_per, conservation])


# ---------------------------------------------------------------------------
# Information redundancy
# ---------------------------------------------------------------------------


def information_redundancy_bits(n_loops: int, K: int, d: int = 3) -> float:
    """log2(T(n_loops, d) / K) — information surplus bits per channel."""
    T = T_inflation_float(n_loops, d)
    if T <= K:
        return 0.0
    return math.log2(T / K)


# ---------------------------------------------------------------------------
# Categorical time resolution
# ---------------------------------------------------------------------------


def categorical_time_resolution(omega_array: NDArray) -> float:
    """δt_cat = 2π / Σ_i ω_i  (in seconds if ω in rad/s)."""
    return 2.0 * math.pi / float(np.sum(omega_array))


def log_spaced_oscillator_network(
    f_min_hz: float, f_max_hz: float, N_omega: int
) -> NDArray:
    """Log-spaced oscillator frequencies in rad/s."""
    freqs_hz = np.logspace(
        math.log10(f_min_hz), math.log10(f_max_hz), N_omega
    )
    return 2.0 * math.pi * freqs_hz  # rad/s
