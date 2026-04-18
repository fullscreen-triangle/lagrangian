import Link from "next/link";
import { useEffect, useState } from "react";

/** Persistent back-to-hub button for any fullscreen instrument. */
export function BackToHub() {
  return (
    <Link
      href="/instruments/"
      className="fixed top-4 left-4 z-40 rounded-md bg-black/60 backdrop-blur-sm px-3 py-2 text-xs font-mono text-white hover:bg-black/90 transition"
    >
      ← instruments
    </Link>
  );
}

/** Small instrument title pinned near the top-centre. */
export function InstrumentTitle({ name }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 rounded-md bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-mono text-white/80 uppercase tracking-widest pointer-events-none">
      {name}
    </div>
  );
}

/**
 * A collapsible floating panel. Click the handle to toggle.
 * Auto-hides on touch of canvas underneath.
 */
export function CollapsiblePanel({
  side = "right",
  label,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sideClass =
    side === "right"
      ? "right-0 top-1/2 -translate-y-1/2"
      : side === "left"
      ? "left-0 top-1/2 -translate-y-1/2"
      : side === "top"
      ? "top-0 left-1/2 -translate-x-1/2"
      : "bottom-0 left-1/2 -translate-x-1/2";
  const translateClosed =
    side === "right"
      ? "translate-x-full"
      : side === "left"
      ? "-translate-x-full"
      : side === "top"
      ? "-translate-y-full"
      : "translate-y-full";
  return (
    <div className={`fixed z-40 ${sideClass} flex items-center ${side === "left" ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`transition-transform duration-300 ${open ? "translate-x-0 translate-y-0" : translateClosed}`}
      >
        <div className="bg-black/75 backdrop-blur-md text-white rounded-lg border border-white/10 max-w-[360px] max-h-[80vh] overflow-y-auto shadow-2xl">
          <div className="p-4">{children}</div>
        </div>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="z-50 bg-black/75 backdrop-blur-md text-white text-[11px] font-mono uppercase tracking-widest px-2 py-3 rounded-md m-1 border border-white/10 hover:bg-black/95"
        style={{ writingMode: side === "right" || side === "left" ? "vertical-rl" : "horizontal-tb" }}
      >
        {open ? "close" : label}
      </button>
    </div>
  );
}

/** Auto-hiding idle hint — disappears after the first user interaction. */
export function IdleHint({ text }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = () => setVisible(false);
    const t = setTimeout(hide, 8000);
    window.addEventListener("pointerdown", hide, { once: true });
    window.addEventListener("keydown", hide, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("keydown", hide);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/60 backdrop-blur-sm px-4 py-2 text-xs font-mono text-white/80 pointer-events-none animate-pulse">
      {text}
    </div>
  );
}
