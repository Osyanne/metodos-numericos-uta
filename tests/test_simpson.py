"""Pruebas del Metodo de Simpson.

Los casos de referencia vienen de ``Método de Simpson.pdf``: integra
sqrt(5 + x^3) entre 0 y 1. Con n = 2 (una parabola) el material escribe la
suma 13.74094286 y la divide entre 6; con n = 4 (cuatro subintervalos de ancho
0.25, cada uno con su punto medio) escribe 54.97136101 y 2.290473375.
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason

DOCENTE = {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1}


@pytest.fixture
def metodo():
    """Recarga los modulos: el registro se vacia entre pruebas."""
    clear()
    load_methods(force=True)
    yield get("simpson")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_u1_con_todas_sus_entradas(metodo):
    assert metodo in all_methods()
    assert metodo.unit == "U1"
    assert metodo.family == "integracion"
    assert [campo.name for campo in metodo.inputs] == ["fx", "a", "b", "n"]


def test_reproduce_el_caso_n_mayor_que_2_del_docente(metodo):
    resultado = resolver(metodo, {**DOCENTE, "n": 4})

    # Valores escritos en el material, no obtenidos de la app.
    assert round(resultado.result["corchete"], 8) == 54.97136101
    assert round(resultado.result["integral"], 9) == 2.290473375
    assert resultado.result["h"] == pytest.approx(0.25, abs=1e-12)
    assert resultado.result["factor"] == pytest.approx(1 / 24, abs=1e-15)
    assert resultado.result["n"] == 4


def test_las_filas_siguen_el_corchete_con_los_puntos_medios(metodo):
    resultado = resolver(metodo, {**DOCENTE, "n": 4})

    # x0 = 0, x1 = 0.25, ... y los puntos medios 0.125, 0.375, 0.625, 0.875
    # del material, intercalados en el orden en que se leen.
    filas = resultado.iterations
    assert [fila.n for fila in filas] == list(range(9))
    assert [fila.values["punto"] for fila in filas] == [
        "x0", "m1", "x1", "m2", "x2", "m3", "x3", "m4", "x4",
    ]
    assert [fila.values["xi"] for fila in filas] == pytest.approx(
        [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], abs=1e-12
    )
    assert [fila.values["peso"] for fila in filas] == [1, 4, 2, 4, 2, 4, 2, 4, 1]
    assert filas[0].values["fxi"] == pytest.approx(math.sqrt(5))
    assert filas[-1].values["fxi"] == pytest.approx(math.sqrt(6))
    assert filas[-1].values["suma"] == pytest.approx(
        resultado.result["corchete"], abs=1e-12
    )


def test_reproduce_el_caso_n_igual_a_2_del_docente(metodo):
    resultado = resolver(metodo, {**DOCENTE, "n": 2})

    assert round(resultado.result["corchete"], 8) == 13.74094286
    assert round(resultado.result["integral"], 8) == 2.29015714
    assert [fila.values["xi"] for fila in resultado.iterations] == [0, 0.5, 1]
    assert [fila.values["peso"] for fila in resultado.iterations] == [1, 4, 1]
    assert resultado.result["factor"] == pytest.approx(1 / 6, abs=1e-15)


def test_es_exacto_para_una_cubica_con_una_sola_parabola(metodo):
    resultado = resolver(metodo, {"fx": "x^3 - 2*x + 1", "a": 0, "b": 2, "n": 2})

    # Primitiva x^4/4 - x^2 + x: 4 - 4 + 2 = 2.
    assert resultado.result["integral"] == pytest.approx(2.0, abs=1e-12)


def test_coincide_con_trapecio_y_punto_medio_combinados(metodo):
    """Con los mismos subintervalos, Simpson es (Trapecio + 2 Punto Medio) / 3.

    Corre los otros dos metodos del aplicativo: si las tres reglas no cumplen
    esta identidad, una de ellas esta mal.
    """
    params = {"fx": "1/x", "a": 1, "b": 2, "n": 4}
    trapecio = resolver(get("trapecio"), params).result["integral"]
    punto_medio = resolver(get("punto-medio"), params).result["integral"]

    simpson = resolver(metodo, params).result["integral"]

    assert simpson == pytest.approx((trapecio + 2 * punto_medio) / 3, abs=1e-12)


def test_con_n_igual_a_2_combina_un_solo_trapecio_y_un_solo_rectangulo(metodo):
    params = {"fx": "exp(-x^2)", "a": 0, "b": 1}
    trapecio = resolver(get("trapecio"), {**params, "n": 1}).result["integral"]
    punto_medio = resolver(get("punto-medio"), {**params, "n": 1}).result["integral"]

    simpson = resolver(metodo, {**params, "n": 2}).result["integral"]

    assert simpson == pytest.approx((trapecio + 2 * punto_medio) / 3, abs=1e-12)


def test_la_integracion_termina_como_completada_y_sin_error_por_fila(metodo):
    resultado = resolver(metodo, {"fx": "x^2", "a": 0, "b": 1, "n": 4})

    assert resultado.stop_reason is StopReason.COMPLETED
    assert resultado.converged is True
    assert [fila.error for fila in resultado.iterations] == [None] * 9


@pytest.mark.parametrize("n", [1, 3, 5, 7])
def test_rechaza_un_n_impar(metodo, n):
    with pytest.raises(MethodError, match="impar"):
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": n})


@pytest.mark.parametrize(
    ("params", "mensaje"),
    [
        ({"fx": "x", "a": 0, "b": 0, "n": 4}, "vacio|distintos"),
        ({"fx": "x", "a": 2, "b": 1, "n": 4}, "mayor|intercambia"),
        ({"fx": "x", "a": 0, "b": 1, "n": 0}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": -2}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": 2.5}, "entero"),
        ({"fx": "", "a": 0, "b": 1, "n": 4}, "f\\(x\\)|funcion"),
        ({"a": 0, "b": 1, "n": 4}, "f\\(x\\)|funcion"),
        ({"fx": "x", "b": 1, "n": 4}, "extremo inferior|a"),
        ({"fx": "x", "a": 0, "n": 4}, "extremo superior|b"),
        ({"fx": "x", "a": 0, "b": 1}, "subintervalos|n"),
    ],
)
def test_rechaza_entradas_invalidas_con_mensaje_explicativo(
    metodo, params, mensaje
):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, params)


def test_rechaza_una_malla_desmesurada(metodo):
    with pytest.raises(MethodError, match="10000|maximo|Reduce"):
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 200000})


def test_la_malla_grande_pero_razonable_sigue_andando(metodo):
    resultado = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 10000})

    # n subintervalos: n + 1 extremos y n puntos medios.
    assert len(resultado.iterations) == 20001
    assert resultado.result["integral"] == pytest.approx(0.5, abs=1e-12)


def test_grafica_muestra_una_parabola_por_subintervalo(metodo):
    resultado = resolver(metodo, {"fx": "x^2", "a": 0, "b": 1, "n": 4})

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTEGRATION
    series = resultado.plot.series
    assert series["rectangles"] == []
    assert series["trapezoids"] == []
    assert series["interval"] == {"a": 0.0, "b": 1.0}
    assert series["parabolas"] == [
        {"x0": 0.0, "y0": 0.0, "xm": 0.125, "ym": 0.015625, "x1": 0.25, "y1": 0.0625},
        {"x0": 0.25, "y0": 0.0625, "xm": 0.375, "ym": 0.140625, "x1": 0.5, "y1": 0.25},
        {"x0": 0.5, "y0": 0.25, "xm": 0.625, "ym": 0.390625, "x1": 0.75, "y1": 0.5625},
        {"x0": 0.75, "y0": 0.5625, "xm": 0.875, "ym": 0.765625, "x1": 1.0, "y1": 1.0},
    ]


def test_con_n_igual_a_2_la_grafica_tiene_una_sola_parabola(metodo):
    resultado = resolver(metodo, {**DOCENTE, "n": 2})

    assert len(resultado.plot.series["parabolas"]) == 1


def test_grafica_habilita_remuestreo_sobre_el_intervalo(metodo):
    resultado = resolver(metodo, {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 6})

    assert resultado.plot.resample is not None
    assert resultado.plot.resample.domain == (0.0, math.pi)


def test_un_corchete_que_se_desborda_falla_con_causa(metodo):
    # 1e307 * (1 + 4 + 2 + 4 + 2 + 4 + 2 + 4 + 1) pasa el maximo de un float.
    with pytest.raises(MethodError, match="desborda"):
        resolver(metodo, {"fx": "1e307", "a": 0, "b": 1, "n": 4})


def test_una_funcion_no_evaluable_en_un_extremo_falla_con_causa(metodo):
    with pytest.raises(MethodError, match="log|no.*definid|dominio|evaluar"):
        resolver(metodo, {"fx": "log(x)", "a": 0, "b": 1, "n": 4})
