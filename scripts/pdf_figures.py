"""Conservative PDF image-object -> semantic figure asset extraction."""

from __future__ import annotations

from dataclasses import dataclass, replace
from io import BytesIO
import hashlib
import importlib.metadata
import math
from pathlib import Path
import re
from typing import Iterable

from document_model import AssetDefinition, DocumentModel, ParagraphBlock, SourceRef, TableBlock


@dataclass(frozen=True)
class FigureBlock:
    block_id: str
    asset_id: str
    provenance: SourceRef
    alt_text: str = ""
    caption: str | None = None
    filename: str | None = None
    render_supported: bool = True
    source_index: int | None = None

    @property
    def kind(self) -> str:
        return "figure"


PDF_FIGURE_REVISION = "pdf-figures-v1"
FIGURE_MODES = ("extract", "skip")
DEFAULT_FIGURE_SCALE = 2.0
DEFAULT_FIGURE_MAX_PIXELS = 8_000_000
DEFAULT_FIGURE_MAX_MEMORY_BYTES = 64 * 1024 * 1024
DEFAULT_FIGURE_MAX_ASSETS = 200
DEFAULT_FIGURE_MAX_JOB_PIXELS = 100_000_000
FIGURE_PEAK_BYTES_PER_PIXEL = 10.0
MIN_FIGURE_SCALE = 0.75


class FigureError(ValueError):
    def __init__(self, code: str, message: str, severity: str = "ERROR"):
        super().__init__(message)
        self.code = code
        self.severity = severity


@dataclass(frozen=True)
class PdfFigureCandidate:
    page: int
    source_index: int
    bbox: tuple[float, float, float, float]
    page_width: float
    page_height: float
    name: str | None = None
    src_width: int | None = None
    src_height: int | None = None

    @property
    def width(self) -> float:
        return max(0.0, self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> float:
        return max(0.0, self.bbox[3] - self.bbox[1])

    @property
    def area_ratio(self) -> float:
        return (self.width * self.height) / max(1.0, self.page_width * self.page_height)


@dataclass(frozen=True)
class FigureRaster:
    page: int
    source_index: int
    bbox: tuple[float, float, float, float]
    png_bytes: bytes
    width: int
    height: int
    scale: float
    estimated_bytes: int
    rasterizer_version: str
    pillow_version: str

    @property
    def pixels(self) -> int:
        return self.width * self.height


@dataclass(frozen=True)
class FigureSelection:
    accepted: tuple[PdfFigureCandidate, ...]
    diagnostics: tuple[dict, ...]


@dataclass(frozen=True)
class FigureApplyResult:
    document: DocumentModel
    payloads: dict[str, bytes]
    stats: dict


class PdfPlumberFigureBackend:
    """Geometry-only image-object adapter; visual extraction is delegated to PDFium."""

    def extract(
        self,
        pdf_bytes: bytes,
        *,
        password: str | None = None,
        max_pages: int = 2000,
    ) -> dict[int, tuple[PdfFigureCandidate, ...]]:
        try:
            import pdfplumber
        except ImportError as exc:
            raise FigureError(
                "PDF_FIGURE_BACKEND_MISSING",
                "PDF figure discovery requires the pinned pdfplumber dependency",
            ) from exc
        result: dict[int, tuple[PdfFigureCandidate, ...]] = {}
        try:
            with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                if len(pdf.pages) > max_pages:
                    raise FigureError(
                        "PDF_FIGURE_PAGE_LIMIT_EXCEEDED",
                        f"PDF has {len(pdf.pages)} pages; figure limit is {max_pages}",
                        "FATAL",
                    )
                for page_index, page in enumerate(pdf.pages, 1):
                    width, height = float(page.width), float(page.height)
                    values = []
                    for source_index, image in enumerate(page.images):
                        bbox = _image_bbox(image)
                        srcsize = image.get("srcsize")
                        values.append(PdfFigureCandidate(
                            page_index,
                            source_index,
                            bbox or (0.0, 0.0, 0.0, 0.0),
                            width,
                            height,
                            name=_safe_name(image.get("name")),
                            src_width=_safe_int(srcsize[0]) if srcsize and len(srcsize) > 0 else None,
                            src_height=_safe_int(srcsize[1]) if srcsize and len(srcsize) > 1 else None,
                        ))
                    result[page_index] = tuple(values)
                    page.close()
            return result
        except FigureError:
            raise
        except Exception as exc:
            detail = f"{type(exc).__name__}: {exc}"
            if "password" in detail.lower() or "encrypted" in detail.lower():
                raise FigureError("PDF_FIGURE_PASSWORD_REQUIRED", "PDF requires a valid password", "FATAL") from exc
            raise FigureError("PDF_FIGURE_EXTRACTION_FAILED", detail) from exc


class PdfiumFigureRasterizer:
    """Render one accepted image-object bbox as a deterministic PNG visual asset."""

    def version(self) -> str:
        try:
            return importlib.metadata.version("pypdfium2")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"

    def pillow_version(self) -> str:
        try:
            return importlib.metadata.version("Pillow")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"

    def render_region(
        self,
        pdf_bytes: bytes,
        candidate: PdfFigureCandidate,
        *,
        password: str | None = None,
        requested_scale: float = DEFAULT_FIGURE_SCALE,
        max_pixels: int = DEFAULT_FIGURE_MAX_PIXELS,
        max_memory_bytes: int = DEFAULT_FIGURE_MAX_MEMORY_BYTES,
    ) -> FigureRaster:
        if requested_scale <= 0 or max_pixels <= 0 or max_memory_bytes <= 0:
            raise FigureError("PDF_FIGURE_RASTER_POLICY_INVALID", "Figure raster limits must be positive", "FATAL")
        try:
            import pypdfium2 as pdfium
        except ImportError as exc:
            raise FigureError(
                "PDF_FIGURE_RASTERIZER_MISSING",
                "PDF figure rendering requires the pinned pypdfium2 dependency",
            ) from exc
        document = page = bitmap = None
        try:
            document = pdfium.PdfDocument(pdf_bytes, password=password)
            if candidate.page < 1 or candidate.page > len(document):
                raise FigureError("PDF_FIGURE_PAGE_OUT_OF_RANGE", f"Figure page {candidate.page} is outside PDF range", "FATAL")
            page = document.get_page(candidate.page - 1)
            page_width, page_height = (float(v) for v in page.get_size())
            x0, top, x1, bottom = _clamp_bbox(candidate.bbox, page_width, page_height)
            region_width, region_height = x1 - x0, bottom - top
            if region_width <= 0 or region_height <= 0:
                raise FigureError("PDF_FIGURE_GEOMETRY_INVALID", "Figure bbox is empty after page clipping")
            scale = choose_figure_scale(
                region_width, region_height, requested_scale=requested_scale,
                max_pixels=max_pixels, max_memory_bytes=max_memory_bytes,
            )
            crop = (x0, page_height - bottom, page_width - x1, top)
            bitmap = page.render(scale=scale, crop=crop, may_draw_forms=False, draw_annots=False)
            image = bitmap.to_pil().convert("RGB")
            width, height = image.size
            estimated = int(math.ceil(width * height * FIGURE_PEAK_BYTES_PER_PIXEL))
            if width * height > max_pixels or estimated > max_memory_bytes:
                raise FigureError("PDF_FIGURE_RASTER_LIMIT_EXCEEDED", "Rendered figure exceeded configured resource limits", "FATAL")
            stream = BytesIO()
            image.save(stream, format="PNG", optimize=False, compress_level=9)
            return FigureRaster(
                candidate.page, candidate.source_index, candidate.bbox, stream.getvalue(),
                width, height, round(scale, 6), estimated, self.version(), self.pillow_version(),
            )
        except FigureError:
            raise
        except Exception as exc:
            raise FigureError(
                "PDF_FIGURE_RASTER_FAILED",
                f"Failed to render page {candidate.page} image {candidate.source_index}: {type(exc).__name__}: {exc}",
            ) from exc
        finally:
            for value in (bitmap, page, document):
                if value is not None:
                    try:
                        value.close()
                    except Exception:
                        pass


def choose_figure_scale(
    width: float,
    height: float,
    *,
    requested_scale: float,
    max_pixels: int,
    max_memory_bytes: int,
    min_scale: float = MIN_FIGURE_SCALE,
) -> float:
    if width <= 0 or height <= 0:
        raise FigureError("PDF_FIGURE_GEOMETRY_INVALID", "Figure dimensions must be positive")
    allowed_pixels = min(float(max_pixels), max_memory_bytes / FIGURE_PEAK_BYTES_PER_PIXEL)
    safe_scale = math.sqrt(allowed_pixels / max(1.0, width * height))
    scale = min(requested_scale, safe_scale)
    if scale < min_scale:
        raise FigureError(
            "PDF_FIGURE_RASTER_LIMIT_EXCEEDED",
            f"Figure requires scale {scale:.3f}, below minimum {min_scale:.3f}, to satisfy resource budget",
            "FATAL",
        )
    return round(scale, 6)


def select_figure_candidates(
    candidates: Iterable[PdfFigureCandidate],
    *,
    page_info: dict,
    table_bboxes: Iterable[tuple[float, float, float, float]] = (),
) -> FigureSelection:
    accepted: list[PdfFigureCandidate] = []
    diagnostics: list[dict] = []
    classification = str(page_info.get("classification", "UNKNOWN"))
    native_adequate = bool((page_info.get("nativeTextQuality") or {}).get("adequate", False))
    table_bboxes = tuple(table_bboxes)
    for candidate in sorted(candidates, key=lambda c: (c.bbox[1], c.bbox[0], c.source_index)):
        rejection = _candidate_rejection(candidate, classification, native_adequate, table_bboxes)
        if rejection is not None:
            diagnostics.append(rejection)
            continue
        duplicate = next((value for value in accepted if _bbox_iou(value.bbox, candidate.bbox) >= 0.98), None)
        if duplicate is not None:
            diagnostics.append(_diagnostic(
                "PDF_FIGURE_DUPLICATE_CANDIDATE", "INFO", candidate,
                f"Image object duplicates page {duplicate.page} image {duplicate.source_index}",
            ))
            continue
        accepted.append(candidate)
    return FigureSelection(tuple(accepted), tuple(diagnostics))


def _candidate_rejection(candidate, classification, native_adequate, table_bboxes):
    if candidate.width <= 0 or candidate.height <= 0:
        return _diagnostic("PDF_FIGURE_GEOMETRY_INVALID", "WARNING", candidate, "Image object has invalid or empty geometry")
    ratio = candidate.area_ratio
    if ratio >= 0.85 or (classification == "SCANNED" and ratio >= 0.50 and not native_adequate):
        return _diagnostic(
            "PDF_FIGURE_PAGE_BACKGROUND", "INFO", candidate,
            f"Image covers {ratio:.1%} of page and is treated as scan/background, not a semantic figure",
        )
    if candidate.width < 36 or candidate.height < 36 or ratio < 0.003:
        return _diagnostic(
            "PDF_FIGURE_DECORATIVE_SMALL", "INFO", candidate,
            f"Image object is below conservative figure-size gate ({candidate.width:.1f}x{candidate.height:.1f} pt)",
        )
    if candidate.height <= 72 and (
        candidate.bbox[1] <= candidate.page_height * 0.08 or
        candidate.bbox[3] >= candidate.page_height * 0.92
    ):
        return _diagnostic(
            "PDF_FIGURE_RUNNING_DECORATION", "INFO", candidate,
            "Small image lies in running header/footer band and is treated as decoration",
        )
    for table_bbox in table_bboxes:
        if _intersection_ratio(candidate.bbox, table_bbox) >= 0.65:
            return _diagnostic(
                "PDF_FIGURE_TABLE_OVERLAP", "INFO", candidate,
                "Image object substantially overlaps an accepted semantic table",
            )
    return None


def apply_pdf_figures(
    document: DocumentModel,
    pdf_bytes: bytes,
    *,
    password: str | None = None,
    mode: str = "extract",
    backend=None,
    rasterizer=None,
    requested_scale: float = DEFAULT_FIGURE_SCALE,
    max_pixels: int = DEFAULT_FIGURE_MAX_PIXELS,
    max_memory_bytes: int = DEFAULT_FIGURE_MAX_MEMORY_BYTES,
    max_assets: int = DEFAULT_FIGURE_MAX_ASSETS,
    max_job_pixels: int = DEFAULT_FIGURE_MAX_JOB_PIXELS,
) -> FigureApplyResult:
    if mode not in FIGURE_MODES:
        raise FigureError("PDF_FIGURE_MODE_INVALID", f"Unsupported PDF image mode: {mode}", "FATAL")
    if max_assets < 0 or max_job_pixels <= 0:
        raise FigureError("PDF_FIGURE_POLICY_INVALID", "Figure count/job-pixel limits must be positive", "FATAL")
    backend = backend or PdfPlumberFigureBackend()
    pages = {int(item["page"]): item for item in document.metadata.get("pages", []) if "page" in item}
    diagnostics = list(document.diagnostics)
    try:
        candidates_by_page = backend.extract(pdf_bytes, password=password, max_pages=max(1, len(pages) or 2000))
    except FigureError as exc:
        if exc.severity == "FATAL":
            raise
        diagnostics.append({
            "code": exc.code, "severity": exc.severity, "message": str(exc),
            "provenance": {"source_type": "pdf"},
        })
        return FigureApplyResult(
            replace(document, diagnostics=tuple(diagnostics)),
            {},
            _figure_stats(0, 0, 0, 0, 0),
        )

    tables = _table_bboxes_by_page(document)
    selected: list[PdfFigureCandidate] = []
    candidate_evidence = []
    for page, page_candidates in sorted(candidates_by_page.items()):
        page_info = pages.get(page, {"page": page, "classification": "UNKNOWN", "nativeTextQuality": {}})
        selection = select_figure_candidates(page_candidates, page_info=page_info, table_bboxes=tables.get(page, ()))
        diagnostics.extend(selection.diagnostics)
        selected.extend(selection.accepted)
        candidate_evidence.extend(_candidate_evidence(value, "accepted") for value in selection.accepted)
    if len(selected) > max_assets:
        raise FigureError(
            "PDF_FIGURE_ASSET_LIMIT_EXCEEDED",
            f"{len(selected)} accepted figure candidates exceed configured maximum {max_assets}",
            "FATAL",
        )

    rasterizer = rasterizer or PdfiumFigureRasterizer()
    payloads: dict[str, bytes] = {}
    assets = list(document.assets)
    figure_blocks: list[FigureBlock] = []
    job_pixels = rasterized = skipped = failed = 0
    rasterizer_version = "not-invoked"
    pillow_version = "not-invoked"

    for candidate in selected:
        caption = _caption_for_candidate(document, candidate)
        provenance = SourceRef(
            "pdf", page=candidate.page, bbox=candidate.bbox,
            extraction="pdf-image-object", confidence=0.9,
        )
        if mode == "skip":
            skipped += 1
            source_id = f"pdf-image-p{candidate.page}-{candidate.source_index}"
            figure_blocks.append(FigureBlock(
                f"pdf:p{candidate.page}:figure:{candidate.source_index}",
                source_id, provenance, alt_text=caption or f"Figure on page {candidate.page}",
                caption=caption, source_index=candidate.source_index,
            ))
            diagnostics.append(_diagnostic(
                "PDF_FIGURE_SKIPPED_BY_POLICY", "INFO", candidate,
                "Accepted figure intentionally not materialized by --images skip",
            ))
            continue
        try:
            raster = rasterizer.render_region(
                pdf_bytes, candidate, password=password, requested_scale=requested_scale,
                max_pixels=max_pixels, max_memory_bytes=max_memory_bytes,
            )
            if job_pixels + raster.pixels > max_job_pixels:
                raise FigureError(
                    "PDF_FIGURE_JOB_PIXEL_LIMIT_EXCEEDED",
                    f"Figure job would exceed {max_job_pixels} raster pixels at page {candidate.page}",
                    "FATAL",
                )
            job_pixels += raster.pixels
            rasterized += 1
            rasterizer_version = raster.rasterizer_version
            pillow_version = raster.pillow_version
            digest = hashlib.sha256(raster.png_bytes).hexdigest()
            filename = f"pdf-figure-{digest[:24]}.png"
            asset_id = f"sha256-{digest[:24]}"
            payloads.setdefault(filename, raster.png_bytes)
            assets.append(AssetDefinition(
                asset_id, f"pdf:page:{candidate.page}", f"image-object:{candidate.source_index}",
                f"pdf:page:{candidate.page}:image:{candidate.source_index}",
                f"page-{candidate.page}-image-{candidate.source_index}.png",
                "image/png", digest, len(raster.png_bytes), filename, True,
            ))
            figure_blocks.append(FigureBlock(
                f"pdf:p{candidate.page}:figure:{candidate.source_index}",
                asset_id, provenance, alt_text=caption or f"Figure on page {candidate.page}",
                caption=caption, filename=filename, source_index=candidate.source_index,
            ))
        except FigureError as exc:
            if exc.severity == "FATAL":
                raise
            failed += 1
            source_id = f"pdf-image-p{candidate.page}-{candidate.source_index}"
            figure_blocks.append(FigureBlock(
                f"pdf:p{candidate.page}:figure:{candidate.source_index}",
                source_id, provenance, alt_text=caption or f"Figure on page {candidate.page}",
                caption=caption, source_index=candidate.source_index,
            ))
            diagnostics.append(_diagnostic(exc.code, exc.severity, candidate, str(exc)))

    metadata = dict(document.metadata)
    metadata.update({
        "pdfFigureRevision": PDF_FIGURE_REVISION,
        "imageMode": mode,
        "figureCandidateCount": sum(len(values) for values in candidates_by_page.values()),
        "acceptedFigureCount": len(selected),
        "figureCandidates": candidate_evidence,
        "figureRasterizerVersion": rasterizer_version,
        "figurePillowVersion": pillow_version,
        "figurePolicy": {
            "requestedScale": requested_scale,
            "maxPixelsPerFigure": max_pixels,
            "maxMemoryBytesPerFigure": max_memory_bytes,
            "maxAssets": max_assets,
            "maxJobPixels": max_job_pixels,
        },
        "figureBlocks": [
            {
                "blockId": block.block_id,
                "assetId": block.asset_id,
                "page": block.provenance.page,
                "bbox": list(block.provenance.bbox) if block.provenance.bbox else None,
                "caption": block.caption,
                "filename": block.filename,
                "sourceIndex": block.source_index,
            }
            for block in figure_blocks
        ],
    })
    blocks = _insert_figure_blocks(document.blocks, figure_blocks, pages, diagnostics)
    converted = replace(
        document, blocks=blocks, metadata=metadata,
        diagnostics=tuple(diagnostics), assets=tuple(_dedupe_assets(assets)),
        semantic_schema_version="7-pdf-figures",
    )
    return FigureApplyResult(
        converted, payloads,
        _figure_stats(
            sum(len(values) for values in candidates_by_page.values()),
            len(selected), rasterized, skipped, failed, job_pixels,
        ),
    )


def materialize_figure_assets(payloads: dict[str, bytes], directory: Path) -> tuple[Path, ...]:
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for filename, data in sorted(payloads.items()):
        target = directory / filename
        if target.exists() and target.read_bytes() != data:
            raise FigureError(
                "PDF_FIGURE_ASSET_COLLISION",
                f"Deterministic figure asset path already exists with different bytes: {target}",
                "FATAL",
            )
        if not target.exists():
            target.write_bytes(data)
        written.append(target)
    return tuple(written)


def _figure_stats(candidates, accepted, rasterized, skipped, failed, pixels=0):
    return {
        "figure_candidates": candidates, "figures_accepted": accepted,
        "figures_rasterized": rasterized, "figures_skipped": skipped,
        "figures_failed": failed, "figure_job_pixels": pixels,
    }


def _table_bboxes_by_page(document: DocumentModel) -> dict[int, tuple[tuple[float, float, float, float], ...]]:
    result: dict[int, list[tuple[float, float, float, float]]] = {}
    for block in document.blocks:
        if not isinstance(block, TableBlock):
            continue
        ref = block.provenance
        if ref.page is not None and ref.bbox is not None:
            result.setdefault(int(ref.page), []).append(ref.bbox)
    return {page: tuple(values) for page, values in result.items()}


def _caption_for_candidate(document: DocumentModel, candidate: PdfFigureCandidate) -> str | None:
    best = None
    best_gap = None
    for block in document.blocks:
        if not isinstance(block, ParagraphBlock):
            continue
        ref = block.provenance
        if ref.page != candidate.page or ref.bbox is None:
            continue
        text = block.text.strip()
        if not _looks_like_caption(text):
            continue
        horizontal = _horizontal_overlap(candidate.bbox, ref.bbox)
        gap = ref.bbox[1] - candidate.bbox[3]
        if horizontal < 0.30 or gap < -4 or gap > 48:
            continue
        if best_gap is None or gap < best_gap:
            best, best_gap = text, gap
    return best


def _looks_like_caption(text: str) -> bool:
    return bool(re.match(r"^\s*(figure|fig\.?|chart|diagram|image)\s*(?:\d+|[A-Za-z])?(?:\s*[-:–—.]|\s+)", text, re.I))


def _insert_figure_blocks(blocks, figures, pages, diagnostics):
    by_page: dict[int, list[object]] = {}
    breaks: dict[int, object] = {}
    for block in blocks:
        page = getattr(getattr(block, "provenance", None), "page", None)
        if getattr(block, "kind", None) == "page_break":
            if page is not None:
                breaks[int(page)] = block
        elif page is not None:
            by_page.setdefault(int(page), []).append(block)
    for figure in figures:
        page = int(figure.provenance.page or 0)
        page_blocks = by_page.setdefault(page, [])
        info = pages.get(page, {})
        if str(info.get("readingOrder", "single")) == "ambiguous":
            diagnostics.append({
                "code": "PDF_FIGURE_ORDER_AMBIGUOUS", "severity": "WARNING",
                "message": f"Figure placement on page {page} uses conservative visual insertion because reading order is ambiguous",
                "provenance": figure.provenance.to_dict(),
            })
        page_blocks.insert(_figure_insertion_index(page_blocks, figure, info), figure)
    result = []
    ordered_pages = sorted(set(by_page) | set(pages))
    for index, page in enumerate(ordered_pages):
        result.extend(by_page.get(page, []))
        if index + 1 < len(ordered_pages) and page in breaks:
            result.append(breaks[page])
        elif index + 1 < len(ordered_pages):
            from document_model import PageBreakBlock
            result.append(PageBreakBlock(
                f"pdf:p{page}:break", SourceRef("pdf", page=page, extraction="page-boundary"),
            ))
    return tuple(result)


def _figure_insertion_index(blocks, figure: FigureBlock, page_info: dict) -> int:
    bbox = figure.provenance.bbox
    if bbox is None:
        return len(blocks)
    page_width = float(page_info.get("width", max(1.0, bbox[2])))
    figure_center = (bbox[0] + bbox[2]) / 2
    for index, block in enumerate(blocks):
        ref = getattr(block, "provenance", None)
        other = getattr(ref, "bbox", None)
        if other is None:
            continue
        if str(page_info.get("readingOrder", "single")) == "two-column":
            other_center = (other[0] + other[2]) / 2
            if (figure_center < page_width / 2) != (other_center < page_width / 2):
                continue
        if other[1] >= bbox[1]:
            return index
    return len(blocks)


def _dedupe_assets(assets):
    seen = set()
    result = []
    for asset in assets:
        key = (asset.asset_id, asset.filename)
        if key in seen:
            continue
        seen.add(key)
        result.append(asset)
    return result


def _candidate_evidence(candidate, status):
    return {
        "page": candidate.page, "sourceIndex": candidate.source_index,
        "bbox": list(candidate.bbox), "areaRatio": round(candidate.area_ratio, 6),
        "name": candidate.name, "srcWidth": candidate.src_width, "srcHeight": candidate.src_height,
        "status": status,
    }


def _diagnostic(code, severity, candidate, message):
    return {
        "code": code, "severity": severity, "message": message,
        "provenance": {
            "source_type": "pdf", "page": candidate.page,
            "bbox": list(candidate.bbox), "extraction": "pdf-image-object",
        },
    }


def _image_bbox(image) -> tuple[float, float, float, float] | None:
    try:
        values = tuple(float(image[key]) for key in ("x0", "top", "x1", "bottom"))
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in values):
        return None
    x0, top, x1, bottom = values
    return (round(x0, 3), round(top, 3), round(x1, 3), round(bottom, 3))


def _clamp_bbox(bbox, width, height):
    x0, top, x1, bottom = bbox
    return (
        max(0.0, min(width, x0)), max(0.0, min(height, top)),
        max(0.0, min(width, x1)), max(0.0, min(height, bottom)),
    )


def _safe_name(value) -> str | None:
    return None if value is None else str(value)[:256]


def _safe_int(value) -> int | None:
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def _bbox_iou(left, right):
    intersection = _intersection_area(left, right)
    union = _area(left) + _area(right) - intersection
    return intersection / union if union > 0 else 0.0


def _intersection_ratio(left, right):
    return _intersection_area(left, right) / max(1e-9, _area(left))


def _horizontal_overlap(left, right):
    intersection = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    return intersection / max(1e-9, min(left[2] - left[0], right[2] - right[0]))


def _intersection_area(left, right):
    width = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    height = max(0.0, min(left[3], right[3]) - max(left[1], right[1]))
    return width * height


def _area(bbox):
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])
