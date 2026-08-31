"""Newton-Raphson: x(i+1) = x(i) - f(x(i)) / f'(x(i))."""
from __future__ import annotations

import pytest

from core.config import SolveConfig
from core.errors import ErrorCriterion
from core.registry import all_methods, clear, get, load_methods
from core.types import MethodError, PlotKind, StopReason

# x^3 - 2x - 5 con x0 = 2. El ejemplo con el que Newton presento el metodo.
RAIZ_CLASICA = 2.0945514815423265
CLASICO = {"fx": "x^3 - 2x - 5", "x0": 2.0}


@pytest.fixture(autouse=True)
def _registro():
    clear()
    load_methods(force=True)
    yield
    clear()


def resolver(params: dict, **cfg):
    return get("newton-raphson").solve(params, SolveConfig(**cfg))


# ---------- converge donde debe ----------

def test_encuentra_la_raiz_del_caso_clasico():
    resultado = resolver(CLASICO, tolerance=1e-10)

    assert resultado.converged
    assert resultado.stop_reason in (StopReason.TOLERANCE, StopReason.EXACT)
    assert resultado.result["raiz"] == pytest.approx(RAIZ_CLASICA, abs=1e-9)


def test_converge_en_pocas_iteraciones():
    """Convergencia cuadratica: cerca de la raiz duplica digitos por paso."""
    assert len(resolver(CLASICO, tolerance=1e-10).iterations) < 10


def test_la_tabla_arranca_en_el_valor_inicial():
    primera = resolver(CLASICO, max_iterations=4).iterations[0]

    assert primera.n == 0
    assert primera.values["xi"] == pytest.approx(2.0)
    assert primera.values["fxi"] == pytest.approx(-1.0)
    assert primera.error is None


def test_una_raiz_exacta_se_reporta_como_exacta():
    resultado = resolver({"fx": "x^2 - 4", "x0": 2.0})

    assert resultado.stop_reason is StopReason.EXACT
    assert resultado.converged
    assert resultado.result["raiz"] == pytest.approx(2.0)


# ---------- la derivada ----------

def test_deriva_sola_y_lo_dice():
    """R10: la app deriva sola, y el usuario tiene que ver que derivada uso."""
    notas = resolver(CLASICO, max_iterations=3).notes

    assert any("calculada por el aplicativo" in n for n in notas)
    assert any("3*x**2 - 2" in n for n in notas), notas


def test_la_derivada_a_mano_da_el_mismo_resultado():
    a_mano = resolver({**CLASICO, "dfx": "3x^2 - 2"}, tolerance=1e-10)
    sola = resolver(CLASICO, tolerance=1e-10)

    assert a_mano.result["raiz"] == pytest.approx(sola.result["raiz"], abs=1e-12)
    assert any("ingresada por el usuario" in n for n in a_mano.notes)


def test_derivada_nula_explica_la_causa_y_sugiere_salida():
    """f(x) = x^3 - 3x + 3 tiene f'(1) = 0, y f(1) = 1 no es raiz."""
    with pytest.raises(MethodError) as fallo:
        resolver({"fx": "x^3 - 3x + 3", "x0": 1.0})

    mensaje = str(fallo.value)
    assert "derivada se anula" in mensaje
    assert "Von Mises" in mensaje, "conviene sugerir la alternativa"


# ---------- criterios de error ----------

@pytest.mark.parametrize(
    "criterio",
    [
        ErrorCriterion.ABSOLUTE,
        ErrorCriterion.RELATIVE,
        ErrorCriterion.RELATIVE_PERCENT,
    ],
)
def test_los_tres_criterios_llegan_a_la_misma_raiz(criterio):
    """R11: el criterio es configurable y ninguno cambia la respuesta."""
    resultado = resolver(CLASICO, error_criterion=criterio, tolerance=1e-10)

    assert resultado.result["raiz"] == pytest.approx(RAIZ_CLASICA, abs=1e-8)


def test_el_error_porcentual_es_cien_veces_el_relativo():
    comun = {"max_iterations": 3, "stop_on_tolerance": False}
    relativo = resolver(CLASICO, error_criterion=ErrorCriterion.RELATIVE, **comun)
    porcentual = resolver(
        CLASICO, error_criterion=ErrorCriterion.RELATIVE_PERCENT, **comun
    )

    assert porcentual.iterations[1].error == pytest.approx(
        relativo.iterations[1].error * 100
    )


# ---------- entrada invalida ----------

def test_falta_la_funcion():
    with pytest.raises(MethodError, match="Hace falta la funcion"):
        resolver({"x0": 1.0})


def test_funcion_sin_sentido():
    with pytest.raises(MethodError):
        resolver({"fx": "x +* 2", "x0": 1.0})


def test_punto_inicial_fuera_del_dominio():
    with pytest.raises(MethodError, match="no esta definida|fuera del dominio"):
        resolver({"fx": "log(x)", "x0": -1.0})


# ---------- contrato ----------

def test_queda_registrado_sin_registrarlo_a_mano():
    assert "newton-raphson" in {spec.slug for spec in all_methods()}


def test_declara_sus_campos_de_entrada():
    campos = {campo.name for campo in get("newton-raphson").inputs}

    assert campos == {"fx", "x0", "dfx"}
    assert next(c for c in get("newton-raphson").inputs if c.name == "dfx").required is False


def test_las_columnas_son_las_de_la_tabla_del_docente():
    columnas = [c.key for c in resolver(CLASICO, max_iterations=3).columns]

    assert columnas == ["xi", "fxi", "xi_sig"]


def test_respeta_el_n_pedido_sin_parar_por_tolerancia():
    """R5: se puede pedir el calculo hasta cualquier iteracion n."""
    resultado = resolver(CLASICO, max_iterations=6, stop_on_tolerance=False)

    assert len(resultado.iterations) == 6
    assert resultado.stop_reason is StopReason.MAX_ITERATIONS


def test_entrega_la_grafica_con_datos_de_remuestreo():
    plot = resolver(CLASICO, max_iterations=5).plot

    assert plot.kind is PlotKind.FUNCTION_ROOT
    assert plot.resample is not None
    assert plot.resample.expression == "x**3 - 2*x - 5"
    assert plot.series["root"]["x"] == pytest.approx(RAIZ_CLASICA, abs=1e-6)
