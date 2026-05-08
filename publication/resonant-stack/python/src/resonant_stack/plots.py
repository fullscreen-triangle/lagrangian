"""Five figure panels for the resonant stack paper.

Each panel: 1×4 layout (three 2D + one 3D). White background, serif font.
All data computed live from the physics modules — no lookup tables.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import cm

from resonant_stack.composition import (
    T_inflation,
    arp_across_cycles,
    cavity_finesse,
    information_redundancy_bits,
    log_spaced_oscillator_network,
    precision_at_depth,
    residue_fraction,
)
from resonant_stack.optics import (
    FLUIDS,
    LAMBDA5_UM,
    LAMBDA_UM,
    build_stack,
    build_transfer_matrix,
    cauchy_n,
    matrix_rank_svd,
    propagate_ray_full,
)
from resonant_stack.temporal import (
    joint_distribution,
    optical_path_length_per_round_trip,
    temporal_delay_all_loops,
    verify_shapiro_equivalence,
)
from resonant_stack.triple import (
    beer_lambert_transmittance,
    capacity_factor_from_transmittance,
    triple_identity_cross_validate,
)

# ---------------------------------------------------------------------------
# Style
# ---------------------------------------------------------------------------

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

FLUID_COLORS = {
    "water":    "#1f77b4",
    "glycerol": "#ff7f0e",
    "ethanol":  "#2ca02c",
    "benzene":  "#d62728",
    "cs2":      "#9467bd",
    "toluene":  "#8c564b",
    "olive_oil":"#e377c2",
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


# ===========================================================================
# Panel 1: Cauchy Dispersion and Discrete Snell Transitions
# ===========================================================================


def panel_1_dispersion(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 1. Cauchy Dispersion and Discrete Snell Transitions")

        lam_um = np.linspace(0.38, 0.75, 300)
        lam_nm = lam_um * 1000.0

        # --- subplot 1: n(λ) for all fluids ---
        ax = axes[0]
        for name, (A, B) in FLUIDS.items():
            n_vals = cauchy_n(A, B, lam_um)
            ax.plot(lam_nm, n_vals, color=FLUID_COLORS.get(name, "gray"),
                    lw=1.5, label=name.replace("_", " "))
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("Refractive index n(λ)")
        ax.legend(frameon=False, fontsize=7, ncol=1, loc="upper right")
        ax.grid(True, alpha=0.3)

        # --- subplot 2: discrete Snell output angle vs λ for 3 input angles ---
        ax = axes[1]
        stack_5 = build_stack(["water", "glycerol", "ethanol", "benzene", "cs2"], 500.0)
        lam_probe = LAMBDA5_UM
        lam_probe_nm = lam_probe * 1000.0
        theta_inputs = np.deg2rad([5.0, 15.0, 25.0])

        for theta0 in theta_inputs:
            angles, _ = propagate_ray_full(stack_5, lam_probe, theta0, n_partition=12)
            # Exit angle is not computed by propagate_ray_full; use last layer n
            # For visualization, plot the angle inside the last layer
            out_deg = np.rad2deg(angles[:, -1])
            ax.plot(lam_probe_nm, out_deg, "o-", ms=5,
                    label=f"θ₀={np.rad2deg(theta0):.0f}°")
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("Angle inside last layer (°)")
        ax.legend(frameon=False)
        ax.grid(True, alpha=0.3)

        # --- subplot 3: Transfer matrix (5×5 heatmap) ---
        ax = axes[2]
        theta_inputs_5 = np.deg2rad([5, 10, 15, 20, 25])
        A_mat = build_transfer_matrix(stack_5, lam_probe, theta_inputs_5, n_partition=12)
        im = ax.imshow(
            np.rad2deg(A_mat),
            aspect="auto",
            cmap="viridis",
            origin="lower",
        )
        plt.colorbar(im, ax=ax, label="Output angle (°)")
        ax.set_xlabel("Input angle index j")
        ax.set_ylabel("Wavelength index k")
        ax.set_xticks(range(5))
        ax.set_xticklabels(["5°", "10°", "15°", "20°", "25°"])
        ax.set_yticks(range(5))
        ax.set_yticklabels([f"{int(l*1000)}" for l in lam_probe])
        ax.set_title("Transfer matrix (°)")

        # --- subplot 4 (3D): n(λ, fluid) surface ---
        ax = axes[3]
        fluid_names = list(FLUIDS.keys())
        lam_grid = np.linspace(0.38, 0.75, 40)
        n_surface = np.zeros((len(fluid_names), len(lam_grid)))
        for fi, (name, (A, B)) in enumerate(FLUIDS.items()):
            n_surface[fi, :] = cauchy_n(A, B, lam_grid)
        fi_grid = np.arange(len(fluid_names))
        Lam, Fi = np.meshgrid(lam_grid, fi_grid)
        ax.plot_surface(Lam * 1000, Fi, n_surface, cmap="plasma",
                        edgecolor="none", alpha=0.9)
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("fluid")
        ax.set_yticks(fi_grid)
        ax.set_yticklabels([n[:3] for n in fluid_names], fontsize=6)
        ax.set_zlabel("n(λ)")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_1_dispersion.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# ===========================================================================
# Panel 2: Spectral Separability Theorem
# ===========================================================================


def panel_2_separability(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 2. Spectral Separability Theorem")

        fluid_names = ["water", "glycerol", "ethanol", "benzene", "cs2"]
        theta_inputs_5 = np.deg2rad([5, 10, 15, 20, 25])

        # --- subplot 1: singular values of the 5×5 transfer matrix ---
        ax = axes[0]
        stack_5 = build_stack(fluid_names, 500.0)
        A_mat = build_transfer_matrix(stack_5, LAMBDA5_UM, theta_inputs_5, n_partition=12)
        sv = np.linalg.svd(A_mat, compute_uv=False)
        ax.semilogy(range(1, 6), np.rad2deg(sv), "o-", color="black", ms=6)
        ax.set_xlabel("Singular value index")
        ax.set_ylabel("Singular value (°)")
        ax.set_title(f"rank = {matrix_rank_svd(A_mat)}")
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 2: rank vs number of distinct fluid layers N ---
        ax = axes[1]
        n_layer_range = range(1, 6)
        ranks = []
        for k in n_layer_range:
            stack_k = build_stack(fluid_names[:k], 500.0)
            A_k = build_transfer_matrix(
                stack_k, LAMBDA5_UM[:k], theta_inputs_5[:k], n_partition=12
            )
            ranks.append(matrix_rank_svd(A_k))
        ax.plot(list(n_layer_range), ranks, "o-", color="black", ms=6)
        ax.set_xlabel("Number of distinct layers N")
        ax.set_ylabel("rank(A_N)")
        ax.set_xticks(list(n_layer_range))
        ax.axhline(5, color="tab:red", ls="--", lw=1, label="full rank")
        ax.legend(frameon=False)
        ax.grid(True, alpha=0.3)

        # --- subplot 3: condition number vs partition depth n_partition ---
        ax = axes[2]
        n_partition_vals = range(5, 20)
        cond_vals = []
        for np_val in n_partition_vals:
            A_k = build_transfer_matrix(stack_5, LAMBDA5_UM, theta_inputs_5, n_partition=np_val)
            sv_k = np.linalg.svd(A_k, compute_uv=False)
            cond_vals.append(float(sv_k[0] / max(sv_k[-1], 1e-30)))
        ax.semilogy(list(n_partition_vals), cond_vals, "o-", color="black", ms=4)
        ax.set_xlabel("Partition depth n")
        ax.set_ylabel("Condition number κ")
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 4 (3D): transfer matrix A as surface over (wavelength, angle) ---
        ax = axes[3]
        lam_idx = np.arange(5)
        ang_idx = np.arange(5)
        L_grid, A_grid = np.meshgrid(lam_idx, ang_idx)
        A_deg = np.rad2deg(A_mat)
        ax.plot_surface(L_grid, A_grid, A_deg.T, cmap="viridis",
                        edgecolor="none", alpha=0.9)
        ax.set_xlabel("λ index")
        ax.set_ylabel("θ index")
        ax.set_zlabel("Output angle (°)")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_2_separability.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# ===========================================================================
# Panel 3: Temporal Echo Delays and Shapiro Equivalence
# ===========================================================================


def panel_3_temporal(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 3. Temporal Echo Delays and Shapiro Equivalence")

        stack = build_stack(
            ["water", "glycerol", "ethanol", "benzene", "cs2"], 500.0
        )
        theta0 = np.deg2rad(15.0)
        angles, _ = propagate_ray_full(stack, LAMBDA5_UM, theta0, n_partition=12)
        n_loops = np.arange(1, 21)
        delays = temporal_delay_all_loops(stack, LAMBDA5_UM, angles, n_loops)
        lam_nm = LAMBDA5_UM * 1000.0

        # --- subplot 1: Δτ vs loop count (linear) for all wavelengths ---
        ax = axes[0]
        colors_lam = cm.rainbow(np.linspace(0, 1, 5))
        for k in range(5):
            ax.plot(n_loops, delays[:, k], "o-", ms=3, color=colors_lam[k],
                    label=f"{lam_nm[k]:.0f} nm")
        ax.set_xlabel("Loop count $n_\\ell$")
        ax.set_ylabel("Delay Δτ (ps)")
        ax.legend(frameon=False, ncol=1, fontsize=7)
        ax.grid(True, alpha=0.3)

        # --- subplot 2: differential delay (blue vs red) vs loop count ---
        ax = axes[1]
        delta_tau = delays[:, 0] - delays[:, -1]  # 400 vs 700 nm
        ax.plot(n_loops, delta_tau, "o-", color="black", ms=4)
        # Linear fit to verify linear scaling
        slope = np.polyfit(n_loops, delta_tau, 1)[0]
        tau0_diff = float(delays[0, 0] - delays[0, -1])
        ax.plot(n_loops, n_loops * tau0_diff, "r--", lw=1.5,
                label=f"linear fit slope={slope:.4f}")
        ax.set_xlabel("Loop count $n_\\ell$")
        ax.set_ylabel("δτ(400–700 nm) (ps)")
        ax.legend(frameon=False)
        ax.grid(True, alpha=0.3)

        # --- subplot 3: OPL delay vs Shapiro delay (cross-validation) ---
        ax = axes[2]
        n_loop_test = 10
        tau_opl, tau_shap, rel_err = verify_shapiro_equivalence(
            stack, LAMBDA5_UM, angles, n_loop_test
        )
        ax.plot(lam_nm, tau_opl, "o-", color="tab:blue", label="OPL dispersive")
        ax.plot(lam_nm, tau_shap, "s--", color="tab:red", label="Shapiro dispersive")
        ax2 = ax.twinx()
        ax2.semilogy(lam_nm, rel_err + 1e-20, "^:", color="gray", ms=4,
                     label="rel. error")
        ax2.set_ylabel("Relative error", color="gray")
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("Dispersive delay (ps)")
        lines1, labels1 = ax.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax.legend(lines1 + lines2, labels1 + labels2, frameon=False, fontsize=7)
        ax.grid(True, alpha=0.3)

        # --- subplot 4 (3D): (λ, n_loop, delay) surface ---
        ax = axes[3]
        lam_g, nl_g = np.meshgrid(lam_nm, n_loops)
        ax.plot_surface(lam_g, nl_g, delays, cmap="plasma",
                        edgecolor="none", alpha=0.9)
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("$n_\\ell$")
        ax.set_zlabel("Δτ (ps)")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_3_temporal.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# ===========================================================================
# Panel 4: Triple Observation Identity
# ===========================================================================


def panel_4_triple(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 4. Triple Observation Identity")

        alpha_vals = np.logspace(-3, 1, 200)  # μm⁻¹
        L = 100.0  # μm

        data = triple_identity_cross_validate(alpha_vals, L)
        aL = alpha_vals * L  # dimensionless α·L

        # --- subplot 1: T, 1/(1+k'), and V_frac vs αL (should all be identical) ---
        ax = axes[0]
        ax.semilogx(aL, data["T"], "-", color="tab:blue", lw=2, label="T (Beer–Lambert)")
        ax.semilogx(aL, 1.0 / (1.0 + data["k_prime"]), "--", color="tab:red", lw=1.5,
                    label="1/(1+k') (Chrom.)")
        ax.semilogx(aL, data["V_frac"], ":", color="tab:green", lw=2,
                    label="V_frac (Kirchhoff)")
        ax.set_xlabel("αL (optical depth)")
        ax.set_ylabel("Partition fraction")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 2: recovered α from all three arms ---
        ax = axes[1]
        ax.loglog(alpha_vals, data["alpha_bl"], "-", color="tab:blue", lw=2,
                  label="BL arm")
        ax.loglog(alpha_vals, data["alpha_chrom"], "--", color="tab:red", lw=1.5,
                  label="Chrom. arm")
        ax.loglog(alpha_vals, data["alpha_kv"], ":", color="tab:green", lw=2,
                  label="Kirchhoff arm")
        ax.loglog(alpha_vals, alpha_vals, "k-", lw=0.8, label="identity")
        ax.set_xlabel("α_true (μm⁻¹)")
        ax.set_ylabel("α_recovered (μm⁻¹)")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 3: cross-validation residuals ---
        ax = axes[2]
        ax.loglog(alpha_vals, data["err_bl"] + 1e-17, "-", color="tab:blue", lw=1.5,
                  label="BL err")
        ax.loglog(alpha_vals, data["err_chrom"] + 1e-17, "--", color="tab:red", lw=1.5,
                  label="Chrom. err")
        ax.loglog(alpha_vals, data["err_kv"] + 1e-17, ":", color="tab:green", lw=1.5,
                  label="KV err")
        ax.axhline(1e-12, color="black", ls="--", lw=0.8, label="10⁻¹² threshold")
        ax.set_xlabel("α (μm⁻¹)")
        ax.set_ylabel("Relative error")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 4 (3D): (αL, arm_index, recovered_α) surface ---
        ax = axes[3]
        arm_idx = np.array([1, 2, 3])
        alpha_sub = np.logspace(-2, 1, 30)
        aL_sub = alpha_sub * L
        data_sub = triple_identity_cross_validate(alpha_sub, L)

        A_surf = np.vstack([
            data_sub["alpha_bl"],
            data_sub["alpha_chrom"],
            data_sub["alpha_kv"],
        ])
        aL_grid, arm_grid = np.meshgrid(np.log10(aL_sub), arm_idx)
        ax.plot_surface(aL_grid, arm_grid, np.log10(A_surf + 1e-30),
                        cmap="viridis", edgecolor="none", alpha=0.9)
        ax.set_xlabel("log₁₀(αL)")
        ax.set_ylabel("arm")
        ax.set_yticks([1, 2, 3])
        ax.set_yticklabels(["BL", "Cr", "KV"])
        ax.set_zlabel("log₁₀ α_rec")
        ax.view_init(elev=24, azim=-55)

        _finalize(fig)
        out = out_dir / "panel_4_triple.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# ===========================================================================
# Panel 5: Composition Inflation, Residue, and Categorical Clock
# ===========================================================================


def panel_5_composition(out_dir: Path) -> Path:
    with plt.rc_context(PLT_STYLE):
        fig, axes = _new_panel("Panel 5. Composition Inflation, Residue, and Output Tensor")

        # --- subplot 1: T(n,d) growth + 4D tensor slice echo intensities ---
        ax = axes[0]
        n_vals = np.arange(1, 16)
        T3 = np.array([T_inflation(int(n), 3) for n in n_vals], dtype=float)
        T2 = np.array([T_inflation(int(n), 2) for n in n_vals], dtype=float)
        ax.semilogy(n_vals, T3, "o-", color="black", label="T(n,3)", ms=4)
        ax.semilogy(n_vals, T2, "s--", color="gray", label="T(n,2)", ms=4)
        # Overlay residue fraction
        ax.axhline(27, color="tab:red", ls=":", lw=1, label="b³=27")
        ax.set_xlabel("n (partition depth / loop count)")
        ax.set_ylabel("T(n,d)")
        ax.legend(frameon=False)
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 2: A + R + P decomposition over 20 cycles ---
        ax = axes[1]
        arp = arp_across_cycles(20, b=3, d=3)
        cycles = arp[:, 0]
        A_per = arp[:, 1]
        R_per = arp[:, 2]
        P_per = arp[:, 3]
        ax.fill_between(cycles, 0, A_per, alpha=0.7, color="tab:blue", label="A (actualised)")
        ax.fill_between(cycles, A_per, A_per + R_per, alpha=0.7,
                        color="tab:orange", label="R (residue)")
        ax.fill_between(cycles, A_per + R_per, 1.0, alpha=0.3,
                        color="tab:gray", label="P (potential)")
        ax.set_xlabel("Cycle k")
        ax.set_ylabel("Fraction of unit measure")
        ax.set_ylim(0, 1.05)
        ax.set_xlim(1, 20)
        ax.legend(frameon=False)
        ax.grid(True, alpha=0.3)
        f_R = residue_fraction(3, 3)
        F = cavity_finesse(f_R)
        ax.set_title(f"f_R = 26/27, finesse F ≈ {F:.1f}")

        # --- subplot 3: echo intensities (output tensor slice) ---
        ax = axes[2]
        stack = build_stack(["water", "glycerol", "ethanol", "benzene", "cs2"], 500.0)
        theta0 = np.deg2rad(15.0)
        angles, _ = propagate_ray_full(stack, LAMBDA5_UM, theta0, n_partition=12)
        n_loops = np.arange(1, 16)
        intensities, delays = joint_distribution(stack, LAMBDA5_UM, angles, n_loops)
        lam_nm = LAMBDA5_UM * 1000.0
        colors_lam = cm.rainbow(np.linspace(0, 1, 5))
        for k in range(5):
            ax.semilogy(n_loops, intensities[:, k], "o-", ms=3, color=colors_lam[k],
                        label=f"{lam_nm[k]:.0f} nm")
        # Overplot finesse prediction: I_n = f_R^n
        I_finesse = f_R ** n_loops.astype(float)
        ax.semilogy(n_loops, I_finesse, "k--", lw=1.5, label=f"$f_R^{{n}}$")
        ax.set_xlabel("Loop $n_\\ell$")
        ax.set_ylabel("Echo intensity I_{n_ℓ}(λ)")
        ax.legend(frameon=False, ncol=2, fontsize=7)
        ax.grid(True, which="both", alpha=0.3)

        # --- subplot 4 (3D): (λ, n_loop, intensity) — 4D tensor slice obs=BL ---
        ax = axes[3]
        lam_g, nl_g = np.meshgrid(lam_nm, n_loops)
        log_I = np.log10(intensities + 1e-30)
        ax.plot_surface(lam_g, nl_g, log_I, cmap="magma",
                        edgecolor="none", alpha=0.9)
        ax.set_xlabel("λ (nm)")
        ax.set_ylabel("$n_\\ell$")
        ax.set_zlabel("log₁₀ I")
        ax.view_init(elev=24, azim=-55)
        ax.set_title("4D tensor slice O[λ, n_ℓ, BL]")

        _finalize(fig)
        out = out_dir / "panel_5_composition.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
    return out


# ===========================================================================
# Runner
# ===========================================================================


def generate_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        panel_1_dispersion(out_dir),
        panel_2_separability(out_dir),
        panel_3_temporal(out_dir),
        panel_4_triple(out_dir),
        panel_5_composition(out_dir),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="resonant-stack-plots")
    parser.add_argument("--output-dir", type=Path, default=Path("figures"))
    args = parser.parse_args(argv)
    paths = generate_all(args.output_dir)
    for p in paths:
        print(f"wrote {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
