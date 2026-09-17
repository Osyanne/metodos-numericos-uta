"""Pruebas del metodo del Punto Medio para integracion numerica.

El caso canonico viene del material del docente (ejemplo del parcial 1):

    I = integral de -1.5 a 2 de (0.25*x^3 - x) dx  con  n = 7

que da Delta_x = 0.5 y los puntos medios -1.25, -0.75, -0.25, 0.25, 0.75,
1.25, 1.75. La suma f(m_i) * Delta_x reproduce el resultado -0.2051 que
aparece en la diapositiva.
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
    yield get("punto-medio")
    clear()


def resolver(metodo, params, **config):
    valores = {"decimals": 10, **config}
    return metodo.solve(params, SolveConfig(**valores))


def test_registra_el_metodo_con_todas_sus_entradas(metodo):
    assert metodo in all_methods()
    assert [campo.name for campo in metodo.inputs] == ["fx", "a", "b", "n"]


def test_reproduce_el_ejemplo_del_docente_con_siete_rectangulos(metodo):
    """Ejemplo del PDF del parcial 1.

    La diapositiva termina con I = -0.2051 usando cuatro decimales para
    f(m_i). Con aritmetica de punto flotante el numero se afina un poco,
    pero al redondearlo a cuatro decimales tiene que dar exactamente eso.
    """
    resultado = resolver(
        metodo,
        {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 7},
    )

    assert resultado.result["integral"] == pytest.approx(-0.205078125, abs=1e-12)
    assert round(resultado.result["integral"], 4) == -0.2051
    assert resultado.result["delta_x"] == pytest.approx(0.5, abs=1e-12)
    assert resultado.result["a"] == -1.5
    assert resultado.result["b"] == 2
    assert resultado.result["n"] == 7


def test_las_filas_de_la_tabla_coinciden_con_las_del_docente(metodo):
    """Cada fila muestra el punto medio y f(m_i) que el PDF tabula."""
    resultado = resolver(
        metodo,
        {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 7},
    )

    # Puntos medios del docente: -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75.
    esperados_x = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75]
    obtenidos_x = [it.values["xi"] for it in resultado.iterations]
    assert obtenidos_x == pytest.approx(esperados_x, abs=1e-12)

    # Valores de la funcion tal como los tabula el docente (redondeados a
    # cuatro decimales en el PDF; se comparan con la misma precision).
    esperados_f = [0.7617, 0.6445, 0.2461, -0.2461, -0.6445, -0.7617, -0.4102]
    obtenidos_f = [round(it.values["fxi"], 4) for it in resultado.iterations]
    assert obtenidos_f == esperados_f

    # Numeracion desde i = 1, como en el PDF.
    assert [it.n for it in resultado.iterations] == list(range(1, 8))


def test_la_suma_acumulada_termina_igual_al_resultado(metodo):
    resultado = resolver(
        metodo,
        {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 7},
    )

    assert resultado.iterations[-1].values["suma"] == pytest.approx(
        resultado.result["integral"], abs=1e-12
    )


def test_la_integracion_termina_como_completada_no_por_iteraciones(metodo):
    """Malla fija: recorrer los n subintervalos es el final normal, no un
    fracaso. Reportarlo como MAX_ITERATIONS mostraria en pantalla "completo
    las n iteraciones sin alcanzar la tolerancia" para un metodo que nunca
    persigue una tolerancia.
    """
    resultado = resolver(
        metodo,
        {"fx": "x^2", "a": 0, "b": 1, "n": 10},
    )

    assert resultado.stop_reason is StopReason.COMPLETED
    assert resultado.converged is True


def test_no_reporta_error_por_iteracion(metodo):
    """Como Runge-Kutta: un metodo de malla fija no tiene error por fila."""
    resultado = resolver(
        metodo,
        {"fx": "x", "a": 0, "b": 1, "n": 5},
    )

    assert [it.error for it in resultado.iterations] == [None] * 5


def test_una_funcion_lineal_da_el_area_exacta(metodo):
    """f(x) = x en [0, 2] tiene integral exacta 2. El punto medio es exacto
    para lineales con cualquier n, porque los rectangulos compensan por debajo
    y por encima simetricamente."""
    resultado = resolver(
        metodo,
        {"fx": "x", "a": 0, "b": 2, "n": 4},
    )

    assert resultado.result["integral"] == pytest.approx(2.0, abs=1e-12)


def test_una_constante_da_area_del_rectangulo(metodo):
    """f(x) = 3 en [1, 5]: area = 3 * 4 = 12, independiente de n."""
    resultado = resolver(
        metodo,
        {"fx": "3", "a": 1, "b": 5, "n": 8},
    )

    assert resultado.result["integral"] == pytest.approx(12.0, abs=1e-12)


def test_refinar_la_malla_mejora_la_aproximacion(metodo):
    """Con mas subintervalos, el resultado se acerca al valor exacto.

    El valor exacto de la integral del PDF es -0.1914 (aparece con esa
    precision en la diapositiva). Con n = 100 tiene que quedar mucho mas
    cerca de eso que con n = 7.
    """
    exacto = -0.19140625  # integral analitica de (0.25 x^3 - x) de -1.5 a 2

    con_pocos = resolver(
        metodo, {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 7}
    )
    con_muchos = resolver(
        metodo, {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 1000}
    )

    error_pocos = abs(con_pocos.result["integral"] - exacto)
    error_muchos = abs(con_muchos.result["integral"] - exacto)
    assert error_muchos < error_pocos
    assert error_muchos < 1e-4


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
    """El tope de 10.000 de la API protege max_iterations, no este n.

    n viaja dentro de params: sin este limite un n = 200_000 entraba al
    bucle y devolvia 200.000 filas. La entrada llega por HTTP y cada fila
    se guarda entera en memoria.
    """
    with pytest.raises(MethodError, match="10000|10.000|maximo|reduce"):
        resolver(
            metodo,
            {"fx": "x", "a": 0, "b": 1, "n": 200000},
        )


def test_la_malla_grande_pero_razonable_sigue_andando(metodo):
    """El tope no puede quedar tan bajo que estorbe un uso legitimo."""
    resultado = resolver(
        metodo,
        {"fx": "x", "a": 0, "b": 1, "n": 10000},
    )

    assert len(resultado.iterations) == 10000
    assert resultado.result["integral"] == pytest.approx(0.5, abs=1e-12)


def test_grafica_es_de_tipo_integracion_con_rectangulos_y_curva(metodo):
    """La grafica lleva la curva de f, un rectangulo por subintervalo y el
    intervalo [a, b] etiquetado. La interfaz los dibuja como cajas
    semitransparentes con la curva encima."""
    resultado = resolver(
        metodo,
        {"fx": "x^2", "a": 0, "b": 1, "n": 4},
    )

    assert resultado.plot is not None
    assert resultado.plot.kind is PlotKind.INTEGRATION

    series = resultado.plot.series
    assert "curve" in series and "rectangles" in series
    assert len(series["rectangles"]) == 4
    assert series["interval"] == {"a": 0.0, "b": 1.0}

    # Cada rectangulo va de x0 a x1 y su altura es f(m_i). Con [0, 1] y n = 4
    # los extremos son 0, 0.25, 0.5, 0.75, 1.0 y las alturas son f de los
    # puntos medios 0.125, 0.375, 0.625, 0.875.
    esperados = [
        (0.0, 0.25, 0.125**2),
        (0.25, 0.5, 0.375**2),
        (0.5, 0.75, 0.625**2),
        (0.75, 1.0, 0.875**2),
    ]
    for obtenido, (x0, x1, y) in zip(series["rectangles"], esperados, strict=True):
        assert obtenido["x0"] == pytest.approx(x0, abs=1e-12)
        assert obtenido["x1"] == pytest.approx(x1, abs=1e-12)
        assert obtenido["y"] == pytest.approx(y, abs=1e-12)


def test_grafica_habilita_remuestreo_sobre_el_intervalo(metodo):
    """El plano interactivo pide puntos nuevos al zoomear, y solo tiene sentido
    sobre el intervalo [a, b] donde vive la integral. Fuera de ahi no hay
    rectangulos que agregar."""
    resultado = resolver(
        metodo,
        {"fx": "sin(x)", "a": 0, "b": math.pi, "n": 6},
    )

    assert resultado.plot.resample is not None
    assert resultado.plot.resample.domain == (0.0, math.pi)


def test_una_funcion_no_evaluable_en_un_punto_medio_falla_con_causa(metodo):
    """log(x) no esta definido en 0 ni en negativos. Con a = 0 el primer punto
    medio es delta_x/2 > 0, asi que ese caso anda; pero si a < 0 la funcion
    se rompe en el primer m_i y el metodo tiene que explicar por que."""
    with pytest.raises(MethodError, match="log|no.*definid|dominio|evaluar"):
        resolver(
            metodo,
            {"fx": "log(x)", "a": -1, "b": 1, "n": 4},
        )
