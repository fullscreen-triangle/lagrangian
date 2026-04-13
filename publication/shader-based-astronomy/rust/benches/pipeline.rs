//! Microbenchmarks for the CPU validation subset.

use criterion::{criterion_group, criterion_main, Criterion};
use shader_astronomy::validation::run_cpu_benchmarks;

fn bench_cpu_validation(c: &mut Criterion) {
    c.bench_function("run_cpu_benchmarks", |b| {
        b.iter(|| {
            let results = run_cpu_benchmarks();
            criterion::black_box(results);
        })
    });
}

criterion_group!(benches, bench_cpu_validation);
criterion_main!(benches);
