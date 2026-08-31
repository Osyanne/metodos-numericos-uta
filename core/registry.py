"""Registro de metodos. Punto unico de extension del aplicativo."""
from __future__ import annotations

import importlib
import sys

from core.types import MethodSpec

_REGISTRY: dict[str, MethodSpec] = {}


def register(spec: MethodSpec) -> MethodSpec:
    if spec.slug in _REGISTRY:
        raise ValueError(f"El metodo '{spec.slug}' ya esta registrado")
    _REGISTRY[spec.slug] = spec
    return spec


def get(slug: str) -> MethodSpec:
    try:
        return _REGISTRY[slug]
    except KeyError:
        disponibles = ", ".join(sorted(_REGISTRY)) or "ninguno"
        raise KeyError(
            f"No existe el metodo '{slug}'. Disponibles: {disponibles}"
        ) from None


def all_methods() -> list[MethodSpec]:
    return sorted(_REGISTRY.values(), key=lambda s: (s.unit, s.name))


def clear() -> None:
    """Vacia el registro. Solo para pruebas."""
    _REGISTRY.clear()


def load_methods(*, force: bool = False) -> None:
    """Importa core.methods, que auto-registra todo lo que encuentre.

    Con force=True es una recarga completa: vacia el registro y vuelve a
    importar todo desde los archivos.

    Las dos mitades son necesarias. Sin descartar los modulos, Python devuelve
    los del cache y no se vuelve a registrar nada, asi que despues de un
    clear() el registro queda vacio para siempre. Y sin vaciar el registro, la
    segunda recarga choca contra lo que ya estaba y revienta por slug duplicado.
    """
    if force:
        _REGISTRY.clear()
        cacheados = [
            nombre
            for nombre in list(sys.modules)
            if nombre == "core.methods" or nombre.startswith("core.methods.")
        ]
        for nombre in cacheados:
            del sys.modules[nombre]
    importlib.import_module("core.methods")


__all__ = ["register", "get", "all_methods", "clear", "load_methods"]
