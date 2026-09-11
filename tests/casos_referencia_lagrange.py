"""Casos de referencia de Interpolacion de Lagrange, del material del docente.

Misma funcion que `casos_referencia.py`: es el dato contra el que se mide si el
metodo esta bien, no un archivo de pruebas. Si el aplicativo no reproduce estos
numeros, esta mal aunque el algoritmo parezca correcto.

Vive aparte del otro archivo porque los casos de Newton y los de Lagrange se
escribieron en paralelo. Juntarlos es una limpieza razonable mas adelante.

Los puntos se guardan **en el orden en que los escribe el docente**. Para
Lagrange el orden no cambia el polinomio, pero si cambia el orden de las filas
de la tabla, que es lo que se compara contra el pizarron.
"""
from __future__ import annotations

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
