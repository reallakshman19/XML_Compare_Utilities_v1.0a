"""Pure service layer for controlled DOCX/PDF -> Markdown API requests."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any

from pdf_page_range import PageRange, PageRangeError, make_page_range_backends
from pdf_search_index import (
    DEFAULT_MAX_CACHE_DOCUMENTS,
    DEFAULT_MAX_INDEX_CHARS,
    DEFAULT_MAX_PERSISTED_DOCUMENTS,
    DEFAULT_MAX_SEARCH_RESULTS,
    MAX_QUERY_CHARS,
    SEARCH_OCR_MODES,
    PdfSearchError,
    PdfSearchIndexCache,
    PdfSearchIndexStore,
    build_pdf_search_index,
    index_metadata,
    search_cache_key,
    search_pdf_index,
)

API_SCHEMA = "DocumentConversionApi.v1"
DEFAULT_MAX_SOURCE_BYTES = 512 * 1024 * 1024
DEFAULT_MAX_RANGE_PAGES = 50
DEFAULT_SEARCH_OCR_CONFIDENCE_MIN = 0.70
DEFAULT_SEARCH_OCR_MAX_PAGES = 100
DEFAULT_SEARCH_OCR_MAX_JOB_PIXELS = 250_000_000
DEFAULT_SEARCH_OCR_TIMEOUT_SECONDS = 60.0
_ALLOWED_SUFFIXES = {".docx", ".pdf"}
_ALLOWED_OPTION_KEYS = {
    "headers",
    "footers",
    "tableMode",
    "ocr",
    "ocrLanguage",
    "images",
    "engineeringRegions",
    "revisions",
}
_ALLOWED_SEARCH_OPTION_KEYS = {
    "caseSensitive",
    "wholeWord",
    "useRegex",
    "ocr",
    "ocrLanguage",
    "ocrConfidenceMin",
}


class ConversionApiError(ValueError):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status

    def to_dict(self) -> dict:
        return {"error": {"code": self.code, "message": str(self)}}


@dataclass(frozen=True)
class ConversionServiceConfig:
    allowed_roots: tuple[Path, ...]
    max_source_bytes: int = DEFAULT_MAX_SOURCE_BYTES
    max_range_pages: int = DEFAULT_MAX_RANGE_PAGES
    max_source_pages: int = 2000
    max_search_index_chars: int = DEFAULT_MAX_INDEX_CHARS
    max_search_results: int = DEFAULT_MAX_SEARCH_RESULTS
    max_search_cache_documents: int = DEFAULT_MAX_CACHE_DOCUMENTS
    search_index_dir: Path | None = None
    max_search_persisted_documents: int = DEFAULT_MAX_PERSISTED_DOCUMENTS
    search_ocr_confidence_min: float = DEFAULT_SEARCH_OCR_CONFIDENCE_MIN
    search_ocr_max_pages: int = DEFAULT_SEARCH_OCR_MAX_PAGES
    search_ocr_max_job_pixels: int = DEFAULT_SEARCH_OCR_MAX_JOB_PIXELS
    search_ocr_timeout_seconds: float = DEFAULT_SEARCH_OCR_TIMEOUT_SECONDS

    def __post_init__(self) -> None:
        if not self.allowed_roots:
            raise ConversionApiError(
                "API_ALLOWED_ROOT_REQUIRED",
                "at least one allowed source root is required",
                500,
            )
        limits = (
            self.max_source_bytes,
            self.max_range_pages,
            self.max_source_pages,
            self.max_search_index_chars,
            self.max_search_results,
            self.max_search_cache_documents,
            self.max_search_persisted_documents,
            self.search_ocr_max_pages,
            self.search_ocr_max_job_pixels,
        )
        if min(limits) <= 0 or self.search_ocr_timeout_seconds <= 0:
            raise ConversionApiError(
                "API_POLICY_INVALID",
                "conversion/search service limits must be positive",
                500,
            )
        if not 0.0 <= self.search_ocr_confidence_min <= 1.0:
            raise ConversionApiError(
                "API_POLICY_INVALID",
                "search OCR confidence must be between 0 and 1",
                500,
            )

    @classmethod
    def from_roots(
        cls,
        roots,
        *,
        max_source_bytes: int = DEFAULT_MAX_SOURCE_BYTES,
        max_range_pages: int = DEFAULT_MAX_RANGE_PAGES,
        max_source_pages: int = 2000,
        max_search_index_chars: int = DEFAULT_MAX_INDEX_CHARS,
        max_search_results: int = DEFAULT_MAX_SEARCH_RESULTS,
        max_search_cache_documents: int = DEFAULT_MAX_CACHE_DOCUMENTS,
        search_index_dir: str | Path | None = None,
        max_search_persisted_documents: int = DEFAULT_MAX_PERSISTED_DOCUMENTS,
        search_ocr_confidence_min: float = DEFAULT_SEARCH_OCR_CONFIDENCE_MIN,
        search_ocr_max_pages: int = DEFAULT_SEARCH_OCR_MAX_PAGES,
        search_ocr_max_job_pixels: int = DEFAULT_SEARCH_OCR_MAX_JOB_PIXELS,
        search_ocr_timeout_seconds: float = DEFAULT_SEARCH_OCR_TIMEOUT_SECONDS,
    ) -> "ConversionServiceConfig":
        resolved = tuple(Path(root).expanduser().resolve(strict=True) for root in roots)
        index_dir = None if search_index_dir is None else Path(search_index_dir).expanduser().resolve()
        return cls(
            resolved,
            max_source_bytes,
            max_range_pages,
            max_source_pages,
            max_search_index_chars,
            max_search_results,
            max_search_cache_documents,
            index_dir,
            max_search_persisted_documents,
            search_ocr_confidence_min,
            search_ocr_max_pages,
            search_ocr_max_job_pixels,
            search_ocr_timeout_seconds,
        )


class DocumentConversionService:
    def __init__(
        self,
        config: ConversionServiceConfig,
        *,
        search_backend=None,
        search_rasterizer=None,
        search_ocr_engine=None,
    ):
        self.config = config
        self._search_backend = search_backend
        self._search_rasterizer = search_rasterizer
        self._search_ocr_engine = search_ocr_engine
        store = None
        if config.search_index_dir is not None:
            try:
                store = PdfSearchIndexStore(
                    config.search_index_dir,
                    max_documents=config.max_search_persisted_documents,
                )
            except (OSError, PdfSearchError) as exc:
                raise ConversionApiError(
                    "PDF_SEARCH_STORE_UNAVAILABLE",
                    f"cannot initialize persistent PDF search index: {exc}",
                    500,
                ) from exc
        self._search_cache = PdfSearchIndexCache(
            config.max_search_cache_documents,
            store=store,
        )

    def convert(self, payload: dict[str, Any]) -> dict:
        request = _parse_request(payload, self.config)
        resolved = resolve_source_path(request["sourcePath"], self.config.allowed_roots)
        source_bytes = _read_bounded(resolved, self.config.max_source_bytes)
        suffix = resolved.suffix.lower()
        if suffix == ".pdf":
            result = self._convert_pdf(source_bytes, request)
        elif suffix == ".docx":
            result = self._convert_docx(source_bytes, request)
        else:
            raise ConversionApiError("API_SOURCE_TYPE_UNSUPPORTED", f"unsupported source type: {suffix}", 415)

        source_sha = hashlib.sha256(source_bytes).hexdigest()
        request_identity = {
            "schema": API_SCHEMA,
            "sourceSha256": source_sha,
            "sourceType": suffix[1:],
            "pageRange": request["pageRange"].to_dict() if request["pageRange"] else None,
            "options": request["options"],
        }
        request_hash = hashlib.sha256(_canonical_json(request_identity)).hexdigest()
        result.update({
            "schema": API_SCHEMA,
            "requestHash": f"sha256:{request_hash}",
            "source": {
                "logicalPath": request["sourcePath"],
                "type": suffix[1:],
                "sha256": f"sha256:{source_sha}",
                "sizeBytes": len(source_bytes),
            },
            "pageRange": request["pageRange"].to_dict() if request["pageRange"] else None,
        })
        return result

    def search(self, payload: dict[str, Any]) -> dict:
        request = _parse_search_request(payload, self.config)
        resolved = resolve_source_path(request["sourcePath"], self.config.allowed_roots)
        if resolved.suffix.lower() != ".pdf":
            raise ConversionApiError(
                "PDF_SEARCH_SOURCE_REQUIRED",
                "PDF search currently supports .pdf sources only",
                415,
            )
        source_bytes = _read_bounded(resolved, self.config.max_source_bytes)
        source_sha = hashlib.sha256(source_bytes).hexdigest()
        cache_key = search_cache_key(
            source_sha,
            password_fingerprint=_password_fingerprint(request["password"]),
            ocr_mode=request["indexOptions"]["ocr"],
            ocr_language=request["indexOptions"]["ocrLanguage"],
            ocr_confidence_min=request["indexOptions"]["ocrConfidenceMin"],
        )
        try:
            index, cache_source = self._search_cache.get_or_build(
                cache_key,
                lambda: self._build_search_index(source_bytes, request),
            )
            result = search_pdf_index(
                index,
                request["query"],
                case_sensitive=request["options"]["caseSensitive"],
                whole_word=request["options"]["wholeWord"],
                max_results=self.config.max_search_results,
            )
        except PdfSearchError as exc:
            raise ConversionApiError(exc.code, str(exc), 422) from exc

        result.update({
            "source": {
                "logicalPath": request["sourcePath"],
                "type": "pdf",
                "sha256": f"sha256:{source_sha}",
                "sizeBytes": len(source_bytes),
            },
            "index": index_metadata(index, cache_source=cache_source),
            "indexOptions": request["indexOptions"],
            "diagnostics": _search_diagnostics(index, request["indexOptions"]["ocr"]),
        })
        return result

    def _build_search_index(self, source_bytes: bytes, request: dict):
        options = request["indexOptions"]
        return build_pdf_search_index(
            source_bytes,
            backend=self._search_backend,
            password=request["password"],
            max_pages=self.config.max_source_pages,
            max_index_chars=self.config.max_search_index_chars,
            ocr_mode=options["ocr"],
            ocr_language=options["ocrLanguage"],
            ocr_confidence_min=options["ocrConfidenceMin"],
            ocr_max_pages=self.config.search_ocr_max_pages,
            ocr_max_job_pixels=self.config.search_ocr_max_job_pixels,
            ocr_timeout_seconds=self.config.search_ocr_timeout_seconds,
            rasterizer=self._search_rasterizer,
            ocr_engine=self._search_ocr_engine,
        )

    def _convert_pdf(self, source_bytes: bytes, request: dict) -> dict:
        from document_model import build_evidence, options_hash
        from pdf_engineering_conversion import (
            ENGINEERING_CANONICALIZATION_VERSION,
            ENGINEERING_CONVERSION_REVISION,
            ENGINEERING_REGION_REVISION,
            _canonical_options,
            git_blob_sha,
            prepare_engineering_document,
            sha256_hex,
        )
        from pdf_figure_conversion import render_pdf_document

        page_range = request["pageRange"]
        kwargs = _pdf_kwargs(request)
        range_backends = None
        if page_range is not None:
            range_backends = make_page_range_backends(
                page_range,
                max_source_pages=self.config.max_source_pages,
            )
            kwargs.update({
                "backend": range_backends.native,
                "table_backend": range_backends.table,
                "figure_backend": range_backends.figure,
                "engineering_backend": range_backends.engineering,
            })

        try:
            document, stats, payloads = prepare_engineering_document(source_bytes, **kwargs)
        except PageRangeError as exc:
            raise ConversionApiError(exc.code, str(exc), 422) from exc
        except ValueError as exc:
            code = getattr(exc, "code", "CONVERSION_FAILED")
            status = 422 if str(code).startswith(("PDF_", "OCR_", "TABLE_")) else 400
            raise ConversionApiError(str(code), str(exc), status) from exc

        if payloads:
            raise ConversionApiError(
                "API_ASSET_TRANSPORT_NOT_IMPLEMENTED",
                "API v1 returns Markdown/evidence only; request options.images=skip for documents with figures",
                422,
            )

        decisions = []
        markdown_bytes = render_pdf_document(
            document,
            kwargs.get("table_mode", "auto"),
            decisions,
        ).encode("utf-8")
        converter_options = _canonical_options(document, kwargs)
        api_options = {
            **converter_options,
            "pageRange": page_range.to_dict() if page_range else None,
            "apiSchema": API_SCHEMA,
        }
        evidence = build_evidence(
            document,
            source_sha256=sha256_hex(source_bytes),
            source_git_blob_sha=git_blob_sha(source_bytes),
            profile="readable",
            options=api_options,
        )
        evidence.update({
            "converterRevision": ENGINEERING_CONVERSION_REVISION,
            "canonicalizationVersion": ENGINEERING_CANONICALIZATION_VERSION,
            "engineeringRegionRevision": ENGINEERING_REGION_REVISION,
            "apiSchema": API_SCHEMA,
            "pageRange": page_range.to_dict() if page_range else None,
        })
        evidence["tableRendering"] = [
            {
                "blockId": block_id,
                "requestedMode": decision.requested_mode,
                "renderer": decision.renderer,
                "classification": decision.classification,
                "reasons": list(decision.reasons),
                **({"diagnostic": decision.diagnostic} if decision.diagnostic else {}),
            }
            for block_id, decision in decisions
        ]
        if page_range is not None:
            evidence.setdefault("diagnostics", []).append({
                "code": "PDF_PAGE_RANGE_CONTEXT_LIMITED",
                "severity": "INFO",
                "message": (
                    "Document-level heading and running-content inference is scoped to the requested page range; "
                    "original PDF page numbers are preserved."
                ),
                "provenance": {"source_type": "pdf", "page": page_range.start},
            })
        total_pages = None if range_backends is None else range_backends.state.get("totalPages")
        return {
            "markdown": markdown_bytes.decode("utf-8"),
            "markdownSha256": f"sha256:{hashlib.sha256(markdown_bytes).hexdigest()}",
            "converterOptionsHash": f"sha256:{options_hash(api_options)}",
            "evidence": evidence,
            "diagnostics": evidence.get("diagnostics", []),
            "stats": {
                **stats,
                **({"source_total_pages": total_pages} if total_pages is not None else {}),
            },
        }

    def _convert_docx(self, source_bytes: bytes, request: dict) -> dict:
        if request["pageRange"] is not None:
            raise ConversionApiError(
                "DOCX_PAGE_RANGE_UNSUPPORTED",
                "page ranges are defined for PDF sources only; DOCX conversion is whole-document",
                422,
            )
        from docx_conversion import conversion_evidence, convert_docx_bytes

        kwargs = _docx_kwargs(request)
        try:
            markdown_bytes, stats = convert_docx_bytes(source_bytes, **kwargs)
            evidence = conversion_evidence(source_bytes, **kwargs)
        except ValueError as exc:
            raise ConversionApiError(
                getattr(exc, "code", "DOCX_CONVERSION_FAILED"),
                str(exc),
                422,
            ) from exc
        return {
            "markdown": markdown_bytes.decode("utf-8"),
            "markdownSha256": f"sha256:{hashlib.sha256(markdown_bytes).hexdigest()}",
            "converterOptionsHash": f"sha256:{stats.get('options_hash', '')}",
            "evidence": evidence,
            "diagnostics": evidence.get("diagnostics", []),
            "stats": stats,
        }


def resolve_source_path(source_path: str, allowed_roots: tuple[Path, ...]) -> Path:
    if not isinstance(source_path, str) or not source_path.strip():
        raise ConversionApiError("API_SOURCE_PATH_REQUIRED", "sourcePath must be a non-empty string")
    if "://" in source_path:
        raise ConversionApiError(
            "API_REMOTE_SOURCE_FORBIDDEN",
            "remote URLs are not fetched by the conversion API; mount the controlled source under an allowed root",
            422,
        )
    candidate = Path(source_path).expanduser()
    if not candidate.is_absolute():
        candidate = allowed_roots[0] / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError as exc:
        raise ConversionApiError("API_SOURCE_NOT_FOUND", "source file does not exist", 404) from exc
    if not resolved.is_file():
        raise ConversionApiError("API_SOURCE_NOT_FILE", "sourcePath must resolve to a file", 422)
    if resolved.suffix.lower() not in _ALLOWED_SUFFIXES:
        raise ConversionApiError("API_SOURCE_TYPE_UNSUPPORTED", "only .pdf and .docx sources are accepted", 415)
    if not any(_is_within(resolved, root) for root in allowed_roots):
        raise ConversionApiError(
            "API_SOURCE_OUTSIDE_ALLOWED_ROOT",
            "resolved source path is outside configured allowed roots",
            403,
        )
    return resolved


def _parse_request(payload: dict[str, Any], config: ConversionServiceConfig) -> dict:
    if not isinstance(payload, dict):
        raise ConversionApiError("API_REQUEST_INVALID", "request body must be a JSON object")
    unknown = sorted(set(payload) - {"sourcePath", "pages", "options", "password"})
    if unknown:
        raise ConversionApiError("API_REQUEST_FIELD_UNKNOWN", f"unknown request fields: {', '.join(unknown)}")
    source_path = payload.get("sourcePath")
    options = payload.get("options") or {}
    if not isinstance(options, dict):
        raise ConversionApiError("API_OPTIONS_INVALID", "options must be a JSON object")
    unknown_options = sorted(set(options) - _ALLOWED_OPTION_KEYS)
    if unknown_options:
        raise ConversionApiError("API_OPTION_UNKNOWN", f"unknown options: {', '.join(unknown_options)}")
    normalized_options = _normalize_options(options)
    pages = _parse_pages(payload.get("pages"), config.max_range_pages)
    password = payload.get("password")
    if password is not None and not isinstance(password, str):
        raise ConversionApiError("API_PASSWORD_INVALID", "password must be a string when supplied")
    return {
        "sourcePath": source_path,
        "pageRange": pages,
        "options": normalized_options,
        "password": password,
    }


def _parse_search_request(payload: dict[str, Any], config: ConversionServiceConfig) -> dict:
    if not isinstance(payload, dict):
        raise ConversionApiError("API_REQUEST_INVALID", "request body must be a JSON object")
    unknown = sorted(set(payload) - {"sourcePath", "query", "options", "password"})
    if unknown:
        raise ConversionApiError(
            "PDF_SEARCH_REQUEST_FIELD_UNKNOWN",
            f"unknown search fields: {', '.join(unknown)}",
        )
    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        raise ConversionApiError("PDF_SEARCH_QUERY_REQUIRED", "query must be a non-empty string")
    if len(query) > MAX_QUERY_CHARS:
        raise ConversionApiError(
            "PDF_SEARCH_QUERY_LIMIT_EXCEEDED",
            f"query length {len(query)} exceeds limit {MAX_QUERY_CHARS}",
            422,
        )
    options = payload.get("options") or {}
    if not isinstance(options, dict):
        raise ConversionApiError("PDF_SEARCH_OPTIONS_INVALID", "search options must be a JSON object")
    unknown_options = sorted(set(options) - _ALLOWED_SEARCH_OPTION_KEYS)
    if unknown_options:
        raise ConversionApiError(
            "PDF_SEARCH_OPTION_UNKNOWN",
            f"unknown search options: {', '.join(unknown_options)}",
        )
    match_options = {
        "caseSensitive": _bool_option("caseSensitive", options.get("caseSensitive", False)),
        "wholeWord": _bool_option("wholeWord", options.get("wholeWord", False)),
        "useRegex": _bool_option("useRegex", options.get("useRegex", False)),
    }
    if match_options["useRegex"]:
        raise ConversionApiError(
            "PDF_SEARCH_REGEX_UNSUPPORTED",
            "regex search is disabled; use literal search with optional wholeWord",
            422,
        )
    index_options = {
        "ocr": options.get("ocr", "auto"),
        "ocrLanguage": options.get("ocrLanguage", "eng"),
        "ocrConfidenceMin": options.get(
            "ocrConfidenceMin",
            config.search_ocr_confidence_min,
        ),
    }
    _choice("search ocr", index_options["ocr"], set(SEARCH_OCR_MODES))
    if not isinstance(index_options["ocrLanguage"], str) or not index_options["ocrLanguage"].strip():
        raise ConversionApiError(
            "PDF_SEARCH_OCR_LANGUAGE_INVALID",
            "ocrLanguage must be a non-empty string",
        )
    confidence = index_options["ocrConfidenceMin"]
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        raise ConversionApiError(
            "PDF_SEARCH_OCR_CONFIDENCE_INVALID",
            "ocrConfidenceMin must be a number between 0 and 1",
        )
    if not 0.0 <= float(confidence) <= 1.0:
        raise ConversionApiError(
            "PDF_SEARCH_OCR_CONFIDENCE_INVALID",
            "ocrConfidenceMin must be between 0 and 1",
        )
    index_options["ocrConfidenceMin"] = round(float(confidence), 6)
    password = payload.get("password")
    if password is not None and not isinstance(password, str):
        raise ConversionApiError("API_PASSWORD_INVALID", "password must be a string when supplied")
    return {
        "sourcePath": payload.get("sourcePath"),
        "query": query,
        "options": match_options,
        "indexOptions": index_options,
        "password": password,
    }


def _parse_pages(value, max_range_pages: int) -> PageRange | None:
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != {"start", "end"}:
        raise ConversionApiError("PDF_PAGE_RANGE_INVALID", "pages must contain exactly start and end")
    try:
        page_range = PageRange(value["start"], value["end"])
    except PageRangeError as exc:
        raise ConversionApiError(exc.code, str(exc)) from exc
    if page_range.count > max_range_pages:
        raise ConversionApiError(
            "PDF_PAGE_RANGE_LIMIT_EXCEEDED",
            f"requested {page_range.count} pages; API limit is {max_range_pages}",
            422,
        )
    return page_range


def _normalize_options(options: dict) -> dict:
    result = {
        "headers": options.get("headers", "metadata"),
        "footers": options.get("footers", "metadata"),
        "tableMode": options.get("tableMode", "auto"),
        "ocr": options.get("ocr", "auto"),
        "ocrLanguage": options.get("ocrLanguage", "eng"),
        "images": options.get("images", "skip"),
        "engineeringRegions": options.get("engineeringRegions", "auto"),
        "revisions": options.get("revisions", "accepted"),
    }
    _choice("headers", result["headers"], {"keep", "metadata", "drop"})
    _choice("footers", result["footers"], {"keep", "metadata", "drop"})
    _choice("tableMode", result["tableMode"], {"auto", "markdown", "html", "records"})
    _choice("ocr", result["ocr"], {"auto", "always", "never"})
    _choice("images", result["images"], {"extract", "skip"})
    _choice("engineeringRegions", result["engineeringRegions"], {"auto", "always", "never"})
    _choice("revisions", result["revisions"], {"accepted", "rejected", "markup"})
    if result["images"] != "skip":
        raise ConversionApiError(
            "API_ASSET_TRANSPORT_NOT_IMPLEMENTED",
            "API v1 supports options.images=skip only; binary asset transport is a later endpoint",
            422,
        )
    if not isinstance(result["ocrLanguage"], str) or not result["ocrLanguage"].strip():
        raise ConversionApiError("API_OCR_LANGUAGE_INVALID", "ocrLanguage must be a non-empty string")
    return result


def _choice(name: str, value, allowed: set[str]) -> None:
    if value not in allowed:
        raise ConversionApiError("API_OPTION_INVALID", f"{name} must be one of: {', '.join(sorted(allowed))}")


def _bool_option(name: str, value) -> bool:
    if not isinstance(value, bool):
        raise ConversionApiError("PDF_SEARCH_OPTION_INVALID", f"{name} must be boolean")
    return value


def _pdf_kwargs(request: dict) -> dict:
    options = request["options"]
    return {
        "password": request["password"],
        "header_mode": options["headers"],
        "footer_mode": options["footers"],
        "table_mode": options["tableMode"],
        "ocr_mode": options["ocr"],
        "ocr_language": options["ocrLanguage"],
        "image_mode": options["images"],
        "engineering_regions": options["engineeringRegions"],
    }


def _docx_kwargs(request: dict) -> dict:
    options = request["options"]
    return {
        "table_mode": options["tableMode"],
        "revision_mode": options["revisions"],
        "header_mode": options["headers"],
        "footer_mode": options["footers"],
        "image_mode": options["images"],
    }


def _password_fingerprint(password: str | None) -> str:
    if password is None:
        return "none"
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _search_diagnostics(index, ocr_mode: str) -> list[dict]:
    diagnostics = []
    if index.pages_ocr_indexed:
        diagnostics.append({
            "code": "PDF_SEARCH_OCR_INDEX_USED",
            "severity": "INFO",
            "message": f"OCR search text indexed on {len(index.pages_ocr_indexed)} page(s)",
            "provenance": {"source_type": "pdf"},
        })
    if index.pages_without_searchable_text:
        diagnostics.append({
            "code": "PDF_SEARCH_INDEX_INCOMPLETE",
            "severity": "WARNING",
            "message": (
                f"{len(index.pages_without_searchable_text)} page(s) have no trusted searchable text "
                f"after search indexing with OCR mode {ocr_mode}"
            ),
            "provenance": {"source_type": "pdf"},
        })
    return diagnostics


def _read_bounded(path: Path, max_bytes: int) -> bytes:
    size = path.stat().st_size
    if size > max_bytes:
        raise ConversionApiError(
            "API_SOURCE_SIZE_LIMIT_EXCEEDED",
            f"source is {size} bytes; API limit is {max_bytes}",
            413,
        )
    return path.read_bytes()


def _is_within(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
