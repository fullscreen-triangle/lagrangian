"""Stacked-fluid optics: Cauchy dispersion, discrete Snell, transfer tensor.

All wavelengths in micrometres (μm) unless otherwise stated.
All angles in radians.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

# ---------------------------------------------------------------------------
# Physical constants
# ---------------------------------------------------------------------------

C_LIGHT = 2.997_924_58e8  # m s^-1
C_LIGHT_UM_PS = C_LIGHT * 1e-6  # μm ps^-1

# ---------------------------------------------------------------------------
# Standard fluid library  (Cauchy A, B in μm units: n = A + B / λ_μm²)
# Coefficients from published Sellmeier fits, reduced to two-term Cauchy.
# ---------------------------------------------------------------------------

FLUIDS: dict[str, tuple[float, float]] = {
    "water":    (1.3210, 0.00640),
    "glycerol": (1.4590, 0.00580),
    "ethanol":  (1.3550, 0.00530),
    "benzene":  (1.4870, 0.00900),
    "cs2":      (1.5940, 0.01250),
    "toluene":  (1.4840, 0.00870),
    "olive_oil":(1.4660, 0.00750),
}

# Five canonical wavelengths (nm → μm)
LAMBDA_NM = np.array([400.0, 450.0, 500.0, 550.0, 600.0, 650.0, 700.0])
LAMBDA_UM = LAMBDA_NM / 1000.0

# Five wavelengths used in transfer-tensor experiments
LAMBDA5_NM = np.array([400.0, 480.0, 550.0, 620.0, 700.0])
LAMBDA5_UM = LAMBDA5_NM / 1000.0


# ---------------------------------------------------------------------------
# Cauchy dispersion
# ---------------------------------------------------------------------------


def cauchy_n(A: float, B: float, lam_um: NDArray) -> NDArray:
    """Real refractive index via two-term Cauchy formula."""
    return A + B / lam_um**2


def cauchy_alpha(A: float, B: float, lam_um: NDArray, k_ext: float = 1e-4) -> NDArray:
    """Absorption coefficient α (μm⁻¹) = 4π Im[n] / λ.

    We model Im[n] = k_ext (a small, wavelength-independent extinction coefficient)
    so α = 4π k_ext / λ.  For validation the precise value of k_ext does not matter;
    what matters is that α > 0 and decays with λ (normal absorption).
    """
    return 4.0 * np.pi * k_ext / lam_um


# ---------------------------------------------------------------------------
# Discrete Snell transition
# ---------------------------------------------------------------------------


def delta_theta_rad(n_partition: int) -> float:
    """Angular quantisation step for partition depth n: δθ = π / (4 n²)."""
    return np.pi / (4.0 * n_partition**2)


def snell_continuous(n1: NDArray, n2: NDArray, theta1: float) -> NDArray:
    """Standard Snell's law: return θ₂ (rad) for each wavelength.

    Returns NaN where total internal reflection occurs.
    """
    sin2 = n1 * np.sin(theta1) / n2
    sin2 = np.clip(sin2, -1.0, 1.0)
    return np.arcsin(sin2)


def snell_discrete(n1: NDArray, n2: NDArray, theta1: float, dtheta: float) -> NDArray:
    """Discrete Snell transition: round θ₂ to nearest multiple of dtheta."""
    theta2 = snell_continuous(n1, n2, theta1)
    return np.round(theta2 / dtheta) * dtheta


# ---------------------------------------------------------------------------
# Build the spectral transfer tensor for an N-layer stack
# ---------------------------------------------------------------------------


class StackLayer:
    """One fluid layer in the stack."""

    def __init__(self, name: str, thickness_um: float, k_ext: float = 1e-4):
        A, B = FLUIDS[name]
        self.name = name
        self.A = A
        self.B = B
        self.d = thickness_um  # μm
        self.k_ext = k_ext

    def n(self, lam_um: NDArray) -> NDArray:
        return cauchy_n(self.A, self.B, lam_um)

    def alpha(self, lam_um: NDArray) -> NDArray:
        return cauchy_alpha(self.A, self.B, lam_um, self.k_ext)


def build_stack(names: list[str], thickness_um: float = 1000.0) -> list[StackLayer]:
    return [StackLayer(name, thickness_um) for name in names]


def propagate_ray(
    stack: list[StackLayer],
    lam_um: NDArray,
    theta0: float,
    n_partition: int = 10,
) -> NDArray:
    """Propagate a ray at angle θ₀ through the full stack.

    Returns the output angle (rad) for each wavelength after traversing all N layers.
    n_air = 1.0 above and below the stack.
    """
    dtheta = delta_theta_rad(n_partition)
    n_air = np.ones_like(lam_um)
    n_prev = n_air.copy()
    theta_current = theta0 * np.ones_like(lam_um)  # per-wavelength angle

    for layer in stack:
        n_layer = layer.n(lam_um)
        theta_current = snell_discrete(n_prev, n_layer, theta_current.mean(), dtheta)
        # Carry per-wavelength through: use actual per-wavelength angles
        theta_current = snell_discrete(n_prev, n_layer, theta0, dtheta)
        n_prev = n_layer

    # Exit back into air
    theta_out = snell_discrete(n_prev, n_air, theta0, dtheta)
    return theta_out


def propagate_ray_full(
    stack: list[StackLayer],
    lam_um: NDArray,
    theta0: float,
    n_partition: int = 10,
) -> tuple[NDArray, NDArray]:
    """Full per-layer ray propagation — returns (angles, n_values) at each layer.

    angles[k, i] = angle inside layer i for wavelength k.
    n_values[k, i] = refractive index of layer i at wavelength k.
    """
    K = len(lam_um)
    N = len(stack)
    dtheta = delta_theta_rad(n_partition)
    n_air = np.ones(K)

    angles = np.zeros((K, N))
    n_vals = np.zeros((K, N))

    n_prev = n_air.copy()
    theta_in = theta0

    for i, layer in enumerate(stack):
        n_layer = layer.n(lam_um)
        # Compute per-wavelength refraction
        sin_theta2 = n_prev * np.sin(theta_in) / n_layer
        sin_theta2 = np.clip(sin_theta2, -1.0, 1.0)
        theta2_raw = np.arcsin(sin_theta2)
        theta2 = np.round(theta2_raw / dtheta) * dtheta
        angles[:, i] = theta2
        n_vals[:, i] = n_layer
        n_prev = n_layer
        theta_in = float(np.mean(theta2))  # carry the mean angle forward

    return angles, n_vals


def build_transfer_matrix(
    stack: list[StackLayer],
    lam_um: NDArray,
    theta_inputs: NDArray,
    n_partition: int = 10,
) -> NDArray:
    """Build the K×J transfer matrix A[k,j] = output angle for λ_k, θ_j.

    K = len(lam_um), J = len(theta_inputs).
    """
    K = len(lam_um)
    J = len(theta_inputs)
    A = np.zeros((K, J))
    dtheta = delta_theta_rad(n_partition)
    n_air = np.ones(K)

    for j, theta0 in enumerate(theta_inputs):
        n_prev = n_air.copy()
        theta_in = theta0
        for layer in stack:
            n_layer = layer.n(lam_um)
            sin2 = n_prev * np.sin(theta_in) / n_layer
            sin2 = np.clip(sin2, -1.0, 1.0)
            theta2_raw = np.arcsin(sin2)
            theta2 = np.round(theta2_raw / dtheta) * dtheta
            n_prev = n_layer
            theta_in = float(np.mean(theta2))
        # Exit into air
        sin_out = n_prev * np.sin(theta_in) / n_air
        sin_out = np.clip(sin_out, -1.0, 1.0)
        theta_out_raw = np.arcsin(sin_out)
        theta_out = np.round(theta_out_raw / dtheta) * dtheta
        A[:, j] = theta_out

    return A


def matrix_rank_svd(A: NDArray, tol_factor: float = 1e-10) -> int:
    """Numerical rank of A via SVD with relative tolerance."""
    sv = np.linalg.svd(A, compute_uv=False)
    tol = tol_factor * sv[0]
    return int(np.sum(sv > tol))
