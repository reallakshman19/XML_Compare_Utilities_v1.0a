import hashlib
import http.client
from io import BytesIO
import json
from pathlib import Path
import tempfile
import threading
import unittest
import zipfile

from document_conversion_api import ConversionHttpServer, ConversionRequestHandler
from document_conversion_service import ConversionServiceConfig, DocumentConversionService


class PdfChartHttpTest(unittest.TestCase):
    def setUp(self):
        try:
            import pdfplumber  # noqa: F401
            import pypdfium2  # noqa: F401
            from reportlab.pdfgen import canvas
        except ImportError:
            self.skipTest("optional PDF chart integration dependencies are unavailable")
        stream = BytesIO()
        pdf = canvas.Canvas(stream, pagesize=(100, 100))
        pdf.line(10, 10, 90, 90)
        pdf.rect(20, 20, 30, 20, stroke=1, fill=0)
        path = pdf.beginPath()
        path.moveTo(10, 70)
        path.curveTo(30, 90, 60, 30, 90, 70)
        pdf.drawPath(path, stroke=1, fill=0)
        pdf.showPage()
        pdf.save()
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.source = self.root / "chart.pdf"
        self.source_bytes = stream.getvalue()
        self.source.write_bytes(self.source_bytes)
        service = DocumentConversionService(ConversionServiceConfig((self.root,)))
        self.server = ConversionHttpServer(
            ("127.0.0.1", 0), ConversionRequestHandler, service=service,
            max_request_bytes=65536, max_concurrency=1, ui_root=self.root,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        if hasattr(self, "server"):
            self.server.shutdown()
            self.server.server_close()
            self.thread.join(timeout=2)
        if hasattr(self, "tmp"):
            self.tmp.cleanup()

    def _request(self, method, path, payload=None):
        body = None if payload is None else json.dumps(payload)
        headers = {}
        if body is not None:
            headers = {"Content-Type": "application/json", "Content-Length": str(len(body.encode()))}
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result = (response.status, response.getheader("Content-Type"), response.read())
        connection.close()
        return result

    def test_chart_routes_and_error_contract(self):
        status, _, data = self._request("GET", "/v1/capabilities")
        capabilities = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(capabilities["pdfPageRender"]["transport"], "deterministic-zip")
        request = {"sourcePath": str(self.source), "pages": [1], "options": {"scale": 1}}
        status, content_type, data = self._request("POST", "/v1/render-pages", request)
        self.assertEqual((status, content_type), (200, "application/zip"))
        with zipfile.ZipFile(BytesIO(data)) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(manifest["pages"][0]["sourcePage"], 1)
        status, _, data = self._request(
            "POST", "/v1/inspect-vectors", {"sourcePath": str(self.source), "pages": [1]},
        )
        vector = json.loads(data)
        page = vector["pages"][0]
        self.assertEqual(page["counts"], {"line": 1, "rect": 1, "curve": 1})
        curve = next(item for item in page["primitives"] if item["kind"] == "curve")
        cubic = next(command for command in curve["path"] if command["op"] == "c")
        self.assertEqual(cubic["points"][0], [30.0, 10.0])
        evidence_cubic = next(
            segment for segment in curve["geometry"]["segments"] if segment["op"] == "C"
        )
        self.assertEqual(evidence_cubic["c1"], [30.0, 10.0])
        self.assertEqual(vector["interpretation"]["curveDigitization"], "NOT_PERFORMED")
        status, _, data = self._request(
            "POST", "/v1/render-pages", {"sourcePath": str(self.source), "pages": [2]},
        )
        error = json.loads(data)["error"]
        self.assertEqual((status, error["code"]), (422, "PDF_CHART_PAGE_OUT_OF_RANGE"))

    def test_governed_table_routes_use_exact_source_hash_and_pages(self):
        status, _, data = self._request("GET", "/v1/capabilities")
        capabilities = json.loads(data)["documentEvidenceTables"]
        self.assertEqual(capabilities["extractionEndpoint"], "/v2/tables/extract")
        status, _, data = self._request(
            "POST", "/v2/tables/discover", {"sourcePath": str(self.source)},
        )
        discovery = json.loads(data)
        self.assertEqual((status, discovery["schema"]), (200, "DocumentEvidenceTableDiscovery.v1"))
        self.assertNotIn("tables", discovery)
        source_hash = f"sha256:{hashlib.sha256(self.source_bytes).hexdigest()}"
        status, _, data = self._request(
            "POST", "/v2/tables/extract",
            {"sourcePath": str(self.source), "sourceHash": source_hash, "pages": [1]},
        )
        extraction = json.loads(data)
        self.assertEqual((status, extraction["pages"]), (200, [1]))
        self.assertEqual(extraction["sourceHash"], source_hash)
        status, _, data = self._request(
            "POST", "/v2/tables/extract",
            {"sourcePath": str(self.source), "sourceHash": "sha256:" + "0" * 64, "pages": [1]},
        )
        error = json.loads(data)["error"]
        self.assertEqual((status, error["code"]), (422, "EVIDENCE_SOURCE_HASH_MISMATCH"))


if __name__ == "__main__":
    unittest.main()
