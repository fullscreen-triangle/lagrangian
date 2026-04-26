import { useEffect, useMemo, useRef, useState } from "react";
import {
  PLANET_FEATURES,
  PLANET_TEXTURES,
  PLANET_BLURB,
  planetObservables,
} from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";
import ObservablesChart from "@/components/instruments/ObservablesChart";
import Globe from "@/components/instruments/Globe";

const NIGHT_SKY = "https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png";

/**
 * One instrument template, configured per planet via name.
 * Renders a textured react-globe.gl sphere + observables panel + chart panel.
 */
export default function PlanetInstrument({ name }) {
  const globeEl = useRef();
  const observables = useMemo(() => planetObservables(name), [name]);
  const features = useMemo(() => PLANET_FEATURES[name] ?? [], [name]);
  const tex = PLANET_TEXTURES[name];

  const [showFeatures, setShowFeatures] = useState(true);
  const [showMissions, setShowMissions] = useState(true);
  const [showGraticules, setShowGraticules] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const meanError = observables.reduce((s, o) => s + o.error, 0) / observables.length;
  const maxError = Math.max(...observables.map((o) => o.error));
  const missionCount = features.filter((f) => f._kind === "mission").length;
  const featureCount = features.filter((f) => f._kind === "feature").length;

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const g = globeEl.current;
    if (!g || typeof g.controls !== "function") return;
    const controls = g.controls();
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.3;
    controls.enableZoom = true;
    if (typeof g.pointOfView === "function") g.pointOfView({ altitude: 2.4 }, 0);
  }, [autoRotate, size.w]);

  const labels = useMemo(() => {
    return features.filter((f) =>
      (f._kind === "mission" && showMissions) || (f._kind === "feature" && showFeatures)
    ).map((f) => ({
      ...f,
      _size: f._kind === "mission" ? 1.3 : 0.9,
      _dot: f._kind === "mission" ? 0.45 : 0.3,
    }));
  }, [features, showMissions, showFeatures]);

  const rings = useMemo(() => {
    if (!showMissions) return [];
    return features
      .filter((f) => f._kind === "mission" && f.year && f.year >= 2015)
      .map((f) => ({
        lat: f.lat, lng: f.lng, color: f.color,
        maxR: 3, propagationSpeed: 1.5, repeatPeriod: 1200,
      }));
  }, [features, showMissions]);

  return (
    <>
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            globeImageUrl={tex.surface}
            bumpImageUrl={tex.bump || undefined}
            backgroundImageUrl={NIGHT_SKY}
            showGraticules={showGraticules}
            showAtmosphere={name === "Earth" || name === "Venus" || name === "Mars"}
            atmosphereColor={atmosphereColor(name)}
            atmosphereAltitude={atmosphereAltitude(name)}
            labelsData={labels}
            labelLat={(d) => d.lat}
            labelLng={(d) => d.lng}
            labelText={(d) => d.label}
            labelSize={(d) => d._size}
            labelDotRadius={(d) => d._dot}
            labelColor={(d) => d.color}
            labelResolution={2}
            labelAltitude={0.01}
            labelLabel={(d) =>
              d._kind === "mission"
                ? `<div style="font:12px monospace;color:#fff"><b>${d.label}</b><br/>${d.agency} · ${d.year}</div>`
                : `<div style="font:12px monospace;color:#fff"><b>${d.label}</b></div>`
            }
            ringsData={rings}
            ringColor={(d) => () => d.color}
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
          />
        )}
      </div>

      <BackToHub />
      <InstrumentTitle name={name} />
      <IdleHint text="drag · scroll · hover labels" />

      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none max-w-[280px]">
        <div>{observables.length} observables · mean err {(meanError * 100).toFixed(2)}% · max {(maxError * 100).toFixed(1)}%</div>
        <div className="text-white/50">{missionCount} missions · {featureCount} features</div>
      </div>

      <CollapsiblePanel side="left" label="layers" defaultOpen={false}>
        <div className="space-y-3 text-xs font-mono">
          <p className="text-sm font-bold">{name}</p>
          <p className="text-[10px] text-white/60 leading-snug">{PLANET_BLURB[name]}</p>
          <div className="border-t border-white/10 pt-2 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showMissions} onChange={(e) => setShowMissions(e.target.checked)} />
              <span>Missions ({missionCount})</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showFeatures} onChange={(e) => setShowFeatures(e.target.checked)} />
              <span>Features ({featureCount})</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showGraticules} onChange={(e) => setShowGraticules(e.target.checked)} />
              <span>Lat/lon graticules</span>
            </label>
            <label className="flex items-center gap-2 border-t border-white/10 pt-2">
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
              <span>Auto-rotate</span>
            </label>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel side="right" label="observables" defaultOpen={true}>
        <div className="text-xs font-mono space-y-4">
          <div>
            <p className="text-sm font-bold mb-2">Derived observables</p>
            <p className="text-white/50 mb-2 text-[10px]">
              Live derivations from partition formulas. Compared to NASA fact-sheet values.
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
          <div className="border-t border-white/15 pt-3">
            <p className="text-sm font-bold mb-2">Chart</p>
            <ObservablesChart rows={observables} height={Math.max(180, observables.length * 18 + 40)} />
          </div>
        </div>
      </CollapsiblePanel>
    </>
  );
}

function atmosphereColor(name) {
  if (name === "Earth")  return "#5599ff";
  if (name === "Venus")  return "#e8c27a";
  if (name === "Mars")   return "#c1440e";
  return "#88aaff";
}

function atmosphereAltitude(name) {
  if (name === "Venus") return 0.2;
  if (name === "Mars")  return 0.05;
  return 0.15;
}

function formatNum(x) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  if (ax >= 1e5) return x.toExponential(3);
  if (ax >= 100) return x.toFixed(1);
  if (ax >= 1)   return x.toFixed(3);
  return x.toExponential(2);
}
