"""Regla compuesta del Trapecio para integracion numerica.

    integral(f, a, b) ~= (Delta_x / 2) *
        [f(x_0) + 2 f(x_1) + ... + 2 f(x_(n-1)) + f(x_n)]

donde Delta_x = (b - a) / n y x_i = a + i * Delta_x.

La regla sustituye la curva por segmentos rectos entre los extremos de cada
subintervalo. El area bajo cada segmento es un trapecio; por eso los puntos
interiores tienen peso dos al pertenecer a los dos trapecios vecinos.
"""
from __future__ import annotations

import math
from typing import Any

from core import plots
from core.config import SolveConfig
from core.expression import parse
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

SLUG = "trapecio"

# Cada punto de particion se devuelve como una fila. El mismo limite que el
# Punto Medio evita que una peticion HTTP construya una tabla imposible de leer
# o mantener entera en memoria.
MAX_SUBINTERVALOS = 10_000
PUNTOS_GRAFICA = 401

# La tabla sigue la formula del material: extremos con peso 1, interiores con
# peso 2 y la contribucion h/2 * peso * f(x_i) que forma la suma final.
COLUMNAS = [
    Column("xi", "xi"),
    Column("fxi", "f(xi)"),
    Column("peso", "peso"),
    Column("aporte", "peso * f(xi) * dx / 2"),
    Column("suma", "suma acumulada"),
]


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de ``f`` en [a, b] con n trapecios."""
    f = _leer_funcion(params)
    a = _leer_numero(params, "a", "el extremo inferior a")
    b = _leer_numero(params, "b", "el extremo superior b")
    n = _leer_entero_positivo(params, "n", "el numero de subintervalos n")

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
    if n > MAX_SUBINTERVALOS:
        raise MethodError(
            f"Se piden {n} subintervalos y el maximo es {MAX_SUBINTERVALOS}. "
            "Cada punto de particion es una fila de la tabla que se calcula y "
            "se guarda entera en memoria; con mas que eso deja de ser legible. "
            "Reduce n."
        )

    delta_x = (b - a) / n
    if not math.isfinite(delta_x) or delta_x == 0:
        raise MethodError(
            "El ancho de subintervalo Delta_x no es finito: revisa a, b y n."
        )

    iteraciones: list[Iteration] = []
    valores_f: list[float] = []
    integral = 0.0

    # Hay n + 1 puntos de particion para n trapecios. Se calcula x_i como
    # a + i*Delta_x (en vez de acumular h) para que no se propague error de
    # redondeo y el ultimo punto siga siendo b por construccion matematica.
    for i in range(n + 1):
        xi = a + i * delta_x
        if i == n:
            xi = b
        fxi = f.evaluar(x=xi)
        peso = 1.0 if i in (0, n) else 2.0
        aporte = (delta_x / 2) * peso * fxi
        integral += aporte
        valores_f.append(fxi)

        iteraciones.append(
            Iteration(
                n=i,
                values={
                    "xi": xi,
                    "fxi": fxi,
                    "peso": peso,
                    "aporte": aporte,
                    "suma": integral,
                },
                error=None,
            )
        )

    curva_x, curva_y = sample(
        str(f),
        x_min=a,
        x_max=b,
        puntos=PUNTOS_GRAFICA,
    )
    trapecios = [
        (
            iteraciones[i].values["xi"],
            valores_f[i],
            iteraciones[i + 1].values["xi"],
            valores_f[i + 1],
        )
        for i in range(n)
    ]

    notas = [
        f"∫[{a:g}, {b:g}] ({f}) dx ≈ {integral:.6f}",
        f"Regla compuesta del Trapecio con {n} subintervalos de ancho "
        f"Δx = {delta_x:g}. Los extremos pesan 1 y los puntos interiores "
        "pesan 2.",
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
            "delta_x": delta_x,
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
            title=f"Regla del Trapecio sobre f(x) = {f}",
            resample=Resample(expression=str(f), domain=(a, b)),
            trapezoids=trapecios,
        ),
        notes=notas,
    )


# ---------------------------------------------------------------- entrada


def _leer_funcion(params: dict[str, Any]) -> Any:
    texto = params.get("fx")
    if texto is None or not str(texto).strip():
        raise MethodError("Hace falta la funcion f(x) para integrar.")
    return parse(str(texto))


def _leer_numero(params: dict[str, Any], clave: str, etiqueta: str) -> float:
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


def _leer_entero_positivo(
    params: dict[str, Any], clave: str, etiqueta: str
) -> int:
    valor = params.get(clave)
    if valor is None or valor == "":
        raise MethodError(f"Hace falta {etiqueta}.")
    if isinstance(valor, bool):
        raise MethodError(f"{etiqueta} tiene que ser un entero positivo.")
    numero = _leer_numero({"__aux__": valor}, "__aux__", etiqueta)
    if not numero.is_integer() or numero <= 0:
        raise MethodError(f"{etiqueta} tiene que ser un entero positivo.")
    return int(numero)


# ---------------------------------------------------------------- registro


register(
    MethodSpec(
        slug=SLUG,
        name="Método del Trapecio",
        unit="U1",
        family="integracion",
        orden=6,
        description=(
            "Aproxima una integral definida uniendo con rectas los valores de "
            "la funcion en los extremos de cada subintervalo y sumando las "
            "areas de los trapecios formados."
        ),
        reference=(
            "integral(f, a, b) ~= (Delta_x / 2) * "
            "[f(x0) + 2*sum(f(xi)) + f(xn)]"
        ),
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="exp(x^4)",
                help=(
                    "La funcion a integrar. Se puede escribir como en clase: "
                    "x^2, 0.25x^3 - x, sin(x), exp(-x)."
                ),
            ),
            InputField(
                name="a",
                label="Extremo inferior a",
                kind=FieldKind.NUMBER,
                default=-1.0,
            ),
            InputField(
                name="b",
                label="Extremo superior b",
                kind=FieldKind.NUMBER,
                default=1.0,
            ),
            InputField(
                name="n",
                label="Numero de subintervalos n",
                kind=FieldKind.INTEGER,
                default=5,
                help=(
                    "Cuantos trapecios usa el metodo. Mas subintervalos "
                    "suelen dar una aproximacion mas precisa."
                ),
            ),
        ],
        solve=solve,
    )
)
