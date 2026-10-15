"""Range-scoped PDF backend adapters preserving original 1-based page numbers."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import math


class PageRangeError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PageRange:
    start: int
    end: int

    def __post_init__(self) -> None:
        if isinstance(self.start, bool) or isinstance(self.end, bool):
            raise PageRangeError("PDF_PAGE_RANGE_INVALID", "page range values must be integers")
        if not isinstance(self.start, int) or not isinstance(self.end, int):
            raise PageRangeError("PDF_PAGE_RANGE_INVALID", "page range values must be integers")
        if self.start < 1 or self.end < self.start:
            raise PageRangeError(
                "PDF_PAGE_RANGE_INVALID",
                "page range must be 1-based and end must be greater than or equal to start",
            )

    @property
    def count(self) -> int:
        return self.end - self.start + 1

    @property
    def numbers(self) -> range:
        return range(self.start, self.end + 1)

    def validate_total(self, total_pages: int) -> None:
        if total_pages < 1 or self.end > total_pages:
            raise PageRangeError(
                "PDF_PAGE_RANGE_OUT_OF_BOUNDS",
                f"requested pages {self.start}-{self.end} exceed PDF page count {total_pages}",
            )

    def to_dict(self) -> dict:
        return {"start": self.start, "end": self.end, "count": self.count}


@dataclass(frozen=True)
class PageRangeBackends:
    native: object
    table: object
    figure: object
    engineering: object
    state: dict


def make_page_range_backends(
    page_range: PageRange,
    *,
    max_source_pages: int = 2000,
) -> PageRangeBackends:
    """Build lazy range adapters over the existing project-owned PDF backends."""
    if max_source_pages < 1:
        raise PageRangeError("PDF_PAGE_RANGE_POLICY_INVALID", "max_source_pages must be positive")

    from pdf_native import PdfBackendResult, PdfExtractionError, PdfPlumberBackend
    from pdf_tables import PdfPlumberTableBackend
    from pdf_figures import FigureError, PdfFigureCandidate, PdfPlumberFigureBackend
    from pdf_engineering_regions import (
        EngineeringPageGeometry,
        EngineeringRegionError,
        PdfPlumberEngineeringBackend,
        VectorObject,
    )

    state: dict[str, int] = {}

    def validate(total_pages: int, selected_limit: int | None = None) -> None:
        if total_pages > max_source_pages:
            raise PageRangeError(
                "PDF_PAGE_LIMIT_EXCEEDED",
                f"PDF has {total_pages} pages; source limit is {max_source_pages}",
            )
        page_range.validate_total(total_pages)
        if selected_limit is not None and page_range.count > selected_limit:
            raise PageRangeError(
                "PDF_PAGE_RANGE_LIMIT_EXCEEDED",
                f"requested {page_range.count} pages; selected-page limit is {selected_limit}",
            )
        prior = state.get("totalPages")
        if prior is not None and prior != total_pages:
            raise PageRangeError("PDF_PAGE_COUNT_CHANGED", "PDF page count changed during one conversion request")
        state["totalPages"] = total_pages

    class NativeRangeBackend(PdfPlumberBackend):
        def extract(
            self,
            pdf_bytes: bytes,
            *,
            password: str | None = None,
            max_pages: int = 2000,
            max_page_area: float = 200_000_000.0,
            max_chars_per_page: int = 1_000_000,
        ):
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
                    validate(len(pdf.pages), max_pages)
                    pages = tuple(
                        self._extract_page(
                            pdf.pages[page_number - 1],
                            page_number,
                            max_page_area,
                            max_chars_per_page,
                        )
                        for page_number in page_range.numbers
                    )
                    return PdfBackendResult(
                        pages,
                        _stable_metadata(dict(pdf.metadata or {})),
                        {
                            "pdfplumber": str(getattr(pdfplumber, "__version__", "unknown")),
                            "pdfminer.six": str(getattr(pdfminer, "__version__", "unknown")),
                        },
                    )
            except PageRangeError as exc:
                raise PdfExtractionError(exc.code, str(exc)) from exc
            except PdfExtractionError:
                raise
            except Exception as exc:
                detail = " ".join((type(exc).__name__, str(exc), repr(exc))).lower()
                if "password" in detail or "encrypted" in detail:
                    raise PdfExtractionError("PDF_ENCRYPTED", "PDF requires a valid password") from exc
                raise PdfExtractionError("PDF_MALFORMED", f"PDF parser failed: {type(exc).__name__}: {exc}") from exc

    class TableRangeBackend(PdfPlumberTableBackend):
        def extract(
            self,
            pdf_bytes: bytes,
            *,
            password: str | None = None,
            max_pages: int = 2000,
            max_page_area: float = 200_000_000.0,
        ):
            try:
                import pdfplumber
            except ImportError as exc:
                raise ValueError("PDF table extraction requires requirements-pdf.txt") from exc
            results = {}
            with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                validate(len(pdf.pages), max_pages)
                for page_number in page_range.numbers:
                    page = pdf.pages[page_number - 1]
                    if float(page.width) * float(page.height) > max_page_area:
                        raise ValueError(f"PDF page {page_number} exceeds safe table-extraction area")
                    candidates = [
                        *self._strategy_candidates(page, page_number, "ruled"),
                        *self._strategy_candidates(page, page_number, "text"),
                    ]
                    results[page_number] = tuple(candidates)
                    page.close()
            return results

    class FigureRangeBackend(PdfPlumberFigureBackend):
        def extract(
            self,
            pdf_bytes: bytes,
            *,
            password: str | None = None,
            max_pages: int = 2000,
        ):
            try:
                import pdfplumber
            except ImportError as exc:
                raise FigureError(
                    "PDF_FIGURE_BACKEND_MISSING",
                    "PDF figure discovery requires the pinned pdfplumber dependency",
                ) from exc
            result = {}
            try:
                with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                    validate(len(pdf.pages), max_pages)
                    for page_number in page_range.numbers:
                        page = pdf.pages[page_number - 1]
                        width, height = float(page.width), float(page.height)
                        values = []
                        for source_index, image in enumerate(page.images):
                            srcsize = image.get("srcsize")
                            values.append(PdfFigureCandidate(
                                page_number,
                                source_index,
                                _image_bbox(image) or (0.0, 0.0, 0.0, 0.0),
                                width,
                                height,
                                name=_safe_name(image.get("name")),
                                src_width=_safe_int(srcsize[0]) if srcsize and len(srcsize) > 0 else None,
                                src_height=_safe_int(srcsize[1]) if srcsize and len(srcsize) > 1 else None,
                            ))
                        result[page_number] = tuple(values)
                        page.close()
                return result
            except PageRangeError as exc:
                raise FigureError(exc.code, str(exc), "FATAL") from exc
            except FigureError:
                raise
            except Exception as exc:
                detail = f"{type(exc).__name__}: {exc}"
                if "password" in detail.lower() or "encrypted" in detail.lower():
                    raise FigureError("PDF_FIGURE_PASSWORD_REQUIRED", "PDF requires a valid password", "FATAL") from exc
                raise FigureError("PDF_FIGURE_EXTRACTION_FAILED", detail) from exc

    class EngineeringRangeBackend(PdfPlumberEngineeringBackend):
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
                    validate(len(pdf.pages), max_pages)
                    for page_number in page_range.numbers:
                        page = pdf.pages[page_number - 1]
                        width, height = float(page.width), float(page.height)
                        vectors = []
                        for kind, objects in (("line", page.lines), ("rect", page.rects), ("curve", page.curves)):
                            for value in objects:
                                bbox = _object_bbox(value)
                                if bbox and _meaningful_vector(bbox):
                                    vectors.append(VectorObject(bbox, kind))
                        result[page_number] = EngineeringPageGeometry(
                            page_number, width, height, tuple(vectors),
                        )
                        page.close()
                return result
            except PageRangeError as exc:
                raise EngineeringRegionError(exc.code, str(exc), "FATAL") from exc
            except EngineeringRegionError:
                raise
            except Exception as exc:
                detail = f"{type(exc).__name__}: {exc}"
                if "password" in detail.lower() or "encrypted" in detail.lower():
                    raise EngineeringRegionError(
                        "PDF_ENGINEERING_PASSWORD_REQUIRED", "PDF requires a valid password", "FATAL",
                    ) from exc
                raise EngineeringRegionError("PDF_ENGINEERING_GEOMETRY_FAILED", detail) from exc

    return PageRangeBackends(
        NativeRangeBackend(),
        TableRangeBackend(),
        FigureRangeBackend(),
        EngineeringRangeBackend(),
        state,
    )


def _stable_metadata(metadata: dict) -> dict:
    stable = {}
    for key, value in sorted(metadata.items(), key=lambda item: str(item[0])):
        if isinstance(value, (str, int, float, bool)) or value is None:
            stable[str(key)] = value
        else:
            stable[str(key)] = str(value)
    return stable


def _image_bbox(image) -> tuple[float, float, float, float] | None:
    try:
        values = tuple(float(image[key]) for key in ("x0", "top", "x1", "bottom"))
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in values):
        return None
    x0, top, x1, bottom = values
    return (round(x0, 3), round(top, 3), round(x1, 3), round(bottom, 3))


def _safe_name(value) -> str | None:
    return None if value is None else str(value)[:256]


def _safe_int(value) -> int | None:
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def _object_bbox(obj) -> tuple[float, float, float, float] | None:
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
        if not all(math.isfinite(value) for value in values):
            return None
        x0, top, x1, bottom = values
        return (
            round(min(x0, x1), 3), round(min(top, bottom), 3),
            round(max(x0, x1), 3), round(max(top, bottom), 3),
        )
    except (TypeError, ValueError):
        return None


def _meaningful_vector(bbox) -> bool:
    return (bbox[2] - bbox[0]) >= 2 or (bbox[3] - bbox[1]) >= 2
