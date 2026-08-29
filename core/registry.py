"""Registro de metodos. Punto unico de extension del aplicativo."""
from __future__ import annotations

import importlib

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
    """Solo para tests."""
    _REGISTRY.clear()


def load_methods() -> None:
    """Importa core.methods, que auto-registra todo lo que encuentre."""
    importlib.import_module("core.methods")


__all__ = ["register", "get", "all_methods", "clear", "load_methods"]
