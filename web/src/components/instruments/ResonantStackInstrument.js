import { useMemo, useState, useEffect } from "react";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";

// ─── Physical constant ────────────────────────────────────────────────────────
const C_UM_PS = 299792.458; // speed of light in μm ps⁻¹

// ─── Five-fluid canonical stack (from the resonant-stack paper) ───────────────
const FLUIDS = {
  water:    { label: "water",    A: 1.3210, B: 0.00640, color: "#60a5fa", d_um: 50000 },
  glycerol: { label: "glycerol", A: 1.4590, B: 0.00580, color: "#34d399", d_um: 50000 },
  ethanol:  { label: "ethanol",  A: 1.3550, B: 0.00530, color: "#fbbf24", d_um: 50000 },
  benzene:  { label: "benzene",  A: 1.4870, B: 0.00900, color: "#f87171", d_um: 50000 },
  cs2:      { label: "CS₂",     A: 1.5940, B: 0.01250, color: "#c084fc", d_um: 50000 },
};

// Five canonical wavelengths with spectral colours
const WAVELENGTHS = [
  { nm: 400, color: "#7c3aed" },
  { nm: 480, color: "#3b82f6" },
  { nm: 550, color: "#22c55e" },
  { nm: 620, color: "#f97316" },
  { nm: 700, color: "#ef4444" },
];

// ─── Physics ──────────────────────────────────────────────────────────────────
function cauchyN(A, B, lamNm) {
  return A + B / (lamNm / 1000) ** 2;
}

function roundTripDelay(fluidKeys, lamNm) {
  // Single-loop OPL delay (ps) at normal incidence
  let L = 0;
  for (const key of fluidKeys) {
    const f = FLUIDS[key];
    L += 2 * f.d_um * cauchyN(f.A, f.B, lamNm);
  }
  return L / C_UM_PS;
}

// Residue fraction and cavity finesse (base 3, dimension 3)
const F_R = 26 / 27;
const FINESSE = (Math.PI * Math.sqrt(F_R)) / (1 - F_R);

// ─── SVG scale helper ─────────────────────────────────────────────────────────
function sc(v, d0, d1, r0, r1) {
  return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

// ─── Cauchy dispersion plot ───────────────────────────────────────────────────
const LAM_SAMPLES = Array.from({ length: 80 }, (_, i) => 380 + (i / 79) * 370);
const LAM_RANGE = [380, 750];

function DispersionPlot({ activeKeys }) {
  const N_MIN = 1.28, N_MAX = 1.70;
  const pad = { l: 46, r: 56, t: 28, b: 40 };
  const W = 480, H = 320;
  const px = (lam) => sc(lam, LAM_RANGE[0], LAM_RANGE[1], pad.l, W - pad.r);
  const py = (n)   => sc(n,   N_MIN,        N_MAX,        H - pad.b, pad.t);

  const nTicks = [1.30, 1.35, 1.40, 1.45, 1.50, 1.55, 1.60, 1.65];
  const lTicks = [400, 450, 500, 550, 600, 650, 700];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="rsi-spec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.18} />
          <stop offset="25%"  stopColor="#3b82f6" stopOpacity={0.18} />
          <stop offset="50%"  stopColor="#22c55e" stopOpacity={0.18} />
          <stop offset="75%"  stopColor="#f97316" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.18} />
        </linearGradient>
        <clipPath id="rsi-clip">
          <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} />
        </clipPath>
      </defs>

      {/* Spectrum band background */}
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b}
            fill="url(#rsi-spec)" rx={2} />

      {/* Grid */}
      {nTicks.map((n) => (
        <line key={n} x1={pad.l} y1={py(n)} x2={W - pad.r} y2={py(n)}
              stroke="#ffffff0e" strokeWidth={1} />
      ))}

      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />

      {/* Y ticks + labels */}
      {nTicks.map((n) => (
        <g key={n}>
          <line x1={pad.l - 4} y1={py(n)} x2={pad.l} y2={py(n)} stroke="#ffffff50" strokeWidth={1} />
          <text x={pad.l - 7} y={py(n)} textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill="#ffffff70" fontFamily="monospace">{n.toFixed(2)}</text>
        </g>
      ))}
      <text x={12} y={H / 2} textAnchor="middle" fontSize={10} fill="#ffffff60"
            fontFamily="monospace" transform={`rotate(-90,12,${H / 2})`}>n(λ)</text>

      {/* X ticks + labels */}
      {lTicks.map((lam) => (
        <g key={lam}>
          <line x1={px(lam)} y1={H - pad.b} x2={px(lam)} y2={H - pad.b + 4}
                stroke="#ffffff50" strokeWidth={1} />
          <text x={px(lam)} y={H - pad.b + 14} textAnchor="middle"
                fontSize={9} fill="#ffffff70" fontFamily="monospace">{lam}</text>
        </g>
      ))}
      <text x={pad.l + (W - pad.l - pad.r) / 2} y={H - 3} textAnchor="middle"
            fontSize={10} fill="#ffffff60" fontFamily="monospace">λ (nm)</text>

      {/* Wavelength markers */}
      {WAVELENGTHS.map((w) => (
        <line key={w.nm} x1={px(w.nm)} y1={pad.t} x2={px(w.nm)} y2={H - pad.b}
              stroke={w.color} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.55} />
      ))}

      {/* Dispersion curves */}
      {Object.entries(FLUIDS).map(([key, f]) => {
        const active = activeKeys.has(key);
        const pts = LAM_SAMPLES
          .map((lam) => `${px(lam).toFixed(1)},${py(cauchyN(f.A, f.B, lam)).toFixed(1)}`)
          .join(" ");
        const nAtEdge = cauchyN(f.A, f.B, 750);
        return (
          <g key={key} opacity={active ? 1 : 0.18} style={{ transition: "opacity 0.3s" }}>
            <polyline points={pts} fill="none" stroke={f.color} strokeWidth={2.2} />
            <text x={px(750) + 4} y={py(nAtEdge)} dominantBaseline="middle"
                  fontSize={9} fill={f.color} fontFamily="monospace">{f.label}</text>
          </g>
        );
      })}

      <text x={pad.l + (W - pad.l - pad.r) / 2} y={pad.t - 10} textAnchor="middle"
            fontSize={11} fill="#ffffffbb" fontFamily="monospace" fontWeight="bold">
        Cauchy Dispersion
      </text>
    </svg>
  );
}

// ─── Temporal echo delay plot ─────────────────────────────────────────────────
function EchoDelayPlot({ activeKeys, nLoops }) {
  const pad = { l: 52, r: 18, t: 28, b: 40 };
  const W = 460, H = 320;

  const fluidKeys = [...activeKeys];

  const curves = useMemo(() =>
    WAVELENGTHS.map((w) => {
      const tau0 = fluidKeys.length ? roundTripDelay(fluidKeys, w.nm) : 0;
      return {
        ...w,
        tau0,
        delays: Array.from({ length: nLoops }, (_, i) => (i + 1) * tau0),
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKeys, nLoops]
  );

  const allDelays = curves.flatMap((c) => c.delays).filter(isFinite);
  const dMin = allDelays.length ? Math.min(...allDelays) : 0;
  const dMax = allDelays.length ? Math.max(...allDelays) : 1;
  const pad_y = (dMax - dMin) * 0.12 + 0.001;
  const TAU_RANGE = [dMin - pad_y, dMax + pad_y];
  const tauSpan = TAU_RANGE[1] - TAU_RANGE[0];
  const tauDec = tauSpan < 0.5 ? 2 : tauSpan < 5 ? 1 : 0;

  const px = (nl)  => sc(nl,          1,           nLoops,        pad.l, W - pad.r);
  const py = (tau) => sc(tau, TAU_RANGE[0], TAU_RANGE[1], H - pad.b, pad.t);

  const loopCount = Math.min(nLoops, 10);
  const loopTicks = Array.from({ length: loopCount }, (_, i) =>
    Math.round(1 + (i / (loopCount - 1)) * (nLoops - 1))
  );
  const tauTicks = Array.from({ length: 5 }, (_, i) =>
    TAU_RANGE[0] + (i / 4) * (TAU_RANGE[1] - TAU_RANGE[0])
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ overflow: "visible" }}>
      {/* Grid */}
      {tauTicks.map((t, i) => (
        <line key={i} x1={pad.l} y1={py(t)} x2={W - pad.r} y2={py(t)}
              stroke="#ffffff0e" strokeWidth={1} />
      ))}

      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />

      {/* Y ticks + labels */}
      {tauTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l - 4} y1={py(t)} x2={pad.l} y2={py(t)} stroke="#ffffff50" strokeWidth={1} />
          <text x={pad.l - 7} y={py(t)} textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill="#ffffff70" fontFamily="monospace">{t.toFixed(tauDec)}</text>
        </g>
      ))}
      <text x={12} y={H / 2} textAnchor="middle" fontSize={10} fill="#ffffff60"
            fontFamily="monospace" transform={`rotate(-90,12,${H / 2})`}>Δτ (ps)</text>

      {/* X ticks + labels */}
      {loopTicks.map((nl) => (
        <g key={nl}>
          <line x1={px(nl)} y1={H - pad.b} x2={px(nl)} y2={H - pad.b + 4}
                stroke="#ffffff50" strokeWidth={1} />
          <text x={px(nl)} y={H - pad.b + 14} textAnchor="middle"
                fontSize={9} fill="#ffffff70" fontFamily="monospace">{nl}</text>
        </g>
      ))}
      <text x={pad.l + (W - pad.l - pad.r) / 2} y={H - 3} textAnchor="middle"
            fontSize={10} fill="#ffffff60" fontFamily="monospace">loop count n_ℓ</text>

      {/* Echo delay curves */}
      {curves.map((c) => {
        const pts = c.delays
          .map((tau, i) => `${px(i + 1).toFixed(1)},${py(tau).toFixed(1)}`)
          .join(" ");
        return (
          <g key={c.nm}>
            <polyline points={pts} fill="none" stroke={c.color} strokeWidth={2.2} opacity={0.9} />
            <circle cx={px(nLoops)} cy={py(c.delays[nLoops - 1])} r={3}
                    fill={c.color} opacity={0.9} />
            <text x={px(nLoops) + 5} y={py(c.delays[nLoops - 1])} dominantBaseline="middle"
                  fontSize={8} fill={c.color} fontFamily="monospace">{c.nm}nm</text>
          </g>
        );
      })}

      <text x={pad.l + (W - pad.l - pad.r) / 2} y={pad.t - 10} textAnchor="middle"
            fontSize={11} fill="#ffffffbb" fontFamily="monospace" fontWeight="bold">
        Temporal Echo Delays
      </text>
    </svg>
  );
}

// ─── Triple identity mini-plot ────────────────────────────────────────────────
function TripleIdentityPlot({ alphaL }) {
  const pad = { l: 38, r: 12, t: 20, b: 32 };
  const W = 320, H = 160;

  const samples = Array.from({ length: 120 }, (_, i) => {
    const logAL = -3 + (i / 119) * 4; // log10(αL) from -3 to +1
    return { al: 10 ** logAL, T: Math.exp(-(10 ** logAL)) };
  });

  const px = (al)  => sc(Math.log10(al), -3, 1, pad.l, W - pad.r);
  const py = (T)   => sc(T, 0, 1, H - pad.b, pad.t);

  const curALlog = Math.log10(Math.max(alphaL, 1e-3));
  const curT = Math.exp(-alphaL);
  const xMark = sc(curALlog, -3, 1, pad.l, W - pad.r);
  const yMark = py(curT);

  const xTicks = [-3, -2, -1, 0, 1];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#ffffff35" strokeWidth={1} />

      {/* Y ticks */}
      {yTicks.map((T) => (
        <g key={T}>
          <line x1={pad.l - 3} y1={py(T)} x2={pad.l} y2={py(T)} stroke="#ffffff40" strokeWidth={1} />
          <text x={pad.l - 5} y={py(T)} textAnchor="end" dominantBaseline="middle"
                fontSize={8} fill="#ffffff60" fontFamily="monospace">{T.toFixed(2)}</text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map((exp) => (
        <g key={exp}>
          <line x1={sc(exp, -3, 1, pad.l, W - pad.r)} y1={H - pad.b}
                x2={sc(exp, -3, 1, pad.l, W - pad.r)} y2={H - pad.b + 3}
                stroke="#ffffff40" strokeWidth={1} />
          <text x={sc(exp, -3, 1, pad.l, W - pad.r)} y={H - pad.b + 12}
                textAnchor="middle" fontSize={8} fill="#ffffff60" fontFamily="monospace">
            10^{exp}
          </text>
        </g>
      ))}

      {/* The curve — all three arms are identical */}
      <polyline
        points={samples.map((s) => `${px(s.al).toFixed(1)},${py(s.T).toFixed(1)}`).join(" ")}
        fill="none" stroke="#60a5fa" strokeWidth={2} opacity={0.9}
      />

      {/* Current αL marker */}
      <line x1={xMark} y1={pad.t} x2={xMark} y2={H - pad.b}
            stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
      <circle cx={xMark} cy={yMark} r={4} fill="#fbbf24" />

      <text x={pad.l + (W - pad.l - pad.r) / 2} y={pad.t - 7} textAnchor="middle"
            fontSize={9} fill="#ffffffaa" fontFamily="monospace" fontWeight="bold">
        Triple Identity — T(αL)
      </text>
      <text x={W - pad.r} y={H - pad.b - 4} textAnchor="end"
            fontSize={7.5} fill="#ffffff50" fontFamily="monospace">log₁₀(αL)</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ResonantStackInstrument() {
  const [activeKeys, setActiveKeys] = useState(new Set(Object.keys(FLUIDS)));
  const [nLoops, setNLoops] = useState(20);
  const [alphaL, setAlphaL] = useState(1.0);
  const [nComp, setNComp] = useState(10);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggleFluid(key) {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const curT = Math.exp(-alphaL);
  const curMobile = 1 / (1 + (Math.exp(alphaL) - 1));
  const inflation = 3 * Math.pow(4, nComp - 1);
  const redundancyBits = Math.log2(Math.max(1, inflation / 5));

  return (
    <>
      <div className="fixed inset-0"
           style={{ background: "radial-gradient(ellipse at center, #06091a 0%, #000000 100%)" }}>
        {size.w > 0 && (
          <div className="absolute inset-0 flex items-center justify-center gap-4 px-4"
               style={{ paddingTop: 56, paddingBottom: 24 }}>
            <div style={{ flex: 1, height: "100%", minWidth: 0 }}>
              <DispersionPlot activeKeys={activeKeys} />
            </div>
            <div style={{ flex: 1, height: "100%", minWidth: 0 }}>
              <EchoDelayPlot activeKeys={activeKeys} nLoops={nLoops} />
            </div>
          </div>
        )}
      </div>

      <BackToHub />
      <InstrumentTitle name="Resonant Stack" />
      <IdleHint text="toggle fluids · adjust controls in side panels" />

      {/* ── Left panel: stack controls ─────────────────────────────────────── */}
      <CollapsiblePanel side="left" label="stack" defaultOpen={true}>
        <div className="space-y-4 text-xs font-mono text-white">
          <p className="text-sm font-bold">Fluid stack</p>
          <p className="text-[10px] text-white/50 leading-snug">
            Five Cauchy fluids. Each contributes a distinct dispersion curve
            n(λ) = A + B/λ². Unchecked fluids appear dimmed.
          </p>

          <div className="space-y-1.5">
            {Object.entries(FLUIDS).map(([key, f]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={activeKeys.has(key)}
                       onChange={() => toggleFluid(key)} />
                <span style={{ color: f.color }}>{f.label}</span>
                <span className="text-white/40 ml-auto">A={f.A} B={f.B}</span>
              </label>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <label className="flex items-center justify-between">
              <span>Loop count n_ℓ</span>
              <span className="text-white/60">{nLoops}</span>
            </label>
            <input type="range" min={1} max={40} value={nLoops}
                   onChange={(e) => setNLoops(Number(e.target.value))}
                   className="w-full accent-blue-400" />
          </div>

          <div className="border-t border-white/10 pt-3 space-y-1 text-[10px] text-white/60">
            <div className="flex justify-between">
              <span>Residue fraction f_R</span>
              <span className="text-white/80">{F_R.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cavity finesse ℱ</span>
              <span className="text-white/80">{FINESSE.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Transfer rank</span>
              <span className="text-green-400">5 / 5</span>
            </div>
          </div>
        </div>
      </CollapsiblePanel>

      {/* ── Right panel: physics panels ────────────────────────────────────── */}
      <CollapsiblePanel side="right" label="physics" defaultOpen={true}>
        <div className="space-y-4 text-xs font-mono text-white w-[320px]">
          {/* Triple identity */}
          <div>
            <p className="text-sm font-bold mb-1">Triple Observation Identity</p>
            <p className="text-[10px] text-white/50 leading-snug mb-2">
              Beer–Lambert, chromatographic, and Kirchhoff are the same function.
              All three curves are numerically identical.
            </p>
            <TripleIdentityPlot alphaL={alphaL} />
            <label className="flex items-center justify-between mt-2">
              <span className="text-white/60">αL</span>
              <span className="text-amber-400">{alphaL.toFixed(3)}</span>
            </label>
            <input type="range" min={-30} max={23} step={1}
                   value={Math.round(Math.log(alphaL) / Math.log(10) * 10)}
                   onChange={(e) => {
                     const logVal = Number(e.target.value) / 10;
                     setAlphaL(parseFloat((10 ** logVal).toFixed(5)));
                   }}
                   className="w-full accent-amber-400" />
            <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
              <div className="text-center">
                <div className="text-white/40">Beer–Lambert</div>
                <div className="text-blue-400">{curT.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-white/40">Chromato.</div>
                <div className="text-blue-400">{curMobile.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-white/40">Kirchhoff</div>
                <div className="text-blue-400">{curT.toFixed(4)}</div>
              </div>
            </div>
          </div>

          {/* Composition inflation */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-sm font-bold mb-1">Composition Inflation</p>
            <p className="text-[10px] text-white/50 leading-snug mb-2">
              T(n,3) = 3 · 4^(n−1) trajectories at depth n.
            </p>
            <label className="flex items-center justify-between">
              <span className="text-white/60">Partition depth n</span>
              <span className="text-purple-400">{nComp}</span>
            </label>
            <input type="range" min={1} max={15} value={nComp}
                   onChange={(e) => setNComp(Number(e.target.value))}
                   className="w-full accent-purple-400 mt-1" />
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
              <div>
                <div className="text-white/40">T(n,3)</div>
                <div className="text-purple-400">{inflation.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-white/40">Redundancy</div>
                <div className="text-purple-400">{redundancyBits.toFixed(1)} bits</div>
              </div>
              <div>
                <div className="text-white/40">f_R = 26/27</div>
                <div className="text-green-400">{(F_R * 100).toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-white/40">Finesse ℱ</div>
                <div className="text-green-400">{FINESSE.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>
      </CollapsiblePanel>
    </>
  );
}
