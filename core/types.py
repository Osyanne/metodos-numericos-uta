"""Contrato entre el nucleo numerico y todo lo que lo consume.

CONGELADO. Cambiar algo de aca rompe el otro carril: hay que acordarlo antes.

Las cuatro familias de entrada que cubren los metodos del primer parcial
tambien cubren, casi con seguridad, los seis metodos que faltan:

    Newton-Raphson            EXPRESSION + NUMBER
    Interpolacion de Newton   POINTS + NUMBER
    Von Mises                 MATRIX + VECTOR
    Runge-Kutta               EXPRESSION + NUMBER
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class FieldKind(str, Enum):
    """Tipo de dato de un campo de entrada.

    La interfaz dibuja el formulario a partir de esto, sin saber nada del
    metodo. La codificacion JSON de cada tipo esta CONGELADA: es lo que el
    navegador manda y lo que el metodo recibe en params.

        EXPRESSION  "x**3 - 2*x - 5"      (str; se acepta ^ como potencia)
        NUMBER      2.5                    (float)
        INTEGER     4                      (int)
        POINTS      [[1.0, 0.0], [4.0, 1.386294]]   (pares [x, y], en orden)
        MATRIX      [[4, 1, 0], [1, 3, 1]]          (filas, row-major)
        VECTOR      [1.0, 1.0, 1.0]

    Ver docs/CONTRATO.md para el params completo de cada metodo.
    """

    EXPRESSION = "expression"
    NUMBER = "number"
    INTEGER = "integer"
    POINTS = "points"
    MATRIX = "matrix"
    VECTOR = "vector"


@dataclass(frozen=True)
class InputField:
    name: str
    label: str
    kind: FieldKind
    default: Any = None
    help: str = ""
    required: bool = True


@dataclass(frozen=True)
class Column:
    """Una columna de la tabla de iteraciones."""

    key: str
    label: str
    numeric: bool = True


class StopReason(str, Enum):
    TOLERANCE = "tolerancia_alcanzada"
    MAX_ITERATIONS = "n_iteraciones_completadas"
    EXACT = "solucion_exacta"
    DIVERGED = "divergio"
    FAILED = "fallo"


@dataclass(frozen=True)
class Iteration:
    """Una fila de la tabla. values usa las claves declaradas en columns."""

    n: int
    values: dict[str, float]
    error: float | None = None


class PlotKind(str, Enum):
    FUNCTION_ROOT = "funcion_raiz"
    INTERPOLATION = "interpolacion"
    CONVERGENCE = "convergencia"
    ODE_SOLUTION = "solucion_edo"


@dataclass(frozen=True)
class PlotSpec:
    """Datos ya calculados para graficar. El nucleo no dibuja: entrega puntos."""

    kind: PlotKind
    series: dict[str, Any]
    x_label: str = "x"
    y_label: str = "y"
    title: str = ""


@dataclass(frozen=True)
class MethodResult:
    method: str
    columns: list[Column]
    iterations: list[Iteration]
    result: dict[str, Any]
    converged: bool
    stop_reason: StopReason
    decimals: int
    plot: PlotSpec | None = None
    notes: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class MethodSpec:
    """Todo lo que el sistema necesita saber de un metodo.

    Agregar el metodo numero 5 es crear un archivo en core/methods/ que
    construya uno de estos y lo pase a registry.register(). Nada mas.
    """

    slug: str
    name: str
    unit: str
    family: str
    inputs: list[InputField]
    solve: Callable[[dict[str, Any], "SolveConfig"], MethodResult]
    description: str = ""
    reference: str = ""


class MethodError(Exception):
    """Fallo con causa matematica, no de programa.

    El mensaje se le muestra tal cual al usuario, asi que tiene que explicar
    la causa: 'el intervalo no encierra una raiz', no 'ValueError'.
    """
