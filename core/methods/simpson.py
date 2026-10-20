"""Metodo de Simpson para integracion numerica, como en el material del docente.

Sustituye la curva por arcos de parabola: cada parabola pasa por los extremos
de un subintervalo y por su punto medio. El material pide n par y distingue
dos casos:

1) n = 2: [a, b] se parte en dos mitades y se usa una sola parabola.

    integral(f, a, b) ~= (b - a) / 6 * [f(a) + 4 f((a + b) / 2) + f(b)]

2) n > 2: [a, b] se parte en n subintervalos de ancho h = (b - a) / n, con
   x_i = a + i * h, y cada uno aporta su punto medio m_i = (x_(i-1) + x_i) / 2
   (x barra sub i en el material).

    integral(f, a, b) ~= (b - a) / (6 n) *
        [f(x_0) + 4 * sum(f(m_i), i=1..n) + 2 * sum(f(x_i), i=1..n-1) + f(x_n)]

El caso 1 es el caso 2 con un solo subintervalo, y asi se calcula aca. Por eso
n = 2 evalua 3 puntos y n = 4 evalua 9, no 5: es la convencion del material.
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

SLUG = "simpson"

# Mismo limite que las otras reglas. Aca cada subintervalo suma dos filas (su
# punto medio y su extremo derecho), asi que la tabla llega a 2n + 1 filas.
MAX_SUBINTERVALOS = 10_000
PUNTOS_GRAFICA = 401

# La tabla sigue el corchete del material, punto por punto en el orden en que
# se leen: x0, m1, x1, m2, ..., xn. La suma del corchete es el numero que el
# docente escribe antes de multiplicar por (b - a) / (6 n).
COLUMNAS = [
    Column("punto", "punto", numeric=False),
    Column("xi", "x"),
    Column("fxi", "f(x)"),
    Column("peso", "peso"),
    Column("ponderado", "peso * f(x)"),
    Column("suma", "suma del corchete"),
]


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de ``f`` en [a, b] con arcos de parabola."""
    f = leer_funcion(params)
    a = leer_numero(params, "a", "el extremo inferior a")
    b = leer_numero(params, "b", "el extremo superior b")
    n = leer_entero_positivo(params, "n", "el numero de subintervalos n")
    validar_intervalo(a, b)

    if n % 2:
        raise MethodError(
            f"n = {n} es impar. El metodo de Simpson divide [a, b] en un "
            "numero par de subintervalos: usa n = 2, 4, 6, ..."
        )
    if n > MAX_SUBINTERVALOS:
        raise MethodError(
            f"Se piden {n} subintervalos y el maximo es {MAX_SUBINTERVALOS}. "
            "Cada punto es una fila de la tabla que se calcula y se guarda "
            "entera en memoria; con mas que eso deja de ser legible. Reduce n."
        )

    # Caso 1 del material: n = 2 es una sola parabola sobre todo [a, b].
    subintervalos = 1 if n == 2 else n
    h = (b - a) / subintervalos
    if not math.isfinite(h) or h == 0:
        raise MethodError("El ancho de subintervalo h no es finito: revisa a, b y n.")
    factor = (b - a) / (6 * subintervalos)

    # (nombre, x, peso) en el orden del corchete. x_i = a + i*h, sin acumular
    # h, y el ultimo punto es b por construccion, como en el Trapecio. El punto
    # medio es x_i - h/2: sumar x_(i-1) + x_i desborda cerca de 1e308.
    puntos: list[tuple[str, float, float]] = []
    for i in range(subintervalos + 1):
        xi = b if i == subintervalos else a + i * h
        if i > 0:
            puntos.append((f"m{i}", xi - h / 2, 4.0))
        puntos.append((f"x{i}", xi, 1.0 if i in (0, subintervalos) else 2.0))

    iteraciones: list[Iteration] = []
    valores_f: list[float] = []
    corchete = 0.0
    for fila, (nombre, xi, peso) in enumerate(puntos):
        fxi = f.evaluar(x=xi)
        ponderado = peso * fxi
        corchete += ponderado
        valores_f.append(fxi)
        iteraciones.append(
            Iteration(
                n=fila,
                values={
                    "punto": nombre,
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
    # Una parabola por subintervalo: filas 2k, 2k + 1 y 2k + 2.
    parabolas = [
        (
            puntos[j][1], valores_f[j],
            puntos[j + 1][1], valores_f[j + 1],
            puntos[j + 2][1], valores_f[j + 2],
        )
        for j in range(0, 2 * subintervalos, 2)
    ]

    if n == 2:
        caso = (
            "Caso n = 2 del material: una sola parabola que pasa por a, por "
            f"el punto medio m1 = {puntos[1][1]:g} y por b. Pesos 1, 4 y 1."
        )
    else:
        caso = (
            f"Caso n > 2 del material: {n} subintervalos de ancho h = {h:g}, "
            "cada uno con su punto medio m_i (x barra sub i en el material). "
            "Los extremos pesan 1, los puntos medios 4 y los puntos interiores 2."
        )
    notas = [
        f"∫[{a:g}, {b:g}] ({f}) dx ≈ {integral:.6f}",
        caso,
        f"La suma del corchete es {corchete:.8f}; multiplicada por "
        f"(b − a)/{6 * subintervalos} = {factor:g} da la integral.",
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
            title=f"Método de Simpson sobre f(x) = {f}",
            resample=Resample(expression=str(f), domain=(a, b)),
            parabolas=parabolas,
        ),
        notes=notas,
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Método de Simpson",
        unit="U1",
        family="integracion",
        orden=7,
        description=(
            "Aproxima una integral definida sustituyendo la curva por arcos "
            "de parabola que pasan por los extremos y el punto medio de cada "
            "subintervalo, y sumando el area bajo esos arcos."
        ),
        reference=(
            "n = 2: (b - a)/6 * [f(a) + 4 f((a+b)/2) + f(b)]; "
            "n > 2: (b - a)/(6n) * [f(x0) + 4*sum(f(m_i)) + 2*sum(f(x_i)) + f(xn)]"
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
                label="Numero de subintervalos n (par)",
                kind=FieldKind.INTEGER,
                default=4,
                help=(
                    "Tiene que ser par. Con n = 2 se usa una sola parabola "
                    "sobre [a, b]; con n > 2, n subintervalos de ancho "
                    "(b - a)/n, cada uno con su punto medio."
                ),
            ),
        ],
        solve=solve,
    )
)
