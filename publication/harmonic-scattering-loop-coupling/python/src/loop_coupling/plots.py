"""Figure panels for the harmonic-scattering loop-coupling paper.

Each panel is a 1x4 layout. Minimal text. White background. At least one
3D chart per panel. All data is computed from the framework
implementation in `loop_coupling.graph`, `loop_coupling.transfer`, and
`loop_coupling.validation`; no tables, no conceptual diagrams.

Run: `python -m loop_coupling.plots --output-dir figures`
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
from scipy.stats import spearmanr

from loop_coupling.graph import (
    cycle_rank,
    fundamental_cycles,
    harmonic_graph,
)
from loop_coupling.transfer import (
    Source,
    build_transfer_matrix,
    condition_number,
    reconstruct_sources,
)
from loop_coupling.validation import (
    BENZENE_OMEGA,
    LIQUIDS,
    _graph_with_target_cycle_rank,
    _make_benzene_sources,
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
# Panel 1: Molecular harmonic graph
# -----------------------------------------------------------------------------


def panel_1_graph(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 1. Molecular harmonic graph")

        edges = harmonic_graph(BENZENE_OMEGA, eta_max=10, delta_tol=0.05)
        cycles = fundamental_cycles(len(BENZENE_OMEGA), edges)
        C = cycle_rank(len(BENZENE_OMEGA), edges)

        # (a) Mode frequencies on a stem plot
        ax = axes[0]
        ax.stem(
            BENZENE_OMEGA,
            np.ones_like(BENZENE_OMEGA),
            linefmt="k-",
            markerfmt="ko",
            basefmt=" ",
        )
        ax.set_xlabel(r"$\omega$ (cm$^{-1}$)")
        ax.set_ylabel("mode present")
        ax.set_ylim(0, 1.2)
        ax.set_title(f"benzene, N={len(BENZENE_OMEGA)}", fontsize=9)
        ax.grid(True, alpha=0.3)

        # (b) Harmonic edges: characteristic frequency vs mistuning delta
        ax = axes[1]
        char_freqs = [e.characteristic_freq(BENZENE_OMEGA) for e in edges]
        deltas = [e.delta for e in edges]
        ax.scatter(char_freqs, deltas, color="black", s=40)
        ax.set_xlabel(r"edge char. freq. (cm$^{-1}$)")
        ax.set_ylabel(r"mistuning $\delta$")
        ax.set_yscale("log")
        ax.set_title(fr"$|E_h|={len(edges)}$, $C={C}$", fontsize=9)
        ax.grid(True, alpha=0.3)

        # (c) Cycle rank across a family of synthetic molecules (N = 4..12)
        ax = axes[2]
        rng = np.random.default_rng(11)
        N_vals = np.arange(4, 13)
        C_medians = []
        C_lower, C_upper = [], []
        for N in N_vals:
            C_trials = []
            for _ in range(40):
                omega = np.sort(rng.uniform(500.0, 3200.0, N))
                e = harmonic_graph(omega, eta_max=10, delta_tol=0.10)
                C_trials.append(cycle_rank(N, e))
            C_medians.append(np.median(C_trials))
            C_lower.append(np.percentile(C_trials, 25))
            C_upper.append(np.percentile(C_trials, 75))
        ax.fill_between(N_vals, C_lower, C_upper, alpha=0.3, color="tab:blue",
                        label="IQR")
        ax.plot(N_vals, C_medians, "o-", color="tab:blue", label="median")
        ax.set_xlabel("molecular size N (modes)")
        ax.set_ylabel("cycle rank C")
        ax.legend(frameon=False)
        ax.grid(True, alpha=0.3)

        # (d) 3D: edges as points in (omega_i, omega_j, delta) space
        ax = axes[3]
        omega_i = np.array([BENZENE_OMEGA[e.i] for e in edges])
        omega_j = np.array([BENZENE_OMEGA[e.j] for e in edges])
        deltas_arr = np.array(deltas)
        sc = ax.scatter(
            omega_i,
            omega_j,
            deltas_arr,
            c=np.log10(deltas_arr),
            cmap=cm.plasma,
            s=60,
        )
        ax.set_xlabel(r"$\omega_i$ (cm$^{-1}$)")
        ax.set_ylabel(r"$\omega_j$ (cm$^{-1}$)")
        ax.set_zlabel(r"$\delta$")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_1_graph.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 2: Loop-coupling map
# -----------------------------------------------------------------------------


def panel_2_coupling(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 2. Loop-coupling map")

        edges = harmonic_graph(BENZENE_OMEGA, eta_max=10, delta_tol=0.05)

        # (a) Lorentzian frequency-matching for each edge
        ax = axes[0]
        freqs = np.linspace(500, 3200, 400)
        cmap = cm.viridis
        for k, e in enumerate(edges):
            cf = e.characteristic_freq(BENZENE_OMEGA)
            selectivity = 1.0 / (1.0 + ((freqs - cf) / (cf * max(e.delta, 1e-4))) ** 2)
            ax.plot(freqs, selectivity, color=cmap(k / max(1, len(edges) - 1)), lw=1.0)
        ax.set_xlabel(r"source freq. $c/\lambda$ (cm$^{-1}$)")
        ax.set_ylabel("frequency selectivity")
        ax.grid(True, alpha=0.3)

        # (b) Angular selectivity: |n.(mu_i x mu_j)| over direction azimuth
        from loop_coupling.transfer import _angular_weight

        ax = axes[1]
        phis = np.linspace(0, 2 * np.pi, 200)
        for k, e in enumerate(edges[:5]):
            weights = []
            for phi in phis:
                n = np.array([np.cos(phi), np.sin(phi), 0.0])
                weights.append(_angular_weight(n, e))
            ax.plot(np.degrees(phis), weights, color=cmap(k / 5.0), lw=1.0)
        ax.set_xlabel("source azimuth (deg)")
        ax.set_ylabel(r"$|\hat n\cdot(\mu_i\times\mu_j)|$")
        ax.grid(True, alpha=0.3)

        # (c) Combined coupling = freq_selectivity * angular_weight along a sweep
        ax = axes[2]
        wavelengths = np.linspace(3.0e-4, 3.0e-3, 60)  # arbitrary
        directions = np.linspace(0, np.pi, 60)
        phi_fixed = 0.5
        combined = np.zeros((len(wavelengths), len(edges)))
        for i, w in enumerate(wavelengths):
            for k, e in enumerate(edges):
                cf = e.characteristic_freq(BENZENE_OMEGA)
                src_freq = 1.0 / (w * 1e-4)
                delta = (src_freq - cf) / cf
                freq_sel = 1.0 / (1.0 + (delta / max(e.delta, 1e-4)) ** 2)
                n = np.array([np.cos(phi_fixed), np.sin(phi_fixed), 0.0])
                ang = _angular_weight(n, e)
                combined[i, k] = freq_sel * ang
        for k in range(len(edges)):
            ax.plot(wavelengths * 1e4, combined[:, k], color=cmap(k / max(1, len(edges) - 1)), lw=1.0)
        ax.set_xlabel(r"$\lambda$ (a.u.)")
        ax.set_ylabel("combined coupling")
        ax.grid(True, alpha=0.3)

        # (d) 3D surface: coupling(wavelength, direction) for strongest edge
        ax = axes[3]
        e = edges[int(np.argmin([abs(edge.delta) for edge in edges]))]  # tightest edge
        cf = e.characteristic_freq(BENZENE_OMEGA)
        W = np.linspace(3.0e-4, 3.0e-3, 40)
        D = np.linspace(0, np.pi, 40)
        Wm, Dm = np.meshgrid(W, D)
        src_freq = 1.0 / (Wm * 1e-4)
        delta_mat = (src_freq - cf) / cf
        freq_sel_mat = 1.0 / (1.0 + (delta_mat / max(e.delta, 1e-4)) ** 2)
        ang_vec = np.array(
            [
                _angular_weight(
                    np.array([np.cos(d), np.sin(d), 0.0]), e
                )
                for d in D
            ]
        )
        ang_mat = np.broadcast_to(ang_vec[:, None], Wm.shape)
        Z = freq_sel_mat * ang_mat
        ax.plot_surface(Wm * 1e4, Dm, Z, cmap=cm.viridis, edgecolor="none", alpha=0.9)
        ax.set_xlabel(r"$\lambda$ (a.u.)")
        ax.set_ylabel("azimuth (rad)")
        ax.set_zlabel("coupling")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_2_coupling.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 3: Multi-source reconstruction
# -----------------------------------------------------------------------------


def panel_3_reconstruction(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 3. Multi-source reconstruction")

        edges = harmonic_graph(BENZENE_OMEGA, eta_max=10, delta_tol=0.05)
        rng = np.random.default_rng(42)
        C = cycle_rank(len(BENZENE_OMEGA), edges)
        n_src = C + 1
        sources = _make_benzene_sources(n_src, rng)
        A = build_transfer_matrix(BENZENE_OMEGA, edges, sources)
        s_true = np.array([s.amplitude for s in sources], dtype=np.complex128)
        kappa = condition_number(A)

        # (a) Reconstruction error vs noise (log-log)
        sigmas = np.logspace(-15, -0.5, 40)
        errs = []
        for sigma in sigmas:
            I_clean = A @ s_true
            noise = (
                rng.standard_normal(I_clean.shape) + 1j * rng.standard_normal(I_clean.shape)
            ) * sigma * np.linalg.norm(I_clean)
            reg = max(1e-12, sigma * 0.1) if sigma > 0 else 0.0
            s_hat = reconstruct_sources(A, I_clean + noise, regularisation=reg)
            errs.append(float(np.linalg.norm(s_true - s_hat) / np.linalg.norm(s_true)))
        ax = axes[0]
        ax.loglog(sigmas, errs, "o-", color="black", markersize=3, label="measured")
        ax.loglog(sigmas, kappa * sigmas, "r--", lw=1, label=r"$\kappa\sigma$")
        ax.set_xlabel(r"noise $\sigma$")
        ax.set_ylabel("reconstruction error")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # (b) Recovered amplitudes at sigma = 1e-3
        sigma = 1e-3
        I_clean = A @ s_true
        noise = (
            rng.standard_normal(I_clean.shape) + 1j * rng.standard_normal(I_clean.shape)
        ) * sigma * np.linalg.norm(I_clean)
        s_hat = reconstruct_sources(A, I_clean + noise, regularisation=sigma * 0.1)
        ax = axes[1]
        idx = np.arange(n_src)
        width = 0.35
        ax.bar(idx - width / 2, s_true.real, width, label="true (Re)", color="black")
        ax.bar(idx + width / 2, s_hat.real, width, label="recovered (Re)", color="tab:red", alpha=0.8)
        ax.set_xlabel("source index")
        ax.set_ylabel("amplitude (Re)")
        ax.legend(frameon=False)
        ax.grid(True, axis="y", alpha=0.3)

        # (c) Singular value spectrum of A
        svals = np.linalg.svd(A, compute_uv=False)
        ax = axes[2]
        ax.semilogy(np.arange(1, len(svals) + 1), svals, "o-", color="black", markersize=5)
        ax.set_xlabel("singular value index")
        ax.set_ylabel("singular value")
        ax.set_title(fr"$\kappa(A)={kappa:.1f}$", fontsize=9)
        ax.grid(True, which="both", alpha=0.3)

        # (d) 3D: error surface over (noise, trial_idx)
        ax = axes[3]
        sigmas_3d = np.logspace(-12, -1, 20)
        n_trials = 10
        err_grid = np.zeros((len(sigmas_3d), n_trials))
        for j in range(n_trials):
            rng_j = np.random.default_rng(42 + j)
            for i, sig in enumerate(sigmas_3d):
                I_clean2 = A @ s_true
                noise2 = (
                    rng_j.standard_normal(I_clean2.shape)
                    + 1j * rng_j.standard_normal(I_clean2.shape)
                ) * sig * np.linalg.norm(I_clean2)
                reg2 = max(1e-12, sig * 0.1)
                s_h2 = reconstruct_sources(A, I_clean2 + noise2, regularisation=reg2)
                err_grid[i, j] = float(
                    np.linalg.norm(s_true - s_h2) / np.linalg.norm(s_true)
                )
        S, T = np.meshgrid(np.log10(sigmas_3d), np.arange(n_trials))
        Z = np.log10(np.maximum(err_grid.T, 1e-18))
        ax.plot_surface(S, T, Z, cmap=cm.magma, edgecolor="none", alpha=0.9)
        ax.set_xlabel(r"$\log_{10}\sigma$")
        ax.set_ylabel("trial")
        ax.set_zlabel(r"$\log_{10}$ err")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_3_reconstruction.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 4: Viscosity vs refractive index
# -----------------------------------------------------------------------------


def panel_4_viscosity(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel(r"Panel 4. Viscosity $\mu$ vs refractive index $n_r$")

        names = [lq[0] for lq in LIQUIDS]
        mus = np.array([lq[1] for lq in LIQUIDS])
        nrs = np.array([lq[2] for lq in LIQUIDS])
        classes = [lq[3] for lq in LIQUIDS]

        class_colors = {
            "nonpolar": "tab:blue",
            "polar-aprotic": "tab:green",
            "aromatic": "tab:purple",
            "h-bond": "tab:red",
        }
        colors = [class_colors[c] for c in classes]

        # (a) mu vs n_r, log y, colored by class
        ax = axes[0]
        for cls in set(classes):
            idx = [i for i, c in enumerate(classes) if c == cls]
            ax.scatter(nrs[idx], mus[idx], c=class_colors[cls], label=cls, s=50)
        ax.set_yscale("log")
        ax.set_xlabel(r"refractive index $n_r$")
        ax.set_ylabel(r"viscosity $\mu$ (mPa$\cdot$s)")
        ax.legend(frameon=False, fontsize=7, loc="lower right")
        ax.grid(True, which="both", alpha=0.3)

        # (b) H-bond class with linear fit on log scale
        hb_idx = [i for i, c in enumerate(classes) if c == "h-bond"]
        nr_hb = nrs[hb_idx]
        mu_hb = mus[hb_idx]
        ax = axes[1]
        ax.semilogy(nr_hb, mu_hb, "o", color="tab:red", markersize=8)
        # annotate
        for i in hb_idx:
            ax.annotate(
                names[i].split()[0],
                (nrs[i], mus[i]),
                fontsize=6,
                xytext=(3, 3),
                textcoords="offset points",
            )
        rho_hb, p_hb = spearmanr(nr_hb, mu_hb)
        ax.set_xlabel(r"$n_r$ (H-bond class)")
        ax.set_ylabel(r"$\mu$ (mPa$\cdot$s)")
        ax.set_title(fr"$\rho_s={rho_hb:.3f}$, $p={p_hb:.1e}$", fontsize=9)
        ax.grid(True, which="both", alpha=0.3)

        # (c) Kendall concordance: for each pair, plot as segment colored by concordance
        ax = axes[2]
        n = len(LIQUIDS)
        concordant_pts = []
        discordant_pts = []
        for i in range(n):
            for j in range(i + 1, n):
                if mus[i] == mus[j] or nrs[i] == nrs[j]:
                    continue
                if np.sign(mus[i] - mus[j]) == np.sign(nrs[i] - nrs[j]):
                    concordant_pts.append((nrs[i], nrs[j], mus[i], mus[j]))
                else:
                    discordant_pts.append((nrs[i], nrs[j], mus[i], mus[j]))
        # Scatter concordance-rate by each liquid
        rates = []
        for i in range(n):
            c = 0
            total = 0
            for j in range(n):
                if i == j or mus[i] == mus[j] or nrs[i] == nrs[j]:
                    continue
                total += 1
                if np.sign(mus[i] - mus[j]) == np.sign(nrs[i] - nrs[j]):
                    c += 1
            rates.append(c / total if total else 0.0)
        ax.bar(np.arange(n), rates, color=colors)
        ax.set_xticks(np.arange(n))
        ax.set_xticklabels([s[:6] for s in names], rotation=55, ha="right", fontsize=6)
        ax.set_ylabel("pair concordance")
        ax.axhline(0.5, color="gray", lw=1, ls="--")
        ax.set_ylim(0, 1)
        ax.grid(True, axis="y", alpha=0.3)

        # (d) 3D: (n_r, mu, log10(mu)) with class-color and molecular-size surface hint
        ax = axes[3]
        sc = ax.scatter(
            nrs,
            np.log10(mus),
            np.arange(len(LIQUIDS)),
            c=colors,
            s=60,
            depthshade=True,
        )
        ax.set_xlabel(r"$n_r$")
        ax.set_ylabel(r"$\log_{10}\mu$")
        ax.set_zlabel("liquid index")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_4_viscosity.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 5: Conditioning scaling
# -----------------------------------------------------------------------------


def panel_5_conditioning(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel(r"Panel 5. Condition number scaling with cycle rank")

        targets = [1, 2, 3, 5, 7, 10]
        trials_per_C = 60
        kappa_by_C: dict[int, list[float]] = {C: [] for C in targets}

        for C_target in targets:
            for trial in range(trials_per_C):
                rng = np.random.default_rng(1000 * C_target + trial)
                got = _graph_with_target_cycle_rank(C_target, rng)
                if got is None:
                    continue
                omega, edges, _ = got
                K = C_target + 1
                sources = []
                for k in range(K):
                    d = rng.standard_normal(3)
                    d = d / np.linalg.norm(d)
                    mean_w = 1.0 / (float(np.mean(omega)) * 1e-4)
                    lam = mean_w * (0.6 + 0.8 * k / max(K - 1, 1))
                    sources.append(Source(direction=d, wavelength=float(lam)))
                A = build_transfer_matrix(omega, edges, sources)
                k_ = condition_number(A)
                if np.isfinite(k_) and k_ < 1e12:
                    kappa_by_C[C_target].append(k_)

        Cs = np.array(targets, dtype=float)
        medians = np.array([np.median(kappa_by_C[C]) for C in targets])
        q25 = np.array([np.percentile(kappa_by_C[C], 25) for C in targets])
        q75 = np.array([np.percentile(kappa_by_C[C], 75) for C in targets])

        # (a) Median with IQR band + power law fit
        alpha, beta = np.polyfit(np.log(Cs), np.log(medians), 1)
        ax = axes[0]
        ax.fill_between(Cs, q25, q75, alpha=0.3, color="tab:blue", label="IQR")
        ax.loglog(Cs, medians, "o-", color="tab:blue", label="median")
        ax.loglog(Cs, np.exp(beta) * Cs**alpha, "r--", lw=1,
                  label=fr"fit $C^{{{alpha:.2f}}}$")
        ax.set_xlabel("cycle rank C")
        ax.set_ylabel(r"$\kappa(A)$")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # (b) Distribution violin-like: boxplot across C
        ax = axes[1]
        data = [kappa_by_C[C] for C in targets]
        bp = ax.boxplot(data, positions=Cs, widths=0.5, showfliers=False,
                        patch_artist=True)
        for patch in bp["boxes"]:
            patch.set_facecolor("tab:blue")
            patch.set_alpha(0.4)
        ax.set_xlabel("cycle rank C")
        ax.set_ylabel(r"$\kappa(A)$ (linear)")
        ax.grid(True, axis="y", alpha=0.3)

        # (c) Capacity K = C+1 vs achievable noise tolerance
        # Noise tolerance: sigma such that kappa * sigma ~ 0.1 (10% error)
        ax = axes[2]
        noise_tol_median = 0.1 / medians
        noise_tol_upper = 0.1 / q25
        noise_tol_lower = 0.1 / q75
        K_vals = Cs + 1
        ax.fill_between(
            K_vals, noise_tol_lower, noise_tol_upper, alpha=0.3, color="tab:green"
        )
        ax.semilogy(K_vals, noise_tol_median, "o-", color="tab:green",
                    label="10% error threshold")
        ax.set_xlabel("source count K = C+1")
        ax.set_ylabel(r"tolerable noise $\sigma$")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # (d) 3D: kappa distribution surface over (C, percentile)
        ax = axes[3]
        pcts = np.linspace(10, 90, 17)
        Cgrid, Pgrid = np.meshgrid(Cs, pcts)
        Zgrid = np.zeros_like(Cgrid)
        for j, C in enumerate(targets):
            for i, p in enumerate(pcts):
                Zgrid[i, j] = np.percentile(kappa_by_C[C], p)
        ax.plot_surface(
            Cgrid,
            Pgrid,
            np.log10(Zgrid),
            cmap=cm.viridis,
            edgecolor="none",
            alpha=0.9,
        )
        ax.set_xlabel("C")
        ax.set_ylabel("percentile")
        ax.set_zlabel(r"$\log_{10}\kappa$")
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_5_conditioning.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------


def generate_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        panel_1_graph(out_dir),
        panel_2_coupling(out_dir),
        panel_3_reconstruction(out_dir),
        panel_4_viscosity(out_dir),
        panel_5_conditioning(out_dir),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="loop-coupling-plots")
    parser.add_argument("--output-dir", type=Path, default=Path("figures"))
    args = parser.parse_args(argv)

    paths = generate_all(args.output_dir)
    for p in paths:
        print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
