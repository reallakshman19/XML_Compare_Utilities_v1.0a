"""PDF table candidates, reconciliation, and shared semantic normalization."""

from __future__ import annotations

from dataclasses import dataclass, replace
from io import BytesIO
import math
import statistics
from typing import Iterable

from document_model import ParagraphBlock, SourceRef, TableBlock, TableCell, TableRow

BBox = tuple[float, float, float, float]
PDF_TABLE_REVISION = "pdf-tables-v1"


@dataclass(frozen=True)
class PdfTableSourceRow:
    cells: tuple[BBox | None, ...]
    texts: tuple[str, ...]


@dataclass(frozen=True)
class PdfTableCandidate:
    page: int
    strategy: str
    bbox: BBox
    rows: tuple[PdfTableSourceRow, ...]
    confidence: float
    reasons: tuple[str, ...]

    @property
    def row_count(self) -> int:
        return len(self.rows)

    @property
    def column_count(self) -> int:
        return max((len(row.cells) for row in self.rows), default=0)


@dataclass(frozen=True)
class ReconciledTables:
    accepted: tuple[PdfTableCandidate, ...]
    diagnostics: tuple[dict, ...]


class PdfPlumberTableBackend:
    """Independent table-candidate adapter over the optional pdfplumber backend."""

    def extract(
        self,
        pdf_bytes: bytes,
        *,
        password: str | None = None,
        max_pages: int = 2000,
        max_page_area: float = 200_000_000.0,
    ) -> dict[int, tuple[PdfTableCandidate, ...]]:
        try:
            import pdfplumber
        except ImportError as exc:
            raise ValueError("PDF table extraction requires requirements-pdf.txt") from exc
        results: dict[int, tuple[PdfTableCandidate, ...]] = {}
        with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
            if len(pdf.pages) > max_pages:
                raise ValueError(f"PDF has {len(pdf.pages)} pages; limit is {max_pages}")
            for page_index, page in enumerate(pdf.pages, 1):
                if float(page.width) * float(page.height) > max_page_area:
                    raise ValueError(f"PDF page {page_index} exceeds safe table-extraction area")
                candidates = [
                    *self._strategy_candidates(page, page_index, "ruled"),
                    *self._strategy_candidates(page, page_index, "text"),
                ]
                results[page_index] = tuple(candidates)
                page.close()
        return results

    def _strategy_candidates(self, page, page_number: int, strategy: str) -> list[PdfTableCandidate]:
        settings = self._settings(strategy)
        tables = page.find_tables(table_settings=settings)
        candidates = []
        for table in tables:
            extracted = table.extract()
            rows = []
            for row_index, row in enumerate(table.rows):
                texts = tuple(
                    "" if row_index >= len(extracted) or col >= len(extracted[row_index]) or extracted[row_index][col] is None
                    else str(extracted[row_index][col]).strip()
                    for col in range(len(row.cells))
                )
                if strategy == "text" and not any(texts):
                    continue
                rows.append(PdfTableSourceRow(
                    tuple(None if cell is None else _round_bbox(cell) for cell in row.cells), texts,
                ))
            candidate = _candidate(page_number, strategy, _round_bbox(table.bbox), tuple(rows))
            if candidate is not None:
                candidates.append(candidate)
        return candidates

    @staticmethod
    def _settings(strategy: str) -> dict:
        if strategy == "ruled":
            return {
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "snap_tolerance": 3,
                "join_tolerance": 3,
                "intersection_tolerance": 3,
            }
        return {
            "vertical_strategy": "text",
            "horizontal_strategy": "text",
            "min_words_vertical": 3,
            "min_words_horizontal": 1,
            "text_x_tolerance": 3,
            "text_y_tolerance": 3,
        }


def _candidate(
    page: int, strategy: str, bbox: BBox, rows: tuple[PdfTableSourceRow, ...],
) -> PdfTableCandidate | None:
    if len(rows) < 2:
        return None
    width = max((len(row.cells) for row in rows), default=0)
    if width < 2:
        return None
    nonempty = sum(bool(text.strip()) for row in rows for text in row.texts)
    density = nonempty / max(1, len(rows) * width)
    reasons = [f"{len(rows)} source rows x {width} columns", f"non-empty density {density:.2f}"]
    if strategy == "ruled":
        rectangular = all(len(row.cells) == width for row in rows)
        confidence = 0.86 + min(0.10, density * 0.10) + (0.03 if rectangular else 0.0)
        reasons.append("explicit line-grid geometry")
    else:
        compactness = _text_vertical_compactness(bbox, rows)
        whitespace_score = _text_column_whitespace_score(rows, width)
        reasons.append(f"vertical compactness {compactness:.2f}")
        reasons.append(f"column whitespace score {whitespace_score:.2f}")
        confidence = 0.60 + min(0.22, density * 0.22) + min(0.08, len(rows) * 0.015)
        if density < 0.85 or len(rows) < 3:
            confidence -= 0.18
            reasons.append("text-table density is below the conservative 0.85 gate")
        if whitespace_score < 9.0:
            confidence -= 0.30
            reasons.append("aligned text is word-dense rather than separated by table-like whitespace")
        if compactness > 5.0:
            confidence -= 0.30
            reasons.append("candidate is too vertically sparse for safe text-table reconstruction")
        elif compactness > 3.5:
            confidence -= 0.12
            reasons.append("candidate has weak vertical table compactness")
    return PdfTableCandidate(
        page, strategy, bbox, rows, round(max(0.0, min(0.99, confidence)), 3), tuple(reasons),
    )


def _text_vertical_compactness(
    bbox: BBox, rows: tuple[PdfTableSourceRow, ...],
) -> float:
    row_heights = []
    for row in rows:
        boxes = [cell for cell in row.cells if cell is not None]
        if not boxes:
            continue
        top = min(cell[1] for cell in boxes)
        bottom = max(cell[3] for cell in boxes)
        row_heights.append(max(0.1, bottom - top))
    content_height = sum(row_heights)
    return (bbox[3] - bbox[1]) / max(0.1, content_height)


def _text_column_whitespace_score(
    rows: tuple[PdfTableSourceRow, ...], width: int,
) -> float:
    column_scores = []
    for column in range(width):
        values = []
        for row in rows:
            if column >= len(row.cells) or row.cells[column] is None:
                continue
            text = row.texts[column].strip() if column < len(row.texts) else ""
            if not text:
                continue
            cell = row.cells[column]
            assert cell is not None
            values.append((cell[2] - cell[0]) / max(1, len(text)))
        if values:
            column_scores.append(statistics.median(values))
    return statistics.median(column_scores) if column_scores else 0.0


def reconcile_page_tables(
    candidates: tuple[PdfTableCandidate, ...],
    *,
    ruled_min: float = 0.85,
    text_min: float = 0.78,
) -> ReconciledTables:
    diagnostics: list[dict] = []
    eligible: list[PdfTableCandidate] = []
    for candidate in sorted(candidates, key=lambda value: (value.bbox[1], value.bbox[0], value.strategy)):
        threshold = ruled_min if candidate.strategy == "ruled" else text_min
        if candidate.confidence < threshold:
            diagnostics.append(_low_confidence_diagnostic(candidate, threshold))
        else:
            eligible.append(candidate)
    ordered = eligible
    rejected: set[int] = set()
    accepted: list[PdfTableCandidate] = []
    for left_index, left in enumerate(ordered):
        if left_index in rejected:
            continue
        overlapping = [
            (right_index, right)
            for right_index, right in enumerate(ordered[left_index + 1:], left_index + 1)
            if _bbox_iou(left.bbox, right.bbox) >= 0.70
        ]
        conflict = False
        corroborated = None
        for right_index, right in overlapping:
            if right_index in rejected:
                continue
            if left.row_count == right.row_count and left.column_count == right.column_count:
                preferred = _prefer_candidate(left, right)
                corroborated = PdfTableCandidate(
                    preferred.page, preferred.strategy, preferred.bbox, preferred.rows,
                    min(0.99, round(preferred.confidence + 0.04, 3)),
                    (*preferred.reasons, f"corroborated by {right.strategy if preferred is left else left.strategy}"),
                )
                rejected.add(right_index)
            else:
                conflict = True
                rejected.add(right_index)
                diagnostics.append(_ambiguous_diagnostic(left, right))
        if not conflict:
            accepted.append(corroborated or left)
    accepted = _dedupe_contained_tables(accepted, diagnostics)
    return ReconciledTables(tuple(accepted), tuple(diagnostics))


def _low_confidence_diagnostic(candidate: PdfTableCandidate, threshold: float) -> dict:
    return {
        "code": "PDF_TABLE_LOW_CONFIDENCE",
        "severity": "WARNING",
        "message": (
            f"Page {candidate.page} {candidate.strategy} table candidate "
            f"confidence {candidate.confidence:.2f} below {threshold:.2f}; "
            + "; ".join(candidate.reasons)
        ),
        "provenance": {
            "source_type": "pdf", "page": candidate.page, "bbox": list(candidate.bbox),
        },
    }


def candidate_to_table(candidate: PdfTableCandidate, table_index: int) -> tuple[TableBlock, tuple[dict, ...]]:
    if candidate.strategy == "text":
        return _text_candidate_to_table(candidate, table_index)
    return _ruled_candidate_to_table(candidate, table_index)


def _text_candidate_to_table(
    candidate: PdfTableCandidate, table_index: int,
) -> tuple[TableBlock, tuple[dict, ...]]:
    width = candidate.column_count
    if width < 2 or candidate.row_count < 2:
        diagnostic = _normalization_diagnostic(candidate, "insufficient text-table dimensions")
        return _empty_table(candidate, table_index, width), (diagnostic,)
    source_rows: list[TableRow] = []
    logical_rows: list[TableRow] = []
    table_ref = _table_ref(candidate)
    for row_index, source_row in enumerate(candidate.rows):
        source_cells: list[TableCell] = []
        logical_cells: list[TableCell] = []
        for col in range(width):
            cell_bbox = source_row.cells[col] if col < len(source_row.cells) else None
            text = source_row.texts[col] if col < len(source_row.texts) else ""
            if cell_bbox is None:
                omitted_ref = SourceRef(
                    "pdf", page=candidate.page, bbox=candidate.bbox,
                    extraction="embedded-table-text", confidence=candidate.confidence,
                )
                logical_cells.append(TableCell(
                    (), omitted_ref, 1, 1, row_index, col, True, None, (omitted_ref,),
                ))
                continue
            cell_ref = SourceRef(
                "pdf", page=candidate.page, bbox=cell_bbox,
                extraction="embedded-table-text", confidence=candidate.confidence,
            )
            blocks = _cell_blocks(candidate, table_index, row_index, col, text, cell_ref)
            source_cell = TableCell(
                blocks, cell_ref, 1, 1, row_index, col, False, None, (cell_ref,),
            )
            source_cells.append(source_cell)
            logical_cells.append(source_cell)
        source_rows.append(TableRow(tuple(source_cells)))
        logical_rows.append(TableRow(tuple(logical_cells)))
    rows = tuple(logical_rows)
    return TableBlock(
        f"pdf:p{candidate.page}:t{table_index}", rows, table_ref,
        source_rows=tuple(source_rows), position_rows=rows, grid_width=width,
    ), ()


def _ruled_candidate_to_table(
    candidate: PdfTableCandidate, table_index: int,
) -> tuple[TableBlock, tuple[dict, ...]]:
    x_bounds = _unique_bounds(
        coordinate for row in candidate.rows for cell in row.cells if cell
        for coordinate in (cell[0], cell[2])
    )
    y_bounds = _unique_bounds(
        coordinate for row in candidate.rows for cell in row.cells if cell
        for coordinate in (cell[1], cell[3])
    )
    if len(x_bounds) < 3 or len(y_bounds) < 3:
        diagnostic = _normalization_diagnostic(candidate, "insufficient ruled-table grid boundaries")
        return _empty_table(candidate, table_index, max(0, len(x_bounds) - 1)), (diagnostic,)
    origins: dict[tuple[float, float, float, float], tuple[int, int, int, int, str]] = {}
    source_rows: list[TableRow] = []
    for source_row in candidate.rows:
        physical_cells: list[TableCell] = []
        for physical_col, cell_bbox in enumerate(source_row.cells):
            if cell_bbox is None:
                continue
            text = source_row.texts[physical_col] if physical_col < len(source_row.texts) else ""
            col = _boundary_index(x_bounds, cell_bbox[0])
            col_end = _boundary_index(x_bounds, cell_bbox[2])
            row_start = _boundary_index(y_bounds, cell_bbox[1])
            row_end = _boundary_index(y_bounds, cell_bbox[3])
            if None in (col, col_end, row_start, row_end):
                continue
            assert col is not None and col_end is not None and row_start is not None and row_end is not None
            row_span = max(1, row_end - row_start)
            col_span = max(1, col_end - col)
            cell_ref = SourceRef(
                "pdf", page=candidate.page, bbox=cell_bbox,
                extraction="embedded-table-ruled", confidence=candidate.confidence,
            )
            blocks = _cell_blocks(candidate, table_index, row_start, col, text, cell_ref)
            physical_cells.append(TableCell(
                blocks, cell_ref, col_span, row_span, row_start, col, False, None, (cell_ref,),
            ))
            key = tuple(cell_bbox)
            if key in origins and not origins[key][4] and text:
                old = origins[key]
                origins[key] = (*old[:4], text)
            elif key not in origins:
                origins[key] = (row_start, col, row_span, col_span, text)
        source_rows.append(TableRow(tuple(physical_cells)))
    logical_rows: list[list[TableCell]] = [[] for _ in range(len(y_bounds) - 1)]
    coverage: set[tuple[int, int]] = set()
    for bbox, (row, col, row_span, col_span, text) in sorted(
        origins.items(), key=lambda item: (item[1][0], item[1][1])
    ):
        cell_ref = SourceRef(
            "pdf", page=candidate.page, bbox=bbox,
            extraction="embedded-table-ruled", confidence=candidate.confidence,
        )
        blocks = _cell_blocks(candidate, table_index, row, col, text, cell_ref)
        logical_rows[row].append(TableCell(
            blocks, cell_ref, col_span, row_span, row, col, False, None, (cell_ref,),
        ))
        for rr in range(row, min(len(logical_rows), row + row_span)):
            for cc in range(col, min(len(x_bounds) - 1, col + col_span)):
                coverage.add((rr, cc))
    for row in range(len(logical_rows)):
        for col in range(len(x_bounds) - 1):
            if (row, col) in coverage:
                continue
            omitted_ref = SourceRef(
                "pdf", page=candidate.page,
                bbox=(x_bounds[col], y_bounds[row], x_bounds[col + 1], y_bounds[row + 1]),
                extraction="embedded-table-ruled", confidence=candidate.confidence,
            )
            logical_rows[row].append(TableCell(
                (), omitted_ref, 1, 1, row, col, True, None, (omitted_ref,),
            ))
    rows = tuple(
        TableRow(tuple(sorted(cells, key=lambda value: value.column_index or 0)))
        for cells in logical_rows
    )
    return TableBlock(
        f"pdf:p{candidate.page}:t{table_index}", rows, _table_ref(candidate),
        source_rows=tuple(source_rows), position_rows=rows, grid_width=len(x_bounds) - 1,
    ), ()


def _cell_blocks(
    candidate: PdfTableCandidate, table_index: int, row: int, col: int,
    text: str, cell_ref: SourceRef,
) -> tuple[ParagraphBlock, ...]:
    if not text:
        return ()
    return (ParagraphBlock(
        f"pdf:p{candidate.page}:t{table_index}:r{row}:c{col}:p0", text, cell_ref,
        source_refs=(cell_ref,),
    ),)


def _table_ref(candidate: PdfTableCandidate) -> SourceRef:
    return SourceRef(
        "pdf", page=candidate.page, bbox=candidate.bbox,
        extraction=f"embedded-table-{candidate.strategy}", confidence=candidate.confidence,
    )


def _empty_table(candidate: PdfTableCandidate, table_index: int, width: int) -> TableBlock:
    return TableBlock(
        f"pdf:p{candidate.page}:t{table_index}", (), _table_ref(candidate), grid_width=width,
    )


def line_inside_table(line_bbox: BBox, table_bbox: BBox) -> bool:
    center_x = (line_bbox[0] + line_bbox[2]) / 2.0
    center_y = (line_bbox[1] + line_bbox[3]) / 2.0
    if table_bbox[0] <= center_x <= table_bbox[2] and table_bbox[1] <= center_y <= table_bbox[3]:
        return True
    overlap = _intersection_area(line_bbox, table_bbox)
    line_area = max(0.1, (line_bbox[2] - line_bbox[0]) * (line_bbox[3] - line_bbox[1]))
    return overlap / line_area >= 0.60


def _prefer_candidate(left: PdfTableCandidate, right: PdfTableCandidate) -> PdfTableCandidate:
    if left.strategy != right.strategy:
        return left if left.strategy == "ruled" else right
    return left if left.confidence >= right.confidence else right


def _dedupe_contained_tables(
    candidates: list[PdfTableCandidate], diagnostics: list[dict],
) -> list[PdfTableCandidate]:
    accepted: list[PdfTableCandidate] = []
    for candidate in sorted(candidates, key=lambda value: (-_bbox_area(value.bbox), value.bbox[1], value.bbox[0])):
        duplicate = next(
            (value for value in accepted if _containment_ratio(candidate.bbox, value.bbox) >= 0.95),
            None,
        )
        if duplicate is None:
            accepted.append(candidate)
            continue
        diagnostics.append({
            "code": "PDF_TABLE_DUPLICATE_CANDIDATE",
            "severity": "INFO",
            "message": f"Suppressed contained {candidate.strategy} table candidate on page {candidate.page}",
            "provenance": {"source_type": "pdf", "page": candidate.page, "bbox": list(candidate.bbox)},
        })
    return sorted(accepted, key=lambda value: (value.page, value.bbox[1], value.bbox[0]))


def _ambiguous_diagnostic(left: PdfTableCandidate, right: PdfTableCandidate) -> dict:
    return {
        "code": "PDF_TABLE_AMBIGUOUS",
        "severity": "WARNING",
        "message": (
            f"Page {left.page} overlapping {left.strategy}/{right.strategy} table candidates "
            f"disagree on shape {left.row_count}x{left.column_count} vs "
            f"{right.row_count}x{right.column_count}; unsafe reconstruction rejected"
        ),
        "provenance": {"source_type": "pdf", "page": left.page, "bbox": list(_union_bbox(left.bbox, right.bbox))},
    }


def _normalization_diagnostic(candidate: PdfTableCandidate, reason: str) -> dict:
    return {
        "code": "PDF_TABLE_AMBIGUOUS",
        "severity": "WARNING",
        "message": f"Page {candidate.page} {candidate.strategy} candidate could not normalize: {reason}",
        "provenance": {"source_type": "pdf", "page": candidate.page, "bbox": list(candidate.bbox)},
    }


def _unique_bounds(values: Iterable[float], tolerance: float = 1.5) -> tuple[float, ...]:
    ordered = sorted(float(value) for value in values if math.isfinite(float(value)))
    groups: list[list[float]] = []
    for value in ordered:
        if not groups or abs(value - statistics_mean(groups[-1])) > tolerance:
            groups.append([value])
        else:
            groups[-1].append(value)
    return tuple(round(statistics_mean(group), 3) for group in groups)


def _boundary_index(bounds: tuple[float, ...], value: float, tolerance: float = 2.0) -> int | None:
    if not bounds:
        return None
    index = min(range(len(bounds)), key=lambda current: abs(bounds[current] - value))
    return index if abs(bounds[index] - value) <= tolerance else None


def statistics_mean(values: list[float]) -> float:
    return sum(values) / max(1, len(values))


def _round_bbox(bbox) -> BBox:
    return tuple(round(float(value), 3) for value in bbox)  # type: ignore[return-value]


def _bbox_area(bbox: BBox) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])


def _intersection_area(left: BBox, right: BBox) -> float:
    width = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    height = max(0.0, min(left[3], right[3]) - max(left[1], right[1]))
    return width * height


def _bbox_iou(left: BBox, right: BBox) -> float:
    intersection = _intersection_area(left, right)
    union = _bbox_area(left) + _bbox_area(right) - intersection
    return intersection / max(0.1, union)


def _containment_ratio(inner: BBox, outer: BBox) -> float:
    return _intersection_area(inner, outer) / max(0.1, _bbox_area(inner))


def _union_bbox(left: BBox, right: BBox) -> BBox:
    return (
        min(left[0], right[0]), min(left[1], right[1]),
        max(left[2], right[2]), max(left[3], right[3]),
    )
