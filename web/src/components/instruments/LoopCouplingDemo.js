import { useCallback, useEffect, useMemo, useState } from "react";
import {
  harmonicGraph,
  cycleRank,
  fundamentalCycles,
  buildTransferMatrix,
  solveLeastSquares,
  conditionNumber,
  edgeFreq,
  MOLECULE_PRESETS,
} from "@/lib/loop-coupling";

function randomDirection(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  const a = (s - Math.floor(s)) * Math.PI * 2;
  const b = ((s * 1.3) - Math.floor(s * 1.3)) * Math.PI - Math.PI / 2;
  return [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
}

export default function LoopCouplingDemo() {
  const [molecule, setMolecule] = useState("Benzene");
  const [nSources, setNSources] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(-6);
  const [result, setResult] = useState(null);

  const omega = MOLECULE_PRESETS[molecule];

  const graph = useMemo(() => {
    const edges = harmonicGraph(omega);
    const C = cycleRank(omega.length, edges);
    const cycles = fundamentalCycles(omega.length, edges);
    return { edges, C, cycles };
  }, [molecule]);

  // Auto-set source count to C+1
  useEffect(() => {
    setNSources(graph.C + 1);
  }, [graph.C]);

  const run = useCallback(() => {
    const sigma = Math.pow(10, noiseLevel);
    const K = Math.min(nSources, graph.C + 1);
    if (K < 1) return;

    const meanOmega = omega.reduce((a, b) => a + b, 0) / omega.length;
    const sources = Array.from({ length: K }, (_, k) => ({
      direction: randomDirection(k + 7),
      wavelength: (1.0 / (meanOmega * 1e-4)) * (0.7 + 0.6 * k / Math.max(K - 1, 1)),
      trueAmplitude: 1.0,
    }));

    const A = buildTransferMatrix(omega, graph.edges, sources);
    const sTrue = sources.map((s) => s.trueAmplitude);
    const IClean = A.map((row) =>
      row.reduce((sum, a, k) => sum + a * sTrue[k], 0)
    );
    const noise = IClean.map(() => (Math.random() - 0.5) * 2 * sigma);
    const INoisy = IClean.map((v, i) => v + noise[i] * Math.abs(v));

    const sHat = solveLeastSquares(A, INoisy);
    const errNorm = Math.sqrt(
      sTrue.reduce((s, v, i) => s + (v - sHat[i]) ** 2, 0)
    );
    const trueNorm = Math.sqrt(sTrue.reduce((s, v) => s + v ** 2, 0));
    const kappa = conditionNumber(A);

    setResult({
      K,
      C: graph.C,
      kappa,
      sigma,
      error: errNorm / trueNorm,
      sTrue,
      sHat,
      edgeFreqs: graph.edges.map((e) => edgeFreq(e, omega).toFixed(0)),
      edgeDeltas: graph.edges.map((e) => e.delta.toExponential(2)),
    });
  }, [omega, graph, nSources, noiseLevel]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Controls */}
      <div className="grid grid-cols-3 gap-4 md:grid-cols-1">
        <div>
          <label className="block text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-1">
            Molecule
          </label>
          <select
            value={molecule}
            onChange={(e) => setMolecule(e.target.value)}
            className="w-full rounded-md border border-dark/30 dark:border-light/30 bg-light dark:bg-dark px-3 py-2 text-sm"
          >
            {Object.keys(MOLECULE_PRESETS).map((m) => (
              <option key={m} value={m}>
                {m} ({MOLECULE_PRESETS[m].length} modes)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-1">
            Sources (K = C+1 = {graph.C + 1} max)
          </label>
          <input
            type="range"
            min={1}
            max={graph.C + 1}
            value={nSources}
            onChange={(e) => setNSources(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-sm font-mono">{nSources}</span>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-1">
            Noise level (log10)
          </label>
          <input
            type="range"
            min={-15}
            max={-1}
            step={1}
            value={noiseLevel}
            onChange={(e) => setNoiseLevel(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-sm font-mono">
            10<sup>{noiseLevel}</sup>
          </span>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 md:grid-cols-2 font-mono text-sm">
            <Card label="Cycle rank C" value={result.C} />
            <Card label="Sources K" value={result.K} />
            <Card
              label="Condition number"
              value={result.kappa.toFixed(1)}
            />
            <Card
              label="Reconstruction error"
              value={result.error.toExponential(2)}
              highlight={result.error < 0.01}
            />
          </div>

          {/* Amplitudes bar chart */}
          <div className="rounded-xl border border-dark/30 dark:border-light/30 p-4">
            <div className="text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-3">
              Source amplitudes (true vs recovered)
            </div>
            <div className="flex items-end gap-2 h-40">
              {result.sTrue.map((v, k) => (
                <div
                  key={k}
                  className="flex flex-col items-center flex-1 gap-1"
                >
                  <div className="flex items-end gap-0.5 w-full h-32">
                    <div
                      className="flex-1 bg-dark dark:bg-light rounded-t"
                      style={{ height: `${Math.abs(v) * 100}%` }}
                    />
                    <div
                      className="flex-1 bg-red-500 rounded-t opacity-70"
                      style={{
                        height: `${Math.min(Math.abs(result.sHat[k]), 2) * 50}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px]">S{k + 1}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-dark dark:bg-light rounded" />
                true
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-500 rounded opacity-70" />
                recovered
              </span>
            </div>
          </div>

          {/* Harmonic edges */}
          <div className="rounded-xl border border-dark/30 dark:border-light/30 p-4">
            <div className="text-xs uppercase tracking-widest text-dark/60 dark:text-light/60 mb-3">
              Harmonic edges ({result.edgeFreqs.length} edges, {result.C} independent loops)
            </div>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-2 font-mono text-xs">
              {result.edgeFreqs.map((f, i) => (
                <div
                  key={i}
                  className="rounded border border-dark/20 dark:border-light/20 px-2 py-1"
                >
                  <span className="font-bold">{f}</span> cm
                  <sup>-1</sup>
                  <span className="ml-2 text-dark/50 dark:text-light/50">
                    {result.edgeDeltas[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="max-w-3xl text-sm text-dark/70 dark:text-light/70">
        This instrument constructs the harmonic graph of the selected
        molecule, builds a transfer matrix through its fundamental cycles
        (one row per cycle + direct path), injects synthetic sources at
        matched wavelengths, adds noise, and reconstructs via
        least-squares inversion. All computation runs in your browser. Drag
        the sliders to change molecule, source count, or noise level; the
        reconstruction updates in real time.
      </p>
    </div>
  );
}

function Card({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        highlight
          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
          : "border-dark/30 dark:border-light/30"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-dark/50 dark:text-light/50">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
