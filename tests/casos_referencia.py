"""Casos de referencia tomados del material del docente.

Unica fuente de verdad para validar los metodos. Si el aplicativo no
reproduce estos numeros, esta mal aunque el algoritmo parezca correcto.

No es un archivo de pruebas: es el dato que las pruebas consumen.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FilaReferencia:
    """Una fila de la tabla tal como la escribe el docente.

    El error de la fila i compara x_{i+1} contra x_i, con x_{i+1} en el
    denominador. La fila 0 no lleva error.
    """

    i: int
    xi: float
    fxi: float
    xi_siguiente: float
    error_relativo_porcentual: float | None


# VON MISES.pdf, diapositiva 7. f(x) = e^-x - ln(x), x0 = 1.
# En Python y sympy, ln(x) se escribe log(x).
VON_MISES_EXP_LOG = {
    "fuente": "VON MISES.pdf, diapositiva 7",
    "fx": "exp(-x) - log(x)",
    "x0": 1.0,
    "derivada_congelada_en_x0": -1.36787944,
    "filas": [
        FilaReferencia(0, 1.0, 0.36787944, 1.26894142, None),
        FilaReferencia(1, 1.26894142, 0.042946035, 1.30033749, 2.4144554),
        FilaReferencia(2, 1.30033749, 0.00981599, 1.307513555, 0.54883309),
    ],
}

# VON MISES.pdf, diapositiva 10. Ejercicio propuesto, sin resolver.
VON_MISES_EJERCICIO = {
    "fuente": "VON MISES.pdf, diapositiva 10",
    "fx": "4*x**3 - 18*x**2 + 12*x - 6",
    "x0": 1.165,
    "filas": [],
}
