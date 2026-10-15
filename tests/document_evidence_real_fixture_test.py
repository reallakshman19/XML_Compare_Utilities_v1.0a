import hashlib
import importlib.util
import json
import sys
import unittest
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_evidence_controlled_fixtures import controlled_docx_bytes, controlled_pdf_bytes

PDF_STACK = importlib.util.find_spec("pdfplumber") is not None and importlib.util.find_spec("pypdfium2") is not None


class RealControlledFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.truth = json.loads((ROOT / "contracts" / "document-evidence" / "v1" / "conformance" / "controlled-real-fixture-v1.json").read_text(encoding="utf-8"))["predeclaredAcceptance"]

    def test_fixture_bytes_are_deterministic_and_match_predeclared_hashes(self):
        cases = ((controlled_pdf_bytes, self.truth["pdfBytesSha256"]), (controlled_docx_bytes, self.truth["docxBytesSha256"]))
        for builder, expected in cases:
            first, second = builder(), builder()
            self.assertEqual(first, second)
            self.assertEqual(f"sha256:{hashlib.sha256(first).hexdigest()}", expected)

    def test_real_docx_package_semantics_relationships_and_revisions(self):
        from document_evidence_docx_semantic import semantic_docx_content
        from docx_ooxml_parser import parse_docx_package
        from docx_revision_semantics import prepare_package_for_revisions
        from ooxml_package import DOC_PART, OoxmlPackage

        data = controlled_docx_bytes()
        self.assertEqual(semantic_docx_content(data)["semanticContentHash"], self.truth["docxSemanticContentHash"])
        package = OoxmlPackage.from_bytes(data)
        self.assertTrue(set(self.truth["docxRequiredParts"]).issubset(package.parts))
        hyperlink = package.relationship(DOC_PART, "rId2")
        self.assertTrue(hyperlink.is_external)
        self.assertEqual(hyperlink.target, self.truth["externalHyperlink"])
        image = package.relationship(DOC_PART, "rId3")
        self.assertEqual(image.resolved_part, self.truth["imagePart"])
        document_xml = package.require_part(DOC_PART)
        for token in ("Controlled Evidence Fixture", "T3-1 = 10.0 MPa", "Inserted"):
            self.assertIn(token.encode("utf-8"), document_xml)
        _, revision_events, _ = prepare_package_for_revisions(package, "markup")
        revision_types = {item["revisionType"] for item in revision_events}
        self.assertEqual(revision_types, {"ins", "del"})
        deleted = next(item for item in revision_events if item["revisionType"] == "del")
        inserted = next(item for item in revision_events if item["revisionType"] == "ins")
        self.assertEqual((inserted["revisionId"], deleted["revisionId"]), ("7", "8"))
        self.assertIn(b"Deleted", document_xml)
        _, stats = parse_docx_package(package)
        self.assertEqual(stats["tables"], 1)
        self.assertGreaterEqual(stats["paragraphs"], 3)

    @unittest.skipUnless(PDF_STACK, "requires pinned requirements-pdf.txt dependencies")
    def test_real_pdf_native_render_and_geometry_paths(self):
        import pdfplumber
        from document_evidence_geometry import normalize_pdfplumber_primitive
        from pdf_native import PdfPlumberBackend
        from pdf_ocr import PdfiumRasterizer

        data = controlled_pdf_bytes()
        result = PdfPlumberBackend().extract(data)
        self.assertEqual(len(result.pages), 1)
        native = "".join(item.text for item in result.pages[0].chars).replace(" ", "")
        for token in self.truth["pdfNativeTextMustContain"]:
            self.assertIn(token.replace(" ", ""), native)
        raster = PdfiumRasterizer().render_page(data, 1, requested_scale=self.truth["pdfRenderScale"], max_pixels=1_000_000, max_memory_bytes=16 * 1024 * 1024)
        self.assertEqual([raster.raster_width, raster.raster_height], self.truth["expectedRaster"])
        with pdfplumber.open(BytesIO(data)) as document:
            curve = dict(document.pages[0].curves[0])
        geometry = normalize_pdfplumber_primitive(self.truth["pdfBytesSha256"], 1, 0, "curve", curve)
        cubic = next(item for item in geometry["geometry"]["segments"] if item["op"] == "C")
        self.assertEqual(cubic["c1"], self.truth["expectedCubic"]["c1"])
        self.assertEqual(cubic["c2"], self.truth["expectedCubic"]["c2"])
        self.assertEqual(cubic["to"], self.truth["expectedCubic"]["to"])


if __name__ == "__main__":
    unittest.main()
