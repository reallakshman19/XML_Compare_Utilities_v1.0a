"""Validation and source identity helpers for PDF chart API requests."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from document_conversion_service import (
    ConversionApiError,
    ConversionServiceConfig,
    resolve_source_path,
)
from pdf_chart_policy import (
    DEFAULT_MAX_RENDER_PAGES,
    DEFAULT_MAX_VECTOR_PAGES,
    DEFAULT_RENDER_SCALE,
    MAX_RENDER_SCALE,
)
from pdf_conversion import git_blob_sha, sha256_hex


def parse_render_request(payload):
    request = _base_request(payload, {"scale", "format"}, DEFAULT_MAX_RENDER_PAGES)
    options = payload.get("options") or {}
    scale = options.get("scale", DEFAULT_RENDER_SCALE)
    if isinstance(scale, bool) or not isinstance(scale, (int, float)):
        raise ConversionApiError("PDF_PAGE_RENDER_SCALE_INVALID", "render scale must be a finite number")
    if not math.isfinite(float(scale)):
        raise ConversionApiError("PDF_PAGE_RENDER_SCALE_INVALID", "render scale must be a finite number")
    scale = float(scale)
    if not 1.0 <= scale <= MAX_RENDER_SCALE:
        raise ConversionApiError(
            "PDF_PAGE_RENDER_SCALE_INVALID",
            f"render scale must be between 1 and {MAX_RENDER_SCALE:g}",
        )
    if options.get("format", "png") != "png":
        raise ConversionApiError(
            "PDF_PAGE_RENDER_FORMAT_UNSUPPORTED",
            "only lossless PNG rendering is supported",
            415,
        )
    return {**request, "scale": round(scale, 6)}


def parse_vector_request(payload):
    return _base_request(payload, set(), DEFAULT_MAX_VECTOR_PAGES)


def load_pdf_source(logical_path, config: ConversionServiceConfig):
    resolved = resolve_source_path(logical_path, config.allowed_roots)
    if resolved.suffix.lower() != ".pdf":
        raise ConversionApiError(
            "PDF_CHART_SOURCE_REQUIRED",
            "chart rendering/vector inspection requires a .pdf source",
            415,
        )
    size = resolved.stat().st_size
    if size > config.max_source_bytes:
        raise ConversionApiError(
            "API_SOURCE_SIZE_LIMIT_EXCEEDED",
            f"source is {size} bytes; API limit is {config.max_source_bytes}",
            413,
        )
    return resolved, resolved.read_bytes()


def source_identity(path: Path, logical_path: str, data: bytes) -> dict:
    return {
        "logicalPath": logical_path,
        "resolvedName": path.name,
        "type": "pdf",
        "sha256": f"sha256:{sha256_hex(data)}",
        "gitBlobSha": git_blob_sha(data),
        "sizeBytes": len(data),
    }


def hash_request(value) -> str:
    data = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def _base_request(payload, allowed_options, max_pages):
    if not isinstance(payload, dict):
        raise ConversionApiError("API_REQUEST_INVALID", "request body must be a JSON object")
    unknown = sorted(set(payload) - {"sourcePath", "pages", "options", "password"})
    if unknown:
        raise ConversionApiError(
            "PDF_CHART_REQUEST_FIELD_UNKNOWN",
            f"unknown request fields: {', '.join(unknown)}",
        )
    options = payload.get("options") or {}
    if not isinstance(options, dict):
        raise ConversionApiError("PDF_CHART_OPTIONS_INVALID", "options must be a JSON object")
    unknown_options = sorted(set(options) - allowed_options)
    if unknown_options:
        raise ConversionApiError(
            "PDF_CHART_OPTION_UNKNOWN",
            f"unknown options: {', '.join(unknown_options)}",
        )
    pages = _parse_page_list(payload.get("pages"), max_pages)
    password = payload.get("password")
    if password is not None and not isinstance(password, str):
        raise ConversionApiError("API_PASSWORD_INVALID", "password must be a string when supplied")
    return {"sourcePath": payload.get("sourcePath"), "pages": pages, "password": password}


def _parse_page_list(value, max_pages):
    if not isinstance(value, list) or not value:
        raise ConversionApiError(
            "PDF_CHART_PAGES_REQUIRED",
            "pages must be a non-empty array of 1-based page numbers",
        )
    if len(value) > max_pages:
        raise ConversionApiError(
            "PDF_CHART_PAGE_LIMIT_EXCEEDED",
            f"requested {len(value)} pages; limit is {max_pages}",
            422,
        )
    if any(isinstance(item, bool) or not isinstance(item, int) or item < 1 for item in value):
        raise ConversionApiError("PDF_CHART_PAGE_INVALID", "every page must be a positive integer")
    if len(set(value)) != len(value):
        raise ConversionApiError("PDF_CHART_PAGE_DUPLICATE", "pages must not contain duplicates")
    return tuple(sorted(value))
