"""HTTP request handlers for governed PDF chart review evidence."""
from __future__ import annotations

from typing import Any

from document_conversion_service import ConversionApiError, ConversionServiceConfig
from pdf_chart_policy import (
    DEFAULT_MAX_RENDER_JOB_PIXELS,
    DEFAULT_MAX_RENDER_PAGES,
    DEFAULT_MAX_RENDER_PIXELS,
    DEFAULT_MAX_VECTOR_PAGES,
    DEFAULT_MAX_VECTOR_PATH_COMMANDS_PER_PAGE,
    DEFAULT_MAX_VECTOR_PRIMITIVES_PER_PAGE,
    DEFAULT_RENDER_SCALE,
    MAX_RENDER_SCALE,
    PAGE_RENDER_REVISION,
    PAGE_RENDER_SCHEMA,
    VECTOR_INSPECTION_REVISION,
    VECTOR_INSPECTION_SCHEMA,
)
from pdf_chart_render import PdfiumPageRenderer
from pdf_chart_render_support import PdfChartRenderError
from pdf_chart_requests import (
    hash_request,
    load_pdf_source,
    parse_render_request,
    parse_vector_request,
    source_identity,
)
from pdf_chart_policy import coordinate_system, interpretation_boundary
from pdf_chart_bundle import ChartBinaryResponse, build_render_bundle
from pdf_chart_vectors import (
    PdfPlumberVectorInspector,
    PdfVectorInspectionError,
    vector_backend_versions,
)


def render_pages_request(
    payload: dict[str, Any],
    config: ConversionServiceConfig,
    *,
    renderer=None,
) -> dict:
    request = parse_render_request(payload)
    source_path, pdf_bytes = load_pdf_source(request["sourcePath"], config)
    try:
        rendered = (renderer or PdfiumPageRenderer()).render_pages(
            pdf_bytes,
            request["pages"],
            password=request["password"],
            scale=request["scale"],
            max_source_pages=config.max_source_pages,
        )
    except PdfChartRenderError as exc:
        raise ConversionApiError(exc.code, str(exc), exc.status) from exc
    source = source_identity(source_path, request["sourcePath"], pdf_bytes)
    identity = {
        "revision": PAGE_RENDER_REVISION,
        "sourceSha256": source["sha256"],
        "pages": list(request["pages"]),
        "scale": request["scale"],
        "format": "png",
    }
    request_hash = hash_request(identity)
    return build_render_bundle(rendered, source, request_hash, PAGE_RENDER_REVISION)


def inspect_vectors_request(
    payload: dict[str, Any],
    config: ConversionServiceConfig,
    *,
    inspector=None,
) -> dict:
    request = parse_vector_request(payload)
    source_path, pdf_bytes = load_pdf_source(request["sourcePath"], config)
    try:
        pages = (inspector or PdfPlumberVectorInspector()).inspect(
            pdf_bytes,
            request["pages"],
            password=request["password"],
            max_source_pages=config.max_source_pages,
        )
    except PdfVectorInspectionError as exc:
        raise ConversionApiError(exc.code, str(exc), exc.status) from exc
    source = source_identity(source_path, request["sourcePath"], pdf_bytes)
    identity = {
        "revision": VECTOR_INSPECTION_REVISION,
        "sourceSha256": source["sha256"],
        "pages": list(request["pages"]),
    }
    return {
        "schema": VECTOR_INSPECTION_SCHEMA,
        "revision": VECTOR_INSPECTION_REVISION,
        "requestHash": hash_request(identity),
        "source": source,
        "coordinateSystem": coordinate_system(),
        "backendVersions": vector_backend_versions(),
        "pages": list(pages),
        "interpretation": interpretation_boundary(),
    }


def chart_api_capabilities() -> dict:
    return {
        "pdfPageRender": {
            "supported": True, "endpoint": "/v1/render-pages",
            "format": ["png"], "transport": "deterministic-zip",
            "defaultScale": DEFAULT_RENDER_SCALE, "maxScale": MAX_RENDER_SCALE,
            "maxPages": DEFAULT_MAX_RENDER_PAGES,
            "maxPixelsPerPage": DEFAULT_MAX_RENDER_PIXELS,
            "maxJobPixels": DEFAULT_MAX_RENDER_JOB_PIXELS,
        },
        "pdfVectorInspection": {
            "supported": True, "endpoint": "/v1/inspect-vectors",
            "primitives": ["line", "rect", "curve"],
            "maxPages": DEFAULT_MAX_VECTOR_PAGES,
            "maxPrimitivesPerPage": DEFAULT_MAX_VECTOR_PRIMITIVES_PER_PAGE,
            "maxPathCommandsPerPage": DEFAULT_MAX_VECTOR_PATH_COMMANDS_PER_PAGE,
            "axisCalibration": False, "curveDigitization": False,
        },
    }


__all__ = [
    "ChartBinaryResponse",
    "chart_api_capabilities",
    "inspect_vectors_request",
    "render_pages_request",
]
