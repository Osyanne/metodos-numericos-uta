"""Lo que se muestra se lee como en el pizarron, no en sintaxis de Python.

`result` guarda las expresiones en la sintaxis del parser (se vuelven a leer
para muestrear y en las pruebas); `notes` y `display` son solo para mostrar.
"""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from core.expression import parse

CASOS = [
    ("sqrt(x^3 + 5)", "√(x³ + 5)"),
    ("0.2 + 25*x - 200*x^2 + 675*x^3 - 900*x^4 + 400*x^5",
     "400x⁵ − 900x⁴ + 675x³ − 200x² + 25x + 0.2"),
    ("exp(-x^2)", "e^(−x²)"),
    ("x*sin(x)", "x·sin(x)"),
    ("2*sin(x)", "2 sin(x)"),
    ("log(x)", "ln(x)"),
    ("abs(x)", "|x|"),
    ("x^(1/3)", "x^(1/3)"),
    ("x^-2", "1/x²"),
    ("1/(2*x)", "1/(2x)"),
    ("(x+1)/(x-1)", "(x + 1)/(x − 1)"),
    ("sqrt(1-x^2)/2", "√(1 − x²)/2"),
    ("-exp(-x) - 1/x", "−e^(−x) − 1/x"),
    ("-2.5*x^2 + 4.5*x + 1", "−2.5x² + 4.5x + 1"),
    ("2*pi*x", "2πx"),
    ("1e-5*x", "1×10⁻⁵·x"),
]


@pytest.fixture(scope="module")
def cliente() -> TestClient:
    # Otras pruebas vacian el registro: se cargan los metodos reales otra vez.
    return TestClient(create_app(cargar_metodos=True))


@pytest.mark.parametrize(("texto", "esperado"), CASOS)
def test_se_escribe_como_en_el_pizarron(texto, esperado):
    assert parse(texto).legible == esperado


def test_lo_que_se_vuelve_a_parsear_no_cambia():
    assert parse("sqrt(x^3 + 5)").texto == "sqrt(x**3 + 5)"


PUNTOS = [[1, 2], [2, 3.5], [4, 3]]
EJERCICIOS = [
    ("newton-raphson", {"fx": "x^3 - 2x - 5", "x0": 2}),
    ("von-mises", {"fx": "exp(-x) - ln(x)", "x0": 1}),
    ("interpolacion-newton", {"points": PUNTOS, "x": 3}),
    ("interpolacion-lagrange", {"points": PUNTOS, "x": 3}),
    ("punto-medio", {"fx": "0.25*x^3 - x", "a": -1.5, "b": 2, "n": 7}),
    ("trapecio", {"fx": "exp(x^4)", "a": -1, "b": 1, "n": 5}),
    ("simpson", {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 4}),
    ("simpson-13", {"fx": "exp(x^2)", "a": 0, "b": 1, "n": 10}),
    ("simpson-38", {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 6}),
    ("minimos-cuadrados", {"points": PUNTOS, "modelo": "lineal"}),
    ("minimos-cuadrados", {"points": PUNTOS, "modelo": "exponencial"}),
]
SINTAXIS_DE_PYTHON = re.compile(r"\*|\bsqrt\(|\bexp\(|\blog\(|\blog10\(|\bAbs\(")


@pytest.mark.parametrize(("slug", "params"), EJERCICIOS)
def test_el_resumen_no_muestra_sintaxis_de_python(cliente, slug, params):
    respuesta = cliente.post(f"/api/methods/{slug}/solve", json={"params": params})
    assert respuesta.status_code == 200, respuesta.text
    datos = respuesta.json()

    for nota in datos["notes"]:
        assert not SINTAXIS_DE_PYTHON.search(nota), nota
    for clave, texto in datos["display"].items():
        assert clave in datos["result"]
        assert not SINTAXIS_DE_PYTHON.search(texto), texto
    # Toda expresion de `result` que la interfaz mostraria tiene su version legible.
    for clave, valor in datos["result"].items():
        if isinstance(valor, str) and SINTAXIS_DE_PYTHON.search(valor):
            assert clave in datos["display"], clave


def test_la_nota_de_la_integral_lleva_la_raiz(cliente):
    datos = cliente.post(
        "/api/methods/simpson-38/solve",
        json={"params": {"fx": "sqrt(5 + x^3)", "a": 0, "b": 1, "n": 6}},
    ).json()
    assert datos["notes"][0].startswith("∫[0, 1] (√(x³ + 5)) dx ≈ 2.290")


def test_la_forma_de_newton_conserva_el_orden_del_pizarron(cliente):
    datos = cliente.post(
        "/api/methods/interpolacion-newton/solve",
        json={"params": {"points": [[1, 0], [4, 1.386294], [6, 1.791759]], "x": 2}},
    ).json()
    assert datos["result"]["polinomio_newton"].startswith("0 + 0.462098*(x - 1) + (-0.0518731)*(x - 1)*(x - 4)")
    assert datos["display"]["polinomio_newton"].startswith("0 + 0.462098(x − 1) + (−0.0518731)(x − 1)(x − 4)")
