"""Pruebas de Simpson 3/8 compuesta.

Los valores de referencia salen de fracciones exactas y de mpmath a 40
digitos, calculados con un script aparte que no importa el nucleo. Ejemplo
a mano (el de la seccion Teoria): integral de 1/x entre 1 y 2 con n = 3, nodos
1, 4/3, 5/3, 2:

    (2 - 1)/8 * [1 + 3*(3/4) + 3*(3/5) + 1/2] = (111/20)/8 = 0.69375
"""
from __future__ import annotations

import math
from fractions import Fraction

import pytest

from core.config import SolveConfig
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason


@pytest.fixture
def metodo():
    """Recarga los modulos: el registro se vacia entre pruebas."""
    clear()
    load_methods(force=True)
    yield get("simpson-38")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_con_la_familia_y_unidad_de_simpson(metodo):
    simpson = get("simpson")
    assert metodo in all_methods()
    assert metodo.name == "Simpson 3/8"
    assert (metodo.unit, metodo.family) == (simpson.unit, simpson.family)
    assert metodo.orden == 8
    assert [campo.name for campo in metodo.inputs] == ["fx", "a", "b", "n"]


def test_caso_simple_n_3_con_fracciones_exactas(metodo):
    resultado = resolver(metodo, {"fx": "1/x", "a": 1, "b": 2, "n": 3})

    exacto = Fraction(1, 8) * (1 + 3 * Fraction(3, 4) + 3 * Fraction(3, 5) + Fraction(1, 2))
    assert exacto == Fraction(111, 160)
    assert resultado.result["corchete"] == pytest.approx(5.55, abs=1e-12)
    assert resultado.result["integral"] == pytest.approx(float(exacto), abs=1e-14)
    assert resultado.result["integral"] == pytest.approx(0.69375, abs=1e-14)
    assert resultado.result["factor"] == pytest.approx(1 / 8, abs=1e-15)
    assert resultado.result["h"] == pytest.approx(1 / 3, abs=1e-15)
    assert resultado.result["n"] == 3


@pytest.mark.parametrize(
    ("params", "corchete", "integral"),
    [
        ({"fx": "1/x", "a": 1, "b": 2, "n": 6}, 11.091125541125541, 0.6931953463203463),
        ({"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 3}, 18.32266607159368, 2.29033325894921),
        ({"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 6}, 36.64745139438979, 2.290465712149362),
        ({"fx": "sin(x)", "a": 0, "b": math.pi, "n": 6}, 10.196152422706632, 2.002009846628558),
        ({"fx": "exp(-x^2)", "a": 0, "b": 1, "n": 9}, 17.92384600781203, 0.7468269169921679),
        ({"fx": "sqrt(x)", "a": 0, "b": 4, "n": 12}, 42.514497653693056, 5.314312206711632),
        ({"fx": "exp(x)", "a": 0, "b": 1, "n": 3}, 13.748321226881341, 1.7185401533601676),
    ],
)
def test_reproduce_los_valores_de_referencia(metodo, params, corchete, integral):
    resultado = resolver(metodo, params)

    assert resultado.result["corchete"] == pytest.approx(corchete, rel=1e-13)
    assert resultado.result["integral"] == pytest.approx(integral, rel=1e-13)


@pytest.mark.parametrize(
    ("fx", "a", "b", "n", "exacto"),
    [
        ("x^3 - 2*x + 1", 0, 2, 3, 2.0),  # x^4/4 - x^2 + x
        ("4*x^3 - 3*x^2 + 2*x - 1", 0, 3, 6, 60.0),  # x^4 - x^3 + x^2 - x
        ("x^3", 0, 3, 9, 81 / 4),
        ("x^2", 0, 3, 6, 9.0),
        ("2*x + 5", -1, 2, 3, 18.0),
    ],
)
def test_es_exacta_para_polinomios_de_grado_hasta_3(metodo, fx, a, b, n, exacto):
    resultado = resolver(metodo, {"fx": fx, "a": a, "b": b, "n": n})

    assert resultado.result["integral"] == pytest.approx(exacto, abs=1e-12)


def test_no_es_exacta_para_grado_4(metodo):
    # x^4 entre 0 y 1 con n = 3: error = -(b-a)/80 * h^4 * f'''' = -(1/80)(1/81)(24),
    # y la regla sobreestima, asi que aproximacion - exacto = 24 / (80 * 81).
    resultado = resolver(metodo, {"fx": "x^4", "a": 0, "b": 1, "n": 3})

    assert resultado.result["integral"] - 0.2 == pytest.approx(24 / (80 * 81), rel=1e-9)


def test_el_error_baja_como_h_a_la_cuarta(metodo):
    def error(n):
        r = resolver(metodo, {"fx": "exp(x)", "a": 0, "b": 1, "n": n})
        return abs(r.result["integral"] - (math.e - 1))

    # Doblar n divide h entre 2 y el error entre 16.
    assert error(3) / error(6) == pytest.approx(16, rel=0.05)


def test_la_tabla_lleva_los_pesos_1_3_3_2_3_3_1(metodo):
    resultado = resolver(metodo, {"fx": "1/x", "a": 1, "b": 2, "n": 9})

    filas = resultado.iterations
    assert [fila.n for fila in filas] == list(range(10))
    assert [fila.values["peso"] for fila in filas] == [1, 3, 3, 2, 3, 3, 2, 3, 3, 1]
    assert [fila.values["xi"] for fila in filas] == pytest.approx(
        [1 + i / 9 for i in range(10)], abs=1e-12
    )
    assert filas[-1].values["xi"] == 2.0


def test_la_tabla_es_coherente_con_el_resultado(metodo):
    resultado = resolver(metodo, {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 6})

    filas = resultado.iterations
    acumulada = 0.0
    for fila in filas:
        v = fila.values
        assert v["ponderado"] == pytest.approx(v["peso"] * v["fxi"], abs=1e-15)
        acumulada += v["ponderado"]
        assert v["suma"] == pytest.approx(acumulada, abs=1e-12)
    assert filas[-1].values["suma"] == pytest.approx(resultado.result["corchete"], abs=1e-12)
    assert resultado.result["integral"] == pytest.approx(
        resultado.result["factor"] * resultado.result["corchete"], abs=1e-15
    )
    assert resultado.result["factor"] == pytest.approx(3 * resultado.result["h"] / 8, rel=1e-15)


def test_las_columnas_siguen_a_las_de_simpson(metodo):
    resultado = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 3})

    assert [c.key for c in resultado.columns] == [
        "xi", "fxi", "peso", "ponderado", "suma",
    ]
    assert resultado.stop_reason is StopReason.COMPLETED
    assert resultado.converged is True
    assert [fila.error for fila in resultado.iterations] == [None] * 4


@pytest.mark.parametrize("n", [1, 2, 4, 5, 7, 8, 10])
def test_rechaza_un_n_que_no_es_multiplo_de_3(metodo, n):
    with pytest.raises(MethodError, match="múltiplo de 3") as error:
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": n})

    assert f"n = {n}" in str(error.value)


@pytest.mark.parametrize(
    ("params", "mensaje"),
    [
        ({"fx": "x", "a": 0, "b": 0, "n": 3}, "vacio|distintos"),
        ({"fx": "x", "a": 2, "b": 1, "n": 3}, "mayor|intercambia"),
        ({"fx": "x", "a": 0, "b": 1, "n": 0}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": -3}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": 1.5}, "entero"),
        ({"fx": "", "a": 0, "b": 1, "n": 3}, "f\\(x\\)|funcion"),
        ({"a": 0, "b": 1, "n": 3}, "f\\(x\\)|funcion"),
        ({"fx": "x", "b": 1, "n": 3}, "extremo inferior|a"),
        ({"fx": "x", "a": 0, "n": 3}, "extremo superior|b"),
        ({"fx": "x", "a": 0, "b": 1}, "subintervalos|n"),
    ],
)
def test_rechaza_entradas_invalidas_con_mensaje_explicativo(metodo, params, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, params)


def test_rechaza_una_malla_desmesurada(metodo):
    with pytest.raises(MethodError, match="10000|maximo|Reduce"):
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 200001})


def test_la_malla_grande_pero_razonable_sigue_andando(metodo):
    resultado = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 9999})

    assert len(resultado.iterations) == 10000
    assert resultado.result["integral"] == pytest.approx(0.5, abs=1e-12)


def test_un_corchete_que_se_desborda_falla_con_causa(metodo):
    # Con n = 9 los pesos suman 24: 24 * 1e307 pasa el maximo de un float.
    with pytest.raises(MethodError, match="desborda"):
        resolver(metodo, {"fx": "1e307", "a": 0, "b": 1, "n": 9})


def test_una_funcion_no_evaluable_en_un_extremo_falla_con_causa(metodo):
    with pytest.raises(MethodError, match="log|no.*definid|dominio|evaluar"):
        resolver(metodo, {"fx": "log(x)", "a": 0, "b": 1, "n": 3})


# ---------------------------------------------------------------- grafica

def test_grafica_trae_una_cubica_por_tramo_de_tres_subintervalos(metodo):
    resultado = resolver(metodo, {"fx": "x^2", "a": 0, "b": 1, "n": 6})

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTEGRATION
    series = resultado.plot.series
    assert series["rectangles"] == []
    assert series["trapezoids"] == []
    assert series["parabolas"] == []
    assert series["interval"] == {"a": 0.0, "b": 1.0}
    h = 1 / 6
    nodos = [(i * h, (i * h) ** 2) for i in range(7)]
    assert len(series["cubicas"]) == 2
    for tramo, c in enumerate(series["cubicas"]):
        esperados = nodos[3 * tramo: 3 * tramo + 4]
        obtenidos = [(c[f"x{j}"], c[f"y{j}"]) for j in range(4)]
        assert obtenidos == pytest.approx(esperados, abs=1e-15)


def test_con_n_igual_a_3_la_grafica_tiene_una_sola_cubica(metodo):
    resultado = resolver(metodo, {"fx": "1/x", "a": 1, "b": 2, "n": 3})

    assert len(resultado.plot.series["cubicas"]) == 1


def test_los_otros_metodos_de_integracion_no_traen_cubicas():
    clear()
    load_methods(force=True)
    for slug in ("trapecio", "simpson", "punto-medio"):
        r = get(slug).solve({"fx": "x", "a": 0, "b": 1, "n": 6}, SolveConfig())
        assert r.plot.series["cubicas"] == []
    clear()


def test_grafica_habilita_remuestreo_sobre_el_intervalo(metodo):
    resultado = resolver(metodo, {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 6})

    assert resultado.plot.resample is not None
    assert resultado.plot.resample.domain == (0.0, math.pi)


def test_las_notas_explican_la_regla_y_el_corchete(metodo):
    resultado = resolver(metodo, {"fx": "1/x", "a": 1, "b": 2, "n": 3})

    texto = "\n".join(resultado.notes)
    assert "0.693750" in texto
    assert "3h/8" in texto
