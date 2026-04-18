import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  BRIGHT_STARS,
  HEMISPHERE_PRESETS,
  altAzToVec3,
  generateBackgroundStars,
  generateSatellites,
  localSiderealTime,
  moonRaDec,
  planetRaDec,
  raDecToAltAz,
  satelliteRaDec,
} from "@/lib/celestial-sky";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";

const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
const BG_STAR_COUNT = 1500;
const SAT_COUNT = 300;
const R_SKY = 100;

// Convert (ra, dec) + observer → scene position on sphere of radius R_SKY.
function skyPosition(ra, dec, latRad, lst) {
  const { alt, az } = raDecToAltAz(ra, dec, latRad, lst);
  const v = altAzToVec3(alt, az);
  return [v.x * R_SKY, v.y * R_SKY, v.z * R_SKY, alt];
}

function magnitudeToSize(mag, boost = 1) {
  // Brighter stars have lower magnitude. Scale roughly as 2.512^(-mag).
  return Math.max(0.5, 14 - 2.3 * mag) * boost;
}

// ---- The big-point-field background stars ----

function StarField({ bgStars, latRad, lst }) {
  const { positions, colors, sizes, altitudes } = useMemo(() => {
    const N = bgStars.length;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const sz = new Float32Array(N);
    const alt = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const s = bgStars[i];
      const [x, y, z, a] = skyPosition(s.ra, s.dec, latRad, lst);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      // Tint parsing
      const m = s.tint.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      const r = m ? +m[1] / 255 : 0.9;
      const g = m ? +m[2] / 255 : 0.9;
      const b = m ? +m[3] / 255 : 0.95;
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
      sz[i] = magnitudeToSize(s.mag, 0.7);
      alt[i] = a;
    }
    return { positions: pos, colors: col, sizes: sz, altitudes: alt };
  }, [bgStars, latRad, lst]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={bgStars.length} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={bgStars.length} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={bgStars.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-alt" count={bgStars.length} array={altitudes} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        vertexColors
        transparent
        depthWrite={false}
      />
    </points>
  );
}

const STAR_VERT = `
attribute float size;
attribute float alt;
varying vec3 vColor;
varying float vAlt;
void main() {
  vColor = color;
  vAlt = alt;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * (300.0 / -mvPosition.z);
}
`;

const STAR_FRAG = `
varying vec3 vColor;
varying float vAlt;
void main() {
  if (vAlt < 0.0) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 2.2);
  // Dim near horizon (atmospheric extinction proxy)
  float horizonDim = clamp(vAlt * 4.0, 0.25, 1.0);
  gl_FragColor = vec4(vColor, a * horizonDim);
}
`;

// ---- Bright named stars (clickable spheres with labels) ----

function NamedStars({ latRad, lst, onPick }) {
  const items = useMemo(() => {
    return BRIGHT_STARS.map((s) => {
      const [x, y, z, alt] = skyPosition(s.ra, s.dec, latRad, lst);
      return { ...s, pos: [x, y, z], alt };
    });
  }, [latRad, lst]);
  return (
    <group>
      {items.map((s) => (
        s.alt > 0 && (
          <mesh
            key={s.name}
            position={s.pos}
            onPointerDown={(e) => { e.stopPropagation(); onPick({ type: "star", object: s }); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "default"; }}
          >
            <sphereGeometry args={[Math.max(0.6, 2.0 - s.mag * 0.4), 16, 8]} />
            <meshBasicMaterial color={s.tint} transparent opacity={0.95} />
          </mesh>
        )
      ))}
    </group>
  );
}

// ---- Planets ----

function PlanetSprites({ date, latRad, lst, onPick }) {
  const items = useMemo(() => {
    return PLANETS.map((name) => {
      const rd = planetRaDec(name, date);
      if (!rd) return null;
      const [x, y, z, alt] = skyPosition(rd.ra, rd.dec, latRad, lst);
      return { name, ra: rd.ra, dec: rd.dec, pos: [x, y, z], alt };
    }).filter(Boolean);
  }, [date.getTime(), latRad, lst]);

  const PLANET_COLORS = {
    Mercury: "#c6a378", Venus: "#f1dca7", Mars: "#dd6b4a",
    Jupiter: "#d8b88a", Saturn: "#e6d3a3",
    Uranus: "#a7e0ea", Neptune: "#6e93d7",
  };

  return (
    <group>
      {items.map((p) => p.alt > 0 && (
        <mesh
          key={p.name}
          position={p.pos}
          onPointerDown={(e) => { e.stopPropagation(); onPick({ type: "planet", object: p }); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = "default"; }}
        >
          <sphereGeometry args={[p.name === "Jupiter" || p.name === "Saturn" ? 2.4 : 1.8, 16, 8]} />
          <meshBasicMaterial color={PLANET_COLORS[p.name]} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Moon ----

function MoonSprite({ date, latRad, lst, onPick }) {
  const info = useMemo(() => {
    const rd = moonRaDec(date);
    const [x, y, z, alt] = skyPosition(rd.ra, rd.dec, latRad, lst);
    return { pos: [x, y, z], alt, phase: rd.phase, ra: rd.ra, dec: rd.dec };
  }, [date.getTime(), latRad, lst]);

  if (info.alt <= 0) return null;
  return (
    <mesh
      position={info.pos}
      onPointerDown={(e) => { e.stopPropagation(); onPick({ type: "moon", object: { name: "Moon", ...info } }); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      <sphereGeometry args={[3.0, 24, 12]} />
      <meshBasicMaterial color="#dedede" />
    </mesh>
  );
}

// ---- Satellite layer (animated) ----

function SatelliteLayer({ sats, tRef, latRad, lst, onPick }) {
  const meshRef = useRef();
  const pickRef = useRef();
  const [positions, setPositions] = useState(() => new Float32Array(sats.length * 3));
  const [colors, setColors] = useState(() => new Float32Array(sats.length * 3));
  const [sizes, setSizes] = useState(() => new Float32Array(sats.length));
  const [altitudes, setAltitudes] = useState(() => new Float32Array(sats.length));

  useFrame(() => {
    const t = tRef.current;
    const pos = new Float32Array(sats.length * 3);
    const col = new Float32Array(sats.length * 3);
    const sz = new Float32Array(sats.length);
    const alt = new Float32Array(sats.length);
    for (let i = 0; i < sats.length; i++) {
      const s = sats[i];
      const rd = satelliteRaDec(s, t);
      const [x, y, z, a] = skyPosition(rd.ra, rd.dec, latRad, lst);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      alt[i] = a;
      const isDebris = s.kind === "debris";
      col[i * 3] = isDebris ? 0.7 : 0.9;
      col[i * 3 + 1] = isDebris ? 0.7 : 1.0;
      col[i * 3 + 2] = isDebris ? 0.75 : 0.85;
      sz[i] = isDebris ? 1.2 : 2.4;
    }
    setPositions(pos);
    setColors(col);
    setSizes(sz);
    setAltitudes(alt);
  });

  return (
    <points
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.index !== undefined && e.index !== null) {
          const s = sats[e.index];
          onPick({ type: s.kind, object: { ...s, name: `${s.kind.toUpperCase()} #${e.index}` } });
        }
      }}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={sats.length} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={sats.length} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sats.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-alt" count={sats.length} array={altitudes} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        vertexColors
        transparent
        depthWrite={false}
      />
    </points>
  );
}

// ---- Horizon ring + cardinal letters ----

function HorizonRing() {
  const geometry = useMemo(() => {
    const N = 256;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      pts.push(new THREE.Vector3(Math.sin(a) * R_SKY, 0.1, Math.cos(a) * R_SKY));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#446" transparent opacity={0.8} />
    </line>
  );
}

function CardinalLabels() {
  const letters = [
    { txt: "N", pos: [0, 0.2, R_SKY] },
    { txt: "E", pos: [R_SKY, 0.2, 0] },
    { txt: "S", pos: [0, 0.2, -R_SKY] },
    { txt: "W", pos: [-R_SKY, 0.2, 0] },
  ];
  return (
    <group>
      {letters.map((l) => (
        <mesh key={l.txt} position={l.pos}>
          <sphereGeometry args={[1.2, 8, 4]} />
          <meshBasicMaterial color="#ffaa00" />
        </mesh>
      ))}
    </group>
  );
}

// ---- Scene wrapper ----

function Scene({ bgStars, latRad, lst, date, tRef, sats, onPick }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 0.1], fov: 75, near: 0.01, far: 400 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "radial-gradient(ellipse at bottom, #0b1020 0%, #03050a 60%, #000000 100%)" }}
    >
      <ambientLight intensity={0.1} />
      <Suspense fallback={null}>
        <HorizonRing />
        <CardinalLabels />
        <StarField bgStars={bgStars} latRad={latRad} lst={lst} />
        <NamedStars latRad={latRad} lst={lst} onPick={onPick} />
        <PlanetSprites date={date} latRad={latRad} lst={lst} onPick={onPick} />
        <MoonSprite date={date} latRad={latRad} lst={lst} onPick={onPick} />
        <SatelliteLayer sats={sats} tRef={tRef} latRad={latRad} lst={lst} onPick={onPick} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.35}
        target={[0, 0.0001, 0]}
      />
    </Canvas>
  );
}

// ---- Object-info sidebar ----

function ObjectInfo({ selection }) {
  if (!selection) {
    return (
      <div className="text-xs font-mono text-white/60">
        <p className="mb-2 uppercase tracking-widest">nothing selected</p>
        <p>Click any object in the sky — bright stars, planets, Moon, satellites, or debris.</p>
      </div>
    );
  }
  const { type, object } = selection;
  const rows = [];
  const deg = (r) => (r * 180 / Math.PI).toFixed(2);

  rows.push(["Type", type.toUpperCase()]);
  if (object.name) rows.push(["Name", object.name]);
  if (object.mag !== undefined) rows.push(["Magnitude", object.mag.toFixed(2)]);
  if (object.dist_ly !== undefined) rows.push(["Distance", `${object.dist_ly.toLocaleString()} ly`]);
  if (object.ra !== undefined) rows.push(["Right ascension", `${deg(object.ra)}°`]);
  if (object.dec !== undefined) rows.push(["Declination", `${deg(object.dec)}°`]);
  if (object.altitude !== undefined) rows.push(["Altitude above Earth", `${Math.round(object.altitude)} km`]);
  if (object.period !== undefined) rows.push(["Orbital period", `${(object.period / 60).toFixed(1)} min`]);
  if (object.inclination !== undefined) rows.push(["Inclination", `${deg(object.inclination)}°`]);
  if (object.phase !== undefined) rows.push(["Phase", `${(object.phase * 100).toFixed(0)}% of synodic cycle`]);
  if (object.tint) rows.push(["Spectral tint", object.tint]);

  return (
    <div className="text-xs font-mono">
      <p className="mb-3 text-base font-bold">{object.name || type}</p>
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-white/10 pb-1">
            <span className="text-white/50">{k}</span>
            <span className="text-right">{v}</span>
          </div>
        ))}
      </div>
      {type === "star" && object.name && (
        <p className="mt-3 text-white/60">
          Catalogued main-sequence or giant. Position is J2000 equatorial; the
          observer frame rotation is applied live so the object moves with
          sidereal time.
        </p>
      )}
      {type === "planet" && (
        <p className="mt-3 text-white/60">
          Position from simplified ecliptic elements propagated from J2000.
          Kepler-III-consistent orbit assumed circular.
        </p>
      )}
      {(type === "LEO sat" || type === "MEO" || type === "GEO" || type === "debris") && (
        <p className="mt-3 text-white/60">
          Synthetic constellation member — orbital elements drawn randomly
          from realistic distributions. Moves in real time as you watch.
        </p>
      )}
    </div>
  );
}

// ---- Main ----

export default function SkySurvey() {
  const [presetName, setPresetName] = useState("London (51°N)");
  const preset = HEMISPHERE_PRESETS[presetName];
  const [lat, setLat] = useState(preset.lat);
  const [lon, setLon] = useState(preset.lon);
  const [dateState, setDateState] = useState(() => new Date());
  const [timeRate, setTimeRate] = useState(60); // sim seconds per wall second
  const dateRef = useRef(dateState);
  const tRef = useRef(0);
  const [selection, setSelection] = useState(null);

  const bgStars = useMemo(() => generateBackgroundStars(BG_STAR_COUNT), []);
  const sats = useMemo(() => generateSatellites(SAT_COUNT), []);

  // Advance sim time
  useEffect(() => {
    let last = performance.now();
    let raf;
    const step = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      dateRef.current = new Date(dateRef.current.getTime() + dt * timeRate * 1000);
      setDateState(dateRef.current);
      tRef.current += dt * timeRate;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [timeRate]);

  // When preset changes, set lat/lon
  useEffect(() => {
    setLat(preset.lat);
    setLon(preset.lon);
  }, [presetName]);

  const latRad = (lat * Math.PI) / 180;
  const lst = useMemo(() => localSiderealTime(dateState, lon), [dateState, lon]);

  const onPick = useCallback((sel) => setSelection(sel), []);

  return (
    <>
      <Scene
        bgStars={bgStars}
        latRad={latRad}
        lst={lst}
        date={dateState}
        tRef={tRef}
        sats={sats}
        onPick={onPick}
      />

      <BackToHub />
      <InstrumentTitle name="Sky Survey" />
      <IdleHint text="drag to look around — click any object" />

      {/* Top-right live info */}
      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none">
        <div>{presetName}</div>
        <div className="text-white/50">
          lat {lat.toFixed(2)}°, lon {lon.toFixed(2)}°
        </div>
        <div className="text-white/50">{dateState.toISOString().replace("T", " ").slice(0, 19)} UTC</div>
        <div className="text-white/50">LST {(lst * 12 / Math.PI).toFixed(3)} h</div>
      </div>

      {/* Observer panel — left side */}
      <CollapsiblePanel side="left" label="observer" defaultOpen={false}>
        <div className="space-y-4 text-xs font-mono">
          <p className="text-sm font-bold">Observer</p>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              location
            </label>
            <select
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full bg-black/60 border border-white/20 rounded px-2 py-1"
            >
              {Object.keys(HEMISPHERE_PRESETS).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <div className="mt-1 text-white/50">{preset.label} hemisphere</div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              latitude ({lat.toFixed(1)}°)
            </label>
            <input
              type="range" min={-89} max={89} step={0.5}
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              longitude ({lon.toFixed(1)}°)
            </label>
            <input
              type="range" min={-180} max={180} step={1}
              value={lon}
              onChange={(e) => setLon(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              time rate (sim s / wall s)
            </label>
            <input
              type="range" min={-3} max={4} step={0.1}
              value={Math.log10(Math.max(timeRate, 0.001))}
              onChange={(e) => setTimeRate(Math.pow(10, Number(e.target.value)))}
              className="w-full"
            />
            <div className="text-white/50 mt-1">{timeRate.toFixed(1)} ×</div>
          </div>
          <button
            onClick={() => { dateRef.current = new Date(); setDateState(new Date()); }}
            className="w-full bg-white/10 hover:bg-white/20 rounded px-2 py-1 border border-white/20"
          >
            reset clock to now
          </button>
        </div>
      </CollapsiblePanel>

      {/* Object-info panel — right side */}
      <CollapsiblePanel side="right" label="object" defaultOpen={!!selection}>
        <ObjectInfo selection={selection} />
      </CollapsiblePanel>
    </>
  );
}
