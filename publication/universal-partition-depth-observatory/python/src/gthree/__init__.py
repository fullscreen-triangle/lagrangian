"""gthree: three-route computation of the gravitational constant G.

Companion package to *Dimensionless Reduction of the Gravitational
Constant*. The Python path is for prototyping and CODATA cross-checks;
the Rust crate in `../rust` is the high-precision path using
arbitrary-precision arithmetic.
"""

from gthree.composition import T_labelled, angular_resolution, planck_depth
from gthree.routes import g_route_i, g_route_ii, g_route_iii, g_three_route_mean

__all__ = [
    "T_labelled",
    "angular_resolution",
    "g_route_i",
    "g_route_ii",
    "g_route_iii",
    "g_three_route_mean",
    "planck_depth",
]

__version__ = "0.1.0"
