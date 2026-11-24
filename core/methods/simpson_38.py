"""Regla de Simpson 3/8 para integracion numerica, con aplicacion multiple.

Sustituye la curva por arcos de cubica: cada cubica pasa por cuatro nodos
equiespaciados, o sea por un tramo de tres subintervalos de ancho h.

Caso simple (n = 3, una sola cubica; "ancho por altura promedio"):

    integral(f, a, b) ~= (b - a) * [f(x0) + 3 f(x1) + 3 f(x2) + f(x3)] / 8
                       = (3h/8) * [f(x0) + 3 f(x1) + 3 f(x2) + f(x3)]

Error del caso simple: Et = -((b - a)^5 / 6480) * f(xi) = -(3/80) h^5 f(xi).

n multiplo de 3 (compuesta, Chapra): h = (b - a) / n, x_i = a + i * h,

    integral(f, a, b) ~= (3h / 8) * [f(x_0)
        + 3 * sum(f(x_i), i no multiplo de 3)
        + 2 * sum(f(x_i), i multiplo de 3 e interior)
        + f(x_n)]

Los nodos en frontera entre dos tramos (i = 3, 6, ...) pesan 1 + 1 = 2: por
eso la tabla lee 1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1.

n que NO es multiplo de 3 (aplicacion multiple del docente, Chapra ejemplo
21.6): la regla 1/3 cubre los primeros subintervalos (2 si n mod 3 = 2, 4 si
n mod 3 = 1) y la 3/8 el resto. Cada regla lleva su corchete y su factor, y la
integral es la suma de las dos. Con n = 1, 2 o 4 no queda un tramo de 3/8 y el
metodo falla diciendolo.
"""
from __future__ import annotations

import math
from typing import Any

from core import plots
from core.config import SolveConfig
from core.methods._simpson import (
    arcos,
    leer_problema,
    malla,
    nodos,
    partir,
    PUNTOS_GRAFICA,
    recorrer,
)
from core.registry import register
from core.sampling import sample
from core.types import (
    Column,
    FieldKind,
    InputField,
    MethodError,
    MethodResult,
    MethodSpec,
    Resample,
    StopReason,
)

SLUG = "simpson-38"

# La tabla sigue el corchete nodo por nodo. Con n que no es multiplo de 3 el
# nodo de union se repite (ultimo de la 1/3, primero de la 3/8) y "nodo" y
# "regla" dicen de cual se trata. La suma arranca de cero con cada regla: la
# ultima fila de un tramo muestra su corchete.
COLUMNAS = [
    Column("nodo", "nodo", numeric=False),
    Column("xi", "x"),
    Column("fxi", "f(x)"),
    Column("regla", "regla", numeric=False),
    Column("peso", "peso"),
    Column("ponderado", "peso * f(x)"),
    Column("suma", "suma del corchete"),
]


def _notas(f, a, b, n, h, integral, tramos, cortes):
    notas = [f"∫[{a:g}, {b:g}] ({f.legible}) dx ≈ {integral:.6f}"]
    if len(tramos) == 1:
        t = tramos[0]
        notas += [
            f"{n} subintervalos de ancho h = {h:g}, agrupados en {n // 3} "
            f"tramo{'s' if n > 3 else ''} de tres: una cúbica por tramo. Los "
            "extremos pesan 1, los nodos interiores de cada tramo 3 y los que "
            "unen dos tramos 2.",
            f"La suma del corchete es {t['corchete']:.8f}; multiplicada por "
            f"3h/8 = {t['factor']:g} da la integral.",
        ]
    else:
        uno, otro = tramos
        k13 = cortes[0][2]
        parabolas = k13 // 2
        notas += [
            f"n = {n} no es múltiplo de 3: se combinan las dos reglas de "
            f"Simpson. La regla 1/3 cubre los primeros {k13} subintervalos "
            f"(de x0 = {uno['desde']:g} a x{k13} = {uno['hasta']:g}, "
            f"{parabolas} parábola{'s' if parabolas > 1 else ''}) y la regla "
            f"3/8 los {n - k13} restantes (de x{k13} = {otro['desde']:g} a "
            f"x{n} = {otro['hasta']:g}, {(n - k13) // 3} "
            f"cúbica{'s' if n - k13 > 3 else ''}).",
            f"Regla 1/3: corchete {uno['corchete']:.8f} por h/3 = "
            f"{uno['factor']:g} da {uno['integral']:.8f}. Regla 3/8: corchete "
            f"{otro['corchete']:.8f} por 3h/8 = {otro['factor']:g} da "
            f"{otro['integral']:.8f}. La integral es la suma, "
            f"{integral:.8f}.",
            f"El nodo x{k13} = {uno['hasta']:g} aparece dos veces en la "
            "tabla: como último de la regla 1/3 y como primero de la 3/8, "
            "cada vez con peso 1. La suma del corchete arranca de cero en "
            "cada regla.",
        ]
    notas.append(
        "La columna de error queda vacía: este es un método de malla fija. "
        "Para estimar la exactitud, resuelve otra vez con el doble de "
        "subintervalos y compara las aproximaciones."
    )
    return notas


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de ``f`` en [a, b] con cubicas (y parabolas si hace falta)."""
    f, a, b, n = leer_problema(params)
    tramos = partir(n)
    h, xs, fs = malla(f, a, b, n)

    iteraciones, resumen = recorrer(tramos, xs, fs, h, con_regla=True)
    integral = sum(t["integral"] for t in resumen)
    if not math.isfinite(integral):
        raise MethodError(
            "La suma del corchete se desborda: los valores de f(x) son "
            "demasiado grandes para calcular la integral en punto flotante."
        )

    curva_x, curva_y = sample(str(f), x_min=a, x_max=b, puntos=PUNTOS_GRAFICA)
    parabolas, cubicas, filas = arcos(tramos, xs, fs)

    resultado: dict[str, Any] = {"integral": integral}
    if len(resumen) == 1:
        # Un solo corchete y un solo factor: los de toda la integral.
        resultado |= {"corchete": resumen[0]["corchete"], "factor": resumen[0]["factor"]}
    resultado |= {"h": h, "a": a, "b": b, "n": n, "tramos": resumen}

    return MethodResult(
        method=SLUG,
        columns=COLUMNAS,
        iterations=iteraciones,
        result=resultado,
        converged=True,
        stop_reason=StopReason.COMPLETED,
        decimals=cfg.decimals,
        plot=plots.integration(
            curva_x,
            curva_y,
            [],
            a=a,
            b=b,
            integral=integral,
            title=f"Simpson 3/8 sobre f(x) = {f}",
            resample=Resample(expression=str(f), domain=(a, b)),
            parabolas=parabolas,
            cubicas=cubicas,
            nodos=nodos(tramos, xs, fs),
            filas_arcos=filas,
        ),
        notes=_notas(f, a, b, n, h, integral, resumen, tramos),
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Simpson 3/8",
        unit="U1",
        family="integracion",
        orden=9,
        description=(
            "Aproxima una integral definida sustituyendo la curva por arcos "
            "de cubica que pasan por cuatro nodos equiespaciados, uno por "
            "cada tramo de tres subintervalos, y sumando el area bajo ellos. "
            "Simple (n = 3): (b - a) * [f(x0) + 3f(x1) + 3f(x2) + f(x3)] / 8. "
            "Si n no es multiplo de 3 (n = 5 o mas) combina las dos "
            "reglas de Simpson: la 1/3 en los primeros subintervalos y la "
            "3/8 en el resto, como en la aplicacion multiple del docente. "
            "Con la misma malla, Simpson 1/3 pide n par."
        ),
        reference=(
            "n = 3: (b - a) * [f(x0) + 3f(x1) + 3f(x2) + f(x3)] / 8, "
            "Et = -(b - a)^5/6480 * f''''(xi). Compuesta: (3h/8) * [f(x0) "
            "+ 3*sum(f(xi), i no multiplo de 3) + 2*sum(f(xi), i multiplo de 3) "
            "+ f(xn)], h = (b - a)/n, n multiplo de 3. Otro n (5, 7, 8, ...): 1/3 + 3/8"
        ),
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="sqrt(5 + x^3)",
                help=(
                    "La funcion a integrar. Se puede escribir como en clase: "
                    "x^2, sqrt(5 + x^3), sin(x), exp(-x^2)."
                ),
            ),
            InputField(
                name="a",
                label="Extremo inferior a",
                kind=FieldKind.NUMBER,
                default=0.0,
            ),
            InputField(
                name="b",
                label="Extremo superior b",
                kind=FieldKind.NUMBER,
                default=1.0,
            ),
            InputField(
                name="n",
                label="Numero de subintervalos n (3 o mas, menos 4)",
                kind=FieldKind.INTEGER,
                default=6,
                help=(
                    "Con n multiplo de 3 cada cubica usa tres subintervalos: "
                    "n = 3 es una sola cubica sobre [a, b]; con n = 6, 9, ... "
                    "se encadenan tramos de tres. Con otro n (5, 7, 8, ...) "
                    "la regla 1/3 cubre los primeros subintervalos y la 3/8 "
                    "el resto. n = 1, 2 y 4 no se pueden."
                ),
            ),
        ],
        solve=solve,
    )
)
