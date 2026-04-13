//! Validation tests: every row of the paper's Section 6 table.

use approx::assert_relative_eq;
use shader_astronomy::validation::{run_cpu_benchmarks, Benchmark};

#[test]
fn all_cpu_benchmarks_pass() {
    let results = run_cpu_benchmarks();
    for b in &results {
        assert!(
            b.passed(),
            "{}: computed={:.6e} ref={:.6e} rel_err={:.3e} tol={:.3e}",
            b.name,
            b.computed,
            b.reference,
            b.relative_error(),
            b.tolerance
        );
    }
}

#[test]
fn gps_matches_published_altitude() {
    let b: Benchmark = shader_astronomy::validation::gps_orbital_radius();
    assert_relative_eq!(b.computed, 2.656e7, max_relative = 1e-4);
}

#[test]
fn beers_law_machine_precision() {
    let b = shader_astronomy::validation::beers_law_100_voxels();
    assert!(b.relative_error() < 1e-14);
}
