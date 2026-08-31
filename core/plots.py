"""Constructores de PlotSpec. CONGELADO.

PlotSpec.series es un dict abierto, asi que sin esto cada metodo inventaria
su propia forma y la interfaz no podria dibujar nada de forma generica.
Estas funciones son el contrato: el nucleo solo produce graficas por aca, y
la interfaz solo lee las claves que estan documentadas aca.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from core.types import PlotKind, PlotSpec, Resample


def function_root(
    xs: Sequence[float],
    ys: Sequence[float],
    root: float | None = None,
    root_y: float = 0.0,
    iterates: Sequence[tuple[int, float, float]] = (),
    title: str = "",
    resample: Resample | None = None,
) -> PlotSpec:
    """series = {curve: {x, y}, root: {x, y} | None, iterates: [{n, x, y}]}"""
    return PlotSpec(
        kind=PlotKind.FUNCTION_ROOT,
        series={
            "curve": {"x": list(xs), "y": list(ys)},
            "root": None if root is None else {"x": root, "y": root_y},
            "iterates": [{"n": n, "x": x, "y": y} for n, x, y in iterates],
        },
        x_label="x",
        y_label="f(x)",
        title=title,
        resample=resample,
    )


def interpolation(
    points: Sequence[tuple[float, float]],
    xs: Sequence[float],
    ys: Sequence[float],
    evaluated: tuple[float, float] | None = None,
    title: str = "",
    resample: Resample | None = None,
) -> PlotSpec:
    """series = {points: [[x, y]], curve: {x, y}, evaluated: {x, y} | None}"""
    return PlotSpec(
        kind=PlotKind.INTERPOLATION,
        series={
            "points": [[float(x), float(y)] for x, y in points],
            "curve": {"x": list(xs), "y": list(ys)},
            "evaluated": (
                None if evaluated is None
                else {"x": evaluated[0], "y": evaluated[1]}
            ),
        },
        title=title,
        resample=resample,
    )


def convergence(
    ns: Sequence[int],
    errors: Sequence[float | None],
    title: str = "",
) -> PlotSpec:
    """series = {n: [...], error: [...]}  (misma longitud, error puede ser null)"""
    return PlotSpec(
        kind=PlotKind.CONVERGENCE,
        series={"n": list(ns), "error": list(errors)},
        x_label="iteracion",
        y_label="error",
        title=title,
    )


def ode_solution(
    xs: Sequence[float],
    componentes: Mapping[str, Sequence[float]] | Sequence[float],
    exact_xs: Sequence[float] | None = None,
    exact_componentes: Mapping[str, Sequence[float]] | Sequence[float] | None = None,
    title: str = "",
) -> PlotSpec:
    """series = {solution: {x, components: [{name, y}]}, exact: igual | None}

    `componentes` admite las dos formas:

        [1.0, 1.1, 1.2]                una sola ecuacion; la curva se llama "y"
        {"y1": [...], "y2": [...]}     un sistema; una curva por incognita

    Es la misma forma en los dos casos a proposito: la interfaz dibuja una linea
    por componente sin tener que preguntarse si atras hay un sistema o no.
    """
    exacta = None
    if exact_xs is not None and exact_componentes is not None:
        exacta = {"x": list(exact_xs), "components": _componentes(exact_componentes)}
    return PlotSpec(
        kind=PlotKind.ODE_SOLUTION,
        series={
            "solution": {"x": list(xs), "components": _componentes(componentes)},
            "exact": exacta,
        },
        y_label="y",
        title=title,
    )


def _componentes(
    valores: Mapping[str, Sequence[float]] | Sequence[float],
) -> list[dict[str, Any]]:
    if isinstance(valores, Mapping):
        return [{"name": nombre, "y": list(ys)} for nombre, ys in valores.items()]
    return [{"name": "y", "y": list(valores)}]
