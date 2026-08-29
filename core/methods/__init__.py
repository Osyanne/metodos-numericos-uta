"""Cada metodo vive en su propio archivo y se registra al importarse.

Los archivos que empiezan con guion bajo se ignoran.
"""
from __future__ import annotations

import importlib
import pkgutil


def _autoload() -> None:
    for module in pkgutil.iter_modules(__path__):
        if not module.name.startswith("_"):
            importlib.import_module(f"{__name__}.{module.name}")


_autoload()
