import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { moonObservables } from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";

// ---- Procedural Moon ----

function MoonSphere({ phase }) {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    const geom = new THREE.SphereGeometry(1, 128, 64);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const large = lowFreqNoise(v.x, v.y, v.z);
      const small = craterNoise(v.x, v.y, v.z);
      const mare = large < -0.15 ? 1.0 : 0.0;
      const tint = 0.55 + 0.25 * small - 0.2 * mare;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint * 0.98;
      colors[i * 3 + 2] = tint * 0.94;
      v.multiplyScalar(1 + small * 0.018);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.06;
  });

  return (
    <group rotation={[0, phase, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
      </mesh>
    </group>
  );
}

function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function craterNoise(x, y, z) {
  return (
    0.4 * Math.sin(x * 12.3) * Math.cos(y * 14.7) * Math.sin(z * 11.9) +
    0.35 * Math.sin(x * 28.4 + z * 5.1) * Math.sin(y * 25.3) +
    0.25 * (hash(x * 8, y * 8, z * 8) - 0.5) * 0.5
  );
}
function lowFreqNoise(x, y, z) {
  return (
    Math.sin(x * 2.3) * Math.cos(y * 1.7) * Math.sin(z * 2.1) +
    0.5 * Math.sin(x * 4.3 + z * 2.1) * Math.cos(y * 3.9)
  );
}

function EarthShadow({ phase, showShadow }) {
  if (!showShadow) return null;
  const intensity = Math.max(0, Math.cos(phase));
  return (
    <mesh position={[0, 0, -2.5]}>
      <coneGeometry args={[0.3, 1.5, 32, 1, true]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.4 * intensity} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---- Main ----

export default function MoonInstrument() {
  const observables = useMemo(() => moonObservables(), []);
  const [phase, setPhase] = useState(0);
  const [showShadow, setShowShadow] = useState(false);

  const meanError = observables.reduce((s, o) => s + o.error, 0) / observables.length;
  const maxError = Math.max(...observables.map((o) => o.error));

  return (
    <>
      {/* Fullscreen canvas */}
      <div className="fixed inset-0">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 35 }}
          gl={{ antialias: true }}
          style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}
        >
          <ambientLight intensity={0.12} />
          <directionalLight position={[5, 2, 3]} intensity={1.5} />
          <Suspense fallback={null}>
            <MoonSphere phase={phase} />
            <EarthShadow phase={phase} showShadow={showShadow} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom minDistance={1.6} maxDistance={6} rotateSpeed={0.5} />
        </Canvas>
      </div>

      <BackToHub />
      <InstrumentTitle name="The Moon" />
      <IdleHint text="drag to rotate · scroll to zoom · open panels at the edges" />

      {/* Top-right summary */}
      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none">
        <div>{observables.length} observables derived</div>
        <div className="text-white/50">mean err {(meanError * 100).toFixed(2)}% · max {(maxError * 100).toFixed(1)}%</div>
      </div>

      {/* Left panel: controls */}
      <CollapsiblePanel side="left" label="controls" defaultOpen={false}>
        <div className="space-y-4 text-xs font-mono">
          <p className="text-sm font-bold">Orbital phase</p>
          <input
            type="range" min={0} max={2 * Math.PI} step={0.01}
            value={phase} onChange={(e) => setPhase(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-white/50">
            <span>new</span><span>1Q</span><span>full</span><span>3Q</span><span>new</span>
          </div>
          <label className="flex items-center gap-2 pt-2">
            <input type="checkbox" checked={showShadow} onChange={(e) => setShowShadow(e.target.checked)} />
            <span>Earth umbral shadow (eclipse)</span>
          </label>
        </div>
      </CollapsiblePanel>

      {/* Right panel: derived observables table */}
      <CollapsiblePanel side="right" label="observables" defaultOpen={true}>
        <div className="text-xs font-mono">
          <p className="text-sm font-bold mb-3">Derived observables</p>
          <p className="text-white/50 mb-3">
            Every value below is computed in your browser from the framework&apos;s
            formulas — no observational input.
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/15 text-white/50 text-left text-[10px]">
                <th className="py-1 pr-2 font-normal">Quantity</th>
                <th className="py-1 pr-2 font-normal text-right">Derived</th>
                <th className="py-1 font-normal text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {observables.map((o) => (
                <tr key={o.name} className="border-b border-white/10">
                  <td className="py-1 pr-2">{o.name}</td>
                  <td className="py-1 pr-2 text-right">
                    {formatNum(o.derived)} <span className="text-white/40">{o.unit}</span>
                  </td>
                  <td className={`py-1 text-right ${o.error < 0.05 ? "text-green-400" : "text-amber-400"}`}>
                    {(o.error * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    </>
  );
}

function formatNum(x) {
  if (Math.abs(x) >= 1e5) return x.toExponential(3);
  if (Math.abs(x) >= 100) return x.toFixed(1);
  if (Math.abs(x) >= 1) return x.toFixed(3);
  return x.toExponential(2);
}
