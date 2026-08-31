"""Pruebas de las descargas CSV y PDF."""
from __future__ import annotations

import csv
import io

import pytest
from fastapi.testclient import TestClient

from core.registry import clear, load_methods


VON_MISES_REQUEST = {
    "params": {"fx": "exp(-x) - log(x)", "x0": 1.0, "dfx": None},
    "decimals": 2,
    "max_iterations": 3,
    "tolerance": 1e-6,
    "error_criterion": "relativo_porcentual",
    "stop_on_tolerance": False,
}


@pytest.fixture
def client() -> TestClient:
    from api.main import create_app

    clear()
    load_methods(force=True)
    with TestClient(
        create_app(cargar_metodos=False),
        raise_server_exceptions=False,
    ) as test_client:
        yield test_client
    clear()


def test_csv_descarga_la_tabla_real_completa_y_sin_redondear(client: TestClient):
    response = client.post(
        "/api/methods/von-mises/export/csv",
        json=VON_MISES_REQUEST,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == (
        'attachment; filename="von-mises.csv"'
    )

    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8"))))
    assert rows[0] == ["i", "xi", "fxi", "xi_sig", "error"]
    assert len(rows) == 4
    assert rows[1] == [
        "0",
        "1.0",
        "0.36787944117144233",
        "1.2689414213699952",
        "",
    ]
    assert rows[2][1] == "1.2689414213699952"
    assert rows[2][4] == "2.414455298359258"


def test_pdf_descarga_metodo_parametros_tabla_y_resultado(client: TestClient):
    response = client.post(
        "/api/methods/von-mises/export/pdf",
        json=VON_MISES_REQUEST,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == (
        'attachment; filename="von-mises.pdf"'
    )
    assert response.content.startswith(b"%PDF-")
    assert len(response.content) > 1_000
    assert b"Von Mises" in response.content
    assert b"Parametros" in response.content
    assert b"Resultado" in response.content
    assert b"1.2689414213699952" in response.content


def test_exportar_un_formato_no_admitido_es_422(client: TestClient):
    response = client.post(
        "/api/methods/von-mises/export/json",
        json=VON_MISES_REQUEST,
    )

    assert response.status_code == 422
    assert "csv o pdf" in response.json()["detail"]


def test_exportar_un_metodo_inexistente_es_404(client: TestClient):
    response = client.post(
        "/api/methods/no-existe/export/csv",
        json=VON_MISES_REQUEST,
    )

    assert response.status_code == 404


def test_method_error_al_exportar_conserva_el_mensaje(client: TestClient):
    response = client.post(
        "/api/methods/newton-raphson/export/csv",
        json={
            **VON_MISES_REQUEST,
            "params": {"fx": "x**2 + 1", "x0": 0.0},
        },
    )

    assert response.status_code == 422
    assert "La derivada se anula" in response.json()["detail"]

