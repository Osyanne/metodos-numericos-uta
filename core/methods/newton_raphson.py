"""Metodo de Newton-Raphson.

    x(i+1) = x(i) - f(x(i)) / f'(x(i))

La derivada se evalua **en cada iteracion**. Esa es toda la diferencia con Von
Mises, que la congela en el punto inicial.
"""
from __future__ import annotations

from typing import Any

from core.config import SolveConfig
from core.methods._raices import derivada_de, leer_funcion, leer_numero, resolver
from core.registry import register
from core.types import FieldKind, InputField, MethodError, MethodResult, MethodSpec

SLUG = "newton-raphson"


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    f = leer_funcion(params)
    x0 = leer_numero(params, "x0", "el valor inicial x0")
    derivada, nota = derivada_de(f, params)

    def siguiente(xi: float, fxi: float) -> float:
        pendiente = derivada.evaluar(x=xi)
        if pendiente == 0.0:
            raise MethodError(
                f"La derivada se anula en x = {xi:g}, asi que la recta tangente "
                f"es horizontal y no corta al eje. Newton-Raphson no puede "
                f"continuar desde ahi; probar con otro valor inicial, o usar Von "
                f"Mises, que congela la derivada en el punto inicial."
            )
        return xi - fxi / pendiente

    return resolver(
        metodo=SLUG,
        f=f,
        x0=x0,
        siguiente=siguiente,
        cfg=cfg,
        notas=[nota],
        titulo=f"Newton-Raphson sobre f(x) = {f}",
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Newton-Raphson",
        unit="U1",
        family="raices",
        description=(
            "Aproxima una raiz de f(x) = 0 trazando la tangente en cada punto y "
            "tomando donde corta al eje x. Converge rapido cerca de la raiz, "
            "pero se rompe donde la derivada se acerca a cero."
        ),
        reference="x(i+1) = x(i) - f(x(i)) / f'(x(i))",
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="x^3 - 2x - 5",
                help="Se puede escribir como en clase: x^3 - 2x - 5, ln(x), exp(-x).",
            ),
            InputField(
                name="x0",
                label="Valor inicial x0",
                kind=FieldKind.NUMBER,
                default=2.0,
            ),
            InputField(
                name="dfx",
                label="f'(x)",
                kind=FieldKind.EXPRESSION,
                required=False,
                help="Opcional. Si se deja vacio, el aplicativo la deriva solo.",
            ),
        ],
        solve=solve,
    )
)
