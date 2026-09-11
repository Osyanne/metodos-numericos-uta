"""Interpolacion de Lagrange.

El polinomio se arma como la suma de cada valor de la funcion por su polinomio
base:

    P(x) = sum_i f(x_i) * L_i(x)        L_i(x) = prod_{j != i} (x - x_j)/(x_i - x_j)

La tabla no es un registro de convergencia: aca no hay iteraciones que se
acerquen a nada. Cada fila es un paso del procedimiento, con el numerador y el
denominador de su L_i a la vista, porque eso es lo que se corrige en clase.
"""
from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

import sympy

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

PUNTOS_GRAFICA = 201

_X = sympy.Symbol("x")


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    """Arma el polinomio de Lagrange y devuelve la tabla de polinomios base."""
    puntos = _validar_puntos(params.get("points"))
    x_evaluado = _numero_finito(params.get("x"), "El valor x a evaluar")

    xs = [sympy.Rational(str(punto[0])) for punto in puntos]
    ys = [sympy.Rational(str(punto[1])) for punto in puntos]

    bases = [_base(xs, i) for i in range(len(xs))]
    polinomio_exacto = sum(
        (y * base for y, base in zip(ys, bases, strict=True)),
        sympy.Integer(0),
    )
    polinomio, grado = _expandir(polinomio_exacto)

    expresion = parse(polinomio)
    valor = expresion.evaluar(x=x_evaluado)

    columns, iterations = _tabla(xs, ys, bases, x_evaluado)
    curva_x, curva_y = sample(
        polinomio,
        x_min=min(float(x) for x in xs),
        x_max=max(float(x) for x in xs),
        puntos=PUNTOS_GRAFICA,
    )

    return MethodResult(
        method="interpolacion-lagrange",
        columns=columns,
        iterations=iterations,
        result={
            "polinomio": polinomio,
            "valor": valor,
            "grado": grado,
        },
        converged=True,
        stop_reason=StopReason.EXACT,
        decimals=config.decimals,
        plot=plots.interpolation(
            [(float(x), float(y)) for x, y in zip(xs, ys, strict=True)],
            curva_x,
            curva_y,
            evaluated=(x_evaluado, valor),
            title="Interpolacion de Lagrange",
            resample=Resample(
                expression=polinomio,
                domain=(
                    min(float(x) for x in xs),
                    max(float(x) for x in xs),
                ),
            ),
        ),
    )


# ---------- el polinomio ----------

def _base(xs: Sequence[sympy.Expr], i: int) -> sympy.Expr:
    """L_i(x), ya simplificado pero sin expandir todavia."""
    base: sympy.Expr = sympy.Integer(1)
    for j, xj in enumerate(xs):
        if j == i:
            continue
        base *= (_X - xj) / (xs[i] - xj)
    return base


def _expandir(expresion: sympy.Expr) -> tuple[str, int]:
    """Pasa a potencias de x y devuelve el texto y el grado.

    Los coeficientes racionales se escriben como decimales para que el
    polinomio se lea igual que en el pizarron y lo pueda releer el parser.
    """
    expandido = sympy.Poly(sympy.expand(expresion), _X)
    grado = 0 if expandido.is_zero else int(expandido.degree())

    legible: sympy.Expr = sympy.Integer(0)
    for potencia, coeficiente in enumerate(reversed(expandido.all_coeffs())):
        legible += _coeficiente_legible(coeficiente) * _X**potencia

    return str(sympy.expand(legible)), grado


def _coeficiente_legible(coeficiente: sympy.Expr) -> sympy.Expr:
    if coeficiente == 0:
        return sympy.Integer(0)
    if coeficiente.is_Integer:
        return coeficiente
    return sympy.Float(coeficiente, 17)


# ---------- la tabla ----------

def _tabla(
    xs: Sequence[sympy.Expr],
    ys: Sequence[sympy.Expr],
    bases: Sequence[sympy.Expr],
    x_evaluado: float,
) -> tuple[list[Column], list[Iteration]]:
    columns = [
        Column("xi", "x_i"),
        Column("yi", "f(x_i)"),
        Column("numerador", "Numerador", numeric=False),
        Column("denominador", "Denominador", numeric=False),
        Column("Li", "L_i(x)", numeric=False),
        Column("termino", "f(x_i) L_i(x)", numeric=False),
        Column("Li_evaluado", "L_i evaluado"),
    ]

    iterations: list[Iteration] = []
    for i, (xi, yi, base) in enumerate(zip(xs, ys, bases, strict=True)):
        expandido, _ = _expandir(base)
        termino, _ = _expandir(yi * base)
        iterations.append(
            Iteration(
                n=i,
                values={
                    "xi": float(xi),
                    "yi": float(yi),
                    "numerador": _numerador(xs, i),
                    "denominador": _denominador(xs, i),
                    "Li": expandido,
                    "termino": termino,
                    "Li_evaluado": float(base.subs(_X, sympy.Rational(str(x_evaluado)))),
                },
                error=None,
            )
        )
    return columns, iterations


def _numerador(xs: Sequence[sympy.Expr], i: int) -> str:
    """(x - x_0)(x - x_2)..., saltando el termino i."""
    return "*".join(
        _binomio("x", xj) for j, xj in enumerate(xs) if j != i
    )


def _denominador(xs: Sequence[sympy.Expr], i: int) -> str:
    """(x_i - x_0)(x_i - x_2)..., con los valores ya sustituidos."""
    return "*".join(
        _binomio(_numero(xs[i]), xj) for j, xj in enumerate(xs) if j != i
    )


def _binomio(izquierda: str, valor: sympy.Expr) -> str:
    """Escribe (izquierda - valor) con el signo ya resuelto.

    Se conserva el (x - 0) en vez de reducirlo a x: asi la fila se lee contra
    la tabla de puntos sin tener que reconstruir que termino falta.
    """
    signo = "-" if valor >= 0 else "+"
    return f"({izquierda} {signo} {_numero(abs(valor))})"


def _numero(valor: sympy.Expr) -> str:
    return str(int(valor)) if valor.is_Integer else str(float(valor))


# ---------- validacion ----------

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


SPEC = register(
    MethodSpec(
        slug="interpolacion-lagrange",
        name="Interpolacion de Lagrange",
        unit="U2",
        family="interpolacion",
        inputs=[
            InputField(
                "points",
                "Puntos [x, y]",
                FieldKind.POINTS,
                help="Los puntos se usan en el orden ingresado.",
            ),
            InputField("x", "x a evaluar", FieldKind.NUMBER),
        ],
        solve=solve,
        description=(
            "Arma el polinomio como la suma de cada f(x_i) por su polinomio "
            "base L_i(x), y muestra cada L_i con su numerador y su denominador."
        ),
    )
)
