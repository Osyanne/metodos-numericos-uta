"""Exportacion de una corrida a CSV y PDF."""
from __future__ import annotations

import csv
import json
from io import StringIO
from typing import Any

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from core.serialization import finite_or_none
from core.types import MethodResult, MethodSpec


def csv_bytes(result: MethodResult) -> bytes:
    """Genera la tabla completa en CSV conservando la precision calculada."""
    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(["i", *(column.key for column in result.columns), "error"])

    for iteration in result.iterations:
        writer.writerow(
            [
                iteration.n,
                *(
                    _number_text(iteration.values.get(column.key))
                    for column in result.columns
                ),
                _number_text(iteration.error),
            ]
        )

    return output.getvalue().encode("utf-8")


def pdf_bytes(
    spec: MethodSpec,
    params: dict[str, Any],
    result: MethodResult,
) -> bytes:
    """Genera un informe PDF autocontenido de la corrida."""
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_compression(False)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.set_title(_latin1(f"{spec.name} - Metodos numericos"))
    pdf.add_page()

    pdf.set_font("Helvetica", style="B", size=16)
    pdf.cell(
        0,
        10,
        text=_latin1(spec.name),
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )

    pdf.set_font("Helvetica", size=10)
    _multi_line(pdf, f"Metodo: {result.method}", height=6)
    _multi_line(pdf, f"Funcion: {_function_text(params)}", height=6)

    pdf.set_font("Helvetica", style="B", size=11)
    pdf.cell(
        0,
        7,
        text="Parametros",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.set_font("Helvetica", size=9)
    for key, value in params.items():
        _multi_line(pdf, f"{key}: {_value_text(value)}")

    pdf.ln(2)
    _write_iterations_table(pdf, result)

    pdf.ln(3)
    pdf.set_font("Helvetica", style="B", size=11)
    pdf.cell(
        0,
        7,
        text="Resultado",
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )
    pdf.set_font("Helvetica", size=9)
    for key, value in result.result.items():
        _multi_line(pdf, f"{key}: {_value_text(value)}")

    _multi_line(
        pdf,
        f"Convergencia: {'si' if result.converged else 'no'}; "
        f"motivo: {result.stop_reason.value}",
    )
    return bytes(pdf.output())


def _write_iterations_table(pdf: FPDF, result: MethodResult) -> None:
    headers = ["i", *(column.label for column in result.columns), "error"]
    page_width = pdf.w - pdf.l_margin - pdf.r_margin
    cell_width = page_width / len(headers)
    row_height = 6
    font_size = max(5.0, min(9.0, 48.0 / len(headers)))

    def header() -> None:
        pdf.set_font("Helvetica", style="B", size=font_size)
        for index, label in enumerate(headers):
            pdf.cell(
                cell_width,
                row_height,
                text=_latin1(str(label)),
                border=1,
                new_x=XPos.LMARGIN if index == len(headers) - 1 else XPos.RIGHT,
                new_y=YPos.NEXT if index == len(headers) - 1 else YPos.TOP,
            )

    header()
    pdf.set_font("Helvetica", size=font_size)
    for iteration in result.iterations:
        if pdf.will_page_break(row_height):
            pdf.add_page()
            header()
            pdf.set_font("Helvetica", size=font_size)

        values = [
            str(iteration.n),
            *(
                _number_text(iteration.values.get(column.key))
                for column in result.columns
            ),
            _number_text(iteration.error),
        ]
        for index, value in enumerate(values):
            pdf.cell(
                cell_width,
                row_height,
                text=_latin1(value),
                border=1,
                new_x=XPos.LMARGIN if index == len(values) - 1 else XPos.RIGHT,
                new_y=YPos.NEXT if index == len(values) - 1 else YPos.TOP,
            )


def _multi_line(pdf: FPDF, text: str, *, height: float = 5) -> None:
    pdf.multi_cell(
        0,
        height,
        text=_latin1(text),
        new_x=XPos.LMARGIN,
        new_y=YPos.NEXT,
    )


def _number_text(value: Any) -> str:
    finite = finite_or_none(value)
    return "" if finite is None else repr(finite)


def _function_text(params: dict[str, Any]) -> str:
    if "fx" in params:
        return _value_text(params["fx"])
    if "fxy" in params:
        return _value_text(params["fxy"])
    return "No aplica"


def _value_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, allow_nan=False, default=str)


def _latin1(text: str) -> str:
    """Los fonts base de FPDF usan Latin-1; reemplaza simbolos no soportados."""
    return text.encode("latin-1", errors="replace").decode("latin-1")


__all__ = ["csv_bytes", "pdf_bytes"]
