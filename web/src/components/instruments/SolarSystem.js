import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AU,
  BODIES,
  OBSERVED_PERIODS,
  OBSERVED_SMA,
  YEAR,
  planetaryRadii,
} from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";

// Visualisation scale — the real solar system is impractically anisotropic.
// We compress outer planets logarithmically so all eight are visible.
function displayRadius(smaAU) {
  return Math.log10(1 + smaAU * 1.2) * 3.4;
}

// Body render size in scene units — keeps the Sun big and planets scaled
// up by a hand factor so they're visible at AU scale.
function renderSize(name) {
  if (name === "Sun") return 0.9;
  const base = BODIES[name].radius / 6.371e6; // Earth radii
  return Math.max(0.08, Math.pow(base, 0.38) * 0.22);
}

function Planet({ name, smaAU, period, phaseOffset, color, simTime, onClick, selected }) {
  const meshRef = useRef();

  useFrame(() => {
    const t = simTime.current;
    const angle = (2 * Math.PI * t) / period + phaseOffset;
    const r = displayRadius(smaAU);
    if (meshRef.current) {
      meshRef.current.position.x = r * Math.cos(angle);
      meshRef.current.position.z = r * Math.sin(angle);
      meshRef.current.position.y = 0;
      meshRef.current.rotation.y += 0.01;
    }
  });

  const size = renderSize(name);
  return (
    <mesh
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick(name);
      }}
    >
      <sphereGeometry args={[size, 32, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? color : "#000000"}
        emissiveIntensity={selected ? 0.4 : 0}
        roughness={0.85}
      />
    </mesh>
  );
}

function Orbit({ smaAU, selected }) {
  const geometry = useMemo(() => {
    const N = 128;
    const r = displayRadius(smaAU);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [smaAU]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={selected ? "#ffffff" : "#555566"}
        transparent
        opacity={selected ? 0.9 : 0.35}
      />
    </line>
  );
}

function Sun() {
  return (
    <mesh>
      <sphereGeometry args={[0.9, 64, 32]} />
      <meshBasicMaterial color="#fdb813" />
      <pointLight intensity={2.0} distance={200} decay={0} />
    </mesh>
  );
}

function TimeAdvancer({ simTime, timeScaleRef }) {
  useFrame((_, delta) => {
    simTime.current += delta * timeScaleRef.current * YEAR;
  });
  return null;
}

function Scene({ planets, simTime, timeScaleRef, selected, onSelect }) {
  return (
    <Canvas
      camera={{ position: [0, 18, 18], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}
    >
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <TimeAdvancer simTime={simTime} timeScaleRef={timeScaleRef} />
        <Sun />
        {planets.map((p, i) => (
          <group key={p.name}>
            <Orbit smaAU={p.observed / AU} selected={selected === p.name} />
            <Planet
              name={p.name}
              smaAU={p.observed / AU}
              period={p.period}
              phaseOffset={(i * 2 * Math.PI) / planets.length}
              color={p.color}
              simTime={simTime}
              onClick={onSelect}
              selected={selected === p.name}
            />
          </group>
        ))}
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={80}
      />
    </Canvas>
  );
}

// ---- Info panel ----

function PlanetInfo({ name }) {
  const body = BODIES[name];
  const observed = OBSERVED_SMA[name];
  const period = OBSERVED_PERIODS[name];
  const derivedSMA = Math.pow(
    (6.67430e-11 * BODIES.Sun.mass * period * period) / (4 * Math.PI * Math.PI),
    1 / 3
  );
  const errSMA = Math.abs(derivedSMA - observed) / observed;
  const rings = [
    { label: "Mass", value: body.mass.toExponential(3), unit: "kg" },
    { label: "Radius", value: (body.radius / 1e3).toFixed(0), unit: "km" },
    { label: "Observed SMA", value: (observed / AU).toFixed(4), unit: "AU" },
    { label: "Derived SMA (Kepler III)", value: (derivedSMA / AU).toFixed(4), unit: "AU" },
    { label: "SMA error", value: (errSMA * 100).toFixed(3), unit: "%" },
    { label: "Orbital period", value: (period / YEAR).toFixed(3), unit: "yr" },
  ];
  return (
    <div className="rounded-xl border border-dark/30 dark:border-light/30 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-5 h-5 rounded-full"
          style={{ backgroundColor: body.color }}
        />
        <h3 className="text-lg font-bold">{name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        {rings.map((r) => (
          <div
            key={r.label}
            className="rounded border border-dark/20 dark:border-light/20 px-2 py-1"
          >
            <div className="text-[9px] uppercase tracking-widest text-dark/50 dark:text-light/50">
              {r.label}
            </div>
            <div className="mt-0.5">
              <span className="font-bold">{r.value}</span>{" "}
              <span className="text-dark/40 dark:text-light/40">{r.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main ----

export default function SolarSystem() {
  const planets = useMemo(() => planetaryRadii(), []);
  const simTime = useRef(0);
  const timeScaleRef = useRef(0.02);
  const [timeScale, setTimeScale] = useState(0.02);
  const [selected, setSelected] = useState("Earth");

  // Keep timeScale ref synced so the r3f frame loop always reads the latest value.
  useEffect(() => { timeScaleRef.current = timeScale; }, [timeScale]);

  return (
    <>
      <div className="fixed inset-0">
        <Scene
          planets={planets}
          simTime={simTime}
          timeScaleRef={timeScaleRef}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      <BackToHub />
      <InstrumentTitle name="Solar System" />
      <IdleHint text="click a planet · drag to orbit · scroll to zoom" />

      {/* Top-right live info */}
      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none">
        <div>time rate</div>
        <div className="text-white/50">{timeScale.toFixed(3)} yr / wall-s</div>
      </div>

      {/* Left panel: time controls */}
      <CollapsiblePanel side="left" label="time" defaultOpen={false}>
        <div className="space-y-4 text-xs font-mono">
          <p className="text-sm font-bold">Time scale</p>
          <div className="text-white/50">
            Simulation years per wall-clock second.
          </div>
          <input
            type="range"
            min={-3}
            max={1}
            step={0.1}
            value={Math.log10(timeScale)}
            onChange={(e) => setTimeScale(Math.pow(10, Number(e.target.value)))}
            className="w-full"
          />
          <div>{timeScale.toFixed(3)} yr/s</div>
        </div>
      </CollapsiblePanel>

      {/* Right panel: planet info + Kepler table */}
      <CollapsiblePanel side="right" label="planet" defaultOpen={true}>
        <div className="text-xs font-mono space-y-4">
          <PlanetInfo name={selected} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2">
              Kepler III across 8 planets
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-white/15 text-[10px] text-white/50">
                  <th className="py-1 pr-2 font-normal">Planet</th>
                  <th className="py-1 pr-2 font-normal text-right">T (yr)</th>
                  <th className="py-1 pr-2 font-normal text-right">a (AU)</th>
                  <th className="py-1 font-normal text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {planets.map((p) => (
                  <tr
                    key={p.name}
                    className={`border-b border-white/10 cursor-pointer ${selected === p.name ? "bg-white/10" : ""}`}
                    onClick={() => setSelected(p.name)}
                  >
                    <td className="py-1 pr-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </td>
                    <td className="py-1 pr-2 text-right">{(p.period / YEAR).toFixed(3)}</td>
                    <td className="py-1 pr-2 text-right">{(p.derived / AU).toFixed(4)}</td>
                    <td className="py-1 text-right text-green-400">
                      {(p.error * 100).toFixed(3)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsiblePanel>
    </>
  );
}

