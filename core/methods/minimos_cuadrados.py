"""Ajuste por minimos cuadrados: la recta que minimiza la suma de d_i^2.

Con d_i = m x_i + b - y_i, la recta que deja la menor suma de cuadrados es

    m = (n Sxy - Sx Sy) / (n Sxx - Sx^2)        b = (Sy - m Sx) / n

y la correlacion r = (n Sxy - Sx Sy) / sqrt((n Sxx - Sx^2)(n Syy - Sy^2)) dice
que tan bien se alinean los datos: -1 perfecta e inversa, 0 ninguna, 1 perfecta
y directa.

Los modelos que no son rectas se linealizan con log en base 10, como los escribe
el docente, y se ajusta la recta Y = s X + c a los datos transformados:

    potencial     y = b x^m          log y = m log x + log b
    exponencial   y = b e^(m x)      log y = (m log e) x + log b
    logaritmica   y = m log x + b    y = m log x + b

La tabla no es un registro de convergencia: cada fila es un dato, con las
columnas del pizarron, y la fila de totales va aparte en `result["totales"]`.
Las sumas son exactas (fracciones sobre el decimal de cada dato), asi el
ejercicio del docente da m = 1.9 y no 1.8999999999999995.
"""
from __future__ import annotations

import math
from collections.abc import Sequence
from fractions import Fraction
from typing import Any

from core import plots
from core.config import SolveConfig
from core.methods.lagrange_interpolation import _numero_finito
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

MODELOS = ("lineal", "potencial", "exponencial", "logaritmica")
MODELO_POR_DEFECTO = "lineal"

# Que modelos toman log de x y de y: ahi los datos tienen que ser positivos.
_LOG_X = {"potencial", "logaritmica"}
_LOG_Y = {"potencial", "exponencial"}

# Rotulos de las columnas segun lo que cada modelo transforma.
_X = {True: "log x_i", False: "x_i"}
_Y = {True: "log y_i", False: "y_i"}


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    """Ajusta el modelo y devuelve la tabla del docente con sus totales."""
    puntos = _validar_puntos(params.get("points"))
    modelo = _validar_modelo(params.get("modelo"))
    x_evaluado = _validar_x(params.get("x"), modelo)
    _exigir_positivos(modelo, puntos)

    xs = [_fraccion(_transformar(x, modelo in _LOG_X)) for x, _ in puntos]
    ys = [_fraccion(_transformar(y, modelo in _LOG_Y)) for _, y in puntos]

    n = len(puntos)
    sx, sy = sum(xs), sum(ys)
    sxy = sum(x * y for x, y in zip(xs, ys, strict=True))
    sxx = sum(x * x for x in xs)
    syy = sum(y * y for y in ys)

    denominador_x = n * sxx - sx * sx
    if denominador_x == 0:
        raise MethodError(
            "Todos los datos tienen la misma x (despues de la transformacion): "
            "la recta queda vertical y no se puede ajustar."
        )
    numerador = n * sxy - sx * sy
    pendiente = numerador / denominador_x
    ordenada = (sy - pendiente * sx) / n

    denominador_y = n * syy - sy * sy
    r = (
        None if denominador_y == 0
        else max(-1.0, min(1.0, float(numerador) / math.sqrt(float(denominador_x * denominador_y))))
    )

    residuos2 = [(pendiente * x + ordenada - y) ** 2 for x, y in zip(xs, ys, strict=True)]
    suma_residuos = sum(residuos2)

    m, b = _parametros(modelo, float(pendiente), float(ordenada))
    columns, iterations = _tabla(modelo, xs, ys, residuos2)

    result: dict[str, Any] = {
        "ecuacion": _ecuacion(modelo, m, b),
        "m": m,
        "b": b,
        "r": r,
        "suma_residuos": float(suma_residuos),
    }
    if x_evaluado is not None:
        valor = _evaluar(modelo, m, b, x_evaluado)
        result["valor"] = valor
    result["n"] = n
    result["modelo"] = modelo
    if modelo != "lineal":
        result["pendiente_lineal"] = float(pendiente)
        result["ordenada_lineal"] = float(ordenada)
    result["totales"] = {
        "xi": float(sx), "yi": float(sy), "xiyi": float(sxy),
        "xi2": float(sxx), "yi2": float(syy), "error": float(suma_residuos),
    }

    expresion = _expresion(modelo, m, b)
    desde, hasta = _rango(modelo, [x for x, _ in puntos], x_evaluado)

    return MethodResult(
        method="minimos-cuadrados",
        columns=columns,
        iterations=iterations,
        result=result,
        converged=True,
        stop_reason=StopReason.EXACT,
        decimals=config.decimals,
        plot=plots.ajuste(
            puntos,
            *sample(expresion, x_min=desde, x_max=hasta, puntos=PUNTOS_GRAFICA),
            evaluated=None if x_evaluado is None else (x_evaluado, valor),
            title="Ajuste por minimos cuadrados",
            resample=Resample(expression=expresion, domain=(desde, hasta)),
        ),
        notes=_notas(modelo, r),
    )


# ---------- el modelo ----------

def _transformar(valor: float, con_log: bool) -> float:
    return math.log10(valor) if con_log else valor


def _fraccion(valor: float) -> Fraction:
    # El decimal mas corto que identifica al float: 3.2 entra como 32/10 y no
    # como su aproximacion binaria, y la suma da lo mismo que a mano.
    return Fraction(repr(float(valor)))


def _parametros(modelo: str, pendiente: float, ordenada: float) -> tuple[float, float]:
    """m y b del modelo, deshaciendo la transformacion de la recta ajustada."""
    if modelo == "potencial":
        return pendiente, 10.0 ** ordenada
    if modelo == "exponencial":
        # log y = m x log e + log b: la pendiente de la recta es m log e.
        return pendiente / math.log10(math.e), 10.0 ** ordenada
    return pendiente, ordenada


def _evaluar(modelo: str, m: float, b: float, x: float) -> float:
    if modelo == "potencial":
        return b * x**m
    if modelo == "exponencial":
        return b * math.exp(m * x)
    if modelo == "logaritmica":
        return m * math.log10(x) + b
    return m * x + b


def _ecuacion(modelo: str, m: float, b: float) -> str:
    mm, bb = _g(m), _g(b)
    if modelo == "potencial":
        return f"y = {bb}*x^{_entre_parentesis(mm)}"
    if modelo == "exponencial":
        return f"y = {bb}*e^({mm}*x)"
    termino = f"{mm}*log10(x)" if modelo == "logaritmica" else f"{mm}*x"
    signo = "-" if b < 0 else "+"
    return f"y = {termino} {signo} {_g(abs(b))}"


def _expresion(modelo: str, m: float, b: float) -> str:
    """La curva ajustada en la sintaxis del parser, para muestrear y remuestrear."""
    # Con todas las cifras: la curva no tiene que arrastrar el redondeo del texto.
    mm, bb = repr(m), repr(b)
    if modelo == "potencial":
        return f"({bb})*x**({mm})"
    if modelo == "exponencial":
        return f"({bb})*exp(({mm})*x)"
    if modelo == "logaritmica":
        return f"({mm})*log(x)/log(10) + ({bb})"
    return f"({mm})*x + ({bb})"


def _g(valor: float) -> str:
    # Diez cifras significativas: lo que importa, sin la basura binaria del final.
    return f"{valor:.10g}"


def _entre_parentesis(texto: str) -> str:
    return f"({texto})" if texto.startswith("-") else texto


def _rango(modelo: str, xs: Sequence[float], x_evaluado: float | None) -> tuple[float, float]:
    """Desde un poco antes del primer dato hasta un poco despues del ultimo.

    Incluye el x pedido, para que el punto evaluado caiga sobre la curva. Los
    modelos con log de x solo existen para x > 0: el rango no cruza el cero.
    """
    todos = [*xs] if x_evaluado is None else [*xs, x_evaluado]
    minimo, maximo = min(todos), max(todos)
    margen = 0.1 * (maximo - minimo)
    desde, hasta = minimo - margen, maximo + margen
    if modelo in _LOG_X and desde <= 0:
        desde = minimo / 2
    return desde, hasta


# ---------- la tabla ----------

def _tabla(
    modelo: str,
    xs: Sequence[Fraction],
    ys: Sequence[Fraction],
    residuos2: Sequence[Fraction],
) -> tuple[list[Column], list[Iteration]]:
    x, y = _X[modelo in _LOG_X], _Y[modelo in _LOG_Y]
    producto = f"{x}*{y}"
    cuadrado_x = f"({x})^2" if modelo in _LOG_X else "x_i^2"
    cuadrado_y = f"({y})^2" if modelo in _LOG_Y else "y_i^2"
    columns = [
        Column("xi", x),
        Column("yi", y),
        Column("xiyi", producto),
        Column("xi2", cuadrado_x),
        Column("yi2", cuadrado_y),
    ]
    iterations = [
        Iteration(
            n=i,
            values={
                "xi": float(xi),
                "yi": float(yi),
                "xiyi": float(xi * yi),
                "xi2": float(xi * xi),
                "yi2": float(yi * yi),
            },
            error=float(d2),
        )
        for i, (xi, yi, d2) in enumerate(zip(xs, ys, residuos2, strict=True), start=1)
    ]
    return columns, iterations


def _notas(modelo: str, r: float | None) -> list[str]:
    notas: list[str] = []
    if modelo != "lineal":
        transformadas = {
            "potencial": "log x e log y",
            "exponencial": "log y",
            "logaritmica": "log x",
        }[modelo]
        notas.append(
            f"El modelo {modelo} se linealiza con log en base 10: la tabla muestra "
            f"los datos transformados ({transformadas}), y r, la suma de los "
            "cuadrados de los residuos y la columna de error se miden sobre la "
            "recta ajustada a esos datos. m y b salen de deshacer la transformacion."
        )
    if r is None:
        notas.append(
            "r no esta definida: todas las y son iguales, y la recta horizontal "
            "pasa por todos los datos."
        )
    return notas


# ---------- validacion ----------

def _validar_puntos(raw: Any) -> list[tuple[float, float]]:
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        raise MethodError("Se necesita una tabla con al menos dos puntos [x, y].")
    if len(raw) < 2:
        raise MethodError("Se necesitan al menos dos puntos para ajustar una recta.")

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
        puntos.append((
            _numero_finito(punto[0], f"La x del punto {indice}"),
            _numero_finito(punto[1], f"La y del punto {indice}"),
        ))

    # Una misma x repetida es una medicion repetida y se admite; lo que no se
    # puede es ajustar una recta cuando todos los datos caen sobre una vertical.
    if len({x for x, _ in puntos}) < 2:
        raise MethodError(
            "Se necesitan al menos dos valores distintos de x: con una sola x "
            "los datos quedan sobre una vertical y no hay recta que ajustar."
        )
    return puntos


def _validar_modelo(raw: Any) -> str:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return MODELO_POR_DEFECTO
    if not isinstance(raw, str) or raw.strip().lower() not in MODELOS:
        raise MethodError(f"El modelo debe ser uno de: {', '.join(MODELOS)}.")
    return raw.strip().lower()


def _validar_x(raw: Any, modelo: str) -> float | None:
    if raw is None or raw == "":
        return None
    x = _numero_finito(raw, "El valor x a evaluar")
    if modelo in _LOG_X and x <= 0:
        raise MethodError(
            f"El x a evaluar tiene que cumplir x > 0 en el modelo {modelo}, "
            f"que toma log de x; se pidio x = {x:g}."
        )
    return x


def _exigir_positivos(modelo: str, puntos: Sequence[tuple[float, float]]) -> None:
    """El log solo existe para positivos: se dice cual dato lo impide."""
    for indice, (x, y) in enumerate(puntos, start=1):
        if modelo in _LOG_X and x <= 0:
            raise MethodError(
                f"El modelo {modelo} toma log de x y necesita x > 0, pero el "
                f"punto {indice} tiene x = {x:g}."
            )
        if modelo in _LOG_Y and y <= 0:
            raise MethodError(
                f"El modelo {modelo} toma log de y y necesita y > 0, pero el "
                f"punto {indice} tiene y = {y:g}."
            )


SPEC = register(
    MethodSpec(
        slug="minimos-cuadrados",
        name="Ajuste por minimos cuadrados",
        unit="U4",
        family="ajuste",
        orden=11,
        inputs=[
            InputField(
                "points",
                "Puntos [x, y]",
                FieldKind.POINTS,
                help="Los datos medidos. Se admite repetir una x.",
            ),
            InputField(
                "modelo",
                "Modelo",
                FieldKind.EXPRESSION,
                default=MODELO_POR_DEFECTO,
                help=(
                    "Potencial, exponencial y logaritmica se linealizan con "
                    "log en base 10."
                ),
                required=False,
                choices=MODELOS,
            ),
            InputField(
                "x",
                "x a evaluar (opcional)",
                FieldKind.NUMBER,
                required=False,
            ),
        ],
        solve=solve,
        description=(
            "Halla la recta m x + b que minimiza la suma de los cuadrados de "
            "los residuos, con la tabla del docente, su fila de totales y la "
            "correlacion r. Tambien ajusta los modelos potencial, exponencial "
            "y logaritmico linealizandolos."
        ),
    )
)
