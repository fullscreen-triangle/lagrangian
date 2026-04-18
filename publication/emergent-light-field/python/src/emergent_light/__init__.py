"""Emergent Light Field — reference implementation and validation harness."""

from emergent_light.membrane import (
    BANDS,
    CLASS_NAMES,
    build_membrane,
    classify_pixel,
    fingerprint,
    pixel_spectrum,
    sky_reference_model,
    source_time_series,
)

__all__ = [
    "BANDS",
    "CLASS_NAMES",
    "build_membrane",
    "classify_pixel",
    "fingerprint",
    "pixel_spectrum",
    "sky_reference_model",
    "source_time_series",
]

__version__ = "0.1.0"
