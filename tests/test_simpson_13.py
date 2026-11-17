"""Pruebas de Simpson 1/3 (Simpson1.pdf y la seccion 1/3 de "Simpson 1/3 y 3/8").

Los valores de referencia salen de fracciones exactas y de mpmath a 40
digitos, calculados con un script aparte que no importa el nucleo.

El ejercicio del docente (Simpson1.pdf): integral de e^(x^2) entre 0 y 1 con
n = 10, dx = 0.1. En el pizarron el corchete da 43.880442 y el resultado
1.4626; el corchete exacto es 43.880442003... y 0.1/3 de eso, 1.46268140...,
que el pizarron deja en 1.4626 (truncado, no redondeado).
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason
from tests.casos_referencia import SIMPSON_13_EXP_X2 as EXP_X2


@pytest.fixture
def metodo():
    """Recarga los modulos: el registro se vacia entre pruebas."""
    clear()
    load_methods(force=True)
    yield get("simpson-13")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_en_la_familia_de_integracion(metodo):
    simpson = get("simpson")
    assert metodo in all_methods()
    assert metodo.slug == "simpson-13"
    assert metodo.name == "Simpson 1/3"
    assert (metodo.unit, metodo.family) == (simpson.unit, simpson.family)
    assert metodo.orden == 8
    assert [campo.name for campo in metodo.inputs] == ["fx", "a", "b", "n"]


def test_ejercicio_del_docente_exp_x_cuadrado_con_n_10(metodo):
    r = resolver(metodo, {k: EXP_X2[k] for k in ("fx", "a", "b", "n")})

    # Lo que se lee en el pizarron: dx = 0.1, corchete 43.880442, resultado 1.4626.
    assert r.result["delta_x"] == pytest.approx(0.1, abs=1e-15)
    assert r.result["corchete"] == pytest.approx(EXP_X2["corchete"], abs=5e-7)
    assert r.result["integral"] == pytest.approx(EXP_X2["integral_pizarron"], abs=1e-4)
    assert math.floor(r.result["integral"] * 1e4) / 1e4 == 1.4626  # truncado
    # Con todos los digitos.
    assert r.result["corchete"] == pytest.approx(43.88044200299391, rel=1e-13)
    assert r.result["integral"] == pytest.approx(EXP_X2["integral"], abs=1e-8)
    assert r.result["integral"] == pytest.approx(1.4626814000997969, rel=1e-13)
    assert r.result["factor"] == pytest.approx(0.1 / 3, rel=1e-15)
    assert (r.result["a"], r.result["b"], r.result["n"]) == (0.0, 1.0, 10)


def test_el_corchete_del_pizarron_son_las_11_evaluaciones_con_pesos_1_4_2(metodo):
    r = resolver(metodo, {"fx": "exp(x^2)", "a": 0, "b": 1, "n": 10})

    assert len(r.iterations) == 11  # n intervalos -> n + 1 puntos
    assert [f.values["peso"] for f in r.iterations] == [1, 4, 2, 4, 2, 4, 2, 4, 2, 4, 1]
    assert [f.values["xi"] for f in r.iterations] == pytest.approx(
        [i / 10 for i in range(11)], abs=1e-15
    )
    for fila in r.iterations:
        assert fila.values["fxi"] == pytest.approx(math.exp(fila.values["xi"] ** 2), rel=1e-14)
    assert r.iterations[-1].values["suma"] == pytest.approx(r.result["corchete"], abs=1e-12)


def test_caso_simple_n_2_es_ancho_por_altura_promedio(metodo):
    # (b - a) [f(x0) + 4 f(x1) + f(x2)] / 6 con 1/x en [1, 2]:
    # (1/6)(1 + 4*(2/3) + 1/2) = (1/6)(25/6) = 25/36.
    r = resolver(metodo, {"fx": "1/x", "a": 1, "b": 2, "n": 2})

    assert r.result["corchete"] == pytest.approx(25 / 6, abs=1e-14)
    assert r.result["integral"] == pytest.approx(25 / 36, abs=1e-14)
    assert r.result["factor"] == pytest.approx(1 / 6, abs=1e-15)
    assert [f.values["peso"] for f in r.iterations] == [1, 4, 1]


@pytest.mark.parametrize(
    ("params", "corchete", "integral"),
    [
        ({"fx": "sin(x)", "a": 0, "b": math.pi, "n": 8}, 15.280930843757210, 2.0002691699483877),
        ({"fx": "1/x", "a": 1, "b": 2, "n": 8}, 16.635708735708736, 0.6931545306545307),
        ({"fx": "exp(-x^2)", "a": 0, "b": 1, "n": 20}, 44.809451032554856, 0.7468241838759148),
        ({"fx": "sqrt(x)", "a": 0, "b": 4, "n": 16}, 63.878226108302696, 5.3231855090252225),
        ({"fx": "0.2 + 25*x - 200*x^2 + 675*x^3 - 900*x^4 + 400*x^5", "a": 0, "b": 0.8, "n": 2},
         10.256, 1.3674666666666667),
        ({"fx": "0.2 + 25*x - 200*x^2 + 675*x^3 - 900*x^4 + 400*x^5", "a": 0, "b": 0.8, "n": 4},
         24.352, 1.6234666666666667),
    ],
)
def test_reproduce_los_valores_de_referencia(metodo, params, corchete, integral):
    r = resolver(metodo, params)

    assert r.result["corchete"] == pytest.approx(corchete, rel=1e-13)
    assert r.result["integral"] == pytest.approx(integral, rel=1e-13)


@pytest.mark.parametrize(
    ("fx", "a", "b", "n", "exacto"),
    [
        ("x^3 - 2*x + 1", 0, 2, 2, 2.0),
        ("4*x^3 - 3*x^2 + 2*x - 1", 0, 3, 6, 60.0),
        ("x^3", 0, 3, 4, 81 / 4),
        ("x^2", 0, 3, 2, 9.0),
        ("2*x + 5", -1, 2, 2, 18.0),
    ],
)
def test_es_exacta_para_polinomios_de_grado_hasta_3(metodo, fx, a, b, n, exacto):
    r = resolver(metodo, {"fx": fx, "a": a, "b": b, "n": n})

    assert r.result["integral"] == pytest.approx(exacto, abs=1e-12)


@pytest.mark.parametrize(
    ("n", "error"),
    # Et simple = -(b-a)^5/2880 f'''' y Ea = -(b-a)^5/(180 n^4) f'''' (exacto - aprox).
    [(2, -(2**5) * 24 / 2880), (4, -(2**5) * 24 / (180 * 4**4)), (8, -(2**5) * 24 / (180 * 8**4))],
)
def test_el_error_de_x_a_la_4_sigue_la_formula_del_docente(metodo, n, error):
    r = resolver(metodo, {"fx": "x^4", "a": 0, "b": 2, "n": n})

    # La cuarta derivada de x^4 es constante (24): la formula es exacta.
    assert 32 / 5 - r.result["integral"] == pytest.approx(error, rel=1e-9)


def test_el_error_baja_como_h_a_la_cuarta(metodo):
    def error(n):
        r = resolver(metodo, {"fx": "exp(x)", "a": 0, "b": 1, "n": n})
        return abs(r.result["integral"] - (math.e - 1))

    assert error(4) / error(8) == pytest.approx(16, rel=0.05)


def test_la_tabla_es_coherente_con_el_resultado(metodo):
    r = resolver(metodo, {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 8})

    acumulada = 0.0
    for fila in r.iterations:
        v = fila.values
        assert v["ponderado"] == pytest.approx(v["peso"] * v["fxi"], abs=1e-15)
        acumulada += v["ponderado"]
        assert v["suma"] == pytest.approx(acumulada, abs=1e-12)
    assert r.result["integral"] == pytest.approx(
        r.result["factor"] * r.result["corchete"], abs=1e-15
    )
    # (b - a) * corchete / (3n) es lo mismo que (dx/3) * corchete.
    assert r.result["integral"] == pytest.approx(
        (1 - 0) * r.result["corchete"] / (3 * 8), abs=1e-14
    )
    assert r.result["factor"] == pytest.approx(r.result["delta_x"] / 3, rel=1e-15)


def test_las_columnas_son_las_del_corchete_sin_regla_ni_nodo(metodo):
    r = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 2})

    assert [c.key for c in r.columns] == ["xi", "fxi", "peso", "ponderado", "suma"]
    assert r.stop_reason is StopReason.COMPLETED and r.converged is True
    assert [f.error for f in r.iterations] == [None] * 3


@pytest.mark.parametrize("n", [1, 3, 5, 9])
def test_rechaza_un_n_impar_y_sugiere_simpson_3_8(metodo, n):
    with pytest.raises(MethodError, match="impar") as error:
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": n})

    assert f"n = {n}" in str(error.value)
    assert "3/8" in str(error.value)


@pytest.mark.parametrize(
    ("params", "mensaje"),
    [
        ({"fx": "x", "a": 0, "b": 0, "n": 2}, "vacio|distintos"),
        ({"fx": "x", "a": 2, "b": 1, "n": 2}, "mayor|intercambia"),
        ({"fx": "x", "a": 0, "b": 1, "n": 0}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": -2}, "positivo"),
        ({"fx": "x", "a": 0, "b": 1, "n": 2.5}, "entero"),
        ({"fx": "", "a": 0, "b": 1, "n": 2}, "f\\(x\\)|funcion"),
        ({"a": 0, "b": 1, "n": 2}, "f\\(x\\)|funcion"),
        ({"fx": "x", "b": 1, "n": 2}, "extremo inferior|a"),
        ({"fx": "x", "a": 0, "n": 2}, "extremo superior|b"),
        ({"fx": "x", "a": 0, "b": 1}, "subintervalos|n"),
    ],
)
def test_rechaza_entradas_invalidas_con_mensaje_explicativo(metodo, params, mensaje):
    with pytest.raises(MethodError, match=mensaje):
        resolver(metodo, params)


def test_rechaza_una_malla_desmesurada(metodo):
    with pytest.raises(MethodError, match="10000|maximo|Reduce"):
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 200000})


def test_la_malla_grande_pero_razonable_sigue_andando(metodo):
    r = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 10000})

    assert len(r.iterations) == 10001
    assert r.result["integral"] == pytest.approx(0.5, abs=1e-12)


def test_un_corchete_que_se_desborda_falla_con_causa(metodo):
    with pytest.raises(MethodError, match="desborda"):
        resolver(metodo, {"fx": "1e307", "a": 0, "b": 1, "n": 10})


def test_una_funcion_no_evaluable_en_un_extremo_falla_con_causa(metodo):
    with pytest.raises(MethodError, match="log|no.*definid|dominio|evaluar"):
        resolver(metodo, {"fx": "log(x)", "a": 0, "b": 1, "n": 2})


# ---------------------------------------------------------------- grafica

def test_grafica_trae_una_parabola_por_cada_dos_intervalos(metodo):
    r = resolver(metodo, {"fx": "x^2", "a": 0, "b": 1, "n": 4})

    assert r.plot.kind is PlotKind.INTEGRATION
    s = r.plot.series
    assert s["rectangles"] == [] and s["trapezoids"] == [] and s["cubicas"] == []
    assert s["interval"] == {"a": 0.0, "b": 1.0}
    assert len(s["parabolas"]) == 2
    for j, p in enumerate(s["parabolas"]):
        for k, clave in enumerate(("0", "m", "1")):
            x = (2 * j + k) / 4
            assert p[f"x{clave}"] == pytest.approx(x, abs=1e-15)
            assert p[f"y{clave}"] == pytest.approx(x * x, abs=1e-15)
    # La parabola j termina en la fila 2j + 2 y cada fila es un nodo rotulado x_i.
    assert s["arc_rows"] == [2, 4]
    assert [n["label"] for n in s["nodes"]] == [f"x{i}" for i in range(5)]
    assert len(s["nodes"]) == len(r.iterations)


def test_grafica_habilita_remuestreo_sobre_el_intervalo(metodo):
    r = resolver(metodo, {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 4})

    assert r.plot.resample is not None
    assert r.plot.resample.domain == (0.0, math.pi)


def test_las_notas_explican_los_pesos_y_el_corchete(metodo):
    r = resolver(metodo, {"fx": "exp(x^2)", "a": 0, "b": 1, "n": 10})

    texto = "\n".join(r.notes)
    assert "1.462681" in texto
    assert "Δx/3" in texto
    assert "5 parábolas" in texto


# -------------------------------------- relacion con "Metodo de Simpson"

@pytest.mark.parametrize("n", [4, 6, 10, 20])
def test_simpson_con_punto_medio_y_n_es_simpson_1_3_con_2n(n):
    """Misma regla con otra forma de contar n: ahi cada subintervalo suma su
    punto medio, asi que n subintervalos son 2n intervalos de esta regla."""
    clear()
    load_methods(force=True)
    params = {"fx": "exp(x^2) + sin(3*x)", "a": 0.3, "b": 2.1}
    con_medios = get("simpson").solve({**params, "n": n}, SolveConfig())
    sin_medios = get("simpson-13").solve({**params, "n": 2 * n}, SolveConfig())
    clear()

    assert sin_medios.result["integral"] == pytest.approx(con_medios.result["integral"], rel=1e-13)
    assert sin_medios.result["corchete"] == pytest.approx(con_medios.result["corchete"], rel=1e-13)
    assert sin_medios.result["factor"] == pytest.approx(con_medios.result["factor"], rel=1e-13)
    assert [f.values["xi"] for f in sin_medios.iterations] == pytest.approx(
        [f.values["xi"] for f in con_medios.iterations], abs=1e-13
    )
    assert [f.values["peso"] for f in sin_medios.iterations] == [
        f.values["peso"] for f in con_medios.iterations
    ]


def test_con_n_2_simpson_es_una_sola_parabola_igual_a_simpson_1_3_con_n_2():
    clear()
    load_methods(force=True)
    params = {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 2}
    con_medios = get("simpson").solve(params, SolveConfig())
    sin_medios = get("simpson-13").solve(params, SolveConfig())
    clear()

    assert sin_medios.result["integral"] == pytest.approx(con_medios.result["integral"], rel=1e-14)
    assert sin_medios.result["integral"] == pytest.approx(2.29015714, abs=1e-8)


def test_el_tramo_1_3_de_simpson_3_8_es_simpson_1_3_sobre_ese_tramo():
    clear()
    load_methods(force=True)
    f = "sin(x) + x^2"
    combinada = get("simpson-38").solve({"fx": f, "a": 0, "b": 2.5, "n": 5}, SolveConfig())
    uno = combinada.result["tramos"][0]
    sola = get("simpson-13").solve(
        {"fx": f, "a": uno["desde"], "b": uno["hasta"], "n": 2}, SolveConfig()
    )
    clear()

    assert uno["regla"] == "1/3"
    assert uno["integral"] == pytest.approx(sola.result["integral"], rel=1e-14)
    assert uno["corchete"] == pytest.approx(sola.result["corchete"], rel=1e-14)
    assert uno["factor"] == pytest.approx(sola.result["factor"], rel=1e-14)
