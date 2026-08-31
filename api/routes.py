"""Rutas HTTP que traducen entre los esquemas y el nucleo numerico."""
from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException, Response

from api.export import csv_bytes, pdf_bytes
from api.mappers import method_to_summary, result_to_response
from api.schemas import (
    MethodSummary,
    SampleRequest,
    SampleResponse,
    SolveRequest,
    SolveResponse,
)
from core.config import SolveConfig
from core.registry import all_methods, get
from core.sampling import sample
from core.serialization import finite_or_none
from core.types import MethodError, MethodResult, MethodSpec

router = APIRouter(prefix="/api")


@router.get("/methods", response_model=list[MethodSummary])
def methods() -> list[MethodSummary]:
    return [method_to_summary(spec) for spec in all_methods()]


@router.get("/methods/{slug}", response_model=MethodSummary)
def method(slug: str) -> MethodSummary:
    return method_to_summary(_get_method(slug))


@router.post("/methods/{slug}/solve", response_model=SolveResponse)
def solve(slug: str, request: SolveRequest) -> SolveResponse:
    result = _run(_get_method(slug), request)
    return result_to_response(result)


@router.post("/plot/sample", response_model=SampleResponse)
def plot_sample(request: SampleRequest) -> SampleResponse:
    if len(request.variables) != 1:
        raise HTTPException(
            status_code=422,
            detail="El muestreo necesita exactamente una variable para el eje x.",
        )
    if not math.isfinite(request.x_min) or not math.isfinite(request.x_max):
        raise HTTPException(
            status_code=422,
            detail="Los extremos del rango deben ser numeros finitos.",
        )
    if not math.isfinite(request.x_max - request.x_min):
        raise HTTPException(
            status_code=422,
            detail="El ancho del rango se sale de los numeros finitos admitidos.",
        )

    try:
        xs, ys = sample(
            request.expression,
            x_min=request.x_min,
            x_max=request.x_max,
            puntos=request.points,
            variables=tuple(request.variables),
        )
    except MethodError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return SampleResponse(
        x=xs,
        y=[finite_or_none(value) for value in ys],
    )


@router.post("/methods/{slug}/export/{formato}")
def export(slug: str, formato: str, request: SolveRequest) -> Response:
    spec = _get_method(slug)
    normalized_format = formato.lower()
    if normalized_format not in {"csv", "pdf"}:
        raise HTTPException(
            status_code=422,
            detail="El formato de exportacion debe ser csv o pdf.",
        )

    result = _run(spec, request)
    if normalized_format == "csv":
        content = csv_bytes(result)
        media_type = "text/csv"
    else:
        content = pdf_bytes(spec, request.params, result)
        media_type = "application/pdf"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{spec.slug}.{normalized_format}"'
            )
        },
    )


def _get_method(slug: str) -> MethodSpec:
    try:
        return get(slug)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=exc.args[0]) from exc


def _run(spec: MethodSpec, request: SolveRequest) -> MethodResult:
    config = SolveConfig(
        decimals=request.decimals,
        max_iterations=request.max_iterations,
        tolerance=request.tolerance,
        error_criterion=request.error_criterion,
        stop_on_tolerance=request.stop_on_tolerance,
    )
    try:
        return spec.solve(request.params, config)
    except MethodError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


__all__ = ["router"]
