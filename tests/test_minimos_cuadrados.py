"""Pruebas del ajuste por minimos cuadrados contra el material del docente.

Los valores esperados de los modelos no lineales salieron de un ajuste hecho
aparte (numpy.polyfit sobre los datos transformados), no de este aplicativo.
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.expression import parse
from core.registry import all_methods, clear, get, load_methods
from core.types import FieldKind, MethodError, PlotKind, StopReason

DOCENTE = [[1.0, 2.0], [1.5, 3.2], [2.0, 4.1], [2.5, 4.9], [3.0, 5.9]]


@pytest.fixture
def metodo():
    clear()
    load_methods(force=True)
    yield get("minimos-cuadrados")
    clear()


def resolver(metodo, puntos, modelo=None, x=None, decimals=8):
    params = {"points": [list(p) for p in puntos]}
    if modelo is not None:
        params["modelo"] = modelo
    if x is not None:
        params["x"] = x
    return metodo.solve(params, SolveConfig(decimals=decimals))


# ---------- contrato ----------

def test_queda_registrado_en_una_familia_propia_despues_de_runge_kutta(metodo):
    assert metodo in all_methods()
    assert (metodo.unit, metodo.family, metodo.orden) == ("U4", "ajuste", 11)
    assert all_methods()[-1].slug == "minimos-cuadrados"


def test_los_campos_son_puntos_modelo_y_x_opcional(metodo):
    campos = {c.name: c for c in metodo.inputs}
    assert list(campos) == ["points", "modelo", "x"]
    assert campos["points"].kind is FieldKind.POINTS
    assert campos["modelo"].default == "lineal"
    assert campos["modelo"].required is False
    assert campos["modelo"].choices == (
        "lineal", "potencial", "exponencial", "logaritmica",
    )
    assert campos["x"].required is False


# ---------- el ejercicio del docente ----------

def test_ejercicio_del_docente_m_b_y_r(metodo):
    res = resolver(metodo, DOCENTE)
    assert res.result["m"] == pytest.approx(1.9, abs=1e-12)
    assert res.result["b"] == pytest.approx(0.22, abs=1e-12)
    assert res.result["r"] == pytest.approx(0.9976262076984156, abs=1e-12)
    assert res.result["r"] == pytest.approx(0.9976, abs=5e-5)
    assert res.result["suma_residuos"] == pytest.approx(0.043, abs=1e-12)
    assert res.converged and res.stop_reason is StopReason.EXACT


def test_ejercicio_del_docente_la_tabla_es_la_del_pizarron(metodo):
    res = resolver(metodo, DOCENTE)
    assert [c.label for c in res.columns] == [
        "x_i", "y_i", "x_i*y_i", "x_i^2", "y_i^2",
    ]
    assert [it.n for it in res.iterations] == [1, 2, 3, 4, 5]

    xy = [it.values["xiyi"] for it in res.iterations]
    assert xy == pytest.approx([2.0, 4.8, 8.2, 12.25, 17.7])
    assert [it.values["xi2"] for it in res.iterations] == pytest.approx(
        [1.0, 2.25, 4.0, 6.25, 9.0]
    )
    assert [it.values["yi2"] for it in res.iterations] == pytest.approx(
        [4.0, 10.24, 16.81, 24.01, 34.81]
    )
    # El "Error" del pizarron es (m x + b - y)^2, y va en la columna de error.
    assert [it.error for it in res.iterations] == pytest.approx(
        [0.0144, 0.0169, 0.0064, 0.0049, 0.0004], abs=1e-12
    )


def test_ejercicio_del_docente_la_fila_total(metodo):
    totales = resolver(metodo, DOCENTE).result["totales"]
    assert totales == pytest.approx({
        "xi": 10.0, "yi": 20.1, "xiyi": 44.95, "xi2": 22.5, "yi2": 89.87,
        "error": 0.043,
    }, abs=1e-12)


def test_la_ecuacion_se_escribe_con_m_y_b(metodo):
    res = resolver(metodo, DOCENTE)
    assert res.result["ecuacion"] == "y = 1.9*x + 0.22"
    assert resolver(metodo, [[0, 10], [1, 8], [2, 6]]).result["ecuacion"] == "y = -2*x + 10"
    assert resolver(metodo, [[0, 1], [1, 0], [2, -1]]).result["ecuacion"] == "y = -1*x + 1"
    assert resolver(metodo, [[0, -1], [1, 0], [2, 1]]).result["ecuacion"] == "y = 1*x - 1"


def test_el_valor_en_x_se_pide_aparte(metodo):
    sin_x = resolver(metodo, DOCENTE)
    assert "valor" not in sin_x.result
    assert sin_x.plot.series["evaluated"] is None

    con_x = resolver(metodo, DOCENTE, x=2.0)
    assert con_x.result["valor"] == pytest.approx(4.02, abs=1e-12)
    assert con_x.plot.series["evaluated"] == {"x": 2.0, "y": pytest.approx(4.02)}


# ---------- los cuatro modelos ----------

# (modelo, puntos, x, m, b, r, suma_residuos, valor, pendiente, ordenada)
MODELOS = [
    ("potencial", [[0.25, 1.00], [0.5, 1.42], [1.0, 2.01], [2.0, 2.83], [4.0, 4.02]], 3.0,
     0.5009302126135607, 2.005854273514359, 0.9999917633822099,
     3.745918048150344e-06, 3.4777938059414724,
     0.5009302126135607, 0.3022993780824611),
    ("exponencial", [[0, 2.1], [1, 3.4], [2, 5.4], [3, 8.9], [4, 14.5]], 2.5,
     0.48266984545102815, 2.0899134221607363, 0.9999274231270148,
     6.378880804300656e-05, 6.98522534835349,
     0.20962085046047688, 0.32012829517485264),
    ("exponencial", [[0, 10], [1, 6.1], [2, 3.8], [3, 2.2], [4, 1.4]], 5.0,
     -0.4952057123560662, 10.019892131609696, -0.9996879050778813,
     0.0002888417456823998, 0.8424371394314999,
     -0.2150651082832085, 1.0008630461920212),
    ("logaritmica", [[1, 1.0], [2, 1.9], [4, 2.8], [8, 3.8], [16, 4.6]], 6.0,
     3.0229545663474986, 1.0, 0.9995776134975238,
     0.007, 3.3523158756562523,
     3.0229545663474986, 1.0),
]


@pytest.mark.parametrize(
    "modelo_nombre, puntos, x, m, b, r, sr, valor, pendiente, ordenada", MODELOS,
)
def test_los_modelos_no_lineales_linealizan_con_log_en_base_10(
    metodo, modelo_nombre, puntos, x, m, b, r, sr, valor, pendiente, ordenada,
):
    res = resolver(metodo, puntos, modelo_nombre, x=x)
    assert res.result["modelo"] == modelo_nombre
    assert res.result["m"] == pytest.approx(m, rel=1e-9, abs=1e-12)
    assert res.result["b"] == pytest.approx(b, rel=1e-9, abs=1e-12)
    assert res.result["r"] == pytest.approx(r, abs=1e-10)
    assert res.result["suma_residuos"] == pytest.approx(sr, rel=1e-6, abs=1e-12)
    assert res.result["valor"] == pytest.approx(valor, rel=1e-9)
    assert res.result["pendiente_lineal"] == pytest.approx(pendiente, rel=1e-9)
    assert res.result["ordenada_lineal"] == pytest.approx(ordenada, rel=1e-9)


def test_el_modelo_lineal_no_trae_pendiente_ni_ordenada_aparte(metodo):
    res = resolver(metodo, DOCENTE, "lineal")
    assert "pendiente_lineal" not in res.result
    assert res.notes == []


def test_el_modelo_potencial_recupera_una_ley_exacta(metodo):
    # y = 3 x^2: log y = 2 log x + log 3, asi que la recta es exacta.
    res = resolver(metodo, [[1, 3], [2, 12], [4, 48], [10, 300]], "potencial")
    assert res.result["m"] == pytest.approx(2.0, abs=1e-12)
    assert res.result["b"] == pytest.approx(3.0, abs=1e-12)
    assert res.result["r"] == pytest.approx(1.0, abs=1e-12)
    assert res.result["suma_residuos"] == pytest.approx(0.0, abs=1e-20)
    assert res.result["ecuacion"] == "y = 3*x^2"


def test_el_modelo_exponencial_recupera_la_base_e(metodo):
    # y = 2 e^(0.5 x): la pendiente de log10 y es 0.5 log10(e), y m la deshace.
    puntos = [[x, 2 * math.exp(0.5 * x)] for x in (0, 1, 2, 3)]
    res = resolver(metodo, puntos, "exponencial")
    assert res.result["m"] == pytest.approx(0.5, abs=1e-12)
    assert res.result["b"] == pytest.approx(2.0, abs=1e-12)
    assert res.result["pendiente_lineal"] == pytest.approx(0.5 * math.log10(math.e))


def test_las_columnas_de_un_modelo_linealizado_son_las_transformadas(metodo):
    res = resolver(metodo, [[1, 3], [10, 30], [100, 300]], "potencial")
    assert [c.label for c in res.columns] == [
        "log x_i", "log y_i", "log x_i*log y_i", "(log x_i)^2", "(log y_i)^2",
    ]
    fila = res.iterations[1].values
    assert fila["xi"] == pytest.approx(1.0)
    assert fila["yi"] == pytest.approx(math.log10(30))
    assert fila["xiyi"] == pytest.approx(math.log10(30))
    assert any("log" in nota and "base 10" in nota for nota in res.notes)
    assert res.result["totales"]["xi"] == pytest.approx(0 + 1 + 2)


def test_cada_modelo_rotula_solo_lo_que_transforma(metodo):
    puntos = [[1, 2], [2, 3], [4, 9]]
    etiquetas = {
        m: [c.label for c in resolver(metodo, puntos, m).columns][:2]
        for m in ("lineal", "potencial", "exponencial", "logaritmica")
    }
    assert etiquetas == {
        "lineal": ["x_i", "y_i"],
        "potencial": ["log x_i", "log y_i"],
        "exponencial": ["x_i", "log y_i"],
        "logaritmica": ["log x_i", "y_i"],
    }


# ---------- r ----------

def test_r_vale_menos_uno_y_uno_en_las_rectas_perfectas(metodo):
    assert resolver(metodo, [[0, 10], [1, 8], [2, 6]]).result["r"] == pytest.approx(-1.0, abs=1e-15)
    assert resolver(metodo, [[0, 1], [1, 3], [2, 5]]).result["r"] == pytest.approx(1.0, abs=1e-15)


def test_r_cercano_a_cero_y_negativo_cuando_no_hay_relacion(metodo):
    puntos = [[1, 4], [2, 7], [3, 3], [4, 6], [5, 5], [6, 5.5], [7, 4.5], [8, 4]]
    res = resolver(metodo, puntos)
    assert res.result["r"] == pytest.approx(-0.13725270326150327, abs=1e-12)
    assert abs(res.result["r"]) < 0.2


def test_con_todas_las_y_iguales_r_no_esta_definida_y_se_explica(metodo):
    res = resolver(metodo, [[1, 5], [2, 5], [3, 5]])
    assert res.result["m"] == 0
    assert res.result["b"] == 5
    assert res.result["r"] is None
    assert any("r no esta definida" in nota for nota in res.notes)


def test_x_repetidas_se_admiten_mientras_haya_dos_distintas(metodo):
    res = resolver(metodo, [[1, 2.1], [1, 1.9], [2, 4.2], [2, 3.8], [3, 6.1], [3, 5.9]])
    assert res.result["m"] == pytest.approx(2.0, abs=1e-12)
    assert res.result["b"] == pytest.approx(0.0, abs=1e-12)
    assert res.result["r"] == pytest.approx(0.9962709627734359, abs=1e-12)
    assert len(res.iterations) == 6


# ---------- validacion ----------

@pytest.mark.parametrize("puntos, fragmento", [
    (None, "tabla con al menos dos puntos"),
    ([[1, 2]], "al menos dos puntos"),
    ([[1, 2], [3]], "punto 2"),
    ([[1, 2], ["a", 3]], "x del punto 2"),
    ([[1, 2], [3, float("nan")]], "y del punto 2"),
    ([[1, 2], [1, 5]], "al menos dos valores distintos de x"),
])
def test_rechaza_puntos_invalidos_con_su_causa(metodo, puntos, fragmento):
    with pytest.raises(MethodError, match=fragmento):
        metodo.solve({"points": puntos}, SolveConfig())


def test_rechaza_un_modelo_desconocido(metodo):
    with pytest.raises(MethodError, match="lineal, potencial, exponencial, logaritmica"):
        resolver(metodo, DOCENTE, "cuadratico")


@pytest.mark.parametrize("modelo_nombre, puntos, fragmento", [
    ("potencial", [[0, 1], [1, 2]], "x > 0.*punto 1.*x = 0"),
    ("potencial", [[1, 1], [2, -2]], "y > 0.*punto 2.*y = -2"),
    ("exponencial", [[1, 0], [2, 2]], "y > 0.*punto 1.*y = 0"),
    ("logaritmica", [[1, 1], [-2, 2]], "x > 0.*punto 2.*x = -2"),
])
def test_el_modelo_que_toma_logaritmos_exige_positivos(
    metodo, modelo_nombre, puntos, fragmento,
):
    with pytest.raises(MethodError, match=fragmento):
        resolver(metodo, puntos, modelo_nombre)


def test_el_modelo_exponencial_si_admite_x_no_positivas(metodo):
    res = resolver(metodo, [[-1, 1], [0, 2], [1, 4]], "exponencial")
    assert res.result["m"] == pytest.approx(math.log(2), abs=1e-12)


@pytest.mark.parametrize("modelo_nombre", ["potencial", "logaritmica"])
def test_pedir_x_no_positivo_en_un_modelo_con_log_se_explica(metodo, modelo_nombre):
    with pytest.raises(MethodError, match="x a evaluar.*x > 0"):
        resolver(metodo, [[1, 1], [2, 2]], modelo_nombre, x=0)


def test_el_modelo_vacio_o_ausente_es_lineal(metodo):
    assert resolver(metodo, DOCENTE).result["modelo"] == "lineal"
    assert metodo.solve({"points": DOCENTE, "modelo": None}, SolveConfig()).result["modelo"] == "lineal"


# ---------- la grafica ----------

def test_la_grafica_son_los_puntos_y_la_curva_ajustada(metodo):
    res = resolver(metodo, DOCENTE)
    plot = res.plot
    assert plot.kind is PlotKind.AJUSTE
    assert plot.series["points"] == DOCENTE
    xs, ys = plot.series["curve"]["x"], plot.series["curve"]["y"]
    assert len(xs) == len(ys) > 100
    assert min(xs) < 1.0 and max(xs) > 3.0  # sobresale de los datos
    for x, y in zip(xs, ys, strict=True):
        assert y == pytest.approx(1.9 * x + 0.22, abs=1e-9)


@pytest.mark.parametrize("modelo_nombre, puntos, x, m, b", [
    ("potencial", MODELOS[0][1], 3.0, MODELOS[0][3], MODELOS[0][4]),
    ("exponencial", MODELOS[1][1], 2.5, MODELOS[1][3], MODELOS[1][4]),
    ("logaritmica", MODELOS[3][1], 6.0, MODELOS[3][3], MODELOS[3][4]),
])
def test_la_curva_y_la_expresion_de_remuestreo_son_la_del_modelo(
    metodo, modelo_nombre, puntos, x, m, b,
):
    res = resolver(metodo, puntos, modelo_nombre, x=x)
    curva = res.plot.series["curve"]
    esperada = {
        "potencial": lambda t: b * t**m,
        "exponencial": lambda t: b * math.exp(m * t),
        "logaritmica": lambda t: m * math.log10(t) + b,
    }[modelo_nombre]
    for t, y in zip(curva["x"], curva["y"], strict=True):
        assert t > 0 if modelo_nombre != "exponencial" else True
        assert y == pytest.approx(esperada(t), rel=1e-9)

    remuestreo = res.plot.resample
    assert remuestreo is not None
    f = parse(remuestreo.expression)
    for t in (curva["x"][0], x, curva["x"][-1]):
        assert f.evaluar(x=t) == pytest.approx(esperada(t), rel=1e-9)


def test_el_rango_de_la_curva_incluye_el_x_pedido_y_se_queda_en_positivos(metodo):
    res = resolver(metodo, [[1, 1], [2, 2], [3, 2.9]], "logaritmica", x=10.0)
    xs = res.plot.series["curve"]["x"]
    assert max(xs) >= 10.0
    assert min(xs) > 0


# ---------- decimals es formato ----------

def test_los_decimales_no_cambian_lo_calculado(metodo):
    poco = resolver(metodo, DOCENTE, x=2.0, decimals=2)
    mucho = resolver(metodo, DOCENTE, x=2.0, decimals=10)
    assert poco.result == mucho.result
    assert [it.values for it in poco.iterations] == [it.values for it in mucho.iterations]


# ---------- por la API ----------

def test_la_api_ofrece_los_modelos_y_resuelve_el_ejercicio_del_docente():
    from fastapi.testclient import TestClient

    from api.main import create_app

    clear()
    with TestClient(create_app()) as cliente:
        campos = cliente.get("/api/methods/minimos-cuadrados").json()["inputs"]
        modelo = next(c for c in campos if c["name"] == "modelo")
        assert modelo["choices"] == ["lineal", "potencial", "exponencial", "logaritmica"]

        respuesta = cliente.post(
            "/api/methods/minimos-cuadrados/solve",
            json={"params": {"points": DOCENTE}, "config": {"decimals": 4}},
        )
        assert respuesta.status_code == 200, respuesta.text
        cuerpo = respuesta.json()
        assert cuerpo["result"]["m"] == pytest.approx(1.9)
        assert cuerpo["result"]["totales"]["yi2"] == pytest.approx(89.87)
        assert cuerpo["plot"]["kind"] == "ajuste"
    clear()


def test_datos_enormes_se_explican_en_vez_de_desbordar(metodo):
    with pytest.raises(MethodError, match="escalarlos"):
        resolver(metodo, [[1e200, 1e200], [2e200, 3e200], [3e200, 2e200]])


def test_r_con_valores_grandes_pero_representables_sigue_acotada(metodo):
    res = resolver(metodo, [[1e100, 2e100], [2e100, 4e100], [3e100, 6e100]])
    assert res.result["r"] == pytest.approx(1.0, abs=1e-15)
