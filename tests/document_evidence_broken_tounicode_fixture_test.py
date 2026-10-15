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

PDF_STACK = all(importlib.util.find_spec(name) is not None for name in ("pdfplumber", "pypdfium2"))
TESSERACT = shutil.which("tesseract") is not None


@unittest.skipUnless(PDF_STACK, "requires pinned requirements-pdf.txt dependencies")
class BrokenToUnicodeRealFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.truth = json.loads((ROOT / "contracts" / "document-evidence" / "v1" / "conformance" / "broken-tounicode-real-fixture-v1.json").read_text(encoding="utf-8"))["predeclaredAcceptance"]

    def test_real_native_mapping_contains_replacement_and_quality_degrades(self):
        from document_evidence_broken_tounicode_fixture import broken_tounicode_pdf_bytes
        from pdf_native import PdfPlumberBackend, native_text_quality

        data = broken_tounicode_pdf_bytes()
        self.assertEqual(f"sha256:{hashlib.sha256(data).hexdigest()}", self.truth["pdfBytesSha256"])
        page = PdfPlumberBackend().extract(data).pages[0]
        native_text = "".join(item.text for item in page.chars)
        self.assertEqual(native_text, self.truth["nativeExtractedText"])
        self.assertEqual(native_text.count("\ufffd"), self.truth["replacementCharacterCount"])
        quality = native_text_quality(page.chars)
        self.assertFalse(quality.adequate)
        self.assertGreater(quality.replacement_ratio, 0.02)

    @unittest.skipUnless(TESSERACT, "requires deployed Tesseract CLI")
    def test_real_corrupt_native_mapping_loses_to_real_ocr(self):
        from document_evidence_broken_tounicode_fixture import broken_tounicode_pdf_bytes
        from document_evidence_decision import reconcile_cell
        from document_evidence_observation import make_observation
        from document_evidence_pdf_ocr_provider import adapt_ocr_page
        from document_evidence_surface import canonical_hash, canonical_pdf_page_surface
        from pdf_native import PdfPlumberBackend
        from pdf_ocr import PdfiumRasterizer, TesseractCliEngine

        data = broken_tounicode_pdf_bytes()
        native_page = PdfPlumberBackend().extract(data).pages[0]
        native_text = "".join(item.text for item in native_page.chars)
        x0 = min(item.bbox[0] for item in native_page.chars)
        top = min(item.bbox[1] for item in native_page.chars)
        x1 = max(item.bbox[2] for item in native_page.chars)
        bottom = max(item.bbox[3] for item in native_page.chars)
        geometry = {"type": "Quad", "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]]}
        surface = canonical_pdf_page_surface(self.truth["pdfBytesSha256"], 1, native_page.signals.width, native_page.signals.height)

        profile_identity = {
            "schema": "ProviderProfile.v1",
            "role": "native-text",
            "provider": "pdfplumber-controlled-fixture",
            "providerVersion": "1",
            "determinism": {"semantic": "profile-bound", "artifact": "not-claimed", "bitwiseRaster": "not-applicable"},
        }
        profile_hash = canonical_hash(profile_identity)
        profile = {**profile_identity, "profileId": f"profile:{profile_hash[7:31]}", "profileHash": profile_hash}
        quality_identity = {
            "schema": "NativeTextQuality.v1",
            "status": "mapping_corrupt",
            "assessmentProfileHash": profile_hash,
            "toUnicodeStatus": "corrupt",
            "replacementCharacterCount": self.truth["replacementCharacterCount"],
        }
        native_quality = {**quality_identity, "nativeQualityHash": canonical_hash(quality_identity)}
        native = make_observation(
            "native-text", self.truth["pdfBytesSha256"], surface,
            "pdfplumber-controlled-fixture", "1", native_text, geometry,
            native_quality=native_quality, provider_profile=profile,
        )

        raster = PdfiumRasterizer().render_page(
            data, 1, requested_scale=self.truth["renderScale"],
            max_pixels=1_000_000, max_memory_bytes=16 * 1024 * 1024,
        )
        self.assertEqual([raster.raster_width, raster.raster_height], self.truth["expectedRasterPixels"])
        result = TesseractCliEngine().recognize(raster, psm=self.truth["ocrPsm"])
        evidence = adapt_ocr_page(self.truth["pdfBytesSha256"], result)
        ocr = next(item for item in evidence["observations"] if item["text"] == self.truth["ocrExpectedText"])
        decision = reconcile_cell((native, ocr), logical_cell_id="broken-tounicode-real")
        self.assertEqual(decision["state"], self.truth["expectedDecisionState"])
        self.assertEqual(decision["effectiveText"], self.truth["expectedDecisionText"])
        self.assertEqual(decision["diagnosticCodes"], [self.truth["expectedDiagnostic"]])
        self.assertEqual(decision["selectedObservationHash"], ocr["observationHash"])


if __name__ == "__main__":
    unittest.main()
