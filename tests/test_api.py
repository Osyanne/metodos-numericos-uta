"""Pruebas de contrato para la capa HTTP."""
from __future__ import annotations

import json
import math
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from core.config import SolveConfig
from core.registry import all_methods, clear, load_methods, register
from core.types import (
    Column,
    FieldKind,
    InputField,
    Iteration,
    MethodError,
    MethodResult,
    MethodSpec,
    PlotKind,
    PlotSpec,
    Resample,
    StopReason,
)


def _resultado_normal(params: dict[str, Any], config: SolveConfig) -> MethodResult:
    return MethodResult(
        method="demo",
        columns=[Column("x", "x"), Column("fx", "f(x)")],
        iterations=[
            Iteration(0, {"x": 1.234567890123, "fx": -0.5}, None),
            Iteration(1, {"x": 1.5, "fx": 0.25}, 17.68707482991496),
        ],
        result={
            "valor": 1.234567890123,
            "params": params,
            "config": {
                "max_iterations": config.max_iterations,
                "tolerance": config.tolerance,
                "error_criterion": config.error_criterion.value,
                "stop_on_tolerance": config.stop_on_tolerance,
            },
        },
        converged=True,
        stop_reason=StopReason.TOLERANCE,
        decimals=config.decimals,
        plot=PlotSpec(
            kind=PlotKind.FUNCTION_ROOT,
            series={
                "curve": {"x": [1.0, 2.0], "y": [-1.0, 1.0]},
                "root": {"x": 1.5, "y": 0.0},
                "iterates": [{"n": 0, "x": 1.234567890123, "y": -0.5}],
            },
            title="Grafica de prueba",
            resample=Resample("x**2 - 2", domain=(0.0, 2.0)),
        ),
        notes=["Nota de prueba"],
    )


def _spec(
    slug: str = "demo",
    solve: Callable[[dict[str, Any], SolveConfig], MethodResult] = _resultado_normal,
) -> MethodSpec:
    return MethodSpec(
        slug=slug,
        name="Metodo Demo",
        unit="U1",
        family="prueba",
        inputs=[
            InputField(
                "x0",
                "Valor inicial",
                FieldKind.NUMBER,
                default=1.0,
                help="Punto de partida.",
            ),
            InputField(
                "opcional",
                "Dato opcional",
                FieldKind.EXPRESSION,
                required=False,
                multiple=True,
            ),
        ],
        solve=solve,
        description="Metodo usado para probar la API.",
    )


@pytest.fixture(autouse=True)
def _registro_limpio():
    clear()
    yield
    clear()


@pytest.fixture
def client() -> TestClient:
    from api.main import create_app

    # La primera importacion de api.main construye la app de produccion y carga
    # metodos reales. La app aislada de esta prueba parte solo del metodo falso.
    clear()
    register(_spec())
    with TestClient(
        create_app(cargar_metodos=False),
        raise_server_exceptions=False,
    ) as test_client:
        yield test_client


def test_lista_metodos_con_inputs_sin_conocer_el_metodo(client: TestClient):
    response = client.get("/api/methods")

    assert response.status_code == 200
    assert response.json() == [
        {
            "slug": "demo",
            "name": "Metodo Demo",
            "unit": "U1",
            "family": "prueba",
            "description": "Metodo usado para probar la API.",
            "inputs": [
                {
                    "name": "x0",
                    "label": "Valor inicial",
                    "kind": "number",
                    "default": 1.0,
                    "help": "Punto de partida.",
                    "required": True,
                    "multiple": False,
                },
                {
                    "name": "opcional",
                    "label": "Dato opcional",
                    "kind": "expression",
                    "default": None,
                    "help": "",
                    "required": False,
                    "multiple": True,
                },
            ],
        }
    ]


def test_detalle_de_metodo(client: TestClient):
    response = client.get("/api/methods/demo")

    assert response.status_code == 200
    assert response.json()["slug"] == "demo"
    assert [field["name"] for field in response.json()["inputs"]] == [
        "x0",
        "opcional",
    ]


def test_metodo_inexistente_es_404(client: TestClient):
    response = client.get("/api/methods/no-existe")

    assert response.status_code == 404
    assert "no-existe" in response.json()["detail"]


def test_solve_traduce_el_body_a_config_y_no_redondea(client: TestClient):
    response = client.post(
        "/api/methods/demo/solve",
        json={
            "params": {"x0": 7.25},
            "decimals": 2,
            "max_iterations": 7,
            "tolerance": 0.125,
            "error_criterion": "absoluto",
            "stop_on_tolerance": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decimals"] == 2
    assert body["iterations"][0]["values"]["x"] == 1.234567890123
    assert body["result"]["valor"] == 1.234567890123
    assert body["result"]["params"] == {"x0": 7.25}
    assert body["result"]["config"] == {
        "max_iterations": 7,
        "tolerance": 0.125,
        "error_criterion": "absoluto",
        "stop_on_tolerance": False,
    }
    assert body["plot"]["resample"] == {
        "expression": "x**2 - 2",
        "variables": ["x"],
        "domain": [0.0, 2.0],
    }


def test_solve_convierte_infinity_y_nan_a_null_en_toda_la_respuesta(
    client: TestClient,
):
    def solve_no_finito(params: dict[str, Any], config: SolveConfig) -> MethodResult:
        return MethodResult(
            method="no-finito",
            columns=[Column("x", "x")],
            iterations=[Iteration(0, {"x": math.inf}, math.nan)],
            result={
                "positivo": math.inf,
                "negativo": -math.inf,
                "anidado": [math.nan, {"finito": 3.25}],
            },
            converged=False,
            stop_reason=StopReason.DIVERGED,
            decimals=config.decimals,
            plot=PlotSpec(
                PlotKind.FUNCTION_ROOT,
                {"n": [0, 1], "error": [math.inf, math.nan]},
                resample=Resample("x", domain=(0.0, math.inf)),
            ),
        )

    register(_spec("no-finito", solve_no_finito))

    response = client.post(
        "/api/methods/no-finito/solve",
        json={"params": {}},
    )

    assert response.status_code == 200
    assert "Infinity" not in response.text
    assert "NaN" not in response.text
    body = json.loads(
        response.text,
        parse_constant=lambda token: pytest.fail(f"JSON no valido: {token}"),
    )
    assert body["iterations"][0] == {
        "n": 0,
        "values": {"x": None},
        "error": None,
    }
    assert body["result"] == {
        "positivo": None,
        "negativo": None,
        "anidado": [None, {"finito": 3.25}],
    }
    assert body["plot"]["series"]["error"] == [None, None]
    assert body["plot"]["resample"]["domain"] is None


def test_method_error_es_422_con_el_mensaje_intacto(client: TestClient):
    mensaje = "La derivada se anula en x = 1.0, el metodo no puede continuar."

    def solve_con_error(
        params: dict[str, Any], config: SolveConfig
    ) -> MethodResult:
        raise MethodError(mensaje)

    register(_spec("error-matematico", solve_con_error))

    response = client.post(
        "/api/methods/error-matematico/solve",
        json={"params": {}},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": mensaje}


def test_un_error_inesperado_es_500_sin_filtrar_detalles(client: TestClient):
    secreto = "detalle-interno-que-no-debe-salir"

    def solve_con_bug(params: dict[str, Any], config: SolveConfig) -> MethodResult:
        raise RuntimeError(secreto)

    register(_spec("bug", solve_con_bug))

    response = client.post("/api/methods/bug/solve", json={"params": {}})

    assert response.status_code == 500
    assert response.json() == {"detail": "Error interno del servidor."}
    assert secreto not in response.text


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"params": {}, "decimals": 1},
        {"params": {}, "decimals": 13},
        {"params": {}, "max_iterations": 0},
        {"params": {}, "tolerance": -1},
        {"params": {}, "error_criterion": "inventado"},
    ],
)
def test_solve_rechaza_un_body_invalido(client: TestClient, body: dict[str, Any]):
    response = client.post("/api/methods/demo/solve", json=body)

    assert response.status_code == 422


def test_sample_delega_al_nucleo_y_conserva_los_cortes(client: TestClient):
    response = client.post(
        "/api/plot/sample",
        json={
            "expression": "1/x",
            "variables": ["x"],
            "x_min": -1.0,
            "x_max": 1.0,
            "points": 3,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"x": [-1.0, 0.0, 1.0], "y": [-1.0, None, 1.0]}


def test_sample_convierte_method_error_en_422(client: TestClient):
    response = client.post(
        "/api/plot/sample",
        json={"expression": "x", "x_min": 2.0, "x_max": 1.0, "points": 10},
    )

    assert response.status_code == 422
    assert "invertido o es vacio" in response.json()["detail"]


def test_sample_valida_el_limite_de_puntos_antes_de_calcular(client: TestClient):
    response = client.post(
        "/api/plot/sample",
        json={"expression": "x", "x_min": 0.0, "x_max": 1.0, "points": 5001},
    )

    assert response.status_code == 422


def test_sample_rechaza_una_lista_de_variables_que_no_define_un_eje(
    client: TestClient,
):
    response = client.post(
        "/api/plot/sample",
        json={
            "expression": "x",
            "variables": [],
            "x_min": 0.0,
            "x_max": 1.0,
            "points": 10,
        },
    )

    assert response.status_code == 422
    assert "una variable" in response.json()["detail"]


def test_sample_rechaza_un_rango_finito_cuyo_ancho_se_desborda(client: TestClient):
    response = client.post(
        "/api/plot/sample",
        json={
            "expression": "x",
            "x_min": -1e308,
            "x_max": 1e308,
            "points": 10,
        },
    )

    assert response.status_code == 422
    assert "rango" in response.json()["detail"]


def test_create_app_carga_los_metodos_reales_cuando_se_solicita():
    from api.main import create_app

    create_app(cargar_metodos=True)

    assert {method.slug for method in all_methods()} == {
        "newton-raphson",
        "von-mises",
        "interpolacion-newton",
        "runge-kutta",
    }


def test_app_se_construye_aunque_web_aun_no_exista(
    monkeypatch: pytest.MonkeyPatch,
):
    from api import main

    web_ausente = Path(__file__).resolve().parent / "directorio-web-inexistente"
    assert not web_ausente.exists()
    monkeypatch.setattr(main, "WEB_DIR", web_ausente)

    application = main.create_app(cargar_metodos=False)

    assert application is not None


def test_raiz_y_archivos_estaticos_salen_de_web(
    monkeypatch: pytest.MonkeyPatch,
):
    from api import main

    # Usa un directorio existente y de solo lectura: StaticFiles es quien
    # resuelve tanto la ruta raiz como cualquier archivo que luego deje web/.
    api_dir = Path(__file__).resolve().parents[1] / "api"
    monkeypatch.setattr(main, "WEB_DIR", api_dir)

    with TestClient(main.create_app(cargar_metodos=False)) as test_client:
        root = test_client.get("/")
        static_file = test_client.get("/schemas.py")
        api_response = test_client.get("/api/methods")

    assert root.status_code == 404  # no hay index.html en el directorio de prueba
    assert static_file.status_code == 200
    assert "class SolveRequest" in static_file.text
    assert api_response.status_code == 200
