"""Shader-based astronomy: CPU reference implementation.

Companion package to the paper. Everything here is a numerical reference
against which the Rust/wgpu implementation is validated.
"""

from shader_astronomy.coords import SEntropy, physical_to_s, s_to_physical
from shader_astronomy.passes import (
    pass0_terrain_to_atmosphere,
    pass1_weather_step,
    pass2_position_resolve,
    pass3_light_raymarch,
    pass4_tonemap,
)

__all__ = [
    "SEntropy",
    "pass0_terrain_to_atmosphere",
    "pass1_weather_step",
    "pass2_position_resolve",
    "pass3_light_raymarch",
    "pass4_tonemap",
    "physical_to_s",
    "s_to_physical",
]

__version__ = "0.1.0"
