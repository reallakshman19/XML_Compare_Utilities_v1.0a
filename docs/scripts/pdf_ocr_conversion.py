"""Controlled OCR layer over native/table PDF semantic conversion."""

from __future__ import annotations

from dataclasses import replace
import argparse
import hashlib
import json
from pathlib import Path

from document_model import (
    DocumentModel, PageBreakBlock, ParagraphBlock, SourceRef,
    build_evidence, canonical_json_bytes, options_hash,
)
from pdf_conversion import parse_pdf_bytes, render_pdf_document
from pdf_ocr import (
    DEFAULT_OCR_CONFIDENCE_MIN, DEFAULT_OCR_MAX_JOB_PIXELS,
    DEFAULT_OCR_MAX_MEMORY_BYTES, DEFAULT_OCR_MAX_PAGES, DEFAULT_OCR_MAX_PIXELS,
    DEFAULT_OCR_SCALE, DEFAULT_OCR_TIMEOUT_SECONDS, OCR_MODES, OCR_REVISION,
    OCR_WARNING_CONFIDENCE, OcrError, PdfiumRasterizer, TesseractCliEngine,
    merge_ocr_page_blocks, ocr_decision, ocr_paragraph_blocks,
    ocr_result_evidence, validate_ocr_language,
)
from table_rendering import TABLE_MODES, TableRenderDecision

PDF_OCR_CONVERSION_REVISION = "pdf-ocr-controlled-v1"
PDF_OCR_CANONICALIZATION_VERSION = "6-pdf-ocr"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def convert_pdf_bytes(
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
    backend=None,
    table_backend=None,
    rasterizer=None,
    ocr_engine=None,
) -> tuple[bytes, dict]:
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
    decisions: list[tuple[str, TableRenderDecision]] = []
    output = render_pdf_document(document, table_mode, decisions).encode("utf-8")
    options = _canonical_options(
        document, header_mode, footer_mode, table_mode, ocr_mode, ocr_language,
        ocr_confidence_min, ocr_scale, ocr_max_pixels, ocr_max_memory_bytes,
        ocr_max_pages, ocr_max_job_pixels, ocr_timeout_seconds,
    )
    return output, {
        **native_stats,
        **ocr_stats,
        "source_sha256": sha256_hex(pdf_bytes),
        "source_git_blob_sha": git_blob_sha(pdf_bytes),
        "output_sha256": sha256_hex(output),
        "output_bytes": len(output),
        "options_hash": options_hash(options),
        "pdf_ocr_conversion_revision": PDF_OCR_CONVERSION_REVISION,
        "table_renderers": [decision.renderer for _, decision in decisions],
        "table_render_fallbacks": sum(decision.diagnostic is not None for _, decision in decisions),
    }


def apply_ocr(
    document: DocumentModel,
    pdf_bytes: bytes,
    *,
    password: str | None,
    mode: str,
    language: str,
    confidence_min: float,
    scale: float,
    max_pixels: int,
    max_memory_bytes: int,
    max_pages: int,
    max_job_pixels: int,
    timeout_seconds: float,
    rasterizer=None,
    engine=None,
) -> tuple[DocumentModel, dict]:
    _validate_policy(
        mode, language, confidence_min, scale, max_pixels, max_memory_bytes,
        max_pages, max_job_pixels, timeout_seconds,
    )
    pages = list(document.metadata.get("pages", []))
    decisions = [(page, ocr_decision(page, mode)) for page in pages]
    targets = [(page, decision) for page, decision in decisions if decision.run]
    if len(targets) > max_pages:
        raise OcrError(
            "OCR_PAGE_LIMIT_EXCEEDED",
            f"OCR requested for {len(targets)} pages; configured maximum is {max_pages}",
            "FATAL",
        )

    metadata = dict(document.metadata)
    metadata.update({
        "ocrMode": mode,
        "ocrLanguage": language,
        "ocrRevision": OCR_REVISION,
        "ocrDecisions": [
            {
                "page": int(page.get("page", 0)), "run": decision.run,
                "reason": decision.reason, "layoutSafe": decision.layout_safe,
            }
            for page, decision in decisions
        ],
    })
    if not targets:
        metadata["ocrPages"] = []
        return replace(document, metadata=metadata), _empty_ocr_stats()

    rasterizer = rasterizer or PdfiumRasterizer()
    engine = engine or TesseractCliEngine()
    blocks_by_page, page_breaks = _blocks_by_page(document)
    diagnostics = list(document.diagnostics)
    evidence_pages: list[dict] = []
    job_pixels = completed = degraded = dedup_total = conflicts_total = added_total = 0

    for page_info, decision in targets:
        page_number = int(page_info["page"])
        existing = tuple(blocks_by_page.get(page_number, []))
        try:
            raster = rasterizer.render_page(
                pdf_bytes, page_number, password=password, requested_scale=scale,
                max_pixels=max_pixels, max_memory_bytes=max_memory_bytes,
            )
            if job_pixels + raster.pixels > max_job_pixels:
                raise OcrError(
                    "OCR_JOB_PIXEL_LIMIT_EXCEEDED",
                    f"OCR job would exceed {max_job_pixels} raster pixels at page {page_number}",
                    "FATAL",
                )
            job_pixels += raster.pixels
            result = engine.recognize(raster, language=language, timeout_seconds=timeout_seconds)
            completed += 1
            page_evidence = ocr_result_evidence(result)
            page_evidence.update({"decisionReason": decision.reason, "layoutSafe": decision.layout_safe})

            if result.confidence < confidence_min or not result.words:
                degraded += 1
                code = "OCR_TEXT_EMPTY" if not result.words else "OCR_LOW_CONFIDENCE"
                message = (
                    "OCR produced no words" if not result.words
                    else f"OCR page confidence {result.confidence:.2f} below minimum {confidence_min:.2f}"
                )
                diagnostics.append(_ocr_diagnostic(code, "ERROR", page_number, message, result.confidence))
                blocks_by_page[page_number] = [*existing, _marker_block(page_number, code, result.confidence)]
                page_evidence["canonicalAction"] = "marker-low-confidence"
                evidence_pages.append(page_evidence)
                continue

            if result.confidence < OCR_WARNING_CONFIDENCE:
                diagnostics.append(_ocr_diagnostic(
                    "OCR_LOW_CONFIDENCE", "WARNING", page_number,
                    f"OCR page confidence {result.confidence:.2f} below warning threshold {OCR_WARNING_CONFIDENCE:.2f}",
                    result.confidence,
                ))

            if not decision.layout_safe and not _has_native_table(existing):
                degraded += 1
                diagnostics.append(_ocr_diagnostic(
                    "OCR_LAYOUT_UNRESOLVED", "ERROR", page_number,
                    f"OCR text was extracted for {page_info.get('classification')} content, but paragraph ordering would risk corrupting table/drawing structure",
                    result.confidence,
                ))
                blocks_by_page[page_number] = [*existing, _marker_block(page_number, "OCR_LAYOUT_UNRESOLVED", result.confidence)]
                page_evidence["canonicalAction"] = "marker-layout-unresolved"
                evidence_pages.append(page_evidence)
                continue

            merge = merge_ocr_page_blocks(
                existing, ocr_paragraph_blocks(result), page=page_number,
                page_width=float(page_info.get("width", raster.page_width)),
                page_height=float(page_info.get("height", raster.page_height)),
            )
            blocks_by_page[page_number] = list(merge.blocks)
            diagnostics.extend(merge.diagnostics)
            dedup_total += merge.deduplicated
            conflicts_total += merge.conflicts
            added_total += merge.added
            page_evidence.update({
                "canonicalAction": "merge",
                "deduplicatedBlocks": merge.deduplicated,
                "conflicts": merge.conflicts,
                "addedBlocks": merge.added,
            })
            evidence_pages.append(page_evidence)
        except OcrError as exc:
            if exc.severity == "FATAL":
                raise
            degraded += 1
            diagnostics.append(_ocr_diagnostic(exc.code, exc.severity, page_number, str(exc)))
            blocks_by_page[page_number] = [*existing, _marker_block(page_number, exc.code, None)]
            evidence_pages.append({
                "page": page_number, "decisionReason": decision.reason,
                "layoutSafe": decision.layout_safe, "canonicalAction": "marker-error",
                "error": {"code": exc.code, "severity": exc.severity, "message": str(exc)},
            })

    metadata.update({
        "ocrPages": evidence_pages,
        "ocrEngineVersion": getattr(engine, "version", lambda: "unknown")(),
        "ocrRasterizerVersion": getattr(rasterizer, "version", lambda: "unknown")(),
        "ocrPolicy": {
            "confidenceMin": confidence_min,
            "warningConfidence": OCR_WARNING_CONFIDENCE,
            "requestedScale": scale,
            "maxPixelsPerPage": max_pixels,
            "maxMemoryBytesPerPage": max_memory_bytes,
            "maxPages": max_pages,
            "maxJobPixels": max_job_pixels,
            "timeoutSeconds": timeout_seconds,
        },
    })
    blocks = _reassemble_pages(blocks_by_page, page_breaks, [int(page["page"]) for page in pages])
    converted = replace(document, blocks=blocks, metadata=metadata, diagnostics=tuple(diagnostics))
    return converted, {
        "ocr_pages_requested": len(targets), "ocr_pages_completed": completed,
        "ocr_pages_degraded": degraded, "ocr_deduplicated_blocks": dedup_total,
        "ocr_conflicts": conflicts_total, "ocr_added_blocks": added_total,
        "ocr_job_pixels": job_pixels,
    }


def conversion_evidence(
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
    backend=None,
    table_backend=None,
    rasterizer=None,
    ocr_engine=None,
) -> dict:
    document, _ = parse_pdf_bytes(
        pdf_bytes, password=password, header_mode=header_mode,
        footer_mode=footer_mode, backend=backend, table_backend=table_backend,
    )
    document, _ = apply_ocr(
        document, pdf_bytes, password=password, mode=ocr_mode,
        language=ocr_language, confidence_min=ocr_confidence_min,
        scale=ocr_scale, max_pixels=ocr_max_pixels,
        max_memory_bytes=ocr_max_memory_bytes, max_pages=ocr_max_pages,
        max_job_pixels=ocr_max_job_pixels, timeout_seconds=ocr_timeout_seconds,
        rasterizer=rasterizer, engine=ocr_engine,
    )
    decisions: list[tuple[str, TableRenderDecision]] = []
    render_pdf_document(document, table_mode, decisions)
    options = _canonical_options(
        document, header_mode, footer_mode, table_mode, ocr_mode, ocr_language,
        ocr_confidence_min, ocr_scale, ocr_max_pixels, ocr_max_memory_bytes,
        ocr_max_pages, ocr_max_job_pixels, ocr_timeout_seconds,
    )
    evidence = build_evidence(
        document, source_sha256=sha256_hex(pdf_bytes),
        source_git_blob_sha=git_blob_sha(pdf_bytes), profile="readable", options=options,
    )
    evidence.update({
        "converterRevision": PDF_OCR_CONVERSION_REVISION,
        "canonicalizationVersion": PDF_OCR_CANONICALIZATION_VERSION,
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


def _validate_policy(mode, language, confidence, scale, max_pixels, max_memory, max_pages, max_job_pixels, timeout):
    if mode not in OCR_MODES:
        raise OcrError("OCR_MODE_INVALID", f"Unsupported OCR mode: {mode}", "FATAL")
    validate_ocr_language(language)
    if not 0 <= confidence <= 1:
        raise OcrError("OCR_CONFIDENCE_INVALID", "OCR confidence threshold must be between 0 and 1", "FATAL")
    if scale <= 0 or max_pixels <= 0 or max_memory <= 0 or max_pages < 0 or max_job_pixels <= 0 or timeout <= 0:
        raise OcrError("OCR_POLICY_INVALID", "OCR scale, budgets, and timeout must be positive", "FATAL")


def _canonical_options(document, headers, footers, table_mode, ocr_mode, language, confidence, scale, max_pixels, max_memory, max_pages, max_job_pixels, timeout):
    return {
        "profile": "readable", "sourceType": "pdf", "headers": headers,
        "footers": footers, "tableMode": table_mode,
        "backendVersions": dict(sorted((document.metadata.get("backendVersions") or {}).items())),
        "ocr": ocr_mode, "ocrLanguage": language, "ocrConfidenceMin": confidence,
        "ocrScale": scale, "ocrMaxPixels": max_pixels, "ocrMaxMemoryBytes": max_memory,
        "ocrMaxPages": max_pages, "ocrMaxJobPixels": max_job_pixels,
        "ocrTimeoutSeconds": timeout, "pdfOcrRevision": OCR_REVISION,
        "ocrEngineVersion": document.metadata.get("ocrEngineVersion", "not-invoked"),
        "ocrRasterizerVersion": document.metadata.get("ocrRasterizerVersion", "not-invoked"),
    }


def _empty_ocr_stats() -> dict:
    return {
        "ocr_pages_requested": 0, "ocr_pages_completed": 0, "ocr_pages_degraded": 0,
        "ocr_deduplicated_blocks": 0, "ocr_conflicts": 0, "ocr_added_blocks": 0,
        "ocr_job_pixels": 0,
    }


def _blocks_by_page(document: DocumentModel):
    values: dict[int, list[object]] = {}
    breaks: dict[int, PageBreakBlock] = {}
    for block in document.blocks:
        page = getattr(getattr(block, "provenance", None), "page", None)
        if isinstance(block, PageBreakBlock):
            if page is not None:
                breaks[int(page)] = block
        elif page is not None:
            values.setdefault(int(page), []).append(block)
    return values, breaks


def _reassemble_pages(blocks_by_page, page_breaks, pages):
    result = []
    for index, page in enumerate(pages):
        result.extend(blocks_by_page.get(page, []))
        if index + 1 < len(pages):
            result.append(page_breaks.get(page) or PageBreakBlock(
                f"pdf:p{page}:break", SourceRef("pdf", page=page, extraction="page-boundary"),
            ))
    return tuple(result)


def _has_native_table(blocks: tuple[object, ...]) -> bool:
    return any(block.__class__.__name__ == "TableBlock" for block in blocks)


def _marker_block(page: int, code: str, confidence: float | None) -> ParagraphBlock:
    provenance = SourceRef("pdf", page=page, extraction="ocr", confidence=confidence)
    return ParagraphBlock(
        f"pdf:p{page}:ocr-marker:{code.lower()}", f"⟦{code}:PAGE {page}⟧",
        provenance, source_refs=(provenance,),
    )


def _ocr_diagnostic(code: str, severity: str, page: int, message: str, confidence: float | None = None) -> dict:
    provenance = {"source_type": "pdf", "page": page, "extraction": "ocr"}
    if confidence is not None:
        provenance["confidence"] = confidence
    return {"code": code, "severity": severity, "message": message, "provenance": provenance}


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
    parser.add_argument("--stats-json", action="store_true")
    return parser


def run_cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.input.is_file():
        raise ValueError(f"Input file does not exist: {args.input}")
    source = args.input.read_bytes()
    memory_bytes = args.ocr_memory_mb * 1024 * 1024
    kwargs = {
        "password": args.pdf_password, "header_mode": args.headers, "footer_mode": args.footers,
        "table_mode": args.table_mode, "ocr_mode": args.ocr, "ocr_language": args.ocr_language,
        "ocr_confidence_min": args.ocr_confidence_min, "ocr_scale": args.ocr_scale,
        "ocr_max_pixels": args.ocr_max_pixels, "ocr_max_memory_bytes": memory_bytes,
        "ocr_max_pages": args.ocr_max_pages, "ocr_max_job_pixels": args.ocr_max_job_pixels,
        "ocr_timeout_seconds": args.ocr_timeout,
    }
    output, stats = convert_pdf_bytes(source, **kwargs)
    output_path = args.output or args.input.with_suffix(".md")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output)
    if args.evidence:
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_bytes(canonical_json_bytes(conversion_evidence(source, **kwargs)))
    if args.stats_json:
        print(json.dumps({**stats, "output_path": str(output_path)}, sort_keys=True))
    else:
        print(f"wrote {output_path} ({stats['output_bytes']} bytes)")
    return 0
