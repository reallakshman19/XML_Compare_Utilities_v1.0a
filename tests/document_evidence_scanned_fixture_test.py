import hashlib
import importlib.util
import json
import shutil
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

PDF_STACK = all(importlib.util.find_spec(name) is not None for name in ("PIL", "pdfplumber", "pypdfium2"))
TESSERACT = shutil.which("tesseract") is not None


@unittest.skipUnless(PDF_STACK, "requires pinned requirements-pdf.txt dependencies")
class ScannedControlledFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.truth = json.loads((ROOT / "contracts" / "document-evidence" / "v1" / "conformance" / "scanned-real-fixture-v1.json").read_text(encoding="utf-8"))["predeclaredAcceptance"]

    def test_scanned_source_is_image_only_rotated_and_byte_stable(self):
        import PIL
        from document_evidence_scanned_fixture import scanned_pdf_bytes
        from pdf_native import PdfPlumberBackend

        self.assertEqual(PIL.__version__, "12.3.0")
        first, second = scanned_pdf_bytes(), scanned_pdf_bytes()
        self.assertEqual(first, second)
        self.assertEqual(f"sha256:{hashlib.sha256(first).hexdigest()}", self.truth["pdfBytesSha256"])
        page = PdfPlumberBackend().extract(first).pages[0]
        self.assertEqual(page.signals.char_count, self.truth["nativeCharacterCount"])
        self.assertEqual(page.signals.image_count, self.truth["imageCount"])
        self.assertIn(b"/CropBox [10 10 610 190] /Rotate 90", first)

    @unittest.skipUnless(TESSERACT, "requires deployed Tesseract CLI")
    def test_scanned_source_runs_real_render_ocr_deskew_and_conflict_lineage(self):
        from document_evidence_decision import reconcile_cell
        from document_evidence_observation import make_observation
        from document_evidence_pdf_ocr_provider import adapt_ocr_page
        from document_evidence_preprocessing import compose_pipeline, deskew_surface, roundtrip_error
        from document_evidence_scanned_fixture import scanned_pdf_bytes
        from pdf_ocr import PdfiumRasterizer, TesseractCliEngine

        data = scanned_pdf_bytes()
        raster = PdfiumRasterizer().render_page(data, 1, requested_scale=self.truth["renderScale"], max_pixels=2_000_000, max_memory_bytes=32 * 1024 * 1024)
        self.assertEqual([raster.page_width, raster.page_height], self.truth["expectedDisplayedPagePt"])
        self.assertEqual([raster.raster_width, raster.raster_height], self.truth["expectedRasterPixels"])
        result = TesseractCliEngine().recognize(raster, psm=self.truth["ocrPsm"])
        recognized = " ".join(word.text for word in result.words)
        for token in self.truth["ocrMustContain"]:
            self.assertIn(token, recognized)
        evidence = adapt_ocr_page(self.truth["pdfBytesSha256"], result)
        self.assertEqual(len(evidence["observations"]), len(result.words))
        deskewed, deskew = deskew_surface(evidence["rasterSurface"], self.truth["syntheticSkewDegrees"])
        self.assertEqual(deskewed["metadata"]["appliedDegrees"], -self.truth["syntheticSkewDegrees"])
        pipeline = compose_pipeline((evidence["renderTransform"], deskew))
        points = ((0, 0), (90, 300), (180, 600))
        self.assertLessEqual(roundtrip_error(pipeline, points), 1e-6)

        real_numeric = next(item for item in evidence["observations"] if item["text"] == "10.0")
        injected = make_observation(
            "ocr", self.truth["pdfBytesSha256"], evidence["pageSurface"],
            "qualification-fault-injection", "1", "100", real_numeric["documentGeometry"],
            provider_confidence_raw=0.99,
        )
        decision = reconcile_cell((real_numeric, injected), logical_cell_id="scanned-real-value")
        self.assertEqual(decision["state"], "review_required")
        self.assertEqual(decision["diagnosticCodes"], ["OCR_NUMERIC_DISAGREEMENT"])
        self.assertNotIn("selectedObservationHash", decision)


if __name__ == "__main__":
    unittest.main()
