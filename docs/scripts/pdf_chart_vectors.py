"""Raw PDF vector-geometry inspection for vector-first chart recovery."""
from __future__ import annotations

from io import BytesIO
import hashlib
import importlib.metadata

from pdf_chart_policy import (
    DEFAULT_MAX_VECTOR_PATH_COMMANDS_PER_PAGE,
    DEFAULT_MAX_VECTOR_PRIMITIVES_PER_PAGE,
)
from pdf_chart_vector_normalize import normalize_primitive


class PdfVectorInspectionError(ValueError):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.status = status


class PdfPlumberVectorInspector:
    """Expose raw line/rect/Bezier geometry without chart interpretation."""

    def inspect(
        self,
        pdf_bytes: bytes,
        pages: tuple[int, ...],
        *,
        password: str | None,
        max_source_pages: int,
        max_primitives_per_page: int = DEFAULT_MAX_VECTOR_PRIMITIVES_PER_PAGE,
        max_path_commands_per_page: int = DEFAULT_MAX_VECTOR_PATH_COMMANDS_PER_PAGE,
    ) -> tuple[dict, ...]:
        try:
            import pdfplumber
        except ImportError as exc:
            raise PdfVectorInspectionError(
                "PDF_VECTOR_BACKEND_MISSING",
                "PDF vector inspection requires the pinned pdfplumber dependency",
                500,
            ) from exc
        try:
            with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
                _validate_pages(pages, len(pdf.pages), max_source_pages)
                source_sha = hashlib.sha256(pdf_bytes).hexdigest()
                return tuple(
                    self._inspect_page(
                        pdf.pages[page - 1], page, source_sha,
                        max_primitives_per_page, max_path_commands_per_page,
                    )
                    for page in pages
                )
        except PdfVectorInspectionError:
            raise
        except Exception as exc:
            raise _inspection_failure(exc) from exc

    def _inspect_page(self, page, page_number, source_sha, max_primitives, max_commands):
        width, height = float(page.width), float(page.height)
        image_count = len(page.images)
        raw = _raw_primitives(page)
        if len(raw) > max_primitives:
            raise PdfVectorInspectionError(
                "PDF_VECTOR_PRIMITIVE_LIMIT_EXCEEDED",
                f"page {page_number} has {len(raw)} vector primitives; limit is {max_primitives}",
            )
        primitives = []
        path_commands = 0
        for index, (kind, item) in enumerate(raw):
            primitive = normalize_primitive(source_sha, page_number, index, kind, item)
            path_commands += len(primitive["path"])
            if path_commands > max_commands:
                raise PdfVectorInspectionError(
                    "PDF_VECTOR_PATH_LIMIT_EXCEEDED",
                    f"page {page_number} exceeds {max_commands} path commands",
                )
            primitives.append(primitive)
        page.close()
        return _page_record(page_number, width, height, image_count, primitives, path_commands)


def vector_backend_versions() -> dict:
    return {
        "pdfplumber": _version("pdfplumber"),
        "pdfminer.six": _version("pdfminer.six"),
    }


def _page_record(page, width, height, image_count, primitives, path_commands):
    counts = {
        kind: sum(1 for value in primitives if value["kind"] == kind)
        for kind in ("line", "rect", "curve")
    }
    return {
        "page": page,
        "width": round(width, 6),
        "height": round(height, 6),
        "imageObjectCount": image_count,
        "primitiveCount": len(primitives),
        "pathCommandCount": path_commands,
        "counts": counts,
        "primitives": primitives,
    }


def _raw_primitives(page):
    return (
        [("line", item) for item in page.lines]
        + [("rect", item) for item in page.rects]
        + [("curve", item) for item in page.curves]
    )


def _validate_pages(pages, total_pages, max_source_pages):
    if total_pages > max_source_pages:
        raise PdfVectorInspectionError(
            "PDF_CHART_SOURCE_PAGE_LIMIT_EXCEEDED",
            f"PDF has {total_pages} pages; service limit is {max_source_pages}",
        )
    out_of_range = [page for page in pages if page > total_pages]
    if out_of_range:
        raise PdfVectorInspectionError(
            "PDF_CHART_PAGE_OUT_OF_RANGE",
            f"requested page {out_of_range[0]} but PDF has {total_pages} pages",
        )


def _inspection_failure(exc):
    detail = f"{type(exc).__name__}: {exc}"
    if "password" in detail.lower() or "encrypted" in detail.lower():
        return PdfVectorInspectionError(
            "PDF_VECTOR_PASSWORD_REQUIRED",
            "PDF requires a valid password",
        )
    return PdfVectorInspectionError("PDF_VECTOR_INSPECTION_FAILED", detail)


def _version(package):
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return "unknown"
