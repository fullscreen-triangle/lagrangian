import { useMemo, useState } from "react";
import {
  FLUID_LIBRARY,
  refractiveIndex,
  traceRay,
  stackedFluidObservables,
} from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";
import ObservablesChart from "@/components/instruments/ObservablesChart";

// Five sample wavelengths across the visible band — each rendered as a ray.
const LAMBDA_TRACERS = [
  { lambda: 400, color: "#7c3aed" },  // violet
  { lambda: 480, color: "#3b82f6" },  // blue
  { lambda: 550, color: "#22c55e" },  // green
  { lambda: 620, color: "#f97316" },  // orange
  { lambda: 700, color: "#ef4444" },  // red
];

const DEFAULT_STACK = [
  { id: "L1", fluid: FLUID_LIBRARY.water,        thicknessMm: 8 },
  { id: "L2", fluid: FLUID_LIBRARY.silicone_oil, thicknessMm: 6 },
  { id: "L3", fluid: FLUID_LIBRARY.glycerin,     thicknessMm: 6 },
  { id: "L4", fluid: FLUID_LIBRARY.cs2,          thicknessMm: 4 },
];

const DTHETA_GRID_OPTIONS = [
  { label: "0.25°", val: Math.PI / 720 },
  { label: "1°",    val: Math.PI / 180 },
  { label: "2°",    val: Math.PI / 90  },
  { label: "5°",    val: Math.PI / 36  },
];

export default function StackedFluidInstrument() {
  const [layers, setLayers] = useState(DEFAULT_STACK);
  const [theta0Deg, setTheta0Deg] = useState(30);
  const [dthetaIdx, setDthetaIdx] = useState(0);
  const [showDiscrete, setShowDiscrete] = useState(true);

  const dtheta = DTHETA_GRID_OPTIONS[dthetaIdx].val;
  const observables = useMemo(
    () => stackedFluidObservables(layers, 550),
    [layers]
  );

  // SVG dimensions, in mm — 1 mm = 6 px gives a comfortable display
  const totalThicknessMm = layers.reduce((s, L) => s + L.thicknessMm, 0) + 16; // headroom
  const svgWmm = 80;
  const svgHmm = totalThicknessMm + 8;
  const px = (mm) => mm * 6;

  // Compute traces for each sample wavelength
  const traces = useMemo(() => {
    const theta0 = (theta0Deg * Math.PI) / 180;
    return LAMBDA_TRACERS.map((t) => ({
      ...t,
      pts: traceRay(layers, t.lambda, theta0, svgWmm / 2 - 14, 4, dtheta),
    }));
  }, [layers, theta0Deg, dtheta]);

  // Layer y-offsets for drawing
  const yOffsets = useMemo(() => {
    const out = [];
    let acc = 4; // top air gap
    for (const L of layers) {
      out.push({ y0: acc, y1: acc + L.thicknessMm });
      acc += L.thicknessMm;
    }
    return out;
  }, [layers]);

  return (
    <>
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${px(svgWmm)} ${px(svgHmm)}`}
            style={{ width: "min(80vmin, 720px)", height: "min(80vmin, 720px)" }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Layer slabs */}
            {layers.map((L, i) => (
              <g key={L.id}>
                <rect
                  x={0}
                  y={px(yOffsets[i].y0)}
                  width={px(svgWmm)}
                  height={px(yOffsets[i].y1 - yOffsets[i].y0)}
                  fill={L.fluid.color}
                  fillOpacity={0.18}
                  stroke={L.fluid.color}
                  strokeOpacity={0.5}
                />
                <text
                  x={6}
                  y={px((yOffsets[i].y0 + yOffsets[i].y1) / 2) + 4}
                  fontSize="10"
                  fill="#ffffff"
                  fontFamily="monospace"
                  opacity={0.9}
                >
                  {L.fluid.label}
                </text>
                <text
                  x={px(svgWmm) - 6}
                  y={px((yOffsets[i].y0 + yOffsets[i].y1) / 2) + 4}
                  fontSize="9"
                  fill="#ffffff"
                  fontFamily="monospace"
                  textAnchor="end"
                  opacity={0.7}
                >
                  n₅₅₀ = {refractiveIndex(L.fluid, 550).toFixed(3)} · {L.thicknessMm} mm
                </text>
              </g>
            ))}

            {/* Top and bottom air bands */}
            <rect x={0} y={0} width={px(svgWmm)} height={px(4)} fill="#000" fillOpacity={0.5} />
            <rect
              x={0}
              y={px(svgHmm - 4)}
              width={px(svgWmm)}
              height={px(4)}
              fill="#000"
              fillOpacity={0.5}
            />
            <text x={6} y={14} fontSize="10" fill="#9ad3ff" fontFamily="monospace" opacity={0.9}>incident sky</text>
            <text x={6} y={px(svgHmm) - 4} fontSize="10" fill="#9ad3ff" fontFamily="monospace" opacity={0.9}>focal plane</text>

            {/* Wavelength rays */}
            {traces.map((t) => (
              <g key={t.lambda}>
                <polyline
                  points={t.pts.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={1.2}
                  strokeOpacity={0.95}
                />
                {/* Mark each interface waypoint with a small dot */}
                {t.pts.slice(1, -1).map((p, i) => (
                  <circle key={i} cx={px(p.x)} cy={px(p.y)} r={1.6} fill={t.color} />
                ))}
                {/* Output label */}
                {t.pts.length > 0 && (
                  <text
                    x={px(t.pts[t.pts.length - 1].x)}
                    y={px(svgHmm) - 6}
                    fontSize="8"
                    fill={t.color}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {t.lambda}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      <BackToHub />
      <InstrumentTitle name="Stacked-Fluid Telescope" />
      <IdleHint text="add · remove · reorder layers · sweep angle of incidence" />

      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none max-w-[300px]">
        <div>{layers.length} layers · θ₀ = {theta0Deg}°</div>
        <div className="text-white/50">5 wavelengths traced (400, 480, 550, 620, 700 nm)</div>
        <div className="text-white/50">δθ grid: {DTHETA_GRID_OPTIONS[dthetaIdx].label}</div>
      </div>

      <CollapsiblePanel side="left" label="stack + controls" defaultOpen={true}>
        <div className="space-y-3 text-xs font-mono">
          <p className="text-sm font-bold">Stack</p>
          <p className="text-[10px] text-white/60 leading-snug">
            Each layer is a wavelength-indexed transfer tensor A^λ. Spectral
            Separability (scattering-puzzle.tex §7.2): if the stacked A_λ are
            linearly independent, the stack itself is a hyperspectral
            spectrometer — no separate dispersive element needed.
          </p>

          <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
            {layers.map((L, i) => (
              <LayerRow
                key={L.id}
                layer={L}
                index={i}
                onChange={(next) => setLayers(layers.map((x) => (x.id === L.id ? next : x)))}
                onMoveUp={() => i > 0 && setLayers(swap(layers, i, i - 1))}
                onMoveDown={() => i < layers.length - 1 && setLayers(swap(layers, i, i + 1))}
                onRemove={() => setLayers(layers.filter((_, k) => k !== i))}
              />
            ))}
          </div>
          <button
            className="w-full bg-white/10 hover:bg-white/20 rounded px-2 py-1 text-[11px]"
            onClick={() => setLayers([
              ...layers,
              {
                id: "L" + (Date.now() & 0xffff).toString(16),
                fluid: FLUID_LIBRARY.water,
                thicknessMm: 4,
              },
            ])}
          >+ add layer</button>

          <div className="border-t border-white/10 pt-2 space-y-2">
            <div>
              <div className="flex justify-between"><span>Angle of incidence θ₀</span><span className="text-amber-300">{theta0Deg}°</span></div>
              <input
                type="range" min={0} max={70} step={1}
                value={theta0Deg}
                onChange={(e) => setTheta0Deg(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex justify-between"><span>Discrete-Snell grid δθ</span><span className="text-amber-300">{DTHETA_GRID_OPTIONS[dthetaIdx].label}</span></div>
              <input
                type="range" min={0} max={DTHETA_GRID_OPTIONS.length - 1} step={1}
                value={dthetaIdx}
                onChange={(e) => setDthetaIdx(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showDiscrete} onChange={(e) => setShowDiscrete(e.target.checked)} />
              <span>Categorical (discrete) refraction</span>
            </label>
          </div>

          <div className="border-t border-white/10 pt-2 text-[10px] text-white/60 leading-snug">
            <p>Coarser δθ snaps refraction angles to a categorical grid — the
              ray paths become piecewise-stepped. See scattering-puzzle.tex §2.2
              &ldquo;Discrete Snell Transition&rdquo;.</p>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel side="right" label="observables" defaultOpen={true}>
        <div className="text-xs font-mono space-y-4">
          <div>
            <p className="text-sm font-bold mb-2">Derived observables</p>
            <p className="text-white/50 mb-2 text-[10px]">
              Live derivations from the current stack at λ = 550 nm. Rank of
              A_λ caps the number of separable wavelength channels.
            </p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/15 text-white/50 text-left text-[10px]">
                  <th className="py-1 pr-2 font-normal">Quantity</th>
                  <th className="py-1 pr-2 font-normal text-right">Value</th>
                  <th className="py-1 font-normal text-right">unit</th>
                </tr>
              </thead>
              <tbody>
                {observables.map((o) => (
                  <tr key={o.name} className="border-b border-white/10">
                    <td className="py-1 pr-2">{o.name}</td>
                    <td className="py-1 pr-2 text-right">{formatNum(o.derived)}</td>
                    <td className="py-1 text-right text-white/50">{o.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/15 pt-3">
            <p className="text-sm font-bold mb-2">Per-wavelength dispersion</p>
            <DispersionChart layers={layers} />
          </div>

          <div className="border-t border-white/15 pt-3">
            <p className="text-sm font-bold mb-2">Chart</p>
            <ObservablesChart rows={observables} height={220} />
          </div>

          <div className="border-t border-white/15 pt-3 text-[10px] text-white/60">
            <p className="text-white/85 font-bold mb-1">Framework refs</p>
            <p>scattering-puzzle.tex §2.2 Discrete Snell Transition</p>
            <p>scattering-puzzle.tex §7.2 Spectral Transfer Tensor</p>
            <p>scattering-puzzle.tex §3.3 Scattering Enhancement Corollary</p>
            <p>molecular-harmonic-resonator.tex §5.3 Virtual Resonant Cavity</p>
            <p>mass-transfer-mechanisms.tex Light as Partition Mediator</p>
          </div>
        </div>
      </CollapsiblePanel>
    </>
  );
}

function LayerRow({ layer, index, onChange, onMoveUp, onMoveDown, onRemove }) {
  return (
    <div className="border border-white/10 rounded p-2 space-y-1 bg-white/5">
      <div className="flex items-center gap-2">
        <span className="text-white/40">{index + 1}.</span>
        <select
          className="flex-1 bg-black/40 border border-white/15 rounded px-1 py-0.5 text-[11px]"
          value={Object.keys(FLUID_LIBRARY).find((k) => FLUID_LIBRARY[k] === layer.fluid) ?? "water"}
          onChange={(e) => onChange({ ...layer, fluid: FLUID_LIBRARY[e.target.value] })}
        >
          {Object.entries(FLUID_LIBRARY).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={onMoveUp}   className="text-white/60 hover:text-white px-1">↑</button>
        <button onClick={onMoveDown} className="text-white/60 hover:text-white px-1">↓</button>
        <button onClick={onRemove}   className="text-red-400/80 hover:text-red-400 px-1">×</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-[10px] w-12">d (mm)</span>
        <input
          type="range" min={1} max={20} step={0.5}
          value={layer.thicknessMm}
          onChange={(e) => onChange({ ...layer, thicknessMm: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="text-amber-300 text-[10px] w-8 text-right">{layer.thicknessMm}</span>
      </div>
    </div>
  );
}

function DispersionChart({ layers }) {
  const data = useMemo(() => {
    const lambdas = [];
    for (let l = 380; l <= 720; l += 10) lambdas.push(l);
    return lambdas.map((lambda) => {
      const n = layers.reduce((s, L) => s + refractiveIndex(L.fluid, lambda) * L.thicknessMm, 0) /
        layers.reduce((s, L) => s + L.thicknessMm, 0);
      return { lambda, n };
    });
  }, [layers]);
  if (data.length === 0) return null;
  const w = 320, h = 140;
  const margin = { top: 8, right: 12, bottom: 22, left: 32 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;
  const xs = data.map((d) => d.lambda);
  const ys = data.map((d) => d.n);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 0.005, yMax = Math.max(...ys) + 0.005;
  const sx = (v) => ((v - xMin) / (xMax - xMin)) * innerW;
  const sy = (v) => innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${sx(d.lambda)},${sy(d.n)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: `${h}px` }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="rgba(255,255,255,0.3)" />
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="rgba(255,255,255,0.3)" />
        <path d={pathD} fill="none" stroke="#a3e635" strokeWidth={1.5} />
        {LAMBDA_TRACERS.map((t) => (
          <line key={t.lambda} x1={sx(t.lambda)} y1={0} x2={sx(t.lambda)} y2={innerH}
                stroke={t.color} strokeOpacity={0.4} strokeDasharray="2 3" />
        ))}
        <text x={innerW / 2} y={innerH + 16} fill="rgba(255,255,255,0.55)" fontSize="9" textAnchor="middle">λ (nm)</text>
        <text x={-innerH / 2} y={-22} transform="rotate(-90)" fill="rgba(255,255,255,0.55)" fontSize="9" textAnchor="middle">⟨n⟩ stack</text>
        <text x={0} y={-2} fill="rgba(255,255,255,0.55)" fontSize="8">{yMin.toFixed(3)} – {yMax.toFixed(3)}</text>
      </g>
    </svg>
  );
}

function swap(arr, i, j) { const out = arr.slice(); [out[i], out[j]] = [out[j], out[i]]; return out; }

function formatNum(x) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  if (ax === 0) return "0";
  if (ax >= 1000) return x.toFixed(0);
  if (ax >= 1)    return x.toFixed(3);
  if (ax >= 0.01) return x.toFixed(4);
  return x.toExponential(2);
}
