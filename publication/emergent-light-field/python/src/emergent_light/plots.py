"""Figure panels for the Emergent Light Field paper.

Each panel is a 1x4 layout, white background, minimal text, at least one
3D chart per panel. All data is computed live from the reference
implementation; no tables, no conceptual art.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import cm

from emergent_light.membrane import (
    BANDS,
    CLASS_NAMES,
    DURATION_S,
    GRID_H,
    GRID_W,
    N_OMEGA,
    N_SAMPLES,
    Source,
    build_membrane,
    classify_pixel,
    fingerprint,
    make_time_grid,
    pixel_grid_sky,
    pixel_spectrum,
    source_time_series,
    synthesise_sources,
)

PLT_STYLE = {
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
    "axes.edgecolor": "black",
    "axes.labelsize": 9,
    "axes.titlesize": 10,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.fontsize": 8,
    "font.family": "serif",
}


def _new_panel(title: str):
    fig = plt.figure(figsize=(16, 4), facecolor="white")
    axes = [
        fig.add_subplot(1, 4, 1),
        fig.add_subplot(1, 4, 2),
        fig.add_subplot(1, 4, 3),
        fig.add_subplot(1, 4, 4, projection="3d"),
    ]
    fig.suptitle(title, y=0.98, fontsize=11)
    return fig, axes


def _finalize(fig) -> None:
    fig.tight_layout(rect=[0, 0, 1, 0.94])


# -----------------------------------------------------------------------------
# Panel 1: Pipeline for a single pixel
# -----------------------------------------------------------------------------


def panel_1_pipeline(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 1. Observation pipeline for one pixel")

        t_grid = make_time_grid()
        pulsar = Source(id="p", kind="pulsar", pixel=(0, 0), flux=3.0, period=2000.0)
        rng = np.random.default_rng(3)
        sky_model = 0.5 + 0.3 * np.sin(2 * np.pi * np.arange(N_SAMPLES) / N_SAMPLES)
        source_signal = source_time_series(pulsar, t_grid)
        noise = 0.02 * (rng.random(N_SAMPLES) - 0.5)
        observed = sky_model + source_signal + noise
        residual = observed - sky_model
        spectrum = pixel_spectrum(observed, sky_model)

        hours = t_grid / 3600
        ax = axes[0]
        ax.plot(hours, observed, color="black", lw=1.0, label="observed")
        ax.plot(hours, sky_model, color="tab:blue", lw=1.0, label="reference model")
        ax.set_xlabel("time (hr)")
        ax.set_ylabel("brightness")
        ax.legend(frameon=False, fontsize=7)
        ax.set_title("observed vs model")
        ax.grid(True, alpha=0.3)

        ax = axes[1]
        ax.plot(hours, residual, color="black", lw=1.0)
        ax.set_xlabel("time (hr)")
        ax.set_ylabel("residual (observed − model)")
        ax.set_title("residual")
        ax.grid(True, alpha=0.3)

        ax = axes[2]
        ax.semilogy(np.arange(N_OMEGA), np.maximum(spectrum, 1e-20), color="black", lw=1.0)
        ax.set_xlabel("ω bin")
        ax.set_ylabel(r"$S_t(\omega)$")
        ax.set_title("pixel spectrum")
        ax.grid(True, which="both", alpha=0.3)

        # 3D: spectrogram of the residual across sliding windows
        ax = axes[3]
        win = 64
        step = 16
        n_win = (N_SAMPLES - win) // step + 1
        spectrogram = np.zeros((n_win, win // 2 + 1))
        for i in range(n_win):
            seg = residual[i * step: i * step + win]
            seg = seg * (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(win) / (win - 1)))
            S = np.fft.rfft(seg)
            spectrogram[i] = (S.real ** 2 + S.imag ** 2)
        T, F = np.meshgrid(np.arange(n_win) * step / N_SAMPLES * 24, np.arange(win // 2 + 1))
        ax.plot_surface(T, F, np.log10(spectrogram.T + 1e-12),
                        cmap=cm.viridis, edgecolor="none", alpha=0.9)
        ax.set_xlabel("time (hr)")
        ax.set_ylabel("ω bin")
        ax.set_zlabel(r"$\log_{10} S_t$")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_1_pipeline.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 2: Class fingerprints
# -----------------------------------------------------------------------------


def panel_2_fingerprints(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 2. Class spectral fingerprints")

        fps = {name: fingerprint(name) for name in CLASS_NAMES}

        ax = axes[0]
        for name in CLASS_NAMES:
            ax.plot(fps[name], label=name, lw=1.1)
        ax.set_xlabel("ω bin")
        ax.set_ylabel("fingerprint weight")
        ax.set_xlim(0, 60)
        ax.legend(frameon=False, fontsize=7)
        ax.set_title("all five fingerprints")
        ax.grid(True, alpha=0.3)

        # Canonical-source spectra for each class
        t_grid = make_time_grid()
        canonical_specs = {}
        for name in CLASS_NAMES:
            src = _canonical(name)
            sig = source_time_series(src, t_grid)
            canonical_specs[name] = pixel_spectrum(sig, np.zeros_like(sig))

        ax = axes[1]
        for name in CLASS_NAMES:
            s = canonical_specs[name]
            ax.semilogy(np.maximum(s / s.sum(), 1e-12), lw=0.9, label=name)
        ax.set_xlabel("ω bin")
        ax.set_ylabel("normalised power")
        ax.set_xlim(0, 60)
        ax.legend(frameon=False, fontsize=7)
        ax.set_title("canonical spectra")
        ax.grid(True, which="both", alpha=0.3)

        # Confusion matrix: classify canonical spectra against all fingerprints
        ax = axes[2]
        conf = np.zeros((len(CLASS_NAMES), len(CLASS_NAMES)))
        for i, true_name in enumerate(CLASS_NAMES):
            cls = classify_pixel(canonical_specs[true_name])
            j = CLASS_NAMES.index(cls["kind"]) if cls["kind"] in CLASS_NAMES else -1
            if j >= 0:
                conf[i, j] = 1.0
        im = ax.imshow(conf, cmap="Greens", vmin=0, vmax=1)
        ax.set_xticks(np.arange(len(CLASS_NAMES)))
        ax.set_yticks(np.arange(len(CLASS_NAMES)))
        ax.set_xticklabels(CLASS_NAMES, rotation=45, ha="right", fontsize=7)
        ax.set_yticklabels(CLASS_NAMES, fontsize=7)
        ax.set_xlabel("predicted")
        ax.set_ylabel("true")
        ax.set_title("canonical-class accuracy")

        # 3D: stacked fingerprint surface
        ax = axes[3]
        x = np.arange(min(60, N_OMEGA))
        y = np.arange(len(CLASS_NAMES))
        X, Y = np.meshgrid(x, y)
        Z = np.array([fps[CLASS_NAMES[i]][:len(x)] for i in range(len(CLASS_NAMES))])
        ax.plot_surface(X, Y, Z, cmap=cm.viridis, edgecolor="none", alpha=0.9)
        ax.set_xlabel("ω bin")
        ax.set_ylabel("class")
        ax.set_yticks(np.arange(len(CLASS_NAMES)))
        ax.set_yticklabels(CLASS_NAMES, fontsize=6)
        ax.set_zlabel("weight")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_2_fingerprints.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


def _canonical(name: str) -> Source:
    if name == "star":
        return Source(id="_s", kind="star", pixel=(0, 0), flux=2.0)
    if name == "planet":
        return Source(id="_p", kind="planet", pixel=(0, 0), flux=4.0, period=6000.0)
    if name == "pulsar":
        return Source(id="_pu", kind="pulsar", pixel=(0, 0), flux=3.0, period=2000.0)
    if name == "satellite":
        return Source(id="_sa", kind="satellite", pixel=(0, 0), flux=8.0,
                      transits=[k * 10800.0 for k in range(8)])
    if name == "exoplanet":
        return Source(id="_e", kind="exoplanet", pixel=(0, 0),
                      flux=3.5, period=17280.0, duration=1800.0)
    raise ValueError(name)


# -----------------------------------------------------------------------------
# Panel 3: Classification performance (recall + confusion + fingerprint match)
# -----------------------------------------------------------------------------


def panel_3_classification(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 3. Classification performance")

        sources = synthesise_sources()
        mem = build_membrane(sources, sun_alt=-0.3)

        per_correct = {c: 0 for c in CLASS_NAMES}
        per_total = {c: 0 for c in CLASS_NAMES}
        confusion = np.zeros((len(CLASS_NAMES), len(CLASS_NAMES)))
        for src in sources:
            dx, dy = src.pixel
            pred = mem["classes"][dy, dx]["kind"]
            if pred not in CLASS_NAMES:
                continue
            i = CLASS_NAMES.index(src.kind)
            j = CLASS_NAMES.index(pred)
            confusion[i, j] += 1
            per_total[src.kind] += 1
            if pred == src.kind:
                per_correct[src.kind] += 1
        recalls = [per_correct[c] / max(per_total[c], 1) for c in CLASS_NAMES]

        ax = axes[0]
        colors = ["tab:blue", "tab:orange", "tab:red", "tab:green", "tab:purple"]
        bars = ax.bar(CLASS_NAMES, recalls, color=colors)
        ax.set_ylim(0, 1.05)
        ax.set_ylabel("recall")
        for b, v in zip(bars, recalls):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.2f}",
                    ha="center", fontsize=8)
        for tick in ax.get_xticklabels():
            tick.set_rotation(25)
            tick.set_ha("right")
        ax.grid(True, axis="y", alpha=0.3)
        ax.set_title("per-class recall")

        # Confusion matrix
        ax = axes[1]
        conf_norm = confusion / np.maximum(confusion.sum(axis=1, keepdims=True), 1)
        im = ax.imshow(conf_norm, cmap="Greens", vmin=0, vmax=1)
        ax.set_xticks(np.arange(len(CLASS_NAMES)))
        ax.set_yticks(np.arange(len(CLASS_NAMES)))
        ax.set_xticklabels(CLASS_NAMES, rotation=45, ha="right", fontsize=7)
        ax.set_yticklabels(CLASS_NAMES, fontsize=7)
        ax.set_xlabel("predicted")
        ax.set_ylabel("true")
        ax.set_title("confusion (normalised)")
        for i in range(len(CLASS_NAMES)):
            for j in range(len(CLASS_NAMES)):
                ax.text(j, i, f"{int(confusion[i, j])}",
                        ha="center", va="center",
                        color="white" if conf_norm[i, j] > 0.4 else "black", fontsize=7)

        # FPR bar: empty-pixel false-positive distribution
        total_powers = np.array(
            [[mem["classes"][dy, dx]["total_power"] for dx in range(GRID_W)]
             for dy in range(GRID_H)]
        )
        threshold = 0.05 * total_powers.max()
        source_pixels = {src.pixel for src in sources}
        empty_kinds = []
        for dy in range(GRID_H):
            for dx in range(GRID_W):
                if (dx, dy) in source_pixels:
                    continue
                cls = mem["classes"][dy, dx]
                if cls["total_power"] > threshold and cls["kind"] in CLASS_NAMES:
                    empty_kinds.append(cls["kind"])
        counts = [empty_kinds.count(c) for c in CLASS_NAMES]
        ax = axes[2]
        ax.bar(CLASS_NAMES, counts, color=colors)
        ax.set_ylabel("empty-pixel FP count")
        for tick in ax.get_xticklabels():
            tick.set_rotation(25)
            tick.set_ha("right")
        ax.set_title(f"FPR = {sum(counts)} / {GRID_H * GRID_W - len(source_pixels)}")
        ax.grid(True, axis="y", alpha=0.3)

        # 3D: classification score surface per class
        ax = axes[3]
        score_map = np.zeros((len(CLASS_NAMES), 5))  # 5 sources per class (truncate)
        for i, cls in enumerate(CLASS_NAMES):
            xs = [src for src in sources if src.kind == cls][:5]
            for k, src in enumerate(xs):
                dx, dy = src.pixel
                score_map[i, k] = mem["classes"][dy, dx]["score"]
        X, Y = np.meshgrid(np.arange(5), np.arange(len(CLASS_NAMES)))
        Z = score_map
        ax.plot_surface(X, Y, Z, cmap=cm.plasma, edgecolor="none", alpha=0.9)
        ax.set_xlabel("sample idx")
        ax.set_ylabel("class")
        ax.set_yticks(np.arange(len(CLASS_NAMES)))
        ax.set_yticklabels(CLASS_NAMES, fontsize=6)
        ax.set_zlabel("score")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_3_classification.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 4: Day/night invariance + model sensitivity
# -----------------------------------------------------------------------------


def panel_4_invariance(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 4. Day/night invariance and sensitivity")

        sources = synthesise_sources()

        # (A) Sky brightness model across sun altitudes
        ax = axes[0]
        sun_alts = np.linspace(-1, 1, 80)
        # Measure mean sky brightness at zenith
        def zenith_sky(sa):
            alt = np.pi / 2
            az = 0.0
            airglow = 0.01
            solar = max(0.0, sa) * (np.sin(alt) ** 0.7)
            scatter = solar * (3.0 + np.cos(az) * 0.3)
            ext = 0.01 / (np.sin(alt) + 0.05)
            return airglow + scatter + ext
        zen = [zenith_sky(sa) for sa in sun_alts]
        ax.plot(sun_alts, zen, color="black", lw=1.2)
        ax.axvspan(-1, 0, alpha=0.15, color="navy", label="night")
        ax.axvspan(0, 1, alpha=0.15, color="gold", label="day")
        ax.set_xlabel("sun altitude (normalised)")
        ax.set_ylabel("zenith sky brightness")
        ax.legend(frameon=False, fontsize=7)
        ax.set_title("reference sky model")
        ax.grid(True, alpha=0.3)

        # (B) Residual-of-residuals between day and night matched pixels
        rng_n = np.random.default_rng(7)
        rng_d = np.random.default_rng(7)
        mem_n = build_membrane(sources, sun_alt=-1.0, noise_rng=rng_n)
        mem_d = build_membrane(sources, sun_alt=+1.0, noise_rng=rng_d)
        delta = np.abs(mem_n["spectra"] - mem_d["spectra"])
        max_val = max(np.max(np.abs(mem_n["spectra"])), 1e-12)
        rel = delta / max_val
        ax = axes[1]
        ax.hist(rel.flatten(), bins=80, color="tab:blue", edgecolor="none")
        ax.set_xscale("log")
        ax.set_xlabel("pixel-wise |ΔS_t| / max|S_t|")
        ax.set_ylabel("pixels")
        ax.set_title(f"day/night rel. diff (max = {rel.max():.1e})")
        ax.grid(True, which="both", alpha=0.3)

        # (C) Model sensitivity: recall vs eta
        etas = [0.00, 0.01, 0.03, 0.05, 0.08, 0.10, 0.15, 0.20, 0.25, 0.35]
        recalls_vs_eta = []
        for eta in etas:
            rng = np.random.default_rng(7)
            m = build_membrane(sources, sun_alt=-0.3, model_perturbation=eta, noise_rng=rng)
            correct = sum(1 for src in sources
                         if m["classes"][src.pixel[1], src.pixel[0]]["kind"] == src.kind)
            recalls_vs_eta.append(correct / len(sources))
        ax = axes[2]
        ax.plot(etas, recalls_vs_eta, "o-", color="black", lw=1.1, markersize=5)
        ax.set_xlabel("model perturbation η")
        ax.set_ylabel("overall recall")
        ax.set_ylim(0, 1.05)
        ax.grid(True, alpha=0.3)
        ax.set_title("recall vs reference-model error")

        # (D) 3D: recall per class vs eta
        ax = axes[3]
        class_recalls = np.zeros((len(CLASS_NAMES), len(etas)))
        for j, eta in enumerate(etas):
            rng = np.random.default_rng(7)
            m = build_membrane(sources, sun_alt=-0.3, model_perturbation=eta, noise_rng=rng)
            per_correct = {c: 0 for c in CLASS_NAMES}
            per_total = {c: 0 for c in CLASS_NAMES}
            for src in sources:
                per_total[src.kind] += 1
                if m["classes"][src.pixel[1], src.pixel[0]]["kind"] == src.kind:
                    per_correct[src.kind] += 1
            for i, c in enumerate(CLASS_NAMES):
                class_recalls[i, j] = per_correct[c] / max(per_total[c], 1)
        E, C = np.meshgrid(etas, np.arange(len(CLASS_NAMES)))
        ax.plot_surface(E, C, class_recalls, cmap=cm.viridis, edgecolor="none", alpha=0.9)
        ax.set_xlabel("η")
        ax.set_ylabel("class")
        ax.set_yticks(np.arange(len(CLASS_NAMES)))
        ax.set_yticklabels(CLASS_NAMES, fontsize=6)
        ax.set_zlabel("recall")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_4_invariance.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 5: Full membrane visualisation
# -----------------------------------------------------------------------------


def panel_5_membrane(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 5. The emergent light field — band slices of $S_t(α,δ,ω)$")

        sources = synthesise_sources()
        mem = build_membrane(sources, sun_alt=-0.3)
        spectra = mem["spectra"]  # (H, W, N_OMEGA)

        def band_image(lo, hi):
            img = spectra[:, :, lo:hi].sum(axis=2)
            return img

        # (A) DC slice
        ax = axes[0]
        img = band_image(0, 1)
        im = ax.imshow(np.log10(img + 1e-12), cmap="magma", origin="lower")
        ax.set_title("DC band (k=0)")
        ax.set_xlabel("α pixel")
        ax.set_ylabel("δ pixel")
        fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

        # (B) Planet / exoplanet band (k = 3..25)
        ax = axes[1]
        img = band_image(3, 25)
        im = ax.imshow(np.log10(img + 1e-12), cmap="magma", origin="lower")
        ax.set_title("structural band (k=3..25)")
        ax.set_xlabel("α pixel")
        ax.set_ylabel("δ pixel")
        fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

        # (C) Pulsar-range band
        ax = axes[2]
        img = band_image(30, 80)
        im = ax.imshow(np.log10(img + 1e-12), cmap="magma", origin="lower")
        ax.set_title("pulsar band (k=30..80)")
        ax.set_xlabel("α pixel")
        ax.set_ylabel("δ pixel")
        fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

        # (D) 3D: peak-ω surface over the sky
        ax = axes[3]
        peak_omega = spectra[:, :, 1:].argmax(axis=2) + 1  # skip DC
        total_power = spectra.sum(axis=2)
        # Normalise power for visualisation
        z = np.log10(total_power + 1e-12)
        X, Y = np.meshgrid(np.arange(GRID_W), np.arange(GRID_H))
        surf = ax.scatter(X, Y, peak_omega, c=z, cmap="plasma", s=8, alpha=0.8)
        ax.set_xlabel("α pixel")
        ax.set_ylabel("δ pixel")
        ax.set_zlabel("peak ω")
        fig.colorbar(surf, ax=ax, shrink=0.5, pad=0.1, label="log₁₀ total power")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_5_membrane.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------


def generate_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        panel_1_pipeline(out_dir),
        panel_2_fingerprints(out_dir),
        panel_3_classification(out_dir),
        panel_4_invariance(out_dir),
        panel_5_membrane(out_dir),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="emergent-light-plots")
    parser.add_argument("--output-dir", type=Path, default=Path("figures"))
    args = parser.parse_args(argv)
    paths = generate_all(args.output_dir)
    for p in paths:
        print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
