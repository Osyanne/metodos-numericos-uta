"""Piezas comunes de Simpson 1/3 y Simpson 3/8.

El guion bajo inicial hace que el autoload no lo registre como metodo.

Las dos reglas son lo mismo con otro grado de polinomio: un tramo toma varios
subintervalos de ancho h, los pesa con una fila de coeficientes y multiplica el
corchete por un factor.

    regla   subintervalos   polinomio   pesos            factor
    1/3     2               parabola    1, 4, 1          h/3
    3/8     3               cubica      1, 3, 3, 1       3h/8

Varios tramos de la misma regla se encadenan y el nodo donde uno termina y
empieza el siguiente pesa 1 + 1 = 2. Simpson 3/8 con n que no es multiplo de 3
combina las dos reglas (Chapra, ejemplo 21.6): la 1/3 cubre los primeros
subintervalos y la 3/8 el resto. Ahi cada regla tiene su corchete y su factor,
y el nodo de union aparece dos veces en la tabla, una como ultimo de la 1/3 y
otra como primero de la 3/8, cada vez con peso 1.
"""
from __future__ import annotations

import math
from typing import Any

from core.methods._integracion import (
    leer_entero_positivo,
    leer_funcion,
    leer_numero,
    validar_intervalo,
)
from core.types import Iteration, MethodError

# Cada subintervalo es una fila de la tabla que se guarda entera en memoria.
MAX_SUBINTERVALOS = 10_000
PUNTOS_GRAFICA = 401

# Tamano de un tramo, en subintervalos, y denominador del factor de cada regla.
SUBINTERVALOS = {"1/3": 2, "3/8": 3}


def leer_problema(params: dict[str, Any]) -> tuple[Any, float, float, int]:
    """f, a, b y n de un problema de integracion, ya validados."""
    f = leer_funcion(params)
    a = leer_numero(params, "a", "el extremo inferior a")
    b = leer_numero(params, "b", "el extremo superior b")
    n = leer_entero_positivo(params, "n", "el numero de subintervalos n")
    validar_intervalo(a, b)
    if n > MAX_SUBINTERVALOS:
        raise MethodError(
            f"Se piden {n} subintervalos y el maximo es {MAX_SUBINTERVALOS}. "
            "Cada punto es una fila de la tabla que se calcula y se guarda "
            "entera en memoria; con mas que eso deja de ser legible. Reduce n."
        )
    return f, a, b, n


def malla(f: Any, a: float, b: float, n: int) -> tuple[float, list[float], list[float]]:
    """h, los nodos x_i = a + i*h y f en cada uno. El ultimo nodo es b."""
    h = (b - a) / n
    if not math.isfinite(h) or h == 0:
        raise MethodError("El ancho de subintervalo h no es finito: revisa a, b y n.")
    # Sin acumular h: el error no crece con n.
    xs = [b if i == n else a + i * h for i in range(n + 1)]
    return h, xs, [f.evaluar(x=x) for x in xs]


def pesos(regla: str, subintervalos: int) -> list[float]:
    """Pesos de los nodos de una cadena de tramos de la misma regla.

    1/3: 1, 4, 2, 4, ..., 2, 4, 1    3/8: 1, 3, 3, 2, 3, 3, 2, ..., 3, 3, 1
    """
    paso = SUBINTERVALOS[regla]
    if subintervalos < paso or subintervalos % paso:
        raise ValueError(f"{subintervalos} subintervalos no forman tramos {regla}")
    if regla == "1/3":
        interior = lambda i: 4.0 if i % 2 else 2.0  # noqa: E731
    else:
        interior = lambda i: 2.0 if i % 3 == 0 else 3.0  # noqa: E731
    return [1.0, *(interior(i) for i in range(1, subintervalos)), 1.0]


def factor(regla: str, h: float) -> float:
    return h / 3 if regla == "1/3" else 3 * h / 8


def partir(n: int) -> list[tuple[str, int, int]]:
    """Reparto de los n subintervalos de Simpson 3/8: (regla, desde, hasta).

    n multiplo de 3: todo 3/8. Si no, la 1/3 toma los primeros 2 subintervalos
    (n = 2 mod 3) o 4 (n = 1 mod 3) y la 3/8 el resto, que es multiplo de 3.
    """
    if n % 3 == 0:
        return [("3/8", 0, n)]
    if n < 3:
        raise MethodError(
            f"n = {n} no alcanza. Simpson 3/8 necesita al menos 3 subintervalos "
            "(cuatro nodos para la cubica): usa n = 3 o mas."
        )
    if n == 4:
        raise MethodError(
            "Con n = 4 no queda ningun tramo de tres subintervalos para la "
            "regla 3/8: la 1/3 se quedaria con los cuatro. Usa Simpson 1/3 "
            "(n par) o elige n = 3, 5, 6, 7, ..."
        )
    corte = 2 if n % 3 == 2 else 4
    return [("1/3", 0, corte), ("3/8", corte, n)]


def recorrer(
    tramos: list[tuple[str, int, int]],
    xs: list[float],
    fs: list[float],
    h: float,
    *,
    con_regla: bool,
) -> tuple[list[Iteration], list[dict[str, Any]]]:
    """Filas de la tabla y resumen de cada tramo (cada regla con su corchete).

    La fila avanza de a un nodo por tramo, y la suma del corchete arranca de
    cero con cada regla: asi la ultima fila de un tramo muestra su corchete.
    """
    filas: list[Iteration] = []
    resumen: list[dict[str, Any]] = []
    for regla, desde, hasta in tramos:
        corchete = 0.0
        for peso, i in zip(pesos(regla, hasta - desde), range(desde, hasta + 1)):
            ponderado = peso * fs[i]
            corchete += ponderado
            valores: dict[str, Any] = {
                "xi": xs[i], "fxi": fs[i], "peso": peso,
                "ponderado": ponderado, "suma": corchete,
            }
            if con_regla:
                valores |= {"nodo": f"x{i}", "regla": regla}
            filas.append(Iteration(n=len(filas), values=valores, error=None))
        multiplicador = factor(regla, h)
        resumen.append({
            "regla": regla,
            "desde": xs[desde],
            "hasta": xs[hasta],
            "corchete": corchete,
            "factor": multiplicador,
            "integral": multiplicador * corchete,
        })
    return filas, resumen


def arcos(
    tramos: list[tuple[str, int, int]], xs: list[float], fs: list[float]
) -> tuple[list[tuple[float, ...]], list[list[tuple[float, float]]], list[int]]:
    """Parabolas (tramos 1/3), cubicas (tramos 3/8) y la fila donde acaba cada
    arco: las parabolas primero y despues las cubicas, en orden.

    Una parabola pasa por tres nodos y una cubica por cuatro. La fila cuenta el
    nodo de union dos veces, como la tabla.
    """
    parabolas: list[tuple[float, ...]] = []
    cubicas: list[list[tuple[float, float]]] = []
    filas: list[int] = []
    base = 0  # fila de la tabla donde esta el primer nodo del tramo
    for regla, desde, hasta in tramos:
        if regla == "1/3":
            for i in range(desde, hasta, 2):
                parabolas.append(
                    (xs[i], fs[i], xs[i + 1], fs[i + 1], xs[i + 2], fs[i + 2])
                )
                filas.append(base + i - desde + 2)
        else:
            for i in range(desde, hasta, 3):
                cubicas.append([(xs[i + d], fs[i + d]) for d in range(4)])
                filas.append(base + i - desde + 3)
        base += hasta - desde + 1
    return parabolas, cubicas, filas


def nodos(
    tramos: list[tuple[str, int, int]], xs: list[float], fs: list[float]
) -> list[tuple[str, float, float]]:
    """Un punto marcado por fila de la tabla: (rotulo, x, f(x))."""
    return [
        (f"x{i}", xs[i], fs[i])
        for _, desde, hasta in tramos
        for i in range(desde, hasta + 1)
    ]
