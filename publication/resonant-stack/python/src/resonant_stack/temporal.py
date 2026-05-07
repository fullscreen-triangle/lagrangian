"""Temporal echo delays and Shapiro equivalence.

Equations from §§9-12 of the paper.
All lengths in μm, times in ps (picoseconds), c in μm/ps.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from resonant_stack.optics import C_LIGHT_UM_PS, StackLayer


# ---------------------------------------------------------------------------
# Optical path length and temporal delays
# ---------------------------------------------------------------------------


def optical_path_length_per_round_trip(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
) -> NDArray:
    """Compute L₀(λ) = 2 Σ_k d_k Re[n_k(λ)] / cos(θ_k(λ)) for one round trip.

    angles_inside[wavelength_idx, layer_idx] = ray angle inside each layer (rad).
    Returns L₀ in μm for each wavelength.
    """
    K = len(lam_um)
    L0 = np.zeros(K)
    for i, layer in enumerate(stack):
        n_layer = layer.n(lam_um)
        cos_theta = np.cos(angles_inside[:, i])
        cos_theta = np.maximum(cos_theta, 1e-8)  # avoid division by zero at grazing
        L0 += 2.0 * layer.d * n_layer / cos_theta
    return L0


def temporal_delay(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
    n_loop: int,
) -> NDArray:
    """Temporal echo delay Δτ_{n_loop}(λ) = n_loop * L₀(λ) / c  (ps).

    Returns delay in ps for each wavelength.
    """
    L0 = optical_path_length_per_round_trip(stack, lam_um, angles_inside)
    return n_loop * L0 / C_LIGHT_UM_PS


def temporal_delay_all_loops(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
    n_loops: NDArray,
) -> NDArray:
    """Δτ for all loop counts and wavelengths.

    Returns shape (len(n_loops), len(lam_um)).
    """
    L0 = optical_path_length_per_round_trip(stack, lam_um, angles_inside)
    return np.outer(n_loops, L0 / C_LIGHT_UM_PS)


def differential_delay(
    stack: list[StackLayer],
    lam1_um: float,
    lam2_um: float,
    angles1: NDArray,
    angles2: NDArray,
    n_loop: int,
) -> float:
    """δτ_{n_loop}(λ1, λ2) — differential temporal delay between two wavelengths (ps)."""
    L1 = float(optical_path_length_per_round_trip(stack, np.array([lam1_um]), angles1.reshape(1, -1)))
    L2 = float(optical_path_length_per_round_trip(stack, np.array([lam2_um]), angles2.reshape(1, -1)))
    return n_loop * (L1 - L2) / C_LIGHT_UM_PS


# ---------------------------------------------------------------------------
# Shapiro delay equivalence
# ---------------------------------------------------------------------------


def shapiro_delay_from_stack(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
    n_loop: int,
) -> NDArray:
    """Shapiro delay computed from the effective potential  Φ_eff = -½c²(Re[n]-1).

    Δt_Shapiro = -2/c³ ∫ Φ_eff dl = (1/c) ∫ (Re[n]-1) dl  (per round trip × n_loop)

    This is exactly Δτ_{n_loop} - n_loop * L_vac / c, where L_vac is the vacuum path.
    We compute it independently as a cross-check.
    """
    K = len(lam_um)
    shapiro = np.zeros(K)
    for i, layer in enumerate(stack):
        n_layer = layer.n(lam_um)
        cos_theta = np.cos(angles_inside[:, i])
        cos_theta = np.maximum(cos_theta, 1e-8)
        # Slant path length through this layer
        slant = layer.d / cos_theta
        # Effective potential contribution: (Re[n] - 1) * slant_path
        shapiro += (n_layer - 1.0) * slant

    # Multiply by 2 (round trip) and n_loop, divide by c
    return 2.0 * n_loop * shapiro / C_LIGHT_UM_PS


def verify_shapiro_equivalence(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
    n_loop: int,
) -> tuple[NDArray, NDArray, NDArray]:
    """Compare OPL-based delay vs Shapiro-based delay.

    Returns (delta_tau_opl, delta_tau_shapiro, relative_error).
    The two should agree because Δτ_OPL = n_loop*L0/c and
    Δτ_Shapiro = n_loop*(L0 - L_vac)/c — they differ by L_vac/c (vacuum transit).
    We compare the dispersive (wavelength-dependent) parts only.
    """
    tau_opl = temporal_delay(stack, lam_um, angles_inside, n_loop)
    tau_shapiro_dispersive = shapiro_delay_from_stack(stack, lam_um, angles_inside, n_loop)

    # Vacuum round-trip delay (same for all λ)
    total_thickness = sum(layer.d for layer in stack)
    cos_mean = np.mean(np.cos(angles_inside), axis=1)
    cos_mean = np.maximum(cos_mean, 1e-8)
    L_vac = 2.0 * total_thickness / cos_mean
    tau_vac = n_loop * L_vac / C_LIGHT_UM_PS

    tau_opl_dispersive = tau_opl - tau_vac
    rel_err = np.abs(tau_opl_dispersive - tau_shapiro_dispersive) / (
        np.abs(tau_shapiro_dispersive) + 1e-30
    )
    return tau_opl_dispersive, tau_shapiro_dispersive, rel_err


# ---------------------------------------------------------------------------
# Temporal-spectral joint distribution
# ---------------------------------------------------------------------------


def joint_distribution(
    stack: list[StackLayer],
    lam_um: NDArray,
    angles_inside: NDArray,
    n_loops: NDArray,
    reflectance: float = 26.0 / 27.0,
    k_ext: float = 1e-4,
) -> tuple[NDArray, NDArray]:
    """Compute I_{n_loop}(λ) and Δτ_{n_loop}(λ) for all loops.

    Returns:
        intensities: shape (N_loops, K)  — echo amplitudes
        delays:      shape (N_loops, K)  — echo arrival times (ps)
    """
    L0 = optical_path_length_per_round_trip(stack, lam_um, angles_inside)
    delays = np.outer(n_loops, L0 / C_LIGHT_UM_PS)  # (N_loops, K)

    # Absorption per round trip: Beer-Lambert with k_ext
    alpha = 4.0 * np.pi * k_ext / lam_um  # (K,)
    intensities = np.zeros((len(n_loops), len(lam_um)))
    for idx, nl in enumerate(n_loops):
        abs_factor = np.exp(-alpha * L0 * nl)
        refl_factor = reflectance ** nl
        intensities[idx, :] = abs_factor * refl_factor

    return intensities, delays
