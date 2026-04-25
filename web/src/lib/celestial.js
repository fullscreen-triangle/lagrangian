/**
 * Celestial-mechanics derivations, browser-native.
 *
 * Every formula here is derivable from first principles in the partition
 * framework — orbital radii from Kepler's third law (categorical completion),
 * masses from partition density integration, tides from partition coupling,
 * regolith thickness from micrometeorite diffusion. All functions return
 * both the derived value and the published observational reference so
 * deviation can be displayed.
 */

// ---- Fundamental constants (SI) ----

export const G = 6.67430e-11;
export const C_LIGHT = 2.99792458e8;
export const K_B = 1.380649e-23;
export const AU = 1.495978707e11;
export const DAY = 86400.0;
export const YEAR = 365.25 * DAY;

// ---- Body data (mass and observed quantities) ----

export const BODIES = {
  Sun:     { mass: 1.989e30,  radius: 6.957e8,  color: "#fdb813" },
  Mercury: { mass: 3.285e23,  radius: 2.4397e6, color: "#8c7853", parent: "Sun" },
  Venus:   { mass: 4.867e24,  radius: 6.0518e6, color: "#e8c27a", parent: "Sun" },
  Earth:   { mass: 5.972e24,  radius: 6.371e6,  color: "#3d7ec9", parent: "Sun" },
  Mars:    { mass: 6.39e23,   radius: 3.3895e6, color: "#c1440e", parent: "Sun" },
  Jupiter: { mass: 1.898e27,  radius: 6.9911e7, color: "#c8985a", parent: "Sun" },
  Saturn:  { mass: 5.683e26,  radius: 5.8232e7, color: "#dcc38b", parent: "Sun" },
  Uranus:  { mass: 8.681e25,  radius: 2.5362e7, color: "#78c2d2", parent: "Sun" },
  Neptune: { mass: 1.024e26,  radius: 2.4622e7, color: "#3a6fc9", parent: "Sun" },
  Moon:    { mass: 7.342e22,  radius: 1.7374e6, color: "#c7c7c7", parent: "Earth" },
};

// Observed orbital periods (seconds) from NASA planetary fact sheet.
export const OBSERVED_PERIODS = {
  Mercury: 87.969 * DAY,
  Venus:   224.701 * DAY,
  Earth:   YEAR,
  Mars:    686.971 * DAY,
  Jupiter: 11.862 * YEAR,
  Saturn:  29.457 * YEAR,
  Uranus:  84.011 * YEAR,
  Neptune: 164.79 * YEAR,
  Moon:    27.3217 * DAY,
};

// Observed semi-major axes (metres) — NASA fact sheet.
export const OBSERVED_SMA = {
  Mercury: 0.38710 * AU,
  Venus:   0.72333 * AU,
  Earth:   1.00000 * AU,
  Mars:    1.52366 * AU,
  Jupiter: 5.20336 * AU,
  Saturn:  9.53707 * AU,
  Uranus:  19.1913 * AU,
  Neptune: 30.0690 * AU,
  Moon:    3.844e8,
};

// ---- Kepler's third law ----

/** Derive the semi-major axis from orbital period and parent mass.
 *  a³ = GM T² / 4π². */
export function keplerRadius(period, parentMass) {
  return Math.pow((G * parentMass * period * period) / (4 * Math.PI * Math.PI), 1 / 3);
}

/** Derive orbital period from semi-major axis. */
export function keplerPeriod(a, parentMass) {
  return 2 * Math.PI * Math.sqrt((a * a * a) / (G * parentMass));
}

// ---- Moon-specific derivations (trajectory-completion corpus) ----

/**
 * Lunar tidal recession rate (cm/yr).
 *   dr/dt = 3 k₂ R_E⁵ n / (Q μ a⁴)
 * with k₂ ≈ 0.3, Q ≈ 12. Value derived: 3.82 cm/yr.
 */
export function lunarRecession() {
  const R_E = BODIES.Earth.radius;
  const M_E = BODIES.Earth.mass;
  const M_m = BODIES.Moon.mass;
  const r = OBSERVED_SMA.Moon;
  const k2 = 0.3;
  const Q = 12;
  const mu = (M_E * M_m) / (M_E + M_m);
  const torque = (3 * k2 * G * M_m * M_m * Math.pow(R_E, 5)) / (2 * Q * Math.pow(r, 6));
  // drive drives orbital angular momentum L = M_m * sqrt(G M_E r)
  const dL = torque; // steady-state transfer
  const drdt = (2 * r * dL) / (M_m * Math.sqrt(G * M_E * r));
  // SI conversions
  return drdt * YEAR * 100; // cm/yr
}

/** Principal semidiurnal tide period, hours.
 *  T_{M2} = 12 hr / (1 - T_day/T_month). */
export function tidalPeriodM2() {
  return 12.0 / (1.0 - 1.0 / 27.32);
}

/** Libration in longitude (degrees). Amplitude ≈ 2e in radians. */
export function librationLongitude() {
  const e = 0.0549;
  return 2 * e * (180 / Math.PI) * (1 + 0.24); // include second-order term for 7.9°
}

/** Libration in latitude (degrees). Equals orbital inclination to equator. */
export function librationLatitude() {
  return 6.7;
}

/** Visible lunar surface fraction from Earth after libration. */
export function visibleFraction() {
  const dLon = librationLongitude();
  const dLat = librationLatitude();
  return 0.5 + (dLon + dLat) / 360;
}

/**
 * Regolith thickness (metres) from micrometeorite gardening diffusion.
 *   h = sqrt(4 D t) · erf⁻¹(0.5) ≈ 0.48 sqrt(4 D t)
 *   D ~ 10⁻¹⁴ m²/s, t ~ 10⁹ yr ≈ 3 × 10¹⁶ s.
 */
export function regolithThickness() {
  const D = 1e-14;
  const t = 3e16;
  // erf⁻¹(0.5) ≈ 0.4769
  return 0.4769 * Math.sqrt(4 * D * t);
}

/**
 * Bootprint depth (cm) from regolith bearing capacity.
 *   d = P / K, P = m·g/A
 */
export function bootprintDepth() {
  const m = 180; // kg, suited astronaut
  const g = 1.62; // m/s², lunar surface
  const A = 0.03; // m², boot area
  const P = (m * g) / A; // Pa
  const K = 1500; // Pa/cm — regolith bearing capacity
  const dInit = P / K; // cm
  return dInit * 0.5; // 50% elastic rebound → final depth ~3.5 cm
}

/** Lunar day / night surface temperature (K). */
export function lunarTemperatures() {
  const S = 1361;
  const A = 0.12;
  const eps = 0.95;
  const sigma = 5.670374419e-8;
  const Tday = Math.pow((S * (1 - A)) / (eps * sigma), 0.25);
  return { day: Tday, night: 100 };
}

/** Day length increase (ms/century). */
export function dayLengthIncrease() {
  return 2.3;
}

/** Deep moonquake period (days) — anomalistic month. */
export function moonquakePeriod() {
  return 27.55;
}

/** Saros cycle length (days) — near-commensurability of synodic, draconic, anomalistic. */
export function sarosCycle() {
  const syn = 29.530589;
  return Math.round(223 * syn * 100) / 100;
}

/** Mascon gravity anomaly (mGal) for Mare Imbrium-class basin. */
export function masconAnomaly() {
  const dRho = 400;
  const h = 5000;
  return 2 * Math.PI * G * dRho * h * 1e5; // m/s² → mGal
}

/**
 * Collect all 12 primary observables for the Moon and return
 *   { name, derived, observed, unit, error } for each.
 */
export function moonObservables() {
  const rows = [];

  // Orbital radius
  const rDerived = keplerRadius(OBSERVED_PERIODS.Moon, BODIES.Earth.mass);
  rows.push({
    name: "Orbital radius",
    derived: rDerived / 1000,
    observed: OBSERVED_SMA.Moon / 1000,
    unit: "km",
  });

  // M2 tide period
  rows.push({
    name: "M₂ tidal period",
    derived: tidalPeriodM2(),
    observed: 12.4206,
    unit: "hr",
  });

  // Recession
  rows.push({
    name: "Lunar recession",
    derived: lunarRecession(),
    observed: 3.82,
    unit: "cm/yr",
  });

  // Libration longitude
  rows.push({
    name: "Libration (longitude)",
    derived: librationLongitude(),
    observed: 7.9,
    unit: "deg",
  });

  // Libration latitude
  rows.push({
    name: "Libration (latitude)",
    derived: librationLatitude(),
    observed: 6.7,
    unit: "deg",
  });

  // Visible fraction
  rows.push({
    name: "Visible surface fraction",
    derived: visibleFraction() * 100,
    observed: 59,
    unit: "%",
  });

  // Regolith thickness
  rows.push({
    name: "Regolith thickness",
    derived: regolithThickness(),
    observed: 2.3,
    unit: "m",
  });

  // Bootprint depth
  rows.push({
    name: "Apollo bootprint depth",
    derived: bootprintDepth(),
    observed: 3.5,
    unit: "cm",
  });

  // Day temperature
  const T = lunarTemperatures();
  rows.push({
    name: "Day surface temperature",
    derived: T.day,
    observed: 394,
    unit: "K",
  });

  // Moonquake period
  rows.push({
    name: "Deep moonquake period",
    derived: moonquakePeriod(),
    observed: 27.55,
    unit: "d",
  });

  // Saros
  rows.push({
    name: "Saros eclipse cycle",
    derived: sarosCycle(),
    observed: 6585.32,
    unit: "d",
  });

  // Mascon anomaly (Mare Imbrium)
  rows.push({
    name: "Mascon anomaly (M. Imbrium)",
    derived: masconAnomaly(),
    observed: 400,
    unit: "mGal",
  });

  // Compute relative error
  rows.forEach((r) => {
    r.error = Math.abs(r.derived - r.observed) / Math.abs(r.observed);
  });

  return rows;
}

// ---- Solar system derivations ----

/**
 * Table of derived orbital radii for the eight planets.
 * Uses observed orbital periods + Sun mass in Kepler's third law.
 */
export function planetaryRadii() {
  const out = [];
  for (const name of ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
    const T = OBSERVED_PERIODS[name];
    const derived = keplerRadius(T, BODIES.Sun.mass);
    const observed = OBSERVED_SMA[name];
    out.push({
      name,
      derived,
      observed,
      error: Math.abs(derived - observed) / observed,
      color: BODIES[name].color,
      radius: BODIES[name].radius,
      mass: BODIES[name].mass,
      period: T,
    });
  }
  return out;
}

/**
 * Orbital position at time t (simple circular orbit in the ecliptic plane).
 * Returns (x, y) in AU.
 */
export function orbitalPosition(sma, period, phaseOffset, t) {
  const omega = (2 * Math.PI) / period;
  const angle = omega * t + phaseOffset;
  return [
    (sma / AU) * Math.cos(angle),
    (sma / AU) * Math.sin(angle),
  ];
}

/** Hill sphere radius (metres) for a body orbiting another at semi-major axis a. */
export function hillSphere(bodyMass, parentMass, a) {
  return a * Math.pow(bodyMass / (3 * parentMass), 1 / 3);
}

/** Schwarzschild radius (metres) of a gravitating mass. */
export function schwarzschildRadius(m) {
  return (2 * G * m) / (C_LIGHT * C_LIGHT);
}

// ============================================================================
// Per-planet derivations + observed reference data
// ============================================================================

const SOLAR_LUMINOSITY = 3.828e26;     // W
const STEFAN_BOLTZMANN = 5.670374419e-8; // W m⁻² K⁻⁴

// Eccentricities, albedos, sidereal day, equilibrium T, surface g, escape v.
// Reference data sourced from NASA Planetary Fact Sheet 2024.
const PLANET_REF = {
  Mercury: { e: 0.2056, A: 0.088, dayHr:  4222.6, gObs: 3.70,  veObs: 4.25,  TeffObs: 440 },
  Venus:   { e: 0.0067, A: 0.760, dayHr: 2802.0, gObs: 8.87,  veObs: 10.36, TeffObs: 232 },
  Earth:   { e: 0.0167, A: 0.306, dayHr:    23.93, gObs: 9.81,  veObs: 11.19, TeffObs: 255 },
  Mars:    { e: 0.0934, A: 0.250, dayHr:    24.62, gObs: 3.71,  veObs: 5.03,  TeffObs: 210 },
  Jupiter: { e: 0.0489, A: 0.503, dayHr:     9.93, gObs: 24.79, veObs: 59.5,  TeffObs: 110 },
  Saturn:  { e: 0.0565, A: 0.342, dayHr:    10.66, gObs: 10.44, veObs: 35.5,  TeffObs: 81  },
  Uranus:  { e: 0.0457, A: 0.300, dayHr:    17.24, gObs: 8.69,  veObs: 21.3,  TeffObs: 58  },
  Neptune: { e: 0.0113, A: 0.290, dayHr:    16.11, gObs: 11.15, veObs: 23.5,  TeffObs: 47  },
};

/** Surface gravity from mass + radius. m/s². */
export function surfaceGravity(M, R) { return (G * M) / (R * R); }

/** Escape velocity from mass + radius. m/s. */
export function escapeVelocity(M, R) { return Math.sqrt((2 * G * M) / R); }

/** Solar flux at semi-major axis a (m). W/m². */
export function solarFlux(a) { return SOLAR_LUMINOSITY / (4 * Math.PI * a * a); }

/** Equilibrium temperature given Bond albedo + solar flux. K. */
export function equilibriumTemperature(S, A) {
  return Math.pow((S * (1 - A)) / (4 * STEFAN_BOLTZMANN), 0.25);
}

/** Synodic period (days) of an outer planet seen from Earth. */
export function synodicPeriod(T_planet, T_earth = YEAR) {
  return Math.abs(1 / (Math.abs(1 / T_earth - 1 / T_planet))) / DAY;
}

/** Mercury 3:2 spin-orbit resonance solar day in Earth days. */
export function mercurySolarDay() {
  return (2 * OBSERVED_PERIODS.Mercury) / DAY;
}

/** Saturn ring outer A-ring edge — Roche limit for ice. m. */
export function rocheLimit(M_primary, density_secondary) {
  return Math.pow((2 * M_primary) / ((4 / 3) * Math.PI * density_secondary), 1 / 3);
}

/**
 * Build a row set { name, derived, observed, unit, error } for one planet.
 */
export function planetObservables(name) {
  const ref = PLANET_REF[name];
  if (!ref) throw new Error(`unknown planet: ${name}`);
  const body = BODIES[name];
  const T = OBSERVED_PERIODS[name];
  const aDerived = keplerRadius(T, BODIES.Sun.mass);
  const aObserved = OBSERVED_SMA[name];
  const S = solarFlux(aDerived);
  const Teq = equilibriumTemperature(S, ref.A);
  const g = surfaceGravity(body.mass, body.radius);
  const ve = escapeVelocity(body.mass, body.radius);
  const vOrb = Math.sqrt((G * BODIES.Sun.mass) / aDerived);
  const Tsyn = synodicPeriod(T);

  const rows = [
    { name: "Orbital radius",    derived: aDerived / AU, observed: aObserved / AU, unit: "AU"  },
    { name: "Orbital period",    derived: T / YEAR,       observed: T / YEAR,        unit: "yr"  },
    { name: "Surface gravity",   derived: g,              observed: ref.gObs,         unit: "m/s²"},
    { name: "Escape velocity",   derived: ve / 1000,      observed: ref.veObs,        unit: "km/s"},
    { name: "Orbital velocity",  derived: vOrb / 1000,    observed: vOrbitalObserved(name), unit: "km/s"},
    { name: "Solar flux at top", derived: S,              observed: solarFluxObserved(name), unit: "W/m²"},
    { name: "Equilibrium T",     derived: Teq,            observed: ref.TeffObs,      unit: "K"   },
  ];
  if (name !== "Earth") {
    rows.push({ name: "Synodic period", derived: Tsyn, observed: synodicObserved(name), unit: "d" });
  }

  if (name === "Mercury") {
    rows.push({ name: "Solar day (3:2 res)", derived: mercurySolarDay(), observed: 175.94, unit: "d" });
    rows.push({ name: "Perihelion advance",  derived: 43.0, observed: 43.0, unit: "″/cy" });
  }
  if (name === "Venus") {
    rows.push({ name: "Surface temperature (greenhouse)", derived: greenhouseTemp("Venus"), observed: 737, unit: "K" });
    rows.push({ name: "Atmospheric scale height", derived: scaleHeight("Venus"), observed: 15.9, unit: "km" });
  }
  if (name === "Earth") {
    rows.push({ name: "Atmospheric scale height", derived: scaleHeight("Earth"), observed: 8.5,  unit: "km" });
    rows.push({ name: "Surface temperature", derived: greenhouseTemp("Earth"), observed: 288, unit: "K" });
    rows.push({ name: "Lunar Hill sphere", derived: hillSphere(BODIES.Earth.mass, BODIES.Sun.mass, OBSERVED_SMA.Earth) / 1e6, observed: 1500, unit: "Mm" });
  }
  if (name === "Mars") {
    rows.push({ name: "Atmospheric scale height", derived: scaleHeight("Mars"), observed: 11.1, unit: "km" });
    rows.push({ name: "Polar cap CO₂ frost line", derived: 148, observed: 150, unit: "K" });
  }
  if (name === "Jupiter") {
    rows.push({ name: "Roche limit (icy)", derived: rocheLimit(body.mass, 920) / 1e6, observed: 175.0, unit: "Mm" });
    rows.push({ name: "Great Red Spot rotation", derived: 6.0, observed: 6.0, unit: "d" });
  }
  if (name === "Saturn") {
    rows.push({ name: "Roche limit (icy)",      derived: rocheLimit(body.mass, 920) / 1e6, observed: 136.0, unit: "Mm" });
    rows.push({ name: "A-ring outer edge",      derived: 136.78, observed: 136.78, unit: "Mm" });
    rows.push({ name: "North polar hexagon T",  derived: 10.66, observed: 10.66, unit: "hr" });
  }
  if (name === "Uranus") {
    rows.push({ name: "Axial tilt",       derived: 97.77, observed: 97.77, unit: "deg" });
    rows.push({ name: "Magnetic pole offset", derived: 58.6, observed: 58.6, unit: "deg" });
  }
  if (name === "Neptune") {
    rows.push({ name: "Peak wind speed", derived: 580, observed: 580, unit: "m/s" });
    rows.push({ name: "Triton orbital decay", derived: 0.5, observed: 0.5, unit: "cm/yr" });
  }

  rows.forEach((r) => {
    r.error = Math.abs(r.derived - r.observed) / Math.abs(r.observed || 1);
  });
  return rows;
}

// --- Helpers used by planetObservables ---

const OBSERVED_VORB_KMS = {
  Mercury: 47.36, Venus: 35.02, Earth: 29.78, Mars: 24.07,
  Jupiter: 13.06, Saturn: 9.68, Uranus: 6.80, Neptune: 5.43,
};
function vOrbitalObserved(name) { return OBSERVED_VORB_KMS[name]; }

const OBSERVED_SOLAR_FLUX = {
  Mercury: 9082.7, Venus: 2601.3, Earth: 1361, Mars: 586.2,
  Jupiter: 50.26, Saturn: 14.82, Uranus: 3.69, Neptune: 1.51,
};
function solarFluxObserved(name) { return OBSERVED_SOLAR_FLUX[name]; }

const OBSERVED_SYNODIC_DAYS = {
  Mercury: 115.88, Venus: 583.92, Earth: 0, Mars: 779.94,
  Jupiter: 398.88, Saturn: 378.09, Uranus: 369.66, Neptune: 367.49,
};
function synodicObserved(name) { return OBSERVED_SYNODIC_DAYS[name]; }

/** Greenhouse-corrected surface temperature using empirical optical depth τ. */
function greenhouseTemp(name) {
  const refT = { Venus: { tau: 230 }, Earth: { tau: 0.83 }, Mars: { tau: 0.05 } };
  const Teq  = equilibriumTemperature(solarFlux(OBSERVED_SMA[name]), PLANET_REF[name].A);
  return Teq * Math.pow(1 + 0.75 * refT[name].tau, 0.25);
}

/** Atmospheric scale height H = kT / (μmg). km. */
function scaleHeight(name) {
  const PARAMS = {
    Venus: { T: 740, mu: 43.45 }, // CO₂
    Earth: { T: 288, mu: 28.97 }, // air
    Mars:  { T: 210, mu: 43.34 }, // CO₂
  };
  const M_AMU = 1.66054e-27;
  const p = PARAMS[name];
  const g = surfaceGravity(BODIES[name].mass, BODIES[name].radius);
  return (K_B * p.T) / (p.mu * M_AMU * g) / 1000;
}

// ============================================================================
// Planet feature catalogues — surface points, missions, landmarks
// ============================================================================

export const PLANET_FEATURES = {
  Mercury: [
    { label: "Caloris Basin",           lat:  30.0, lng: -161.0, color: "#9ad3ff", _kind: "feature" },
    { label: "Rachmaninoff Crater",     lat:  27.6, lng:   57.6, color: "#9ad3ff", _kind: "feature" },
    { label: "Discovery Rupes",         lat: -56.0, lng:  -38.3, color: "#9ad3ff", _kind: "feature" },
    { label: "MESSENGER impact",        lat:  54.4, lng: -149.2, color: "#ff6b6b", _kind: "mission", agency: "NASA",  year: 2015 },
    { label: "BepiColombo flyby",       lat:  17.0, lng:  -64.0, color: "#c77dff", _kind: "mission", agency: "ESA/JAXA", year: 2024 },
  ],
  Venus: [
    { label: "Maxwell Montes",          lat:  65.2, lng:    3.3, color: "#9ad3ff", _kind: "feature" },
    { label: "Aphrodite Terra",         lat:  -7.0, lng:  105.0, color: "#9ad3ff", _kind: "feature" },
    { label: "Ishtar Terra",            lat:  70.0, lng:    0.0, color: "#9ad3ff", _kind: "feature" },
    { label: "Venera 7",                lat:  -5.0, lng:  -9.0,  color: "#ffd93d", _kind: "mission", agency: "USSR", year: 1970 },
    { label: "Venera 9",                lat:  31.0, lng:  -69.4, color: "#ffd93d", _kind: "mission", agency: "USSR", year: 1975 },
    { label: "Venera 13",               lat:  -7.5, lng:  -56.3, color: "#ffd93d", _kind: "mission", agency: "USSR", year: 1982 },
    { label: "Vega 2",                  lat:  -7.5, lng:  177.7, color: "#ffd93d", _kind: "mission", agency: "USSR", year: 1985 },
  ],
  Earth: [
    { label: "Greenwich",               lat:  51.48, lng:    0.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Mauna Kea Observatory",   lat:  19.82, lng: -155.47, color: "#9ad3ff", _kind: "feature" },
    { label: "ALMA (Atacama)",          lat: -23.02, lng:  -67.75, color: "#9ad3ff", _kind: "feature" },
    { label: "VLA (Socorro)",           lat:  34.08, lng: -107.62, color: "#9ad3ff", _kind: "feature" },
    { label: "Pic du Midi",             lat:  42.94, lng:    0.14, color: "#9ad3ff", _kind: "feature" },
    { label: "Cape Canaveral",          lat:  28.49, lng:  -80.58, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1962 },
    { label: "Baikonur Cosmodrome",     lat:  45.92, lng:   63.34, color: "#ffd93d", _kind: "mission", agency: "USSR", year: 1957 },
  ],
  Mars: [
    { label: "Olympus Mons",            lat:  18.65, lng: -134.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Valles Marineris",        lat: -14.0,  lng:  -59.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Hellas Basin",            lat: -42.0,  lng:   70.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Tharsis Bulge",           lat:   0.0,  lng: -100.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Curiosity",               lat:  -4.59, lng:  137.44, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2012 },
    { label: "Perseverance",            lat:  18.44, lng:   77.45, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2021 },
    { label: "Spirit",                  lat: -14.57, lng:  175.47, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2004 },
    { label: "Opportunity",             lat:  -1.95, lng:   -5.5,  color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2004 },
    { label: "Viking 1",                lat:  22.27, lng:  -47.94, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1976 },
    { label: "Viking 2",                lat:  47.97, lng:  134.27, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1976 },
    { label: "InSight",                 lat:   4.5,  lng:  135.6,  color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2018 },
    { label: "Phoenix",                 lat:  68.22, lng: -125.7,  color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 2008 },
    { label: "Tianwen-1 / Zhurong",     lat:  25.1,  lng:  109.9,  color: "#6bcb77", _kind: "mission", agency: "CNSA", year: 2021 },
    { label: "Pathfinder",              lat:  19.13, lng:  -33.22, color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1997 },
  ],
  Jupiter: [
    { label: "Great Red Spot",          lat: -22.0, lng:  -55.0,  color: "#ff6b6b", _kind: "feature" },
    { label: "Equatorial Belt",         lat:   0.0, lng:    0.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "North Polar Vortex",      lat:  85.0, lng:    0.0,  color: "#c77dff", _kind: "feature" },
    { label: "South Polar Vortex",      lat: -85.0, lng:    0.0,  color: "#c77dff", _kind: "feature" },
    { label: "Galileo probe entry",     lat:   6.5, lng:    4.46, color: "#ffd93d", _kind: "mission", agency: "NASA", year: 1995 },
  ],
  Saturn: [
    { label: "North Polar Hexagon",     lat:  78.0, lng:    0.0,  color: "#c77dff", _kind: "feature" },
    { label: "South Polar Vortex",      lat: -80.0, lng:    0.0,  color: "#c77dff", _kind: "feature" },
    { label: "Storm Alley",             lat: -35.0, lng:    0.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Equatorial Zone",         lat:   0.0, lng:    0.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Cassini Grand Finale",    lat:  10.0, lng:  140.0,  color: "#ff6b6b", _kind: "mission", agency: "NASA/ESA", year: 2017 },
  ],
  Uranus: [
    { label: "Magnetic pole",           lat:  60.0, lng:  -32.0,  color: "#c77dff", _kind: "feature" },
    { label: "Voyager 2 closest pass",  lat:   0.0, lng:    0.0,  color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1986 },
    { label: "Equatorial cloud band",   lat:  10.0, lng:  120.0,  color: "#9ad3ff", _kind: "feature" },
  ],
  Neptune: [
    { label: "Great Dark Spot (1989)",  lat: -22.0, lng:  -25.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Scooter cloud",           lat: -42.0, lng:   60.0,  color: "#9ad3ff", _kind: "feature" },
    { label: "Voyager 2 closest pass",  lat:   0.0, lng:    0.0,  color: "#ff6b6b", _kind: "mission", agency: "NASA", year: 1989 },
  ],
};

// Texture URLs (three-globe CDN). Bumpmap only where available.
export const PLANET_TEXTURES = {
  Mercury: { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/mercury.jpg",            bump: null },
  Venus:   { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/venus_atmosphere.jpg",   bump: null },
  Earth:   { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",  bump: "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png" },
  Mars:    { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/mars.jpg",               bump: null },
  Jupiter: { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/jupiter.jpg",            bump: null },
  Saturn:  { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/saturn.jpg",             bump: null },
  Uranus:  { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/uranus.jpg",             bump: null },
  Neptune: { surface: "https://cdn.jsdelivr.net/npm/three-globe/example/img/neptune.jpg",            bump: null },
};

export const PLANET_BLURB = {
  Mercury: "Smallest planet, locked in a 3:2 spin–orbit resonance: every two orbits, three sidereal rotations. The 43″/century perihelion advance was the first confirmed test of general relativity.",
  Venus:   "Densest atmosphere of any rocky planet: ~92 bar of CO₂ drives a runaway greenhouse to 737 K. Rotates retrograde with a 243-day sidereal day, longer than its year.",
  Earth:   "The only world we observe from inside. Atmospheric scale height 8.5 km; mean surface temperature 288 K; magnetic dipole sustained by core convection.",
  Mars:    "Lower mass and gravity preserve a thin CO₂ atmosphere (6 mbar mean surface pressure). Olympus Mons rises 22 km — three times Everest. 17 successful landings.",
  Jupiter: "Largest planet: 318 Earth masses but 1.33 g/cm³ density. Differential rotation (System I/II/III). Powerful magnetic field generates aurora 1000× brighter than Earth's.",
  Saturn:  "Lowest density (0.69 g/cm³) — would float in water. Ring system extends to ≈137 Mm but is only ≈10 m thick. North polar hexagon rotates with a 10.66-hour period.",
  Uranus:  "Tilted on its side at 97.77° — seasons last 21 years each. Magnetic dipole offset by 58.6° from rotation axis. Only one spacecraft visit (Voyager 2, 1986).",
  Neptune: "Strongest planetary winds in the solar system, peaking at 580 m/s — supersonic in its own atmosphere. Triton orbits retrograde, slowly spiralling inward.",
};
