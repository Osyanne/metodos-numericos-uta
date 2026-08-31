"""Pruebas de Runge-Kutta escalar y para sistemas."""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.errors import ErrorCriterion
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason


@pytest.fixture
def metodo():
    """Recarga todos los modulos porque el registro se vacia entre pruebas."""
    clear()
    load_methods(force=True)
    yield get("runge-kutta")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_y_declara_todas_sus_entradas(metodo):
    assert metodo in all_methods()
    assert [campo.name for campo in metodo.inputs] == [
        "fxy", "x0", "y0", "h", "n", "xf", "orden"
    ]


@pytest.mark.parametrize(
    ("orden", "esperado"),
    [
        (2, 1.105),
        (4, 1.1051708333333334),
    ],
)
def test_una_etapa_coincide_con_los_calculos_de_heun_y_rk4(
    metodo, orden, esperado
):
    resultado = resolver(
        metodo,
        {"fxy": "y", "x0": 0.0, "y0": 1.0, "h": 0.1, "n": 1, "orden": orden},
    )

    assert resultado.result["y"] == pytest.approx(esperado, abs=1e-10)


def test_rk4_aproxima_una_solucion_analitica_conocida(metodo):
    resultado = resolver(
        metodo,
        {"fxy": "y", "x0": 0.0, "y0": 1.0, "h": 0.1, "n": 10},
    )

    assert resultado.result == {
        "x": pytest.approx(1.0),
        "y": pytest.approx(math.e, abs=3e-6),
        "h": pytest.approx(0.1),
        "n": 10,
        "orden": 4,
    }
    assert len(resultado.iterations) == 11
    assert resultado.iterations[0].values == {"x": 0.0, "y": 1.0}
    assert resultado.iterations[0].error is None
    assert resultado.iterations[1].error is not None
    assert resultado.converged is True
    assert resultado.stop_reason is StopReason.MAX_ITERATIONS


def test_resuelve_un_sistema_evaluando_las_componentes_simultaneamente(metodo):
    resultado = resolver(
        metodo,
        {
            "fxy": ["y2", "-y1"],
            "x0": 0.0,
            "y0": [1.0, 0.0],
            "h": 0.1,
            "n": 10,
            "orden": 4,
        },
    )

    assert resultado.result["x"] == pytest.approx(1.0)
    assert resultado.result["y"] == pytest.approx(
        [math.cos(1.0), -math.sin(1.0)],
        abs=1e-5,
    )
    assert [columna.key for columna in resultado.columns] == ["x", "y1", "y2"]
    assert set(resultado.iterations[-1].values) == {"x", "y1", "y2"}


@pytest.mark.parametrize(
    ("entrada", "max_iterations"),
    [
        ({"h": 0.2, "n": 5}, 99),
        ({"h": 0.2, "xf": 1.0}, 99),
        ({"n": 5, "xf": 1.0}, 99),
        ({"h": 0.2}, 5),
        ({"h": 0.2, "n": 5, "xf": 1.0}, 99),
    ],
)
def test_acepta_las_formas_del_contrato_para_h_n_y_xf(
    metodo, entrada, max_iterations
):
    resultado = resolver(
        metodo,
        {"fxy": "1", "x0": 0.0, "y0": 0.0, **entrada},
        max_iterations=max_iterations,
    )

    assert resultado.result["x"] == pytest.approx(1.0)
    assert resultado.result["y"] == pytest.approx(1.0)
    assert resultado.result["h"] == pytest.approx(0.2)
    assert resultado.result["n"] == 5


def test_rechaza_h_n_y_xf_si_los_tres_son_inconsistentes(metodo):
    with pytest.raises(MethodError, match="consistentes|inconsistente"):
        resolver(
            metodo,
            {
                "fxy": "x + y",
                "x0": 0.0,
                "y0": 1.0,
                "h": 0.1,
                "n": 5,
                "xf": 0.7,
            },
        )


@pytest.mark.parametrize(
    "malla",
    [
        {"x0": 1e308, "h": 1e308, "n": 1},
        {"x0": 0.0, "h": 1e308, "n": 2},
        {"x0": -1e308, "h": 1.0, "xf": 1e308},
        {"x0": -1e308, "n": 2, "xf": 1e308},
    ],
)
def test_rechaza_una_malla_cuyos_calculos_dejan_de_ser_finitos(metodo, malla):
    with pytest.raises(MethodError, match="finit|desborda|rango|malla"):
        resolver(
            metodo,
            {"fxy": "0", "y0": 1.0, **malla},
        )


@pytest.mark.parametrize(
    ("entrada", "mensaje"),
    [
        ({}, "h|n|xf"),
        ({"n": 5}, "h|xf"),
        ({"xf": 1.0}, "h|n"),
        ({"h": 0.0, "n": 5}, "h|cero"),
        ({"h": 0.1, "n": 0}, "n|positivo"),
        ({"h": 0.1, "n": 2.5}, "n|entero"),
        ({"h": -0.1, "xf": 1.0}, "direccion|paso"),
    ],
)
def test_rechaza_combinaciones_que_no_definen_la_malla(metodo, entrada, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(
            metodo,
            {"fxy": "x + y", "x0": 0.0, "y0": 1.0, **entrada},
        )


@pytest.mark.parametrize(
    ("entrada", "mensaje"),
    [
        (
            {"fxy": ["y2", "-y1"], "y0": [1.0]},
            "misma cantidad|dos ecuaciones",
        ),
        (
            {"fxy": ["y2", "-y1"], "y0": 1.0},
            "lista|sistema",
        ),
        (
            {"fxy": "x + y", "y0": [1.0]},
            "numero|ecuacion",
        ),
        (
            {"fxy": [], "y0": []},
            "ecuacion",
        ),
    ],
)
def test_rechaza_dimensiones_incompatibles_del_sistema(metodo, entrada, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(
            metodo,
            {"x0": 0.0, "h": 0.1, "n": 2, **entrada},
        )


@pytest.mark.parametrize("orden", [3, float("inf"), float("-inf")])
def test_rechaza_un_orden_que_no_sea_dos_o_cuatro(metodo, orden):
    with pytest.raises(MethodError, match="orden|2|4"):
        resolver(
            metodo,
            {
                "fxy": "x + y",
                "x0": 0.0,
                "y0": 1.0,
                "h": 0.1,
                "n": 2,
                "orden": orden,
            },
        )


def test_respeta_el_criterio_de_error_configurado_sin_detener_la_malla(metodo):
    resultado = resolver(
        metodo,
        {"fxy": "y", "x0": 0.0, "y0": 1.0, "h": 0.1, "n": 2},
        error_criterion=ErrorCriterion.ABSOLUTE,
        tolerance=1.0,
        stop_on_tolerance=True,
    )

    assert len(resultado.iterations) == 3
    assert resultado.iterations[1].error == pytest.approx(0.1051708333, abs=1e-10)


def test_grafica_escalar_tiene_una_componente_llamada_y(metodo):
    resultado = resolver(
        metodo,
        {"fxy": "1", "x0": 0.0, "y0": 0.0, "h": 0.25, "n": 2},
    )

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.ODE_SOLUTION
    assert resultado.plot.series["solution"]["x"] == [0.0, 0.25, 0.5]
    assert resultado.plot.series["solution"]["components"] == [
        {"name": "y", "y": [0.0, 0.25, 0.5]}
    ]
    assert resultado.plot.resample is None


def test_grafica_del_sistema_incluye_todas_las_componentes(metodo):
    resultado = resolver(
        metodo,
        {
            "fxy": ["y2", "-y1"],
            "x0": 0.0,
            "y0": [1.0, 0.0],
            "h": 0.1,
            "n": 2,
        },
    )

    solucion = resultado.plot.series["solution"]
    assert solucion["x"] == [0.0, 0.1, 0.2]
    assert [componente["name"] for componente in solucion["components"]] == [
        "y1", "y2"
    ]
    assert all(len(componente["y"]) == 3 for componente in solucion["components"])
