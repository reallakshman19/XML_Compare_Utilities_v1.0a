import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest

import sys
SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_conversion_service import (
    ConversionApiError,
    ConversionServiceConfig,
    DocumentConversionService,
    resolve_source_path,
)
from pdf_page_range import PageRange, PageRangeError
from document_conversion_api import ConversionHttpServer, ConversionRequestHandler


class StubService(DocumentConversionService):
    def _convert_pdf(self, source_bytes, request):
        return {
            "markdown": "selected\n",
            "markdownSha256": "sha256:stub",
            "converterOptionsHash": "sha256:stub-options",
            "evidence": {"diagnostics": []},
            "diagnostics": [],
            "stats": {"bytes": len(source_bytes)},
        }

    def _convert_docx(self, source_bytes, request):
        return {
            "markdown": "docx\n",
            "markdownSha256": "sha256:stub",
            "converterOptionsHash": "sha256:stub-options",
            "evidence": {"diagnostics": []},
            "diagnostics": [],
            "stats": {"bytes": len(source_bytes)},
        }


class DocumentConversionApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.pdf = self.root / "sample.pdf"
        self.pdf.write_bytes(b"%PDF-stub")
        self.docx = self.root / "sample.docx"
        self.docx.write_bytes(b"PK-stub")
        self.config = ConversionServiceConfig((self.root,), max_source_bytes=1024, max_range_pages=10)
        self.service = StubService(self.config)

    def tearDown(self):
        self.tmp.cleanup()

    def test_page_range_is_one_based_inclusive(self):
        value = PageRange(50, 55)
        self.assertEqual(value.count, 6)
        self.assertEqual(list(value.numbers), [50, 51, 52, 53, 54, 55])

    def test_invalid_and_out_of_bounds_ranges_fail_closed(self):
        with self.assertRaises(PageRangeError):
            PageRange(0, 1)
        with self.assertRaises(PageRangeError):
            PageRange(5, 4)
        with self.assertRaises(PageRangeError):
            PageRange(50, 55).validate_total(54)

    def test_pdf_request_preserves_requested_range_in_identity(self):
        result = self.service.convert({
            "sourcePath": str(self.pdf),
            "pages": {"start": 50, "end": 55},
            "options": {"images": "skip"},
        })
        self.assertEqual(result["pageRange"], {"start": 50, "end": 55, "count": 6})
        self.assertEqual(result["source"]["type"], "pdf")
        self.assertTrue(result["requestHash"].startswith("sha256:"))

    def test_request_hash_changes_when_only_page_range_changes(self):
        first = self.service.convert({"sourcePath": str(self.pdf), "pages": {"start": 1, "end": 2}})
        second = self.service.convert({"sourcePath": str(self.pdf), "pages": {"start": 2, "end": 3}})
        self.assertNotEqual(first["requestHash"], second["requestHash"])

    def test_page_range_limit_is_enforced_before_conversion(self):
        with self.assertRaises(ConversionApiError) as ctx:
            self.service.convert({"sourcePath": str(self.pdf), "pages": {"start": 1, "end": 11}})
        self.assertEqual(ctx.exception.code, "PDF_PAGE_RANGE_LIMIT_EXCEEDED")

    def test_docx_rejects_pdf_page_range(self):
        with self.assertRaises(ConversionApiError) as ctx:
            DocumentConversionService._convert_docx(self.service, b"PK", {
                "pageRange": PageRange(1, 2),
                "options": {
                    "headers": "metadata", "footers": "metadata", "tableMode": "auto",
                    "ocr": "auto", "ocrLanguage": "eng", "images": "skip",
                    "engineeringRegions": "auto", "revisions": "accepted",
                },
                "password": None,
            })
        self.assertEqual(ctx.exception.code, "DOCX_PAGE_RANGE_UNSUPPORTED")

    def test_source_must_resolve_under_allowed_root(self):
        outside = Path(tempfile.gettempdir()) / "outside-conversion-test.pdf"
        outside.write_bytes(b"x")
        try:
            with self.assertRaises(ConversionApiError) as ctx:
                resolve_source_path(str(outside), (self.root,))
            self.assertEqual(ctx.exception.code, "API_SOURCE_OUTSIDE_ALLOWED_ROOT")
        finally:
            outside.unlink(missing_ok=True)

    def test_symlink_escape_is_rejected(self):
        outside_dir = Path(tempfile.mkdtemp()).resolve()
        outside = outside_dir / "source.pdf"
        outside.write_bytes(b"x")
        link = self.root / "escape.pdf"
        try:
            os.symlink(outside, link)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable")
        try:
            with self.assertRaises(ConversionApiError) as ctx:
                resolve_source_path(str(link), (self.root,))
            self.assertEqual(ctx.exception.code, "API_SOURCE_OUTSIDE_ALLOWED_ROOT")
        finally:
            link.unlink(missing_ok=True)
            outside.unlink(missing_ok=True)
            outside_dir.rmdir()

    def test_remote_urls_are_never_fetched(self):
        with self.assertRaises(ConversionApiError) as ctx:
            resolve_source_path("https://example.invalid/source.pdf", (self.root,))
        self.assertEqual(ctx.exception.code, "API_REMOTE_SOURCE_FORBIDDEN")

    def test_unknown_options_and_asset_transport_fail_closed(self):
        with self.assertRaises(ConversionApiError) as ctx:
            self.service.convert({"sourcePath": str(self.pdf), "options": {"typoMode": "x"}})
        self.assertEqual(ctx.exception.code, "API_OPTION_UNKNOWN")
        with self.assertRaises(ConversionApiError) as ctx:
            self.service.convert({"sourcePath": str(self.pdf), "options": {"images": "extract"}})
        self.assertEqual(ctx.exception.code, "API_ASSET_TRANSPORT_NOT_IMPLEMENTED")


class HttpApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.pdf = self.root / "sample.pdf"
        self.pdf.write_bytes(b"%PDF-stub")
        service = StubService(ConversionServiceConfig((self.root,), max_source_bytes=1024, max_range_pages=10))
        self.server = ConversionHttpServer(
            ("127.0.0.1", 0), ConversionRequestHandler, service=service,
            max_request_bytes=4096, max_concurrency=1,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.tmp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, json.loads(data.decode("utf-8"))

    def test_health_and_capabilities(self):
        status, payload = self.request("GET", "/healthz")
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "ok")
        status, payload = self.request("GET", "/v1/capabilities")
        self.assertEqual(status, 200)
        self.assertTrue(payload["pdfPageRange"]["supported"])

    def test_http_conversion_example(self):
        body = json.dumps({
            "sourcePath": str(self.pdf),
            "pages": {"start": 50, "end": 55},
            "options": {"images": "skip"},
        })
        status, payload = self.request(
            "POST", "/v1/convert", body=body,
            headers={"Content-Type": "application/json", "Content-Length": str(len(body.encode("utf-8")))},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["pageRange"]["start"], 50)
        self.assertEqual(payload["markdown"], "selected\n")

    def test_http_rejects_non_json_body(self):
        status, payload = self.request(
            "POST", "/v1/convert", body="x",
            headers={"Content-Type": "text/plain", "Content-Length": "1"},
        )
        self.assertEqual(status, 415)
        self.assertEqual(payload["error"]["code"], "API_CONTENT_TYPE_REQUIRED")


if __name__ == "__main__":
    unittest.main()
