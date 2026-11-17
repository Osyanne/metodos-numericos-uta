"""Regla de Simpson 3/8 compuesta para integracion numerica.

Sustituye la curva por arcos de cubica: cada cubica pasa por cuatro nodos
equiespaciados, o sea por un tramo de tres subintervalos. n tiene que ser
multiplo de 3, con h = (b - a) / n y x_i = a + i * h.

Caso simple (n = 3, una sola cubica):

    integral(f, a, b) ~= (b - a) / 8 * [f(x0) + 3 f(x1) + 3 f(x2) + f(x3)]

Compuesta (Chapra), el mismo factor 3h/8 con los pesos de cada nodo:

    integral(f, a, b) ~= (3h / 8) * [f(x_0)
        + 3 * sum(f(x_i), i no multiplo de 3)
        + 2 * sum(f(x_i), i multiplo de 3 e interior)
        + f(x_n)]

Los nodos en frontera entre dos tramos (i = 3, 6, ...) pesan 1 + 1 = 2: por
eso la tabla lee 1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1.
"""
from __future__ import annotations

import math
from typing import Any

from core import plots
from core.config import SolveConfig
from core.methods._integracion import (
    leer_entero_positivo,
    leer_funcion,
    leer_numero,
    validar_intervalo,
)
from core.registry import register
from core.sampling import sample
from core.types import (
    Column,
    FieldKind,
    InputField,
    Iteration,
    MethodError,
    MethodResult,
    MethodSpec,
    Resample,
    StopReason,
)

SLUG = "simpson-38"

# Mismo limite que las otras reglas: cada subintervalo es una fila de la tabla.
MAX_SUBINTERVALOS = 10_000
PUNTOS_GRAFICA = 401

# La tabla sigue el corchete punto por punto, de x0 a xn. La suma del corchete
# es el numero que se escribe antes de multiplicar por 3h/8.
COLUMNAS = [
    Column("xi", "x"),
    Column("fxi", "f(x)"),
    Column("peso", "peso"),
    Column("ponderado", "peso * f(x)"),
    Column("suma", "suma del corchete"),
]


def _peso(i: int, n: int) -> float:
    if i in (0, n):
        return 1.0
    return 2.0 if i % 3 == 0 else 3.0


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de ``f`` en [a, b] con arcos de cubica."""
    f = leer_funcion(params)
    a = leer_numero(params, "a", "el extremo inferior a")
    b = leer_numero(params, "b", "el extremo superior b")
    n = leer_entero_positivo(params, "n", "el numero de subintervalos n")
    validar_intervalo(a, b)

    if n % 3:
        raise MethodError(
            f"n = {n} no es múltiplo de 3. Simpson 3/8 toma tramos de tres "
            "subintervalos (cuatro nodos por cubica): usa n = 3, 6, 9, ... "
            "Si n tiene que ser otro, Simpson 1/3 pide n par."
        )
    if n > MAX_SUBINTERVALOS:
        raise MethodError(
            f"Se piden {n} subintervalos y el maximo es {MAX_SUBINTERVALOS}. "
            "Cada punto es una fila de la tabla que se calcula y se guarda "
            "entera en memoria; con mas que eso deja de ser legible. Reduce n."
        )

    h = (b - a) / n
    if not math.isfinite(h) or h == 0:
        raise MethodError("El ancho de subintervalo h no es finito: revisa a, b y n.")
    factor = 3 * h / 8

    # x_i = a + i*h, sin acumular h, y el ultimo punto es b por construccion.
    xs = [b if i == n else a + i * h for i in range(n + 1)]
    iteraciones: list[Iteration] = []
    valores_f: list[float] = []
    corchete = 0.0
    for i, xi in enumerate(xs):
        fxi = f.evaluar(x=xi)
        peso = _peso(i, n)
        ponderado = peso * fxi
        corchete += ponderado
        valores_f.append(fxi)
        iteraciones.append(
            Iteration(
                n=i,
                values={
                    "xi": xi,
                    "fxi": fxi,
                    "peso": peso,
                    "ponderado": ponderado,
                    "suma": corchete,
                },
                error=None,
            )
        )
    integral = factor * corchete
    if not math.isfinite(integral):
        raise MethodError(
            "La suma del corchete se desborda: los valores de f(x) son "
            "demasiado grandes para calcular la integral en punto flotante."
        )

    curva_x, curva_y = sample(str(f), x_min=a, x_max=b, puntos=PUNTOS_GRAFICA)
    # Una cubica por tramo de tres subintervalos: los nodos 3k .. 3k + 3.
    cubicas = [
        [(xs[j + d], valores_f[j + d]) for d in range(4)] for j in range(0, n, 3)
    ]

    notas = [
        f"∫[{a:g}, {b:g}] ({f}) dx ≈ {integral:.6f}",
        f"{n} subintervalos de ancho h = {h:g}, agrupados en {n // 3} "
        f"tramo{'s' if n > 3 else ''} de tres: una cubica por tramo. Los "
        "extremos pesan 1, los nodos interiores de cada tramo 3 y los que "
        "unen dos tramos 2.",
        f"La suma del corchete es {corchete:.8f}; multiplicada por "
        f"3h/8 = {factor:g} da la integral.",
        "La columna de error queda vacia: este es un metodo de malla fija. "
        "Para estimar la exactitud, resuelve otra vez con el doble de "
        "subintervalos y compara las aproximaciones.",
    ]

    return MethodResult(
        method=SLUG,
        columns=COLUMNAS,
        iterations=iteraciones,
        result={
            "integral": integral,
            "corchete": corchete,
            "factor": factor,
            "h": h,
            "a": a,
            "b": b,
            "n": n,
        },
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
            cubicas=cubicas,
        ),
        notes=notas,
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Simpson 3/8",
        unit="U1",
        family="integracion",
        orden=8,
        description=(
            "Aproxima una integral definida sustituyendo la curva por arcos "
            "de cubica que pasan por cuatro nodos equiespaciados, uno por "
            "cada tramo de tres subintervalos, y sumando el area bajo ellos."
        ),
        reference=(
            "(3h/8) * [f(x0) + 3*sum(f(xi), i no multiplo de 3) "
            "+ 2*sum(f(xi), i multiplo de 3) + f(xn)], h = (b - a)/n, n multiplo de 3"
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
                label="Numero de subintervalos n (múltiplo de 3)",
                kind=FieldKind.INTEGER,
                default=6,
                help=(
                    "Tiene que ser múltiplo de 3: cada cubica usa tres "
                    "subintervalos. Con n = 3 se usa una sola cubica sobre "
                    "[a, b]; con n = 6, 9, ... se encadenan tramos de tres."
                ),
            ),
        ],
        solve=solve,
    )
)
