/**
 * Light Membrane — browser-native implementation of the emergent light
 * field S_t(α, δ, ω): a temporal-spectrum scalar field on the celestial
 * sphere, recovered by subtracting a known sky reference from a measured
 * brightness time-series, then taking the temporal Fourier transform.
 *
 * Every astronomical observation reduces to a linear projection of this
 * field. The Sky Survey's star-map is one such projection (the DC slice
 * at ω ≈ 0); the loop-coupling multi-source reconstruction is another.
 */

// ---- Cooley-Tukey FFT (in-place, complex) ----

/** FFT of a real signal of power-of-two length. Returns {re, im}. */
export function fftReal(signal) {
  const N = signal.length;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = signal[i];
  _fftInPlace(re, im);
  return { re, im };
}

function _fftInPlace(re, im) {
  const N = re.length;
  // Bit-reverse permutation
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let k = N >> 1;
    while (k <= j) { j -= k; k >>= 1; }
    j += k;
  }
  // Butterflies
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const tableStep = -2 * Math.PI / size;
    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = tableStep * k;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const a = i + k;
        const b = i + k + half;
        const tre = re[b] * cos - im[b] * sin;
        const tim = re[b] * sin + im[b] * cos;
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
      }
    }
  }
}

/** Squared magnitude of an FFT result (length N/2 + 1). */
export function powerSpectrum(fftRes) {
  const N = fftRes.re.length;
  const out = new Float32Array((N >> 1) + 1);
  for (let k = 0; k <= (N >> 1); k++) {
    out[k] = fftRes.re[k] * fftRes.re[k] + fftRes.im[k] * fftRes.im[k];
  }
  return out;
}

// ---- Sky reference model ----

/**
 * Modelled day/night sky brightness at an altitude, azimuth, and a
 * normalised "sun altitude" (−1 = midnight, 0 = horizon, +1 = noon).
 * Returns photon-units brightness; the caller chooses the scale.
 */
export function skyReferenceModel(altRad, azRad, sunAlt) {
  const airglow = 0.01;
  // Scattered sunlight component: scales with max(sunAlt, 0) and sin(alt)
  const solarComponent = Math.max(0, sunAlt) * Math.pow(Math.sin(altRad), 0.7);
  const scatter = solarComponent * (3.0 + Math.cos(azRad) * 0.3);
  // Atmospheric extinction toward horizon
  const ext = 0.01 / (Math.sin(altRad) + 0.05);
  return airglow + scatter + ext;
}

// ---- Source catalogue: synthesise a brightness time-series per source ----

export const SOURCE_KINDS = {
  star: { color: "#ffffff", desc: "catalogued star — near-DC spectrum" },
  planet: { color: "#f1dca7", desc: "planet — slow drift plus diurnal term" },
  pulsar: { color: "#ff4466", desc: "pulsar — narrow peak at pulse frequency" },
  satellite: { color: "#55aaff", desc: "satellite — sparse transit spikes" },
  exoplanet: { color: "#66ff99", desc: "exoplanet transit — periodic dip" },
};

/**
 * Generate a brightness time-series for a given source class at the
 * given (α, δ, t-grid). The generator is deterministic: same inputs
 * always produce the same output.
 */
export function sourceTimeSeries(src, tGrid) {
  const N = tGrid.length;
  const out = new Float32Array(N);
  if (src.kind === "star") {
    for (let i = 0; i < N; i++) {
      out[i] = src.flux * (1 + 0.01 * Math.sin(0.5 * tGrid[i]));
    }
  } else if (src.kind === "planet") {
    for (let i = 0; i < N; i++) {
      out[i] = src.flux * (0.9 + 0.1 * Math.cos(2 * Math.PI * tGrid[i] / src.period));
    }
  } else if (src.kind === "pulsar") {
    // Narrow periodic spike at frequency 1/period
    const f = 1 / src.period;
    for (let i = 0; i < N; i++) {
      const phase = 2 * Math.PI * f * tGrid[i];
      const spike = Math.exp(10 * (Math.cos(phase) - 1));
      out[i] = src.flux * (0.1 + 0.9 * spike);
    }
  } else if (src.kind === "satellite") {
    // Delta-function transits at discrete times
    const transits = src.transits || [];
    for (let i = 0; i < N; i++) {
      let v = 0;
      for (const ti of transits) {
        const dt = Math.abs(tGrid[i] - ti);
        if (dt < 0.05) {
          const r = dt / 0.01;
          v += src.flux * Math.exp(-(r * r));
        }
      }
      out[i] = v;
    }
  } else if (src.kind === "exoplanet") {
    // Box-shaped periodic dip
    for (let i = 0; i < N; i++) {
      const phase = (tGrid[i] / src.period) % 1;
      out[i] = src.flux * (phase < src.duration / src.period ? 0.985 : 1.0);
    }
  }
  return out;
}

// ---- Build the light membrane over a sky grid ----

export function makeTimeGrid(duration, N) {
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = (i / N) * duration;
  return out;
}

/**
 * Compute one pixel's residual spectrum: (observed − model) then FFT.
 */
export function pixelSpectrum(observed, modelSignal) {
  const N = observed.length;
  const residual = new Float32Array(N);
  for (let i = 0; i < N; i++) residual[i] = observed[i] - modelSignal[i];
  // Apply a Hann window to reduce spectral leakage
  for (let i = 0; i < N; i++) {
    residual[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  const fft = fftReal(residual);
  return powerSpectrum(fft);
}

/**
 * Classify a pixel by matching its spectrum to known source fingerprints.
 * Returns the best-matching source kind and a correlation score.
 */
export function classifyPixel(spectrum) {
  // Fingerprint templates (normalised power spectra, N/2+1 long)
  const N = spectrum.length;
  const fingerprints = {
    star:     fingerprintStar(N),
    planet:   fingerprintPlanet(N),
    pulsar:   fingerprintPulsar(N),
    satellite:fingerprintSatellite(N),
    exoplanet:fingerprintExoplanet(N),
  };
  const total = spectrum.reduce((s, v) => s + v, 0) || 1;
  const normalised = spectrum.map((v) => v / total);
  let best = null;
  let bestScore = -Infinity;
  for (const [kind, fp] of Object.entries(fingerprints)) {
    let score = 0;
    for (let k = 0; k < N; k++) score += normalised[k] * fp[k];
    if (score > bestScore) { bestScore = score; best = kind; }
  }
  return { kind: best, score: bestScore, totalPower: total };
}

function fingerprintStar(N) {
  const fp = new Float32Array(N);
  fp[0] = 1.0; fp[1] = 0.3; fp[2] = 0.1;
  return normalise(fp);
}
function fingerprintPlanet(N) {
  const fp = new Float32Array(N);
  fp[0] = 1.0; fp[1] = 0.5; fp[2] = 0.3; fp[3] = 0.2;
  return normalise(fp);
}
function fingerprintPulsar(N) {
  const fp = new Float32Array(N);
  // Concentrated peak at mid-frequency
  const peak = Math.floor(N / 6);
  for (let k = 0; k < N; k++) {
    const d = k - peak;
    fp[k] = Math.exp(-(d * d) / (2 * 4));
  }
  return normalise(fp);
}
function fingerprintSatellite(N) {
  // Broadband — delta-function impulses have flat spectra
  const fp = new Float32Array(N);
  for (let k = 0; k < N; k++) fp[k] = 1.0;
  return normalise(fp);
}
function fingerprintExoplanet(N) {
  // Harmonic series at the transit frequency
  const fp = new Float32Array(N);
  const f0 = Math.floor(N / 12);
  for (let h = 1; h < 6; h++) {
    const k = h * f0;
    if (k < N) fp[k] = 1.0 / h;
  }
  return normalise(fp);
}

function normalise(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  s = s || 1;
  for (let i = 0; i < arr.length; i++) arr[i] /= s;
  return arr;
}
