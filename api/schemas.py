"""Contrato HTTP. CONGELADO junto con core/types.py."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from core.errors import ErrorCriterion
from core.precision import DEFAULT_DECIMALS, MAX_DECIMALS, MIN_DECIMALS


class FieldSchema(BaseModel):
    name: str
    label: str
    kind: str
    default: Any = None
    help: str = ""
    required: bool = True


class MethodSummary(BaseModel):
    slug: str
    name: str
    unit: str
    family: str
    description: str = ""
    inputs: list[FieldSchema] = []


class SolveRequest(BaseModel):
    params: dict[str, Any]
    decimals: int = Field(DEFAULT_DECIMALS, ge=MIN_DECIMALS, le=MAX_DECIMALS)
    max_iterations: int = Field(50, ge=1, le=10_000)
    tolerance: float = Field(1e-6, ge=0)
    error_criterion: ErrorCriterion = ErrorCriterion.RELATIVE_PERCENT
    stop_on_tolerance: bool = True


class IterationSchema(BaseModel):
    n: int
    values: dict[str, float | None]
    error: float | None = None


class ColumnSchema(BaseModel):
    key: str
    label: str
    numeric: bool = True


class PlotSchema(BaseModel):
    kind: str
    series: dict[str, Any]
    x_label: str = "x"
    y_label: str = "y"
    title: str = ""


class SolveResponse(BaseModel):
    method: str
    columns: list[ColumnSchema]
    iterations: list[IterationSchema]
    result: dict[str, Any]
    converged: bool
    stop_reason: str
    decimals: int
    plot: PlotSchema | None = None
    notes: list[str] = []
