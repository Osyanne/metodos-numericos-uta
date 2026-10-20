"""Lectura de entradas compartida por las reglas de integracion.

El guion bajo inicial hace que el autoload no lo registre como metodo. Lo usan
el Trapecio y Simpson, que piden los mismos campos: f(x), a, b y n.
"""
from __future__ import annotations

import math
from typing import Any

from core.expression import parse
from core.types import MethodError


def leer_funcion(params: dict[str, Any]) -> Any:
    texto = params.get("fx")
    if texto is None or not str(texto).strip():
        raise MethodError("Hace falta la funcion f(x) para integrar.")
    return parse(str(texto))


def leer_numero(params: dict[str, Any], clave: str, etiqueta: str) -> float:
    valor = params.get(clave)
    if valor is None or valor == "":
        raise MethodError(f"Hace falta {etiqueta}.")
    if isinstance(valor, bool):
        raise MethodError(f"{etiqueta} tiene que ser un numero finito.")
    try:
        numero = float(valor)
    except (TypeError, ValueError, OverflowError) as exc:
        raise MethodError(
            f"{etiqueta} tiene que ser un numero, y llego '{valor}'."
        ) from exc
    if not math.isfinite(numero):
        raise MethodError(f"{etiqueta} tiene que ser un numero finito.")
    return numero


def leer_entero_positivo(
    params: dict[str, Any], clave: str, etiqueta: str
) -> int:
    valor = params.get(clave)
    if valor is None or valor == "":
        raise MethodError(f"Hace falta {etiqueta}.")
    if isinstance(valor, bool):
        raise MethodError(f"{etiqueta} tiene que ser un entero positivo.")
    numero = leer_numero({"__aux__": valor}, "__aux__", etiqueta)
    if not numero.is_integer() or numero <= 0:
        raise MethodError(f"{etiqueta} tiene que ser un entero positivo.")
    return int(numero)


def validar_intervalo(a: float, b: float) -> None:
    if a == b:
        raise MethodError(
            "El intervalo [a, b] es vacio: a y b tienen que ser distintos."
        )
    if b < a:
        raise MethodError(
            f"El extremo superior b = {b:g} tiene que ser mayor que el "
            f"extremo inferior a = {a:g}. Si buscabas la integral con signo "
            f"cambiado, intercambia los valores: la integral de b a a es "
            f"menos la integral de a a b."
        )
