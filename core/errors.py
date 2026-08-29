"""Criterios de error. El docente todavia no confirmo cual usa para revisar,
asi que los tres estan implementados y el criterio es un parametro."""
from __future__ import annotations

from enum import Enum


class ErrorCriterion(str, Enum):
    ABSOLUTE = "absoluto"
    RELATIVE = "relativo"
    RELATIVE_PERCENT = "relativo_porcentual"


def approx_error(
    current: float,
    previous: float | None,
    criterion: ErrorCriterion = ErrorCriterion.RELATIVE_PERCENT,
) -> float | None:
    """Error aproximado entre dos iteraciones consecutivas.

    Devuelve None en la primera iteracion, donde no hay valor anterior.
    """
    if previous is None:
        return None
    delta = abs(current - previous)
    if criterion is ErrorCriterion.ABSOLUTE:
        return delta
    if current == 0:
        return float("inf")
    relative = delta / abs(current)
    if criterion is ErrorCriterion.RELATIVE_PERCENT:
        return relative * 100.0
    return relative


def true_error(
    approximate: float,
    exact: float,
    criterion: ErrorCriterion = ErrorCriterion.RELATIVE_PERCENT,
) -> float:
    """Error verdadero contra un valor exacto conocido (para validar contra
    los ejercicios de referencia del docente)."""
    delta = abs(exact - approximate)
    if criterion is ErrorCriterion.ABSOLUTE:
        return delta
    if exact == 0:
        return float("inf")
    relative = delta / abs(exact)
    if criterion is ErrorCriterion.RELATIVE_PERCENT:
        return relative * 100.0
    return relative


def within_tolerance(error: float | None, tolerance: float) -> bool:
    """La primera iteracion (error None) nunca cumple la tolerancia."""
    return error is not None and error <= tolerance
