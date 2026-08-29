"""Pruebas del parser de expresiones. Parte del contrato congelado."""
from __future__ import annotations

import math

import pytest

from core.expression import parse
from core.types import MethodError


# ---------- parseo ----------

def test_parsea_una_expresion_simple():
    f = parse("x**3 - 2*x - 5")
    assert f.evaluar(x=2.0) == pytest.approx(-1.0)


def test_acepta_circunflejo_como_potencia():
    """En clase se escribe x^3, no x**3."""
    assert parse("x^3").evaluar(x=2.0) == pytest.approx(8.0)


def test_acepta_multiplicacion_implicita():
    """2x se entiende como 2*x."""
    assert parse("2x + 1").evaluar(x=3.0) == pytest.approx(7.0)


def test_ln_y_log_son_la_misma_funcion():
    """El docente escribe ln(x); en Python se llama log."""
    assert parse("ln(x)").evaluar(x=math.e) == pytest.approx(1.0)
    assert parse("log(x)").evaluar(x=math.e) == pytest.approx(1.0)


def test_el_caso_del_docente():
    """f(x) = e^-x - ln(x) evaluada en 1, de VON MISES.pdf."""
    f = parse("exp(-x) - log(x)")
    assert f.evaluar(x=1.0) == pytest.approx(0.36787944, abs=1e-8)


def test_expresion_de_dos_variables_para_runge_kutta():
    f = parse("x + y", variables=("x", "y"))
    assert f.evaluar(x=1.0, y=2.0) == pytest.approx(3.0)


def test_sistema_con_varias_incognitas():
    f = parse("y1 + 2*y2", variables=("x", "y1", "y2"))
    assert f.evaluar(x=0.0, y1=1.0, y2=3.0) == pytest.approx(7.0)


# ---------- lista blanca ----------

def test_rechaza_una_variable_que_no_se_declaro():
    with pytest.raises(MethodError, match="z"):
        parse("x + z")


def test_rechaza_una_funcion_que_no_esta_permitida():
    with pytest.raises(MethodError):
        parse("gamma(x)")


@pytest.mark.parametrize(
    "entrada",
    ["__import__('os')", "lambda x: x", "eval('1+1')", "open('f')"],
)
def test_rechaza_texto_que_no_es_matematica(entrada):
    with pytest.raises(MethodError):
        parse(entrada)


def test_rechaza_expresion_vacia():
    with pytest.raises(MethodError, match="vacia"):
        parse("   ")


def test_rechaza_sintaxis_rota_con_un_mensaje_util():
    with pytest.raises(MethodError, match="parentesis"):
        parse("x**(2")


# ---------- derivada ----------

def test_deriva_sola():
    assert parse("x**3").derivada().evaluar(x=2.0) == pytest.approx(12.0)


def test_la_derivada_se_puede_mostrar_como_texto():
    """R10: la app deriva sola, pero el usuario tiene que ver que derivada uso."""
    assert str(parse("x**2").derivada()) == "2*x"


def test_derivada_del_caso_del_docente():
    """f(x) = e^-x - ln(x)  ->  f'(1) = -1.36787944"""
    derivada = parse("exp(-x) - log(x)").derivada()
    assert derivada.evaluar(x=1.0) == pytest.approx(-1.36787944, abs=1e-8)


def test_no_deriva_respecto_de_una_variable_ajena():
    with pytest.raises(MethodError, match="no aparece"):
        parse("x**2").derivada(respecto="y")


# ---------- dominio ----------

def test_fuera_del_dominio_falla_con_causa_explicada():
    with pytest.raises(MethodError, match="no esta definida|fuera del dominio"):
        parse("log(x)").evaluar(x=-1.0)


def test_division_entre_cero_falla_con_causa_explicada():
    with pytest.raises(MethodError, match="division entre cero|no esta definida"):
        parse("1/x").evaluar(x=0.0)


def test_falta_una_variable():
    with pytest.raises(MethodError, match="Falta el valor"):
        parse("x + y", variables=("x", "y")).evaluar(x=1.0)


def test_evaluar_seguro_devuelve_none_en_vez_de_fallar():
    """Para graficar: un punto fuera del dominio no puede tumbar la curva."""
    f = parse("log(x)")
    assert f.evaluar_seguro(x=-1.0) is None
    assert f.evaluar_seguro(x=1.0) == pytest.approx(0.0)
