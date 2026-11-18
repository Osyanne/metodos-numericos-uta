"""Validacion de puntos y formato comun de los interpoladores."""
from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

import sympy

from core.types import MethodError


def _validar_puntos(raw: Any) -> list[tuple[float, float]]:
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        raise MethodError("Se necesita una tabla con al menos dos puntos [x, y].")
    if len(raw) < 2:
        raise MethodError("Se necesitan al menos dos puntos para interpolar.")

    puntos: list[tuple[float, float]] = []
    for indice, punto in enumerate(raw, start=1):
        if (
            not isinstance(punto, Sequence)
            or isinstance(punto, (str, bytes))
            or len(punto) != 2
        ):
            raise MethodError(
                f"El punto {indice} debe tener exactamente dos valores [x, y]."
            )
        xi = _numero_finito(punto[0], f"La x del punto {indice}")
        yi = _numero_finito(punto[1], f"La y del punto {indice}")
        puntos.append((xi, yi))

    vistos: set[float] = set()
    for xi, _ in puntos:
        if xi in vistos:
            raise MethodError(
                f"La abscisa x = {xi:g} esta repetida; todas las x deben ser distintas."
            )
        vistos.add(xi)
    return puntos


def _numero_finito(raw: Any, nombre: str) -> float:
    if isinstance(raw, bool):
        raise MethodError(f"{nombre} debe ser un numero finito.")
    try:
        numero = float(raw)
    except (TypeError, ValueError, OverflowError) as exc:
        raise MethodError(f"{nombre} debe ser un numero.") from exc
    if not math.isfinite(numero):
        raise MethodError(f"{nombre} debe ser un numero finito.")
    return numero


def _binomio(izquierda: str, valor: sympy.Expr) -> str:
    """Escribe (izquierda - valor) con el signo ya resuelto.

    Se conserva el (x - 0) en vez de reducirlo a x: asi la fila se lee contra
    la tabla de puntos sin tener que reconstruir que termino falta.
    """
    signo = "-" if valor >= 0 else "+"
    return f"({izquierda} {signo} {_numero(abs(valor))})"


def _numero(valor: sympy.Expr) -> str:
    return str(int(valor)) if valor.is_Integer else str(float(valor))
