"""Pruebas de Simpson 3/8: simple, compuesta y aplicacion multiple (1/3 + 3/8).

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
from tests.casos_referencia import SIMPSON_38_CHAPRA


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
    assert metodo.orden == 9
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
        "nodo", "xi", "fxi", "regla", "peso", "ponderado", "suma",
    ]
    assert resultado.stop_reason is StopReason.COMPLETED
    assert resultado.converged is True
    assert [fila.error for fila in resultado.iterations] == [None] * 4


@pytest.mark.parametrize("n", [1, 2])
def test_con_menos_de_tres_subintervalos_no_hay_cubica(metodo, n):
    with pytest.raises(MethodError, match="al menos 3 subintervalos") as error:
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": n})

    assert f"n = {n}" in str(error.value)


def test_con_n_igual_a_4_no_queda_tramo_de_3_8_y_sugiere_simpson_1_3(metodo):
    # 4 mod 3 = 1: la regla 1/3 tomaria los cuatro subintervalos.
    with pytest.raises(MethodError, match="n = 4") as error:
        resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 4})

    assert "Simpson 1/3" in str(error.value)


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


def test_la_combinacion_de_una_malla_grande_repite_la_fila_del_nodo_de_union(metodo):
    # 10000 = 4 + 9996: dos parabolas y 3332 cubicas, con x4 en dos filas.
    resultado = resolver(metodo, {"fx": "x", "a": 0, "b": 1, "n": 10000})

    assert len(resultado.iterations) == 10002
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


# ------------------------------------------- aplicacion multiple (1/3 + 3/8)

# Chapra, ejemplo 21.6: f(x) = 0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5
# en [0, 0.8], valor exacto 1.640533. Los numeros salen de un script aparte con
# fracciones y mpmath que no importa el nucleo.
CHAPRA = SIMPSON_38_CHAPRA["fx"]
CHAPRA_EXACTO = SIMPSON_38_CHAPRA["exacto"]


def chapra(x):
    return 0.2 + 25 * x - 200 * x**2 + 675 * x**3 - 900 * x**4 + 400 * x**5


def test_chapra_n_5_combina_1_3_en_dos_subintervalos_y_3_8_en_tres(metodo):
    r = resolver(metodo, {"fx": CHAPRA, "a": 0, "b": 0.8, "n": 5})

    uno, otro = r.result["tramos"]
    assert (uno["regla"], uno["desde"], uno["hasta"]) == ("1/3", 0.0, pytest.approx(0.32))
    assert (otro["regla"], otro["desde"], otro["hasta"]) == (
        "3/8", pytest.approx(0.32), pytest.approx(0.8),
    )
    assert uno["corchete"] == pytest.approx(SIMPSON_38_CHAPRA["tramo_1_3"]["corchete"], abs=1e-12)
    assert uno["factor"] == pytest.approx(0.16 / 3, rel=1e-14)
    assert uno["integral"] == pytest.approx(SIMPSON_38_CHAPRA["tramo_1_3"]["integral"], abs=5e-8)
    assert uno["integral"] == pytest.approx(0.38032370346666667, abs=1e-13)
    assert otro["corchete"] == pytest.approx(SIMPSON_38_CHAPRA["tramo_3_8"]["corchete"], abs=1e-12)
    assert otro["factor"] == pytest.approx(3 * 0.16 / 8, rel=1e-14)
    # Chapra imprime 1.264754: redondeo de sus pasos intermedios (1.2647535).
    assert otro["integral"] == pytest.approx(1.264754, abs=1e-6)
    assert otro["integral"] == pytest.approx(1.2647534592, abs=1e-13)
    assert r.result["integral"] == pytest.approx(SIMPSON_38_CHAPRA["integral"], abs=5e-7)
    assert r.result["integral"] == pytest.approx(1.6450771626666667, abs=1e-13)
    assert r.result["integral"] == pytest.approx(uno["integral"] + otro["integral"], abs=1e-15)
    # No es exacta: la funcion es de grado 5. El error real es de 4.5e-3.
    assert r.result["integral"] - CHAPRA_EXACTO == pytest.approx(0.004543829333, abs=1e-9)
    # No hay un solo corchete ni un solo factor: cada regla tiene el suyo.
    assert "corchete" not in r.result and "factor" not in r.result
    assert (r.result["n"], r.result["h"]) == (5, pytest.approx(0.16))


def test_chapra_n_3_es_una_sola_cubica(metodo):
    r = resolver(metodo, {"fx": CHAPRA, "a": 0, "b": 0.8, "n": 3})

    assert r.result["integral"] == pytest.approx(1.519170, abs=5e-7)
    assert r.result["integral"] == pytest.approx(1.5191703703703704, abs=1e-13)
    assert [t["regla"] for t in r.result["tramos"]] == ["3/8"]
    assert r.result["corchete"] == r.result["tramos"][0]["corchete"]


def test_cada_tramo_es_la_formula_de_ancho_por_altura_promedio(metodo):
    # 1/3 simple sobre [0, 0.32]: (b - a)[f0 + 4 f1 + f2]/6.
    # 3/8 simple sobre [0.32, 0.8]: (b - a)[f0 + 3 f1 + 3 f2 + f3]/8.
    r = resolver(metodo, {"fx": CHAPRA, "a": 0, "b": 0.8, "n": 5})

    simple = 0.32 * (chapra(0) + 4 * chapra(0.16) + chapra(0.32)) / 6
    otro = 0.48 * (chapra(0.32) + 3 * chapra(0.48) + 3 * chapra(0.64) + chapra(0.8)) / 8
    assert r.result["tramos"][0]["integral"] == pytest.approx(simple, abs=1e-14)
    assert r.result["tramos"][1]["integral"] == pytest.approx(otro, abs=1e-14)


def test_el_nodo_de_union_aparece_dos_veces_con_peso_1_en_cada_regla(metodo):
    r = resolver(metodo, {"fx": CHAPRA, "a": 0, "b": 0.8, "n": 5})

    filas = r.iterations
    assert len(filas) == 7  # n + 2: x2 se repite
    assert [f.n for f in filas] == list(range(7))
    assert [f.values["nodo"] for f in filas] == ["x0", "x1", "x2", "x2", "x3", "x4", "x5"]
    assert [f.values["regla"] for f in filas] == ["1/3"] * 3 + ["3/8"] * 4
    assert [f.values["peso"] for f in filas] == [1, 4, 1, 1, 3, 3, 1]
    assert filas[2].values["xi"] == filas[3].values["xi"]
    assert filas[2].values["fxi"] == filas[3].values["fxi"]
    # La suma del corchete arranca de cero con cada regla y termina en el suyo.
    assert filas[3].values["suma"] == pytest.approx(filas[3].values["ponderado"])
    assert filas[2].values["suma"] == pytest.approx(r.result["tramos"][0]["corchete"], abs=1e-12)
    assert filas[-1].values["suma"] == pytest.approx(r.result["tramos"][1]["corchete"], abs=1e-12)
    assert filas[-1].values["xi"] == 0.8


@pytest.mark.parametrize(
    ("fx", "a", "b", "n", "reglas", "pesos", "integral"),
    [
        # n = 7: 1/3 en 4 subintervalos (dos parabolas) y 3/8 en 3.
        ("sin(x)", 0, math.pi, 7, ["1/3"] * 5 + ["3/8"] * 4,
         [1, 4, 2, 4, 1, 1, 3, 3, 1], 2.000696391854689),
        # n = 8: 1/3 en 2 subintervalos y 3/8 en 6 (dos cubicas, x5 pesa 2).
        ("exp(-x^2)", 0, 1, 8, ["1/3"] * 3 + ["3/8"] * 7,
         [1, 4, 1, 1, 3, 3, 2, 3, 3, 1], 0.74682376178560103),
        # n = 10: 1/3 en 4 y 3/8 en 6.
        ("exp(x)", 0, 1, 10, ["1/3"] * 5 + ["3/8"] * 7,
         [1, 4, 2, 4, 1, 1, 3, 3, 2, 3, 3, 1], 1.7182836307995775),
    ],
)
def test_n_que_no_es_multiplo_de_3_combina_las_dos_reglas(
    metodo, fx, a, b, n, reglas, pesos, integral
):
    r = resolver(metodo, {"fx": fx, "a": a, "b": b, "n": n})

    assert [f.values["regla"] for f in r.iterations] == reglas
    assert [f.values["peso"] for f in r.iterations] == pesos
    assert r.result["integral"] == pytest.approx(integral, rel=1e-13)
    assert sum(t["integral"] for t in r.result["tramos"]) == pytest.approx(
        r.result["integral"], abs=1e-15
    )
    # Los dos tramos se tocan: la 3/8 empieza donde acaba la 1/3.
    uno, otro = r.result["tramos"]
    assert uno["hasta"] == otro["desde"]
    assert (uno["desde"], otro["hasta"]) == (a, b)


def test_con_n_multiplo_de_3_hay_un_solo_tramo_3_8_con_corchete_y_factor(metodo):
    r = resolver(metodo, {"fx": "x^2", "a": 0, "b": 3, "n": 6})

    (tramo,) = r.result["tramos"]
    assert tramo["regla"] == "3/8"
    assert (tramo["desde"], tramo["hasta"]) == (0.0, 3.0)
    assert tramo["corchete"] == pytest.approx(48.0, abs=1e-12)
    assert tramo["integral"] == pytest.approx(9.0, abs=1e-12)
    assert r.result["corchete"] == tramo["corchete"]
    assert r.result["factor"] == tramo["factor"]
    assert {f.values["regla"] for f in r.iterations} == {"3/8"}
    assert [f.values["nodo"] for f in r.iterations] == [f"x{i}" for i in range(7)]


@pytest.mark.parametrize("n", [3, 5, 6, 7, 8, 9, 10])
def test_es_exacta_para_cubicas_con_cualquier_n_permitido(metodo, n):
    # Parabola y cubica integran sin error un polinomio de grado <= 3.
    r = resolver(metodo, {"fx": "4*x^3 - 3*x^2 + 2*x - 1", "a": 0, "b": 3, "n": n})

    assert r.result["integral"] == pytest.approx(60.0, abs=1e-9)


def test_la_grafica_combinada_trae_parabolas_y_cubicas_con_nodos_y_filas(metodo):
    r = resolver(metodo, {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 7})

    s = r.plot.series
    assert len(s["parabolas"]) == 2 and len(s["cubicas"]) == 1
    # Parabolas: nodos 0-2 y 2-4; cubica: nodos 4-7. En la tabla la cubica
    # empieza en la fila 5 (x4 repetido): sus arcos acaban en las filas 2, 4 y 8.
    assert s["arc_rows"] == [2, 4, 8]
    assert [n["label"] for n in s["nodes"]] == [
        "x0", "x1", "x2", "x3", "x4", "x4", "x5", "x6", "x7",
    ]
    assert len(s["nodes"]) == len(r.iterations)
    for nodo, fila in zip(s["nodes"], r.iterations):
        assert nodo["x"] == fila.values["xi"] and nodo["y"] == fila.values["fxi"]
    p = s["parabolas"][1]
    h = math.pi / 7
    assert (p["x0"], p["xm"], p["x1"]) == pytest.approx((2 * h, 3 * h, 4 * h))
    assert s["cubicas"][0]["x0"] == pytest.approx(4 * h)
    assert s["cubicas"][0]["x3"] == pytest.approx(math.pi)


def test_la_grafica_pura_pone_las_filas_de_cada_cubica_y_los_nodos(metodo):
    r = resolver(metodo, {"fx": "x^2", "a": 0, "b": 1, "n": 6})

    assert r.plot.series["arc_rows"] == [3, 6]
    assert [n["label"] for n in r.plot.series["nodes"]] == [f"x{i}" for i in range(7)]
    assert r.plot.series["parabolas"] == []


def test_las_notas_dicen_que_regla_cubre_que_tramo(metodo):
    r = resolver(metodo, {"fx": CHAPRA, "a": 0, "b": 0.8, "n": 5})

    texto = "\n".join(r.notes)
    assert "n = 5 no es múltiplo de 3" in texto
    assert "regla 1/3 cubre los primeros 2 subintervalos" in texto
    assert "de x0 = 0 a x2 = 0.32" in texto
    assert "regla 3/8 los 3 restantes" in texto
    assert "de x2 = 0.32 a x5 = 0.8" in texto
    assert "dos veces" in texto
    assert "1.645077" in texto
