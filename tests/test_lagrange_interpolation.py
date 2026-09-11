"""Pruebas de Interpolacion de Lagrange contra el material del docente."""
from __future__ import annotations

import pytest
import sympy

from core.config import SolveConfig
from core.expression import parse
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason
from tests.casos_referencia_lagrange import (
    LAGRANGE_EJERCICIO,
    LAGRANGE_RESUELTO,
    LAGRANGE_RESUELTO_2,
)


@pytest.fixture
def metodo():
    """Recarga el registro porque cada prueba debe ser independiente."""
    clear()
    load_methods(force=True)
    yield get("interpolacion-lagrange")
    clear()


def resolver(metodo, puntos, x, decimals=8):
    return metodo.solve(
        {"points": [list(p) for p in puntos], "x": x},
        SolveConfig(decimals=decimals),
    )


def assert_polinomio(resultado, coeficientes) -> None:
    """Compara el polinomio con sus coeficientes, de mayor a menor grado.

    Por valor y no por tipo: sympy distingue Poly(x**2, domain='ZZ') de
    Poly(1.0*x**2, domain='RR'), y esa diferencia no le importa a nadie aca.
    """
    x = sympy.Symbol("x")
    grado = len(coeficientes) - 1
    esperado = sum(c * x ** (grado - i) for i, c in enumerate(coeficientes))
    obtenido = sympy.sympify(resultado.result["polinomio"])

    assert sympy.expand(obtenido - esperado) == 0, (
        f"{resultado.result['polinomio']} != {esperado}"
    )


# ---------- contrato ----------

def test_queda_registrado_sin_registrarlo_a_mano(metodo):
    assert metodo in all_methods()
    assert metodo.slug == "interpolacion-lagrange"
    assert metodo.unit == "U2"
    assert metodo.family == "interpolacion"


def test_pide_solo_los_puntos_y_la_x(metodo):
    """Lagrange no tiene variantes: una tabla y un punto es todo lo que necesita."""
    assert [campo.name for campo in metodo.inputs] == ["points", "x"]


# ---------- los ejercicios del docente ----------

def test_ejercicio_resuelto_reproduce_el_polinomio_de_la_diapositiva(metodo):
    caso = LAGRANGE_RESUELTO
    resultado = resolver(metodo, caso["puntos"], x=1.0)

    assert_polinomio(resultado, caso["coeficientes"])
    assert resultado.result["grado"] == caso["grado"]
    assert resultado.converged is True
    assert resultado.stop_reason is StopReason.EXACT


def test_ejercicio_resuelto_reproduce_cada_polinomio_base(metodo):
    """Los L_i son lo que el docente corrige paso a paso, no solo la suma.

    Un error de signo en un L_i se puede cancelar en el polinomio final si
    justo ese y_i vale cero, y en este ejercicio y_2 = 0. Comparar solo el
    resultado dejaria pasar un L_2 equivocado.
    """
    caso = LAGRANGE_RESUELTO
    resultado = resolver(metodo, caso["puntos"], x=1.0)

    x = sympy.Symbol("x")
    obtenidos = [fila.values["Li"] for fila in resultado.iterations]
    for obtenido, esperado_texto in zip(
        obtenidos, caso["bases_expandidas"], strict=True
    ):
        assert sympy.simplify(
            sympy.sympify(obtenido) - sympy.sympify(esperado_texto)
        ) == 0, f"{obtenido} != {esperado_texto}"

    # Y la propiedad que los define: L_i vale 1 en x_i y 0 en los demas.
    for i, (xi, _) in enumerate(caso["puntos"]):
        base = sympy.sympify(obtenidos[i])
        for j, (xj, _) in enumerate(caso["puntos"]):
            assert float(base.subs(x, xj)) == pytest.approx(1.0 if i == j else 0.0, abs=1e-12)


def test_ejercicio_resuelto_reproduce_la_tabla_de_la_grafica(metodo):
    caso = LAGRANGE_RESUELTO
    for x_consulta, esperado_valor in caso["tabla_grafica"].items():
        resultado = resolver(metodo, caso["puntos"], x=x_consulta)
        assert resultado.result["valor"] == pytest.approx(esperado_valor), x_consulta


def test_segundo_ejercicio_resuelto(metodo):
    caso = LAGRANGE_RESUELTO_2
    resultado = resolver(metodo, caso["puntos"], x=2.0)

    assert_polinomio(resultado, caso["coeficientes"])
    for obtenido, esperado_texto in zip(
        [fila.values["Li"] for fila in resultado.iterations],
        caso["bases_expandidas"],
        strict=True,
    ):
        assert sympy.simplify(
            sympy.sympify(obtenido) - sympy.sympify(esperado_texto)
        ) == 0


def test_ejercicio_propuesto_interpola_en_el_punto_pedido(metodo):
    caso = LAGRANGE_EJERCICIO
    resultado = resolver(metodo, caso["puntos"], x=caso["x"])

    assert_polinomio(resultado, caso["coeficientes"])
    assert resultado.result["valor"] == pytest.approx(caso["valor"])


# ---------- la tabla del procedimiento ----------

def test_la_tabla_muestra_el_procedimiento_de_cinco_pasos(metodo):
    caso = LAGRANGE_RESUELTO
    resultado = resolver(metodo, caso["puntos"], x=1.0)

    assert [c.key for c in resultado.columns] == [
        "xi", "yi", "numerador", "denominador", "Li", "termino", "Li_evaluado",
    ]
    assert [c.numeric for c in resultado.columns] == [
        True, True, False, False, False, False, True,
    ]
    assert len(resultado.iterations) == len(caso["puntos"])
    assert all(fila.error is None for fila in resultado.iterations)


def test_el_numerador_y_el_denominador_saltan_el_termino_i(metodo):
    """Es la regla que define a Lagrange y la que mas se equivoca a mano."""
    resultado = resolver(metodo, LAGRANGE_RESUELTO["puntos"], x=1.0)

    fila = resultado.iterations[0]
    assert fila.values["numerador"] == "(x - 1)*(x - 2)"
    assert fila.values["denominador"] == "(0 - 1)*(0 - 2)"

    fila = resultado.iterations[1]
    assert fila.values["numerador"] == "(x - 0)*(x - 2)"
    assert fila.values["denominador"] == "(1 - 0)*(1 - 2)"


def test_los_signos_se_resuelven_con_abscisas_negativas(metodo):
    """Con x_j negativo el binomio se escribe (x + 4), no (x - -4)."""
    resultado = resolver(metodo, LAGRANGE_EJERCICIO["puntos"], x=-3.0)

    fila = resultado.iterations[0]
    assert fila.values["numerador"] == "(x + 4)*(x + 7)"
    assert fila.values["denominador"] == "(1 + 4)*(1 + 7)"


def test_la_columna_evaluada_es_el_L_i_en_la_x_pedida(metodo):
    resultado = resolver(metodo, LAGRANGE_RESUELTO["puntos"], x=1.0)

    # x = 1 es x_1, asi que L_1 vale 1 y los otros 0.
    evaluados = [fila.values["Li_evaluado"] for fila in resultado.iterations]
    assert evaluados == pytest.approx([0.0, 1.0, 0.0])


def test_los_terminos_suman_el_polinomio(metodo):
    resultado = resolver(metodo, LAGRANGE_RESUELTO_2["puntos"], x=2.0)

    suma = sum(
        sympy.sympify(fila.values["termino"]) for fila in resultado.iterations
    )
    assert sympy.simplify(
        suma - sympy.sympify(resultado.result["polinomio"])
    ) == 0


# ---------- propiedades ----------

def test_el_polinomio_pasa_por_todos_los_puntos(metodo):
    puntos = [(-1.0, 4.0), (0.5, 0.25), (3.0, 7.0), (4.5, 20.5)]
    resultado = resolver(metodo, puntos, x=2.0)
    polinomio = parse(resultado.result["polinomio"])

    for xi, yi in puntos:
        assert polinomio.evaluar(x=xi) == pytest.approx(yi, abs=1e-10)


def test_coincide_con_la_interpolacion_de_newton(metodo):
    """El polinomio interpolante es unico: dos metodos, un solo resultado.

    Si difieren, uno de los dos esta mal, y esta prueba no dice cual. Dice que
    hay que mirar.
    """
    puntos = [(-2.0, 7.0), (-1.0, 2.0), (0.0, 1.0), (1.0, 4.0)]
    lagrange = resolver(metodo, puntos, x=0.25)
    newton = get("interpolacion-newton").solve(
        {"points": [list(p) for p in puntos], "x": 0.25, "variante": "divididas"},
        SolveConfig(decimals=8),
    )

    assert sympy.simplify(
        sympy.sympify(lagrange.result["polinomio"])
        - sympy.sympify(newton.result["polinomio"])
    ) == 0
    assert lagrange.result["valor"] == pytest.approx(newton.result["valor"])


def test_dos_puntos_dan_una_recta(metodo):
    resultado = resolver(metodo, [(0.0, 1.0), (2.0, 5.0)], x=1.0)

    assert resultado.result["grado"] == 1
    assert resultado.result["valor"] == pytest.approx(3.0)


def test_polinomio_cero_es_un_interpolante_valido_de_grado_cero(metodo):
    resultado = resolver(metodo, [(0.0, 0.0), (1.0, 0.0)], x=0.25)

    assert resultado.result["polinomio"] == "0"
    assert resultado.result["grado"] == 0
    assert resultado.result["valor"] == 0.0


def test_no_descarta_un_coeficiente_pequeno_que_cambia_los_datos(metodo):
    resultado = resolver(metodo, [(0.0, 0.0), (1.0, 1e-15)], x=1.0)
    polinomio = parse(resultado.result["polinomio"])

    assert resultado.result["grado"] == 1
    assert polinomio.evaluar(x=1.0) == pytest.approx(1e-15, abs=1e-25)


def test_los_decimales_no_cambian_lo_que_se_calcula(metodo):
    puntos = LAGRANGE_RESUELTO["puntos"]

    pocos = resolver(metodo, puntos, x=1.5, decimals=2)
    muchos = resolver(metodo, puntos, x=1.5, decimals=10)

    assert pocos.result == muchos.result
    assert [f.values for f in pocos.iterations] == [f.values for f in muchos.iterations]


# ---------- entradas invalidas ----------

@pytest.mark.parametrize(
    ("puntos", "mensaje"),
    [
        ([(0.0, 1.0)], "dos puntos"),
        ([(0.0, 1.0), (0.0, 2.0)], "repetida|distintas"),
        ([(0.0, 1.0), (1.0, float("inf"))], "finito"),
    ],
)
def test_rechaza_tablas_que_no_definen_un_polinomio(metodo, puntos, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, puntos, x=0.5)


@pytest.mark.parametrize(
    ("puntos", "x"),
    [
        ([(False, 0.0), (1.0, 1.0)], 0.5),
        ([(0.0, 0.0), (1.0, 1.0)], True),
        ([(0.0, 0.0), (1.0, 1.0)], float("inf")),
    ],
)
def test_rechaza_booleanos_y_x_no_finito(metodo, puntos, x):
    with pytest.raises(MethodError, match="numero|finito"):
        resolver(metodo, puntos, x=x)


# ---------- grafica ----------

def test_grafica_incluye_curva_punto_evaluado_y_remuestreo(metodo):
    caso = LAGRANGE_RESUELTO
    resultado = resolver(metodo, caso["puntos"], x=1.5)

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTERPOLATION
    assert set(resultado.plot.series) == {"points", "curve", "evaluated"}
    assert resultado.plot.series["points"] == [[0.0, 1.0], [1.0, 3.0], [2.0, 0.0]]
    assert len(resultado.plot.series["curve"]["x"]) == 201
    assert resultado.plot.resample is not None
    assert resultado.plot.resample.expression == resultado.result["polinomio"]
    assert resultado.plot.resample.domain == (0.0, 2.0)
