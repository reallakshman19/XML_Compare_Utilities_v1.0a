import unittest
from types import SimpleNamespace

from document_evidence_ocr_table_provider import (
    make_ocr_table_pass,
    reconcile_table_evidence_passes,
)
from document_evidence_table import TableEvidenceError

SOURCE = "sha256:" + "e" * 64
GEO = {"type": "Quad", "coordinates": [[10, 20], [30, 20], [30, 40], [10, 40]]}


def result(text, confidence, png=b"png"):
    raster = SimpleNamespace(
        page=1, png_bytes=png, page_width=100.0, page_height=100.0,
        raster_width=200, raster_height=200, scale=2.0,
    )
    word = SimpleNamespace(
        text=text, bbox=(10.0, 20.0, 30.0, 40.0), confidence=confidence,
        block_num=1, par_num=1, line_num=1, word_num=1,
    )
    return SimpleNamespace(
        raster=raster, words=(word,), engine_version="tesseract-5",
        rasterizer_version="pdfium-1",
    )


def cell():
    return {"rowIndex": 0, "columnIndex": 0, "geometry": GEO, "wordIndexes": [0]}


class OcrTableEvidenceTest(unittest.TestCase):
    def test_pass_id_prevents_equivalent_passes_from_collapsing(self):
        first = make_ocr_table_pass(SOURCE, result("10", 0.8), "table-1", [cell()], pass_id="ocr:A")
        second = make_ocr_table_pass(SOURCE, result("10", 0.8), "table-1", [cell()], pass_id="ocr:B")
        one = first["ocrEvidence"]["observations"][0]
        two = second["ocrEvidence"]["observations"][0]
        self.assertNotEqual(one["providerProfileHash"], two["providerProfileHash"])
        self.assertNotEqual(one["observationHash"], two["observationHash"])

    def test_numeric_disagreement_occurs_after_exact_cell_alignment(self):
        first = make_ocr_table_pass(SOURCE, result("10.0", 0.88, b"a"), "table-1", [cell()], pass_id="ocr:A")
        second = make_ocr_table_pass(SOURCE, result("100", 0.97, b"b"), "table-1", [cell()], pass_id="ocr:B")
        decision = reconcile_table_evidence_passes(
            [first, second], required_pass_ids=("ocr:A", "ocr:B"),
        )[0]
        self.assertEqual(decision["state"], "review_required")
        self.assertEqual(decision["diagnosticCodes"], ["OCR_NUMERIC_DISAGREEMENT"])
        self.assertNotIn("effectiveNumericValue", decision)

    def test_reconstruction_cannot_reference_missing_word(self):
        bad = {**cell(), "wordIndexes": [1]}
        with self.assertRaises(TableEvidenceError) as caught:
            make_ocr_table_pass(SOURCE, result("10", 0.8), "table-1", [bad], pass_id="ocr:A")
        self.assertEqual(caught.exception.code, "OCR_TABLE_WORD_INDEX_INVALID")


if __name__ == "__main__":
    unittest.main()
