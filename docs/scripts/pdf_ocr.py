"""Controlled PDF OCR rasterization, Tesseract execution, confidence, and merge helpers."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
import csv
import difflib
import importlib.metadata
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Iterable

from document_model import ParagraphBlock, SourceRef, TableBlock
from pdf_native import NativeLine, reconstruct_reading_order

OCR_MODES = ("auto", "always", "never")
OCR_REVISION = "pdf-ocr-v1"
DEFAULT_OCR_SCALE = 2.0
DEFAULT_OCR_MAX_PIXELS = 16_000_000
DEFAULT_OCR_MAX_MEMORY_BYTES = 64 * 1024 * 1024
DEFAULT_OCR_MAX_PAGES = 100
DEFAULT_OCR_MAX_JOB_PIXELS = 250_000_000
DEFAULT_OCR_TIMEOUT_SECONDS = 60.0
DEFAULT_OCR_CONFIDENCE_MIN = 0.70
OCR_WARNING_CONFIDENCE = 0.85
MIN_RASTER_SCALE = 0.75
# Peak working set includes the render bitmap, PIL conversion, and encoder buffers.
RASTER_PEAK_BYTES_PER_PIXEL = 10.0


class OcrError(ValueError):
    def __init__(self, code: str, message: str, severity: str = "ERROR"):
        super().__init__(message)
        self.code = code
        self.severity = severity


@dataclass(frozen=True)
class OcrDecision:
    run: bool
    reason: str
    layout_safe: bool


@dataclass(frozen=True)
class RasterizedPage:
    page: int
    png_bytes: bytes
    page_width: float
    page_height: float
    raster_width: int
    raster_height: int
    scale: float
    estimated_bytes: int
    rasterizer_version: str = "unknown"

    @property
    def pixels(self) -> int:
        return self.raster_width * self.raster_height


@dataclass(frozen=True)
class OcrWord:
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float
    block_num: int
    par_num: int
    line_num: int
    word_num: int


@dataclass(frozen=True)
class OcrLine:
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float
    words: tuple[OcrWord, ...]
    block_num: int
    par_num: int
    line_num: int


@dataclass(frozen=True)
class OcrParagraph:
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float
    lines: tuple[OcrLine, ...]
    block_num: int
    par_num: int


@dataclass(frozen=True)
class OcrPageResult:
    page: int
    words: tuple[OcrWord, ...]
    lines: tuple[OcrLine, ...]
    paragraphs: tuple[OcrParagraph, ...]
    confidence: float
    engine_version: str
    rasterizer_version: str
    raster: RasterizedPage
    stderr: str = ""


@dataclass(frozen=True)
class OcrMergeResult:
    blocks: tuple[object, ...]
    diagnostics: tuple[dict, ...]
    deduplicated: int
    conflicts: int
    added: int


class PdfiumRasterizer:
    """Lazy pypdfium2 rasterizer with deterministic pixel/memory clamps."""

    def version(self) -> str:
        try:
            return importlib.metadata.version("pypdfium2")
        except importlib.metadata.PackageNotFoundError:
            return "unknown"

    def render_page(
        self,
        pdf_bytes: bytes,
        page: int,
        *,
        password: str | None = None,
        requested_scale: float = DEFAULT_OCR_SCALE,
        max_pixels: int = DEFAULT_OCR_MAX_PIXELS,
        max_memory_bytes: int = DEFAULT_OCR_MAX_MEMORY_BYTES,
        min_scale: float = MIN_RASTER_SCALE,
    ) -> RasterizedPage:
        if requested_scale <= 0 or max_pixels <= 0 or max_memory_bytes <= 0:
            raise OcrError("OCR_RASTER_POLICY_INVALID", "OCR raster limits must be positive", "FATAL")
        try:
            import pypdfium2 as pdfium
        except ImportError as exc:
            raise OcrError(
                "OCR_RASTERIZER_MISSING",
                "OCR rasterization requires the pinned pypdfium2 dependency",
                "FATAL",
            ) from exc
        document = pdf_page = bitmap = None
        try:
            document = pdfium.PdfDocument(pdf_bytes, password=password)
            if page < 1 or page > len(document):
                raise OcrError("OCR_PAGE_OUT_OF_RANGE", f"OCR page {page} is outside PDF page range", "FATAL")
            pdf_page = document.get_page(page - 1)
            page_width, page_height = (float(value) for value in pdf_page.get_size())
            if page_width <= 0 or page_height <= 0:
                raise OcrError("OCR_RASTER_DIMENSIONS_INVALID", f"PDF page {page} has invalid dimensions", "FATAL")
            scale = choose_raster_scale(
                page_width, page_height, requested_scale=requested_scale,
                max_pixels=max_pixels, max_memory_bytes=max_memory_bytes, min_scale=min_scale,
            )
            bitmap = pdf_page.render(scale=scale)
            image = bitmap.to_pil()
            width, height = image.size
            estimated = int(math.ceil(width * height * RASTER_PEAK_BYTES_PER_PIXEL))
            if width * height > max_pixels or estimated > max_memory_bytes:
                raise OcrError(
                    "OCR_RASTER_LIMIT_EXCEEDED",
                    f"OCR raster page {page} exceeded configured pixel/memory limit after render",
                    "FATAL",
                )
            stream = BytesIO()
            image.save(stream, format="PNG", optimize=False)
            return RasterizedPage(
                page, stream.getvalue(), page_width, page_height, width, height,
                round(scale, 6), estimated, self.version(),
            )
        except OcrError:
            raise
        except Exception as exc:
            detail = f"{type(exc).__name__}: {exc}"
            code = "OCR_RASTER_PASSWORD_REQUIRED" if "password" in detail.lower() else "OCR_RASTER_FAILED"
            raise OcrError(code, f"Failed to rasterize PDF page {page}: {detail}") from exc
        finally:
            for value in (bitmap, pdf_page, document):
                if value is not None:
                    try:
                        value.close()
                    except Exception:
                        pass


class TesseractCliEngine:
    """Tesseract TSV adapter; executes directly without a shell or pytesseract."""

    def version(self) -> str:
        return tesseract_version()

    def recognize(
        self,
        raster: RasterizedPage,
        *,
        language: str = "eng",
        timeout_seconds: float = DEFAULT_OCR_TIMEOUT_SECONDS,
        psm: int = 6,
    ) -> OcrPageResult:
        validate_ocr_language(language)
        if timeout_seconds <= 0:
            raise OcrError("OCR_TIMEOUT_POLICY_INVALID", "OCR timeout must be positive", "FATAL")
        with tempfile.TemporaryDirectory(prefix="xml-compare-ocr-") as tmp:
            image_path = Path(tmp) / "page.png"
            image_path.write_bytes(raster.png_bytes)
            command = ["tesseract", str(image_path), "stdout", "-l", language, "--psm", str(int(psm)), "tsv"]
            try:
                result = subprocess.run(
                    command, capture_output=True, text=True, timeout=timeout_seconds,
                    check=False, env=_safe_subprocess_env(),
                )
            except FileNotFoundError as exc:
                raise OcrError("OCR_ENGINE_MISSING", "Tesseract executable was not found") from exc
            except subprocess.TimeoutExpired as exc:
                raise OcrError("OCR_TIMEOUT", f"Tesseract exceeded {timeout_seconds:g}s on page {raster.page}") from exc
            if result.returncode != 0:
                raise OcrError("OCR_FAILED", result.stderr.strip() or f"Tesseract exited with status {result.returncode}")
            words = parse_tesseract_tsv(result.stdout, raster)
            lines = group_ocr_lines(words)
            paragraphs = group_ocr_paragraphs(lines)
            return OcrPageResult(
                raster.page, words, lines, paragraphs, weighted_confidence(words),
                self.version(), raster.rasterizer_version, raster, result.stderr.strip(),
            )


def choose_raster_scale(
    page_width: float,
    page_height: float,
    *,
    requested_scale: float,
    max_pixels: int,
    max_memory_bytes: int,
    min_scale: float = MIN_RASTER_SCALE,
) -> float:
    base_pixels = max(1.0, page_width * page_height)
    allowed_pixels = min(float(max_pixels), max_memory_bytes / RASTER_PEAK_BYTES_PER_PIXEL)
    safe_scale = math.sqrt(allowed_pixels / base_pixels)
    scale = min(requested_scale, safe_scale)
    if scale < min_scale:
        raise OcrError(
            "OCR_RASTER_LIMIT_EXCEEDED",
            f"Page requires raster scale {scale:.3f}, below minimum {min_scale:.3f}, to satisfy {int(allowed_pixels)}-pixel budget",
            "FATAL",
        )
    return round(scale, 6)


def validate_ocr_language(language: str) -> None:
    if not language or len(language) > 128 or re.fullmatch(r"[A-Za-z0-9_+.-]+", language) is None:
        raise OcrError("OCR_LANGUAGE_INVALID", f"Invalid OCR language expression: {language!r}", "FATAL")


def _safe_subprocess_env() -> dict[str, str]:
    allowed = {"PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TESSDATA_PREFIX"}
    return {key: value for key, value in os.environ.items() if key in allowed}


@lru_cache(maxsize=1)
def tesseract_version() -> str:
    try:
        result = subprocess.run(
            ["tesseract", "--version"], capture_output=True, text=True,
            timeout=5, check=False, env=_safe_subprocess_env(),
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return "unavailable"
    lines = (result.stdout or result.stderr).splitlines()
    return lines[0].strip() if lines else "unknown"


def parse_tesseract_tsv(tsv: str, raster: RasterizedPage) -> tuple[OcrWord, ...]:
    reader = csv.DictReader(tsv.splitlines(), delimiter="\t")
    words: list[OcrWord] = []
    for row in reader:
        try:
            if int(row.get("level", "0")) != 5:
                continue
            text = (row.get("text") or "").strip()
            confidence_raw = float(row.get("conf", "-1"))
            if not text or confidence_raw < 0:
                continue
            left, top = float(row.get("left", "0")), float(row.get("top", "0"))
            width, height = float(row.get("width", "0")), float(row.get("height", "0"))
            bbox = pixel_bbox_to_pdf_points(
                (left, top, left + width, top + height), raster.scale,
                raster.page_width, raster.page_height,
            )
            words.append(OcrWord(
                text, bbox, round(max(0.0, min(1.0, confidence_raw / 100.0)), 4),
                int(row.get("block_num", "0")), int(row.get("par_num", "0")),
                int(row.get("line_num", "0")), int(row.get("word_num", "0")),
            ))
        except (TypeError, ValueError):
            continue
    return tuple(words)


def pixel_bbox_to_pdf_points(
    bbox: tuple[float, float, float, float], scale: float,
    page_width: float, page_height: float,
) -> tuple[float, float, float, float]:
    if scale <= 0:
        raise OcrError("OCR_SCALE_INVALID", "OCR scale must be positive", "FATAL")
    x0, y0, x1, y1 = (value / scale for value in bbox)
    return tuple(round(value, 3) for value in (
        max(0.0, min(page_width, x0)), max(0.0, min(page_height, y0)),
        max(0.0, min(page_width, x1)), max(0.0, min(page_height, y1)),
    ))


def group_ocr_lines(words: tuple[OcrWord, ...]) -> tuple[OcrLine, ...]:
    groups: dict[tuple[int, int, int], list[OcrWord]] = {}
    for word in words:
        groups.setdefault((word.block_num, word.par_num, word.line_num), []).append(word)
    values = []
    for key, items in sorted(groups.items()):
        ordered = tuple(sorted(items, key=lambda item: (item.bbox[0], item.word_num)))
        values.append(OcrLine(
            " ".join(item.text for item in ordered), merge_bbox(item.bbox for item in ordered),
            weighted_confidence(ordered), ordered, *key,
        ))
    return tuple(values)


def group_ocr_paragraphs(lines: tuple[OcrLine, ...]) -> tuple[OcrParagraph, ...]:
    groups: dict[tuple[int, int], list[OcrLine]] = {}
    for line in lines:
        groups.setdefault((line.block_num, line.par_num), []).append(line)
    values = []
    for key, items in sorted(groups.items()):
        ordered = tuple(sorted(items, key=lambda item: (item.bbox[1], item.bbox[0], item.line_num)))
        words = tuple(word for line in ordered for word in line.words)
        values.append(OcrParagraph(
            " ".join(line.text for line in ordered).strip(), merge_bbox(line.bbox for line in ordered),
            weighted_confidence(words), ordered, *key,
        ))
    return tuple(values)


def weighted_confidence(values: Iterable[OcrWord]) -> float:
    items = list(values)
    if not items:
        return 0.0
    weights = [max(1, len(item.text)) for item in items]
    return round(sum(item.confidence * weight for item, weight in zip(items, weights)) / sum(weights), 4)


def merge_bbox(values: Iterable[tuple[float, float, float, float]]) -> tuple[float, float, float, float]:
    boxes = list(values)
    if not boxes:
        return (0.0, 0.0, 0.0, 0.0)
    return (
        round(min(value[0] for value in boxes), 3), round(min(value[1] for value in boxes), 3),
        round(max(value[2] for value in boxes), 3), round(max(value[3] for value in boxes), 3),
    )


def ocr_decision(page_info: dict, mode: str) -> OcrDecision:
    if mode not in OCR_MODES:
        raise OcrError("OCR_MODE_INVALID", f"Unsupported OCR mode: {mode}", "FATAL")
    classification = str(page_info.get("classification", "UNKNOWN"))
    quality = page_info.get("nativeTextQuality") or {}
    adequate = bool(quality.get("adequate", False))
    visible = int(quality.get("visibleCharCount", 0) or 0)
    layout_safe = classification not in {"TABLE_HEAVY", "ENGINEERING_DRAWING"}
    if mode == "never":
        return OcrDecision(False, "OCR disabled by policy", layout_safe)
    if mode == "always":
        return OcrDecision(True, "OCR forced by policy", layout_safe)
    if adequate and classification in {"BORN_DIGITAL", "MIXED", "TABLE_HEAVY"}:
        return OcrDecision(False, "healthy native text remains authoritative", layout_safe)
    if classification in {"SCANNED", "IMAGE_HEAVY", "UNKNOWN"}:
        return OcrDecision(True, f"{classification} page requires OCR fallback", layout_safe)
    if not adequate or visible < 20:
        return OcrDecision(True, "native text quality is inadequate", layout_safe)
    return OcrDecision(False, "native text quality is adequate", layout_safe)


def ocr_paragraph_blocks(result: OcrPageResult) -> tuple[ParagraphBlock, ...]:
    blocks = []
    for index, paragraph in enumerate(result.paragraphs):
        if not paragraph.text:
            continue
        provenance = SourceRef(
            "pdf", page=result.page, bbox=paragraph.bbox,
            extraction="ocr", confidence=paragraph.confidence,
        )
        refs = tuple(SourceRef(
            "pdf", page=result.page, bbox=line.bbox,
            extraction="ocr", confidence=line.confidence,
        ) for line in paragraph.lines)
        blocks.append(ParagraphBlock(
            f"pdf:p{result.page}:ocr{index}", paragraph.text, provenance, source_refs=refs,
        ))
    return tuple(blocks)


def merge_ocr_page_blocks(
    existing: tuple[object, ...], ocr_blocks: tuple[ParagraphBlock, ...],
    *, page: int, page_width: float, page_height: float,
) -> OcrMergeResult:
    diagnostics: list[dict] = []
    accepted: list[ParagraphBlock] = []
    deduplicated = conflicts = 0
    for ocr_block in ocr_blocks:
        decision = _ocr_overlap_decision(ocr_block, existing)
        if decision == "duplicate":
            deduplicated += 1
        elif decision == "conflict":
            conflicts += 1
            diagnostics.append({
                "code": "OCR_NATIVE_CONFLICT", "severity": "WARNING",
                "message": f"OCR text overlaps native content on page {page} but differs materially; native content retained",
                "provenance": ocr_block.provenance.to_dict(),
            })
        else:
            accepted.append(ocr_block)
    combined = [*existing, *accepted]
    if len(combined) <= 1:
        return OcrMergeResult(tuple(combined), tuple(diagnostics), deduplicated, conflicts, len(accepted))
    markers: list[NativeLine] = []
    marker_map: dict[str, object] = {}
    for index, block in enumerate(combined):
        bbox = getattr(getattr(block, "provenance", None), "bbox", None)
        if bbox is None:
            return OcrMergeResult(tuple(combined), tuple(diagnostics), deduplicated, conflicts, len(accepted))
        marker = f"\ue000OCRBLOCK:{index}\ue001"
        marker_map[marker] = block
        markers.append(NativeLine(f"p{page}:ocrmerge:{index}", marker, bbox, (), (), 0.0, None, False, False))
    order = reconstruct_reading_order(tuple(markers), page_width, page_height, page)
    diagnostics.extend(order.diagnostics)
    ordered = tuple(marker_map[line.text] for line in order.lines if line.text in marker_map)
    return OcrMergeResult(ordered, tuple(diagnostics), deduplicated, conflicts, len(accepted))


def _ocr_overlap_decision(ocr_block: ParagraphBlock, existing: tuple[object, ...]) -> str:
    ocr_bbox = ocr_block.provenance.bbox
    if ocr_bbox is None:
        return "add"
    for block in existing:
        native_bbox = getattr(getattr(block, "provenance", None), "bbox", None)
        if native_bbox is None or overlap_ratio(ocr_bbox, native_bbox) < 0.50:
            continue
        if isinstance(block, TableBlock):
            return "duplicate"
        if isinstance(block, ParagraphBlock):
            same_numbers = numeric_tokens(ocr_block.text) == numeric_tokens(block.text)
            return "duplicate" if normalized_similarity(ocr_block.text, block.text) >= 0.80 and same_numbers else "conflict"
    return "add"


def numeric_tokens(value: str) -> tuple[str, ...]:
    return tuple(re.findall(r"[+−-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+−-]?\d+)?", value))


def normalized_similarity(left: str, right: str) -> float:
    normalize = lambda value: " ".join(re.findall(r"[\w.+−-]+", value.casefold()))
    return difflib.SequenceMatcher(None, normalize(left), normalize(right)).ratio()


def overlap_ratio(left, right) -> float:
    x0, y0 = max(left[0], right[0]), max(left[1], right[1])
    x1, y1 = min(left[2], right[2]), min(left[3], right[3])
    intersection = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    left_area = max(0.1, (left[2] - left[0]) * (left[3] - left[1]))
    right_area = max(0.1, (right[2] - right[0]) * (right[3] - right[1]))
    return intersection / min(left_area, right_area)


def ocr_result_evidence(result: OcrPageResult) -> dict:
    return {
        "page": result.page,
        "engine": "tesseract-cli", "engineVersion": result.engine_version,
        "rasterizer": "pypdfium2", "rasterizerVersion": result.rasterizer_version,
        "scale": result.raster.scale, "rasterWidth": result.raster.raster_width,
        "rasterHeight": result.raster.raster_height, "rasterPixels": result.raster.pixels,
        "estimatedRasterBytes": result.raster.estimated_bytes,
        "pageConfidence": result.confidence, "wordCount": len(result.words),
        "lineCount": len(result.lines), "paragraphCount": len(result.paragraphs),
        "words": [{"text": word.text, "bbox": list(word.bbox), "confidence": word.confidence} for word in result.words],
        "lines": [{"text": line.text, "bbox": list(line.bbox), "confidence": line.confidence} for line in result.lines],
        "paragraphs": [{"text": item.text, "bbox": list(item.bbox), "confidence": item.confidence} for item in result.paragraphs],
    }
