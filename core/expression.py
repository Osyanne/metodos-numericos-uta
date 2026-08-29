"""Parseo, derivacion y evaluacion de las expresiones que escribe el usuario.

CONGELADO: lo consumen los dos carriles.

La entrada llega por HTTP, asi que no se le pasa texto arbitrario a sympy: se
parsea y despues se recorre el arbol rechazando cualquier simbolo o funcion que
no este en la lista blanca. Sin eso, `parse_expr` evalua cosas que no queremos.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

import sympy
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from core.types import MethodError

# Funciones que el usuario puede escribir. Cualquier otra se rechaza.
FUNCIONES_PERMITIDAS = {
    sympy.sin, sympy.cos, sympy.tan,
    sympy.asin, sympy.acos, sympy.atan,
    sympy.sinh, sympy.cosh, sympy.tanh,
    sympy.exp, sympy.log, sympy.sqrt, sympy.Abs,
}

NOMBRES_PERMITIDOS = {
    "sin": sympy.sin, "cos": sympy.cos, "tan": sympy.tan,
    "asin": sympy.asin, "acos": sympy.acos, "atan": sympy.atan,
    "sinh": sympy.sinh, "cosh": sympy.cosh, "tanh": sympy.tanh,
    "exp": sympy.exp, "log": sympy.log, "ln": sympy.log,
    "sqrt": sympy.sqrt, "abs": sympy.Abs,
    "pi": sympy.pi, "e": sympy.E,
}

_TRANSFORMACIONES = standard_transformations + (implicit_multiplication_application,)

# Lo unico que el parser de sympy necesita para construir numeros y simbolos.
# Vaciarlo del todo rompe las transformaciones; dejarlo por defecto trae
# `from sympy import *` entero, que es justo lo que no queremos.
_GLOBALES_MINIMOS = {
    "Symbol": sympy.Symbol,
    "Integer": sympy.Integer,
    "Float": sympy.Float,
    "Rational": sympy.Rational,
}

# Se rechaza antes de parsear: no hay razon legitima para que aparezcan.
_PROHIBIDO = re.compile(r"(__|import|lambda|eval|exec|open|\bos\b|\bsys\b)", re.I)


@dataclass(frozen=True)
class Expression:
    """Una expresion ya validada, lista para evaluar o derivar."""

    texto: str
    variables: tuple[str, ...]
    _expr: sympy.Expr
    _funcion: object

    def __str__(self) -> str:
        return self.texto

    def evaluar(self, **valores: float) -> float:
        """Evalua en un punto. Un resultado no finito es un fallo del metodo,
        no un NaN que se propaga silenciosamente por la tabla."""
        faltan = set(self.variables) - set(valores)
        if faltan:
            raise MethodError(
                f"Falta el valor de {', '.join(sorted(faltan))} para evaluar "
                f"{self.texto}."
            )
        try:
            resultado = self._funcion(*(valores[v] for v in self.variables))
        except (ValueError, ZeroDivisionError, OverflowError, TypeError) as exc:
            raise MethodError(
                f"No se puede evaluar {self.texto} en "
                f"{self._punto(valores)}: {self._causa(exc)}."
            ) from exc

        numero = float(resultado)
        if not math.isfinite(numero):
            raise MethodError(
                f"{self.texto} no esta definida en {self._punto(valores)}: el "
                f"resultado no es un numero finito."
            )
        return numero

    def evaluar_seguro(self, **valores: float) -> float | None:
        """Igual que evaluar, pero devuelve None en vez de fallar.

        Para graficar: que un punto de la curva caiga fuera del dominio no
        puede tumbar toda la grafica.
        """
        try:
            return self.evaluar(**valores)
        except MethodError:
            return None

    def derivada(self, respecto: str = "x") -> "Expression":
        """Derivada simbolica. Se devuelve como Expression para poder mostrarle
        al usuario que derivada uso el aplicativo."""
        if respecto not in self.variables:
            raise MethodError(
                f"No se puede derivar {self.texto} respecto de {respecto}: "
                f"esa variable no aparece en la expresion."
            )
        derivada = sympy.simplify(sympy.diff(self._expr, sympy.Symbol(respecto)))
        return _construir(derivada, self.variables)

    def _punto(self, valores: dict[str, float]) -> str:
        return ", ".join(f"{v} = {valores[v]:g}" for v in self.variables)

    @staticmethod
    def _causa(exc: Exception) -> str:
        if isinstance(exc, ZeroDivisionError):
            return "hay una division entre cero"
        if isinstance(exc, OverflowError):
            return "el valor se desborda"
        return "el punto queda fuera del dominio"


def parse(texto: str, variables: tuple[str, ...] = ("x",)) -> Expression:
    """Convierte el texto del usuario en una Expression validada.

    Acepta `^` como potencia y multiplicacion implicita, porque es como se
    escribe en clase: `2x^3 - 5` en vez de `2*x**3 - 5`.
    """
    if not isinstance(texto, str) or not texto.strip():
        raise MethodError("La funcion esta vacia.")

    if _PROHIBIDO.search(texto):
        raise MethodError(
            "La funcion contiene texto que no se reconoce como expresion "
            "matematica."
        )

    normalizado = texto.replace("^", "**")
    locales = dict(NOMBRES_PERMITIDOS)
    locales.update({v: sympy.Symbol(v) for v in variables})

    try:
        expr = parse_expr(
            normalizado,
            local_dict=locales,
            transformations=_TRANSFORMACIONES,
            global_dict=dict(_GLOBALES_MINIMOS),
            evaluate=True,
        )
    except Exception as exc:
        raise MethodError(
            f"No se entiende la funcion '{texto}'. Revisa parentesis y "
            f"operadores."
        ) from exc

    _validar(expr, variables, texto)
    return _construir(expr, variables)


def _validar(expr: sympy.Expr, variables: tuple[str, ...], texto: str) -> None:
    """Recorre el arbol y rechaza lo que no este en la lista blanca."""
    permitidas = set(variables)
    for nodo in sympy.preorder_traversal(expr):
        if isinstance(nodo, sympy.Symbol):
            if nodo.name not in permitidas:
                raise MethodError(
                    f"La funcion '{texto}' usa '{nodo.name}', que no es una "
                    f"variable valida. Se esperaba: {', '.join(variables)}."
                )
        elif isinstance(nodo, sympy.Function):
            if type(nodo) not in FUNCIONES_PERMITIDAS:
                nombre = type(nodo).__name__
                raise MethodError(
                    f"La funcion '{nombre}' no esta permitida. Se pueden usar: "
                    f"{', '.join(sorted(NOMBRES_PERMITIDOS))}."
                )


def _construir(expr: sympy.Expr, variables: tuple[str, ...]) -> Expression:
    simbolos = [sympy.Symbol(v) for v in variables]
    funcion = sympy.lambdify(simbolos, expr, modules=["math"])
    return Expression(
        texto=str(expr),
        variables=variables,
        _expr=expr,
        _funcion=funcion,
    )
