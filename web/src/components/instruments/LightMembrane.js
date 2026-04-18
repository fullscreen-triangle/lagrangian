import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";
import {
  SOURCE_KINDS,
  classifyPixel,
  makeTimeGrid,
  pixelSpectrum,
  skyReferenceModel,
  sourceTimeSeries,
} from "@/lib/light-membrane";

// Sky grid size and temporal sampling
const GRID_W = 96;
const GRID_H = 48;
const N_SAMPLES = 256;
const DURATION_S = 86400; // one simulated day
const N_OMEGA = (N_SAMPLES >> 1) + 1;

// Bands of temporal frequency to expose in the UI (ω index ranges).
const BANDS = [
  { label: "DC (steady)", range: [0, 1] },
  { label: "Diurnal", range: [1, 3] },
  { label: "Slow (mins)", range: [3, 12] },
  { label: "Fast (seconds)", range: [12, 50] },
  { label: "Very fast", range: [50, N_OMEGA] },
];

// ---- Synthetic source catalogue ----

function synthesiseSources() {
  const sources = [];
  // Background stars (200 random DC-dominated sources at random pixels)
  for (let i = 0; i < 200; i++) {
    const ax = (i * 127 + 41) % GRID_W;
    const dx = (i * 89 + 17) % GRID_H;
    sources.push({
      id: `star${i}`,
      kind: "star",
      pixel: [ax, dx],
      flux: 0.5 + ((i * 31) % 100) / 100,
    });
  }
  // Planets
  for (let i = 0; i < 5; i++) {
    sources.push({
      id: `planet${i}`,
      kind: "planet",
      pixel: [10 + i * 18, 22 + (i % 3) * 4],
      flux: 4 + i * 1.2,
      period: 3000 + i * 1200,
    });
  }
  // Pulsars
  for (let i = 0; i < 3; i++) {
    sources.push({
      id: `pulsar${i}`,
      kind: "pulsar",
      pixel: [25 + i * 20, 10 + i * 12],
      flux: 1.2,
      period: 300 + i * 80,
    });
  }
  // Satellites — transits at pseudo-random times
  for (let i = 0; i < 6; i++) {
    const transits = [];
    for (let k = 0; k < 8; k++) transits.push(((i * 23 + k * 41) % DURATION_S));
    sources.push({
      id: `sat${i}`,
      kind: "satellite",
      pixel: [((i * 17) + 8) % GRID_W, (i * 7 + 28) % GRID_H],
      flux: 5.0,
      transits,
    });
  }
  // Exoplanet-transit host stars
  for (let i = 0; i < 2; i++) {
    sources.push({
      id: `exo${i}`,
      kind: "exoplanet",
      pixel: [60 + i * 12, 30 + i * 5],
      flux: 2.5,
      period: 900 + i * 500,
      duration: 90,
    });
  }
  return sources;
}

// ---- Build the membrane (all pixels × all ω) ----

function buildMembrane(sources, sunAlt) {
  const tGrid = makeTimeGrid(DURATION_S, N_SAMPLES);
  const observed = new Array(GRID_H).fill(null).map(() =>
    new Array(GRID_W).fill(null).map(() => new Float32Array(N_SAMPLES))
  );
  const model = new Array(GRID_H).fill(null).map(() =>
    new Array(GRID_W).fill(null).map(() => new Float32Array(N_SAMPLES))
  );

  // Sky reference model per pixel — same for observed and model paths so it cancels
  for (let dy = 0; dy < GRID_H; dy++) {
    const altRad = ((GRID_H - 1 - dy) / GRID_H) * Math.PI; // 0 at bottom, π at top
    for (let dx = 0; dx < GRID_W; dx++) {
      const azRad = (dx / GRID_W) * 2 * Math.PI;
      const skyBase = skyReferenceModel(altRad, azRad, sunAlt);
      // Diurnal modulation
      for (let i = 0; i < N_SAMPLES; i++) {
        const diurnal = 0.3 * Math.sin(2 * Math.PI * i / N_SAMPLES);
        const v = skyBase + diurnal + 0.02 * (Math.random() - 0.5);
        observed[dy][dx][i] = v;
        model[dy][dx][i] = skyBase + diurnal;
      }
    }
  }

  // Inject sources
  for (const src of sources) {
    const [ax, dx] = src.pixel;
    const signal = sourceTimeSeries(src, tGrid);
    for (let i = 0; i < N_SAMPLES; i++) {
      observed[dx][ax][i] += signal[i];
    }
  }

  // Compute per-pixel residual spectrum + classification
  const spectra = new Array(GRID_H).fill(null).map(() => new Array(GRID_W).fill(null));
  const classifications = new Array(GRID_H).fill(null).map(() => new Array(GRID_W).fill(null));
  let maxBandPower = new Float32Array(BANDS.length);
  for (let dy = 0; dy < GRID_H; dy++) {
    for (let dx = 0; dx < GRID_W; dx++) {
      const spec = pixelSpectrum(observed[dy][dx], model[dy][dx]);
      spectra[dy][dx] = spec;
      const cls = classifyPixel(spec);
      classifications[dy][dx] = cls;
      // Track max per band
      BANDS.forEach((b, bi) => {
        let p = 0;
        for (let k = b.range[0]; k < b.range[1] && k < spec.length; k++) p += spec[k];
        if (p > maxBandPower[bi]) maxBandPower[bi] = p;
      });
    }
  }

  return { spectra, classifications, maxBandPower };
}

// ---- The main component ----

export default function LightMembrane() {
  const sources = useMemo(() => synthesiseSources(), []);
  const [sunAlt, setSunAlt] = useState(-0.3); // night-ish
  const [bandIdx, setBandIdx] = useState(0);
  const [showClassified, setShowClassified] = useState(false);
  const [selectedPixel, setSelectedPixel] = useState(null);

  const { spectra, classifications, maxBandPower } = useMemo(
    () => buildMembrane(sources, sunAlt),
    [sources, sunAlt]
  );

  const band = BANDS[bandIdx];
  const maxP = maxBandPower[bandIdx] || 1;

  const canvasRef = useRef(null);

  // Render the band-slice image to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(GRID_W, GRID_H);
    for (let dy = 0; dy < GRID_H; dy++) {
      for (let dx = 0; dx < GRID_W; dx++) {
        let p = 0;
        const spec = spectra[dy][dx];
        for (let k = band.range[0]; k < band.range[1] && k < spec.length; k++) p += spec[k];
        const v = Math.min(1, Math.sqrt(p / maxP));
        const cls = classifications[dy][dx];
        const idx = (dy * GRID_W + dx) * 4;
        if (showClassified && cls.totalPower > maxP * 0.02) {
          // Colour by class
          const c = SOURCE_KINDS[cls.kind]?.color || "#ffffff";
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          img.data[idx] = r * v;
          img.data[idx + 1] = g * v;
          img.data[idx + 2] = b * v;
        } else {
          img.data[idx] = v * 255;
          img.data[idx + 1] = v * 255;
          img.data[idx + 2] = v * 255;
        }
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [spectra, classifications, bandIdx, showClassified, maxP]);

  const onCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const dx = Math.max(0, Math.min(GRID_W - 1, Math.floor(x * GRID_W)));
    const dy = Math.max(0, Math.min(GRID_H - 1, Math.floor(y * GRID_H)));
    setSelectedPixel({ dx, dy });
  };

  // Per-pixel detected sources list (for the classified panel)
  const detected = useMemo(() => {
    if (!showClassified) return [];
    const out = [];
    for (let dy = 0; dy < GRID_H; dy++) {
      for (let dx = 0; dx < GRID_W; dx++) {
        const cls = classifications[dy][dx];
        if (cls.totalPower > maxP * 0.05) {
          out.push({ dx, dy, ...cls });
        }
      }
    }
    return out;
  }, [classifications, showClassified, maxP]);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <canvas
          ref={canvasRef}
          width={GRID_W}
          height={GRID_H}
          onClick={onCanvasClick}
          className="cursor-crosshair"
          style={{
            width: "95vw",
            height: "calc(95vw * 0.5)",
            maxHeight: "90vh",
            maxWidth: "calc(90vh * 2)",
            imageRendering: "pixelated",
          }}
        />
      </div>

      <BackToHub />
      <InstrumentTitle name="Light Membrane" />
      <IdleHint text="click any pixel for its temporal spectrum · switch bands on the left" />

      {/* Top-right status */}
      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none">
        <div>{band.label}</div>
        <div className="text-white/50">ω ∈ [{band.range[0]}, {band.range[1]})</div>
        <div className="text-white/50">
          sun alt {sunAlt > 0 ? "+" : ""}{sunAlt.toFixed(2)}
        </div>
      </div>

      {/* Left: controls */}
      <CollapsiblePanel side="left" label="controls" defaultOpen={true}>
        <div className="space-y-4 text-xs font-mono">
          <p className="text-sm font-bold">View</p>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              temporal-frequency band
            </label>
            <div className="space-y-1">
              {BANDS.map((b, i) => (
                <button
                  key={b.label}
                  onClick={() => setBandIdx(i)}
                  className={`w-full text-left px-2 py-1 rounded border ${
                    bandIdx === i
                      ? "bg-white/20 border-white/40"
                      : "border-white/15 hover:bg-white/10"
                  }`}
                >
                  {b.label}{" "}
                  <span className="text-white/50">[{b.range[0]}, {b.range[1]})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">
              sun altitude ({sunAlt > 0 ? "day" : "night"})
            </label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={sunAlt}
              onChange={(e) => setSunAlt(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-white/50 mt-1">
              the observable spectrum is invariant to this slider — moving it
              only changes the reference model, not the recovered field
            </div>
          </div>
          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showClassified}
              onChange={(e) => setShowClassified(e.target.checked)}
            />
            <span>colour by spectral fingerprint</span>
          </label>
        </div>
      </CollapsiblePanel>

      {/* Right: per-pixel spectrum or detected-object list */}
      <CollapsiblePanel
        side="right"
        label={selectedPixel ? "spectrum" : "detected"}
        defaultOpen={true}
      >
        {selectedPixel ? (
          <PixelInspector
            pixel={selectedPixel}
            spectrum={spectra[selectedPixel.dy][selectedPixel.dx]}
            classification={classifications[selectedPixel.dy][selectedPixel.dx]}
            bands={BANDS}
          />
        ) : (
          <DetectedPanel detected={detected} showClassified={showClassified} />
        )}
      </CollapsiblePanel>
    </>
  );
}

function PixelInspector({ pixel, spectrum, classification, bands }) {
  const width = 280;
  const height = 120;
  const maxS = Math.max(...spectrum, 1e-6);
  const color = SOURCE_KINDS[classification.kind]?.color || "#ffffff";
  return (
    <div className="text-xs font-mono space-y-3">
      <p className="text-sm font-bold">
        Pixel ({pixel.dx}, {pixel.dy})
      </p>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">
          classified as
        </p>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-bold">{classification.kind}</span>
          <span className="text-white/50">
            (score {classification.score.toFixed(3)})
          </span>
        </div>
        <p className="text-white/50 mt-1">
          {SOURCE_KINDS[classification.kind]?.desc}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">
          power spectrum |S_t(ω)|²
        </p>
        <svg width={width} height={height} className="bg-black border border-white/15">
          {spectrum.map((v, k) => {
            const x = (k / spectrum.length) * width;
            const h = (v / maxS) * (height - 4);
            return (
              <line
                key={k}
                x1={x}
                y1={height}
                x2={x}
                y2={height - h}
                stroke={color}
                strokeWidth={1}
              />
            );
          })}
        </svg>
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>ω = 0</span>
          <span>ω_Nyquist</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">
          integrated power per band
        </p>
        <table className="w-full">
          <tbody>
            {bands.map((b) => {
              let p = 0;
              for (let k = b.range[0]; k < b.range[1] && k < spectrum.length; k++) p += spectrum[k];
              return (
                <tr key={b.label} className="border-b border-white/10">
                  <td className="py-1 pr-2">{b.label}</td>
                  <td className="py-1 text-right">{p.toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetectedPanel({ detected, showClassified }) {
  if (!showClassified) {
    return (
      <div className="text-xs font-mono text-white/60">
        Enable &quot;colour by spectral fingerprint&quot; in the left panel
        to surface the detected catalogue.
      </div>
    );
  }
  const byKind = {};
  for (const d of detected) {
    byKind[d.kind] = (byKind[d.kind] || 0) + 1;
  }
  return (
    <div className="text-xs font-mono space-y-2">
      <p className="text-sm font-bold">Detected objects ({detected.length})</p>
      <table className="w-full">
        <tbody>
          {Object.entries(byKind).map(([kind, count]) => (
            <tr key={kind} className="border-b border-white/10">
              <td className="py-1 pr-2 flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: SOURCE_KINDS[kind]?.color }}
                />
                <span>{kind}</span>
              </td>
              <td className="py-1 text-right">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-white/50 pt-2">
        Every entry here was identified by matching its pixel spectrum
        against a template; no catalogue lookup was used.
      </p>
    </div>
  );
}
