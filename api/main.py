"""Aplicacion FastAPI y servidor de la interfaz local."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from api.routes import router
from core import registry

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = PROJECT_ROOT / "web"

logger = logging.getLogger(__name__)


def create_app(cargar_metodos: bool = True) -> FastAPI:
    """Construye la aplicacion; las pruebas pueden aportar su propio registro."""
    if cargar_metodos:
        registry.load_methods(force=True)

    application = FastAPI(title="Metodos Numericos UTA")
    application.include_router(router)

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Error inesperado atendiendo %s %s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor."},
        )

    # Se monta al final para que /api conserve prioridad. check_dir=False hace
    # que la app pueda construirse aunque el otro carril aun no haya creado web/.
    application.mount(
        "/",
        StaticFiles(directory=str(WEB_DIR), html=True, check_dir=False),
        name="web",
    )
    return application


app = create_app()


__all__ = ["app", "create_app"]

