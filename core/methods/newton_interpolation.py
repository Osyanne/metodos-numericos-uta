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
# El material del docente usa solo diferencias divididas. `auto` sigue
# disponible, pero con puntos equiespaciados elige diferencias hacia adelante y
# esa no es la tabla de la clase.
VARIANTE_POR_DEFECTO = "divididas"
PUNTOS_GRAFICA = 201


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    """Interpola los puntos: polinomio expandido, forma de Newton y tabla."""
    puntos = _validar_puntos(params.get("points"))
    x_evaluado = _numero_finito(params.get("x"), "El valor x a evaluar")
    variante = _validar_variante(params.get("variante", VARIANTE_POR_DEFECTO))

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
    xs_exactos = [sympy.Rational(str(x)) for x in xs]
    niveles = _divididas_exactas(
        xs_exactos, [sympy.Rational(str(y)) for y in ys]
    )
    # Los a_i del pizarron: la diagonal de la tabla de diferencias divididas.
    diagonal = [nivel[0] for nivel in niveles]
    polinomio, grado = _polinomio_expandido(diagonal, xs_exactos)
    expresion = parse(polinomio)
    valor = expresion.evaluar(x=x_evaluado)

    columns, iterations = _tabla(variante_usada, xs, ys, niveles)
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
            "polinomio_newton": _forma_de_newton(diagonal, xs_exactos),
            "coeficientes": [float(a) for a in diagonal],
            "valor": valor,
            "grado": grado,
            "variante_usada": variante_usada,
        },
        converged=True,
        stop_reason=StopReason.EXACT,
        decimals=config.decimals,
        notes=_notas_de_la_tabla(variante_usada),
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


def _divididas_exactas(
    xs: Sequence[sympy.Rational],
    ys: Sequence[sympy.Rational],
) -> list[list[sympy.Rational]]:
    """Todos los niveles de diferencias divididas, en aritmetica exacta.

    El nivel k lleva f(X_i, ..., X_i+k) para cada i posible, asi que el primer
    elemento de cada nivel es el a_k de la forma de Newton.
    """
    niveles: list[list[sympy.Rational]] = [list(ys)]
    for orden in range(1, len(xs)):
        anterior = niveles[-1]
        niveles.append(
            [
                sympy.cancel(
                    (anterior[i + 1] - anterior[i]) / (xs[i + orden] - xs[i])
                )
                for i in range(len(xs) - orden)
            ]
        )
    return niveles


def _forma_de_newton(
    diagonal: Sequence[sympy.Rational],
    xs: Sequence[sympy.Rational],
) -> str:
    """a0 + a1*(x - X0) + a2*(x - X0)*(x - X1) + ..., sin expandir.

    Se arma a mano y no con `str()` de SymPy, que reordena y simplifica: lo que
    tiene que verse es la forma del pizarron, con los factores en el orden en
    que se cargaron los puntos. Cada a_i se escribe aunque valga 0 o 1, para
    que se lea contra la diagonal de la tabla.
    """
    terminos = []
    for orden, coeficiente in enumerate(diagonal):
        factores = [_coeficiente_de_newton(coeficiente)]
        factores.extend(_binomio(xs[j]) for j in range(orden))
        terminos.append("*".join(factores))
    return " + ".join(terminos)


def _coeficiente_de_newton(valor: sympy.Rational) -> str:
    """Un a_i negativo va entre parentesis, como lo escribe el docente."""
    texto = _numero(valor)
    return f"({texto})" if valor < 0 else texto


def _binomio(valor: sympy.Rational) -> str:
    """(x - X_j) con el signo ya resuelto; (x - 0) no se reduce a x."""
    signo = "-" if valor >= 0 else "+"
    return f"(x {signo} {_numero(abs(valor))})"


def _numero(valor: sympy.Rational) -> str:
    return str(int(valor)) if valor.is_Integer else str(float(valor))


def _polinomio_expandido(
    diagonal: Sequence[sympy.Rational],
    xs_exactos: Sequence[sympy.Rational],
) -> tuple[str, int]:
    """Arma la forma de Newton con los a_i y la expande a potencias de x."""
    simbolo = sympy.Symbol("x")
    polinomio: sympy.Expr = sympy.Integer(0)
    producto: sympy.Expr = sympy.Integer(1)
    for orden, coeficiente in enumerate(diagonal):
        polinomio += coeficiente * producto
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
    divididas: Sequence[Sequence[sympy.Rational]],
) -> tuple[list[Column], list[Iteration]]:
    if variante == "divididas":
        # Las mismas diferencias exactas que dan los a_i y el polinomio. Si la
        # tabla se recalculara en float, con abscisas muy juntas mostraria un
        # a_i distinto del que usa el resultado.
        niveles = [[float(valor) for valor in nivel] for nivel in divididas]
        prefijo = "dd"
        etiqueta = "Diferencia dividida"
        # Como en el pizarron: f(X_i-k, ..., X_i) va en la fila i, asi que la
        # fila 0 no lleva ninguna y los a_k quedan sobre la diagonal.
        desplazamiento = True
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


def _notas_de_la_tabla(variante_usada: str) -> list[str]:
    """Con diferencias finitas, los a_i del resumen no estan en la tabla.

    Los coeficientes y la forma de Newton son siempre los de diferencias
    divididas. Sin esta aclaracion, ver a_2 = 1 al lado de una tabla que dice 2
    parece un error.
    """
    if variante_usada == "divididas":
        return []
    nombre = "hacia adelante" if variante_usada == "adelante" else "hacia atras"
    notas = [
        f"La tabla muestra diferencias {nombre}, pero los coeficientes a_i y "
        "la forma de Newton salen de diferencias divididas, con los puntos en "
        "el orden ingresado: no coinciden celda por celda con la tabla."
    ]
    if variante_usada == "adelante":
        notas.append(
            "Con paso h, cada a_k es la diferencia adelante k de la fila 0 "
            "dividida por k! * h^k."
        )
    return notas


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
                default=VARIANTE_POR_DEFECTO,
                help="divididas (como en clase), auto, adelante o atras",
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
