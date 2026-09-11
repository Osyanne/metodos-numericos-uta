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


LAGRANGE_REQUEST = {
    "params": {"points": [[0.0, 1.0], [1.0, 3.0], [2.0, 0.0]], "x": 1.5},
    "decimals": 2,
    "max_iterations": 50,
    "tolerance": 1e-6,
    "error_criterion": "relativo_porcentual",
    "stop_on_tolerance": True,
}


def test_csv_exporta_las_celdas_de_texto_tal_cual(client: TestClient):
    """Las columnas con numeric=False llevan expresiones, no mediciones.

    Antes salian vacias: la celda pasaba por la conversion a float y volvia
    como None. Una tabla de Lagrange exportada no mostraba ningun L_i.
    """
    response = client.post(
        "/api/methods/interpolacion-lagrange/export/csv",
        json=LAGRANGE_REQUEST,
    )

    assert response.status_code == 200, response.text
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8"))))

    assert rows[0] == [
        "i", "xi", "yi", "numerador", "denominador", "Li", "termino",
        "Li_evaluado", "error",
    ]
    assert rows[1][3] == "(x - 1)*(x - 2)"
    assert rows[1][4] == "(0 - 1)*(0 - 2)"
    assert rows[1][5] != ""
    # Y las numericas siguen sin redondear pese a decimals=2.
    # L_0(1.5) = (0.5)(-0.5)/2 = -0.125
    assert rows[1][1] == "0.0"
    assert rows[1][7] == "-0.125"


def test_pdf_exporta_las_celdas_de_texto(client: TestClient):
    response = client.post(
        "/api/methods/interpolacion-lagrange/export/pdf",
        json=LAGRANGE_REQUEST,
    )

    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF-")
    # En un PDF los parentesis delimitan las cadenas, asi que los del texto
    # viajan escapados. Buscarlos sin escapar da un falso negativo.
    assert rb"\(x - 1\)*\(x - 2\)" in response.content


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

