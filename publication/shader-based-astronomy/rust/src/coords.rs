//! S-entropy coordinate system (paper Def. 3.1).
//!
//! Mirrors the Python reference in `shader_astronomy.coords` exactly.

use bytemuck::{Pod, Zeroable};

/// Boltzmann constant (SI).
pub const K_B: f32 = 1.380_649e-23;

/// Range bounds for S_k (Eq. 4).
pub const E_KIN_MIN: f32 = 1.0e-21;
/// Range bound.
pub const E_KIN_MAX: f32 = 2.0e-20;
/// Range bound.
pub const TAU_MIN: f32 = 1.0e-10;
/// Range bound.
pub const TAU_MAX: f32 = 1.0e-8;
/// Range bound.
pub const E_TOT_MIN: f32 = 1.0e-21;
/// Range bound.
pub const E_TOT_MAX: f32 = 3.0e-20;

/// Three-channel S-entropy coordinate stored per voxel.
#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct SEntropy {
    /// Kinetic / compositional channel (maps temperature).
    pub s_k: f32,
    /// Temporal / velocity channel (maps collision interval).
    pub s_t: f32,
    /// Energy channel (maps total energy).
    pub s_e: f32,
    /// Refractive index (cached).
    pub n_ref: f32,
}

impl SEntropy {
    /// Construct from physical state.
    pub fn from_physical(temperature_k: f32, pressure_pa: f32, velocity_m_s: f32) -> Self {
        let e_kin = 1.5 * K_B * temperature_k;
        let s_k = ((e_kin - E_KIN_MIN) / (E_KIN_MAX - E_KIN_MIN)).clamp(0.0, 1.0);

        let m_air = 4.8096e-26_f32;
        let v_therm = (3.0 * K_B * temperature_k / m_air).sqrt();
        let sigma_coll = 4.0e-19_f32;
        let n_density = pressure_pa / (K_B * temperature_k);
        let tau = 1.0 / (n_density * sigma_coll * v_therm);
        let s_t = ((tau - TAU_MIN) / (TAU_MAX - TAU_MIN)).clamp(0.0, 1.0);

        let e_bulk = 0.5 * m_air * velocity_m_s * velocity_m_s;
        let e_tot = e_kin + e_bulk;
        let s_e = ((e_tot - E_TOT_MIN) / (E_TOT_MAX - E_TOT_MIN)).clamp(0.0, 1.0);

        let rho = (pressure_pa * m_air) / (K_B * temperature_k);
        let n_ref = 1.0 + 2.9e-4 * rho / 1.225;

        Self { s_k, s_t, s_e, n_ref }
    }
}

/// USSA-76-style atmospheric density at altitude.
pub fn atmospheric_density(altitude_m: f32) -> f32 {
    let rho_dry = 1.205 * (-altitude_m / 8500.0).exp();
    let rho_vapour = 0.013 * (-altitude_m / 2000.0).exp();
    let rho_trace = 0.001 * (-altitude_m / 5000.0).exp();
    let rho_aerosol = 1.5e-5 * (-altitude_m / 1500.0).exp();
    rho_dry + rho_vapour + rho_trace + rho_aerosol
}

/// Lorentz-Lorenz refractive index from mass density (Eq. 8).
pub fn refractive_index(density_kg_m3: f32) -> f32 {
    const RHO_0: f32 = 1.225;
    const K_REF: f32 = 2.9e-4;
    1.0 + K_REF * density_kg_m3 / RHO_0
}
