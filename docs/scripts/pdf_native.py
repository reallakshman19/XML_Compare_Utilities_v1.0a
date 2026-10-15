"""Native PDF positioned-text extraction and deterministic reading-order reconstruction."""

from __future__ import annotations

from dataclasses import dataclass, replace
from io import BytesIO
import math
import re
import statistics
from typing import Iterable

BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class NativeChar:
    text: str
    bbox: BBox
    font: str | None
    size: float
    upright: bool = True
    matrix: tuple[float, ...] = ()


@dataclass(frozen=True)
class NativeSpan:
    text: str
    bbox: BBox
    font: str | None
    size: float
    bold: bool
    italic: bool


@dataclass(frozen=True)
class NativeLine:
    line_id: str
    text: str
    bbox: BBox
    chars: tuple[NativeChar, ...]
    spans: tuple[NativeSpan, ...]
    font_size: float
    font: str | None
    bold: bool
    italic: bool
    region: str = "single"


@dataclass(frozen=True)
class NativeBlock:
    page: int
    block_index: int
    text: str
    bbox: BBox
    lines: tuple[NativeLine, ...]
    font_size: float
    bold: bool
    italic: bool
    region: str
    gap_before: float
    heading_level: int | None = None


@dataclass(frozen=True)
class PageSignals:
    page: int
    width: float
    height: float
    raw_char_count: int
    char_count: int
    line_object_count: int
    rect_count: int
    curve_count: int
    image_count: int
    image_area_ratio: float
    duplicate_ratio: float


@dataclass(frozen=True)
class PageExtraction:
    signals: PageSignals
    chars: tuple[NativeChar, ...]


@dataclass(frozen=True)
class TextQuality:
    score: float
    adequate: bool
    printable_ratio: float
    replacement_ratio: float
    control_ratio: float
    duplicate_ratio: float
    visible_char_count: int
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class PageClassification:
    page_type: str
    confidence: float
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class ReadingOrderResult:
    lines: tuple[NativeLine, ...]
    mode: str
    confidence: float
    diagnostics: tuple[dict, ...]


@dataclass(frozen=True)
class PdfBackendResult:
    pages: tuple[PageExtraction, ...]
    metadata: dict
    backend_versions: dict[str, str]


class PdfExtractionError(ValueError):
    def __init__(self, code: str, message: str, severity: str = "FATAL"):
        super().__init__(message)
        self.code = code
        self.severity = severity


class PdfPlumberBackend:
    """Lazy optional adapter. Pure layout algorithms below do not import pdfplumber."""

    def extract(
        self,
        pdf_bytes: bytes,
        *,
        password: str | None = None,
        max_pages: int = 2000,
        max_page_area: float = 200_000_000.0,
        max_chars_per_page: int = 1_000_000,
    ) -> PdfBackendResult:
        try:
            import pdfplumber
            import pdfminer
        except ImportError as exc:
            raise PdfExtractionError(
                "PDF_BACKEND_MISSING",
                "PDF support requires the pinned dependencies in requirements-pdf.txt",
            ) from exc
        try:
            with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                if len(pdf.pages) > max_pages:
                    raise PdfExtractionError(
                        "PDF_PAGE_LIMIT_EXCEEDED",
                        f"PDF has {len(pdf.pages)} pages; limit is {max_pages}",
                    )
                pages = tuple(
                    self._extract_page(page, index + 1, max_page_area, max_chars_per_page)
                    for index, page in enumerate(pdf.pages)
                )
                return PdfBackendResult(
                    pages,
                    _stable_metadata(dict(pdf.metadata or {})),
                    {
                        "pdfplumber": str(getattr(pdfplumber, "__version__", "unknown")),
                        "pdfminer.six": str(getattr(pdfminer, "__version__", "unknown")),
                    },
                )
        except PdfExtractionError:
            raise
        except Exception as exc:
            name = type(exc).__name__.lower()
            message = str(exc)
            detail = " ".join((name, message, repr(exc), repr(getattr(exc, "__cause__", None)))).lower()
            if "passwordincorrect" in detail or "password" in detail or "encrypted" in detail:
                raise PdfExtractionError("PDF_ENCRYPTED", "PDF requires a valid password") from exc
            rendered = message or repr(exc)
            raise PdfExtractionError("PDF_MALFORMED", f"PDF parser failed: {rendered}") from exc

    def _extract_page(
        self, page, page_number: int, max_page_area: float, max_chars_per_page: int,
    ) -> PageExtraction:
        width = float(page.width)
        height = float(page.height)
        if width <= 0 or height <= 0 or width * height > max_page_area:
            raise PdfExtractionError(
                "PDF_PAGE_DIMENSIONS_EXCESSIVE",
                f"Page {page_number} dimensions {width:g}x{height:g} exceed safe limits",
            )
        raw_chars = list(page.chars)
        if len(raw_chars) > max_chars_per_page:
            raise PdfExtractionError(
                "PDF_CHAR_LIMIT_EXCEEDED",
                f"Page {page_number} has {len(raw_chars)} characters; limit is {max_chars_per_page}",
            )
        try:
            deduped = list(page.dedupe_chars(tolerance=0.5, extra_attrs=("fontname", "size")).chars)
        except Exception:
            deduped = raw_chars
        chars = tuple(_char_from_pdfplumber(value) for value in deduped if _valid_char(value))
        image_area = sum(_object_area(value, width, height) for value in list(page.images))
        signals = PageSignals(
            page_number, width, height, len(raw_chars), len(chars),
            len(page.lines), len(page.rects), len(page.curves), len(page.images),
            round(min(1.0, image_area / max(1.0, width * height)), 6),
            round(max(0.0, 1.0 - len(deduped) / max(1, len(raw_chars))), 6),
        )
        page.close()
        return PageExtraction(signals, chars)


def _stable_metadata(metadata: dict) -> dict:
    stable = {}
    for key, value in sorted(metadata.items(), key=lambda item: str(item[0])):
        if isinstance(value, (str, int, float, bool)) or value is None:
            stable[str(key)] = value
        else:
            stable[str(key)] = str(value)
    return stable


def _valid_char(value: dict) -> bool:
    return all(_finite(value.get(key)) for key in ("x0", "x1", "top", "bottom", "size"))


def _finite(value) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _char_from_pdfplumber(value: dict) -> NativeChar:
    matrix = value.get("matrix")
    return NativeChar(
        str(value.get("text", "")),
        _bbox(value["x0"], value["top"], value["x1"], value["bottom"]),
        str(value.get("fontname")) if value.get("fontname") is not None else None,
        round(float(value.get("size", 0.0)), 3),
        bool(value.get("upright", True)),
        tuple(round(float(item), 6) for item in matrix) if matrix else (),
    )


def _object_area(value: dict, width: float, height: float) -> float:
    try:
        x0 = max(0.0, min(width, float(value.get("x0", 0.0))))
        x1 = max(0.0, min(width, float(value.get("x1", x0))))
        top = max(0.0, min(height, float(value.get("top", 0.0))))
        bottom = max(0.0, min(height, float(value.get("bottom", top))))
        return max(0.0, x1 - x0) * max(0.0, bottom - top)
    except (TypeError, ValueError):
        return 0.0


def native_text_quality(chars: tuple[NativeChar, ...], duplicate_ratio: float = 0.0) -> TextQuality:
    text = "".join(char.text for char in chars)
    visible = [char for char in text if not char.isspace()]
    count = len(visible)
    if not text:
        return TextQuality(0.0, False, 0.0, 0.0, 0.0, duplicate_ratio, 0, ("no embedded text",))
    printable = sum(char.isprintable() or char in "\t\r\n" for char in text) / len(text)
    replacements = text.count("\ufffd") / max(1, len(text))
    controls = sum(ord(char) < 32 and char not in "\t\r\n" for char in text) / len(text)
    score = 1.0
    score -= min(0.5, replacements * 5.0)
    score -= min(0.35, controls * 4.0)
    score -= min(0.35, duplicate_ratio)
    score *= printable
    score = round(max(0.0, min(1.0, score)), 4)
    reasons = []
    if count < 20:
        reasons.append("low visible character count")
    if printable < 0.9:
        reasons.append("low printable-character ratio")
    if replacements > 0.02:
        reasons.append("replacement-character ratio exceeds 2%")
    if controls > 0.01:
        reasons.append("control-character ratio exceeds 1%")
    if duplicate_ratio > 0.35:
        reasons.append("duplicate text layer exceeds 35%")
    adequate = count >= 20 and printable >= 0.9 and replacements <= 0.02 and controls <= 0.01 and duplicate_ratio <= 0.35
    return TextQuality(
        score, adequate, round(printable, 4), round(replacements, 4), round(controls, 4),
        round(duplicate_ratio, 4), count, tuple(reasons),
    )


def classify_page(signals: PageSignals, quality: TextQuality) -> PageClassification:
    vectors = signals.line_object_count + signals.rect_count + signals.curve_count
    chars = quality.visible_char_count
    reasons: list[str] = []
    if vectors >= 250 and chars < 1000:
        reasons.append(f"{vectors} vector objects indicate drawing-heavy content")
        return PageClassification("ENGINEERING_DRAWING", 0.88, tuple(reasons))
    if vectors >= 20 and chars >= 20:
        reasons.append(f"{vectors} line/rect/curve objects with embedded text")
        return PageClassification("TABLE_HEAVY", 0.84, tuple(reasons))
    if chars < 20 and signals.image_area_ratio >= 0.6:
        reasons.append("large image coverage with little embedded text")
        return PageClassification("SCANNED", 0.92, tuple(reasons))
    if signals.image_area_ratio >= 0.4:
        reasons.append("images cover at least 40% of the page")
        return PageClassification("IMAGE_HEAVY", 0.82, tuple(reasons))
    if chars >= 20 and quality.adequate and signals.image_count == 0:
        reasons.append("usable embedded text and no image-heavy signal")
        return PageClassification("BORN_DIGITAL", 0.94, tuple(reasons))
    if chars >= 20 and signals.image_count > 0:
        reasons.append("embedded text and images coexist")
        if not quality.adequate:
            reasons.append("native text quality is inadequate")
        return PageClassification("MIXED", 0.78 if quality.adequate else 0.62, tuple(reasons))
    if chars > 0:
        reasons.append("embedded text exists but quality/quantity is insufficient")
        return PageClassification("MIXED", 0.55, tuple(reasons))
    reasons.append("insufficient native text/image/layout signals")
    return PageClassification("UNKNOWN", 0.45, tuple(reasons))


def cluster_chars_into_lines(chars: tuple[NativeChar, ...], page: int) -> tuple[NativeLine, ...]:
    groups: list[list[NativeChar]] = []
    for char in sorted(chars, key=lambda value: (value.bbox[1], value.bbox[0], value.bbox[3])):
        if not char.text:
            continue
        best_index = None
        best_distance = None
        for index, group in enumerate(groups[-12:]):
            actual = len(groups) - min(12, len(groups)) + index
            if _char_fits_line(char, group):
                distance = abs(_center_y(char.bbox) - statistics.median(_center_y(value.bbox) for value in group))
                if best_distance is None or distance < best_distance:
                    best_index = actual
                    best_distance = distance
        if best_index is None:
            groups.append([char])
        else:
            groups[best_index].append(char)
    lines = []
    line_index = 0
    for group in groups:
        for segment in _split_horizontal_segments(group):
            ordered = tuple(sorted(segment, key=lambda value: (value.bbox[0], value.bbox[1])))
            text = _line_text(ordered)
            if not text.strip():
                continue
            bbox = _merge_bbox(value.bbox for value in ordered)
            sizes = [value.size for value in ordered if value.text.strip()]
            font_size = round(statistics.median(sizes), 3) if sizes else 0.0
            font = _majority_font(ordered)
            lines.append(NativeLine(
                f"p{page}:l{line_index}", text, bbox, ordered, _build_spans(ordered), font_size,
                font, _is_bold(font), _is_italic(font),
            ))
            line_index += 1
    return tuple(sorted(lines, key=lambda value: (value.bbox[1], value.bbox[0])))


def _split_horizontal_segments(group: list[NativeChar]) -> tuple[tuple[NativeChar, ...], ...]:
    ordered = sorted(group, key=lambda value: (value.bbox[0], value.bbox[1]))
    if len(ordered) < 2:
        return (tuple(ordered),) if ordered else ()
    sizes = [value.size for value in ordered if value.size > 0]
    median_size = statistics.median(sizes) if sizes else 10.0
    split_gap = max(24.0, median_size * 4.0)
    segments: list[list[NativeChar]] = [[ordered[0]]]
    for char in ordered[1:]:
        previous = segments[-1][-1]
        gap = char.bbox[0] - previous.bbox[2]
        if gap > split_gap:
            segments.append([char])
        else:
            segments[-1].append(char)
    return tuple(tuple(segment) for segment in segments)


def _char_fits_line(char: NativeChar, group: list[NativeChar]) -> bool:
    group_bbox = _merge_bbox(value.bbox for value in group)
    overlap = max(0.0, min(char.bbox[3], group_bbox[3]) - max(char.bbox[1], group_bbox[1]))
    min_height = max(0.1, min(char.bbox[3] - char.bbox[1], group_bbox[3] - group_bbox[1]))
    if overlap / min_height >= 0.2:
        return True
    median_size = statistics.median([value.size for value in group] + [char.size])
    return abs(_center_y(char.bbox) - _center_y(group_bbox)) <= max(2.0, median_size * 0.6)


def _line_text(chars: tuple[NativeChar, ...]) -> str:
    parts: list[str] = []
    previous: NativeChar | None = None
    for char in chars:
        text = char.text
        if previous is not None and text and not text[0].isspace() and parts and not parts[-1].endswith((" ", "\t")):
            gap = char.bbox[0] - previous.bbox[2]
            threshold = max(1.25, min(previous.size, char.size) * 0.28)
            if gap > threshold:
                parts.append(" ")
        parts.append(text)
        previous = char
    return "".join(parts).strip()


def _build_spans(chars: tuple[NativeChar, ...]) -> tuple[NativeSpan, ...]:
    if not chars:
        return ()
    groups: list[list[NativeChar]] = []
    for char in chars:
        if not groups or _span_key(groups[-1][-1]) != _span_key(char):
            groups.append([char])
        else:
            groups[-1].append(char)
    spans = []
    for group in groups:
        font = group[0].font
        spans.append(NativeSpan(
            "".join(value.text for value in group),
            _merge_bbox(value.bbox for value in group), font, group[0].size,
            _is_bold(font), _is_italic(font),
        ))
    return tuple(spans)


def _span_key(char: NativeChar) -> tuple:
    return (char.font, round(char.size, 2), char.upright)


def reconstruct_reading_order(
    lines: tuple[NativeLine, ...], page_width: float, page_height: float, page: int,
) -> ReadingOrderResult:
    if not lines:
        return ReadingOrderResult((), "empty", 1.0, ())
    anchors = [line for line in lines if _is_full_width(line, page_width)]
    anchors = sorted(anchors, key=lambda value: (value.bbox[1], value.bbox[0]))
    remaining = [line for line in lines if line not in anchors]
    ordered: list[NativeLine] = []
    diagnostics: list[dict] = []
    modes: list[str] = []
    previous_bottom = 0.0
    for anchor_index, anchor in enumerate(anchors):
        band = [line for line in remaining if previous_bottom <= _center_y(line.bbox) < _center_y(anchor.bbox)]
        band_result = _order_band(band, page_width, page, anchor_index)
        ordered.extend(band_result.lines)
        diagnostics.extend(band_result.diagnostics)
        modes.append(band_result.mode)
        ordered.append(replace(anchor, region=f"full:{anchor_index}"))
        previous_bottom = _center_y(anchor.bbox)
    tail = [line for line in remaining if _center_y(line.bbox) >= previous_bottom]
    tail_result = _order_band(tail, page_width, page, len(anchors))
    ordered.extend(tail_result.lines)
    diagnostics.extend(tail_result.diagnostics)
    modes.append(tail_result.mode)
    if any(mode == "ambiguous" for mode in modes):
        return ReadingOrderResult(tuple(ordered), "ambiguous", 0.45, tuple(diagnostics))
    if any(mode == "two-column" for mode in modes):
        return ReadingOrderResult(tuple(ordered), "two-column", 0.9, tuple(diagnostics))
    return ReadingOrderResult(tuple(ordered), "single-column", 0.96, tuple(diagnostics))


def _order_band(lines: list[NativeLine], width: float, page: int, band_index: int) -> ReadingOrderResult:
    if not lines:
        return ReadingOrderResult((), "empty", 1.0, ())
    sorted_lines = sorted(lines, key=lambda value: (value.bbox[1], value.bbox[0]))
    left = [line for line in sorted_lines if _center_x(line.bbox) < width * 0.45]
    right = [line for line in sorted_lines if _center_x(line.bbox) > width * 0.55]
    middle = [line for line in sorted_lines if line not in left and line not in right]
    min_side = min(len(left), len(right))
    max_side = max(len(left), len(right), 1)
    if min_side >= 3 and min_side / max_side >= 0.3:
        gap = statistics.median(line.bbox[0] for line in right) - statistics.median(line.bbox[2] for line in left)
        if gap >= max(12.0, width * 0.025) and len(middle) <= 1:
            values = [replace(line, region=f"left:{band_index}") for line in sorted(left, key=lambda value: (value.bbox[1], value.bbox[0]))]
            values += [replace(line, region=f"right:{band_index}") for line in sorted(right, key=lambda value: (value.bbox[1], value.bbox[0]))]
            if middle:
                values += [replace(line, region=f"middle:{band_index}") for line in middle]
            return ReadingOrderResult(tuple(values), "two-column", 0.9, ())
        diagnostic = _reading_order_diagnostic(page, band_index, gap, len(left), len(right), len(middle))
        return ReadingOrderResult(
            tuple(replace(line, region=f"ambiguous:{band_index}") for line in sorted_lines),
            "ambiguous", 0.45, (diagnostic,),
        )
    return ReadingOrderResult(
        tuple(replace(line, region=f"single:{band_index}") for line in sorted_lines),
        "single-column", 0.96, (),
    )


def _reading_order_diagnostic(page: int, band: int, gap: float, left: int, right: int, middle: int) -> dict:
    return {
        "code": "PDF_READING_ORDER_AMBIGUOUS",
        "severity": "WARNING",
        "message": (
            f"Page {page} band {band} has competing column clusters "
            f"(left={left}, right={right}, middle={middle}, gutter={gap:.2f}pt)"
        ),
        "provenance": {"source_type": "pdf", "page": page},
    }


def _is_full_width(line: NativeLine, width: float) -> bool:
    line_width = line.bbox[2] - line.bbox[0]
    return line_width >= width * 0.68 or (line.bbox[0] <= width * 0.12 and line.bbox[2] >= width * 0.88)


def group_lines_into_blocks(lines: tuple[NativeLine, ...], page: int) -> tuple[NativeBlock, ...]:
    groups: list[list[NativeLine]] = []
    for line in lines:
        if not groups or not _can_join_lines(groups[-1][-1], line):
            groups.append([line])
        else:
            groups[-1].append(line)
    blocks = []
    previous_bottom = 0.0
    for index, group in enumerate(groups):
        bbox = _merge_bbox(value.bbox for value in group)
        gap = max(0.0, bbox[1] - previous_bottom) if index else bbox[1]
        previous_bottom = bbox[3]
        sizes = [line.font_size for line in group if line.font_size > 0]
        font_size = round(statistics.median(sizes), 3) if sizes else 0.0
        blocks.append(NativeBlock(
            page, index, " ".join(line.text for line in group).strip(), bbox, tuple(group),
            font_size, any(line.bold for line in group), any(line.italic for line in group),
            group[0].region, round(gap, 3),
        ))
    return tuple(blocks)


def _can_join_lines(previous: NativeLine, current: NativeLine) -> bool:
    if previous.region != current.region:
        return False
    if current.bbox[1] < previous.bbox[1]:
        return False
    gap = current.bbox[1] - previous.bbox[3]
    font = max(previous.font_size, current.font_size, 1.0)
    if gap > max(5.0, font * 0.8):
        return False
    if abs(previous.font_size - current.font_size) > max(1.0, font * 0.15):
        return False
    if previous.bold != current.bold:
        return False
    return abs(previous.bbox[0] - current.bbox[0]) <= 18.0


def infer_heading_levels(blocks: tuple[NativeBlock, ...]) -> tuple[NativeBlock, ...]:
    body_sizes = [block.font_size for block in blocks if block.font_size > 0 and len(block.text) >= 20]
    if not body_sizes:
        body_sizes = [block.font_size for block in blocks if block.font_size > 0]
    if not body_sizes:
        return blocks
    body = statistics.median(body_sizes)
    candidates: list[NativeBlock] = []
    for block in blocks:
        numbered = _heading_number_depth(block.text)
        large = block.font_size >= body * 1.35
        moderately_large = block.font_size >= body * 1.18
        if len(block.text) <= 180 and (large or (moderately_large and block.bold) or (numbered and block.bold and block.font_size >= body * 0.98)):
            candidates.append(block)
    ranked_sizes = sorted({round(block.font_size, 1) for block in candidates}, reverse=True)
    result = []
    for block in blocks:
        if block not in candidates:
            result.append(block)
            continue
        depth = _heading_number_depth(block.text)
        if depth is not None and block.font_size <= body * 1.2:
            level = min(6, max(1, depth))
        else:
            level = min(6, ranked_sizes.index(round(block.font_size, 1)) + 1)
        result.append(replace(block, heading_level=level))
    return tuple(result)


def _heading_number_depth(text: str) -> int | None:
    match = re.match(r"^\s*(\d+(?:\.\d+)*)(?:[.)])?\s+", text)
    if not match:
        return None
    return match.group(1).count(".") + 1


def detect_running_content(
    pages: tuple[tuple[int, float, tuple[NativeLine, ...]], ...],
) -> tuple[set[str], tuple[dict, ...]]:
    if len(pages) < 3:
        return set(), ()
    occurrences: dict[tuple[str, str], list[tuple[int, float, str]]] = {}
    for page, height, lines in pages:
        for line in lines:
            text = _normalize_running_text(line.text)
            if not text or len(text) > 100:
                continue
            kind = None
            y_ratio = _center_y(line.bbox) / max(1.0, height)
            if y_ratio <= 0.08:
                kind = "header"
            elif y_ratio >= 0.92:
                kind = "footer"
            if kind:
                occurrences.setdefault((kind, text), []).append((page, y_ratio, line.line_id))
    threshold = max(3, math.ceil(len(pages) * 0.8))
    suppressed: set[str] = set()
    metadata: list[dict] = []
    for (kind, text), items in sorted(occurrences.items()):
        unique_pages = sorted({item[0] for item in items})
        ratios = [item[1] for item in items]
        if len(unique_pages) < threshold or max(ratios) - min(ratios) > 0.02:
            continue
        suppressed.update(item[2] for item in items)
        metadata.append({
            "kind": kind,
            "text": text,
            "pages": unique_pages,
            "meanPositionRatio": round(statistics.mean(ratios), 4),
            "detection": "exact-edge-repeat",
        })
    return suppressed, tuple(metadata)


def _normalize_running_text(text: str) -> str:
    return " ".join(text.split()).strip()


def _majority_font(chars: tuple[NativeChar, ...]) -> str | None:
    fonts = [char.font for char in chars if char.font and char.text.strip()]
    if not fonts:
        return None
    counts = {font: fonts.count(font) for font in set(fonts)}
    return sorted(counts, key=lambda value: (-counts[value], value))[0]


def _is_bold(font: str | None) -> bool:
    value = (font or "").lower()
    return any(token in value for token in ("bold", "black", "demi", "semibold"))


def _is_italic(font: str | None) -> bool:
    value = (font or "").lower()
    return "italic" in value or "oblique" in value


def _bbox(x0, top, x1, bottom) -> BBox:
    return tuple(round(float(value), 3) for value in (x0, top, x1, bottom))  # type: ignore[return-value]


def _merge_bbox(values: Iterable[BBox]) -> BBox:
    boxes = list(values)
    if not boxes:
        return (0.0, 0.0, 0.0, 0.0)
    return _bbox(
        min(value[0] for value in boxes), min(value[1] for value in boxes),
        max(value[2] for value in boxes), max(value[3] for value in boxes),
    )


def _center_x(bbox: BBox) -> float:
    return (bbox[0] + bbox[2]) / 2.0


def _center_y(bbox: BBox) -> float:
    return (bbox[1] + bbox[3]) / 2.0
