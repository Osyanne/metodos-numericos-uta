"""Interpolacion de Newton con diferencias divididas y finitas."""
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

VARIANTES = {"auto", "divididas", "adelante", "atras"}
PUNTOS_GRAFICA = 201


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    """Interpola los puntos y devuelve el polinomio expandido y su tabla."""
    puntos = _validar_puntos(params.get("points"))
    x_evaluado = _numero_finito(params.get("x"), "El valor x a evaluar")
    variante = _validar_variante(params.get("variante", "auto"))

    equiespaciados = _son_equiespaciados(puntos)
    if variante == "auto":
        variante_usada = "adelante" if equiespaciados else "divididas"
    else:
        variante_usada = variante

    if variante_usada in {"adelante", "atras"} and not equiespaciados:
        raise MethodError(
            f"La variante {variante_usada} necesita puntos equiespaciados "
            "con paso constante."
        )

    xs = [punto[0] for punto in puntos]
    ys = [punto[1] for punto in puntos]
    polinomio, grado = _polinomio_expandido(xs, ys)
    expresion = parse(polinomio)
    valor = expresion.evaluar(x=x_evaluado)

    columns, iterations = _tabla(variante_usada, xs, ys, config.decimals)
    curva_x, curva_y = sample(
        polinomio,
        x_min=min(xs),
        x_max=max(xs),
        puntos=PUNTOS_GRAFICA,
    )

    return MethodResult(
        method="interpolacion-newton",
        columns=columns,
        iterations=iterations,
        result={
            "polinomio": polinomio,
            "valor": valor,
            "grado": grado,
            "variante_usada": variante_usada,
        },
        converged=True,
        stop_reason=StopReason.EXACT,
        decimals=config.decimals,
        plot=plots.interpolation(
            puntos,
            curva_x,
            curva_y,
            evaluated=(x_evaluado, valor),
            title="Interpolacion de Newton",
            resample=Resample(
                expression=polinomio,
                domain=(min(xs), max(xs)),
            ),
        ),
    )


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


def _validar_variante(raw: Any) -> str:
    if not isinstance(raw, str) or raw.strip().lower() not in VARIANTES:
        permitidas = ", ".join(sorted(VARIANTES))
        raise MethodError(
            f"La variante debe ser una de: {permitidas}."
        )
    return raw.strip().lower()


def _son_equiespaciados(puntos: Sequence[tuple[float, float]]) -> bool:
    paso = puntos[1][0] - puntos[0][0]
    escala = max(1.0, *(abs(x) for x, _ in puntos))
    return all(
        math.isclose(
            puntos[i][0] - puntos[i - 1][0],
            paso,
            rel_tol=1e-9,
            abs_tol=1e-12 * escala,
        )
        for i in range(2, len(puntos))
    )


def _polinomio_expandido(
    xs: Sequence[float],
    ys: Sequence[float],
) -> tuple[str, int]:
    """Construye la forma de Newton y la expande a potencias de x."""
    simbolo = sympy.Symbol("x")
    xs_exactos = [sympy.Rational(str(x)) for x in xs]
    niveles: list[list[sympy.Expr]] = [
        [sympy.Rational(str(y)) for y in ys]
    ]

    for orden in range(1, len(xs)):
        anterior = niveles[-1]
        niveles.append(
            [
                sympy.cancel(
                    (anterior[i + 1] - anterior[i])
                    / (xs_exactos[i + orden] - xs_exactos[i])
                )
                for i in range(len(xs) - orden)
            ]
        )

    polinomio: sympy.Expr = sympy.Integer(0)
    producto: sympy.Expr = sympy.Integer(1)
    for orden, nivel in enumerate(niveles):
        polinomio += nivel[0] * producto
        producto *= simbolo - xs_exactos[orden]

    expandido = sympy.Poly(sympy.expand(polinomio), simbolo)
    expresion_decimal: sympy.Expr = sympy.Integer(0)
    grado = 0 if expandido.is_zero else int(expandido.degree())
    for potencia, coeficiente in enumerate(reversed(expandido.all_coeffs())):
        expresion_decimal += _coeficiente_legible(coeficiente) * simbolo**potencia

    return str(sympy.expand(expresion_decimal)), grado


def _coeficiente_legible(coeficiente: sympy.Expr) -> sympy.Expr:
    if coeficiente == 0:
        return sympy.Integer(0)
    if coeficiente.is_Integer:
        return coeficiente
    return sympy.Float(coeficiente, 17)


def _tabla(
    variante: str,
    xs: Sequence[float],
    ys: Sequence[float],
    decimals: int,
) -> tuple[list[Column], list[Iteration]]:
    if variante == "divididas":
        niveles = _diferencias_divididas(xs, ys)
        prefijo = "dd"
        etiqueta = "Diferencia dividida"
        desplazamiento = False
    elif variante == "adelante":
        niveles = _diferencias_finitas(ys)
        prefijo = "delta"
        etiqueta = "Diferencia adelante"
        desplazamiento = False
    else:
        niveles = _diferencias_finitas(ys)
        prefijo = "nabla"
        etiqueta = "Diferencia atras"
        desplazamiento = True

    columns = [Column("x", "x"), Column("y", "f(x)")]
    columns.extend(
        Column(f"{prefijo}{orden}", f"{etiqueta} {orden}")
        for orden in range(1, len(xs))
    )

    iterations: list[Iteration] = []
    for i, (xi, yi) in enumerate(zip(xs, ys, strict=True)):
        values = {
            "x": xi,
            "y": yi,
        }
        for orden in range(1, len(niveles)):
            posicion = i - orden if desplazamiento else i
            if 0 <= posicion < len(niveles[orden]):
                values[f"{prefijo}{orden}"] = niveles[orden][posicion]
        iterations.append(Iteration(n=i, values=values, error=None))
    return columns, iterations


def _diferencias_divididas(
    xs: Sequence[float],
    ys: Sequence[float],
) -> list[list[float]]:
    niveles = [list(ys)]
    for orden in range(1, len(xs)):
        anterior = niveles[-1]
        niveles.append(
            [
                (anterior[i + 1] - anterior[i]) / (xs[i + orden] - xs[i])
                for i in range(len(xs) - orden)
            ]
        )
    return niveles


def _diferencias_finitas(ys: Sequence[float]) -> list[list[float]]:
    niveles = [list(ys)]
    while len(niveles[-1]) > 1:
        anterior = niveles[-1]
        niveles.append(
            [anterior[i + 1] - anterior[i] for i in range(len(anterior) - 1)]
        )
    return niveles


SPEC = register(
    MethodSpec(
        slug="interpolacion-newton",
        name="Interpolacion de Newton",
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
            InputField(
                "variante",
                "Variante",
                FieldKind.EXPRESSION,
                default="auto",
                help="auto, divididas, adelante o atras",
                required=False,
            ),
        ],
        solve=solve,
        description=(
            "Interpola una tabla mediante diferencias divididas o diferencias "
            "finitas de Newton."
        ),
    )
)
