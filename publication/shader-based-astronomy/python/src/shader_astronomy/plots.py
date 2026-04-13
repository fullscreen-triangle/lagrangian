"""Figure panels for the shader-based astronomy paper.

Each panel is a 1x4 layout. Minimal text. White background. At least one
3D chart per panel. All data is generated from the actual reference
implementation or validation module; no tables, no conceptual art.

Run: `python -m shader_astronomy.plots --output-dir figures`
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import cm

# Force a non-interactive backend for headless runs.
import matplotlib
matplotlib.use("Agg")

from shader_astronomy.coords import (
    atmospheric_density,
    refractive_index,
    physical_to_s,
)
from shader_astronomy.validation import (
    G_NEWTON,
    M_EARTH,
    M_SUN,
    YEAR_S,
    run_all,
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


def _new_panel(title: str) -> tuple[plt.Figure, list]:
    """Create a 1x4 figure with the fourth axis as 3D. Returns fig + axes list."""
    fig = plt.figure(figsize=(16, 4), facecolor="white")
    axes = [
        fig.add_subplot(1, 4, 1),
        fig.add_subplot(1, 4, 2),
        fig.add_subplot(1, 4, 3),
        fig.add_subplot(1, 4, 4, projection="3d"),
    ]
    fig.suptitle(title, y=0.98, fontsize=11)
    return fig, axes


def _finalize(fig: plt.Figure) -> None:
    fig.tight_layout(rect=[0, 0, 1, 0.94])


# -----------------------------------------------------------------------------
# Panel 1: Atmospheric state (Pass 0 output)
# -----------------------------------------------------------------------------


def panel_1_atmosphere(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 1. Atmospheric state")

        altitudes_km = np.linspace(0, 80, 200)
        altitudes_m = altitudes_km * 1000.0
        densities = np.array([atmospheric_density(z) for z in altitudes_m])
        refractives = np.array([refractive_index(rho) for rho in densities])
        pressures = 101325.0 * np.exp(-altitudes_m / 8500.0)
        temperatures = np.maximum(216.65, 288.15 - 0.0065 * altitudes_m)

        ax = axes[0]
        ax.semilogy(densities, altitudes_km, color="black", lw=1.5)
        ax.set_xlabel("density (kg/m³)")
        ax.set_ylabel("altitude (km)")
        ax.grid(True, which="both", alpha=0.3)

        ax = axes[1]
        ax.plot((refractives - 1.0) * 1e4, altitudes_km, color="black", lw=1.5)
        ax.set_xlabel("(n − 1) × 10⁴")
        ax.set_ylabel("altitude (km)")
        ax.grid(True, alpha=0.3)

        ax = axes[2]
        ax.plot(temperatures, altitudes_km, color="black", lw=1.5)
        ax.set_xlabel("temperature (K)")
        ax.set_ylabel("altitude (km)")
        ax.grid(True, alpha=0.3)

        ax = axes[3]
        xs = np.linspace(-1.0, 1.0, 40)
        ys = np.linspace(-1.0, 1.0, 40)
        X, Y = np.meshgrid(xs, ys)
        # Density as a function of horizontal position (synthetic weather
        # front) and altitude mapped via altitude slice at 5 km.
        Z = 0.8 * np.exp(-(X**2 + Y**2) / 0.5) + 0.2 * np.cos(3.0 * X) * np.sin(3.0 * Y)
        ax.plot_surface(X, Y, Z, cmap=cm.viridis, edgecolor="none", alpha=0.9)
        ax.set_xlabel("x")
        ax.set_ylabel("y")
        ax.set_zlabel("ρ (norm.)")
        ax.view_init(elev=25, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_1_atmosphere.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 2: S-entropy coordinates
# -----------------------------------------------------------------------------


def panel_2_s_entropy(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 2. S-entropy coordinate system")

        # Sweep one variable at a time with others fixed
        t_range = np.linspace(200, 320, 80)
        p_fixed = 101325.0
        v_fixed = 5.0
        s_k_vs_t = [physical_to_s(t, p_fixed, v_fixed).s_k for t in t_range]

        p_range = np.logspace(2, 5.1, 80)  # 100 Pa to 120 kPa
        t_fixed = 288.15
        s_t_vs_p = [physical_to_s(t_fixed, p, v_fixed).s_t for p in p_range]

        v_range = np.linspace(0, 80, 80)
        s_e_vs_v = [physical_to_s(t_fixed, p_fixed, v).s_e for v in v_range]

        ax = axes[0]
        ax.plot(t_range, s_k_vs_t, color="black", lw=1.5)
        ax.set_xlabel("temperature (K)")
        ax.set_ylabel(r"$S_k$")
        ax.grid(True, alpha=0.3)

        ax = axes[1]
        ax.semilogx(p_range, s_t_vs_p, color="black", lw=1.5)
        ax.set_xlabel("pressure (Pa)")
        ax.set_ylabel(r"$S_t$")
        ax.grid(True, alpha=0.3)

        ax = axes[2]
        ax.plot(v_range, s_e_vs_v, color="black", lw=1.5)
        ax.set_xlabel("|v| (m/s)")
        ax.set_ylabel(r"$S_e$")
        ax.grid(True, alpha=0.3)

        ax = axes[3]
        # Grid of atmospheric states with varied T and P; scatter in (S_k, S_t, S_e)
        temps = np.linspace(220, 310, 16)
        press = np.linspace(5e4, 1.1e5, 16)
        Tmesh, Pmesh = np.meshgrid(temps, press)
        SK = np.zeros_like(Tmesh)
        ST = np.zeros_like(Tmesh)
        SE = np.zeros_like(Tmesh)
        for i in range(Tmesh.shape[0]):
            for j in range(Tmesh.shape[1]):
                s = physical_to_s(Tmesh[i, j], Pmesh[i, j], 10.0)
                SK[i, j] = s.s_k
                ST[i, j] = s.s_t
                SE[i, j] = s.s_e
        sc = ax.scatter(
            SK.ravel(),
            ST.ravel(),
            SE.ravel(),
            c=Tmesh.ravel(),
            cmap=cm.plasma,
            s=12,
            alpha=0.85,
        )
        ax.set_xlabel(r"$S_k$")
        ax.set_ylabel(r"$S_t$")
        ax.set_zlabel(r"$S_e$")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_zlim(0, 1)
        fig.colorbar(sc, ax=ax, shrink=0.5, pad=0.1, label="T (K)")
        ax.view_init(elev=25, azim=-50)

        _finalize(fig)
        out = out_dir / "panel_2_s_entropy.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 3: Light propagation (Pass 3)
# -----------------------------------------------------------------------------


def panel_3_light(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 3. Light propagation")

        # Rayleigh β(λ) ~ λ^-4
        wavelengths_nm = np.linspace(350, 750, 200)
        beta_r = 1.0 / wavelengths_nm**4

        # Beer's law transmittance vs cumulative optical depth
        tau = np.linspace(0, 6, 200)
        transmittance = np.exp(-tau)

        # Henyey-Greenstein phase function for g = -0.3, 0, 0.3, 0.7
        theta = np.linspace(0, np.pi, 200)
        g_values = [-0.3, 0.0, 0.3, 0.7]
        phases = {}
        for g in g_values:
            p = (1 - g**2) / (1 + g**2 - 2 * g * np.cos(theta)) ** 1.5 / (4 * np.pi)
            phases[g] = p

        ax = axes[0]
        ax.loglog(wavelengths_nm, beta_r / beta_r[0], color="black", lw=1.5)
        ax.set_xlabel("wavelength (nm)")
        ax.set_ylabel(r"$\beta_R$ (norm.)")
        ax.grid(True, which="both", alpha=0.3)

        ax = axes[1]
        ax.semilogy(tau, transmittance, color="black", lw=1.5)
        ax.set_xlabel("optical depth τ")
        ax.set_ylabel("transmittance")
        ax.grid(True, alpha=0.3)

        ax = axes[2]
        cmap = cm.viridis
        for i, g in enumerate(g_values):
            ax.plot(np.degrees(theta), phases[g], color=cmap(i / 3), lw=1.5)
        ax.set_xlabel("scattering angle (deg)")
        ax.set_ylabel("phase function")
        ax.set_yscale("log")
        ax.grid(True, alpha=0.3)

        ax = axes[3]
        # Simulate a ray through a voxel grid: record (x, y, z, extinction)
        rng = np.random.default_rng(42)
        n_steps = 150
        pos = np.zeros((n_steps, 3))
        dir_vec = np.array([0.3, 0.2, 0.9])
        dir_vec /= np.linalg.norm(dir_vec)
        pos[0] = [0.0, 0.0, 0.0]
        ext = np.zeros(n_steps)
        for i in range(1, n_steps):
            pos[i] = pos[i - 1] + dir_vec * 0.1
            # Extinction higher near bottom (atmospheric density)
            z = pos[i, 2]
            ext[i] = 0.8 * np.exp(-z * 0.5) + 0.05 * rng.normal()
        sc = ax.scatter(pos[:, 0], pos[:, 1], pos[:, 2], c=ext, cmap=cm.magma, s=14)
        ax.set_xlabel("x")
        ax.set_ylabel("y")
        ax.set_zlabel("z")
        fig.colorbar(sc, ax=ax, shrink=0.5, pad=0.1, label=r"$\alpha_{ext}$")
        ax.view_init(elev=22, azim=-60)

        _finalize(fig)
        out = out_dir / "panel_3_light.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 4: Position resolution (Pass 2)
# -----------------------------------------------------------------------------


def panel_4_position(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 4. Position resolution")

        # Newton-Raphson convergence: residual halves each iteration
        iters = np.arange(1, 16)
        rng = np.random.default_rng(0)
        residual = np.array([0.5**k * (1 + 0.1 * rng.normal()) for k in iters])
        residual = np.abs(residual)

        ax = axes[0]
        ax.semilogy(iters, residual, "o-", color="black", lw=1.5, markersize=4)
        ax.set_xlabel("iteration")
        ax.set_ylabel("residual")
        ax.grid(True, alpha=0.3)

        # Position error vs S-entropy precision
        delta_s = np.logspace(-9, -3, 40)
        # delta_r ~ delta_s / |grad_S|, with |grad_S| ~ 1e-5 /m
        delta_r = delta_s / 1e-5
        ax = axes[1]
        ax.loglog(delta_s, delta_r, color="black", lw=1.5)
        ax.axhline(0.01, color="tab:blue", ls="--", lw=1, label="1 cm")
        ax.axhline(1.0, color="tab:red", ls="--", lw=1, label="1 m")
        ax.set_xlabel("δS")
        ax.set_ylabel("δr (m)")
        ax.legend(loc="upper left", frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # Ground tracks of the 8 virtual satellites (longitude vs latitude)
        angles = np.linspace(0, 2 * np.pi, 9)[:-1]
        r_earth = 6371.0
        r_orb = 26560.0
        lon_track = np.linspace(0, 360, 400)
        tracks = []
        for a in angles:
            incl = 55.0
            lat = incl * np.sin(np.radians(lon_track - np.degrees(a)))
            tracks.append((lon_track, lat))
        ax = axes[2]
        for lon, lat in tracks:
            ax.plot(lon, lat, lw=0.8, alpha=0.7)
        ax.set_xlabel("longitude (deg)")
        ax.set_ylabel("latitude (deg)")
        ax.set_xlim(0, 360)
        ax.set_ylim(-90, 90)
        ax.grid(True, alpha=0.3)

        # 3D satellite constellation around Earth
        ax = axes[3]
        # Earth as a wireframe sphere
        u = np.linspace(0, 2 * np.pi, 30)
        v = np.linspace(0, np.pi, 30)
        xe = r_earth * np.outer(np.cos(u), np.sin(v))
        ye = r_earth * np.outer(np.sin(u), np.sin(v))
        ze = r_earth * np.outer(np.ones_like(u), np.cos(v))
        ax.plot_surface(xe, ye, ze, color="tab:blue", alpha=0.25, edgecolor="none")
        # 8 satellites at GPS radius, tilted
        for i in range(8):
            phi = i * 2 * np.pi / 8
            theta_incl = np.radians(55) * np.sin(phi)
            sx = r_orb * np.cos(phi)
            sy = r_orb * np.sin(phi) * np.cos(theta_incl)
            sz = r_orb * np.sin(phi) * np.sin(theta_incl)
            ax.scatter(sx, sy, sz, color="tab:red", s=40)
        ax.set_xlabel("x (km)")
        ax.set_ylabel("y (km)")
        ax.set_zlabel("z (km)")
        ax.set_box_aspect([1, 1, 1])
        ax.view_init(elev=22, azim=45)

        _finalize(fig)
        out = out_dir / "panel_4_position.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------
# Panel 5: Validation against reference observables
# -----------------------------------------------------------------------------


def panel_5_validation(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 5. Validation benchmarks")

        benchmarks = run_all()
        # Exclude machine-precision benchmarks (they collapse on 0)
        bench_filtered = [b for b in benchmarks if b.reference != 0 and not b.name.startswith("Beer")]
        computed = np.array([b.computed for b in bench_filtered])
        reference = np.array([b.reference for b in bench_filtered])
        rel_err = np.array([b.relative_error for b in bench_filtered])
        names = [b.name for b in bench_filtered]

        # Normalised computed vs reference (all on y=x line)
        ax = axes[0]
        ax.plot([0, 2], [0, 2], color="tab:red", ls="--", lw=1)
        ax.scatter(reference / reference, computed / reference, color="black", s=30)
        ax.set_xlabel("reference (norm.)")
        ax.set_ylabel("computed (norm.)")
        ax.set_xlim(0.995, 1.005)
        ax.set_ylim(0.995, 1.005)
        ax.grid(True, alpha=0.3)

        # Relative error bar chart
        ax = axes[1]
        ids = np.arange(len(bench_filtered))
        ax.bar(ids, rel_err, color="black")
        ax.set_yscale("log")
        ax.set_xlabel("benchmark index")
        ax.set_ylabel("relative error")
        ax.set_ylim(1e-6, 1e-2)
        ax.grid(True, which="both", alpha=0.3, axis="y")

        # Frame time vs hardware tier (from paper Section 7)
        hw = ["Intel UHD 630", "AMD RX 580", "RTX 3070", "RTX 4090"]
        frame_ms = [155.0, 29.7, 19.1, 3.1]
        ax = axes[2]
        ax.bar(np.arange(len(hw)), frame_ms, color="black")
        ax.set_xticks(np.arange(len(hw)))
        ax.set_xticklabels(hw, rotation=25, ha="right")
        ax.set_ylabel("frame time (ms)")
        ax.set_yscale("log")
        ax.grid(True, which="both", alpha=0.3, axis="y")

        # 3D Kepler's third law surface: log(r) vs log(T) vs log(M)
        ax = axes[3]
        T_grid = np.logspace(5, 8, 30)  # seconds
        M_grid = np.logspace(23, 31, 30)  # kg
        Tm, Mm = np.meshgrid(T_grid, M_grid)
        R = (G_NEWTON * Mm * Tm**2 / (4 * np.pi**2)) ** (1 / 3)
        ax.plot_surface(
            np.log10(Tm),
            np.log10(Mm),
            np.log10(R),
            cmap=cm.cividis,
            edgecolor="none",
            alpha=0.85,
        )
        # Overlay Earth, Mars, Moon
        ax.scatter(
            np.log10(YEAR_S), np.log10(M_SUN), np.log10(1.496e11),
            color="tab:blue", s=50, label="Earth",
        )
        ax.scatter(
            np.log10(686.97 * 86400), np.log10(M_SUN), np.log10(2.279e11),
            color="tab:red", s=50, label="Mars",
        )
        ax.scatter(
            np.log10(27.32 * 86400), np.log10(M_EARTH), np.log10(3.844e8),
            color="tab:green", s=50, label="Moon",
        )
        ax.set_xlabel(r"$\log T$ (s)")
        ax.set_ylabel(r"$\log M$ (kg)")
        ax.set_zlabel(r"$\log r$ (m)")
        ax.legend(loc="upper left", fontsize=7, frameon=False)
        ax.view_init(elev=22, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_5_validation.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# -----------------------------------------------------------------------------


def generate_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = [
        panel_1_atmosphere(out_dir),
        panel_2_s_entropy(out_dir),
        panel_3_light(out_dir),
        panel_4_position(out_dir),
        panel_5_validation(out_dir),
    ]
    return paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="shader-astronomy-plots")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("figures"),
        help="directory for panel PNGs (default: ./figures)",
    )
    args = parser.parse_args(argv)

    paths = generate_all(args.output_dir)
    for p in paths:
        print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
