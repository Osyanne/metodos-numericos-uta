"""Pruebas de la Regla compuesta del Trapecio.

El caso de referencia viene de ``Métodos de Integración Numérica.MÉTODO DEL
TRAPECIO.pdf``: integra exp(x^4) entre -1 y 1 con cinco subintervalos. La
diapositiva muestra h = 0.4 y la aproximacion 2.79929211.
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason


@pytest.fixture
def metodo():
    """Recarga los modulos: el registro se vacia entre pruebas."""
    clear()
    load_methods(force=True)
    yield get("trapecio")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_u1_con_todas_sus_entradas(metodo):
    assert metodo in all_methods()
    assert metodo.unit == "U1"
    assert [campo.name for campo in metodo.inputs] == ["fx", "a", "b", "n"]


def test_reproduce_el_ejemplo_del_docente_con_cinco_trapecios(metodo):
    resultado = resolver(
        metodo,
        {"fx": "exp(x^4)", "a": -1, "b": 1, "n": 5},
    )

    # Resultado escrito en la diapositiva del docente, no obtenido de la app.
    assert round(resultado.result["integral"], 8) == 2.79929211
    assert resultado.result["delta_x"] == pytest.approx(0.4, abs=1e-12)
    assert resultado.result["a"] == -1.0
    assert resultado.result["b"] == 1.0
    assert resultado.result["n"] == 5


def test_las_filas_siguen_los_puntos_y_pesos_de_la_formula(metodo):
    resultado = resolver(
        metodo,
        {"fx": "exp(x^4)", "a": -1, "b": 1, "n": 5},
    )

    # x_0 ... x_5 tal como se muestran en las diapositivas.
    assert [fila.n for fila in resultado.iterations] == list(range(6))
    assert [fila.values["xi"] for fila in resultado.iterations] == pytest.approx(
        [-1, -0.6, -0.2, 0.2, 0.6, 1], abs=1e-12
    )
    assert [fila.values["peso"] for fila in resultado.iterations] == [
        1.0,
        2.0,
        2.0,
        2.0,
        2.0,
        1.0,
    ]
    assert resultado.iterations[0].values["fxi"] == pytest.approx(math.e)
    assert resultado.iterations[-1].values["fxi"] == pytest.approx(math.e)
    assert resultado.iterations[-1].values["suma"] == pytest.approx(
        resultado.result["integral"], abs=1e-12
    )


def test_un_solo_trapecio_aplica_la_formula_simple_del_material(metodo):
    resultado = resolver(
        metodo,
        {"fx": "exp(x^4)", "a": -1, "b": 1, "n": 1},
    )

    # (b - a) * (f(a) + f(b)) / 2 = 2e.
    assert resultado.result["integral"] == pytest.approx(2 * math.e, abs=1e-12)
    assert [fila.values["peso"] for fila in resultado.iterations] == [1.0, 1.0]


def test_la_regla_es_exacta_para_una_funcion_lineal(metodo):
    resultado = resolver(
        metodo,
        {"fx": "3*x - 2", "a": -1, "b": 2, "n": 7},
    )

    # Integral de 3x - 2 entre -1 y 2: [1.5 x^2 - 2x] = -1.5.
    assert resultado.result["integral"] == pytest.approx(-1.5, abs=1e-12)


def test_una_constante_da_el_area_del_rectangulo(metodo):
    resultado = resolver(
        metodo,
        {"fx": "3", "a": 1, "b": 5, "n": 8},
    )

    assert resultado.result["integral"] == pytest.approx(12.0, abs=1e-12)


def test_la_integracion_termina_como_completada_y_sin_error_por_fila(metodo):
    resultado = resolver(
        metodo,
        {"fx": "x^2", "a": 0, "b": 1, "n": 4},
    )

    assert resultado.stop_reason is StopReason.COMPLETED
    assert resultado.converged is True
    assert [fila.error for fila in resultado.iterations] == [None] * 5


@pytest.mark.parametrize(
    ("params", "mensaje"),
    [
        ({"fx": "x", "a": 0, "b": 0, "n": 5}, "vacio|distintos"),
        ({"fx": "x", "a": 2, "b": 1, "n": 5}, "mayor|intercambia"),
        ({"fx": "x", "a": 0, "b": 1, "n": 0}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": -3}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": 2.5}, "entero"),
        ({"fx": "", "a": 0, "b": 1, "n": 5}, "f\\(x\\)|funcion"),
        ({"a": 0, "b": 1, "n": 5}, "f\\(x\\)|funcion"),
        ({"fx": "x", "b": 1, "n": 5}, "extremo inferior|a"),
        ({"fx": "x", "a": 0, "n": 5}, "extremo superior|b"),
        ({"fx": "x", "a": 0, "b": 1}, "subintervalos|n"),
    ],
)
def test_rechaza_entradas_invalidas_con_mensaje_explicativo(
    metodo, params, mensaje
):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, params)


def test_rechaza_una_malla_desmesurada(metodo):
    with pytest.raises(MethodError, match="10000|10.000|maximo|reduce"):
        resolver(
            metodo,
            {"fx": "x", "a": 0, "b": 1, "n": 200000},
        )


def test_la_malla_grande_pero_razonable_sigue_andando(metodo):
    resultado = resolver(
        metodo,
        {"fx": "x", "a": 0, "b": 1, "n": 10000},
    )

    # n subintervalos requieren n + 1 puntos de particion.
    assert len(resultado.iterations) == 10001
    assert resultado.result["integral"] == pytest.approx(0.5, abs=1e-12)


def test_grafica_muestra_trapecios_y_la_curva(metodo):
    resultado = resolver(
        metodo,
        {"fx": "x^2", "a": 0, "b": 1, "n": 4},
    )

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTEGRATION
    series = resultado.plot.series
    assert set(series) == {"curve", "rectangles", "trapezoids", "interval", "integral"}
    assert series["rectangles"] == []
    assert series["interval"] == {"a": 0.0, "b": 1.0}
    assert series["trapezoids"] == [
        {"x0": 0.0, "y0": 0.0, "x1": 0.25, "y1": 0.0625},
        {"x0": 0.25, "y0": 0.0625, "x1": 0.5, "y1": 0.25},
        {"x0": 0.5, "y0": 0.25, "x1": 0.75, "y1": 0.5625},
        {"x0": 0.75, "y0": 0.5625, "x1": 1.0, "y1": 1.0},
    ]


def test_grafica_habilita_remuestreo_sobre_el_intervalo(metodo):
    resultado = resolver(
        metodo,
        {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 6},
    )

    assert resultado.plot.resample is not None
    assert resultado.plot.resample.domain == (0.0, math.pi)


def test_una_funcion_no_evaluable_en_un_extremo_falla_con_causa(metodo):
    with pytest.raises(MethodError, match="log|no.*definid|dominio|evaluar"):
        resolver(
            metodo,
            {"fx": "log(x)", "a": 0, "b": 1, "n": 4},
        )
