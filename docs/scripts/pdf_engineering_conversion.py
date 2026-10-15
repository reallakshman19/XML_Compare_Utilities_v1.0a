"""Engineering-drawing regional extraction over native/table/OCR/figure PDF semantics."""
from __future__ import annotations

from dataclasses import replace
import argparse
import difflib
import hashlib
import json
import re
from pathlib import Path

from document_model import DocumentModel, ParagraphBlock, SourceRef, build_evidence, canonical_json_bytes, options_hash
from pdf_conversion import parse_pdf_bytes
from pdf_figure_conversion import render_pdf_document
from pdf_figures import (
    DEFAULT_FIGURE_MAX_ASSETS, DEFAULT_FIGURE_MAX_JOB_PIXELS,
    DEFAULT_FIGURE_MAX_MEMORY_BYTES, DEFAULT_FIGURE_MAX_PIXELS,
    DEFAULT_FIGURE_SCALE, FIGURE_MODES, PdfFigureCandidate, PdfiumFigureRasterizer,
    PDF_FIGURE_REVISION, apply_pdf_figures, materialize_figure_assets,
)
from pdf_ocr import (
    DEFAULT_OCR_CONFIDENCE_MIN, DEFAULT_OCR_MAX_JOB_PIXELS,
    DEFAULT_OCR_MAX_MEMORY_BYTES, DEFAULT_OCR_MAX_PAGES, DEFAULT_OCR_MAX_PIXELS,
    DEFAULT_OCR_SCALE, DEFAULT_OCR_TIMEOUT_SECONDS, OCR_MODES, OCR_REVISION,
    RasterizedPage, TesseractCliEngine,
)
from pdf_ocr_conversion import apply_ocr
from pdf_engineering_regions import (
    DEFAULT_REGION_MAX_JOB_PIXELS, DEFAULT_REGION_MAX_MEMORY_BYTES, DEFAULT_REGION_MAX_PAGES,
    DEFAULT_REGION_MAX_PIXELS, DEFAULT_REGION_MAX_REGIONS_PER_PAGE, DEFAULT_REGION_SCALE,
    DEFAULT_REGION_TIMEOUT_SECONDS, ENGINEERING_REGION_MODES, ENGINEERING_REGION_REVISION,
    EngineeringRegionError, PdfPlumberEngineeringBackend, plan_engineering_regions,
    region_needs_ocr,
)
from table_rendering import TABLE_MODES, TableRenderDecision

ENGINEERING_CONVERSION_REVISION = "engineering-regions-v1"
ENGINEERING_CANONICALIZATION_VERSION = "8-engineering-regions"
ENGINEERING_CONFIDENCE_MIN = 0.72


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("ascii") + data).hexdigest()


def prepare_engineering_document(
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
    engineering_regions: str = "auto",
    engineering_scale: float = DEFAULT_REGION_SCALE,
    engineering_max_pixels: int = DEFAULT_REGION_MAX_PIXELS,
    engineering_max_memory_bytes: int = DEFAULT_REGION_MAX_MEMORY_BYTES,
    engineering_max_pages: int = DEFAULT_REGION_MAX_PAGES,
    engineering_max_regions_per_page: int = DEFAULT_REGION_MAX_REGIONS_PER_PAGE,
    engineering_max_job_pixels: int = DEFAULT_REGION_MAX_JOB_PIXELS,
    engineering_timeout_seconds: float = DEFAULT_REGION_TIMEOUT_SECONDS,
    engineering_confidence_min: float = ENGINEERING_CONFIDENCE_MIN,
    backend=None, table_backend=None, rasterizer=None, ocr_engine=None,
    figure_backend=None, figure_rasterizer=None,
    engineering_backend=None, engineering_rasterizer=None, engineering_ocr_engine=None,
):
    if engineering_regions not in ENGINEERING_REGION_MODES:
        raise EngineeringRegionError("PDF_ENGINEERING_REGION_MODE_INVALID", f"Unsupported mode: {engineering_regions}", "FATAL")
    document, native_stats = parse_pdf_bytes(
        pdf_bytes, password=password, header_mode=header_mode, footer_mode=footer_mode,
        backend=backend, table_backend=table_backend,
    )
    drawing_pages = _engineering_pages(document)
    regional_mode = "never" if ocr_mode == "never" and engineering_regions == "auto" else engineering_regions
    global_ocr_input, global_ocr_mode = _global_ocr_policy(document, drawing_pages, regional_mode, ocr_mode)
    global_ocr, ocr_stats = apply_ocr(
        global_ocr_input, pdf_bytes, password=password, mode=global_ocr_mode,
        language=ocr_language, confidence_min=ocr_confidence_min, scale=ocr_scale,
        max_pixels=ocr_max_pixels, max_memory_bytes=ocr_max_memory_bytes,
        max_pages=ocr_max_pages, max_job_pixels=ocr_max_job_pixels,
        timeout_seconds=ocr_timeout_seconds, rasterizer=rasterizer, engine=ocr_engine,
    )
    global_ocr = _restore_page_metadata(global_ocr, document)
    figures = apply_pdf_figures(
        global_ocr, pdf_bytes, password=password, mode=image_mode,
        backend=figure_backend, rasterizer=figure_rasterizer,
        requested_scale=figure_scale, max_pixels=figure_max_pixels,
        max_memory_bytes=figure_max_memory_bytes, max_assets=figure_max_assets,
        max_job_pixels=figure_max_job_pixels,
    )
    engineered, region_stats = apply_engineering_regions(
        figures.document, pdf_bytes, password=password, mode=regional_mode,
        language=ocr_language, confidence_min=engineering_confidence_min,
        requested_scale=engineering_scale, max_pixels=engineering_max_pixels,
        max_memory_bytes=engineering_max_memory_bytes, max_pages=engineering_max_pages,
        max_regions_per_page=engineering_max_regions_per_page,
        max_job_pixels=engineering_max_job_pixels,
        timeout_seconds=engineering_timeout_seconds,
        backend=engineering_backend, rasterizer=engineering_rasterizer,
        engine=engineering_ocr_engine,
    )
    return engineered, {**native_stats, **ocr_stats, **figures.stats, **region_stats}, figures.payloads


def apply_engineering_regions(
    document: DocumentModel, pdf_bytes: bytes, *, password: str | None, mode: str,
    language: str, confidence_min: float, requested_scale: float, max_pixels: int,
    max_memory_bytes: int, max_pages: int, max_regions_per_page: int,
    max_job_pixels: int, timeout_seconds: float, backend=None, rasterizer=None, engine=None,
):
    drawing_pages = _engineering_pages(document)
    if mode == "never" or not drawing_pages:
        metadata = dict(document.metadata)
        metadata.update({"engineeringRegionMode": mode, "engineeringRegions": [], "engineeringRegionRevision": ENGINEERING_REGION_REVISION})
        return replace(document, metadata=metadata), _empty_region_stats()
    if len(drawing_pages) > max_pages:
        raise EngineeringRegionError(
            "PDF_ENGINEERING_REGION_PAGE_LIMIT_EXCEEDED",
            f"{len(drawing_pages)} engineering pages exceed regional limit {max_pages}", "FATAL",
        )
    backend = backend or PdfPlumberEngineeringBackend()
    geometries = backend.extract(pdf_bytes, password=password, max_pages=max(1, max(drawing_pages)))
    rasterizer = rasterizer or PdfiumFigureRasterizer()
    engine = engine or TesseractCliEngine()
    diagnostics = list(document.diagnostics)
    blocks = list(document.blocks)
    evidence = []
    job_pixels = regions_detected = regions_ocr = regions_native = regions_added = regions_degraded = 0

    for page in sorted(drawing_pages):
        geometry = geometries.get(page)
        if geometry is None:
            diagnostics.append(_diag("PDF_ENGINEERING_GEOMETRY_MISSING", "ERROR", page, None, "No vector geometry returned for engineering page"))
            continue
        plan = plan_engineering_regions(geometry, native_blocks=blocks, max_regions=max_regions_per_page)
        diagnostics.extend(plan.diagnostics)
        regions_detected += len(plan.regions)
        for region in plan.regions:
            run, reason = region_needs_ocr(region, mode=mode)
            item = {
                "page": page, "regionIndex": region.region_index, "type": region.region_type,
                "bbox": list(region.bbox), "confidence": region.confidence,
                "vectorCount": region.vector_count, "nativeTextChars": region.native_text_chars,
                "decisionReason": reason,
            }
            if not run:
                regions_native += 1
                item["action"] = "native-sufficient"
                evidence.append(item)
                continue
            try:
                raster = _render_region(
                    rasterizer, pdf_bytes, region, password=password,
                    requested_scale=requested_scale, max_pixels=max_pixels,
                    max_memory_bytes=max_memory_bytes,
                )
                if job_pixels + raster.pixels > max_job_pixels:
                    raise EngineeringRegionError(
                        "PDF_ENGINEERING_REGION_JOB_PIXEL_LIMIT_EXCEEDED",
                        f"Regional job would exceed {max_job_pixels} pixels at page {page} region {region.region_index}", "FATAL",
                    )
                job_pixels += raster.pixels
                regions_ocr += 1
                result = engine.recognize(raster, language=language, timeout_seconds=timeout_seconds)
                item.update({
                    "ocrConfidence": result.confidence, "rasterScale": raster.scale,
                    "rasterWidth": raster.raster_width, "rasterHeight": raster.raster_height,
                    "rasterPixels": raster.pixels, "estimatedBytes": raster.estimated_bytes,
                    "ocrEngineVersion": result.engine_version, "rasterizerVersion": result.rasterizer_version,
                })
                if result.confidence < confidence_min or not result.paragraphs:
                    regions_degraded += 1
                    code = "PDF_ENGINEERING_REGION_TEXT_EMPTY" if not result.paragraphs else "PDF_ENGINEERING_REGION_LOW_CONFIDENCE"
                    diagnostics.append(_diag(code, "ERROR", page, region.bbox, f"Regional OCR confidence {result.confidence:.2f} below {confidence_min:.2f}"))
                    blocks.append(_marker(page, region, code, result.confidence))
                    item["action"] = "marker-low-confidence"
                    evidence.append(item)
                    continue
                additions, deduped, conflicts = _regional_paragraphs(result, region, blocks)
                blocks.extend(additions)
                regions_added += len(additions)
                diagnostics.extend(conflicts)
                item.update({"action": "merge", "addedParagraphs": len(additions), "deduplicatedParagraphs": deduped, "conflicts": len(conflicts)})
                evidence.append(item)
            except EngineeringRegionError as exc:
                if exc.severity == "FATAL":
                    raise
                regions_degraded += 1
                diagnostics.append(_diag(exc.code, exc.severity, page, region.bbox, str(exc)))
                blocks.append(_marker(page, region, exc.code, None))
                item["action"] = "marker-error"
                evidence.append(item)
    blocks = tuple(sorted(blocks, key=_block_sort_key))
    metadata = dict(document.metadata)
    metadata.update({
        "engineeringRegionMode": mode,
        "engineeringRegionRevision": ENGINEERING_REGION_REVISION,
        "engineeringRegions": evidence,
        "engineeringOcrEngineVersion": getattr(engine, "version", lambda: "unknown")() if regions_ocr else "not-invoked",
        "engineeringRasterizerVersion": getattr(rasterizer, "version", lambda: "unknown")() if regions_ocr else "not-invoked",
        "engineeringRegionPolicy": {
            "confidenceMin": confidence_min, "requestedScale": requested_scale,
            "maxPixelsPerRegion": max_pixels, "maxMemoryBytesPerRegion": max_memory_bytes,
            "maxPages": max_pages, "maxRegionsPerPage": max_regions_per_page,
            "maxJobPixels": max_job_pixels, "timeoutSeconds": timeout_seconds,
        },
    })
    return replace(document, blocks=blocks, metadata=metadata, diagnostics=tuple(diagnostics)), {
        "engineering_pages": len(drawing_pages), "engineering_regions_detected": regions_detected,
        "engineering_regions_ocr": regions_ocr, "engineering_regions_native": regions_native,
        "engineering_paragraphs_added": regions_added, "engineering_regions_degraded": regions_degraded,
        "engineering_job_pixels": job_pixels,
    }


def _render_region(rasterizer, pdf_bytes, region, **kwargs):
    candidate = PdfFigureCandidate(
        region.page, region.region_index, region.bbox,
        max(region.bbox[2], 1.0), max(region.bbox[3], 1.0), name=region.region_type,
    )
    figure = rasterizer.render_region(pdf_bytes, candidate, **kwargs)
    width_pt = max(1e-9, region.bbox[2] - region.bbox[0])
    height_pt = max(1e-9, region.bbox[3] - region.bbox[1])
    return RasterizedPage(
        region.page, figure.png_bytes, width_pt, height_pt,
        figure.width, figure.height, figure.scale, figure.estimated_bytes,
        figure.rasterizer_version,
    )


def _regional_paragraphs(result, region, existing_blocks):
    additions = []
    deduped = 0
    conflicts = []
    rx0, rtop, rx1, rbottom = region.bbox
    for index, paragraph in enumerate(result.paragraphs):
        local = paragraph.bbox
        sx = (rx1-rx0) / max(1e-9, result.raster.page_width)
        sy = (rbottom-rtop) / max(1e-9, result.raster.page_height)
        bbox = (
            round(rx0 + local[0]*sx, 3), round(rtop + local[1]*sy, 3),
            round(rx0 + local[2]*sx, 3), round(rtop + local[3]*sy, 3),
        )
        text = paragraph.text.strip()
        if not text:
            continue
        duplicate, conflict = _compare_existing(text, bbox, region.page, existing_blocks)
        if duplicate:
            deduped += 1
            continue
        if conflict:
            conflicts.append(_diag(
                "PDF_ENGINEERING_REGION_NATIVE_CONFLICT", "ERROR", region.page, bbox,
                "Regional OCR disagrees with overlapping native/semantic text on numeric or identifier content",
            ))
        ref = SourceRef("pdf", page=region.page, bbox=bbox, extraction=f"ocr-engineering-{region.region_type}", confidence=paragraph.confidence)
        additions.append(ParagraphBlock(
            f"pdf:p{region.page}:engineering:r{region.region_index}:p{index}", text, ref,
            source_refs=(ref,),
        ))
    return additions, deduped, conflicts


def _compare_existing(text, bbox, page, blocks):
    normalized = _norm(text)
    numbers = _numbers(text)
    for block in blocks:
        ref = getattr(block, "provenance", None)
        if getattr(ref, "page", None) != page or getattr(ref, "bbox", None) is None:
            continue
        if _iou(bbox, ref.bbox) < 0.25:
            continue
        other = getattr(block, "text", "")
        ratio = difflib.SequenceMatcher(None, normalized, _norm(other)).ratio()
        if ratio >= 0.90:
            return True, False
        if numbers and _numbers(other) and numbers != _numbers(other):
            return False, True
    return False, False


def _engineering_pages(document):
    return {
        int(page["page"]) for page in document.metadata.get("pages", [])
        if page.get("classification") == "ENGINEERING_DRAWING"
    }


def _global_ocr_policy(document, pages, regional_mode, ocr_mode):
    if regional_mode == "never" or not pages:
        return document, ocr_mode
    metadata = dict(document.metadata)
    values = []
    for page in metadata.get("pages", []):
        item = dict(page)
        page_number = int(item.get("page", 0))
        quality = dict(item.get("nativeTextQuality") or {})
        if page_number in pages:
            item["classification"] = "BORN_DIGITAL"
            quality.update({"adequate": True, "visibleCharCount": max(20, int(quality.get("visibleCharCount", 0)))})
            item["nativeTextQuality"] = quality
            item["engineeringRegionalOcrOwnsPage"] = True
        elif ocr_mode == "always":
            item["classification"] = "SCANNED"
            quality.update({"adequate": False, "visibleCharCount": min(19, int(quality.get("visibleCharCount", 0)))})
            item["nativeTextQuality"] = quality
        values.append(item)
    metadata["pages"] = values
    return replace(document, metadata=metadata), ("auto" if ocr_mode == "always" else ocr_mode)


def _restore_page_metadata(converted, source):
    metadata = dict(converted.metadata)
    source_pages = {int(p["page"]): p for p in source.metadata.get("pages", [])}
    restored = []
    for item in metadata.get("pages", []):
        page = int(item.get("page", 0))
        if page in source_pages:
            base = dict(item)
            original = source_pages[page]
            for key in ("classification", "classificationConfidence", "classificationReasons", "nativeTextQuality"):
                if key in original:
                    base[key] = original[key]
            base.pop("engineeringRegionalOcrOwnsPage", None)
            restored.append(base)
        else:
            restored.append(item)
    metadata["pages"] = restored
    return replace(converted, metadata=metadata)


def _marker(page, region, code, confidence):
    ref = SourceRef("pdf", page=page, bbox=region.bbox, extraction="engineering-region", confidence=confidence)
    return ParagraphBlock(
        f"pdf:p{page}:engineering:r{region.region_index}:marker:{code.lower()}",
        f"⟦{code}:PAGE {page} REGION {region.region_index} {region.region_type}⟧", ref, source_refs=(ref,),
    )


def _block_sort_key(block):
    ref = getattr(block, "provenance", None)
    page = getattr(ref, "page", None)
    bbox = getattr(ref, "bbox", None)
    kind = getattr(block, "kind", "")
    if kind == "page_break":
        return (page or 0, 1e12, 1e12, 9, getattr(block, "block_id", ""))
    return (page or 0, bbox[1] if bbox else 1e11, bbox[0] if bbox else 1e11, 0, getattr(block, "block_id", ""))


def _empty_region_stats():
    return {
        "engineering_pages": 0, "engineering_regions_detected": 0,
        "engineering_regions_ocr": 0, "engineering_regions_native": 0,
        "engineering_paragraphs_added": 0, "engineering_regions_degraded": 0,
        "engineering_job_pixels": 0,
    }


def _diag(code, severity, page, bbox, message):
    provenance = {"source_type": "pdf", "page": page, "extraction": "engineering-region"}
    if bbox is not None: provenance["bbox"] = list(bbox)
    return {"code": code, "severity": severity, "message": message, "provenance": provenance}


def _norm(text): return re.sub(r"\s+", " ", text.casefold()).strip()
def _numbers(text): return tuple(re.findall(r"(?<!\w)[+-]?(?:\d+(?:[.,]\d+)?)(?!\w)", text))
def _area(b): return max(0.0,b[2]-b[0])*max(0.0,b[3]-b[1])
def _inter(a,b): return max(0.0,min(a[2],b[2])-max(a[0],b[0]))*max(0.0,min(a[3],b[3])-max(a[1],b[1]))
def _iou(a,b):
    i=_inter(a,b); u=_area(a)+_area(b)-i
    return i/u if u else 0.0


def _canonical_options(document, kwargs):
    return {
        "profile": "readable", "sourceType": "pdf",
        "headers": kwargs.get("header_mode", "metadata"), "footers": kwargs.get("footer_mode", "metadata"),
        "tableMode": kwargs.get("table_mode", "auto"),
        "backendVersions": dict(sorted((document.metadata.get("backendVersions") or {}).items())),
        "ocr": kwargs.get("ocr_mode", "auto"), "ocrLanguage": kwargs.get("ocr_language", "eng"),
        "pdfOcrRevision": OCR_REVISION,
        "images": kwargs.get("image_mode", "extract"), "pdfFigureRevision": PDF_FIGURE_REVISION,
        "engineeringRegions": kwargs.get("engineering_regions", "auto"),
        "engineeringRegionRevision": ENGINEERING_REGION_REVISION,
        "engineeringScale": kwargs.get("engineering_scale", DEFAULT_REGION_SCALE),
        "engineeringMaxPixels": kwargs.get("engineering_max_pixels", DEFAULT_REGION_MAX_PIXELS),
        "engineeringMaxMemoryBytes": kwargs.get("engineering_max_memory_bytes", DEFAULT_REGION_MAX_MEMORY_BYTES),
        "engineeringMaxPages": kwargs.get("engineering_max_pages", DEFAULT_REGION_MAX_PAGES),
        "engineeringMaxRegionsPerPage": kwargs.get("engineering_max_regions_per_page", DEFAULT_REGION_MAX_REGIONS_PER_PAGE),
        "engineeringMaxJobPixels": kwargs.get("engineering_max_job_pixels", DEFAULT_REGION_MAX_JOB_PIXELS),
        "engineeringTimeoutSeconds": kwargs.get("engineering_timeout_seconds", DEFAULT_REGION_TIMEOUT_SECONDS),
        "engineeringConfidenceMin": kwargs.get("engineering_confidence_min", ENGINEERING_CONFIDENCE_MIN),
        "engineeringOcrEngineVersion": document.metadata.get("engineeringOcrEngineVersion", "not-invoked"),
        "engineeringRasterizerVersion": document.metadata.get("engineeringRasterizerVersion", "not-invoked"),
    }


def convert_pdf_bytes(pdf_bytes: bytes, *, asset_payloads_out=None, **kwargs):
    document, stats, payloads = prepare_engineering_document(pdf_bytes, **kwargs)
    if asset_payloads_out is not None: asset_payloads_out.update(payloads)
    decisions: list[tuple[str, TableRenderDecision]] = []
    output = render_pdf_document(document, kwargs.get("table_mode", "auto"), decisions).encode("utf-8")
    return output, {
        **stats, "source_sha256": sha256_hex(pdf_bytes), "source_git_blob_sha": git_blob_sha(pdf_bytes),
        "output_sha256": sha256_hex(output), "output_bytes": len(output),
        "options_hash": options_hash(_canonical_options(document, kwargs)),
        "engineering_conversion_revision": ENGINEERING_CONVERSION_REVISION,
    }


def conversion_evidence(pdf_bytes: bytes, **kwargs):
    document, _, _ = prepare_engineering_document(pdf_bytes, **kwargs)
    evidence = build_evidence(
        document, source_sha256=sha256_hex(pdf_bytes), source_git_blob_sha=git_blob_sha(pdf_bytes),
        profile="readable", options=_canonical_options(document, kwargs),
    )
    evidence.update({
        "converterRevision": ENGINEERING_CONVERSION_REVISION,
        "canonicalizationVersion": ENGINEERING_CANONICALIZATION_VERSION,
        "engineeringRegionRevision": ENGINEERING_REGION_REVISION,
    })
    return evidence


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--pdf-password")
    parser.add_argument("--headers", choices=("keep","metadata","drop"), default="metadata")
    parser.add_argument("--footers", choices=("keep","metadata","drop"), default="metadata")
    parser.add_argument("--table-mode", choices=TABLE_MODES, default="auto")
    parser.add_argument("--ocr", choices=OCR_MODES, default="auto")
    parser.add_argument("--ocr-language", default="eng")
    parser.add_argument("--images", choices=FIGURE_MODES, default="extract")
    parser.add_argument("--assets", type=Path)
    parser.add_argument("--engineering-regions", choices=ENGINEERING_REGION_MODES, default="auto")
    parser.add_argument("--engineering-scale", type=float, default=DEFAULT_REGION_SCALE)
    parser.add_argument("--engineering-max-pixels", type=int, default=DEFAULT_REGION_MAX_PIXELS)
    parser.add_argument("--engineering-memory-mb", type=int, default=DEFAULT_REGION_MAX_MEMORY_BYTES//(1024*1024))
    parser.add_argument("--engineering-max-pages", type=int, default=DEFAULT_REGION_MAX_PAGES)
    parser.add_argument("--engineering-max-regions-per-page", type=int, default=DEFAULT_REGION_MAX_REGIONS_PER_PAGE)
    parser.add_argument("--engineering-max-job-pixels", type=int, default=DEFAULT_REGION_MAX_JOB_PIXELS)
    parser.add_argument("--engineering-timeout", type=float, default=DEFAULT_REGION_TIMEOUT_SECONDS)
    parser.add_argument("--engineering-confidence-min", type=float, default=ENGINEERING_CONFIDENCE_MIN)
    parser.add_argument("--stats-json", action="store_true")
    return parser


def run_cli(argv=None):
    args=build_parser().parse_args(argv)
    if not args.input.is_file(): raise ValueError(f"Input file does not exist: {args.input}")
    source=args.input.read_bytes(); payloads={}
    kwargs={
        "password":args.pdf_password,"header_mode":args.headers,"footer_mode":args.footers,
        "table_mode":args.table_mode,"ocr_mode":args.ocr,"ocr_language":args.ocr_language,
        "image_mode":args.images,"engineering_regions":args.engineering_regions,
        "engineering_scale":args.engineering_scale,"engineering_max_pixels":args.engineering_max_pixels,
        "engineering_max_memory_bytes":args.engineering_memory_mb*1024*1024,"engineering_max_pages":args.engineering_max_pages,
        "engineering_max_regions_per_page":args.engineering_max_regions_per_page,"engineering_max_job_pixels":args.engineering_max_job_pixels,
        "engineering_timeout_seconds":args.engineering_timeout,"engineering_confidence_min":args.engineering_confidence_min,
    }
    output,stats=convert_pdf_bytes(source,asset_payloads_out=payloads,**kwargs)
    output_path=args.output or args.input.with_suffix('.md'); output_path.parent.mkdir(parents=True,exist_ok=True); output_path.write_bytes(output)
    if args.images=='extract': stats['assets_written']=len(materialize_figure_assets(payloads,args.assets or output_path.parent/'assets'))
    else: stats['assets_written']=0
    if args.evidence: args.evidence.parent.mkdir(parents=True,exist_ok=True); args.evidence.write_bytes(canonical_json_bytes(conversion_evidence(source,**kwargs)))
    if args.stats_json: print(json.dumps({**stats,'output_path':str(output_path)},sort_keys=True))
    else: print(f"wrote {output_path} ({stats['output_bytes']} bytes)")
    return 0
