"""S-entropy coordinate system.

Implements Definition 3.1 of the paper: the dimensionless mapping between
atmospheric thermodynamic state (T, P, rho, v, E) and texture-native
coordinates (S_k, S_t, S_e) in [0,1]^3.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# Physical constants (SI)
K_B = 1.380649e-23  # Boltzmann
N_A = 6.02214076e23  # Avogadro
R_GAS = K_B * N_A  # gas constant
M_AIR = 28.9647e-3 / N_A  # mean molecular mass, kg

# Atmospheric reference ranges (SI). These are the [min, max] windows
# that map onto the [0, 1] coordinate range.
E_KIN_MIN, E_KIN_MAX = 1.0e-21, 2.0e-20  # J per molecule, 0 to 1000 K
TAU_MIN, TAU_MAX = 1.0e-10, 1.0e-8  # collision interval, s
E_TOT_MIN, E_TOT_MAX = 1.0e-21, 3.0e-20  # J per molecule


@dataclass(frozen=True)
class SEntropy:
    """Three-channel S-entropy coordinate at a voxel."""

    s_k: float  # kinetic / compositional
    s_t: float  # temporal / velocity
    s_e: float  # energy

    def as_array(self) -> NDArray[np.float64]:
        return np.array([self.s_k, self.s_t, self.s_e], dtype=np.float64)

    def __post_init__(self) -> None:
        for name, v in (("s_k", self.s_k), ("s_t", self.s_t), ("s_e", self.s_e)):
            if not 0.0 <= v <= 1.0:
                raise ValueError(f"{name}={v} outside [0,1]")


def physical_to_s(
    temperature_k: float,
    pressure_pa: float,
    velocity_m_s: float,
) -> SEntropy:
    """Map physical state to S-entropy coordinates (Eqs. 4-6 of paper).

    Parameters
    ----------
    temperature_k : absolute temperature, K
    pressure_pa : pressure, Pa
    velocity_m_s : wind speed magnitude, m/s
    """
    # Mean kinetic energy per molecule: (3/2) k_B T
    e_kin = 1.5 * K_B * temperature_k
    s_k = (e_kin - E_KIN_MIN) / (E_KIN_MAX - E_KIN_MIN)

    # Collision time: mean free path / thermal velocity.
    # Simplified: tau ~ k_B T / (P * sigma_collision * v_thermal)
    v_therm = np.sqrt(3.0 * K_B * temperature_k / M_AIR)
    sigma_coll = 4.0e-19  # m^2, typical air
    n_density = pressure_pa / (K_B * temperature_k)
    tau_coll = 1.0 / (n_density * sigma_coll * v_therm)
    s_t = (tau_coll - TAU_MIN) / (TAU_MAX - TAU_MIN)

    # Total energy per molecule (kinetic + translation from bulk wind)
    e_bulk = 0.5 * M_AIR * velocity_m_s**2
    e_tot = e_kin + e_bulk
    s_e = (e_tot - E_TOT_MIN) / (E_TOT_MAX - E_TOT_MIN)

    return SEntropy(
        s_k=float(np.clip(s_k, 0.0, 1.0)),
        s_t=float(np.clip(s_t, 0.0, 1.0)),
        s_e=float(np.clip(s_e, 0.0, 1.0)),
    )


def s_to_physical(s: SEntropy) -> tuple[float, float, float]:
    """Inverse map. Returns (T [K], P [Pa], |v| [m/s])."""
    e_kin = s.s_k * (E_KIN_MAX - E_KIN_MIN) + E_KIN_MIN
    temperature_k = e_kin / (1.5 * K_B)

    tau_coll = s.s_t * (TAU_MAX - TAU_MIN) + TAU_MIN
    v_therm = np.sqrt(3.0 * K_B * temperature_k / M_AIR)
    sigma_coll = 4.0e-19
    n_density = 1.0 / (tau_coll * sigma_coll * v_therm)
    pressure_pa = n_density * K_B * temperature_k

    e_tot = s.s_e * (E_TOT_MAX - E_TOT_MIN) + E_TOT_MIN
    e_bulk = max(e_tot - e_kin, 0.0)
    velocity_m_s = np.sqrt(2.0 * e_bulk / M_AIR)

    return float(temperature_k), float(pressure_pa), float(velocity_m_s)


def refractive_index(density_kg_m3: float) -> float:
    """Atmospheric refractive index from Lorentz-Lorenz (paper Eq. 8)."""
    rho_0 = 1.225  # kg/m^3 at sea level
    k_ref = 2.9e-4
    return 1.0 + k_ref * density_kg_m3 / rho_0


def atmospheric_density(altitude_m: float) -> float:
    """Four-mechanism density profile (paper Pass 0).

    rho(z) = sum_j rho_{0,j} * exp(-z/H_j) with four exponential layers.
    """
    rho_dry = 1.205 * np.exp(-altitude_m / 8500.0)
    rho_vapour = 0.013 * np.exp(-altitude_m / 2000.0)
    rho_trace = 0.001 * np.exp(-altitude_m / 5000.0)
    rho_aerosol = 1.5e-5 * np.exp(-altitude_m / 1500.0)
    return float(rho_dry + rho_vapour + rho_trace + rho_aerosol)
