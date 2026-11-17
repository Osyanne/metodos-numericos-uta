"""Casos de referencia tomados del material del docente.

Unica fuente de verdad para validar los metodos. Si el aplicativo no
reproduce estos numeros, esta mal aunque el algoritmo parezca correcto.

No es un archivo de pruebas: es el dato que las pruebas consumen.
Los puntos se guardan en el orden en que los escribe el docente: ese orden
tambien fija las filas de las tablas de interpolacion.
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
    # los casos de Lagrange de este modulo. No son los a_i.
    "coeficientes": (-1.0, -1.0, 4.0),
    "grado": 2,
    # Diapositiva 8.
    "x": -4.0,
    "valor": -8.0,
}

# INTERPOLACION DE LAGRANGE.pdf, diapositivas 5 a 7. Ejercicio resuelto en
# clase, con la comprobacion grafica incluida.
LAGRANGE_RESUELTO = {
    "fuente": "INTERPOLACION DE LAGRANGE.pdf, diapositivas 5-7",
    "puntos": [(0.0, 1.0), (1.0, 3.0), (2.0, 0.0)],
    # L_i tal como quedan en la diapositiva, ya simplificados.
    "bases_expandidas": [
        "x**2/2 - 3*x/2 + 1",
        "-x**2 + 2*x",
        "x**2/2 - x/2",
    ],
    "polinomio": "-5/2 x^2 + 9/2 x + 1",
    "coeficientes": (-2.5, 4.5, 1.0),
    "grado": 2,
    # Tabla de la diapositiva "GRAFICA".
    "tabla_grafica": {
        -2.0: -18.0,
        -1.0: -6.0,
        0.0: 1.0,
        1.0: 3.0,
        2.0: 0.0,
        3.0: -8.0,
    },
}

# INTERPOLACION DE LAGRANGE.pdf, diapositivas 8 y 9. Segundo ejercicio
# resuelto, con el procedimiento de cinco pasos escrito completo.
LAGRANGE_RESUELTO_2 = {
    "fuente": "INTERPOLACION DE LAGRANGE.pdf, diapositivas 8-9",
    "puntos": [(1.0, 3.0), (2.0, 5.0), (3.0, 1.0)],
    "bases_expandidas": [
        "x**2/2 - 5*x/2 + 3",
        "-x**2 + 4*x - 3",
        "x**2/2 - 3*x/2 + 1",
    ],
    "polinomio": "-3x^2 + 11x - 5",
    "coeficientes": (-3.0, 11.0, -5.0),
    "grado": 2,
}

# INTERPOLACION DE LAGRANGE.pdf, diapositiva 10. Ejercicio propuesto, sin
# resolver en clase. El polinomio y el valor se calcularon a mano y se
# verificaron punto por punto.
LAGRANGE_EJERCICIO = {
    "fuente": "INTERPOLACION DE LAGRANGE.pdf, diapositiva 10",
    "puntos": [(1.0, 10.0), (-4.0, 10.0), (-7.0, 34.0)],
    "polinomio": "x^2 + 3x + 6",
    "coeficientes": (1.0, 3.0, 6.0),
    "grado": 2,
    "x": -3.0,
    "valor": 6.0,
}

# Material del docente, ejemplo del parcial 1 de Punto Medio. El nombre del
# PDF y el numero de diapositiva no quedaron registrados en la prueba original.
# La diapositiva tabula f(m_i) con cuatro decimales y termina con I = -0.2051.
# Se conservan por separado esa precision, la suma sin redondear y la integral
# analitica, que se usa para comprobar el efecto de refinar la malla.
PUNTO_MEDIO_RESUELTO = {
    "fuente": "Material del docente, ejemplo del parcial 1 de Punto Medio",
    "fx": "0.25*x^3 - x",
    "a": -1.5,
    "b": 2,
    "n": 7,
    "delta_x": 0.5,
    "puntos_medios": [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75],
    "valores_tabla": [0.7617, 0.6445, 0.2461, -0.2461, -0.6445, -0.7617, -0.4102],
    "integral": -0.205078125,
    "integral_diapositiva": -0.2051,
    "integral_exacta": -0.19140625,
}


# Ejercicio del docente de ajuste por minimos cuadrados (recta). Los totales y
# los errores son los del pizarron, a dos decimales (el error, a cuatro).
MINIMOS_CUADRADOS_DOCENTE = {
    "fuente": "Material del docente, ajuste por minimos cuadrados",
    "puntos": [[1.0, 2.0], [1.5, 3.2], [2.0, 4.1], [2.5, 4.9], [3.0, 5.9]],
    "m": 1.9,
    "b": 0.22,
    "r": 0.9976262076984156,
    "suma_residuos": 0.043,
    "totales_pizarron": {
        "xi": 10.0, "yi": 20.1, "xiyi": 44.95, "xi2": 22.5, "yi2": 89.87,
        "error": 0.0430,
    },
    "errores_pizarron": [0.0144, 0.0169, 0.0064, 0.0049, 0.0004],
}

# Ejemplo 21.6 de Chapra: f(x) = 0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5
# en [0, 0.8], valor exacto 1.640533. Con n = 5 (no multiplo de 3) Simpson 3/8
# combina la regla 1/3 en los dos primeros subintervalos y la 3/8 en los tres
# restantes. Chapra imprime 1.264754 para la 3/8 (redondeo de sus pasos).
SIMPSON_38_CHAPRA = {
    "fuente": "Chapra, ejemplo 21.6 (aplicacion multiple de Simpson)",
    "fx": "0.2 + 25*x - 200*x^2 + 675*x^3 - 900*x^4 + 400*x^5",
    "a": 0,
    "b": 0.8,
    "n": 5,
    "exacto": 1.640533333333333,
    "tramo_1_3": {"corchete": 7.13106944, "integral": 0.3803237},
    "tramo_3_8": {"corchete": 21.07922432, "integral": 1.2647535},
    "integral": 1.645077,
}

# Simpson1.pdf: integral de e^(x^2) en [0, 1] con n = 10 (dx = 0.1). El
# pizarron deja el corchete en 43.880442 y la integral en 1.4626 (truncada).
SIMPSON_13_EXP_X2 = {
    "fuente": "Simpson1.pdf",
    "fx": "exp(x^2)",
    "a": 0,
    "b": 1,
    "n": 10,
    "corchete": 43.880442,
    "integral": 1.46268140,
    "integral_pizarron": 1.4626,
}
