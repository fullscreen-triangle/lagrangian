import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  harmonicGraph,
  cycleRank,
  fundamentalCycles,
  buildTransferMatrix,
  solveLeastSquares,
  conditionNumber,
  MOLECULE_PRESETS,
} from "@/lib/loop-coupling";

// ---- Procedural sky ----

function generateStars(count, seed = 1) {
  const rng = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    // Uniform on sphere
    const u = rng();
    const v = rng();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 50;
    const pos = [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
    // Magnitude: mostly faint, a few bright
    const m = Math.pow(rng(), 3);
    // Colour-temperature-like tint
    const t = rng();
    const color = [
      0.7 + 0.3 * t,
      0.8 + 0.15 * rng(),
      1.0 - 0.3 * t,
    ];
    stars.push({ id: i, pos, magnitude: 0.3 + m * 0.7, color, selected: false });
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

// ---- Three.js components ----

function StarField({ stars, selected, onSelect }) {
  const { camera } = useThree();
  const meshRef = useRef();

  // Build one instanced mesh for all stars
  const positions = useMemo(() => {
    const arr = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      arr[i * 3] = s.pos[0];
      arr[i * 3 + 1] = s.pos[1];
      arr[i * 3 + 2] = s.pos[2];
    });
    return arr;
  }, [stars]);

  const colors = useMemo(() => {
    const arr = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      const isSel = selected.has(s.id);
      const mag = s.magnitude * (isSel ? 2.5 : 1.0);
      arr[i * 3] = s.color[0] * mag * (isSel ? 1.0 : 1.0);
      arr[i * 3 + 1] = s.color[1] * mag * (isSel ? 0.6 : 1.0);
      arr[i * 3 + 2] = s.color[2] * mag * (isSel ? 0.4 : 1.0);
    });
    return arr;
  }, [stars, selected]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(stars.length);
    stars.forEach((s, i) => {
      arr[i] = (selected.has(s.id) ? 1.4 : 0.6) + s.magnitude * 0.9;
    });
    return arr;
  }, [stars, selected]);

  const handleClick = (e) => {
    e.stopPropagation();
    // Find nearest star to the click
    const mouse = new THREE.Vector2(
      (e.point.x - camera.position.x),
      (e.point.y - camera.position.y)
    );
    // Simpler: use the intersected index directly
    const idx = e.index;
    if (idx !== undefined && idx !== null && idx < stars.length) {
      onSelect(stars[idx].id);
    }
  };

  return (
    <points onClick={handleClick}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={stars.length}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={stars.length}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={stars.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        vertexColors
        transparent
        depthWrite={false}
      />
    </points>
  );
}

const STAR_VERTEX = `
attribute float size;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * (300.0 / -mvPosition.z);
}
`;

const STAR_FRAGMENT = `
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 2.0);
  gl_FragColor = vec4(vColor, a);
}
`;

function ApertureRay({ active, cycleRank }) {
  const groupRef = useRef();

  useFrame((_, delta) => {
    if (groupRef.current && active) groupRef.current.rotation.z += delta * 0.3;
  });

  if (!active) return null;

  // Draw a loop that visits cycleRank+1 nodes around a circle
  const loops = Math.max(1, cycleRank);
  const points = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const angle = t * Math.PI * 2 * loops;
    const r = 2.5 + 0.6 * Math.sin(t * Math.PI * 2 * (loops + 1));
    points.push(new THREE.Vector3(
      r * Math.cos(angle),
      r * Math.sin(angle),
      0.4 * Math.sin(t * Math.PI * 2 * loops * 0.7),
    ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <group ref={groupRef}>
      <line geometry={geometry}>
        <lineBasicMaterial color="#ff4444" transparent opacity={0.75} />
      </line>
    </group>
  );
}

function SkyScene({ stars, selected, onSelect, cycleRankValue }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 0.1], fov: 75 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}
    >
      <ambientLight intensity={0.1} />
      <Suspense fallback={null}>
        <StarField stars={stars} selected={selected} onSelect={onSelect} />
        <ApertureRay active={selected.size > 0} cycleRank={cycleRankValue} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.35}
        autoRotate
        autoRotateSpeed={0.08}
      />
    </Canvas>
  );
}

// ---- Observation runner ----

function runObservation(omega, edges, selectedStars, noiseLevel) {
  const K = Math.min(selectedStars.length, cycleRank(omega.length, edges) + 1);
  if (K < 1) return null;

  const meanOmega = omega.reduce((a, b) => a + b, 0) / omega.length;
  const sources = selectedStars.slice(0, K).map((s, k) => ({
    direction: s.pos.map((x) => x / Math.sqrt(s.pos[0] ** 2 + s.pos[1] ** 2 + s.pos[2] ** 2)),
    wavelength: (1.0 / (meanOmega * 1e-4)) * (0.7 + 0.6 * k / Math.max(K - 1, 1)),
    trueAmplitude: s.magnitude,
    id: s.id,
  }));

  const A = buildTransferMatrix(omega, edges, sources);
  const sTrue = sources.map((s) => s.trueAmplitude);
  const IClean = A.map((row) =>
    row.reduce((sum, a, k) => sum + a * sTrue[k], 0)
  );
  const sigma = Math.pow(10, noiseLevel);
  const INoisy = IClean.map((v) => v + (Math.random() - 0.5) * 2 * sigma * Math.abs(v));
  const sHat = solveLeastSquares(A, INoisy);
  const kappa = conditionNumber(A);

  return {
    sources,
    sTrue,
    sHat,
    kappa,
    sigma,
    K,
  };
}

// ---- Main component ----

export default function SkySurvey() {
  const [stars] = useState(() => generateStars(800));
  const [selected, setSelected] = useState(new Set());
  const [molecule, setMolecule] = useState("Benzene");
  const [noiseLevel, setNoiseLevel] = useState(-4);

  const omega = MOLECULE_PRESETS[molecule];
  const graph = useMemo(() => {
    const edges = harmonicGraph(omega);
    return { edges, C: cycleRank(omega.length, edges) };
  }, [molecule]);

  const onSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < graph.C + 1) next.add(id);
      return next;
    });
  }, [graph.C]);

  const clearSelection = () => setSelected(new Set());

  const selectedStars = useMemo(
    () => stars.filter((s) => selected.has(s.id)),
    [stars, selected]
  );

  const result = useMemo(
    () => runObservation(omega, graph.edges, selectedStars, noiseLevel),
    [omega, graph.edges, selectedStars, noiseLevel]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Sky canvas */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-solid border-dark dark:border-light bg-black">
        <SkyScene
          stars={stars}
          selected={selected}
          onSelect={onSelect}
          cycleRankValue={graph.C}
        />
        <div className="absolute top-3 left-3 rounded-md bg-black/70 px-3 py-2 text-xs text-white font-mono">
          <div>stars: {stars.length}</div>
          <div>selected: {selected.size} / {graph.C + 1}</div>
        </div>
        <div className="absolute top-3 right-3 rounded-md bg-black/70 px-3 py-2 text-xs text-white font-mono max-w-[220px]">
          click stars to add to the aperture. drag to pan, scroll locked.
        </div>
        {selected.size > 0 && (
          <button
            onClick={clearSelection}
            className="absolute bottom-3 right-3 rounded bg-red-600 px-3 py-1 text-xs text-white font-mono hover:bg-red-700"
          >
            clear
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
        <div>
          <label className="block text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-1">
            Molecular resonator (sets max sources K = C+1 = {graph.C + 1})
          </label>
          <select
            value={molecule}
            onChange={(e) => { setMolecule(e.target.value); clearSelection(); }}
            className="w-full rounded-md border border-dark/30 dark:border-light/30 bg-light dark:bg-dark px-3 py-2 text-sm"
          >
            {Object.keys(MOLECULE_PRESETS).map((m) => (
              <option key={m} value={m}>
                {m} ({MOLECULE_PRESETS[m].length} modes, C = {cycleRank(MOLECULE_PRESETS[m].length, harmonicGraph(MOLECULE_PRESETS[m]))})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-1">
            Detector noise (log10)
          </label>
          <input
            type="range"
            min={-12}
            max={-1}
            step={1}
            value={noiseLevel}
            onChange={(e) => setNoiseLevel(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-sm font-mono">10<sup>{noiseLevel}</sup></span>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-xl border border-dark/30 dark:border-light/30 p-4">
          <div className="text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-3">
            Simultaneous multi-source resolution through a single looped ray
          </div>
          <div className="grid grid-cols-3 gap-3 font-mono text-sm mb-4 md:grid-cols-1">
            <Card label="Sources observed" value={result.K} />
            <Card label="Condition number" value={result.kappa.toFixed(1)} />
            <Card
              label="Mean reconstruction error"
              value={(
                result.sTrue.reduce((s, v, i) => s + Math.abs(v - result.sHat[i]), 0) /
                result.K
              ).toExponential(2)}
            />
          </div>
          <div className="flex items-end gap-3 h-32 px-2">
            {result.sources.map((src, k) => (
              <div key={src.id} className="flex flex-col items-center flex-1 gap-1">
                <div className="flex items-end gap-0.5 w-full h-24">
                  <div
                    className="flex-1 bg-yellow-300 rounded-t border border-yellow-500"
                    style={{ height: `${result.sTrue[k] * 100}%` }}
                    title={`true: ${result.sTrue[k].toFixed(3)}`}
                  />
                  <div
                    className="flex-1 bg-red-500 rounded-t opacity-80"
                    style={{
                      height: `${Math.min(Math.abs(result.sHat[k]), 2) * 50}%`,
                    }}
                    title={`recovered: ${result.sHat[k].toFixed(3)}`}
                  />
                </div>
                <span className="text-[10px] font-mono">★{src.id}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-yellow-300 border border-yellow-500 rounded-sm" />
              true star brightness
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-sm opacity-80" />
              recovered (single aperture ray)
            </span>
          </div>
        </div>
      )}

      <p className="max-w-3xl text-sm text-dark/70 dark:text-light/70">
        The yellow bars are true intrinsic brightnesses of the stars you
        picked. The red bars are what the framework recovers from a single
        looped ray passing through the selected molecular resonator. A
        classical aperture would resolve one star per ray bundle; here all
        <span className="font-mono"> K = C + 1 </span> sources come out of
        one ray. Increase the noise slider to see the reconstruction
        degrade gracefully at the rate predicted by the condition number.
      </p>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-md border border-dark/30 dark:border-light/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-dark/50 dark:text-light/50">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
