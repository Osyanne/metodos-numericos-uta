"""Precision configurable por el usuario.

Requisito del docente: 6 decimales por defecto, ajustable, con minimo de 2.
Modulo puro: no importa nada del resto del nucleo.
"""
from __future__ import annotations

MIN_DECIMALS = 2
MAX_DECIMALS = 12
DEFAULT_DECIMALS = 6


def clamp_decimals(decimals: int | None) -> int:
    """Devuelve un numero de decimales valido dentro del rango permitido."""
    if decimals is None:
        return DEFAULT_DECIMALS
    return max(MIN_DECIMALS, min(MAX_DECIMALS, int(decimals)))


def round_value(value: float, decimals: int) -> float:
    """Redondea respetando infinitos y NaN sin reventar."""
    if value is None:
        return None
    if value != value or value in (float("inf"), float("-inf")):
        return value
    return round(float(value), clamp_decimals(decimals))


def format_value(value: float, decimals: int) -> str:
    """Representacion de ancho fijo para la tabla de iteraciones."""
    d = clamp_decimals(decimals)
    if value is None:
        return "-"
    if value != value:
        return "NaN"
    if value == float("inf"):
        return "inf"
    if value == float("-inf"):
        return "-inf"
    return f"{float(value):.{d}f}"
