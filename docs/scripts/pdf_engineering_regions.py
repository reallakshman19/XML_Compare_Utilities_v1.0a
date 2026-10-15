"""Engineering-drawing region detection and controlled regional OCR helpers."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import math
from typing import Iterable

ENGINEERING_REGION_MODES = ("auto", "always", "never")
ENGINEERING_REGION_REVISION = "engineering-regions-v1"
DEFAULT_REGION_SCALE = 2.0
DEFAULT_REGION_MAX_PIXELS = 8_000_000
DEFAULT_REGION_MAX_MEMORY_BYTES = 64 * 1024 * 1024
DEFAULT_REGION_MAX_PAGES = 100
DEFAULT_REGION_MAX_REGIONS_PER_PAGE = 12
DEFAULT_REGION_MAX_JOB_PIXELS = 200_000_000
DEFAULT_REGION_TIMEOUT_SECONDS = 60.0
REGION_PEAK_BYTES_PER_PIXEL = 10.0
MIN_REGION_SCALE = 0.75
BBox = tuple[float, float, float, float]


class EngineeringRegionError(ValueError):
    def __init__(self, code: str, message: str, severity: str = "ERROR"):
        super().__init__(message)
        self.code = code
        self.severity = severity


@dataclass(frozen=True)
class VectorObject:
    bbox: BBox
    kind: str


@dataclass(frozen=True)
class EngineeringPageGeometry:
    page: int
    width: float
    height: float
    vectors: tuple[VectorObject, ...]


@dataclass(frozen=True)
class EngineeringRegion:
    page: int
    region_index: int
    region_type: str
    bbox: BBox
    confidence: float
    vector_count: int
    native_text_chars: int = 0


@dataclass(frozen=True)
class RegionPlan:
    regions: tuple[EngineeringRegion, ...]
    diagnostics: tuple[dict, ...]


class PdfPlumberEngineeringBackend:
    """Geometry-only adapter for line/rect/curve objects."""
    def extract(self, pdf_bytes: bytes, *, password: str | None = None, max_pages: int = 2000):
        try:
            import pdfplumber
        except ImportError as exc:
            raise EngineeringRegionError(
                "PDF_ENGINEERING_BACKEND_MISSING",
                "Engineering region detection requires the pinned pdfplumber dependency",
                "FATAL",
            ) from exc
        result = {}
        try:
            with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                if len(pdf.pages) > max_pages:
                    raise EngineeringRegionError(
                        "PDF_ENGINEERING_PAGE_LIMIT_EXCEEDED",
                        f"PDF has {len(pdf.pages)} pages; limit is {max_pages}", "FATAL",
                    )
                for index, page in enumerate(pdf.pages, 1):
                    width, height = float(page.width), float(page.height)
                    vectors = []
                    for kind, objects in (("line", page.lines), ("rect", page.rects), ("curve", page.curves)):
                        for obj in objects:
                            bbox = _object_bbox(obj)
                            if bbox and _meaningful_vector(bbox):
                                vectors.append(VectorObject(bbox, kind))
                    result[index] = EngineeringPageGeometry(index, width, height, tuple(vectors))
                    page.close()
            return result
        except EngineeringRegionError:
            raise
        except Exception as exc:
            detail = f"{type(exc).__name__}: {exc}"
            if "password" in detail.lower() or "encrypted" in detail.lower():
                raise EngineeringRegionError("PDF_ENGINEERING_PASSWORD_REQUIRED", "PDF requires a valid password", "FATAL") from exc
            raise EngineeringRegionError("PDF_ENGINEERING_GEOMETRY_FAILED", detail) from exc


def plan_engineering_regions(
    geometry: EngineeringPageGeometry,
    *,
    native_blocks: Iterable[object] = (),
    max_regions: int = DEFAULT_REGION_MAX_REGIONS_PER_PAGE,
) -> RegionPlan:
    if max_regions <= 0:
        raise EngineeringRegionError("PDF_ENGINEERING_REGION_LIMIT_INVALID", "max_regions must be positive", "FATAL")
    diagnostics = []
    vectors = geometry.vectors
    if len(vectors) < 20:
        return RegionPlan((), (_diag(
            "PDF_ENGINEERING_REGION_INSUFFICIENT_GEOMETRY", "WARNING", geometry.page, None,
            f"Only {len(vectors)} meaningful vector objects; regional segmentation not trusted",
        ),))

    raw: list[tuple[str, BBox, float, int]] = []
    title = _title_block_candidate(geometry)
    if title:
        raw.append(title)

    excluded = title[1] if title else None
    raw.extend(_dense_tiles(geometry, excluded))

    deduped = _dedupe_regions(raw)
    if len(deduped) > max_regions:
        diagnostics.append(_diag(
            "PDF_ENGINEERING_REGION_LIMIT_EXCEEDED", "ERROR", geometry.page, None,
            f"Detected {len(deduped)} regions; keeping the {max_regions} highest-confidence regions",
        ))
        deduped = sorted(deduped, key=lambda r: (-r[2], -r[3], r[1][1], r[1][0]))[:max_regions]

    regions = []
    for index, (kind, bbox, confidence, vector_count) in enumerate(sorted(deduped, key=lambda r: (r[1][1], r[1][0], r[0]))):
        native_chars = _native_chars_in_bbox(native_blocks, geometry.page, bbox)
        regions.append(EngineeringRegion(
            geometry.page, index, kind, bbox, round(confidence, 3), vector_count, native_chars,
        ))
    if not regions:
        diagnostics.append(_diag(
            "PDF_ENGINEERING_REGION_AMBIGUOUS", "ERROR", geometry.page, None,
            "Vector-heavy page could not be segmented into bounded trustworthy regions",
        ))
    return RegionPlan(tuple(regions), tuple(diagnostics))


def region_needs_ocr(region: EngineeringRegion, *, mode: str, native_min_chars: int = 20) -> tuple[bool, str]:
    if mode not in ENGINEERING_REGION_MODES:
        raise EngineeringRegionError("PDF_ENGINEERING_REGION_MODE_INVALID", f"Unsupported mode: {mode}", "FATAL")
    if mode == "never":
        return False, "regional extraction disabled"
    if mode == "always":
        return True, "regional extraction forced"
    if region.native_text_chars >= native_min_chars:
        return False, f"region already has {region.native_text_chars} native text characters"
    return True, f"region has only {region.native_text_chars} native text characters"


def choose_region_scale(width, height, *, requested_scale, max_pixels, max_memory_bytes, min_scale=MIN_REGION_SCALE):
    if width <= 0 or height <= 0 or requested_scale <= 0 or max_pixels <= 0 or max_memory_bytes <= 0:
        raise EngineeringRegionError("PDF_ENGINEERING_RASTER_POLICY_INVALID", "Regional raster limits must be positive", "FATAL")
    allowed = min(float(max_pixels), max_memory_bytes / REGION_PEAK_BYTES_PER_PIXEL)
    safe = math.sqrt(allowed / max(1.0, width * height))
    scale = min(requested_scale, safe)
    if scale < min_scale:
        raise EngineeringRegionError(
            "PDF_ENGINEERING_RASTER_LIMIT_EXCEEDED",
            f"Region requires scale {scale:.3f}, below minimum {min_scale:.3f}", "FATAL",
        )
    return round(scale, 6)


def offset_ocr_bbox(local_bbox: BBox, region_bbox: BBox, region_width: float, region_height: float) -> BBox:
    x0, top, x1, bottom = local_bbox
    rx0, rtop, rx1, rbottom = region_bbox
    sx = (rx1 - rx0) / max(1e-9, region_width)
    sy = (rbottom - rtop) / max(1e-9, region_height)
    return (
        round(rx0 + x0 * sx, 3), round(rtop + top * sy, 3),
        round(rx0 + x1 * sx, 3), round(rtop + bottom * sy, 3),
    )


def _title_block_candidate(geometry):
    x_cut, y_cut = geometry.width * 0.55, geometry.height * 0.62
    objects = [v for v in geometry.vectors if _cx(v.bbox) >= x_cut and _cy(v.bbox) >= y_cut]
    if len(objects) < 8:
        return None
    bbox = _pad(_union(v.bbox for v in objects), 6, geometry.width, geometry.height)
    ratio = _area(bbox) / max(1.0, geometry.width * geometry.height)
    if ratio > 0.32 or bbox[2] < geometry.width * 0.72 or bbox[3] < geometry.height * 0.82:
        return None
    confidence = min(0.97, 0.72 + min(0.20, len(objects) / 100) + (0.04 if ratio < 0.20 else 0))
    return ("title_block", bbox, confidence, len(objects))


def _dense_tiles(geometry, excluded):
    cols, rows = 3, 3
    tile_w, tile_h = geometry.width / cols, geometry.height / rows
    values = []
    for row in range(rows):
        for col in range(cols):
            bbox = (col * tile_w, row * tile_h, (col + 1) * tile_w, (row + 1) * tile_h)
            if excluded and _intersection_ratio(bbox, excluded) >= 0.60:
                continue
            objects = [v for v in geometry.vectors if _point_in((_cx(v.bbox), _cy(v.bbox)), bbox)]
            threshold = max(15, int(len(geometry.vectors) * 0.055))
            if len(objects) < threshold:
                continue
            tight = _pad(_union(v.bbox for v in objects), 12, geometry.width, geometry.height)
            ratio = _area(tight) / max(1.0, geometry.width * geometry.height)
            if ratio < 0.025 or ratio > 0.48:
                tight = _pad(bbox, -3, geometry.width, geometry.height)
                ratio = _area(tight) / max(1.0, geometry.width * geometry.height)
            confidence = min(0.94, 0.68 + min(0.20, len(objects) / 180) + (0.04 if 0.05 <= ratio <= 0.35 else 0))
            values.append(("drawing_zone", tight, confidence, len(objects)))
    return values


def _dedupe_regions(regions):
    result = []
    for value in sorted(regions, key=lambda r: (-r[2], -r[3])):
        if any(_iou(value[1], kept[1]) >= 0.72 for kept in result):
            continue
        result.append(value)
    return result


def _native_chars_in_bbox(blocks, page, bbox):
    chars = 0
    for block in blocks:
        ref = getattr(block, "provenance", None)
        if getattr(ref, "page", None) != page or getattr(ref, "bbox", None) is None:
            continue
        if _intersection_ratio(ref.bbox, bbox) >= 0.45:
            chars += len("".join(ch for ch in getattr(block, "text", "") if not ch.isspace()))
    return chars


def _object_bbox(obj):
    try:
        if all(key in obj for key in ("x0", "top", "x1", "bottom")):
            values = tuple(float(obj[key]) for key in ("x0", "top", "x1", "bottom"))
        elif all(key in obj for key in ("x0", "y0", "x1", "y1")):
            return None
        else:
            pts = obj.get("pts") or obj.get("path") or ()
            coords = []
            for item in pts:
                if isinstance(item, (list, tuple)) and len(item) >= 2 and isinstance(item[0], (int, float)):
                    coords.append((float(item[0]), float(item[1])))
            if not coords:
                return None
            xs, ys = zip(*coords)
            values = (min(xs), min(ys), max(xs), max(ys))
        if not all(math.isfinite(v) for v in values):
            return None
        x0, top, x1, bottom = values
        return (round(min(x0, x1), 3), round(min(top, bottom), 3), round(max(x0, x1), 3), round(max(top, bottom), 3))
    except (TypeError, ValueError):
        return None


def _meaningful_vector(bbox):
    return (bbox[2] - bbox[0]) >= 2 or (bbox[3] - bbox[1]) >= 2


def _diag(code, severity, page, bbox, message):
    provenance = {"source_type": "pdf", "page": page, "extraction": "engineering-region"}
    if bbox is not None:
        provenance["bbox"] = list(bbox)
    return {"code": code, "severity": severity, "message": message, "provenance": provenance}


def _pad(bbox, amount, width, height):
    return (
        round(max(0.0, bbox[0] - amount), 3), round(max(0.0, bbox[1] - amount), 3),
        round(min(width, bbox[2] + amount), 3), round(min(height, bbox[3] + amount), 3),
    )


def _union(boxes):
    values = tuple(boxes)
    return (min(v[0] for v in values), min(v[1] for v in values), max(v[2] for v in values), max(v[3] for v in values))


def _area(b):
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def _intersection_area(a, b):
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def _intersection_ratio(a, b):
    return _intersection_area(a, b) / max(1e-9, _area(a))


def _iou(a, b):
    inter = _intersection_area(a, b)
    union = _area(a) + _area(b) - inter
    return inter / union if union else 0.0


def _cx(b): return (b[0] + b[2]) / 2
def _cy(b): return (b[1] + b[3]) / 2
def _point_in(p, b): return b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]
