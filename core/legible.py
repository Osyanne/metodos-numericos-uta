"""Las expresiones escritas como en el pizarron, para mostrarlas.

`str()` de SymPy escribe en sintaxis de Python (`sqrt(x**3 + 5)`, `25*x`), que
es lo que hay que guardar para volver a parsear. Para leer se escribe
`√(x³ + 5)` y `25x`. Este texto es solo para mostrar: nunca se vuelve a parsear.
"""
from __future__ import annotations

import sympy
from sympy.printing.precedence import PRECEDENCE
from sympy.printing.str import StrPrinter

_SUPERINDICE = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def legible(expr: sympy.Expr) -> str:
    """`400*x**5 - 25*x + 0.2` como `400x⁵ − 25x + 0.2`."""
    # El signo menos se escribe al final: StrPrinter separa los terminos
    # negativos de una suma mirando si el texto empieza por "-".
    return _Pizarron().doprint(expr).replace("-", "−")


class _Pizarron(StrPrinter):
    def _print_Float(self, expr) -> str:
        texto = repr(float(expr))
        if texto.endswith(".0"):
            texto = texto[:-2]
        if "e" in texto:
            mantisa, exponente = texto.split("e")
            texto = f"{mantisa}×10{str(int(exponente)).translate(_SUPERINDICE)}"
        return texto

    def _print_Pow(self, expr, rational=False) -> str:
        base, exponente = expr.as_base_exp()
        if exponente is sympy.S.Half:
            return "√" + self.parenthesize(base, PRECEDENCE["Pow"])
        if exponente.is_Rational and exponente.is_negative:
            return "1/" + self.parenthesize(base ** -exponente, PRECEDENCE["Mul"])
        texto_base = self.parenthesize(base, PRECEDENCE["Pow"])
        if exponente.is_Integer:
            return texto_base + str(exponente).translate(_SUPERINDICE)
        texto = self._print(exponente)
        simple = exponente.is_Symbol or (exponente.is_Float and exponente >= 0)
        return f"{texto_base}^{texto if simple else f'({texto})'}"

    def _print_Mul(self, expr) -> str:
        if expr.could_extract_minus_sign():
            return "-" + self.parenthesize(-expr, PRECEDENCE["Mul"], strict=True)
        arriba, abajo = [], []
        for factor in expr.as_ordered_factors():
            if factor.is_Pow and factor.exp.is_Rational and factor.exp.is_negative:
                abajo.append(factor.base ** -factor.exp)
            elif factor.is_Rational and not factor.is_Integer:
                if factor.p != 1:
                    arriba.append(sympy.Integer(factor.p))
                abajo.append(sympy.Integer(factor.q))
            else:
                arriba.append(factor)
        texto = self._producto(arriba) if arriba else "1"
        if not abajo:
            return texto
        divisor = self._producto(abajo)
        if len(abajo) > 1:
            divisor = f"({divisor})"
        return f"{texto}/{divisor}"

    def _producto(self, factores) -> str:
        """25x, 2πx y (x − 1)(x − 4) sin punto; 2 sin(x) con espacio; x·sin(x) con punto."""
        partes = [self.parenthesize(f, PRECEDENCE["Mul"]) for f in factores]
        texto = partes[0]
        for anterior, parte in zip(partes, partes[1:]):
            pegado = (
                (anterior[-1].isdigit() or anterior.endswith("π")) and "×" not in anterior
                and (parte[0].isalpha() or parte[0] in "√(π|")
            ) or (anterior.endswith(")") and parte.startswith("("))
            if pegado and len(parte) > 1 and parte[:2].isalpha():
                texto += " " + parte  # un nombre de funcion: 2 sin(x), no 2sin(x)
            else:
                texto += parte if pegado else "·" + parte
        return texto

    def _print_exp(self, expr) -> str:
        exponente = expr.args[0]
        texto = self._print(exponente)
        simple = exponente.is_Symbol or (exponente.is_Number and exponente >= 0)
        return f"e^{texto if simple else f'({texto})'}"

    def _print_Exp1(self, expr) -> str:
        return "e"

    def _print_Pi(self, expr) -> str:
        return "π"

    def _print_log(self, expr) -> str:
        return f"ln({self._print(expr.args[0])})"

    def _print_Abs(self, expr) -> str:
        return f"|{self._print(expr.args[0])}|"
