"""Harmonic-scattering loop-coupling validation suite.

Companion package to the paper *Harmonic-Scattering Loop Coupling*.
Reproduces the three numerical experiments and emits JSON + CSV outputs.
"""

from loop_coupling.graph import (
    cycle_rank,
    fundamental_cycles,
    harmonic_graph,
)
from loop_coupling.transfer import (
    build_transfer_matrix,
    reconstruct_sources,
)

__all__ = [
    "build_transfer_matrix",
    "cycle_rank",
    "fundamental_cycles",
    "harmonic_graph",
    "reconstruct_sources",
]

__version__ = "0.1.0"
