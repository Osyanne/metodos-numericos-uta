"""JSON no admite Infinity ni NaN, y JSON.parse del navegador los rechaza.

El nucleo si los produce (un error relativo con divisor cero es infinito),
asi que todo valor numerico cruza por aca antes de salir por HTTP.
"""
from __future__ import annotations

import math
from typing import Any

from core.types import Iteration


def finite_or_none(value: Any) -> float | None:
    """Convierte inf, -inf y NaN en None. El resto pasa como float."""
    if value is None:
        return None
    try:
        numero = float(value)
    except (TypeError, ValueError):
        return None
    return numero if math.isfinite(numero) else None


def jsonable_iteration(iteration: Iteration) -> dict[str, Any]:
    """Una fila lista para serializar, sin valores no finitos."""
    return {
        "n": iteration.n,
        "values": {
            clave: finite_or_none(valor)
            for clave, valor in iteration.values.items()
        },
        "error": finite_or_none(iteration.error),
    }
