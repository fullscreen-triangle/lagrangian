/**
 * Celestial-sky content: named bright stars, planets, Moon, satellites,
 * and coordinate conversion from (RA, Dec, observer latitude, local
 * sidereal time) to (altitude, azimuth) and on to a unit-sphere position
 * in the local-horizon frame (up = +Y, north = +Z, east = +X).
 */

// ---- Unit helpers ----

const DEG = Math.PI / 180;
const HOUR_ANGLE_PER_SECOND = (2 * Math.PI) / 86164.0905; // sidereal day

function hms(h, m, s) { return (h + m / 60 + s / 3600) * 15 * DEG; }
function dms(d, m, s) { return Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600) * DEG; }

// ---- Catalogue of ten bright named stars ----
// RA in radians (J2000), Dec in radians, visual magnitude, spectral tint.
export const BRIGHT_STARS = [
  { name: "Sirius",    ra: hms(6, 45, 9),   dec: dms(-16, 42, 58), mag: -1.46, tint: "#a3c9ff", dist_ly: 8.6 },
  { name: "Canopus",   ra: hms(6, 23, 57),  dec: dms(-52, 41, 44), mag: -0.74, tint: "#fffbd0", dist_ly: 310 },
  { name: "Arcturus",  ra: hms(14, 15, 40), dec: dms(19, 10, 56),  mag: -0.05, tint: "#ffd58a", dist_ly: 36.7 },
  { name: "Vega",      ra: hms(18, 36, 56), dec: dms(38, 47, 1),   mag:  0.03, tint: "#cfe2ff", dist_ly: 25.0 },
  { name: "Capella",   ra: hms(5, 16, 41),  dec: dms(45, 59, 53),  mag:  0.08, tint: "#fff1b5", dist_ly: 42.9 },
  { name: "Rigel",     ra: hms(5, 14, 32),  dec: dms(-8, 12, 6),   mag:  0.13, tint: "#c0ddff", dist_ly: 860 },
  { name: "Procyon",   ra: hms(7, 39, 18),  dec: dms(5, 13, 30),   mag:  0.34, tint: "#fffeec", dist_ly: 11.5 },
  { name: "Betelgeuse",ra: hms(5, 55, 10),  dec: dms(7, 24, 25),   mag:  0.50, tint: "#ff9a6b", dist_ly: 548 },
  { name: "Altair",    ra: hms(19, 50, 47), dec: dms(8, 52, 6),    mag:  0.77, tint: "#f4faff", dist_ly: 16.7 },
  { name: "Aldebaran", ra: hms(4, 35, 55),  dec: dms(16, 30, 33),  mag:  0.85, tint: "#ffb07a", dist_ly: 65.3 },
  { name: "Antares",   ra: hms(16, 29, 24), dec: dms(-26, 25, 55), mag:  1.06, tint: "#ff8060", dist_ly: 550 },
  { name: "Spica",     ra: hms(13, 25, 12), dec: dms(-11, 9, 41),  mag:  1.04, tint: "#b5d4ff", dist_ly: 250 },
  { name: "Pollux",    ra: hms(7, 45, 19),  dec: dms(28, 1, 34),   mag:  1.14, tint: "#ffd8a3", dist_ly: 33.8 },
  { name: "Fomalhaut", ra: hms(22, 57, 39), dec: dms(-29, 37, 20), mag:  1.16, tint: "#eef5ff", dist_ly: 25.1 },
  { name: "Deneb",     ra: hms(20, 41, 26), dec: dms(45, 16, 49),  mag:  1.25, tint: "#ffffff", dist_ly: 2600 },
  { name: "Polaris",   ra: hms(2, 31, 49),  dec: dms(89, 15, 51),  mag:  1.97, tint: "#fffbe7", dist_ly: 433 },
  { name: "Acrux",     ra: hms(12, 26, 36), dec: dms(-63, 5, 57),  mag:  0.77, tint: "#c7dbff", dist_ly: 321 },
  { name: "Mimosa",    ra: hms(12, 47, 43), dec: dms(-59, 41, 19), mag:  1.25, tint: "#c0d6ff", dist_ly: 280 },
];

// ---- Planet positions (simplified ecliptic model) ----
// Mean longitudes at J2000 epoch and mean motions, in degrees.
const PLANETS_ELEMENTS = [
  { name: "Mercury", L0: 252.25032, n: 4.09233445, inc: 7.00,  color: "#c6a378" },
  { name: "Venus",   L0: 181.97973, n: 1.60213034, inc: 3.39,  color: "#f1dca7" },
  { name: "Mars",    L0: -4.55343,  n: 0.52402068, inc: 1.85,  color: "#dd6b4a" },
  { name: "Jupiter", L0: 34.39644,  n: 0.08308529, inc: 1.30,  color: "#d8b88a" },
  { name: "Saturn",  L0: 49.95424,  n: 0.03344414, inc: 2.49,  color: "#e6d3a3" },
  { name: "Uranus",  L0: 313.23810, n: 0.01172834, inc: 0.77,  color: "#a7e0ea" },
  { name: "Neptune", L0: 304.88003, n: 0.00598103, inc: 1.77,  color: "#6e93d7" },
];

// Days since J2000 epoch
function daysSinceJ2000(date) {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - J2000) / 86400000;
}

/**
 * Approximate planet position in equatorial coordinates (RA, Dec) at date.
 * Simplified: ecliptic longitude propagated linearly, then rotated by
 * obliquity ε ≈ 23.44°. Good enough for a demo.
 */
export function planetRaDec(name, date) {
  const el = PLANETS_ELEMENTS.find((p) => p.name === name);
  if (!el) return null;
  const d = daysSinceJ2000(date);
  const L = ((el.L0 + el.n * d) % 360 + 360) % 360;
  const lambda = L * DEG;
  const eps = 23.4393 * DEG;
  // Circular orbit assumption: ecliptic latitude ≈ 0, longitude = L.
  // Transform to equatorial.
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  return { ra: (ra + 2 * Math.PI) % (2 * Math.PI), dec, name };
}

// ---- Moon (very simplified) ----
export function moonRaDec(date) {
  const d = daysSinceJ2000(date);
  // Mean longitude; advances 13.176 deg/day
  const L = ((218.316 + 13.176396 * d) % 360 + 360) % 360;
  const M = ((134.963 + 13.064993 * d) % 360 + 360) % 360;
  const F = ((93.272 + 13.229350 * d) % 360 + 360) % 360;
  // Ecliptic longitude and latitude (very simplified)
  const lambda = (L + 6.289 * Math.sin(M * DEG)) * DEG;
  const beta = (5.128 * Math.sin(F * DEG)) * DEG;
  const eps = 23.4393 * DEG;
  // Transform ecliptic (lambda, beta) → equatorial
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda)
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda)
  );
  return {
    ra: (ra + 2 * Math.PI) % (2 * Math.PI),
    dec,
    phase: ((L - 280.46 - 0.9856 * d) % 360 + 360) % 360 / 360, // 0..1 sun-moon angle
    name: "Moon",
  };
}

// ---- Local Sidereal Time ----
// Greenwich Mean Sidereal Time (radians), then offset by observer longitude.
export function localSiderealTime(date, longitudeDeg) {
  const d = daysSinceJ2000(date);
  const T = d / 36525;
  let GMST = 280.46061837 + 360.98564736629 * d + T * T * (0.000387933 - T / 38710000);
  GMST = ((GMST % 360) + 360) % 360;
  return ((GMST + longitudeDeg) * DEG) % (2 * Math.PI);
}

// ---- (RA, Dec) → (alt, az) ----

export function raDecToAltAz(ra, dec, latRad, lst) {
  const H = lst - ra; // hour angle
  const sinAlt = Math.sin(dec) * Math.sin(latRad) + Math.cos(dec) * Math.cos(latRad) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const y = -Math.cos(dec) * Math.sin(H);
  const x = Math.sin(dec) * Math.cos(latRad) - Math.cos(dec) * Math.sin(latRad) * Math.cos(H);
  let az = Math.atan2(y, x);
  if (az < 0) az += 2 * Math.PI;
  return { alt, az };
}

/**
 * Convert (alt, az) to a Three.js position on a unit sphere with
 * +Y = zenith, +X = east, +Z = north. For rendering on a large sphere
 * scale the returned vector by a radius.
 */
export function altAzToVec3(alt, az) {
  const cosA = Math.cos(alt);
  return {
    x: cosA * Math.sin(az),
    y: Math.sin(alt),
    z: cosA * Math.cos(az),
  };
}

// ---- Background starfield generator (procedural, RA/Dec distributed) ----

export function generateBackgroundStars(count, seed = 7) {
  const rng = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng();
    const ra = 2 * Math.PI * u;
    const dec = Math.asin(2 * v - 1);
    const mag = 2.0 + Math.pow(rng(), 1.7) * 4.5; // 2..6.5
    const t = rng();
    const tint = `rgb(${220 + Math.floor(35 * t)}, ${220 + Math.floor(30 * rng())}, ${200 + Math.floor(55 * (1 - t))})`;
    stars.push({ id: `bg${i}`, ra, dec, mag, tint });
  }
  return stars;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Satellite and debris constellation generator ----
// Each has orbital radius, inclination, RAAN, phase — simplified SGP4-less.

export function generateSatellites(count, seed = 42) {
  const rng = mulberry32(seed);
  const sats = [];
  // Three cohorts roughly matching real populations
  for (let i = 0; i < count; i++) {
    const cohort = rng();
    let altitude, kind;
    if (cohort < 0.65) {
      altitude = 400 + rng() * 1200; // LEO
      kind = "LEO sat";
    } else if (cohort < 0.85) {
      altitude = 2000 + rng() * 18000;
      kind = "MEO";
    } else if (cohort < 0.95) {
      altitude = 35786;
      kind = "GEO";
    } else {
      altitude = 500 + rng() * 800;
      kind = "debris";
    }
    const inc = rng() * 0.9 * Math.PI - 0.1; // -0.1..0.8 rad
    const raan = rng() * 2 * Math.PI;
    const phase0 = rng() * 2 * Math.PI;
    const R_E = 6371;
    const a_km = R_E + altitude;
    const mu = 398600.4418; // GM_E (km^3/s^2)
    const period = 2 * Math.PI * Math.sqrt((a_km ** 3) / mu);
    sats.push({
      id: `sat${i}`,
      altitude,
      inclination: inc,
      raan,
      phase0,
      period,
      kind,
      // Approx magnitude: sunlit LEO objects near horizon can be ~3..5
      mag: kind === "debris" ? 6.0 + rng() * 1.5 : 3.0 + rng() * 3.0,
    });
  }
  return sats;
}

/**
 * Position of a satellite in the celestial frame at time t (seconds since epoch).
 * Returns (ra, dec) approximating an inertial ECI pointing — good enough
 * for a visual demo with moving dots.
 */
export function satelliteRaDec(sat, tSeconds) {
  const n = (2 * Math.PI) / sat.period; // rad/s
  const u = sat.phase0 + n * tSeconds; // argument of latitude
  // Position on orbit plane
  const cosU = Math.cos(u), sinU = Math.sin(u);
  const cosI = Math.cos(sat.inclination), sinI = Math.sin(sat.inclination);
  const cosO = Math.cos(sat.raan), sinO = Math.sin(sat.raan);
  // ECI coordinates
  const x = cosO * cosU - sinO * sinU * cosI;
  const y = sinO * cosU + cosO * sinU * cosI;
  const z = sinU * sinI;
  const dec = Math.asin(z);
  let ra = Math.atan2(y, x);
  if (ra < 0) ra += 2 * Math.PI;
  return { ra, dec };
}

// ---- Hemisphere presets ----

export const HEMISPHERE_PRESETS = {
  "London (51°N)":   { lat: 51.5,   lon: -0.13,   label: "Northern" },
  "Nürnberg (49°N)": { lat: 49.4521, lon: 11.0767, label: "Northern" },
  "New York (41°N)": { lat: 40.7,   lon: -74.0,   label: "Northern" },
  "Equator (0°)":    { lat: 0.0,    lon: 0.0,     label: "Equator" },
  "Cape Town (34°S)":{ lat: -33.9,  lon: 18.4,    label: "Southern" },
  "Sydney (34°S)":   { lat: -33.87, lon: 151.21,  label: "Southern" },
  "North Pole":      { lat: 89.0,   lon: 0.0,     label: "Polar" },
  "South Pole":      { lat: -89.0,  lon: 0.0,     label: "Polar" },
};
