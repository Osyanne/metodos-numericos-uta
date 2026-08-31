"""Pruebas de Interpolacion de Newton contra el contrato congelado."""
from __future__ import annotations

import math

import pytest
import sympy

from core.config import SolveConfig
from core.expression import parse
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason


@pytest.fixture
def metodo():
    """Recarga el registro porque cada prueba debe ser independiente."""
    clear()
    load_methods(force=True)
    yield get("interpolacion-newton")
    clear()


def resolver(metodo, **params):
    return metodo.solve(params, SolveConfig(decimals=8))


def test_registra_el_metodo_con_sus_tres_entradas(metodo):
    assert metodo in all_methods()
    assert [campo.name for campo in metodo.inputs] == ["points", "x", "variante"]


def test_caso_resuelto_a_mano_devuelve_polinomio_expandido(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]],
        x=3.0,
        variante="auto",
    )

    expresion = sympy.sympify(resultado.result["polinomio"])
    assert expresion == sympy.expand(expresion)
    assert sympy.Poly(expresion, sympy.Symbol("x")) == sympy.Poly(
        sympy.Symbol("x") ** 2 + 1,
        sympy.Symbol("x"),
    )
    assert resultado.result == {
        "polinomio": resultado.result["polinomio"],
        "valor": pytest.approx(10.0),
        "grado": 2,
        "variante_usada": "adelante",
    }
    assert resultado.converged is True
    assert resultado.stop_reason is StopReason.EXACT


def test_polinomio_devuelto_pasa_por_todos_los_puntos(metodo):
    puntos = [[-1.0, 4.0], [0.5, 0.25], [3.0, 7.0], [4.5, 20.5]]
    resultado = resolver(
        metodo,
        points=puntos,
        x=2.0,
        variante="divididas",
    )
    polinomio = parse(resultado.result["polinomio"])

    for xi, yi in puntos:
        assert polinomio.evaluar(x=xi) == pytest.approx(yi, abs=1e-10)


def test_las_cuatro_variantes_dan_el_mismo_polinomio(metodo):
    params = {
        "points": [[-2.0, 7.0], [-1.0, 2.0], [0.0, 1.0], [1.0, 4.0]],
        "x": 0.25,
    }

    resultados = {
        variante: resolver(metodo, **params, variante=variante)
        for variante in ("auto", "divididas", "adelante", "atras")
    }

    assert len({r.result["polinomio"] for r in resultados.values()}) == 1
    assert resultados["auto"].result["variante_usada"] == "adelante"
    assert resultados["divididas"].result["variante_usada"] == "divididas"
    assert resultados["adelante"].result["variante_usada"] == "adelante"
    assert resultados["atras"].result["variante_usada"] == "atras"


def test_cada_familia_muestra_su_tabla_y_conserva_el_orden(metodo):
    puntos = [[2.0, 5.0], [1.0, 2.0], [0.0, 1.0]]

    divididas = resolver(
        metodo, points=puntos, x=1.5, variante="divididas"
    )
    adelante = resolver(metodo, points=puntos, x=1.5, variante="adelante")
    atras = resolver(metodo, points=puntos, x=1.5, variante="atras")

    assert [fila.values["x"] for fila in divididas.iterations] == [2.0, 1.0, 0.0]
    assert [columna.key for columna in divididas.columns] == ["x", "y", "dd1", "dd2"]
    assert [columna.key for columna in adelante.columns] == [
        "x", "y", "delta1", "delta2"
    ]
    assert [columna.key for columna in atras.columns] == [
        "x", "y", "nabla1", "nabla2"
    ]
    assert divididas.iterations[0].values == {
        "x": 2.0, "y": 5.0, "dd1": 3.0, "dd2": 1.0
    }
    assert divididas.iterations[1].values == {"x": 1.0, "y": 2.0, "dd1": 1.0}
    assert adelante.iterations[0].values == {
        "x": 2.0, "y": 5.0, "delta1": -3.0, "delta2": 2.0
    }
    assert atras.iterations[2].values == {
        "x": 0.0, "y": 1.0, "nabla1": -1.0, "nabla2": 2.0
    }
    assert all(fila.error is None for fila in divididas.iterations)


def test_auto_usa_divididas_si_el_paso_no_es_constante(metodo):
    resultado = resolver(
        metodo,
        points=[[1.0, 0.0], [4.0, math.log(4.0)], [6.0, math.log(6.0)]],
        x=2.0,
        variante="auto",
    )

    assert resultado.result["variante_usada"] == "divididas"
    assert resultado.result["valor"] == pytest.approx(0.56584435, abs=1e-8)


@pytest.mark.parametrize("variante", ["adelante", "atras"])
def test_diferencias_finitas_requieren_paso_constante(metodo, variante):
    with pytest.raises(MethodError, match="paso constante|equiespaciados"):
        resolver(
            metodo,
            points=[[0.0, 1.0], [1.0, 2.0], [3.0, 10.0]],
            x=2.0,
            variante=variante,
        )


@pytest.mark.parametrize(
    ("points", "mensaje"),
    [
        ([[0.0, 1.0]], "dos puntos"),
        ([[0.0, 1.0], [0.0, 2.0]], "repetida|distintas"),
        ([[0.0, 1.0], [1.0, float("inf")]], "finito"),
    ],
)
def test_rechaza_tablas_que_no_definen_un_polinomio(metodo, points, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, points=points, x=0.5, variante="divididas")


def test_rechaza_una_variante_desconocida(metodo):
    with pytest.raises(MethodError, match="variante"):
        resolver(
            metodo,
            points=[[0.0, 1.0], [1.0, 2.0]],
            x=0.5,
            variante="central",
        )


def test_polinomio_cero_es_un_interpolante_valido_de_grado_cero(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 0.0], [1.0, 0.0]],
        x=0.25,
        variante="auto",
    )

    assert resultado.result["polinomio"] == "0"
    assert resultado.result["grado"] == 0
    assert resultado.result["valor"] == 0.0


def test_no_descarta_un_coeficiente_pequeno_que_cambia_los_datos(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 0.0], [1.0, 1e-15]],
        x=1.0,
        variante="auto",
    )
    polinomio = parse(resultado.result["polinomio"])

    assert resultado.result["grado"] == 1
    assert polinomio.evaluar(x=1.0) == pytest.approx(1e-15, abs=1e-25)


@pytest.mark.parametrize(
    "params",
    [
        {"points": [[False, 0.0], [1.0, 1.0]], "x": 0.5},
        {"points": [[0.0, 0.0], [1.0, 1.0]], "x": True},
        {"points": [[0.0, 0.0], [1.0, 1.0]], "x": float("inf")},
    ],
)
def test_rechaza_booleanos_y_x_no_finito(metodo, params):
    with pytest.raises(MethodError, match="numero|finito"):
        resolver(metodo, **params, variante="auto")


def test_grafica_incluye_curva_punto_evaluado_y_remuestreo(metodo):
    resultado = resolver(
        metodo,
        points=[[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]],
        x=1.5,
        variante="auto",
    )

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTERPOLATION
    assert set(resultado.plot.series) == {"points", "curve", "evaluated"}
    assert resultado.plot.series["points"] == [[0.0, 1.0], [1.0, 2.0], [2.0, 5.0]]
    assert resultado.plot.series["evaluated"] == {
        "x": 1.5,
        "y": pytest.approx(3.25),
    }
    assert len(resultado.plot.series["curve"]["x"]) == 201
    assert resultado.plot.resample is not None
    assert resultado.plot.resample.expression == resultado.result["polinomio"]
    assert resultado.plot.resample.domain == (0.0, 2.0)
