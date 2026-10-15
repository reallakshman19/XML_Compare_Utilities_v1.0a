"""Deterministic renderer selection for semantic tables."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from document_model import TableBlock, TableCell

WIDE_COLUMN_THRESHOLD = 8
TABLE_MODES = ("auto", "markdown", "html", "records")


@dataclass(frozen=True)
class TableRenderDecision:
    requested_mode: str
    renderer: str
    classification: str
    reasons: tuple[str, ...]
    diagnostic: dict | None = None


def classify_table(table: TableBlock) -> tuple[str, tuple[str, ...]]:
    reasons: list[str] = []
    width = _grid_width(table)
    if width == 0:
        reasons.append("zero-column table cannot be represented as valid GFM")
        return "COMPLEX_MERGED", tuple(reasons)
    if _has_nested_table(table):
        reasons.append("nested table content requires structural rendering")
        return "NESTED", tuple(reasons)
    if _has_complex_grid(table):
        reasons.append("merged or omitted cells require span-aware rendering")
        return "COMPLEX_MERGED", tuple(reasons)
    if width >= WIDE_COLUMN_THRESHOLD:
        reasons.append(f"logical width {width} >= {WIDE_COLUMN_THRESHOLD}")
        return "WIDE_ENGINEERING", tuple(reasons)
    reasons.append("rectangular table has no merges, omissions, or nested tables")
    return "SIMPLE", tuple(reasons)


def choose_table_renderer(table: TableBlock, requested_mode: str) -> TableRenderDecision:
    if requested_mode not in TABLE_MODES:
        raise ValueError(f"Unsupported table mode: {requested_mode}")
    classification, reasons = classify_table(table)
    if requested_mode == "auto":
        renderer = _auto_renderer(classification)
        return TableRenderDecision(requested_mode, renderer, classification, reasons)
    if requested_mode == "markdown" and classification != "SIMPLE":
        return _fallback_decision(requested_mode, classification, reasons, "html")
    if requested_mode == "records" and classification == "NESTED":
        return _fallback_decision(requested_mode, classification, reasons, "html")
    return TableRenderDecision(requested_mode, requested_mode, classification, reasons)


def render_table_by_policy(
    table: TableBlock,
    requested_mode: str,
    *,
    cell_text: Callable[[TableCell], str],
    html_renderer: Callable[[TableBlock], str],
) -> tuple[str, TableRenderDecision]:
    decision = choose_table_renderer(table, requested_mode)
    if decision.renderer == "html":
        return html_renderer(table), decision
    if decision.renderer == "markdown":
        return render_table_markdown(table, cell_text), decision
    if decision.renderer == "records":
        return render_table_records(table, cell_text), decision
    raise ValueError(f"Unsupported resolved table renderer: {decision.renderer}")


def render_table_markdown(
    table: TableBlock,
    cell_text: Callable[[TableCell], str],
) -> str:
    width = _grid_width(table)
    headers = [f"Column {index + 1}" for index in range(width)]
    lines = [_markdown_row(headers), _markdown_row(["---"] * width)]
    for row_index in range(len(table.rows)):
        values = [""] * width
        for cell in table.rows[row_index].cells:
            column = cell.column_index if cell.column_index is not None else 0
            if 0 <= column < width:
                values[column] = _escape_markdown_cell(cell_text(cell))
        lines.append(_markdown_row(values))
    return "\n".join(lines)


def render_table_records(
    table: TableBlock,
    cell_text: Callable[[TableCell], str],
) -> str:
    lines: list[str] = []
    for row_index, row in enumerate(table.rows):
        if lines:
            lines.append("")
        lines.append(f"**Row {row_index + 1}**")
        if not row.cells:
            lines.append("- ⟦NO LOGICAL CELLS⟧")
            continue
        for cell in row.cells:
            lines.append(f"- {_cell_coordinate_label(cell)}: {_record_value(cell, cell_text)}")
    return "\n".join(lines)


def _auto_renderer(classification: str) -> str:
    if classification == "SIMPLE":
        return "markdown"
    if classification == "WIDE_ENGINEERING":
        return "records"
    return "html"


def _fallback_decision(
    requested_mode: str,
    classification: str,
    reasons: tuple[str, ...],
    renderer: str,
) -> TableRenderDecision:
    diagnostic = {
        "code": "TABLE_RENDER_MODE_FALLBACK",
        "severity": "WARNING",
        "message": (
            f"Requested table mode {requested_mode!r} is unsafe for "
            f"classification {classification}; rendered as {renderer}"
        ),
    }
    return TableRenderDecision(
        requested_mode, renderer, classification,
        (*reasons, diagnostic["message"]), diagnostic,
    )


def _has_nested_table(table: TableBlock) -> bool:
    return any(
        isinstance(block, TableBlock)
        for row in table.rows
        for cell in row.cells
        for block in cell.blocks
    )


def _has_complex_grid(table: TableBlock) -> bool:
    return any(
        cell.column_span != 1 or cell.row_span != 1 or cell.is_omitted
        for row in table.rows
        for cell in row.cells
    )


def _grid_width(table: TableBlock) -> int:
    if table.grid_width is not None:
        return max(0, table.grid_width)
    right_edges = [
        (cell.column_index or 0) + max(1, cell.column_span)
        for row in table.rows
        for cell in row.cells
    ]
    return max(right_edges, default=0)


def _markdown_row(values: list[str]) -> str:
    return "| " + " | ".join(values) + " |"


def _escape_markdown_cell(value: str) -> str:
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def _cell_coordinate_label(cell: TableCell) -> str:
    column = (cell.column_index or 0) + 1
    column_end = column + max(1, cell.column_span) - 1
    label = f"C{column}" if column_end == column else f"C{column}-C{column_end}"
    if cell.row_index is not None and cell.row_span > 1:
        start = cell.row_index + 1
        end = start + cell.row_span - 1
        label += f" (R{start}-R{end})"
    return label


def _record_value(cell: TableCell, cell_text: Callable[[TableCell], str]) -> str:
    if cell.is_omitted:
        return "⟦OMITTED⟧"
    value = cell_text(cell).replace("\n", " / ").strip()
    return value or "⟦EMPTY⟧"
