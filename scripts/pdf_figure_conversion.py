"""PDF native/table/OCR conversion with deterministic figure/image assets."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
from pathlib import Path

from document_model import (
    DocumentModel, PageBreakBlock, ParagraphBlock, TableBlock, TableCell,
    build_evidence, canonical_json_bytes, options_hash,
)
from pdf_conversion import parse_pdf_bytes
from pdf_figures import (
    DEFAULT_FIGURE_MAX_ASSETS, DEFAULT_FIGURE_MAX_JOB_PIXELS,
    DEFAULT_FIGURE_MAX_MEMORY_BYTES, DEFAULT_FIGURE_MAX_PIXELS,
    DEFAULT_FIGURE_SCALE, FIGURE_MODES, PDF_FIGURE_REVISION,
    FigureBlock, apply_pdf_figures, materialize_figure_assets,
)
from pdf_ocr import (
    DEFAULT_OCR_CONFIDENCE_MIN, DEFAULT_OCR_MAX_JOB_PIXELS,
    DEFAULT_OCR_MAX_MEMORY_BYTES, DEFAULT_OCR_MAX_PAGES, DEFAULT_OCR_MAX_PIXELS,
    DEFAULT_OCR_SCALE, DEFAULT_OCR_TIMEOUT_SECONDS, OCR_MODES, OCR_REVISION,
)
from pdf_ocr_conversion import apply_ocr
from table_rendering import TABLE_MODES, TableRenderDecision, render_table_by_policy

PDF_FIGURE_CONVERSION_REVISION = "pdf-figures-v1"
PDF_FIGURE_CANONICALIZATION_VERSION = "7-pdf-figures"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def prepare_pdf_document(
    pdf_bytes: bytes,
    *,
    password: str | None = None,
    header_mode: str = "metadata",
    footer_mode: str = "metadata",
    table_mode: str = "auto",
    ocr_mode: str = "auto",
    ocr_language: str = "eng",
    ocr_confidence_min: float = DEFAULT_OCR_CONFIDENCE_MIN,
    ocr_scale: float = DEFAULT_OCR_SCALE,
    ocr_max_pixels: int = DEFAULT_OCR_MAX_PIXELS,
    ocr_max_memory_bytes: int = DEFAULT_OCR_MAX_MEMORY_BYTES,
    ocr_max_pages: int = DEFAULT_OCR_MAX_PAGES,
    ocr_max_job_pixels: int = DEFAULT_OCR_MAX_JOB_PIXELS,
    ocr_timeout_seconds: float = DEFAULT_OCR_TIMEOUT_SECONDS,
    image_mode: str = "extract",
    figure_scale: float = DEFAULT_FIGURE_SCALE,
    figure_max_pixels: int = DEFAULT_FIGURE_MAX_PIXELS,
    figure_max_memory_bytes: int = DEFAULT_FIGURE_MAX_MEMORY_BYTES,
    figure_max_assets: int = DEFAULT_FIGURE_MAX_ASSETS,
    figure_max_job_pixels: int = DEFAULT_FIGURE_MAX_JOB_PIXELS,
    backend=None,
    table_backend=None,
    rasterizer=None,
    ocr_engine=None,
    figure_backend=None,
    figure_rasterizer=None,
) -> tuple[DocumentModel, dict, dict[str, bytes]]:
    document, native_stats = parse_pdf_bytes(
        pdf_bytes, password=password, header_mode=header_mode,
        footer_mode=footer_mode, backend=backend, table_backend=table_backend,
    )
    document, ocr_stats = apply_ocr(
        document, pdf_bytes, password=password, mode=ocr_mode,
        language=ocr_language, confidence_min=ocr_confidence_min,
        scale=ocr_scale, max_pixels=ocr_max_pixels,
        max_memory_bytes=ocr_max_memory_bytes, max_pages=ocr_max_pages,
        max_job_pixels=ocr_max_job_pixels, timeout_seconds=ocr_timeout_seconds,
        rasterizer=rasterizer, engine=ocr_engine,
    )
    figures = apply_pdf_figures(
        document, pdf_bytes, password=password, mode=image_mode,
        backend=figure_backend, rasterizer=figure_rasterizer,
        requested_scale=figure_scale, max_pixels=figure_max_pixels,
        max_memory_bytes=figure_max_memory_bytes, max_assets=figure_max_assets,
        max_job_pixels=figure_max_job_pixels,
    )
    return figures.document, {**native_stats, **ocr_stats, **figures.stats}, figures.payloads


def render_pdf_document(
    document: DocumentModel,
    table_mode: str = "auto",
    table_decisions: list[tuple[str, TableRenderDecision]] | None = None,
) -> str:
    parts: list[str] = []
    for block in document.blocks:
        if isinstance(block, PageBreakBlock):
            parts.append("---")
        elif isinstance(block, FigureBlock):
            if block.filename:
                alt = _markdown_alt(block.alt_text or block.caption or f"Figure page {block.provenance.page}")
                parts.append(f"![{alt}](assets/{block.filename})")
            else:
                parts.append(f"⟦FIGURE_SKIPPED:PAGE {block.provenance.page} IMAGE {block.source_index}⟧")
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


def convert_pdf_bytes(
    pdf_bytes: bytes,
    *,
    asset_payloads_out: dict[str, bytes] | None = None,
    **kwargs,
) -> tuple[bytes, dict]:
    document, stats, payloads = prepare_pdf_document(pdf_bytes, **kwargs)
    if asset_payloads_out is not None:
        asset_payloads_out.update(payloads)
    decisions: list[tuple[str, TableRenderDecision]] = []
    output = render_pdf_document(document, kwargs.get("table_mode", "auto"), decisions).encode("utf-8")
    options = _canonical_options(document, kwargs)
    return output, {
        **stats,
        "source_sha256": sha256_hex(pdf_bytes),
        "source_git_blob_sha": git_blob_sha(pdf_bytes),
        "output_sha256": sha256_hex(output),
        "output_bytes": len(output),
        "options_hash": options_hash(options),
        "pdf_figure_conversion_revision": PDF_FIGURE_CONVERSION_REVISION,
        "semantic_schema_version": document.semantic_schema_version,
        "assets": len(document.assets),
        "table_renderers": [decision.renderer for _, decision in decisions],
        "table_render_fallbacks": sum(decision.diagnostic is not None for _, decision in decisions),
    }


def conversion_evidence(pdf_bytes: bytes, **kwargs) -> dict:
    document, _, _ = prepare_pdf_document(pdf_bytes, **kwargs)
    decisions: list[tuple[str, TableRenderDecision]] = []
    render_pdf_document(document, kwargs.get("table_mode", "auto"), decisions)
    evidence = build_evidence(
        document, source_sha256=sha256_hex(pdf_bytes),
        source_git_blob_sha=git_blob_sha(pdf_bytes),
        profile="readable", options=_canonical_options(document, kwargs),
    )
    evidence.update({
        "converterRevision": PDF_FIGURE_CONVERSION_REVISION,
        "canonicalizationVersion": PDF_FIGURE_CANONICALIZATION_VERSION,
        "pdfFigureRevision": PDF_FIGURE_REVISION,
        "pdfOcrRevision": OCR_REVISION,
        "tableRendering": [
            {
                "blockId": block_id, "requestedMode": decision.requested_mode,
                "renderer": decision.renderer, "classification": decision.classification,
                "reasons": list(decision.reasons),
                **({"diagnostic": decision.diagnostic} if decision.diagnostic else {}),
            }
            for block_id, decision in decisions
        ],
    })
    evidence["diagnostics"].extend(
        {**decision.diagnostic, "blockId": block_id}
        for block_id, decision in decisions if decision.diagnostic is not None
    )
    return evidence


def _canonical_options(document: DocumentModel, kwargs: dict) -> dict:
    return {
        "profile": "readable",
        "sourceType": "pdf",
        "headers": kwargs.get("header_mode", "metadata"),
        "footers": kwargs.get("footer_mode", "metadata"),
        "tableMode": kwargs.get("table_mode", "auto"),
        "backendVersions": dict(sorted((document.metadata.get("backendVersions") or {}).items())),
        "ocr": kwargs.get("ocr_mode", "auto"),
        "ocrLanguage": kwargs.get("ocr_language", "eng"),
        "ocrConfidenceMin": kwargs.get("ocr_confidence_min", DEFAULT_OCR_CONFIDENCE_MIN),
        "ocrScale": kwargs.get("ocr_scale", DEFAULT_OCR_SCALE),
        "ocrMaxPixels": kwargs.get("ocr_max_pixels", DEFAULT_OCR_MAX_PIXELS),
        "ocrMaxMemoryBytes": kwargs.get("ocr_max_memory_bytes", DEFAULT_OCR_MAX_MEMORY_BYTES),
        "ocrMaxPages": kwargs.get("ocr_max_pages", DEFAULT_OCR_MAX_PAGES),
        "ocrMaxJobPixels": kwargs.get("ocr_max_job_pixels", DEFAULT_OCR_MAX_JOB_PIXELS),
        "ocrTimeoutSeconds": kwargs.get("ocr_timeout_seconds", DEFAULT_OCR_TIMEOUT_SECONDS),
        "pdfOcrRevision": OCR_REVISION,
        "ocrEngineVersion": document.metadata.get("ocrEngineVersion", "not-invoked"),
        "ocrRasterizerVersion": document.metadata.get("ocrRasterizerVersion", "not-invoked"),
        "images": kwargs.get("image_mode", "extract"),
        "pdfFigureRevision": PDF_FIGURE_REVISION,
        "figureScale": kwargs.get("figure_scale", DEFAULT_FIGURE_SCALE),
        "figureMaxPixels": kwargs.get("figure_max_pixels", DEFAULT_FIGURE_MAX_PIXELS),
        "figureMaxMemoryBytes": kwargs.get("figure_max_memory_bytes", DEFAULT_FIGURE_MAX_MEMORY_BYTES),
        "figureMaxAssets": kwargs.get("figure_max_assets", DEFAULT_FIGURE_MAX_ASSETS),
        "figureMaxJobPixels": kwargs.get("figure_max_job_pixels", DEFAULT_FIGURE_MAX_JOB_PIXELS),
        "figureRasterizerVersion": document.metadata.get("figureRasterizerVersion", "not-invoked"),
        "figurePillowVersion": document.metadata.get("figurePillowVersion", "not-invoked"),
    }


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


def _markdown_alt(value: str) -> str:
    return value.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]").replace("\n", " ").strip()


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
    parser.add_argument("--ocr", choices=OCR_MODES, default="auto")
    parser.add_argument("--ocr-language", default="eng")
    parser.add_argument("--ocr-confidence-min", type=float, default=DEFAULT_OCR_CONFIDENCE_MIN)
    parser.add_argument("--ocr-scale", type=float, default=DEFAULT_OCR_SCALE)
    parser.add_argument("--ocr-max-pixels", type=int, default=DEFAULT_OCR_MAX_PIXELS)
    parser.add_argument("--ocr-memory-mb", type=int, default=DEFAULT_OCR_MAX_MEMORY_BYTES // (1024 * 1024))
    parser.add_argument("--ocr-max-pages", type=int, default=DEFAULT_OCR_MAX_PAGES)
    parser.add_argument("--ocr-max-job-pixels", type=int, default=DEFAULT_OCR_MAX_JOB_PIXELS)
    parser.add_argument("--ocr-timeout", type=float, default=DEFAULT_OCR_TIMEOUT_SECONDS)
    parser.add_argument("--images", choices=FIGURE_MODES, default="extract")
    parser.add_argument("--assets", type=Path, help="Physical directory for deterministic PDF figure assets")
    parser.add_argument("--figure-scale", type=float, default=DEFAULT_FIGURE_SCALE)
    parser.add_argument("--figure-max-pixels", type=int, default=DEFAULT_FIGURE_MAX_PIXELS)
    parser.add_argument("--figure-memory-mb", type=int, default=DEFAULT_FIGURE_MAX_MEMORY_BYTES // (1024 * 1024))
    parser.add_argument("--figure-max-assets", type=int, default=DEFAULT_FIGURE_MAX_ASSETS)
    parser.add_argument("--figure-max-job-pixels", type=int, default=DEFAULT_FIGURE_MAX_JOB_PIXELS)
    parser.add_argument("--stats-json", action="store_true")
    return parser


def run_cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.input.is_file():
        raise ValueError(f"Input file does not exist: {args.input}")
    source = args.input.read_bytes()
    payloads: dict[str, bytes] = {}
    kwargs = {
        "password": args.pdf_password,
        "header_mode": args.headers,
        "footer_mode": args.footers,
        "table_mode": args.table_mode,
        "ocr_mode": args.ocr,
        "ocr_language": args.ocr_language,
        "ocr_confidence_min": args.ocr_confidence_min,
        "ocr_scale": args.ocr_scale,
        "ocr_max_pixels": args.ocr_max_pixels,
        "ocr_max_memory_bytes": args.ocr_memory_mb * 1024 * 1024,
        "ocr_max_pages": args.ocr_max_pages,
        "ocr_max_job_pixels": args.ocr_max_job_pixels,
        "ocr_timeout_seconds": args.ocr_timeout,
        "image_mode": args.images,
        "figure_scale": args.figure_scale,
        "figure_max_pixels": args.figure_max_pixels,
        "figure_max_memory_bytes": args.figure_memory_mb * 1024 * 1024,
        "figure_max_assets": args.figure_max_assets,
        "figure_max_job_pixels": args.figure_max_job_pixels,
    }
    output, stats = convert_pdf_bytes(source, asset_payloads_out=payloads, **kwargs)
    output_path = args.output or default_output_path(args.input)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output)
    if args.images == "extract":
        assets_dir = args.assets or (output_path.parent / "assets")
        stats["assets_written"] = len(materialize_figure_assets(payloads, assets_dir))
    else:
        stats["assets_written"] = 0
    if args.evidence:
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_bytes(canonical_json_bytes(conversion_evidence(source, **kwargs)))
    if args.stats_json:
        print(json.dumps({**stats, "output_path": str(output_path)}, sort_keys=True))
    else:
        print(f"wrote {output_path} ({stats['output_bytes']} bytes)")
    return 0
