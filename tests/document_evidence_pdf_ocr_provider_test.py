import unittest
from types import SimpleNamespace

from document_evidence_observation import ObservationError, make_observation
from document_evidence_pdf_ocr_provider import adapt_ocr_page
from document_evidence_surface import canonical_pdf_page_surface

SOURCE = "sha256:" + "d" * 64


def ocr_result():
    raster = SimpleNamespace(
        page=2, png_bytes=b"png", page_width=100.0, page_height=200.0,
        raster_width=200, raster_height=400, scale=2.0,
    )
    word = SimpleNamespace(
        text="10.0", bbox=(10.0, 20.0, 30.0, 40.0), confidence=0.97,
        block_num=1, par_num=2, line_num=3, word_num=4,
    )
    return SimpleNamespace(
        raster=raster, words=(word,), engine_version="tesseract 5.x",
        rasterizer_version="pdfium-x",
    )


class PdfOcrEvidenceAdapterTest(unittest.TestCase):
    def test_provider_geometry_requires_named_surface(self):
        page = canonical_pdf_page_surface(SOURCE, 1, 100, 100)
        with self.assertRaises(ObservationError) as caught:
            make_observation(
                "ocr", SOURCE, page, "provider", "1", "x",
                {"type": "Point", "coordinates": [1, 1]},
                provider_geometry={"type": "Point", "coordinates": [2, 2]},
            )
        self.assertEqual(caught.exception.code, "OBSERVATION_PROVIDER_SURFACE_REQUIRED")

    def test_adapts_existing_ocr_result_with_surface_lineage(self):
        evidence = adapt_ocr_page(SOURCE, ocr_result(), language="eng")
        observation = evidence["observations"][0]
        self.assertEqual(observation["providerConfidenceRaw"], 0.97)
        self.assertEqual(observation["providerSurfaceId"], evidence["rasterSurface"]["surfaceId"])
        self.assertEqual(observation["providerGeometry"]["coordinates"][0], [20.0, 40.0])
        self.assertEqual(observation["documentGeometry"]["coordinates"][0], [10.0, 20.0])
        self.assertEqual(observation["preprocessingTransformHashes"], [evidence["renderTransform"]["transformHash"]])
        self.assertEqual(observation["extensions"]["confidenceScale"], "legacy-normalized-0-1")

    def test_adapter_does_not_claim_raw_tesseract_confidence(self):
        observation = adapt_ocr_page(SOURCE, ocr_result())["observations"][0]
        self.assertEqual(observation["provider"], "xml-compare-pdf-ocr-v1")
        self.assertEqual(observation["extensions"]["upstreamEngine"], "tesseract-cli")


if __name__ == "__main__":
    unittest.main()
