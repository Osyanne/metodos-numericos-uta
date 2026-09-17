"""Metodo del Punto Medio para integracion numerica.

    integral(f, a, b) ~= sum_{i=1..n} f(m_i) * Delta_x

donde Delta_x = (b - a) / n  y  m_i = a + (i - 1/2) * Delta_x.

A diferencia de la regla del rectangulo izquierdo o derecho, el punto medio
evalua la funcion en el CENTRO de cada subintervalo. En una funcion suave eso
cancela buena parte del error lineal y da una estimacion mas precisa con la
misma cantidad de rectangulos.

Es un metodo de malla fija, como Runge-Kutta: recorre exactamente n
subintervalos y no persigue ninguna tolerancia. Termina con
StopReason.COMPLETED, no con MAX_ITERATIONS.
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

SLUG = "punto-medio"

# Mismo tope que Runge-Kutta: n viaja dentro de params y no pasa por la
# validacion de max_iterations. Con mas que esto la tabla deja de ser algo
# que se pueda leer y cada fila se guarda entera en memoria.
MAX_SUBINTERVALOS = 10_000

# Cantidad de puntos con que se muestrea f(x) para dibujar la curva sobre
# los rectangulos. Se elige suficiente para que se lea la forma real de la
# funcion aunque n sea chico.
PUNTOS_GRAFICA = 401

# Columnas de la tabla, en el orden de la tabla del docente (i, X_i, f(X_i))
# mas la suma acumulada, que muestra como se va formando el resultado.
COLUMNAS = [
    Column("xi", "xi (punto medio)"),
    Column("fxi", "f(xi)"),
    Column("area", "f(xi) * dx"),
    Column("suma", "suma acumulada"),
]


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    """Aproxima la integral de f en [a, b] con n subintervalos."""
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
            "Cada subintervalo es una fila de la tabla que se calcula y se "
            "guarda entera; con mas que eso la tabla deja de ser algo que se "
            "pueda leer. Reduce n."
        )

    delta_x = (b - a) / n
    if not math.isfinite(delta_x) or delta_x == 0:
        raise MethodError(
            "El ancho de subintervalo Delta_x no es finito: revisa a, b y n."
        )

    iteraciones: list[Iteration] = []
    integral = 0.0

    for i in range(1, n + 1):
        # Punto medio del i-esimo subintervalo, siguiendo la formula del PDF:
        # m_i = a + (i - 1/2) * Delta_x. Se calcula asi y no como
        # (x_{i-1} + x_i) / 2 para que la aritmetica coincida con la de clase.
        xi = a + (i - 0.5) * delta_x
        fxi = f.evaluar(x=xi)
        area = fxi * delta_x
        integral += area

        iteraciones.append(
            Iteration(
                n=i,
                values={
                    "xi": xi,
                    "fxi": fxi,
                    "area": area,
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

    rectangulos = [
        (
            a + (i - 1) * delta_x,
            a + i * delta_x,
            iteraciones[i - 1].values["fxi"],
        )
        for i in range(1, n + 1)
    ]

    notas = [
        # El signo ∫ es dificil de tipear en un teclado normal, asi que el
        # aplicativo lo pone solo tanto en la vista previa como en esta nota,
        # armando la notacion completa a partir de a, b, f y los limites.
        f"∫[{a:g}, {b:g}] ({f}) dx ≈ {integral:.6f}",
        f"Aproximacion de la integral definida de f(x) = {f} en [{a:g}, {b:g}] "
        f"con {n} subintervalos de ancho Δx = {delta_x:g}.",
        "El punto medio no produce una estimacion de error por iteracion: la "
        "columna va vacia. Para estimar la exactitud hay que resolver otra vez "
        "con el doble de subintervalos y comparar los dos resultados.",
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
            rectangulos,
            a=a,
            b=b,
            integral=integral,
            title=f"Punto Medio sobre f(x) = {f}",
            resample=Resample(expression=str(f), domain=(a, b)),
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
        name="Punto Medio",
        unit="U1",
        family="integracion",
        orden=4,
        description=(
            "Aproxima el valor de una integral definida sumando el area de "
            "rectangulos que usan el valor de la funcion en el CENTRO de cada "
            "subintervalo. Suele ser mas precisa que las reglas del "
            "rectangulo izquierdo o derecho para la misma cantidad de "
            "particiones."
        ),
        reference="integral(f, a, b) ~= sum f(m_i) * Delta_x, m_i = a + (i - 1/2) * Delta_x",
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="0.25*x^3 - x",
                help="La funcion a integrar. Se puede escribir como en clase: 0.25x^3 - x, sin(x), exp(-x).",
            ),
            InputField(
                name="a",
                label="Extremo inferior a",
                kind=FieldKind.NUMBER,
                default=-1.5,
            ),
            InputField(
                name="b",
                label="Extremo superior b",
                kind=FieldKind.NUMBER,
                default=2.0,
            ),
            InputField(
                name="n",
                label="Numero de subintervalos n",
                kind=FieldKind.INTEGER,
                default=7,
                help="Cuantos rectangulos usa el metodo. Mas subintervalos = mas precision.",
            ),
        ],
        solve=solve,
    )
)
