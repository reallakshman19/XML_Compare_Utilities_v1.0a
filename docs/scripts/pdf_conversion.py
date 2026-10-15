"""Native PDF -> semantic document conversion, tables, Markdown, and evidence."""

from __future__ import annotations

from dataclasses import replace
import argparse
import hashlib
import html
import json
from pathlib import Path

from document_model import (
    DocumentModel, PageBreakBlock, ParagraphBlock, PositionedSpan, SourceRef,
    TableBlock, TableCell, build_evidence, canonical_json_bytes, options_hash,
)
from pdf_native import (
    NativeBlock, NativeLine, PdfPlumberBackend, classify_page,
    cluster_chars_into_lines, detect_running_content, group_lines_into_blocks,
    infer_heading_levels, native_text_quality, reconstruct_reading_order,
)
from pdf_tables import (
    PDF_TABLE_REVISION, PdfPlumberTableBackend, candidate_to_table,
    line_inside_table, reconcile_page_tables,
)
from table_rendering import TABLE_MODES, TableRenderDecision, render_table_by_policy

PDF_CONVERSION_REVISION = "pdf-native-tables-v2"
_TABLE_MARKER_PREFIX = "\ue000TABLE:"
_TABLE_MARKER_SUFFIX = "\ue001"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def parse_pdf_bytes(
    pdf_bytes: bytes, *, password: str | None = None,
    header_mode: str = "metadata", footer_mode: str = "metadata",
    backend=None, table_backend=None, max_pages: int = 2000,
) -> tuple[DocumentModel, dict]:
    native_backend = backend or PdfPlumberBackend()
    result = native_backend.extract(pdf_bytes, password=password, max_pages=max_pages)
    table_candidates, table_extract_diags = _extract_table_candidates(
        pdf_bytes, password, max_pages, backend, table_backend,
    )
    diagnostics: list[dict] = list(table_extract_diags)
    page_lines: list[tuple[int, float, tuple[NativeLine, ...]]] = []
    page_analysis: dict[int, dict] = {}
    page_tables: dict[int, list[tuple[object, TableBlock]]] = {}

    for page in result.pages:
        quality = native_text_quality(page.chars, page.signals.duplicate_ratio)
        classification = classify_page(page.signals, quality)
        lines = cluster_chars_into_lines(page.chars, page.signals.page)
        page_lines.append((page.signals.page, page.signals.height, lines))
        reconciled = reconcile_page_tables(table_candidates.get(page.signals.page, ()))
        diagnostics.extend(reconciled.diagnostics)
        normalized: list[tuple[object, TableBlock]] = []
        for index, candidate in enumerate(reconciled.accepted):
            table, table_diags = candidate_to_table(candidate, index)
            diagnostics.extend(table_diags)
            if table.rows:
                normalized.append((candidate, table))
        page_tables[page.signals.page] = normalized
        page_analysis[page.signals.page] = _page_analysis(
            page, quality, classification, lines, table_candidates, normalized,
        )
        if not lines:
            diagnostics.append(_page_diagnostic(
                "PDF_TEXT_EMPTY", "WARNING", page.signals.page,
                "No usable native positioned text lines were extracted",
            ))
        if not quality.adequate:
            diagnostics.append(_page_diagnostic(
                "PDF_NATIVE_TEXT_INADEQUATE", "WARNING", page.signals.page,
                "; ".join(quality.reasons) or "native text quality is inadequate",
            ))

    suppressed, running = detect_running_content(tuple(page_lines))
    sequences: dict[int, list[NativeBlock | TableBlock]] = {}
    all_native_blocks: list[NativeBlock] = []
    for page_number, height, lines in page_lines:
        info = page_analysis[page_number]
        tables = page_tables.get(page_number, [])
        body_lines = tuple(
            line for line in lines
            if not _suppress_line(line, suppressed, height, header_mode, footer_mode)
            and not any(line_inside_table(line.bbox, candidate.bbox) for candidate, _ in tables)
        )
        order_input = (*body_lines, *(_table_marker(candidate, index) for index, (candidate, _) in enumerate(tables)))
        order = reconstruct_reading_order(
            tuple(order_input), info["width"], info["height"], page_number,
        )
        diagnostics.extend(order.diagnostics)
        info.update({
            "readingOrder": order.mode, "readingOrderConfidence": order.confidence,
            "lineCount": len(lines), "bodyLineCount": len(body_lines),
        })
        sequence, native_blocks = _ordered_page_sequence(order.lines, tables, page_number)
        sequences[page_number] = sequence
        all_native_blocks.extend(native_blocks)

    inferred = {
        (block.page, block.block_index): block
        for block in infer_heading_levels(tuple(all_native_blocks))
    }
    semantic_blocks = _semantic_sequence(sequences, inferred, sorted(page_analysis))
    headers = [item for item in running if item["kind"] == "header"]
    footers = [item for item in running if item["kind"] == "footer"]
    metadata = {
        "backend": "pdfplumber/pdfminer.six",
        "backendVersions": result.backend_versions,
        "pdfMetadata": result.metadata,
        "coordinateSystem": "top-left-points",
        "pages": [page_analysis[index] for index in sorted(page_analysis)],
        "headerMode": header_mode, "footerMode": footer_mode,
        "runningHeaderCount": len(headers), "runningFooterCount": len(footers),
        "pdfTableRevision": PDF_TABLE_REVISION,
    }
    _apply_running_policy(metadata, diagnostics, headers, footers, header_mode, footer_mode)
    document = DocumentModel(
        "pdf", tuple(semantic_blocks), metadata=metadata, diagnostics=tuple(diagnostics),
    )
    stats = {
        "pages": len(result.pages),
        "paragraphs": sum(isinstance(block, NativeBlock) for seq in sequences.values() for block in seq),
        "tables": sum(isinstance(block, TableBlock) for seq in sequences.values() for block in seq),
        "chars": sum(page.signals.char_count for page in result.pages),
        "reading_order_ambiguous_pages": sum(
            page_analysis[index].get("readingOrder") == "ambiguous" for index in page_analysis
        ),
        "native_text_inadequate_pages": sum(
            not page_analysis[index]["nativeTextQuality"]["adequate"] for index in page_analysis
        ),
        "backend_versions": result.backend_versions,
    }
    return document, stats


def _extract_table_candidates(pdf_bytes, password, max_pages, native_backend_arg, table_backend_arg):
    if table_backend_arg is False:
        return {}, ()
    if table_backend_arg is None and native_backend_arg is not None:
        return {}, ()
    table_backend = table_backend_arg or PdfPlumberTableBackend()
    try:
        return table_backend.extract(pdf_bytes, password=password, max_pages=max_pages), ()
    except Exception as exc:
        return {}, ({
            "code": "PDF_TABLE_EXTRACTION_FAILED", "severity": "WARNING",
            "message": f"PDF table candidate extraction failed; native text retained: {exc}",
            "provenance": {"source_type": "pdf"},
        },)


def _page_analysis(page, quality, classification, lines, candidates, normalized) -> dict:
    table_heavy = bool(normalized) and classification.page_type != "ENGINEERING_DRAWING"
    return {
        "page": page.signals.page, "width": page.signals.width, "height": page.signals.height,
        "charCount": page.signals.char_count, "rawCharCount": page.signals.raw_char_count,
        "lineObjectCount": page.signals.line_object_count, "rectCount": page.signals.rect_count,
        "curveCount": page.signals.curve_count, "imageCount": page.signals.image_count,
        "imageAreaRatio": page.signals.image_area_ratio, "duplicateRatio": page.signals.duplicate_ratio,
        "nativeTextQuality": {
            "score": quality.score, "adequate": quality.adequate,
            "printableRatio": quality.printable_ratio,
            "replacementRatio": quality.replacement_ratio,
            "controlRatio": quality.control_ratio,
            "visibleCharCount": quality.visible_char_count,
            "reasons": list(quality.reasons),
        },
        "classification": "TABLE_HEAVY" if table_heavy else classification.page_type,
        "classificationConfidence": max(0.9, classification.confidence) if table_heavy else classification.confidence,
        "classificationReasons": (
            [*classification.reasons, f"{len(normalized)} accepted table region(s)"]
            if table_heavy else list(classification.reasons)
        ),
        "tableCandidateCount": len(candidates.get(page.signals.page, ())),
        "acceptedTableCount": len(normalized),
        "acceptedTables": [
            {
                "strategy": candidate.strategy, "bbox": list(candidate.bbox),
                "confidence": candidate.confidence, "rowCount": candidate.row_count,
                "columnCount": candidate.column_count, "reasons": list(candidate.reasons),
            }
            for candidate, _ in normalized
        ],
        "lineCount": len(lines),
    }


def _table_marker(candidate, index: int) -> NativeLine:
    text = f"{_TABLE_MARKER_PREFIX}{index}{_TABLE_MARKER_SUFFIX}"
    return NativeLine(
        f"p{candidate.page}:table-marker:{index}", text, candidate.bbox,
        (), (), 0.0, None, False, False,
    )


def _ordered_page_sequence(lines, tables, page_number):
    sequence: list[NativeBlock | TableBlock] = []
    native_blocks: list[NativeBlock] = []
    buffer: list[NativeLine] = []
    next_index = 0

    def flush() -> None:
        nonlocal next_index
        if not buffer:
            return
        grouped = group_lines_into_blocks(tuple(buffer), page_number)
        for block in grouped:
            adjusted = replace(block, block_index=next_index)
            sequence.append(adjusted)
            native_blocks.append(adjusted)
            next_index += 1
        buffer.clear()

    for line in lines:
        marker = _parse_table_marker(line.text)
        if marker is None:
            buffer.append(line)
            continue
        flush()
        if 0 <= marker < len(tables):
            sequence.append(tables[marker][1])
    flush()
    return sequence, native_blocks


def _parse_table_marker(text: str) -> int | None:
    if not text.startswith(_TABLE_MARKER_PREFIX) or not text.endswith(_TABLE_MARKER_SUFFIX):
        return None
    try:
        return int(text[len(_TABLE_MARKER_PREFIX):-len(_TABLE_MARKER_SUFFIX)])
    except ValueError:
        return None


def _semantic_sequence(sequences, inferred, pages):
    result = []
    for page_index, page in enumerate(pages):
        for item in sequences.get(page, []):
            if isinstance(item, NativeBlock):
                result.append(_semantic_block(inferred.get((page, item.block_index), item)))
            else:
                result.append(item)
        if page_index + 1 < len(pages):
            result.append(PageBreakBlock(
                f"pdf:p{page}:break", SourceRef("pdf", page=page, extraction="page-boundary"),
            ))
    return result


def _suppress_line(line, suppressed, height, header_mode, footer_mode) -> bool:
    if line.line_id not in suppressed:
        return False
    ratio = ((line.bbox[1] + line.bbox[3]) / 2.0) / max(1.0, height)
    if ratio <= 0.08:
        return header_mode != "keep"
    if ratio >= 0.92:
        return footer_mode != "keep"
    return False


def _semantic_block(block: NativeBlock) -> ParagraphBlock:
    provenance = SourceRef("pdf", page=block.page, bbox=block.bbox, extraction="embedded-text")
    refs = tuple(
        SourceRef("pdf", page=block.page, bbox=line.bbox, extraction="embedded-text")
        for line in block.lines
    )
    spans = tuple(
        PositionedSpan(span.text, span.bbox, span.font, span.size, span.bold, span.italic, block.page)
        for line in block.lines for span in line.spans
    )
    return ParagraphBlock(
        f"pdf:p{block.page}:b{block.block_index}", block.text, provenance,
        heading_level=block.heading_level, source_refs=refs, positioned_spans=spans,
    )


def _apply_running_policy(metadata, diagnostics, headers, footers, header_mode, footer_mode):
    if header_mode != "drop":
        metadata["runningHeaders"] = headers
    else:
        diagnostics.extend(_drop_running_diagnostics(headers, "header"))
    if footer_mode != "drop":
        metadata["runningFooters"] = footers
    else:
        diagnostics.extend(_drop_running_diagnostics(footers, "footer"))


def _page_diagnostic(code: str, severity: str, page: int, message: str) -> dict:
    return {
        "code": code, "severity": severity, "message": message,
        "provenance": {"source_type": "pdf", "page": page},
    }


def _drop_running_diagnostics(items: list[dict], kind: str) -> list[dict]:
    return [{
        "code": f"PDF_RUNNING_{kind.upper()}_DROPPED", "severity": "INFO",
        "message": f"Repeated PDF {kind} intentionally dropped: {item['text']}",
        "provenance": {"source_type": "pdf", "page": item["pages"][0]},
    } for item in items]


def render_pdf_document(
    document: DocumentModel, table_mode: str = "auto",
    table_decisions: list[tuple[str, TableRenderDecision]] | None = None,
) -> str:
    parts: list[str] = []
    for block in document.blocks:
        if isinstance(block, PageBreakBlock):
            parts.append("---")
        elif isinstance(block, ParagraphBlock):
            text = block.text.strip()
            if text:
                parts.append(f"{'#' * block.heading_level} {text}" if block.heading_level else text)
        elif isinstance(block, TableBlock):
            rendered, decision = render_table_by_policy(
                block, table_mode, cell_text=_pdf_cell_text, html_renderer=_render_pdf_table_html,
            )
            parts.append(rendered)
            if table_decisions is not None:
                table_decisions.append((block.block_id, decision))
    return "\n\n".join(parts).rstrip() + "\n" if parts else "\n"


def _pdf_cell_text(cell: TableCell) -> str:
    return " ".join(
        block.text.replace("\n", " ").strip()
        for block in cell.blocks if isinstance(block, ParagraphBlock) and block.text.strip()
    )


def _render_pdf_table_html(table: TableBlock) -> str:
    lines = ["<table>"]
    for row in table.rows:
        lines.append("  <tr>")
        for cell in row.cells:
            attrs = []
            if cell.column_span != 1:
                attrs.append(f'colspan="{cell.column_span}"')
            if cell.row_span != 1:
                attrs.append(f'rowspan="{cell.row_span}"')
            attr = f" {' '.join(attrs)}" if attrs else ""
            lines.append(f"    <td{attr}>{html.escape(_pdf_cell_text(cell), quote=False)}</td>")
        lines.append("  </tr>")
    lines.append("</table>")
    return "\n".join(lines)


def convert_pdf_bytes(
    pdf_bytes: bytes, *, password: str | None = None,
    header_mode: str = "metadata", footer_mode: str = "metadata",
    table_mode: str = "auto", backend=None, table_backend=None,
) -> tuple[bytes, dict]:
    document, stats = parse_pdf_bytes(
        pdf_bytes, password=password, header_mode=header_mode, footer_mode=footer_mode,
        backend=backend, table_backend=table_backend,
    )
    decisions: list[tuple[str, TableRenderDecision]] = []
    output = render_pdf_document(document, table_mode, decisions).encode("utf-8")
    options = _canonical_options(
        header_mode, footer_mode, document.metadata.get("backendVersions", {}), table_mode,
    )
    return output, {
        **stats, "source_sha256": sha256_hex(pdf_bytes),
        "source_git_blob_sha": git_blob_sha(pdf_bytes), "output_sha256": sha256_hex(output),
        "output_bytes": len(output), "options_hash": options_hash(options),
        "pdf_conversion_revision": PDF_CONVERSION_REVISION,
        "table_renderers": [decision.renderer for _, decision in decisions],
        "table_render_fallbacks": sum(decision.diagnostic is not None for _, decision in decisions),
    }


def conversion_evidence(
    pdf_bytes: bytes, *, password: str | None = None,
    header_mode: str = "metadata", footer_mode: str = "metadata",
    table_mode: str = "auto", backend=None, table_backend=None,
) -> dict:
    document, _ = parse_pdf_bytes(
        pdf_bytes, password=password, header_mode=header_mode, footer_mode=footer_mode,
        backend=backend, table_backend=table_backend,
    )
    decisions: list[tuple[str, TableRenderDecision]] = []
    render_pdf_document(document, table_mode, decisions)
    evidence = build_evidence(
        document, source_sha256=sha256_hex(pdf_bytes), source_git_blob_sha=git_blob_sha(pdf_bytes),
        profile="readable",
        options=_canonical_options(
            header_mode, footer_mode, document.metadata.get("backendVersions", {}), table_mode,
        ),
    )
    evidence["pdfConversionRevision"] = PDF_CONVERSION_REVISION
    evidence["tableRendering"] = [
        {
            "blockId": block_id, "requestedMode": decision.requested_mode,
            "renderer": decision.renderer, "classification": decision.classification,
            "reasons": list(decision.reasons),
            **({"diagnostic": decision.diagnostic} if decision.diagnostic else {}),
        }
        for block_id, decision in decisions
    ]
    evidence["diagnostics"].extend(
        {**decision.diagnostic, "blockId": block_id}
        for block_id, decision in decisions if decision.diagnostic is not None
    )
    return evidence


def _canonical_options(
    header_mode: str, footer_mode: str, backend_versions: dict[str, str] | None = None,
    table_mode: str = "auto",
) -> dict:
    return {
        "profile": "readable", "sourceType": "pdf", "headers": header_mode,
        "footers": footer_mode, "ocr": "never", "tableMode": table_mode,
        "pdfTableRevision": PDF_TABLE_REVISION,
        "backendVersions": dict(sorted((backend_versions or {}).items())),
    }


def default_output_path(input_path: Path) -> Path:
    return input_path.with_suffix(".md")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Input PDF path")
    parser.add_argument("-o", "--output", type=Path, help="Output Markdown path")
    parser.add_argument("--evidence", type=Path, help="Optional deterministic evidence JSON path")
    parser.add_argument("--pdf-password", help="Password for an encrypted PDF")
    parser.add_argument("--headers", choices=("keep", "metadata", "drop"), default="metadata")
    parser.add_argument("--footers", choices=("keep", "metadata", "drop"), default="metadata")
    parser.add_argument("--table-mode", choices=TABLE_MODES, default="auto")
    parser.add_argument("--stats-json", action="store_true")
    return parser


def run_cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.input.is_file():
        raise ValueError(f"Input file does not exist: {args.input}")
    source = args.input.read_bytes()
    output, stats = convert_pdf_bytes(
        source, password=args.pdf_password, header_mode=args.headers,
        footer_mode=args.footers, table_mode=args.table_mode,
    )
    output_path = args.output or default_output_path(args.input)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output)
    if args.evidence:
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_bytes(canonical_json_bytes(conversion_evidence(
            source, password=args.pdf_password, header_mode=args.headers,
            footer_mode=args.footers, table_mode=args.table_mode,
        )))
    if args.stats_json:
        print(json.dumps({**stats, "output_path": str(output_path)}, sort_keys=True))
    else:
        print(f"wrote {output_path} ({stats['output_bytes']} bytes)")
    return 0
