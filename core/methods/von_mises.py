"""Metodo de Von Mises.

    x(i+1) = x(i) - f(x(i)) / f'(x0)

Variante de Newton-Raphson: en vez de trazar una tangente nueva en cada punto,
traza siempre **paralelas a la primera tangente**. Sirve cuando f'(x(i)) se
acerca a cero y Newton-Raphson se vuelve inestable.

No tiene nada que ver con el metodo de las potencias para autovalores, que en
otros contextos tambien lleva el nombre de Von Mises.

Cuidado con lo unico que hay que hacer bien: **la derivada se evalua una sola
vez, antes del bucle.** El algoritmo del docente reasigna x0 = x en cada paso
pero deja la derivada en la del x0 original. Si se recalcula con el x0
actualizado, esto se convierte en Newton-Raphson: sigue convergiendo, sigue
pareciendo correcto, y los numeros dejan de coincidir con los de clase.
"""
from __future__ import annotations

from typing import Any

from core.config import SolveConfig
from core.methods._raices import derivada_de, leer_funcion, leer_numero, resolver
from core.registry import register
from core.types import FieldKind, InputField, MethodError, MethodResult, MethodSpec

SLUG = "von-mises"


def solve(params: dict[str, Any], cfg: SolveConfig) -> MethodResult:
    f = leer_funcion(params)
    x0 = leer_numero(params, "x0", "el valor inicial x0")
    derivada, nota = derivada_de(f, params)

    # Una sola vez, antes del bucle. Aca esta el metodo entero.
    pendiente = derivada.evaluar(x=x0)
    if pendiente == 0.0:
        raise MethodError(
            f"La derivada se anula en el valor inicial x0 = {x0:g}. Von Mises "
            f"congela la derivada en ese punto, asi que no puede arrancar desde "
            f"ahi; hay que elegir otro x0."
        )

    def siguiente(xi: float, fxi: float) -> float:
        return xi - fxi / pendiente

    notas = [
        nota,
        f"Derivada congelada en el punto inicial: f'({x0:g}) = {pendiente:.8f}. "
        f"Se usa el mismo valor en todas las iteraciones.",
    ]

    return resolver(
        metodo=SLUG,
        f=f,
        x0=x0,
        siguiente=siguiente,
        cfg=cfg,
        notas=notas,
        titulo=f"Von Mises sobre f(x) = {f}",
    )


register(
    MethodSpec(
        slug=SLUG,
        name="Von Mises",
        unit="U1",
        family="raices",
        description=(
            "Variante de Newton-Raphson que congela la derivada en el punto "
            "inicial. En vez de una tangente nueva por iteracion, traza "
            "paralelas a la primera. Converge mas lento, pero aguanta donde "
            "Newton-Raphson se rompe por tener la derivada cerca de cero."
        ),
        reference="x(i+1) = x(i) - f(x(i)) / f'(x0)",
        inputs=[
            InputField(
                name="fx",
                label="f(x)",
                kind=FieldKind.EXPRESSION,
                default="exp(-x) - ln(x)",
                help="Se puede escribir como en clase: x^3 - 2x - 5, ln(x), exp(-x).",
            ),
            InputField(
                name="x0",
                label="Valor inicial x0",
                kind=FieldKind.NUMBER,
                default=1.0,
                help="La derivada se congela en este punto para todas las iteraciones.",
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
