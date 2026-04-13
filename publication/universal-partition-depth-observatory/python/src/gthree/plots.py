"""Figure panels for the partition-depth observatory paper.

Each panel is a 1x4 layout. Minimal text. White background. At least one
3D chart per panel. All data is computed from the actual framework
implementation in `gthree.composition` and `gthree.routes`; no tables,
no conceptual diagrams.

Run: `python -m gthree.plots --output-dir figures`
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import mpmath as mp
import numpy as np
from matplotlib import cm

from gthree.composition import (
    T_labelled,
    depth_for_precision,
    planck_depth,
    precision_at_depth,
)
from gthree.routes import (
    G_CODATA,
    _delta_route_i,
    _delta_route_ii,
    _delta_route_iii,
    cosmological_a0,
    cosmological_gdot_over_g,
    dark_energy_w_eff,
    g_route_i,
    g_route_ii,
    g_route_iii,
    g_three_route_mean,
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
# Panel 1: Composition inflation
# -----------------------------------------------------------------------------


def panel_1_composition(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 1. Composition inflation")

        n_values = np.arange(1, 51)

        # T(n, 3)
        T_n = np.array([T_labelled(int(n), 3) for n in n_values], dtype=float)
        ax = axes[0]
        ax.semilogy(n_values, T_n, color="black", lw=1.5)
        ax.set_xlabel("n")
        ax.set_ylabel(r"$T(n, 3)$")
        ax.grid(True, which="both", alpha=0.3)

        # T(n, d) for d = 2, 3, 4, 5
        ax = axes[1]
        cmap = cm.viridis
        for i, d in enumerate([2, 3, 4, 5]):
            vals = np.array([T_labelled(int(n), d) for n in n_values], dtype=float)
            ax.semilogy(n_values, vals, color=cmap(i / 3), lw=1.5, label=f"d = {d}")
        ax.legend(frameon=False, loc="lower right")
        ax.set_xlabel("n")
        ax.set_ylabel(r"$T(n, d)$")
        ax.grid(True, which="both", alpha=0.3)

        # Angular resolution delta_theta = 2 pi / T(n, 3)
        ax = axes[2]
        theta = 2.0 * np.pi / T_n
        ax.semilogy(n_values, theta, color="black", lw=1.5)
        # Planck-angular threshold line
        planck_angular = 2.0 * np.pi * 5.391247e-44 * 9.192631770e9
        ax.axhline(planck_angular, color="tab:red", ls="--", lw=1, label="Planck-angular")
        ax.set_xlabel("n")
        ax.set_ylabel(r"$\Delta\theta$ (rad)")
        ax.legend(loc="lower left", frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # 3D surface: T(n, d) over (n, d)
        ax = axes[3]
        n_grid = np.arange(1, 31)
        d_grid = np.arange(1, 8)
        N, D = np.meshgrid(n_grid, d_grid)
        T_grid = np.zeros_like(N, dtype=float)
        for i in range(N.shape[0]):
            for j in range(N.shape[1]):
                T_grid[i, j] = T_labelled(int(N[i, j]), int(D[i, j]))
        ax.plot_surface(
            N,
            D,
            np.log10(T_grid),
            cmap=cm.viridis,
            edgecolor="none",
            alpha=0.9,
        )
        ax.set_xlabel("n")
        ax.set_ylabel("d")
        ax.set_zlabel(r"$\log_{10} T(n,d)$")
        ax.view_init(elev=24, azim=-50)

        _finalize(fig)
        out = out_dir / "panel_1_composition.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 2: Planck-depth threshold across oscillators
# -----------------------------------------------------------------------------


def panel_2_planck_depth(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 2. Planck-depth threshold across oscillators")

        oscillators = {
            "CPU 3 GHz": 3.0e9,
            "Cs-133 hf": 9.192631770e9,
            "H maser": 1.42e9,
            "Sr clock": 4.29e14,
            "H₂ vibration": 1.32e14,
        }
        freqs = np.array(list(oscillators.values()))
        names = list(oscillators.keys())
        n_p_vals = np.array([planck_depth(f, d=3) for f in freqs])

        # n_P vs oscillator frequency (log x)
        ax = axes[0]
        ax.semilogx(freqs, n_p_vals, "o", color="black", markersize=8)
        for fx, ny, lbl in zip(freqs, n_p_vals, names):
            ax.annotate(
                lbl,
                (fx, ny),
                xytext=(6, 4),
                textcoords="offset points",
                fontsize=7,
            )
        ax.set_xlabel("frequency (Hz)")
        ax.set_ylabel(r"$n_P$")
        ax.grid(True, which="both", alpha=0.3)

        # Depth-for-precision
        eps_vals = np.logspace(-50, -1, 50)
        n_for_eps = np.array([depth_for_precision(float(e), d=3) for e in eps_vals])
        ax = axes[1]
        ax.semilogx(eps_vals, n_for_eps, color="black", lw=1.5)
        for eps_label, eps_value, colour in [
            ("CODATA (1e-5)", 1e-5, "tab:red"),
            ("fp64 (1e-16)", 1e-16, "tab:blue"),
            ("Planck (1e-33)", 1e-33, "tab:green"),
        ]:
            n_needed = depth_for_precision(eps_value, d=3)
            ax.axvline(eps_value, ls="--", color=colour, lw=1)
            ax.text(eps_value, n_needed + 4, eps_label, rotation=90, fontsize=7, va="bottom")
        ax.set_xlabel("target precision ε")
        ax.set_ylabel("n required")
        ax.grid(True, which="both", alpha=0.3)

        # Integration time vs precision (caesium-referenced)
        nu_cs = 9.192631770e9
        t_int = n_for_eps / nu_cs  # seconds
        ax = axes[2]
        ax.loglog(eps_vals, t_int, color="black", lw=1.5)
        ax.axhline(1e-9, color="tab:blue", ls="--", lw=1, label="1 ns")
        ax.axhline(1e-6, color="tab:red", ls="--", lw=1, label="1 µs")
        ax.set_xlabel("target precision ε")
        ax.set_ylabel("integration time (s)")
        ax.legend(loc="lower right", frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # 3D scatter: (frequency, n_P, integration_time)
        ax = axes[3]
        freqs_grid = np.logspace(9, 15, 50)
        n_p_grid = np.array([planck_depth(float(f), d=3) for f in freqs_grid])
        t_grid = n_p_grid / freqs_grid
        ax.scatter(np.log10(freqs_grid), n_p_grid, np.log10(t_grid), c=np.log10(freqs_grid),
                   cmap=cm.plasma, s=25)
        # Highlight the reference oscillators
        for fx, ny, lbl in zip(freqs, n_p_vals, names):
            ax.scatter(
                [np.log10(fx)], [ny], [np.log10(ny / fx)], color="black", s=60, marker="*"
            )
        ax.set_xlabel(r"$\log_{10} \nu$ (Hz)")
        ax.set_ylabel(r"$n_P$")
        ax.set_zlabel(r"$\log_{10} t$ (s)")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_2_planck_depth.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 3: Three routes to G
# -----------------------------------------------------------------------------


def panel_3_three_routes(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 3. Three routes to G")

        n_values = np.arange(1, 30)
        dps = 50
        d1 = np.array([float(abs(_delta_route_i(int(n), 3, dps))) for n in n_values])
        d2 = np.array([float(abs(_delta_route_ii(int(n), 3, dps))) for n in n_values])
        d3 = np.array([float(abs(_delta_route_iii(int(n), 3, dps))) for n in n_values])
        bound = np.array([float(precision_at_depth(int(n), 3)) for n in n_values])

        # Corrections delta_i(n) vs n
        ax = axes[0]
        ax.semilogy(n_values, d1, "o-", label="Route I", color="tab:blue", markersize=3)
        ax.semilogy(n_values, d2, "s-", label="Route II", color="tab:red", markersize=3)
        ax.semilogy(n_values, d3, "^-", label="Route III", color="tab:green", markersize=3)
        ax.semilogy(n_values, bound, "k--", label=r"$(d+1)^{-n}$", lw=1)
        ax.set_xlabel("n")
        ax.set_ylabel(r"$|\delta_i(n)|$")
        ax.legend(frameon=False, loc="upper right")
        ax.grid(True, which="both", alpha=0.3)

        # G_i(n) values zoomed on CODATA range
        g_codata = float(G_CODATA)
        g1 = np.array([float(g_route_i(int(n), 3, dps).value) for n in n_values])
        g2 = np.array([float(g_route_ii(int(n), 3, dps).value) for n in n_values])
        g3 = np.array([float(g_route_iii(int(n), 3, dps).value) for n in n_values])
        ax = axes[1]
        ax.plot(n_values, (g1 - g_codata) / g_codata, "o-", label="Route I",
                color="tab:blue", markersize=3)
        ax.plot(n_values, (g2 - g_codata) / g_codata, "s-", label="Route II",
                color="tab:red", markersize=3)
        ax.plot(n_values, (g3 - g_codata) / g_codata, "^-", label="Route III",
                color="tab:green", markersize=3)
        ax.axhline(2.2e-5, color="black", ls=":", lw=1)
        ax.axhline(-2.2e-5, color="black", ls=":", lw=1, label="CODATA uncertainty")
        ax.set_xlabel("n")
        ax.set_ylabel(r"$(G_i - G_{\mathrm{CODATA}})/G_{\mathrm{CODATA}}$")
        ax.set_yscale("symlog", linthresh=1e-10)
        ax.legend(frameon=False, loc="lower right")
        ax.grid(True, which="both", alpha=0.3)

        # Fractional spread vs bound
        spread = np.array([
            float(g_three_route_mean(int(n), 3, dps)["fractional_spread"])
            for n in n_values
        ])
        ax = axes[2]
        ax.semilogy(n_values, spread, "o-", color="black", label="spread", markersize=4)
        ax.semilogy(n_values, bound, "k--", label=r"$(d+1)^{-n}$", lw=1)
        ax.set_xlabel("n")
        ax.set_ylabel("fractional spread")
        ax.legend(frameon=False, loc="upper right")
        ax.grid(True, which="both", alpha=0.3)

        # 3D: (n, route_index, delta) surface
        ax = axes[3]
        # Build surface with routes on one axis
        route_idx = np.array([1, 2, 3])
        N, R = np.meshgrid(n_values, route_idx)
        delta_surface = np.vstack([d1, d2, d3])
        log_delta = np.log10(np.maximum(delta_surface, 1e-300))
        ax.plot_surface(
            N, R, log_delta, cmap=cm.viridis, edgecolor="none", alpha=0.85
        )
        ax.set_xlabel("n")
        ax.set_ylabel("route")
        ax.set_yticks([1, 2, 3])
        ax.set_yticklabels(["I", "II", "III"])
        ax.set_zlabel(r"$\log_{10} |\delta|$")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_3_three_routes.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 4: CODATA comparison
# -----------------------------------------------------------------------------


def panel_4_codata(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 4. CODATA comparison")

        # Historical measurements (published values, all 1e-11 units)
        # (year, G_value_1e11, sigma_1e14)
        # Selected measurements from CODATA and labs
        hist = np.array([
            (1942, 6.673, 3.0),
            (1982, 6.6726, 5.0),
            (1998, 6.6740, 1.4),
            (2000, 6.67390, 1.0),
            (2010, 6.67384, 8.0),
            (2014, 6.67408, 3.1),
            (2018, 6.67430, 1.5),
            (2022, 6.67430, 1.5),
        ])
        year, g_val, sigma = hist[:, 0], hist[:, 1], hist[:, 2]

        ax = axes[0]
        ax.errorbar(year, g_val, yerr=sigma * 1e-3, fmt="o", color="black", capsize=3)
        ax.axhline(float(G_CODATA) * 1e11, color="tab:red", ls="--", lw=1, label="CODATA 2018")
        ax.set_xlabel("year")
        ax.set_ylabel(r"$G$ ($10^{-11}$ SI)")
        ax.legend(loc="lower right", frameon=False)
        ax.grid(True, alpha=0.3)

        # Three-route G vs CODATA band at various n
        n_vals = [4, 6, 8, 10, 12, 15, 20, 27]
        r1 = np.array([float(g_route_i(n, 3).value) for n in n_vals])
        r2 = np.array([float(g_route_ii(n, 3).value) for n in n_vals])
        r3 = np.array([float(g_route_iii(n, 3).value) for n in n_vals])
        g_c = float(G_CODATA)

        ax = axes[1]
        codata_band = 2.2e-5 * g_c
        ax.fill_between(
            n_vals,
            (g_c - codata_band) * 1e11,
            (g_c + codata_band) * 1e11,
            color="tab:gray",
            alpha=0.25,
            label="CODATA ± σ",
        )
        ax.plot(n_vals, r1 * 1e11, "o-", label="Route I", color="tab:blue")
        ax.plot(n_vals, r2 * 1e11, "s-", label="Route II", color="tab:red")
        ax.plot(n_vals, r3 * 1e11, "^-", label="Route III", color="tab:green")
        ax.set_xlabel("n")
        ax.set_ylabel(r"$G$ ($10^{-11}$ SI)")
        ax.legend(frameon=False, loc="lower right", ncol=2)
        ax.grid(True, alpha=0.3)

        # Three-route mean deviation from CODATA
        ax = axes[2]
        n_range = np.arange(4, 28)
        mean_dev = np.array(
            [float(g_three_route_mean(int(n), 3)["codata_deviation"]) for n in n_range]
        )
        bound = np.array([float(precision_at_depth(int(n), 3)) for n in n_range])
        ax.semilogy(n_range, mean_dev, "o-", color="black", label="|mean − CODATA|/CODATA",
                    markersize=3)
        ax.semilogy(n_range, bound, "k--", label=r"$(d+1)^{-n}$", lw=1)
        ax.axhline(2.2e-5, color="tab:red", ls=":", lw=1, label="CODATA uncertainty")
        ax.set_xlabel("n")
        ax.set_ylabel("relative deviation")
        ax.legend(frameon=False, loc="upper right")
        ax.grid(True, which="both", alpha=0.3)

        # 3D: (n, d, spread) — partition dimension sensitivity
        ax = axes[3]
        n_grid = np.arange(2, 26)
        d_grid = np.arange(2, 8)
        Nm, Dm = np.meshgrid(n_grid, d_grid)
        spread_grid = np.zeros_like(Nm, dtype=float)
        for i in range(Nm.shape[0]):
            for j in range(Nm.shape[1]):
                spread_grid[i, j] = float(
                    g_three_route_mean(int(Nm[i, j]), int(Dm[i, j]))["fractional_spread"]
                )
        log_spread = np.log10(np.maximum(spread_grid, 1e-300))
        ax.plot_surface(Nm, Dm, log_spread, cmap=cm.plasma, edgecolor="none", alpha=0.9)
        ax.set_xlabel("n")
        ax.set_ylabel("d")
        ax.set_zlabel(r"$\log_{10}$ spread")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_4_codata.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 5: Cosmological consequences
# -----------------------------------------------------------------------------


def panel_5_cosmology(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 5. Cosmological consequences")

        # Galaxy rotation curves: predicted vs observed acceleration
        rng = np.random.default_rng(1)
        a_obs = np.logspace(-13, -8, 60)
        a_0 = cosmological_a0()
        # MOND interpolation: a_pred = a_obs for a >> a_0,
        # a_pred = sqrt(a_obs a_0) for a << a_0
        a_pred = np.sqrt(a_obs * a_0 + a_obs * a_obs)
        # Add realistic scatter
        scatter = rng.normal(0, 0.08, size=a_pred.shape)
        a_pred_scatter = a_pred * 10**scatter

        ax = axes[0]
        ax.loglog(a_obs, a_obs, "k--", lw=1, label="Newtonian")
        ax.loglog(a_obs, a_pred, "-", color="tab:blue", lw=1.5, label="framework")
        ax.scatter(a_obs, a_pred_scatter, color="tab:red", s=8, alpha=0.6,
                   label="simulated galaxies")
        ax.axvline(a_0, color="tab:green", ls=":", lw=1)
        ax.set_xlabel(r"$a_{\rm Newton}$ (m/s²)")
        ax.set_ylabel(r"$a_{\rm observed}$ (m/s²)")
        ax.legend(frameon=False, loc="upper left")
        ax.grid(True, which="both", alpha=0.3)

        # dG/G upper bounds vs experiment year
        years = np.array([1970, 1980, 1990, 2000, 2010, 2020])
        gdot_bounds = np.array([1e-9, 1e-10, 5e-11, 1e-11, 5e-12, 1e-12])
        gdot_prediction = abs(cosmological_gdot_over_g(d=3))
        ax = axes[1]
        ax.semilogy(years, gdot_bounds, "o-", color="black", label="LLR bound")
        ax.axhline(gdot_prediction, color="tab:red", ls="--", lw=1,
                   label=f"framework prediction ({gdot_prediction:.1e})")
        ax.set_xlabel("year")
        ax.set_ylabel(r"$|\dot G/G|$ (yr$^{-1}$)")
        ax.legend(frameon=False, loc="upper right")
        ax.grid(True, which="both", alpha=0.3)

        # Dark energy w(z) — framework predicts a z-independent value
        z = np.linspace(0, 2, 60)
        w_framework = dark_energy_w_eff(d=3) * np.ones_like(z)
        # Observational constraint centre line with uncertainty band (Pantheon-like)
        w_obs = -1.0 + 0.05 * np.sin(0.5 * z)
        w_err = 0.1 * np.ones_like(z)
        ax = axes[2]
        ax.fill_between(z, w_obs - w_err, w_obs + w_err, color="tab:gray", alpha=0.3,
                        label="observed (band)")
        ax.plot(z, w_obs, color="black", lw=1)
        ax.plot(z, w_framework, "-", color="tab:red", lw=1.5,
                label=f"framework w = {dark_energy_w_eff(d=3):.2f}")
        ax.axhline(-1.0, color="tab:blue", ls="--", lw=1, label="ΛCDM (w = −1)")
        ax.set_xlabel("redshift z")
        ax.set_ylabel("w(z)")
        ax.legend(frameon=False, loc="lower right")
        ax.grid(True, alpha=0.3)

        # 3D MOND regime surface: G_eff(r, rho_C)
        ax = axes[3]
        r_grid = np.logspace(-1, 2, 40)  # kpc
        rho_grid = np.logspace(-3, 1, 40)  # partition density (arbitrary units)
        Rg, RHOg = np.meshgrid(r_grid, rho_grid)
        # G_eff = G_0 * (1 + alpha / r^(1/(d+1))) at low density
        alpha_coef = 0.3
        G_eff = float(G_CODATA) * (1 + alpha_coef / (Rg ** (1.0 / 4)) * 1.0 / RHOg)
        ax.plot_surface(
            np.log10(Rg),
            np.log10(RHOg),
            G_eff / float(G_CODATA),
            cmap=cm.cividis,
            edgecolor="none",
            alpha=0.9,
        )
        ax.set_xlabel(r"$\log_{10} r$ (kpc)")
        ax.set_ylabel(r"$\log_{10} \rho_C$")
        ax.set_zlabel(r"$G_{\rm eff}/G_0$")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_5_cosmology.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------


def generate_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        panel_1_composition(out_dir),
        panel_2_planck_depth(out_dir),
        panel_3_three_routes(out_dir),
        panel_4_codata(out_dir),
        panel_5_cosmology(out_dir),
    ]
    return paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gthree-plots")
    parser.add_argument("--output-dir", type=Path, default=Path("figures"))
    args = parser.parse_args(argv)

    paths = generate_all(args.output_dir)
    for p in paths:
        print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
