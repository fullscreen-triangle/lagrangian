import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { moonObservables } from "@/lib/celestial";
import {
  BackToHub,
  CollapsiblePanel,
  IdleHint,
  InstrumentTitle,
} from "@/components/InstrumentChrome";
import ObservablesChart from "@/components/instruments/ObservablesChart";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// Apollo, Luna, Lunokhod, Chang'e, Chandrayaan, Artemis 3. Longitudes in
// (−180, 180]; react-globe.gl wraps automatically.
const LANDING_SITES = [
  { label: "Apollo 11",       lat:  0.67, lng:  23.47, agency: "NASA",  year: 1969, color: "#ff6b6b" },
  { label: "Apollo 12",       lat: -3.01, lng: -23.42, agency: "NASA",  year: 1969, color: "#ff6b6b" },
  { label: "Apollo 14",       lat: -3.64, lng: -17.48, agency: "NASA",  year: 1971, color: "#ff6b6b" },
  { label: "Apollo 15",       lat: 26.13, lng:   3.63, agency: "NASA",  year: 1971, color: "#ff6b6b" },
  { label: "Apollo 16",       lat: -8.97, lng:  15.50, agency: "NASA",  year: 1972, color: "#ff6b6b" },
  { label: "Apollo 17",       lat: 20.19, lng:  30.77, agency: "NASA",  year: 1972, color: "#ff6b6b" },
  { label: "Luna 9",          lat:  7.08, lng: -64.37, agency: "USSR",  year: 1966, color: "#ffd93d" },
  { label: "Luna 16",         lat: -0.68, lng:  56.30, agency: "USSR",  year: 1970, color: "#ffd93d" },
  { label: "Lunokhod 1",      lat: 38.24, lng: -35.00, agency: "USSR",  year: 1970, color: "#ffd93d" },
  { label: "Lunokhod 2",      lat: 25.83, lng:  30.92, agency: "USSR",  year: 1973, color: "#ffd93d" },
  { label: "Chang'e 4",       lat:-45.44, lng: 177.60, agency: "CNSA",  year: 2019, color: "#6bcb77" },
  { label: "Chang'e 5",       lat: 43.06, lng: -51.92, agency: "CNSA",  year: 2020, color: "#6bcb77" },
  { label: "Chandrayaan-3",   lat:-69.37, lng:  32.32, agency: "ISRO",  year: 2023, color: "#4d96ff" },
  { label: "Artemis 3 (planned)", lat:-89.40, lng:   0.00, agency: "NASA", year: 2027, color: "#c77dff" },
];

const CRATERS = [
  { label: "Tycho",      lat: -43.30, lng: -11.20, size: 85 },
  { label: "Copernicus", lat:   9.62, lng: -20.08, size: 96 },
  { label: "Kepler",     lat:   8.12, lng: -38.01, size: 32 },
  { label: "Aristarchus",lat:  23.70, lng: -47.49, size: 40 },
  { label: "Plato",      lat:  51.63, lng:  -9.38, size: 101 },
  { label: "Shackleton", lat: -89.54, lng:   0.00, size: 21 },
  { label: "Mare Imbrium", lat: 32.80, lng: -15.60, size: 1145 },
  { label: "Mare Tranquillitatis", lat: 8.50, lng: 31.40, size: 873 },
];

const MOON_TEXTURE   = "https://cdn.jsdelivr.net/npm/three-globe/example/img/lunar_surface.jpg";
const MOON_BUMPMAP   = "https://cdn.jsdelivr.net/npm/three-globe/example/img/lunar_bumpmap.jpg";
const NIGHT_SKY      = "https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png";

export default function MoonInstrument() {
  const globeEl = useRef();
  const observables = useMemo(() => moonObservables(), []);
  const [showLandings, setShowLandings] = useState(true);
  const [showCraters, setShowCraters]   = useState(true);
  const [showGraticules, setShowGraticules] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const meanError = observables.reduce((s, o) => s + o.error, 0) / observables.length;
  const maxError  = Math.max(...observables.map((o) => o.error));

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.3;
    controls.enableZoom = true;
    globeEl.current.pointOfView({ altitude: 2.4 }, 0);
  }, [autoRotate, size.w]);

  const labels = useMemo(() => {
    const rows = [];
    if (showLandings) {
      for (const s of LANDING_SITES) {
        rows.push({
          ...s,
          _kind: "landing",
          _size: 1.3,
          _dotRadius: 0.4,
        });
      }
    }
    if (showCraters) {
      for (const c of CRATERS) {
        rows.push({
          label: c.label,
          lat: c.lat,
          lng: c.lng,
          color: "#9ad3ff",
          _kind: "crater",
          _size: 0.9,
          _dotRadius: Math.min(0.6, 0.15 + Math.log10(Math.max(1, c.size)) * 0.1),
        });
      }
    }
    return rows;
  }, [showLandings, showCraters]);

  const rings = useMemo(() => {
    if (!showLandings) return [];
    return LANDING_SITES.filter((s) => s.year >= 2019).map((s) => ({
      lat: s.lat, lng: s.lng, color: s.color, maxR: 3, propagationSpeed: 1.5, repeatPeriod: 1200,
    }));
  }, [showLandings]);

  return (
    <>
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%)" }}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            globeImageUrl={MOON_TEXTURE}
            bumpImageUrl={MOON_BUMPMAP}
            backgroundImageUrl={NIGHT_SKY}
            showGraticules={showGraticules}
            showAtmosphere={false}
            labelsData={labels}
            labelLat={(d) => d.lat}
            labelLng={(d) => d.lng}
            labelText={(d) => d.label}
            labelSize={(d) => d._size}
            labelDotRadius={(d) => d._dotRadius}
            labelColor={(d) => d.color}
            labelResolution={2}
            labelAltitude={0.01}
            labelLabel={(d) =>
              d._kind === "landing"
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
      <InstrumentTitle name="The Moon" />
      <IdleHint text="drag to rotate · scroll to zoom · hover labels for details" />

      <div className="fixed top-4 right-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-[11px] font-mono text-white/80 pointer-events-none">
        <div>{observables.length} observables derived</div>
        <div className="text-white/50">
          mean err {(meanError * 100).toFixed(2)}% · max {(maxError * 100).toFixed(1)}%
        </div>
        <div className="text-white/50">{LANDING_SITES.length} landings · {CRATERS.length} features</div>
      </div>

      <CollapsiblePanel side="left" label="layers" defaultOpen={false}>
        <div className="space-y-3 text-xs font-mono">
          <p className="text-sm font-bold">Map layers</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showLandings} onChange={(e) => setShowLandings(e.target.checked)} />
            <span>Landing sites ({LANDING_SITES.length})</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showCraters} onChange={(e) => setShowCraters(e.target.checked)} />
            <span>Craters &amp; maria ({CRATERS.length})</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showGraticules} onChange={(e) => setShowGraticules(e.target.checked)} />
            <span>Lat/lon graticules</span>
          </label>
          <label className="flex items-center gap-2 pt-1 border-t border-white/10">
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            <span>Auto-rotate</span>
          </label>
          <p className="text-[10px] text-white/50 pt-2">
            Surface texture: LRO Wide-Angle Camera global mosaic.
            Bumpmap: GLD100 topography. All landing coords from NASA/NSSDCA.
          </p>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel side="right" label="observables" defaultOpen={true}>
        <div className="text-xs font-mono space-y-4">
          <div>
            <p className="text-sm font-bold mb-2">Derived observables</p>
            <p className="text-white/50 mb-2 text-[10px]">
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
          <div className="border-t border-white/15 pt-3">
            <p className="text-sm font-bold mb-2">Chart</p>
            <ObservablesChart rows={observables} height={Math.max(180, observables.length * 18 + 40)} />
          </div>
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
