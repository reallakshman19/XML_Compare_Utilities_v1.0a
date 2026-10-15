"""Normalize source-faithful Word table rows into a deterministic logical grid."""

from __future__ import annotations

from dataclasses import dataclass, field

from document_model import Block, SourceRef, TableCell, TableRow


@dataclass(frozen=True)
class RawTableCell:
    blocks: tuple[Block, ...]
    provenance: SourceRef
    column_span: int = 1
    v_merge: str | None = None


@dataclass(frozen=True)
class RawTableRow:
    cells: tuple[RawTableCell, ...]
    grid_before: int = 0
    grid_after: int = 0


@dataclass(frozen=True)
class RawTable:
    rows: tuple[RawTableRow, ...]
    declared_grid_width: int = 0


@dataclass
class _CellBuilder:
    blocks: list[Block]
    provenance: SourceRef
    column_span: int
    row_span: int
    row_index: int
    column_index: int
    is_omitted: bool = False
    v_merge: str | None = None
    source_refs: list[SourceRef] = field(default_factory=list)

    def freeze(self) -> TableCell:
        return TableCell(
            tuple(self.blocks), self.provenance, self.column_span, self.row_span,
            self.row_index, self.column_index, self.is_omitted, self.v_merge,
            tuple(self.source_refs),
        )


def normalize_table_grid(
    raw: RawTable,
    table_provenance: SourceRef,
) -> tuple[
    tuple[TableRow, ...],
    tuple[TableRow, ...],
    tuple[TableRow, ...],
    int,
    tuple[dict, ...],
]:
    grid_width = _grid_width(raw)
    diagnostics: list[dict] = []
    logical_builders: list[list[_CellBuilder]] = []
    source_rows: list[TableRow] = []
    position_rows: list[TableRow] = []
    active: dict[tuple[int, int], _CellBuilder] = {}
    for row_index, row in enumerate(raw.rows):
        logical, source, positioned, active = _normalize_row(
            row, row_index, grid_width, table_provenance, active, diagnostics,
        )
        logical_builders.append(logical)
        source_rows.append(source)
        position_rows.append(positioned)
    logical_rows = tuple(
        TableRow(tuple(cell.freeze() for cell in row), raw.rows[index].grid_before, raw.rows[index].grid_after)
        for index, row in enumerate(logical_builders)
    )
    return (
        logical_rows, tuple(source_rows), tuple(position_rows),
        grid_width, tuple(diagnostics),
    )


def _grid_width(raw: RawTable) -> int:
    extents = [
        row.grid_before + sum(cell.column_span for cell in row.cells) + row.grid_after
        for row in raw.rows
    ]
    return max([raw.declared_grid_width, *extents], default=0)


def _normalize_row(
    row: RawTableRow,
    row_index: int,
    grid_width: int,
    table_provenance: SourceRef,
    active: dict[tuple[int, int], _CellBuilder],
    diagnostics: list[dict],
):
    logical: list[_CellBuilder] = []
    source: list[TableCell] = []
    positioned: list[TableCell] = []
    next_active: dict[tuple[int, int], _CellBuilder] = {}
    for column in range(row.grid_before):
        omitted = _omitted_builder(table_provenance, row_index, column)
        logical.append(omitted)
        positioned.append(omitted.freeze())
    column = row.grid_before
    for raw_cell in row.cells:
        span = max(1, raw_cell.column_span)
        mode = _normalized_vmerge(raw_cell.v_merge, raw_cell.provenance, diagnostics)
        source_cell = _source_cell(raw_cell, row_index, column, mode)
        source.append(source_cell)
        positioned.append(source_cell)
        _place_logical_cell(
            logical, next_active, active, raw_cell, row_index, column,
            span, mode, diagnostics,
        )
        column += span
    explicit_end = column + row.grid_after
    trailing = max(0, grid_width - explicit_end)
    if trailing and row.grid_after == 0:
        diagnostics.append(_diagnostic(
            "TABLE_IRREGULAR_GRID", "WARNING",
            f"Row {row_index} ends before logical grid width {grid_width}; trailing positions preserved as omitted",
            table_provenance,
        ))
    omitted_after = row.grid_after + trailing
    for offset in range(omitted_after):
        omitted = _omitted_builder(table_provenance, row_index, column + offset)
        logical.append(omitted)
        positioned.append(omitted.freeze())
    if explicit_end > grid_width:
        diagnostics.append(_diagnostic(
            "TABLE_IRREGULAR_GRID", "WARNING",
            f"Row {row_index} exceeds declared logical grid width {grid_width}",
            table_provenance,
        ))
    return (
        logical,
        TableRow(tuple(source), row.grid_before, row.grid_after),
        TableRow(tuple(positioned), row.grid_before, row.grid_after),
        next_active,
    )


def _place_logical_cell(
    logical: list[_CellBuilder],
    next_active: dict[tuple[int, int], _CellBuilder],
    active: dict[tuple[int, int], _CellBuilder],
    raw_cell: RawTableCell,
    row_index: int,
    column: int,
    span: int,
    mode: str | None,
    diagnostics: list[dict],
) -> None:
    key = (column, span)
    if mode == "continue":
        origin = active.get(key)
        if origin is not None:
            origin.row_span += 1
            origin.blocks.extend(raw_cell.blocks)
            origin.source_refs.append(raw_cell.provenance)
            next_active[key] = origin
            return
        diagnostics.append(_diagnostic(
            "TABLE_VERTICAL_MERGE_ORPHAN", "WARNING",
            f"vMerge continuation at row {row_index}, column {column} has no matching restart",
            raw_cell.provenance,
        ))
    builder = _source_builder(raw_cell, row_index, column, span, mode)
    logical.append(builder)
    if mode == "restart":
        next_active[key] = builder


def _source_builder(
    raw_cell: RawTableCell,
    row_index: int,
    column: int,
    span: int,
    mode: str | None,
) -> _CellBuilder:
    return _CellBuilder(
        list(raw_cell.blocks), raw_cell.provenance, span, 1,
        row_index, column, False, mode, [raw_cell.provenance],
    )


def _source_cell(
    raw_cell: RawTableCell,
    row_index: int,
    column: int,
    mode: str | None,
) -> TableCell:
    return TableCell(
        raw_cell.blocks, raw_cell.provenance, max(1, raw_cell.column_span), 1,
        row_index, column, False, mode, (raw_cell.provenance,),
    )


def _omitted_builder(
    table_provenance: SourceRef,
    row_index: int,
    column: int,
) -> _CellBuilder:
    provenance = SourceRef(
        table_provenance.source_type,
        table_provenance.part,
        table_index=table_provenance.table_index,
        row_index=row_index,
    )
    return _CellBuilder([], provenance, 1, 1, row_index, column, True, None, [])


def _normalized_vmerge(
    value: str | None,
    provenance: SourceRef,
    diagnostics: list[dict],
) -> str | None:
    if value in {None, "restart", "continue"}:
        return value
    diagnostics.append(_diagnostic(
        "TABLE_VERTICAL_MERGE", "WARNING",
        f"Unrecognized w:vMerge value {value!r}; treating cell as unmerged",
        provenance,
    ))
    return None


def _diagnostic(code: str, severity: str, message: str, provenance: SourceRef) -> dict:
    return {
        "code": code,
        "severity": severity,
        "message": message,
        "provenance": provenance.to_dict(),
    }
