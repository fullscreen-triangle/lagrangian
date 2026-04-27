import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  VELA_SNR,
  GREAT_ZIMBABWE,
  velaObservables,
} from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";
import ObservablesChart from "@/components/instruments/ObservablesChart";

// ---- Scene primitives -------------------------------------------------------

function VelaPulsar() {
  const ref = useRef();
  const beamRef = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    // Real pulsar period = 89 ms. Speed up 30× so it's perceptible without
    // looking like a strobe — phase is the visual beat, not the physical one.
    const phase = (t * 1.2) % 1;
    const pulse = 1 + 1.2 * Math.exp(-25 * phase * phase);
    ref.current.scale.setScalar(0.18 * pulse);
    if (ref.current.material) ref.current.material.emissiveIntensity = pulse * 3;
    if (beamRef.current) {
      beamRef.current.rotation.y = t * 4.0;
      beamRef.current.material.opacity = 0.18 + 0.15 * Math.cos(t * 6);
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#bfe3ff" emissive="#9bd0ff" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={3} distance={20} color="#9bd0ff" decay={2} />
      <mesh ref={beamRef}>
        <coneGeometry args={[0.02, 6, 16, 1, true]} />
        <meshBasicMaterial color="#bfe3ff" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ShellParticles({ radius, intensity = 1 }) {
  const positions = useMemo(() => {
    const N = 2200;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Uniform sphere surface with a thin radial blur (shell, not solid sphere)
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const jitter = 1 + (Math.random() - 0.5) * 0.18;
      arr[i * 3]     = r * Math.cos(phi) * jitter;
      arr[i * 3 + 1] = u * jitter;
      arr[i * 3 + 2] = r * Math.sin(phi) * jitter;
    }
    return arr;
  }, []);
  const colours = useMemo(() => {
    const N = positions.length / 3;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Magenta–pink–blue gradient by latitude — purely visual
      const t = (positions[i * 3 + 1] + 1) * 0.5;
      arr[i * 3]     = 0.9 - 0.3 * t;
      arr[i * 3 + 1] = 0.3 + 0.4 * t;
      arr[i * 3 + 2] = 0.7 + 0.3 * t;
    }
    return arr;
  }, [positions]);
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.02;
  });
  return (
    <points ref={ref} scale={radius}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-color"    array={colours}   count={colours.length / 3}   itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.55 * intensity} sizeAttenuation />
    </points>
  );
}

function ShellWireframe({ radius }) {
  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial color="#9b59b6" wireframe transparent opacity={0.08} />
    </mesh>
  );
}

function GreatZimbabweLink({ shellRadius }) {
  // Place a small Earth marker and draw a sight-line from Vela to Earth.
  // Distances are not to scale — markers visualise direction only.
  const distanceUnits = 20; // arbitrary
  const points = useMemo(() => [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(distanceUnits, -2, distanceUnits * 0.4),
  ], []);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <group>
      <line geometry={geom}>
        <lineBasicMaterial color="#f9d56e" transparent opacity={0.6} />
      </line>
      {/* Earth marker */}
      <group position={[distanceUnits, -2, distanceUnits * 0.4]}>
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#3d7ec9" emissive="#1a3e6f" emissiveIntensity={0.4} />
        </mesh>
        {/* Great Zimbabwe latitude ring (-20.27°) */}
        <mesh rotation={[Math.PI / 2 - (Math.PI * GREAT_ZIMBABWE.lat) / 180, 0, 0]}>
          <torusGeometry args={[0.51, 0.012, 8, 64]} />
          <meshBasicMaterial color="#f9d56e" />
        </mesh>
        {/* Marker dot at GZ longitude on the latitude ring (visual only) */}
        <mesh position={[0.51 * Math.cos((Math.PI * GREAT_ZIMBABWE.lat) / 180), 0.51 * Math.sin((Math.PI * GREAT_ZIMBABWE.lat) / 180), 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffba33" />
        </mesh>
      </group>
    </group>
  );
}

// ---- Main -------------------------------------------------------------------

export default function VelaInstrument() {
  const observables = useMemo(() => velaObservables(), []);
  const [yearsAgo, setYearsAgo] = useState(VELA_SNR.ageYears);
  const [showLink, setShowLink] = useState(true);
  const [showWireframe, setShowWireframe] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);

  const meanError = observables.reduce((s, o) => s + o.error, 0) / observables.length;

  // Visualisation radius: linear in time. R = 0 at explosion, ~8 units at present age.
  const vizRadius = (yearsAgo / VELA_SNR.ageYears) * 8;

  // Era hints
  const era = useMemo(() => eraLabel(yearsAgo), [yearsAgo]);

  return (
    <>
      <div className="fixed inset-0 bg-black">
        <Canvas
          camera={{ position: [14, 6, 18], fov: 45 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#02030a"]} />
          <ambientLight intensity={0.05} />
          <Suspense fallback={null}>
            <Stars radius={120} depth={40} count={5000} factor={4} fade speed={0.2} />
            <VelaPulsar />
            <ShellParticles radius={Math.max(0.05, vizRadius)} intensity={1.2 - vizRadius / 16} />
            {showWireframe && <ShellWireframe radius={Math.max(0.05, vizRadius)} />}
            {showLink && <GreatZimbabweLink shellRadius={vizRadius} />}
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            autoRotate={autoRotate}
            autoRotateSpeed={0.4}
            minDistance={3}
            maxDistance={120}
          />
        </Canvas>
      </div>

      <BackToHub />
      <InstrumentTitle name="Vela Supernova Remnant" />
      <IdleHint text="drag · scroll · scrub time at left · open observables right" />

      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none max-w-[300px]">
        <div>{observables.length} observables · mean err {(meanError * 100).toFixed(2)}%</div>
        <div className="text-white/50">PSR J0835−4510 · 89.33 ms · 287 pc</div>
        <div className="text-white/50">{Math.round(yearsAgo).toLocaleString()} yr after explosion</div>
      </div>

      <CollapsiblePanel side="left" label="time + layers" defaultOpen={true}>
        <div className="space-y-3 text-xs font-mono">
          <p className="text-sm font-bold">{VELA_SNR.name}</p>
          <p className="text-[10px] text-white/60 leading-snug">
            Type II supernova in Vela, ~287 pc. Light-travel ~936 yr. Shell now spans
            8° of sky — about sixteen full Moons end-to-end. The Vela pulsar at the
            centre rotates 11.2 times per second.
          </p>

          <div className="border-t border-white/10 pt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span>Years since explosion</span>
              <span className="text-amber-300">{Math.round(yearsAgo).toLocaleString()}</span>
            </div>
            <input
              type="range" min={0} max={Math.round(VELA_SNR.ageYears * 1.2)} step={50}
              value={yearsAgo}
              onChange={(e) => setYearsAgo(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-[10px] text-white/60">{era}</div>
          </div>

          <div className="border-t border-white/10 pt-2 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showWireframe} onChange={(e) => setShowWireframe(e.target.checked)} />
              <span>Shell wireframe</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLink} onChange={(e) => setShowLink(e.target.checked)} />
              <span>Earth · Great Zimbabwe sight-line</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
              <span>Auto-rotate camera</span>
            </label>
          </div>

          <div className="border-t border-white/10 pt-2 text-[10px] text-white/60 leading-snug">
            <p className="text-white/85 font-bold mb-1">Great Zimbabwe ({GREAT_ZIMBABWE.lat.toFixed(2)}°S)</p>
            <p>
              Vela culminates {culminationAlt().toFixed(1)}° above the southern horizon
              and stays above it {hoursVisible().toFixed(1)} hr per night. Per the
              cited research, the Great Enclosure walls were laid out as a
              cosmological instrument with this remnant as its initiating focus.
            </p>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel side="right" label="observables" defaultOpen={true}>
        <div className="text-xs font-mono space-y-4">
          <div>
            <p className="text-sm font-bold mb-2">Derived observables</p>
            <p className="text-white/50 mb-2 text-[10px]">
              Pulsar quantities derived from {VELA_SNR.pulsar.name}&apos;s spin period
              and Ṗ. Visibility derived for Great Zimbabwe latitude.
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
                  <tr key={o.name + o.unit} className="border-b border-white/10">
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

          <div className="border-t border-white/15 pt-3">
            <p className="text-sm font-bold mb-2">Chart</p>
            <ObservablesChart rows={observables} height={Math.max(220, observables.length * 18 + 40)} />
          </div>

          <div className="border-t border-white/15 pt-3 text-[10px] text-white/60">
            <p className="text-white/85 font-bold mb-1">References</p>
            <p>Caraveo et al. 2001 — Vela pulsar parallax distance (287 pc).</p>
            <p>Aschenbach 1998 — ROSAT shell morphology and age.</p>
            <p>Reichley & Downs 1969 — discovery of PSR 0833-45.</p>
          </div>
        </div>
      </CollapsiblePanel>
    </>
  );
}

function eraLabel(yearsAgo) {
  if (yearsAgo < 1) return "moment of explosion";
  if (yearsAgo < 50) return "naked-eye supernova phase (mag −10)";
  if (yearsAgo < 1000) return "young remnant — early shell expansion";
  if (yearsAgo < 9500) return "middle Holocene — shell now several light-years across";
  if (yearsAgo < 11000) return "Great Zimbabwe construction era (~10 300 yr after explosion)";
  if (yearsAgo <= VELA_SNR.ageYears + 50) return "present day";
  return "future — shell entering Sedov radiative phase";
}

function culminationAlt() {
  const lat = GREAT_ZIMBABWE.lat;
  const dec = VELA_SNR.decDeg;
  const same = Math.sign(dec) === Math.sign(lat);
  return same ? 90 - Math.abs(lat - dec) : 90 - Math.abs(lat) - Math.abs(dec);
}

function hoursVisible() {
  const dec = (VELA_SNR.decDeg * Math.PI) / 180;
  const lat = (GREAT_ZIMBABWE.lat * Math.PI) / 180;
  const c = -Math.tan(lat) * Math.tan(dec);
  if (c < -1) return 24;
  if (c >  1) return 0;
  return (2 * Math.acos(c) * 12) / Math.PI;
}

function formatNum(x) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  if (ax >= 1e5) return x.toExponential(3);
  if (ax >= 100) return x.toFixed(1);
  if (ax >= 1)   return x.toFixed(3);
  return x.toExponential(2);
}
