"""Composition-inflation mechanism: T(n, d) = d (d+1)^(n-1).

Implements Theorem 4.3 (labelled composition count) and its corollaries.
"""

from __future__ import annotations

import math

import mpmath as mp


def T_labelled(n: int, d: int) -> int:
    """Number of labelled compositions of n in d-dim state space.

    T(n, d) = d * (d + 1)^(n - 1).

    Parameters
    ----------
    n : oscillation depth (>= 1)
    d : state-space dimension (>= 1)
    """
    if n < 1:
        raise ValueError("n must be >= 1")
    if d < 1:
        raise ValueError("d must be >= 1")
    return d * (d + 1) ** (n - 1)


def angular_resolution(n: int, d: int) -> mp.mpf:
    """Angular resolution = 2 pi / T(n, d).

    Returned as an mpmath mpf for exact arithmetic at high n.
    """
    mp.mp.dps = max(50, 2 * n)
    return mp.mpf(2) * mp.pi / mp.mpf(T_labelled(n, d))


def planck_depth(
    oscillator_freq_hz: float,
    d: int = 3,
    planck_time_s: float = 5.391_247e-44,
) -> int:
    """Minimum n such that T(n, d) * planck_time >= 1/oscillator_freq.

    Equivalently, the smallest n for which T(n, d) exceeds the number
    of Planck-time intervals in one oscillator period.
    """
    tau_osc = 1.0 / oscillator_freq_hz
    threshold = tau_osc / planck_time_s
    return 1 + math.ceil(math.log(threshold / d) / math.log(d + 1))


def precision_at_depth(n: int, d: int = 3) -> float:
    """Fractional precision attainable at depth n: (d+1)^(-n)."""
    return (d + 1) ** (-n)


def depth_for_precision(epsilon: float, d: int = 3) -> int:
    """Minimum n to reach fractional precision epsilon."""
    if epsilon <= 0.0 or epsilon >= 1.0:
        raise ValueError("epsilon must be in (0, 1)")
    return max(1, 1 + math.ceil(math.log(1.0 / epsilon) / math.log(d + 1)))


def caesium_planck_depth() -> int:
    """n_0 for caesium-133 hyperfine transition in d=3: 56."""
    return planck_depth(9_192_631_770.0, d=3)
