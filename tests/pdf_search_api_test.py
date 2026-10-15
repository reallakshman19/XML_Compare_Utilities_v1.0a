import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_conversion_api import ConversionHttpServer, ConversionRequestHandler
from document_conversion_service import (
    ConversionApiError,
    ConversionServiceConfig,
    DocumentConversionService,
)
from pdf_native import NativeChar, PageExtraction, PageSignals, PdfBackendResult

try:
    import pdfplumber  # noqa: F401
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None


def _page(page: int, text: str) -> PageExtraction:
    chars = []
    x = 40.0
    for char in text:
        width = 3.0 if char.isspace() else 5.0
        chars.append(NativeChar(char, (x, 100.0, x + width, 110.0), "Helvetica", 10.0))
        x += width
    signals = PageSignals(
        page, 600.0, 800.0, len(chars), len(chars),
        0, 0, 0, 0, 0.0, 0.0,
    )
    return PageExtraction(signals, tuple(chars))


class FakeSearchBackend:
    def __init__(self):
        self.calls = 0
        self.passwords = []

    def extract(self, pdf_bytes, *, password=None, max_pages=2000):
        self.calls += 1
        self.passwords.append(password)
        pages = (
            _page(1, "Section T2.3 first with enough native text for reliable search indexing"),
            _page(2, "T2.30 then T2.3 and t2.3 with enough native text for reliable indexing"),
            _page(3, ""),
        )
        return PdfBackendResult(pages, {}, {"fake-search": "1"})


class FakeRaster:
    def __init__(self, page):
        self.page = page
        self.pixels = 1000


class FakeRasterizer:
    def __init__(self):
        self.pages = []

    def render_page(self, pdf_bytes, page, *, password=None):
        self.pages.append(page)
        return FakeRaster(page)


class FakeOcrLine:
    def __init__(self, text, confidence, bbox):
        self.text = text
        self.confidence = confidence
        self.bbox = bbox


class FakeOcrResult:
    def __init__(self, page):
        self.lines = (
            FakeOcrLine("Scanned section T2.3 OCR content", 0.93, (40.0, 100.0, 260.0, 112.0)),
        ) if page == 3 else ()
        self.engine_version = "fake-tesseract-1"
        self.rasterizer_version = "fake-pdfium-1"


class FakeOcrEngine:
    def __init__(self):
        self.pages = []

    def recognize(self, raster, *, language="eng", timeout_seconds=60.0):
        self.pages.append(raster.page)
        return FakeOcrResult(raster.page)


class PdfSearchServiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.pdf = self.root / "source.pdf"
        self.pdf.write_bytes(b"%PDF-search-fixture")
        self.docx = self.root / "source.docx"
        self.docx.write_bytes(b"PK-search-fixture")
        self.backend = FakeSearchBackend()
        self.rasterizer = FakeRasterizer()
        self.ocr_engine = FakeOcrEngine()
        self.index_dir = self.root / "search-index"
        self.config = ConversionServiceConfig(
            (self.root,),
            max_source_bytes=1024,
            max_search_index_chars=10000,
            max_search_results=20,
            max_search_cache_documents=2,
            search_index_dir=self.index_dir,
        )
        self.service = DocumentConversionService(
            self.config,
            search_backend=self.backend,
            search_rasterizer=self.rasterizer,
            search_ocr_engine=self.ocr_engine,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def test_auto_search_combines_native_and_ocr_hits(self):
        result = self.service.search({"sourcePath": str(self.pdf), "query": "T2.3"})
        self.assertEqual(result["summary"]["totalMatches"], 5)
        self.assertEqual(
            result["summary"]["pagesWithMatches"],
            [{"page": 1, "matches": 1}, {"page": 2, "matches": 3}, {"page": 3, "matches": 1}],
        )
        self.assertEqual(result["index"]["cacheSource"], "built")
        self.assertEqual(result["index"]["pagesWithoutNativeText"], [3])
        self.assertEqual(result["index"]["ocrIndexedPages"], [3])
        self.assertEqual(result["diagnostics"][0]["code"], "PDF_SEARCH_OCR_INDEX_USED")
        ocr_hit = next(hit for hit in result["matches"] if hit["page"] == 3)
        self.assertEqual(ocr_hit["extraction"], "ocr")
        self.assertEqual(ocr_hit["confidence"], 0.93)
        self.assertEqual(self.rasterizer.pages, [3])

    def test_case_whole_word_and_stable_hit_identity(self):
        whole = self.service.search({
            "sourcePath": str(self.pdf),
            "query": "T2.3",
            "options": {"wholeWord": True},
        })
        sensitive = self.service.search({
            "sourcePath": str(self.pdf),
            "query": "T2.3",
            "options": {"caseSensitive": True},
        })
        baseline = self.service.search({"sourcePath": str(self.pdf), "query": "T2.3"})
        self.assertEqual(whole["summary"]["totalMatches"], 4)
        self.assertEqual(sensitive["summary"]["totalMatches"], 4)
        first = next(hit for hit in baseline["matches"] if hit["page"] == 1)
        self.assertEqual(first["id"], next(hit for hit in whole["matches"] if hit["page"] == 1)["id"])

    def test_ocr_never_reports_unsearchable_page(self):
        result = self.service.search({
            "sourcePath": str(self.pdf),
            "query": "T2.3",
            "options": {"ocr": "never"},
        })
        self.assertEqual(result["summary"]["totalMatches"], 4)
        self.assertEqual(result["index"]["ocrIndexedPages"], [])
        self.assertEqual(result["index"]["pagesWithoutSearchableText"], [3])
        self.assertEqual(result["diagnostics"][0]["code"], "PDF_SEARCH_INDEX_INCOMPLETE")

    def test_persistent_index_reloads_without_reextracting_source(self):
        first = self.service.search({"sourcePath": str(self.pdf), "query": "T2.3"})
        self.assertEqual(first["index"]["cacheSource"], "built")
        self.assertEqual(len(list(self.index_dir.glob("*.json"))), 1)

        backend = FakeSearchBackend()
        service = DocumentConversionService(
            self.config,
            search_backend=backend,
            search_rasterizer=FakeRasterizer(),
            search_ocr_engine=FakeOcrEngine(),
        )
        second = service.search({"sourcePath": str(self.pdf), "query": "T2.3"})
        self.assertEqual(second["index"]["cacheSource"], "disk")
        self.assertEqual(backend.calls, 0)
        self.assertEqual(second["matches"], first["matches"])

    def test_password_and_ocr_policy_partition_cache_identity(self):
        self.service.search({"sourcePath": str(self.pdf), "query": "T2.3", "password": "alpha"})
        self.service.search({"sourcePath": str(self.pdf), "query": "T2.3", "password": "alpha"})
        self.service.search({"sourcePath": str(self.pdf), "query": "T2.3", "password": "beta"})
        self.service.search({
            "sourcePath": str(self.pdf),
            "query": "T2.3",
            "password": "beta",
            "options": {"ocr": "never"},
        })
        self.assertEqual(self.backend.passwords, ["alpha", "beta", "beta"])

    def test_invalid_queries_regex_and_result_limit_fail_closed(self):
        with self.assertRaises(ConversionApiError) as caught:
            self.service.search({"sourcePath": str(self.pdf), "query": ""})
        self.assertEqual(caught.exception.code, "PDF_SEARCH_QUERY_REQUIRED")
        self.assertEqual(self.backend.calls, 0)

        with self.assertRaises(ConversionApiError) as caught:
            self.service.search({
                "sourcePath": str(self.pdf),
                "query": "T2.3",
                "options": {"useRegex": True},
            })
        self.assertEqual(caught.exception.code, "PDF_SEARCH_REGEX_UNSUPPORTED")
        self.assertEqual(self.backend.calls, 0)

        limited = DocumentConversionService(
            ConversionServiceConfig(
                (self.root,),
                max_source_bytes=1024,
                max_search_index_chars=10000,
                max_search_results=2,
            ),
            search_backend=self.backend,
            search_rasterizer=self.rasterizer,
            search_ocr_engine=self.ocr_engine,
        )
        with self.assertRaises(ConversionApiError) as caught:
            limited.search({"sourcePath": str(self.pdf), "query": "T2.3", "options": {"ocr": "never"}})
        self.assertEqual(caught.exception.code, "PDF_SEARCH_RESULT_LIMIT_EXCEEDED")

    def test_search_is_pdf_only(self):
        with self.assertRaises(ConversionApiError) as caught:
            self.service.search({"sourcePath": str(self.docx), "query": "T2.3"})
        self.assertEqual(caught.exception.code, "PDF_SEARCH_SOURCE_REQUIRED")


class PdfSearchHttpTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.pdf = self.root / "source.pdf"
        self.pdf.write_bytes(b"%PDF-search-fixture")
        self.service = DocumentConversionService(
            ConversionServiceConfig((self.root,), max_source_bytes=1024),
            search_backend=FakeSearchBackend(),
            search_rasterizer=FakeRasterizer(),
            search_ocr_engine=FakeOcrEngine(),
        )
        self.server = ConversionHttpServer(
            ("127.0.0.1", 0),
            ConversionRequestHandler,
            service=self.service,
            max_request_bytes=4096,
            max_concurrency=1,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.tmp.cleanup()

    def _request(self, method, path, payload=None, *, json_response=True):
        body = None if payload is None else json.dumps(payload)
        headers = {}
        if body is not None:
            headers = {
                "Content-Type": "application/json",
                "Content-Length": str(len(body.encode("utf-8"))),
            }
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        raw = response.read()
        content_type = response.getheader("Content-Type")
        connection.close()
        data = json.loads(raw.decode("utf-8")) if json_response else raw.decode("utf-8")
        return response.status, content_type, data

    def test_http_search_capability_and_ui_contract(self):
        status, _, capabilities = self._request("GET", "/v1/capabilities")
        self.assertEqual(status, 200)
        self.assertTrue(capabilities["pdfSearch"]["supported"])
        self.assertEqual(capabilities["pdfSearch"]["ocr"], ["auto", "always", "never"])
        self.assertEqual(capabilities["ui"]["path"], "/document-conversion/")

        status, _, result = self._request("POST", "/v1/search", {
            "sourcePath": str(self.pdf),
            "query": "T2.3",
        })
        self.assertEqual(status, 200)
        self.assertEqual(result["schema"], "PdfSearchApi.v2")
        self.assertEqual(result["summary"]["totalMatches"], 5)

        status, content_type, html = self._request(
            "GET",
            "/document-conversion/",
            json_response=False,
        )
        self.assertEqual(status, 200)
        self.assertTrue(content_type.startswith("text/html"))
        self.assertIn("Document Search &amp; Markdown", html)
        self.assertIn('src="./app.js"', html)


@unittest.skipIf(canvas is None, "reportlab/pdfplumber unavailable")
class PdfSearchRealIntegrationTest(unittest.TestCase):
    def test_real_sixty_page_pdf_returns_original_pages_50_and_55(self):
        from io import BytesIO

        stream = BytesIO()
        pdf = canvas.Canvas(stream, pagesize=(600, 800))
        for page in range(1, 61):
            pdf.setFont("Helvetica", 10)
            text = f"Page {page} ordinary content with enough words for native text quality"
            if page in {50, 55}:
                text += " Section T2.3 controlled marker"
            pdf.drawString(50, 740, text)
            pdf.showPage()
        pdf.save()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            source = root / "sixty-pages.pdf"
            source.write_bytes(stream.getvalue())
            service = DocumentConversionService(ConversionServiceConfig((root,)))
            result = service.search({
                "sourcePath": str(source),
                "query": "T2.3",
                "options": {"ocr": "never"},
            })
        self.assertEqual(result["index"]["totalPages"], 60)
        self.assertEqual([item["page"] for item in result["matches"]], [50, 55])


if __name__ == "__main__":
    unittest.main()
