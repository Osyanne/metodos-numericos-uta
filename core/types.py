"""Contrato entre el nucleo numerico y todo lo que lo consume.

CONGELADO. Cambiar algo de aca rompe el otro carril: hay que acordarlo antes.

Familias de entrada de los metodos del primer parcial:

    Newton-Raphson            EXPRESSION + NUMBER
    Von Mises                 EXPRESSION + NUMBER
    Interpolacion de Newton   POINTS + NUMBER
    Runge-Kutta               EXPRESSION + NUMBER, admitiendo listas (sistemas)

MATRIX y VECTOR quedan declarados para los metodos que vengan, pero hoy no los
consume ninguno: Von Mises resulto ser una variante de Newton-Raphson y no el
metodo de las potencias para autovalores.
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
    """Un campo del formulario. La interfaz lo dibuja sin saber que metodo es.

    `multiple` significa que el campo acepta ademas una lista de valores de ese
    mismo `kind`. Lo necesita Runge-Kutta con sistemas (R9): `fxy` puede ser una
    expresion o varias, y `y0` un numero o varios. Sin esto la interfaz dibuja
    una sola casilla y el soporte de sistemas queda inalcanzable desde la
    pantalla, aunque el nucleo lo tenga.
    """

    name: str
    label: str
    kind: FieldKind
    default: Any = None
    help: str = ""
    required: bool = True
    multiple: bool = False


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
class Resample:
    """Deja que la interfaz pida mas puntos cuando el usuario hace zoom.

    La grafica es un plano tipo GeoGebra, no una imagen: al acercarse, la curva
    tiene que recalcularse en el rango nuevo o se ve como una linea quebrada.

    Solo lo llevan las graficas cuya curva sale de una expresion. La solucion de
    una EDO son puntos discretos que salieron de correr el metodo con un paso h
    dado: ahi el zoom reescala la vista, no genera puntos nuevos, porque no hay
    mas resolucion que obtener sin volver a resolver con otro h.

    Quien evalua sigue siendo el nucleo. Si la interfaz evaluara por su cuenta
    harian falta dos parsers, y dos parsers pueden discrepar justo en lo que el
    docente califica.
    """

    expression: str
    variables: tuple[str, ...] = ("x",)
    domain: tuple[float, float] | None = None


@dataclass(frozen=True)
class PlotSpec:
    """Datos ya calculados para graficar. El nucleo no dibuja: entrega puntos."""

    kind: PlotKind
    series: dict[str, Any]
    x_label: str = "x"
    y_label: str = "y"
    title: str = ""
    resample: Resample | None = None


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
