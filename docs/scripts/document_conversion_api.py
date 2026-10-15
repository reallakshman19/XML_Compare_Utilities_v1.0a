#!/usr/bin/env python3
"""Controlled HTTP/UI service over the existing DOCX/PDF -> Markdown converters."""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading
from urllib.parse import urlsplit

from document_conversion_service import (
    API_SCHEMA,
    ConversionApiError,
    ConversionServiceConfig,
    DocumentConversionService,
)
from document_evidence_table_http import table_api_capabilities, table_route_operations
from pdf_chart_api import (
    ChartBinaryResponse,
    chart_api_capabilities,
    inspect_vectors_request,
    render_pages_request,
)
from pdf_search_index import (
    DEFAULT_MAX_CACHE_DOCUMENTS,
    DEFAULT_MAX_INDEX_CHARS,
    DEFAULT_MAX_PERSISTED_DOCUMENTS,
    DEFAULT_MAX_SEARCH_RESULTS,
)

DEFAULT_MAX_REQUEST_BYTES = 128 * 1024
UI_ROOT = Path(__file__).resolve().parents[1] / "web" / "document-conversion"
_STATIC_FILES = {
    "/document-conversion/": ("index.html", "text/html; charset=utf-8"),
    "/document-conversion/index.html": ("index.html", "text/html; charset=utf-8"),
    "/document-conversion/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/document-conversion/api-client.js": ("api-client.js", "text/javascript; charset=utf-8"),
    "/document-conversion/ui-render.js": ("ui-render.js", "text/javascript; charset=utf-8"),
    "/document-conversion/styles.css": ("styles.css", "text/css; charset=utf-8"),
}


class ConversionHttpServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        server_address,
        handler_cls,
        *,
        service,
        max_request_bytes,
        max_concurrency,
        ui_root=UI_ROOT,
    ):
        super().__init__(server_address, handler_cls)
        self.service = service
        self.max_request_bytes = max_request_bytes
        self.semaphore = threading.BoundedSemaphore(max_concurrency)
        self.ui_root = Path(ui_root).resolve()


class ConversionRequestHandler(BaseHTTPRequestHandler):
    server_version = "DocumentConversionApi/3"

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/document-conversion/")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/healthz":
            self._write_json(200, {"status": "ok", "schema": API_SCHEMA})
            return
        if path == "/v1/capabilities":
            self._write_json(200, _capabilities(self.server.service.config))
            return
        if path in _STATIC_FILES:
            self._write_static(path)
            return
        self._write_error(404, "API_ROUTE_NOT_FOUND", "route not found")

    def do_POST(self):
        path = urlsplit(self.path).path
        operations = {
            "/v1/convert": self.server.service.convert,
            "/v1/search": self.server.service.search,
            "/v1/render-pages": lambda body: render_pages_request(
                body, self.server.service.config,
            ),
            "/v1/inspect-vectors": lambda body: inspect_vectors_request(
                body, self.server.service.config,
            ),
        }
        operations.update(table_route_operations(self.server.service.config))
        operation = operations.get(path)
        if operation is None:
            self._write_error(404, "API_ROUTE_NOT_FOUND", "route not found")
            return
        payload = self._read_json_request()
        if payload is None:
            return
        if not self.server.semaphore.acquire(blocking=False):
            self._write_error(503, "API_BUSY", "document operation concurrency limit reached")
            return
        try:
            result = operation(payload)
            if isinstance(result, ChartBinaryResponse):
                self._write_binary_response(result)
            else:
                self._write_json(200, result)
        except ConversionApiError as exc:
            self._write_json(exc.status, exc.to_dict())
        except Exception as exc:
            self._write_error(500, "API_INTERNAL_ERROR", f"request failed: {type(exc).__name__}")
        finally:
            self.server.semaphore.release()

    def _write_binary_response(self, result):
        self.send_response(200)
        self.send_header("Content-Type", result.content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{result.filename}"')
        for name, value in result.headers.items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(result.body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(result.body)

    def _read_json_request(self):
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            self._write_error(415, "API_CONTENT_TYPE_REQUIRED", "Content-Type must be application/json")
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._write_error(400, "API_CONTENT_LENGTH_INVALID", "Content-Length must be an integer")
            return None
        if length <= 0 or length > self.server.max_request_bytes:
            self._write_error(
                413,
                "API_REQUEST_SIZE_LIMIT_EXCEEDED",
                f"request body must be 1..{self.server.max_request_bytes} bytes",
            )
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._write_error(400, "API_JSON_INVALID", "request body must be valid UTF-8 JSON")
            return None

    def _write_static(self, path: str):
        filename, content_type = _STATIC_FILES[path]
        target = (self.server.ui_root / filename).resolve()
        if target.parent != self.server.ui_root or not target.is_file():
            self._write_error(404, "UI_ASSET_NOT_FOUND", "UI asset not found")
            return
        self._write_bytes(200, target.read_bytes(), content_type)

    def log_message(self, format, *args):
        super().log_message(format, *args)

    def _write_error(self, status: int, code: str, message: str):
        self._write_json(status, {"error": {"code": code, "message": message}})

    def _write_json(self, status: int, payload: dict):
        data = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        self._write_bytes(status, data, "application/json; charset=utf-8")

    def _write_bytes(self, status: int, data: bytes, content_type: str):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'",
        )
        self.end_headers()
        self.wfile.write(data)


def _capabilities(config: ConversionServiceConfig) -> dict:
    return {
        "schema": API_SCHEMA,
        "sourceTypes": ["docx", "pdf"],
        "ui": {"supported": True, "path": "/document-conversion/"},
        "pdfPageRange": {"supported": True, "numbering": "1-based-inclusive"},
        "pdfSearch": {
            "supported": True,
            "endpoint": "/v1/search",
            "nativeText": True,
            "ocr": ["auto", "always", "never"],
            "persistentIndex": config.search_index_dir is not None,
            "caseSensitive": True,
            "wholeWord": True,
            "regex": False,
            "completeOrError": True,
        },
        **chart_api_capabilities(),
        **table_api_capabilities(),
        "assetTransport": False,
        "remoteSourceFetch": False,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--allow-root",
        action="append",
        default=[],
        help=(
            "Allowed local source root. Repeat for multiple roots. Required unless "
            "DOCUMENT_CONVERSION_ALLOWED_ROOTS is set."
        ),
    )
    parser.add_argument("--max-source-mb", type=int, default=512)
    parser.add_argument("--max-range-pages", type=int, default=50)
    parser.add_argument("--max-source-pages", type=int, default=2000)
    parser.add_argument("--max-search-index-chars", type=int, default=DEFAULT_MAX_INDEX_CHARS)
    parser.add_argument("--max-search-results", type=int, default=DEFAULT_MAX_SEARCH_RESULTS)
    parser.add_argument("--max-search-cache-documents", type=int, default=DEFAULT_MAX_CACHE_DOCUMENTS)
    parser.add_argument(
        "--search-index-dir",
        help=(
            "Persistent PDF search-index directory. Defaults to "
            "DOCUMENT_CONVERSION_SEARCH_INDEX_DIR or ~/.cache/xml-compare-utilities/pdf-search."
        ),
    )
    parser.add_argument("--no-persistent-search-index", action="store_true")
    parser.add_argument(
        "--max-search-persisted-documents",
        type=int,
        default=DEFAULT_MAX_PERSISTED_DOCUMENTS,
    )
    parser.add_argument("--search-ocr-confidence-min", type=float, default=0.70)
    parser.add_argument("--search-ocr-max-pages", type=int, default=100)
    parser.add_argument("--search-ocr-max-job-pixels", type=int, default=250_000_000)
    parser.add_argument("--search-ocr-timeout-seconds", type=float, default=60.0)
    parser.add_argument("--max-request-kb", type=int, default=128)
    parser.add_argument("--max-concurrency", type=int, default=2)
    return parser


def _roots(args) -> list[str]:
    roots = list(args.allow_root)
    env = os.environ.get("DOCUMENT_CONVERSION_ALLOWED_ROOTS", "")
    if env:
        roots.extend(value for value in env.split(os.pathsep) if value)
    if not roots:
        raise ConversionApiError(
            "API_ALLOWED_ROOT_REQUIRED",
            "configure --allow-root or DOCUMENT_CONVERSION_ALLOWED_ROOTS; arbitrary filesystem access is disabled",
            500,
        )
    return roots


def _search_index_dir(args) -> Path | None:
    if args.no_persistent_search_index:
        return None
    configured = args.search_index_dir or os.environ.get("DOCUMENT_CONVERSION_SEARCH_INDEX_DIR")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".cache" / "xml-compare-utilities" / "pdf-search"


def run(argv=None) -> int:
    args = build_parser().parse_args(argv)
    _validate_server_args(args)
    config = ConversionServiceConfig.from_roots(
        _roots(args),
        max_source_bytes=args.max_source_mb * 1024 * 1024,
        max_range_pages=args.max_range_pages,
        max_source_pages=args.max_source_pages,
        max_search_index_chars=args.max_search_index_chars,
        max_search_results=args.max_search_results,
        max_search_cache_documents=args.max_search_cache_documents,
        search_index_dir=_search_index_dir(args),
        max_search_persisted_documents=args.max_search_persisted_documents,
        search_ocr_confidence_min=args.search_ocr_confidence_min,
        search_ocr_max_pages=args.search_ocr_max_pages,
        search_ocr_max_job_pixels=args.search_ocr_max_job_pixels,
        search_ocr_timeout_seconds=args.search_ocr_timeout_seconds,
    )
    service = DocumentConversionService(config)
    server = ConversionHttpServer(
        (args.host, args.port),
        ConversionRequestHandler,
        service=service,
        max_request_bytes=args.max_request_kb * 1024,
        max_concurrency=args.max_concurrency,
    )
    print(f"document conversion API/UI listening on http://{args.host}:{args.port}/document-conversion/")
    print(f"allowed source roots: {len(config.allowed_roots)} configured")
    print(f"persistent PDF search index: {'enabled' if config.search_index_dir else 'disabled'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def _validate_server_args(args) -> None:
    if not 1 <= args.port <= 65535:
        raise ConversionApiError("API_PORT_INVALID", "port must be between 1 and 65535", 500)
    limits = (
        args.max_source_mb,
        args.max_range_pages,
        args.max_source_pages,
        args.max_search_index_chars,
        args.max_search_results,
        args.max_search_cache_documents,
        args.max_search_persisted_documents,
        args.search_ocr_max_pages,
        args.search_ocr_max_job_pixels,
        args.search_ocr_timeout_seconds,
        args.max_request_kb,
        args.max_concurrency,
    )
    if min(limits) <= 0:
        raise ConversionApiError("API_POLICY_INVALID", "all API resource limits must be positive", 500)
    if not 0.0 <= args.search_ocr_confidence_min <= 1.0:
        raise ConversionApiError(
            "API_POLICY_INVALID",
            "search OCR confidence must be between 0 and 1",
            500,
        )


if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except ConversionApiError as exc:
        print(
            f"document_conversion_api: {exc.code}: {exc}",
            file=__import__("sys").stderr,
        )
        raise SystemExit(2)
