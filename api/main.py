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

    @application.middleware("http")
    async def sin_cache_para_estaticos(request: Request, call_next):
        """Obliga al navegador a revalidar los archivos de web/.

        Sin esto, el navegador se queda con la version que tenga en cache y
        editar un .js no cambia nada en pantalla, que es de las cosas mas
        confusas que hay al desarrollar. `no-cache` no impide cachear: obliga a
        preguntar antes de usar, asi que las respuestas siguen siendo 304 y no
        se transfiere nada de mas.
        """
        respuesta = await call_next(request)
        if not request.url.path.startswith("/api"):
            respuesta.headers["Cache-Control"] = "no-cache"
        return respuesta

    # La interfaz no es opcional: sin ella el aplicativo es una API que nadie
    # va a usar a mano en una demostracion. Si falta, hay que decirlo al
    # arrancar. Antes se montaba con check_dir=False, que dejaba levantar el
    # servidor igual y servir una pantalla en blanco sin explicar nada; ese
    # permiso existia solo mientras la interfaz la escribia otro carril.
    if not WEB_DIR.is_dir():
        raise RuntimeError(
            f"No se encuentra la carpeta web/ en {WEB_DIR}. El aplicativo se "
            "ejecuta desde una copia del repositorio: revisa la guia de "
            "instalacion del README."
        )

    # Se monta al final para que /api conserve prioridad.
    application.mount(
        "/",
        StaticFiles(directory=str(WEB_DIR), html=True),
        name="web",
    )
    return application


app = create_app()


__all__ = ["app", "create_app"]

