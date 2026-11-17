"""Regla de Simpson 1/3 para integracion numerica, como en Simpson1.pdf.

Sustituye la curva por arcos de parabola: cada parabola pasa por tres nodos
equiespaciados, o sea por un tramo de dos subintervalos. n tiene que ser par:
dx = (b - a) / n, n intervalos dan n + 1 puntos x_i = a + i * dx.

    integral(f, a, b) ~= (dx/3) * [f(x_0) + 4 f(x_1) + 2 f(x_2) + 4 f(x_3) + ...
                                   + 2 f(x_(n-2)) + 4 f(x_(n-1)) + f(x_n)]
                       = (b - a) * [f(x_0) + 4*sum(impares) + 2*sum(pares) + f(x_n)] / (3n)

Caso simple (n = 2): (b - a) * [f(x0) + 4 f(x1) + f(x2)] / 6, con
Et = -((b - a)^5 / 2880) * f''''(xi). Multiple: Ea = -((b - a)^5 / (180 n^4)) *
(promedio de f'''').

No es el mismo metodo que "Metodo de Simpson" (simpson), que sigue el primer
PDF del docente y cuenta n de otra forma: ahi cada subintervalo aporta ademas
su punto medio. Son la misma regla: simpson con n (par, n >= 4) da exactamente
lo mismo que esta con 2n; con n = 2, una sola parabola, simpson y esta dan lo
mismo con n = 2.
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

SLUG = "simpson-13"

# La tabla sigue el corchete del pizarron punto por punto, de x0 a xn. La suma
# del corchete es el numero que se escribe antes de multiplicar por dx/3.
COLUMNAS = [
    Column("xi", "x"),
    Column("fxi", "f(x)"),
    Column("peso", "peso"),
    Column("ponderado", "peso * f(x)"),
    Column("suma", "suma del corchete"),
]


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de ``f`` en [a, b] con arcos de parabola."""
    f, a, b, n = leer_problema(params)
    if n % 2:
        raise MethodError(
            f"n = {n} es impar. Simpson 1/3 divide [a, b] en un número par de "
            "subintervalos: usa n = 2, 4, 6, ... Si n tiene que ser impar, "
            "Simpson 3/8 (n múltiplo de 3) o la combinación de 1/3 y 3/8 "
            "(n = 5, 7, ...) lo admiten."
        )

    tramos = [("1/3", 0, n)]
    dx, xs, fs = malla(f, a, b, n)
    iteraciones, (resumen,) = recorrer(tramos, xs, fs, dx, con_regla=False)
    integral = resumen["integral"]
    if not math.isfinite(integral):
        raise MethodError(
            "La suma del corchete se desborda: los valores de f(x) son "
            "demasiado grandes para calcular la integral en punto flotante."
        )

    curva_x, curva_y = sample(str(f), x_min=a, x_max=b, puntos=PUNTOS_GRAFICA)
    parabolas, _, filas = arcos(tramos, xs, fs)

    notas = [
        f"∫[{a:g}, {b:g}] ({f}) dx ≈ {integral:.6f}",
        f"{n} intervalos de ancho Δx = {dx:g}, {n + 1} puntos: {n // 2} "
        f"parábola{'s' if n > 2 else ''}, una por cada dos intervalos. Los "
        "extremos pesan 1, los puntos de índice impar 4 y los de índice par "
        "interiores 2.",
        f"La suma del corchete es {resumen['corchete']:.8f}; multiplicada por "
        f"Δx/3 = {resumen['factor']:g} da la integral. Es lo mismo que "
        f"(b − a)·corchete/(3n) = {(b - a) / (3 * n):g} · corchete.",
        "La columna de error queda vacía: este es un método de malla fija. "
        "Para estimar la exactitud, resuelve otra vez con el doble de "
        "subintervalos y compara las aproximaciones.",
    ]

    return MethodResult(
        method=SLUG,
        columns=COLUMNAS,
        iterations=iteraciones,
        result={
            "integral": integral,
            "corchete": resumen["corchete"],
            "factor": resumen["factor"],
            "delta_x": dx,
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
            title=f"Simpson 1/3 sobre f(x) = {f}",
            resample=Resample(expression=str(f), domain=(a, b)),
            parabolas=parabolas,
            nodos=nodos(tramos, xs, fs),
            filas_arcos=filas,
        ),
        notes=notas,
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Simpson 1/3",
        unit="U1",
        family="integracion",
        orden=8,
        description=(
            "Aproxima una integral definida con arcos de parabola que pasan "
            "por tres nodos equiespaciados, uno por cada dos subintervalos "
            "de ancho Δx = (b - a)/n, con n par. Es la regla de Simpson1.pdf: "
            "los n + 1 puntos van con pesos 1, 4, 2, 4, ..., 2, 4, 1. Es la "
            "misma regla que «Método de Simpson», que cuenta n de otra forma "
            "(cada subintervalo suma su punto medio): ese método con n par "
            "(n ≥ 4) da lo mismo que este con 2n."
        ),
        reference=(
            "(Δx/3) * [f(x0) + 4f(x1) + 2f(x2) + 4f(x3) + ... + 2f(x(n-2)) "
            "+ 4f(x(n-1)) + f(xn)], Δx = (b - a)/n, n par. Simple (n = 2): "
            "(b - a) * [f(x0) + 4f(x1) + f(x2)] / 6, Et = -(b - a)^5/2880 * f''''(xi)"
        ),
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="exp(x^2)",
                help=(
                    "La funcion a integrar. Se puede escribir como en clase: "
                    "x^2, exp(x^2), sin(x), 1/x."
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
                label="Numero de intervalos n (par)",
                kind=FieldKind.INTEGER,
                default=10,
                help=(
                    "Tiene que ser par: cada parabola usa dos intervalos. "
                    "Con n intervalos hay n + 1 puntos y Δx = (b - a)/n. "
                    "Con n = 2 es la regla simple, una sola parabola."
                ),
            ),
        ],
        solve=solve,
    )
)
