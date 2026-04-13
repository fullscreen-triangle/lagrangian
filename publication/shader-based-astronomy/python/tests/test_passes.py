"""Smoke tests for the five-pass pipeline reference implementation."""

from __future__ import annotations

import numpy as np

from shader_astronomy.passes import (
    pass0_terrain_to_atmosphere,
    pass1_weather_step,
    pass3_light_raymarch,
    pass4_tonemap,
)


def test_pass0_produces_valid_volume() -> None:
    terrain = np.zeros((16, 16, 4), dtype=np.float64)
    volume = pass0_terrain_to_atmosphere(terrain, nz=32)
    assert volume.shape == (16, 16, 32)
    # S-entropy channels in [0,1]
    assert (volume.data[..., :3] >= 0.0).all()
    assert (volume.data[..., :3] <= 1.0).all()
    # Refractive index >= 1 everywhere
    assert (volume.data[..., 3] >= 1.0).all()


def test_pass0_density_decreases_with_altitude() -> None:
    """Refractive index at high altitude should be smaller than at sea level."""
    terrain = np.zeros((4, 4, 4), dtype=np.float64)
    volume = pass0_terrain_to_atmosphere(terrain, nz=16)
    n_sea = volume.data[0, 0, 0, 3]
    n_top = volume.data[0, 0, -1, 3]
    assert n_sea > n_top


def test_pass1_preserves_bounds() -> None:
    """Weather step should not push S-entropy outside [0,1]."""
    terrain = np.zeros((8, 8, 4), dtype=np.float64)
    volume = pass0_terrain_to_atmosphere(terrain, nz=16)
    stepped = pass1_weather_step(volume)
    assert (stepped.data[..., :3] >= 0.0).all()
    assert (stepped.data[..., :3] <= 1.0).all()


def test_pass3_beer_law() -> None:
    """With non-trivial atmosphere, transmittance should be < 1 and positive."""
    terrain = np.zeros((8, 8, 4), dtype=np.float64)
    volume = pass0_terrain_to_atmosphere(terrain, nz=32)
    origin = np.array([100.0, 100.0, 0.0])
    direction = np.array([0.0, 0.0, 1.0])
    t, _intensity = pass3_light_raymarch(volume, origin, direction)
    assert 0.0 < t <= 1.0


def test_pass4_tonemap_bounds() -> None:
    """Tone map always produces values in [0, 1]."""
    radiance = np.array([0.0, 0.5, 1.0, 10.0, 100.0])
    out = pass4_tonemap(radiance)
    assert (out >= 0.0).all()
    assert (out <= 1.0).all()
