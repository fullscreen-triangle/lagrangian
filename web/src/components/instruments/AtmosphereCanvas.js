import { useEffect, useRef, useState } from "react";

/**
 * AtmosphereCanvas
 *
 * Initialises a WebGPU device and mounts the five-pass atmospheric pipeline
 * onto an HTML canvas. All compute happens client-side; no network calls
 * beyond fetching the static WGSL shader sources from /shaders/.
 *
 * This is the scaffold. The actual pipeline dispatch (shader module
 * compilation, texture allocation, per-frame encode/submit loop) lands in
 * the follow-up pass. For now the component verifies:
 *   - the browser supports WebGPU
 *   - a device can be acquired
 *   - the canvas configures correctly
 *   - the WGSL sources fetch from /shaders/
 *
 * If any of those fail the user sees a precise error, not a blank canvas.
 */

const SHADER_PATHS = [
  "/shaders/pass0_terrain.wgsl",
  "/shaders/pass1_weather.wgsl",
  "/shaders/pass2_position.wgsl",
  "/shaders/pass3_light.wgsl",
  "/shaders/pass4_render.wgsl",
];

export default function AtmosphereCanvas() {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("initialising");
  const [error, setError] = useState(null);
  const [adapterInfo, setAdapterInfo] = useState(null);
  const [shaderBytes, setShaderBytes] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        if (typeof navigator === "undefined" || !navigator.gpu) {
          throw new Error(
            "WebGPU is not available in this browser. Try Chrome, Edge, or a WebGPU-enabled build of Safari."
          );
        }
        setStatus("requesting-adapter");
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });
        if (!adapter) throw new Error("No compatible GPU adapter found.");

        setStatus("requesting-device");
        const device = await adapter.requestDevice();
        if (cancelled) return;

        // Collect adapter info for the UI diagnostic panel.
        const info = adapter.info
          ? {
              vendor: adapter.info.vendor || "unknown",
              architecture: adapter.info.architecture || "unknown",
              device: adapter.info.device || "unknown",
            }
          : { vendor: "unknown", architecture: "unknown", device: "unknown" };
        setAdapterInfo(info);

        setStatus("configuring-canvas");
        const canvas = canvasRef.current;
        const context = canvas.getContext("webgpu");
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format,
          alphaMode: "premultiplied",
        });

        setStatus("fetching-shaders");
        const shaders = await Promise.all(
          SHADER_PATHS.map(async (path) => {
            const r = await fetch(path);
            if (!r.ok) throw new Error(`fetch ${path}: ${r.status} ${r.statusText}`);
            return r.text();
          })
        );
        const totalBytes = shaders.reduce((n, s) => n + s.length, 0);
        if (cancelled) return;
        setShaderBytes(totalBytes);

        // Compile modules to catch WGSL errors early. This surfaces any
        // authoring mistakes before we attempt the full dispatch chain.
        setStatus("compiling-shaders");
        for (let i = 0; i < shaders.length; i++) {
          device.createShaderModule({
            label: SHADER_PATHS[i],
            code: shaders[i],
          });
        }

        if (cancelled) return;
        setStatus("ready");
        // TODO next pass: per-frame dispatch loop.
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setStatus("failed");
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-2xl
        border-2 border-solid border-dark dark:border-light bg-black"
      >
        <canvas ref={canvasRef} className="h-full w-full" width={1920} height={1080} />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center text-light">
            <div className="text-center font-mono text-sm">
              <div className="mb-2 uppercase tracking-widest">{status}</div>
              {error && <div className="max-w-lg text-red-400">{error}</div>}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-1 font-mono text-sm">
        <div className="rounded-md border border-dark/50 dark:border-light/50 p-4">
          <div className="text-xs uppercase tracking-widest text-dark/60 dark:text-light/60">
            GPU adapter
          </div>
          <div className="mt-2">
            {adapterInfo
              ? `${adapterInfo.vendor} · ${adapterInfo.architecture} · ${adapterInfo.device}`
              : "—"}
          </div>
        </div>
        <div className="rounded-md border border-dark/50 dark:border-light/50 p-4">
          <div className="text-xs uppercase tracking-widest text-dark/60 dark:text-light/60">
            Shader bundle
          </div>
          <div className="mt-2">
            {shaderBytes ? `${SHADER_PATHS.length} files, ${shaderBytes.toLocaleString()} bytes` : "—"}
          </div>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-dark/70 dark:text-light/70">
        This instrument runs entirely client-side. WGSL source is fetched
        once from <code className="font-mono">/shaders/</code>, compiled by
        your GPU driver, and executed on your hardware. No computation
        round-trips through any server.
      </p>
    </div>
  );
}
