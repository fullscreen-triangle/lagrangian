/**
 * Lightweight SVG chart for derived-vs-observed observables.
 * Two views: bars of |% error| and a derived/observed scatter on log scale.
 * Pure SVG — no chart library. Renders on white-on-black at any size.
 */

import { useMemo, useState } from "react";

export default function ObservablesChart({ rows, height = 200 }) {
  const [view, setView] = useState("error");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] font-mono">
        <button
          onClick={() => setView("error")}
          className={`px-2 py-0.5 rounded ${view === "error" ? "bg-white/20 text-white" : "bg-white/5 text-white/60"}`}
        >% error</button>
        <button
          onClick={() => setView("scatter")}
          className={`px-2 py-0.5 rounded ${view === "scatter" ? "bg-white/20 text-white" : "bg-white/5 text-white/60"}`}
        >derived vs observed</button>
      </div>
      {view === "error" ? <ErrorBars rows={rows} height={height} /> : <DerivedVsObserved rows={rows} height={height} />}
    </div>
  );
}

function ErrorBars({ rows, height }) {
  const data = useMemo(() => rows.map((r) => ({
    name: r.name,
    err: Math.min(50, r.error * 100), // cap display at 50%
    real: r.error * 100,
  })), [rows]);
  const w = 320;
  const margin = { top: 8, right: 50, bottom: 8, left: 130 };
  const innerH = height - margin.top - margin.bottom;
  const innerW = w - margin.left - margin.right;
  const barH = innerH / data.length;
  const xMax = 50;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ maxHeight: `${height}px` }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {[0, 5, 25, 50].map((tick) => (
          <g key={tick}>
            <line
              x1={(tick / xMax) * innerW} x2={(tick / xMax) * innerW}
              y1={0} y2={innerH}
              stroke="rgba(255,255,255,0.08)"
            />
            <text
              x={(tick / xMax) * innerW} y={innerH + 8}
              fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle"
            >{tick}{tick === xMax ? "+" : ""}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const y = i * barH + 1;
          const bw = (d.err / xMax) * innerW;
          const colour = d.real < 1 ? "#34d399" : d.real < 5 ? "#a3e635" : d.real < 15 ? "#fbbf24" : "#f87171";
          return (
            <g key={d.name}>
              <text x={-4} y={y + barH / 2 + 3} fill="rgba(255,255,255,0.7)" fontSize="9" textAnchor="end">
                {truncate(d.name, 22)}
              </text>
              <rect x={0} y={y} width={Math.max(1, bw)} height={Math.max(2, barH - 2)} fill={colour} opacity={0.85} rx={1} />
              <text x={bw + 4} y={y + barH / 2 + 3} fill="rgba(255,255,255,0.6)" fontSize="8" textAnchor="start">
                {d.real.toFixed(d.real < 1 ? 2 : 1)}%
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function DerivedVsObserved({ rows, height }) {
  const data = useMemo(() => rows
    .filter((r) => Number.isFinite(r.derived) && Number.isFinite(r.observed) && r.derived > 0 && r.observed > 0)
    .map((r) => ({ x: Math.log10(r.observed), y: Math.log10(r.derived), name: r.name, err: r.error })),
    [rows]
  );
  const w = 320;
  const margin = { top: 10, right: 12, bottom: 22, left: 30 };
  const innerH = height - margin.top - margin.bottom;
  const innerW = w - margin.left - margin.right;
  const allVals = data.flatMap((d) => [d.x, d.y]);
  const lo = Math.floor(Math.min(...allVals));
  const hi = Math.ceil(Math.max(...allVals));
  const span = Math.max(1, hi - lo);
  const sx = (v) => ((v - lo) / span) * innerW;
  const sy = (v) => innerH - ((v - lo) / span) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ maxHeight: `${height}px` }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="rgba(255,255,255,0.3)" />
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="rgba(255,255,255,0.3)" />
        {data.map((d) => {
          const colour = d.err < 0.01 ? "#34d399" : d.err < 0.05 ? "#a3e635" : d.err < 0.15 ? "#fbbf24" : "#f87171";
          return <circle key={d.name} cx={sx(d.x)} cy={sy(d.y)} r={3.5} fill={colour} opacity={0.9}>
            <title>{d.name}: derived 10^{d.y.toFixed(2)} vs observed 10^{d.x.toFixed(2)}</title>
          </circle>;
        })}
        <text x={innerW / 2} y={innerH + 16} fill="rgba(255,255,255,0.55)" fontSize="9" textAnchor="middle">log₁₀ observed</text>
        <text x={-innerH / 2} y={-20} transform="rotate(-90)" fill="rgba(255,255,255,0.55)" fontSize="9" textAnchor="middle">log₁₀ derived</text>
      </g>
    </svg>
  );
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
