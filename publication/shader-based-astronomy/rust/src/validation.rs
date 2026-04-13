//! Numerical benchmarks from the paper, independent of the GPU path.
//!
//! Mirrors `shader_astronomy.validation` in Python. Keeping these in the
//! library (rather than only in `tests/`) lets downstream consumers
//! verify the install.

/// Physical constants (SI).
pub mod consts {
    pub const G_NEWTON: f64 = 6.674_30e-11;
    pub const M_EARTH: f64 = 5.972e24;
    pub const M_SUN: f64 = 1.989e30;
    pub const AU: f64 = 1.495_978_707e11;
    pub const SIGMA_SB: f64 = 5.670_374_419e-8;
}

/// Single benchmark: a computed value against a reference value and tolerance.
#[derive(Debug, Clone)]
pub struct Benchmark {
    /// Descriptive name (appears in reports).
    pub name: &'static str,
    /// Value computed by the pipeline.
    pub computed: f64,
    /// Reference value from the literature.
    pub reference: f64,
    /// Acceptable relative error.
    pub tolerance: f64,
}

impl Benchmark {
    /// Fractional absolute error vs reference.
    pub fn relative_error(&self) -> f64 {
        if self.reference == 0.0 {
            self.computed.abs()
        } else {
            (self.computed - self.reference).abs() / self.reference.abs()
        }
    }

    /// True if the computed value is within tolerance.
    pub fn passed(&self) -> bool {
        self.relative_error() <= self.tolerance
    }
}

/// Kepler's third law for GPS orbit: r = (GMT^2 / 4 pi^2)^(1/3).
pub fn gps_orbital_radius() -> Benchmark {
    use consts::*;
    let t_s: f64 = 12.0 * 3600.0;
    let r = (G_NEWTON * M_EARTH * t_s.powi(2) / (4.0 * std::f64::consts::PI.powi(2)))
        .powf(1.0 / 3.0);
    Benchmark {
        name: "GPS orbital radius",
        computed: r,
        reference: 2.656e7,
        tolerance: 1.0e-4,
    }
}

/// Beer's law: T = exp(-alpha * N * ds).
pub fn beers_law_100_voxels() -> Benchmark {
    let alpha = 0.01_f64;
    let ds = 100.0_f64;
    let n = 100_i32;
    let t: f64 = (0..n).map(|_| (-alpha * ds).exp()).product();
    Benchmark {
        name: "Beer's law transmittance (100 voxels)",
        computed: t,
        reference: (-100.0_f64).exp(),
        tolerance: 1.0e-14,
    }
}

/// Mars semi-major axis from Kepler.
pub fn mars_semi_major_axis() -> Benchmark {
    use consts::*;
    let t_s: f64 = 686.97 * 86400.0;
    let a = (G_NEWTON * M_SUN * t_s.powi(2) / (4.0 * std::f64::consts::PI.powi(2)))
        .powf(1.0 / 3.0);
    Benchmark {
        name: "Mars semi-major axis",
        computed: a,
        reference: 1.523_71 * AU,
        tolerance: 1.0e-4,
    }
}

/// Solar flux at Earth (Stefan-Boltzmann).
pub fn solar_flux_at_earth() -> Benchmark {
    use consts::*;
    let t_sun = 5778.0_f64;
    let r_sun = 6.957e8_f64;
    let flux = SIGMA_SB * t_sun.powi(4) * (r_sun / AU).powi(2);
    Benchmark {
        name: "Solar flux at Earth",
        computed: flux,
        reference: 1361.0,
        tolerance: 5.0e-3,
    }
}

/// Run the subset of benchmarks that don't require a GPU.
pub fn run_cpu_benchmarks() -> Vec<Benchmark> {
    vec![
        gps_orbital_radius(),
        beers_law_100_voxels(),
        mars_semi_major_axis(),
        solar_flux_at_earth(),
    ]
}
