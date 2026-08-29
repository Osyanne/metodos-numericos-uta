"""Parametros de ejecucion que el usuario controla desde la interfaz."""
from __future__ import annotations

from dataclasses import dataclass

from core.errors import ErrorCriterion
from core.precision import DEFAULT_DECIMALS, clamp_decimals


@dataclass(frozen=True)
class SolveConfig:
    """Configuracion de una corrida.

    max_iterations es el "n" que pide el docente: se puede pedir el calculo
    hasta cualquier iteracion n. Con stop_on_tolerance en False, el metodo
    corre exactamente n iteraciones aunque ya haya convergido.
    """

    decimals: int = DEFAULT_DECIMALS
    max_iterations: int = 50
    tolerance: float = 1e-6
    error_criterion: ErrorCriterion = ErrorCriterion.RELATIVE_PERCENT
    stop_on_tolerance: bool = True

    def __post_init__(self) -> None:
        object.__setattr__(self, "decimals", clamp_decimals(self.decimals))
        if self.max_iterations < 1:
            raise ValueError("max_iterations debe ser al menos 1")
        if self.tolerance < 0:
            raise ValueError("La tolerancia no puede ser negativa")
