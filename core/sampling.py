"""Muestreo de una expresion sobre un rango, para el plano interactivo.

CONGELADO: lo consume el endpoint de muestreo.

La grafica es un plano tipo GeoGebra: el usuario hace zoom y paneo, y la curva
se recalcula en el rango visible. Quien evalua es siempre el nucleo, nunca el
navegador, para que no existan dos parsers que puedan discrepar.
"""
from __future__ import annotations

from core.expression import parse
from core.types import MethodError

MAX_PUNTOS = 5000
MIN_PUNTOS = 2


def sample(
    expresion: str,
    x_min: float,
    x_max: float,
    puntos: int = 400,
    variables: tuple[str, ...] = ("x",),
) -> tuple[list[float], list[float | None]]:
    """Evalua la expresion en `puntos` valores igualmente espaciados.

    Devuelve dos listas de la misma longitud. En los x donde la funcion no esta
    definida, el y correspondiente es None: la interfaz tiene que **cortar la
    linea** ahi, no unir los dos lados. Sin eso, `1/x` se dibuja con una raya
    vertical falsa cruzando el asintota, y `tan(x)` queda irreconocible.
    """
    if x_min >= x_max:
        raise MethodError(
            f"El rango [{x_min:g}, {x_max:g}] esta invertido o es vacio."
        )
    if not MIN_PUNTOS <= puntos <= MAX_PUNTOS:
        raise MethodError(
            f"Se piden {puntos} puntos: el limite va de {MIN_PUNTOS} a {MAX_PUNTOS}."
        )

    funcion = parse(expresion, variables=variables)
    variable = variables[0]

    paso = (x_max - x_min) / (puntos - 1)
    xs: list[float] = []
    ys: list[float | None] = []

    for i in range(puntos):
        x = x_min + i * paso
        xs.append(x)
        ys.append(funcion.evaluar_seguro(**{variable: x}))

    return xs, ys
