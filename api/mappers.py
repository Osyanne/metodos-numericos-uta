"""Traduccion de los tipos del nucleo al contrato HTTP."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import Enum
from numbers import Integral, Real
from typing import Any

from api.schemas import (
    ColumnSchema,
    FieldSchema,
    IterationSchema,
    MethodSummary,
    PlotSchema,
    ResampleSchema,
    SolveResponse,
)
from core.serialization import finite_or_none, jsonable_iteration
from core.types import MethodResult, MethodSpec, PlotSpec


def method_to_summary(spec: MethodSpec) -> MethodSummary:
    """Expone los metadatos que permiten dibujar un formulario generico."""
    return MethodSummary(
        slug=spec.slug,
        name=spec.name,
        unit=spec.unit,
        family=spec.family,
        description=spec.description,
        inputs=[
            FieldSchema(
                name=field.name,
                label=field.label,
                kind=field.kind.value,
                default=json_safe(field.default),
                help=field.help,
                required=field.required,
                multiple=field.multiple,
            )
            for field in spec.inputs
        ],
    )


def result_to_response(result: MethodResult) -> SolveResponse:
    """Convierte un resultado sin redondear y elimina NaN/Infinity."""
    return SolveResponse(
        method=result.method,
        columns=[
            ColumnSchema(key=column.key, label=column.label, numeric=column.numeric)
            for column in result.columns
        ],
        iterations=[
            IterationSchema(**jsonable_iteration(iteration))
            for iteration in result.iterations
        ],
        result=json_safe(result.result),
        converged=result.converged,
        stop_reason=result.stop_reason.value,
        decimals=result.decimals,
        plot=_plot_to_schema(result.plot),
        notes=result.notes,
    )


def json_safe(value: Any) -> Any:
    """Devuelve una copia serializable sin ningun numero no finito.

    El resultado y las series de una grafica contienen estructuras anidadas y
    abiertas. Por eso el saneamiento vive en un unico recorrido recursivo, en
    vez de depender de que cada metodo recuerde limpiar sus propios campos.
    """
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, Real):
        return finite_or_none(value)
    if isinstance(value, Mapping):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [json_safe(item) for item in value]
    return value


def _plot_to_schema(plot: PlotSpec | None) -> PlotSchema | None:
    if plot is None:
        return None

    resample = None
    if plot.resample is not None:
        domain = json_safe(plot.resample.domain)
        if domain is not None and any(limit is None for limit in domain):
            # El esquema congelado admite un dominio completo o null, pero no
            # limites null individuales. Un dominio parcialmente no finito no
            # es util para remuestrear, asi que se descarta entero.
            domain = None
        resample = ResampleSchema(
            expression=plot.resample.expression,
            variables=list(plot.resample.variables),
            domain=domain,
        )

    return PlotSchema(
        kind=plot.kind.value,
        series=json_safe(plot.series),
        x_label=plot.x_label,
        y_label=plot.y_label,
        title=plot.title,
        resample=resample,
    )


__all__ = ["json_safe", "method_to_summary", "result_to_response"]
