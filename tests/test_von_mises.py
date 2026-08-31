"""Von Mises: x(i+1) = x(i) - f(x(i)) / f'(x0).

La tabla de VON MISES.pdf es la vara. Si estas pruebas pasan, los numeros del
aplicativo coinciden con los del docente.
"""
from __future__ import annotations

import pytest

from core.config import SolveConfig
from core.expression import parse
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason
from tests.casos_referencia import VON_MISES_EJERCICIO, VON_MISES_EXP_LOG


@pytest.fixture(autouse=True)
def _registro():
    """test_contract vacia el registro, asi que hay que recargarlo con force."""
    clear()
    load_methods(force=True)
    yield
    clear()


def resolver(params: dict, **cfg):
    return get("von-mises").solve(params, SolveConfig(**cfg))


CASO = {"fx": VON_MISES_EXP_LOG["fx"], "x0": VON_MISES_EXP_LOG["x0"]}


# ---------- la tabla del docente ----------

def test_reproduce_la_tabla_del_docente_fila_por_fila():
    resultado = resolver(CASO, max_iterations=3, stop_on_tolerance=False)

    assert len(resultado.iterations) == 3

    for esperada, obtenida in zip(VON_MISES_EXP_LOG["filas"], resultado.iterations):
        contexto = f"fila i={esperada.i}"
        assert obtenida.n == esperada.i, contexto
        assert obtenida.values["xi"] == pytest.approx(esperada.xi, abs=1e-6), contexto
        assert obtenida.values["fxi"] == pytest.approx(esperada.fxi, abs=1e-6), contexto
        assert obtenida.values["xi_sig"] == pytest.approx(
            esperada.xi_siguiente, abs=1e-6
        ), contexto
        if esperada.error_relativo_porcentual is None:
            assert obtenida.error is None, contexto
        else:
            assert obtenida.error == pytest.approx(
                esperada.error_relativo_porcentual, abs=1e-6
            ), contexto


def test_la_derivada_congelada_vale_lo_que_dice_el_docente():
    resultado = resolver(CASO, max_iterations=3, stop_on_tolerance=False)
    esperado = f"{VON_MISES_EXP_LOG['derivada_congelada_en_x0']:.8f}"

    assert any(esperado in nota for nota in resultado.notes), resultado.notes


def test_la_primera_fila_no_lleva_error():
    """x0 es una aproximacion elegida a mano, no una calculada."""
    assert resolver(CASO, max_iterations=3).iterations[0].error is None


# ---------- lo que lo separa de Newton-Raphson ----------

def test_no_termina_siendo_newton_raphson():
    """El error facil de cometer: recalcular la derivada con el x0 actualizado.

    Si eso pasa, el metodo sigue convergiendo y sigue pareciendo correcto, pero
    deja de coincidir con los numeros de clase. La primera fila tiene que ser
    igual en los dos (ahi ambos usan f'(x0)); de la segunda en adelante, no.
    """
    cfg = {"max_iterations": 3, "stop_on_tolerance": False}
    von_mises = resolver(CASO, **cfg)
    newton = get("newton-raphson").solve(CASO, SolveConfig(**cfg))

    assert von_mises.iterations[0].values["xi_sig"] == pytest.approx(
        newton.iterations[0].values["xi_sig"]
    )
    assert von_mises.iterations[1].values["xi_sig"] != pytest.approx(
        newton.iterations[1].values["xi_sig"]
    )


def test_converge_mas_lento_que_newton_raphson():
    """Es el precio de congelar la derivada: convergencia lineal en vez de
    cuadratica."""
    cfg = {"max_iterations": 100, "tolerance": 1e-8}
    von_mises = resolver(CASO, **cfg)
    newton = get("newton-raphson").solve(CASO, SolveConfig(**cfg))

    assert von_mises.converged and newton.converged
    assert len(von_mises.iterations) > len(newton.iterations)


# ---------- el ejercicio propuesto en clase ----------

def test_el_ejercicio_de_la_diapositiva_10_diverge():
    """4x^3 - 18x^2 + 12x - 6 = 0 con x0 = 1.165.

    La unica raiz real esta cerca de 3.82. La derivada congelada vale
    f'(1.165) = -13.65, mientras que en la raiz vale +49.6: el factor de
    amplificacion por iteracion queda en torno a 4.6, muy por encima de 1, asi
    que la sucesion se aleja en vez de acercarse.

    El aplicativo tiene que decirlo con todas las letras, no colgarse ni
    devolver un numero cualquiera como si fuera la raiz.
    """
    resultado = resolver(
        {"fx": VON_MISES_EJERCICIO["fx"], "x0": VON_MISES_EJERCICIO["x0"]},
        max_iterations=200,
    )

    assert resultado.stop_reason is StopReason.DIVERGED
    assert resultado.converged is False
    assert resultado.result["raiz"] is None
    assert any("diverge" in n or "alejo" in n for n in resultado.notes), resultado.notes


def test_newton_raphson_si_resuelve_ese_mismo_ejercicio():
    """Contraste util para el informe: el problema es del metodo, no del enunciado.

    No se compara contra una raiz escrita a mano, que es justamente el tipo de
    numero que uno se equivoca al copiar. Se verifica que f(raiz) sea cero.
    """
    resultado = get("newton-raphson").solve(
        {"fx": VON_MISES_EJERCICIO["fx"], "x0": VON_MISES_EJERCICIO["x0"]},
        SolveConfig(max_iterations=100, tolerance=1e-8),
    )

    assert resultado.converged
    raiz = resultado.result["raiz"]
    assert parse(VON_MISES_EJERCICIO["fx"]).evaluar(x=raiz) == pytest.approx(0.0, abs=1e-6)
    assert 3.8 < raiz < 3.9, f"la unica raiz real esta ahi, y salio {raiz}"


# ---------- fallos con causa explicada ----------

def test_derivada_nula_en_el_punto_inicial():
    with pytest.raises(MethodError, match="se anula en el valor inicial"):
        resolver({"fx": "x^3 - 3x + 3", "x0": 1.0})


def test_falta_la_funcion():
    with pytest.raises(MethodError, match="Hace falta la funcion"):
        resolver({"x0": 1.0})


def test_falta_el_valor_inicial():
    with pytest.raises(MethodError, match="valor inicial"):
        resolver({"fx": "x^2 - 2"})


def test_x0_no_numerico():
    with pytest.raises(MethodError, match="tiene que ser un numero"):
        resolver({"fx": "x^2 - 2", "x0": "dos"})


# ---------- contrato ----------

def test_queda_registrado_sin_registrarlo_a_mano():
    assert "von-mises" in {spec.slug for spec in all_methods()}


def test_respeta_el_n_pedido_sin_parar_por_tolerancia():
    resultado = resolver(CASO, max_iterations=7, stop_on_tolerance=False)

    assert len(resultado.iterations) == 7
    assert resultado.stop_reason is StopReason.MAX_ITERATIONS


def test_para_por_tolerancia_cuando_corresponde():
    resultado = resolver(CASO, max_iterations=100, tolerance=1e-8)

    assert resultado.converged
    assert resultado.stop_reason is StopReason.TOLERANCE
    assert resultado.iterations[-1].error <= 1e-8


def test_los_decimales_pedidos_viajan_en_el_resultado():
    assert resolver(CASO, decimals=3).decimals == 3


def test_acepta_la_derivada_escrita_a_mano():
    """R10: las dos formas tienen que andar."""
    a_mano = resolver(
        {**CASO, "dfx": "-exp(-x) - 1/x"}, max_iterations=3, stop_on_tolerance=False
    )
    sola = resolver(CASO, max_iterations=3, stop_on_tolerance=False)

    assert a_mano.iterations[-1].values["xi_sig"] == pytest.approx(
        sola.iterations[-1].values["xi_sig"]
    )
    assert any("ingresada por el usuario" in n for n in a_mano.notes)


def test_entrega_la_grafica_con_datos_de_remuestreo():
    plot = resolver(CASO, max_iterations=5).plot

    assert plot is not None
    assert plot.kind is PlotKind.FUNCTION_ROOT
    assert plot.resample is not None
    assert set(plot.series) == {"curve", "root", "iterates"}
    assert len(plot.series["iterates"]) == len(resolver(CASO, max_iterations=5).iterations)


def test_la_curva_admite_huecos_donde_la_funcion_no_existe():
    """ln(x) no existe para x <= 0, y el muestreo cruza esa zona."""
    plot = resolver(CASO, max_iterations=5).plot

    assert any(y is None for y in plot.series["curve"]["y"])
