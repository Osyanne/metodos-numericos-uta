"""Runge-Kutta de orden 2 y 4 para ecuaciones y sistemas de EDO."""
from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

from core import plots
from core.config import SolveConfig
from core.errors import approx_error
from core.expression import Expression, parse
from core.registry import register
from core.types import (
    Column,
    FieldKind,
    InputField,
    Iteration,
    MethodError,
    MethodResult,
    MethodSpec,
    StopReason,
)


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    """Resuelve una EDO o sistema sobre una malla de paso constante."""
    x0 = _numero_finito(params.get("x0"), "El valor inicial x0")
    expresiones, estado, escalar = _problema(params.get("fxy"), params.get("y0"))
    orden = _orden(params.get("orden", 4))
    h, n = _malla(params, x0, config.max_iterations)
    _validar_extremo_malla(x0, h, n)

    nombres = (
        ("x", "y")
        if escalar
        else ("x", *(f"y{i + 1}" for i in range(len(estado))))
    )
    columns = [Column("x", "x")]
    columns.extend(
        [Column("y", "y")]
        if escalar
        else [Column(nombre, nombre) for nombre in nombres[1:]]
    )

    xs = [x0]
    estados = [list(estado)]
    iterations = [
        Iteration(
            n=0,
            values=_valores_fila(x0, estado, escalar, config.decimals),
            error=None,
        )
    ]

    x_actual = x0
    for paso in range(1, n + 1):
        if orden == 2:
            siguiente = _paso_heun(expresiones, nombres, x_actual, estado, h)
        else:
            siguiente = _paso_rk4(expresiones, nombres, x_actual, estado, h)

        if not all(math.isfinite(valor) for valor in siguiente):
            raise MethodError(
                f"La solucion deja de ser finita en el paso {paso}; "
                "reduce el valor de h o revisa el problema."
            )

        x_nuevo = x0 + paso * h
        error = _error_estado(siguiente, estado, config)
        iterations.append(
            Iteration(
                n=paso,
                values=_valores_fila(
                    x_nuevo,
                    siguiente,
                    escalar,
                    config.decimals,
                ),
                error=error,
            )
        )
        x_actual = x_nuevo
        estado = siguiente
        xs.append(x_actual)
        estados.append(list(estado))

    resultado_y: float | list[float]
    if escalar:
        resultado_y = estado[0]
        componentes: Sequence[float] | dict[str, list[float]] = [
            valores[0] for valores in estados
        ]
    else:
        resultado_y = [valor for valor in estado]
        componentes = {
            f"y{i + 1}": [valores[i] for valores in estados]
            for i in range(len(estado))
        }

    return MethodResult(
        method="runge-kutta",
        columns=columns,
        iterations=iterations,
        result={
            "x": x_actual,
            "y": resultado_y,
            "h": h,
            "n": n,
            "orden": orden,
        },
        converged=True,
        stop_reason=StopReason.MAX_ITERATIONS,
        decimals=config.decimals,
        plot=plots.ode_solution(
            xs,
            componentes,
            title=f"Runge-Kutta de orden {orden}",
        ),
    )


def _problema(
    fxy_raw: Any,
    y0_raw: Any,
) -> tuple[list[Expression], list[float], bool]:
    if isinstance(fxy_raw, str):
        if _es_secuencia(y0_raw):
            raise MethodError(
                "Para una sola ecuacion, y0 debe ser un numero y no una lista."
            )
        y0 = _numero_finito(y0_raw, "La condicion inicial y0")
        return [parse(fxy_raw, variables=("x", "y"))], [y0], True

    if not _es_secuencia(fxy_raw):
        raise MethodError(
            "fxy debe ser una expresion o una lista de expresiones para el sistema."
        )
    if len(fxy_raw) == 0:
        raise MethodError("Se necesita al menos una ecuacion para Runge-Kutta.")
    if not _es_secuencia(y0_raw):
        raise MethodError(
            "Para un sistema, y0 debe ser una lista con una condicion por ecuacion."
        )
    if len(fxy_raw) != len(y0_raw):
        raise MethodError(
            "fxy y y0 deben tener la misma cantidad de elementos: "
            f"hay {len(fxy_raw)} ecuaciones y {len(y0_raw)} condiciones iniciales."
        )
    if not all(isinstance(texto, str) for texto in fxy_raw):
        raise MethodError("Cada ecuacion de fxy debe ser una expresion escrita como texto.")

    variables = ("x", *(f"y{i + 1}" for i in range(len(fxy_raw))))
    expresiones = [parse(texto, variables=variables) for texto in fxy_raw]
    estado = [
        _numero_finito(valor, f"La condicion inicial y{i + 1}")
        for i, valor in enumerate(y0_raw)
    ]
    return expresiones, estado, False


def _es_secuencia(valor: Any) -> bool:
    return isinstance(valor, Sequence) and not isinstance(valor, (str, bytes))


def _numero_finito(raw: Any, nombre: str) -> float:
    if isinstance(raw, bool):
        raise MethodError(f"{nombre} debe ser un numero finito.")
    try:
        numero = float(raw)
    except (TypeError, ValueError, OverflowError) as exc:
        raise MethodError(f"{nombre} debe ser un numero finito.") from exc
    if not math.isfinite(numero):
        raise MethodError(f"{nombre} debe ser un numero finito.")
    return numero


def _entero_positivo(raw: Any, nombre: str) -> int:
    if isinstance(raw, bool):
        raise MethodError(f"{nombre} debe ser un entero positivo.")
    numero = _numero_finito(raw, nombre)
    if not numero.is_integer() or numero <= 0:
        raise MethodError(f"{nombre} debe ser un entero positivo.")
    return int(numero)


def _orden(raw: Any) -> int:
    if isinstance(raw, bool):
        raise MethodError("El orden de Runge-Kutta debe ser 2 o 4.")
    try:
        orden = int(raw)
    except (TypeError, ValueError, OverflowError) as exc:
        raise MethodError("El orden de Runge-Kutta debe ser 2 o 4.") from exc
    if orden not in {2, 4} or float(raw) != orden:
        raise MethodError("El orden de Runge-Kutta debe ser 2 o 4.")
    return orden


def _malla(
    params: dict[str, Any],
    x0: float,
    max_iterations: int,
) -> tuple[float, int]:
    tiene_h = params.get("h") is not None
    tiene_n = params.get("n") is not None
    tiene_xf = params.get("xf") is not None

    if not any((tiene_h, tiene_n, tiene_xf)):
        raise MethodError(
            "Se necesita h y n, h y xf, n y xf, o solo h para definir la malla."
        )
    if tiene_n and not tiene_h and not tiene_xf:
        raise MethodError("El valor n necesita h o xf para definir la malla.")
    if tiene_xf and not tiene_h and not tiene_n:
        raise MethodError("El valor xf necesita h o n para definir la malla.")

    h = _numero_finito(params.get("h"), "El paso h") if tiene_h else None
    n = _entero_positivo(params.get("n"), "n") if tiene_n else None
    xf = _numero_finito(params.get("xf"), "El extremo xf") if tiene_xf else None

    if h == 0:
        raise MethodError("El paso h no puede ser cero.")

    if h is not None and n is not None and xf is not None:
        calculado = x0 + n * h
        if not math.isfinite(calculado):
            raise MethodError(
                "Los valores h y n hacen que el extremo de la malla deje de ser finito."
            )
        escala = max(1.0, abs(x0), abs(xf), abs(calculado))
        if not math.isclose(calculado, xf, rel_tol=1e-9, abs_tol=1e-12 * escala):
            raise MethodError(
                "Los valores h, n y xf no son consistentes: "
                f"x0 + n*h da {calculado:g}, no {xf:g}."
            )
        return h, n

    if h is not None and n is not None:
        return h, n

    if h is not None and xf is not None:
        rango = xf - x0
        if not math.isfinite(rango):
            raise MethodError(
                "El rango entre x0 y xf se desborda y no permite construir una malla finita."
            )
        cociente = rango / h
        if not math.isfinite(cociente):
            raise MethodError(
                "La cantidad de pasos calculada con h y xf no es finita."
            )
        if cociente <= 0:
            raise MethodError(
                "El paso h no avanza desde x0 en la direccion de xf."
            )
        n_calculado = round(cociente)
        if n_calculado < 1:
            raise MethodError(
                "El paso h es demasiado grande para avanzar al menos un paso hacia xf."
            )
        return h, n_calculado

    if n is not None and xf is not None:
        rango = xf - x0
        if not math.isfinite(rango):
            raise MethodError(
                "El rango entre x0 y xf se desborda y no permite calcular un h finito."
            )
        h_calculado = rango / n
        if not math.isfinite(h_calculado):
            raise MethodError("El paso h calculado con n y xf no es finito.")
        if h_calculado == 0:
            raise MethodError("x0 y xf deben ser distintos para calcular el paso h.")
        return h_calculado, n

    if h is not None:
        return h, max_iterations

    raise MethodError("La combinacion de h, n y xf no define una malla valida.")


def _validar_extremo_malla(x0: float, h: float, n: int) -> None:
    extremo = x0 + n * h
    if not math.isfinite(extremo):
        raise MethodError(
            "Los valores de la malla hacen que el extremo final deje de ser finito."
        )


def _evaluar(
    expresiones: Sequence[Expression],
    nombres: Sequence[str],
    x: float,
    estado: Sequence[float],
) -> list[float]:
    valores = {"x": x}
    valores.update(zip(nombres[1:], estado, strict=True))
    return [expresion.evaluar(**valores) for expresion in expresiones]


def _sumar(
    estado: Sequence[float],
    pendiente: Sequence[float],
    factor: float,
) -> list[float]:
    return [
        valor + factor * cambio
        for valor, cambio in zip(estado, pendiente, strict=True)
    ]


def _paso_heun(
    expresiones: Sequence[Expression],
    nombres: Sequence[str],
    x: float,
    estado: Sequence[float],
    h: float,
) -> list[float]:
    k1 = _evaluar(expresiones, nombres, x, estado)
    k2 = _evaluar(expresiones, nombres, x + h, _sumar(estado, k1, h))
    return [
        valor + h * (pendiente_1 + pendiente_2) / 2.0
        for valor, pendiente_1, pendiente_2 in zip(estado, k1, k2, strict=True)
    ]


def _paso_rk4(
    expresiones: Sequence[Expression],
    nombres: Sequence[str],
    x: float,
    estado: Sequence[float],
    h: float,
) -> list[float]:
    k1 = _evaluar(expresiones, nombres, x, estado)
    k2 = _evaluar(expresiones, nombres, x + h / 2.0, _sumar(estado, k1, h / 2.0))
    k3 = _evaluar(expresiones, nombres, x + h / 2.0, _sumar(estado, k2, h / 2.0))
    k4 = _evaluar(expresiones, nombres, x + h, _sumar(estado, k3, h))
    return [
        valor + h * (p1 + 2.0 * p2 + 2.0 * p3 + p4) / 6.0
        for valor, p1, p2, p3, p4 in zip(estado, k1, k2, k3, k4, strict=True)
    ]


def _error_estado(
    actual: Sequence[float],
    anterior: Sequence[float],
    config: SolveConfig,
) -> float:
    errores = [
        approx_error(valor, previo, config.error_criterion)
        for valor, previo in zip(actual, anterior, strict=True)
    ]
    return max(error for error in errores if error is not None)


def _valores_fila(
    x: float,
    estado: Sequence[float],
    escalar: bool,
    decimals: int,
) -> dict[str, float]:
    values = {"x": x}
    if escalar:
        values["y"] = estado[0]
    else:
        values.update(
            {
                f"y{i + 1}": valor
                for i, valor in enumerate(estado)
            }
        )
    return values


SPEC = register(
    MethodSpec(
        slug="runge-kutta",
        name="Runge-Kutta",
        unit="U3",
        family="edo",
        inputs=[
            InputField(
                "fxy",
                "f(x, y) o sistema",
                FieldKind.EXPRESSION,
                help="Una ecuacion, o varias para un sistema.",
                multiple=True,
            ),
            InputField("x0", "x0", FieldKind.NUMBER),
            InputField(
                "y0",
                "y0",
                FieldKind.NUMBER,
                help="Una condicion inicial por ecuacion.",
                multiple=True,
            ),
            InputField("h", "Paso h", FieldKind.NUMBER, required=False),
            InputField("n", "Numero de pasos", FieldKind.INTEGER, required=False),
            InputField("xf", "x final", FieldKind.NUMBER, required=False),
            InputField(
                "orden",
                "Orden",
                FieldKind.INTEGER,
                default=4,
                help="2 para Heun o 4 para Runge-Kutta clasico.",
                required=False,
            ),
        ],
        solve=solve,
        description=(
            "Resuelve una ecuacion diferencial o un sistema mediante Heun "
            "o Runge-Kutta clasico."
        ),
    )
)
