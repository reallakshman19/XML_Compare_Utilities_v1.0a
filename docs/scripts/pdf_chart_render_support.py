"""Shared rendering records and deterministic resource checks."""
from __future__ import annotations

from dataclasses import dataclass
import importlib.metadata
import math

from pdf_chart_policy import RENDER_PEAK_BYTES_PER_PIXEL


class PdfChartRenderError(ValueError):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.status = status


@dataclass(frozen=True)
class RenderedPdfPage:
    page: int
    page_width: float
    page_height: float
    raster_width: int
    raster_height: int
    scale: float
    png_bytes: bytes
    estimated_bytes: int
    renderer_version: str
    pillow_version: str

    @property
    def pixels(self) -> int:
        return self.raster_width * self.raster_height


def page_plan(page_number, width, height, scale, max_pixels, max_memory_bytes):
    raster_width = int(math.ceil(width * scale))
    raster_height = int(math.ceil(height * scale))
    pixels = raster_width * raster_height
    estimated = int(math.ceil(pixels * RENDER_PEAK_BYTES_PER_PIXEL))
    if pixels > max_pixels or estimated > max_memory_bytes:
        raise PdfChartRenderError(
            "PDF_PAGE_RENDER_RESOURCE_LIMIT_EXCEEDED",
            f"page {page_number} at scale {scale:g} exceeds configured pixel/memory limits",
        )
    return (page_number, width, height, pixels, estimated)


def validate_pages(pages, total_pages, max_source_pages):
    if total_pages > max_source_pages:
        raise PdfChartRenderError(
            "PDF_CHART_SOURCE_PAGE_LIMIT_EXCEEDED",
            f"PDF has {total_pages} pages; service limit is {max_source_pages}",
        )
    out_of_range = [page for page in pages if page > total_pages]
    if out_of_range:
        raise PdfChartRenderError(
            "PDF_CHART_PAGE_OUT_OF_RANGE",
            f"requested page {out_of_range[0]} but PDF has {total_pages} pages",
        )


def package_version(package):
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


def load_pdfium():
    try:
        import pypdfium2 as pdfium
        return pdfium
    except ImportError as exc:
        raise PdfChartRenderError(
            "PDF_PAGE_RENDERER_MISSING",
            "PDF page rendering requires the pinned pypdfium2 dependency",
            500,
        ) from exc
