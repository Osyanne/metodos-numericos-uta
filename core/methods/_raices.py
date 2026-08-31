"""Nucleo comun de Newton-Raphson y Von Mises.

Los dos son metodos abiertos de un solo punto: parten de x0 y en cada paso
calculan x(i+1) a partir de x(i). Lo unico que cambia entre ellos es el
denominador, asi que el bucle, la tabla, los criterios de parada y la grafica
se escriben una sola vez.

El guion bajo del nombre hace que el auto-descubrimiento de core/methods/ lo
ignore: esto no es un metodo, es la maquinaria que comparten dos.
"""
from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

from core import plots
from core.config import SolveConfig
from core.errors import approx_error, within_tolerance
from core.expression import Expression, parse
from core.types import (
    Column,
    Iteration,
    MethodError,
    MethodResult,
    PlotSpec,
    Resample,
    StopReason,
)

# Las mismas columnas que usa el docente en su tabla.
COLUMNAS = [
    Column("xi", "xi"),
    Column("fxi", "f(xi)"),
    Column("xi_sig", "x(i+1)"),
]

PUNTOS_GRAFICA = 300


# ---------------------------------------------------------------- entrada


def leer_funcion(params: dict[str, Any], clave: str = "fx") -> Expression:
    texto = params.get(clave)
    if texto is None or not str(texto).strip():
        raise MethodError("Hace falta la funcion f(x).")
    return parse(str(texto))


def leer_numero(params: dict[str, Any], clave: str, etiqueta: str) -> float:
    valor = params.get(clave)
    if valor is None or valor == "":
        raise MethodError(f"Hace falta {etiqueta}.")
    try:
        return float(valor)
    except (TypeError, ValueError):
        raise MethodError(
            f"{etiqueta} tiene que ser un numero, y llego '{valor}'."
        ) from None


def derivada_de(f: Expression, params: dict[str, Any]) -> tuple[Expression, str]:
    """La app deriva sola salvo que el usuario escriba la derivada (R10)."""
    texto = params.get("dfx")
    if texto is not None and str(texto).strip():
        derivada = parse(str(texto))
        return derivada, f"Derivada ingresada por el usuario: f'(x) = {derivada}"
    derivada = f.derivada()
    return derivada, f"Derivada calculada por el aplicativo: f'(x) = {derivada}"


# ---------------------------------------------------------------- bucle


def resolver(
    *,
    metodo: str,
    f: Expression,
    x0: float,
    siguiente: Callable[[float, float], float],
    cfg: SolveConfig,
    notas: list[str],
    titulo: str,
) -> MethodResult:
    """Corre el bucle comun de los dos metodos.

    `siguiente(xi, fxi)` devuelve x(i+1). Es lo unico que distingue a
    Newton-Raphson de Von Mises.

    Sobre la tabla: el error de la fila i compara el x(i+1) de esa fila contra
    su x(i). La fila 0 va sin error, igual que en la tabla del docente, porque
    x0 es una aproximacion inicial elegida a mano y no una calculada.
    """
    iteraciones: list[Iteration] = []
    xi = x0
    x_sig = x0
    razon = StopReason.MAX_ITERATIONS
    convergio = False

    for n in range(cfg.max_iterations):
        try:
            fxi = f.evaluar(x=xi)
        except MethodError:
            if n == 0:
                raise
            razon, x_sig = StopReason.DIVERGED, xi
            notas.append(
                f"El metodo se alejo hasta x = {xi:g}, donde f(x) ya no se puede "
                f"evaluar. Conviene probar con otro valor inicial."
            )
            break

        if fxi == 0.0:
            # Ya estamos parados sobre la raiz. Hay que salir antes de tocar la
            # derivada: si no, una raiz exacta donde ademas f'(x) se anula se
            # reportaria como error de derivada en vez de como solucion.
            iteraciones.append(
                Iteration(n=n, values={"xi": xi, "fxi": 0.0, "xi_sig": xi}, error=None)
            )
            razon, convergio, x_sig = StopReason.EXACT, True, xi
            notas.append(f"f({xi:g}) = 0 exactamente: la raiz no es aproximada.")
            break

        x_sig = siguiente(xi, fxi)

        if not math.isfinite(x_sig):
            razon, x_sig = StopReason.DIVERGED, xi
            notas.append(
                "El metodo diverge: la siguiente aproximacion se sale del rango "
                "de numeros representables."
            )
            break

        error = None if n == 0 else approx_error(x_sig, xi, cfg.error_criterion)
        iteraciones.append(
            Iteration(n=n, values={"xi": xi, "fxi": fxi, "xi_sig": x_sig}, error=error)
        )

        if cfg.stop_on_tolerance:
            if x_sig == xi:
                razon, convergio = StopReason.TOLERANCE, True
                notas.append(
                    "La aproximacion dejo de cambiar: no se puede afinar mas con "
                    "la precision disponible."
                )
                break
            if within_tolerance(error, cfg.tolerance):
                razon, convergio = StopReason.TOLERANCE, True
                break

        xi = x_sig

    if razon is StopReason.MAX_ITERATIONS and cfg.stop_on_tolerance:
        notas.append(
            f"Se completaron las {cfg.max_iterations} iteraciones sin alcanzar la "
            f"tolerancia pedida. El ultimo valor es la mejor aproximacion obtenida."
        )

    return _armar(
        metodo=metodo,
        iteraciones=iteraciones,
        raiz=x_sig,
        convergio=convergio,
        razon=razon,
        cfg=cfg,
        f=f,
        x0=x0,
        notas=notas,
        titulo=titulo,
    )


def _armar(
    *,
    metodo: str,
    iteraciones: list[Iteration],
    raiz: float,
    convergio: bool,
    razon: StopReason,
    cfg: SolveConfig,
    f: Expression,
    x0: float,
    notas: list[str],
    titulo: str,
) -> MethodResult:
    diverge = razon is StopReason.DIVERGED
    return MethodResult(
        method=metodo,
        columns=COLUMNAS,
        iterations=iteraciones,
        result={
            # Si diverge no hay raiz que reportar: el ultimo valor no aproxima nada.
            "raiz": None if diverge else raiz,
            "iteraciones": len(iteraciones),
        },
        converged=convergio,
        stop_reason=razon,
        decimals=cfg.decimals,
        plot=_grafica(f, x0, raiz, iteraciones, titulo),
        notes=notas,
    )


# ---------------------------------------------------------------- grafica


def _grafica(
    f: Expression,
    x0: float,
    raiz: float,
    iteraciones: list[Iteration],
    titulo: str,
) -> PlotSpec:
    """Muestrea f alrededor de donde ocurrio todo, para el plano interactivo."""
    visitados = [
        v
        for v in (x0, raiz, *(it.values["xi"] for it in iteraciones))
        if math.isfinite(v)
    ] or [x0]

    izq, der = min(visitados), max(visitados)
    margen = max(1.0, (der - izq) * 0.5)
    x_min, x_max = izq - margen, der + margen

    paso = (x_max - x_min) / (PUNTOS_GRAFICA - 1)
    xs: list[float] = []
    ys: list[float | None] = []
    for i in range(PUNTOS_GRAFICA):
        x = x_min + i * paso
        xs.append(x)
        ys.append(f.evaluar_seguro(x=x))

    return plots.function_root(
        xs,
        ys,
        root=raiz if math.isfinite(raiz) else None,
        iterates=[(it.n, it.values["xi"], it.values["fxi"]) for it in iteraciones],
        title=titulo,
        resample=Resample(expression=str(f), domain=(x_min, x_max)),
    )
