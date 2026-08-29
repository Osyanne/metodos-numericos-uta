"""Pruebas del contrato congelado.

Si algo de aca se pone rojo, los dos carriles estan rotos, no uno.
"""
from __future__ import annotations

import math

import pytest

from core.config import SolveConfig
from core.errors import ErrorCriterion, approx_error, true_error, within_tolerance
from core.precision import (
    DEFAULT_DECIMALS,
    MAX_DECIMALS,
    MIN_DECIMALS,
    clamp_decimals,
    format_value,
    round_value,
)
from core.registry import all_methods, clear, get, register
from core.types import Column, FieldKind, InputField, MethodSpec, StopReason


# ---------- precision ----------

def test_decimales_por_defecto_son_seis():
    assert DEFAULT_DECIMALS == 6


def test_decimales_se_recortan_al_rango_permitido():
    assert clamp_decimals(0) == MIN_DECIMALS
    assert clamp_decimals(99) == MAX_DECIMALS
    assert clamp_decimals(None) == DEFAULT_DECIMALS
    assert clamp_decimals(4) == 4


def test_formato_rellena_con_ceros_hasta_los_decimales_pedidos():
    assert format_value(1.5, 6) == "1.500000"
    assert format_value(1.5, 2) == "1.50"


def test_redondeo_no_revienta_con_infinito_ni_nan():
    assert round_value(float("inf"), 6) == float("inf")
    assert math.isnan(round_value(float("nan"), 6))


# ---------- criterios de error ----------

def test_primera_iteracion_no_tiene_error():
    assert approx_error(1.0, None) is None
    assert within_tolerance(None, 1.0) is False


def test_error_relativo_porcentual():
    # de 2.0 a 2.5: |0.5 / 2.5| * 100 = 20 %
    assert approx_error(2.5, 2.0, ErrorCriterion.RELATIVE_PERCENT) == pytest.approx(20.0)


def test_error_absoluto_y_relativo():
    assert approx_error(2.5, 2.0, ErrorCriterion.ABSOLUTE) == pytest.approx(0.5)
    assert approx_error(2.5, 2.0, ErrorCriterion.RELATIVE) == pytest.approx(0.2)


def test_error_verdadero_contra_valor_exacto():
    assert true_error(3.1, 3.0, ErrorCriterion.ABSOLUTE) == pytest.approx(0.1)


def test_division_por_cero_da_infinito_no_excepcion():
    assert approx_error(0.0, 1.0, ErrorCriterion.RELATIVE) == float("inf")


# ---------- configuracion ----------

def test_config_recorta_decimales_invalidos():
    assert SolveConfig(decimals=99).decimals == MAX_DECIMALS


def test_config_rechaza_n_invalido():
    with pytest.raises(ValueError):
        SolveConfig(max_iterations=0)


def test_config_permite_correr_n_exacto_sin_parar_por_tolerancia():
    cfg = SolveConfig(max_iterations=7, stop_on_tolerance=False)
    assert cfg.max_iterations == 7
    assert cfg.stop_on_tolerance is False


# ---------- registro ----------

@pytest.fixture
def registro_limpio():
    clear()
    yield
    clear()


def _spec(slug: str = "demo") -> MethodSpec:
    return MethodSpec(
        slug=slug,
        name="Demo",
        unit="U1",
        family="raices",
        inputs=[InputField("fx", "f(x)", FieldKind.EXPRESSION)],
        solve=lambda params, cfg: None,
    )


def test_registrar_y_recuperar(registro_limpio):
    register(_spec())
    assert get("demo").name == "Demo"


def test_no_se_puede_registrar_dos_veces_el_mismo_slug(registro_limpio):
    register(_spec())
    with pytest.raises(ValueError):
        register(_spec())


def test_metodo_inexistente_lista_los_disponibles(registro_limpio):
    register(_spec("newton-raphson"))
    with pytest.raises(KeyError, match="newton-raphson"):
        get("no-existe")


def test_los_metodos_salen_ordenados_por_unidad(registro_limpio):
    register(_spec("b"))
    register(MethodSpec("a", "A", "U3", "edo", [], lambda p, c: None))
    assert [s.slug for s in all_methods()] == ["b", "a"]


# ---------- tipos ----------

def test_columna_y_motivo_de_parada_son_serializables():
    assert Column("xi", "xi").numeric is True
    assert StopReason.TOLERANCE.value == "tolerancia_alcanzada"
