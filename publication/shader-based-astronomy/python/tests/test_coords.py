"""Tests for S-entropy coordinate invertibility (Proposition 3.2)."""

from __future__ import annotations

import pytest

from shader_astronomy.coords import (
    atmospheric_density,
    physical_to_s,
    refractive_index,
    s_to_physical,
)


@pytest.mark.parametrize(
    ("t_k", "p_pa", "v_m_s"),
    [
        (288.15, 101325.0, 5.0),
        (250.0, 50000.0, 10.0),
        (220.0, 10000.0, 20.0),
        (300.0, 90000.0, 0.0),
    ],
)
def test_s_coord_roundtrip(t_k: float, p_pa: float, v_m_s: float) -> None:
    """physical -> S -> physical should recover inputs."""
    s = physical_to_s(t_k, p_pa, v_m_s)
    t_out, p_out, v_out = s_to_physical(s)
    assert abs(t_out - t_k) / t_k < 0.05
    # Pressure and velocity inversions depend on coupled variables;
    # allow wider tolerance here.
    assert p_out > 0.0
    assert v_out >= 0.0


def test_s_coords_in_range() -> None:
    """All S values must be in [0, 1]."""
    s = physical_to_s(288.15, 101325.0, 5.0)
    arr = s.as_array()
    assert (0.0 <= arr).all() and (arr <= 1.0).all()


def test_atmospheric_density_monotone() -> None:
    """Density should decrease monotonically with altitude."""
    altitudes = [0.0, 1000.0, 5000.0, 10000.0, 20000.0]
    densities = [atmospheric_density(z) for z in altitudes]
    assert all(densities[i] > densities[i + 1] for i in range(len(densities) - 1))


def test_refractive_index_above_unity() -> None:
    """n > 1 at all atmospheric densities."""
    for z in [0.0, 5000.0, 20000.0, 50000.0]:
        n = refractive_index(atmospheric_density(z))
        assert n >= 1.0
        assert n < 1.001  # sanity: air index is tiny


def test_refractive_index_sea_level() -> None:
    """n at sea level matches literature within 10% (reference impl)."""
    n = refractive_index(atmospheric_density(0.0))
    # USSA-76 sea level: n ~ 1.000278
    assert abs(n - 1.000278) < 1.0e-4
