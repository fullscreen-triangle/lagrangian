"""Triple Observation Identity: Beer-Lambert, Chromatographic, Kirchhoff.

Implements Theorem 4.1 of the paper: bijective mappings between the three laws,
with cross-validation of the identity.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


# ---------------------------------------------------------------------------
# Beer-Lambert law
# ---------------------------------------------------------------------------


def beer_lambert_transmittance(alpha: NDArray, L: float) -> NDArray:
    """T = exp(-α L).  α in μm⁻¹, L in μm."""
    return np.exp(-alpha * L)


def beer_lambert_absorptance(alpha: NDArray, L: float) -> NDArray:
    """A = 1 - T = 1 - exp(-α L)."""
    return 1.0 - beer_lambert_transmittance(alpha, L)


def beer_lambert_absorbance(alpha: NDArray, L: float) -> NDArray:
    """Absorbance (optical density) OD = α L."""
    return alpha * L


def recover_alpha_from_transmittance(T: NDArray, L: float) -> NDArray:
    """Invert Beer-Lambert: α = -ln(T) / L."""
    T_safe = np.maximum(T, 1e-300)
    return -np.log(T_safe) / L


# ---------------------------------------------------------------------------
# Chromatographic retention (plate theory)
# ---------------------------------------------------------------------------


def capacity_factor_from_transmittance(T: NDArray) -> NDArray:
    """k' = T^{-1} - 1 = exp(αL) - 1.

    This is the bijection T ↔ 1/(1+k') from Theorem 4.1.
    """
    T_safe = np.maximum(T, 1e-300)
    return 1.0 / T_safe - 1.0


def transmittance_from_capacity_factor(k_prime: NDArray) -> NDArray:
    """Inverse bijection: T = 1 / (1 + k')."""
    return 1.0 / (1.0 + k_prime)


def recover_alpha_from_capacity_factor(k_prime: NDArray, L: float) -> NDArray:
    """Recover α from chromatographic k': α = ln(1 + k') / L."""
    return np.log1p(k_prime) / L


def mobile_phase_fraction(k_prime: NDArray) -> NDArray:
    """Fraction of time in mobile phase = 1 / (1 + k')."""
    return 1.0 / (1.0 + k_prime)


def stationary_phase_fraction(k_prime: NDArray) -> NDArray:
    """Fraction of time in stationary phase = k' / (1 + k')."""
    return k_prime / (1.0 + k_prime)


# ---------------------------------------------------------------------------
# Kirchhoff voltage law
# ---------------------------------------------------------------------------


def kirchhoff_voltage_fraction(T: NDArray) -> NDArray:
    """V_trans / V_source = T (transmitted voltage fraction).

    In the Kirchhoff frame: V_source = V_trans + V_resistive.
    Here V_trans / V_source = T, V_resistive / V_source = 1 - T = A.
    """
    return T.copy()


def recover_alpha_from_kirchhoff(V_frac: NDArray, L: float) -> NDArray:
    """Recover α from Kirchhoff voltage fraction: α = -ln(V_frac) / L."""
    return recover_alpha_from_transmittance(V_frac, L)


# ---------------------------------------------------------------------------
# Cross-validation of the triple identity
# ---------------------------------------------------------------------------


def triple_identity_cross_validate(
    alpha_true: NDArray, L: float
) -> dict[str, NDArray]:
    """Verify that all three arms recover the same α.

    Returns a dict with recovered α from each arm and the relative errors.
    """
    # Beer-Lambert arm
    T = beer_lambert_transmittance(alpha_true, L)
    alpha_bl = recover_alpha_from_transmittance(T, L)

    # Chromatographic arm
    k_prime = capacity_factor_from_transmittance(T)
    alpha_chrom = recover_alpha_from_capacity_factor(k_prime, L)

    # Kirchhoff arm
    V_frac = kirchhoff_voltage_fraction(T)
    alpha_kv = recover_alpha_from_kirchhoff(V_frac, L)

    # Relative errors vs true α
    alpha_safe = np.maximum(np.abs(alpha_true), 1e-300)
    err_bl = np.abs(alpha_bl - alpha_true) / alpha_safe
    err_chrom = np.abs(alpha_chrom - alpha_true) / alpha_safe
    err_kv = np.abs(alpha_kv - alpha_true) / alpha_safe

    # Cross-errors: chromatographic vs Beer-Lambert
    err_chrom_bl = np.abs(alpha_chrom - alpha_bl) / alpha_safe
    err_kv_bl = np.abs(alpha_kv - alpha_bl) / alpha_safe

    return {
        "alpha_true": alpha_true,
        "T": T,
        "k_prime": k_prime,
        "V_frac": V_frac,
        "alpha_bl": alpha_bl,
        "alpha_chrom": alpha_chrom,
        "alpha_kv": alpha_kv,
        "err_bl": err_bl,
        "err_chrom": err_chrom,
        "err_kv": err_kv,
        "err_chrom_bl": err_chrom_bl,
        "err_kv_bl": err_kv_bl,
    }


# ---------------------------------------------------------------------------
# A + R + P decomposition
# ---------------------------------------------------------------------------


def arp_decomposition(T: NDArray) -> tuple[NDArray, NDArray, NDArray]:
    """Decompose unit measure into A (actualised), R (residue), P (potential).

    In the Beer-Lambert frame with no remaining potential after traversal:
    A = T (transmitted = actualised)
    R = 1 - T (absorbed = residue)
    P = 0
    A + R + P = 1 = const.
    """
    A = T.copy()
    R = 1.0 - T
    P = np.zeros_like(T)
    return A, R, P


def arp_conservation_check(A: NDArray, R: NDArray, P: NDArray) -> NDArray:
    """Verify A + R + P = 1 for all entries.  Returns the deviation from 1."""
    total = A + R + P
    return np.abs(total - 1.0)
