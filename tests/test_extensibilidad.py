"""R3: agregar un metodo tiene que ser crear un archivo, y nada mas.

El README lo promete y `docs/ESPECIFICACION.md` lo declara como requisito,
porque el docente pidio unos diez metodos a lo largo del semestre y solo cuatro
entran en el primer parcial. Una promesa de arquitectura que nadie ejercita es
una promesa que se descubre falsa el dia que hace falta.

Esta prueba escribe un metodo de juguete dentro de `core/methods/`, recarga el
registro y verifica que el aplicativo entero lo tome: el registro, la API y los
campos que la interfaz usa para dibujar el formulario. Despues borra el archivo.

Es a proposito que use el disco en vez de registrar el `MethodSpec` a mano:
registrarlo a mano probaria que el registro funciona, que ya se sabe. Lo que
esta en duda es el auto-descubrimiento del paquete, que es el mecanismo que
convierte "crear un archivo" en "el metodo aparece".
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.registry import all_methods, clear, get, load_methods

METHODS_DIR = Path(__file__).resolve().parents[1] / "core" / "methods"
SLUG = "metodo-de-juguete"

FUENTE = '''"""Metodo de juguete que solo existe mientras corre una prueba."""
from __future__ import annotations

from typing import Any

from core.config import SolveConfig
from core.registry import register
from core.types import (
    Column,
    FieldKind,
    InputField,
    Iteration,
    MethodResult,
    MethodSpec,
    StopReason,
)


def solve(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    inicial = float(params["semilla"])
    filas = [
        Iteration(n=paso, values={"valor": inicial / (2**paso)}, error=None)
        for paso in range(config.max_iterations)
    ]
    return MethodResult(
        method="metodo-de-juguete",
        columns=[Column("valor", "valor")],
        iterations=filas,
        result={"valor": filas[-1].values["valor"]},
        converged=True,
        stop_reason=StopReason.COMPLETED,
        decimals=config.decimals,
    )


register(
    MethodSpec(
        slug="metodo-de-juguete",
        name="Metodo de juguete",
        unit="U9",
        family="prueba",
        inputs=[
            InputField(
                name="semilla",
                label="Semilla",
                kind=FieldKind.NUMBER,
                default=1.0,
            )
        ],
        solve=solve,
        description="Divide la semilla a la mitad en cada paso.",
    )
)
'''


@pytest.fixture
def metodo_recien_agregado():
    """Deja un archivo nuevo en core/methods/ y lo retira al terminar."""
    archivo = METHODS_DIR / "juguete_de_prueba.py"
    io.open(archivo, "w", encoding="utf-8", newline="\n").write(FUENTE)
    clear()
    load_methods(force=True)
    try:
        yield
    finally:
        archivo.unlink(missing_ok=True)
        clear()
        load_methods(force=True)


def test_un_archivo_nuevo_en_core_methods_basta_para_registrar_el_metodo(
    metodo_recien_agregado,
):
    assert SLUG in {spec.slug for spec in all_methods()}
    assert get(SLUG).name == "Metodo de juguete"


def test_la_api_lo_publica_con_sus_campos_sin_tocar_ningun_archivo(
    metodo_recien_agregado,
):
    """La interfaz dibuja el formulario desde estos campos: si no viajan, el
    metodo existe en el nucleo y es inalcanzable desde la pantalla."""
    from api import main

    with TestClient(main.create_app(cargar_metodos=False)) as client:
        listado = client.get("/api/methods")
        detalle = client.get(f"/api/methods/{SLUG}")
        corrida = client.post(
            f"/api/methods/{SLUG}/solve",
            json={"params": {"semilla": 8.0}, "max_iterations": 4},
        )

    assert SLUG in {m["slug"] for m in listado.json()}

    campos = detalle.json()["inputs"]
    assert [c["name"] for c in campos] == ["semilla"]
    assert campos[0]["kind"] == "number"

    assert corrida.status_code == 200, corrida.text
    assert len(corrida.json()["iterations"]) == 4
    assert corrida.json()["result"]["valor"] == pytest.approx(1.0)


def test_los_cuatro_metodos_del_parcial_siguen_estando(metodo_recien_agregado):
    """El quinto metodo no puede desplazar a los del primer parcial.

    Antes esto se verificaba con una igualdad exacta contra los cuatro slugs,
    que convertia agregar el quinto metodo en romper una prueba: justo lo que
    la arquitectura promete que no pasa.
    """
    slugs = {spec.slug for spec in all_methods()}

    assert {
        "newton-raphson",
        "von-mises",
        "interpolacion-newton",
        "runge-kutta",
    } <= slugs
