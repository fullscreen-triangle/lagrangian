# Observatory

A framework in which **shaders are the instruments**. The GPU does not
render someone else's measurement; it performs the measurement. This
repository holds the mathematical framework, its reference
implementations, two papers that state the framework's claims, and a
browser-native web app that lets a visitor's GPU execute the
instruments without ever contacting a server.

---

## 1. The thesis in one paragraph

Every SI unit reduces to a count of states, a ratio, or the circle
constant $\pi$. Nothing in dimensional physics — including Newton's
gravitational constant $G$ — is genuinely irreducible. A bounded
physical system has a state-count function $\mathcal{M}(\epsilon)$ that
grows combinatorially in the refinement depth $n$ according to
$T(n, d) = d\,(d+1)^{n-1}$, where $d$ is the state-space dimension.
Three equivalent enumerative descriptions of a bounded oscillatory
system — **oscillations, categories, partitions** — yield the same
entropy $S = k_B\,\mathcal{M}\,\ln b$. A GPU fragment shader evaluating
a scalar field at its pixel coordinates performs, by construction, the
same numerical operation that a physical instrument performs when its
observables are integrals over conserved state fields. There is no
distinction between computing and observing at the level of what the
machine does. The framework takes the identity seriously and builds
real instruments on it.

## 2. The load-bearing ideas

### 2.1 Bounded phase space
Every persistent physical system occupies a bounded region of phase
space with finite Liouville measure. Finiteness implies Poincaré
recurrence, which implies oscillatory dynamics, which implies discrete
mode structure. State counting is well-defined, and the count is finite.

### 2.2 Triple equivalence
A bounded system with $M$ degrees of freedom, each at refinement depth
$n$, admits three equivalent descriptions with identical total entropy:

| Description | Interpretation | Count |
|---|---|---|
| Oscillatory | Phases per cycle | $n^M$ |
| Categorical | Distinguishable states | $n^M$ |
| Partition | Hierarchical cells | $n^M$ |

All three collapse to $S = k_B M \ln n$. The three are not analogies.
They are mathematically identical functions of the same underlying
object; the "equivalence" is a statement about three ways to count the
same thing.

### 2.3 Partition coordinates
In a three-dimensional bounded space the partition coordinates are a
4-tuple $(n, \ell, m, s)$ — principal depth, angular complexity,
orientation, chirality — with shell capacity $C(n) = 2n^2$. These
carry the same structural role in this framework that quantum numbers
carry in standard quantum mechanics, but they are derived from the
axiom rather than postulated.

### 2.4 S-entropy coordinates
Thermodynamic state maps bijectively onto a dimensionless triple
$(S_k, S_t, S_e) \in [0, 1]^3$: kinetic, temporal, energy entropy
normalised onto the unit cube. This is the state a GPU texture stores
per voxel.

### 2.5 Composition inflation
Integer compositions of $n$ in $d$ dimensions count distinguishable
oscillatory trajectories: $T(n, d) = d\,(d+1)^{n-1}$. Angular
resolution is $\Delta\theta = 2\pi / T(n, d)$. Because $\Delta\theta$
is dimensionless, the Planck-time bound on temporal intervals does not
apply. In $d = 3$, caesium-133 reaches sub-Planck-angular resolution
after $n_P = 56$ cycles — $6.1$ nanoseconds of integration time.

### 2.6 The fundamental identity $\mathcal{O} \equiv \mathcal{C} \equiv \mathcal{P}$
Observation, computing, and processing are mathematically identical
operations — each is categorical address resolution in partition space.
The distinction between them is the mechanism of refinement, not the
result. Photon-mediated refinement (observation), equation-mediated
refinement (computing), and constraint-mediated refinement
(processing) all converge to the same address.

### 2.7 Framework closure and $G$
If every SI unit reduces to counts + $\pi$ + a reference period, then
$G$ cannot remain exterior to the framework. Three independent routes
to $G$ converge on a shared value with precision $(d+1)^{-n}$ at depth
$n$; at $n = 8$ all three routes match CODATA 2018 within its stated
uncertainty; at $n = 27$ they agree to double-precision machine
epsilon. This is the framework's test case: either $G$ is computable
this way or the framework fails at the place it claims to be
strongest.

## 3. What is in this repository

```
.
├── README.md              (this file)
├── Cargo.toml             workspace manifest for the Rust crates
├── Makefile               common entry points
├── LICENSE                MIT
├── docs/sources/          the theoretical corpus (.tex sources)
├── publication/           two standalone papers + Python + Rust + figures
│   ├── shader-based-astronomy/
│   └── universal-partition-depth-observatory/
└── web/                   browser-native Next.js app (the observatory site)
```

### 3.1 The papers
Two publishable, self-contained papers live under `publication/`:

- **[Shader-Based Astronomy](publication/shader-based-astronomy/shader-based-astronomy.tex)**
  — establishes that a GPU fragment shader pipeline computes
  astronomical observables (Rayleigh and Mie scattering, refractive
  delay, orbital mechanics, positioning) to the numerical precision of
  the underlying quadrature. 10/10 benchmarks pass, median relative
  error 6.9 × 10⁻⁵.

- **[Dimensionless Reduction of the Gravitational Constant](publication/universal-partition-depth-observatory/universal-partition-depth-observatory.tex)**
  — derives $G$ via three independent routes from bounded-phase-space
  partition structure, establishes the $(d+1)^{-n}$ precision scaling,
  proposes experimental tests, and derives cosmological corollaries
  (MOND's $a_0 \approx c H_0 / 2\pi$, dark-energy $w_{\text{eff}} = -0.75$,
  $\dot G/G$ of order $10^{-11}$ yr$^{-1}$). 43/43 benchmarks pass.

Each paper ships with:
- a CPU Python reference in `python/` for prototyping and validation,
- a Rust crate in `rust/` for the production implementation,
- JSON and CSV validation outputs in `output/`,
- publication-quality figure panels in `figures/`.

### 3.2 The Python references
These are the scientific ground truth. They are intentionally plain
and slow — every formula in the papers appears unadorned in the
source, as close to the prose as NumPy / mpmath allow. Both packages
expose a CLI that runs the paper's validation suite and writes JSON +
CSV outputs:

```bash
cd publication/shader-based-astronomy/python
PYTHONPATH=src python -m shader_astronomy.cli --output-dir ../output

cd publication/universal-partition-depth-observatory/python
PYTHONPATH=src python -m gthree.cli --output-dir ../output
```

Non-zero exit if any benchmark fails. These runs are the scientific
acceptance criterion for every subsequent implementation.

### 3.3 The Rust crates
GPU implementations live in `publication/*/rust/`. They share WGSL
shader source (currently `shader-based-astronomy/rust/src/shaders/`,
with the G observatory's crate to follow). The Rust path compiles both
to native (desktop / server) and, with the `wgpu` backend, to WebGPU
in the browser. One shader codebase, two delivery surfaces.

### 3.4 The web app
`web/` is a Next.js 13 + Tailwind + Framer Motion app configured for
full static export. There is no backend. The `out/` bundle after
`npm run build` is pure HTML + JavaScript + WGSL + binary assets,
hostable on any CDN. Every observable displayed on the site is
computed in the visitor's GPU from shaders the visitor's browser
fetched once.

Pages:
- `/` — landing, with a rotating Jupiter model
- `/instruments/` — instrument hub (atmosphere live; G routes, spectrometer, mass spec pending)
- `/instruments/atmosphere/` — the five-pass atmospheric pipeline in WebGPU
- `/documentation/` — paper cards linking to PDFs
- `/about/` — framework posture, attribution

## 4. How to run things

### 4.1 Python validation (fast, no install beyond `pip install numpy mpmath scipy`)

```bash
make validate
```

or directly:

```bash
cd publication/shader-based-astronomy/python
PYTHONPATH=src python -m shader_astronomy.cli
cd ../../universal-partition-depth-observatory/python
PYTHONPATH=src python -m gthree.cli
```

Expected outcome: **10/10 pass** and **43/43 pass** respectively, with
JSON + CSV written to each paper's `output/` directory.

### 4.2 Figure regeneration

```bash
make figures
```

Writes PNG panels into each paper's `figures/` directory. Each panel
is a 1 × 4 layout with at least one 3D chart; all data is generated
from the actual validation modules.

### 4.3 Rust crates

```bash
cargo build --release
cargo test --release
```

The workspace `Cargo.toml` at the root links to the crates under
`publication/`. Individual crates are buildable from their own
directories too.

### 4.4 Web app (development)

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

### 4.5 Web app (production static export)

```bash
cd web
npm run build        # writes web/out/ — deployable static bundle
```

No server component. Drop `web/out/` on any CDN (Cloudflare Pages,
Netlify, Vercel, S3 + CloudFront, GitHub Pages, anywhere that serves
static files).

## 5. Validation posture

Every numerical claim in either paper is reproduced by an automated
benchmark in the Python reference. The benchmarks write JSON and CSV
so that claims can be checked without re-running the code. Any
deviation — a route that drifts from CODATA, a benchmark that slips
outside tolerance, a shader whose output disagrees with the CPU
reference — is a regression and shows up as a failing test.

Snapshot at time of writing:

| Paper | Benchmarks | Pass rate | Max rel. error |
|---|---|---|---|
| Shader-Based Astronomy | 10 | 10 / 10 | 4.3 × 10⁻³ |
| Dimensionless $G$ | 43 | 43 / 43 | within bound $(d+1)^{-n}$ |

## 6. Status

### Working today
- Both papers are complete and buildable (`pdflatex` + `bibtex`).
- Both Python references run end-to-end and emit archival JSON + CSV.
- Both papers' figure panels regenerate from actual data.
- The web app builds as a static site (7 routes, 119 KB shared JS).
- The atmosphere instrument page initialises WebGPU, fetches the five
  WGSL shaders, compiles shader modules, surfaces precise errors.

### In progress
- The full per-frame dispatch loop for the atmosphere instrument
  (texture allocation, bind groups, encode/submit per pass).
- The pre-computed bootstrap textures (terrain partition, material
  S-entropy) the atmosphere instrument reads.
- A shader-sync pre-build step so `web/public/shaders/` always
  mirrors the canonical source in `publication/shader-based-astronomy/rust/src/shaders/`.
- The Rust crate for the G observatory (parallel to
  `publication/shader-based-astronomy/rust/`).

### Further out
- G-routes instrument (live three-route G computation in the browser)
- Spectrometer instrument (hardware-oscillator spectroscopy demo)
- Mass-spec instrument (force-free partition-depth minimisation demo)
- Python bindings for the Rust crates via PyO3, so lab software can
  call the framework without leaving Python

## 7. Attribution

Framework, software, and papers: Kundai Farai Sachikonye
(`kundai.sachikonye@bitspark.com`).

The theoretical corpus under `docs/sources/` is also authored by
Kundai; the published papers under `publication/` are deliberately
self-contained and do not cite the corpus, so each paper stands on
its own derivations.

The Jupiter GLB on the landing page is under its own licence (placed
by Kundai). The Next.js chassis under `web/` started from a
CodeBucks-licensed portfolio template; all portfolio content has
been replaced with observatory content.

## 8. Licence

MIT. See [LICENSE](LICENSE).
