"""Deterministic full-page PDF rendering for governed chart review."""
from __future__ import annotations

from io import BytesIO

from pdf_chart_policy import (
    DEFAULT_MAX_RENDER_JOB_PIXELS,
    DEFAULT_MAX_RENDER_MEMORY_BYTES,
    DEFAULT_MAX_RENDER_PIXELS,
)
from pdf_chart_render_support import (
    PdfChartRenderError,
    RenderedPdfPage,
    load_pdfium,
    package_version,
    page_plan,
    validate_pages,
)


class PdfiumPageRenderer:
    """Render selected complete PDF pages to deterministic lossless PNG."""

    def render_pages(
        self,
        pdf_bytes: bytes,
        pages: tuple[int, ...],
        *,
        password: str | None,
        scale: float,
        max_source_pages: int,
        max_pixels: int = DEFAULT_MAX_RENDER_PIXELS,
        max_job_pixels: int = DEFAULT_MAX_RENDER_JOB_PIXELS,
        max_memory_bytes: int = DEFAULT_MAX_RENDER_MEMORY_BYTES,
    ) -> tuple[RenderedPdfPage, ...]:
        document = None
        try:
            document = load_pdfium().PdfDocument(pdf_bytes, password=password)
            validate_pages(pages, len(document), max_source_pages)
            plans = self._plans(document, pages, scale, max_pixels, max_memory_bytes)
            if sum(item[3] for item in plans) > max_job_pixels:
                raise PdfChartRenderError(
                    "PDF_PAGE_RENDER_JOB_LIMIT_EXCEEDED",
                    f"render job exceeds {max_job_pixels} pixels; reduce page count or scale",
                )
            return tuple(self._render(document, item, scale) for item in plans)
        except PdfChartRenderError:
            raise
        except Exception as exc:
            raise _render_failure(exc) from exc
        finally:
            if document is not None:
                _safe_close(document)

    def _plans(self, document, pages, scale, max_pixels, max_memory_bytes):
        plans = []
        for page_number in pages:
            page = document.get_page(page_number - 1)
            try:
                width, height = (float(value) for value in page.get_size())
            finally:
                page.close()
            plans.append(page_plan(
                page_number, width, height, scale, max_pixels, max_memory_bytes,
            ))
        return tuple(plans)

    def _render(self, document, plan, scale):
        page_number, page_width, page_height, _, estimated = plan
        page = bitmap = None
        try:
            page = document.get_page(page_number - 1)
            bitmap = page.render(scale=scale, may_draw_forms=True, draw_annots=False)
            image = bitmap.to_pil().convert("RGB")
            stream = BytesIO()
            image.save(stream, format="PNG", optimize=False, compress_level=9)
            return RenderedPdfPage(
                page_number, page_width, page_height, image.width, image.height,
                round(scale, 6), stream.getvalue(), estimated,
                package_version("pypdfium2"), package_version("Pillow"),
            )
        finally:
            _safe_close(bitmap)
            _safe_close(page)


def _render_failure(exc):
    detail = f"{type(exc).__name__}: {exc}"
    if "password" in detail.lower() or "encrypted" in detail.lower():
        return PdfChartRenderError(
            "PDF_PAGE_RENDER_PASSWORD_REQUIRED",
            "PDF requires a valid password",
        )
    return PdfChartRenderError("PDF_PAGE_RENDER_FAILED", detail)


def _safe_close(value):
    if value is None:
        return
    try:
        value.close()
    except Exception:
        pass
