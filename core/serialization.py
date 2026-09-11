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


def cell_value(value: Any) -> float | str | None:
    """Una celda de la tabla: numero finito, texto, o None.

    Las columnas declaradas con `numeric=False` llevan expresiones, no
    mediciones: el polinomio base de una interpolacion se muestra factorizado
    y no hay ningun float que lo represente. Pasar esas celdas por
    `finite_or_none` las borraba a todas.

    El texto viaja tal cual. Todo lo demas sigue la regla de siempre, asi que
    inf y NaN siguen saliendo como None.
    """
    if isinstance(value, str):
        return value
    return finite_or_none(value)


def jsonable_iteration(iteration: Iteration) -> dict[str, Any]:
    """Una fila lista para serializar, sin valores no finitos."""
    return {
        "n": iteration.n,
        "values": {
            clave: cell_value(valor)
            for clave, valor in iteration.values.items()
        },
        # El error siempre es una medicion: nunca lleva texto.
        "error": finite_or_none(iteration.error),
    }
