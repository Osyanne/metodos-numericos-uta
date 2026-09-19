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

# Interpolacion del metodo de Newton.pdf, diapositivas 5 a 8. Ejercicio
# resuelto en clase, con diferencias divididas.
#
# Los puntos van en el orden del pizarron. No se ordenan por x: el orden
# decide que diferencias se calculan y cuales son los a_i.
NEWTON_DIVIDIDAS_RESUELTO = {
    "fuente": "Interpolacion del metodo de Newton.pdf, diapositivas 5-8",
    "puntos": [(1.0, 2.0), (0.0, 4.0), (-3.0, -2.0)],
    # Diapositiva 6. La clave son los indices de los puntos que usa cada una:
    # (0, 1) es f(X0, X1). En la tabla de las diapositivas 5 y 7 cada
    # diferencia va en la fila de su ultimo punto, y la fila 0 no lleva
    # ninguna.
    "divididas": {
        (0, 1): -2.0,
        (1, 2): 2.0,
        (0, 1, 2): -1.0,
    },
    # Diapositiva 7: los a_i marcados sobre la diagonal de esa tabla.
    "a_i": (2.0, -2.0, -1.0),
    # Diapositiva 7, antes de expandir, tal cual (en ASCII).
    "forma_de_newton": "2+[(-2)(X-1)]+[(-1)(X-1)(X-0)]",
    "polinomio": "-x^2 - x + 4",
    # Del polinomio expandido, de mayor a menor grado, como en
    # casos_referencia_lagrange.py. No son los a_i.
    "coeficientes": (-1.0, -1.0, 4.0),
    "grado": 2,
    # Diapositiva 8.
    "x": -4.0,
    "valor": -8.0,
}
