import unittest
from document_evidence_observation import make_observation
from document_evidence_surface import canonical_pdf_page_surface
from document_evidence_table import TableEvidenceError, make_table_pass, reconcile_table_passes

SOURCE = "sha256:" + "c" * 64
GEO = {"type": "Quad", "coordinates": [[1, 1], [9, 1], [9, 4], [1, 4]]}
SURFACE = canonical_pdf_page_surface(SOURCE, 3, 100, 100)


def obs(text, provider):
    return make_observation("ocr", SOURCE, SURFACE, provider, "1", text, GEO, provider_confidence_raw=0.9)


def cell(row, column, observation):
    return {"rowIndex": row, "columnIndex": column, "geometry": GEO, "observations": [observation]}


class TableEvidenceTest(unittest.TestCase):
    def test_duplicate_cell_fails_closed(self):
        first = obs("10", "A")
        with self.assertRaises(TableEvidenceError) as caught:
            make_table_pass("table-1", "A", SURFACE, [cell(0, 0, first), cell(0, 0, first)])
        self.assertEqual(caught.exception.code, "TABLE_CELL_DUPLICATE")

    def test_cross_pass_numeric_conflict_after_exact_cell_alignment(self):
        one, two = obs("10.0", "A"), obs("100", "B")
        first = make_table_pass("table-1", "A", SURFACE, [cell(0, 0, one)])
        second = make_table_pass("table-1", "B", SURFACE, [cell(0, 0, two)])
        decisions = reconcile_table_passes([first, second], {one["observationHash"]: one, two["observationHash"]: two})
        self.assertEqual(decisions[0]["diagnosticCodes"], ["OCR_NUMERIC_DISAGREEMENT"])

    def test_missing_required_pass_cell_does_not_shift_neighbor(self):
        left, right = obs("10", "A"), obs("20", "B")
        first = make_table_pass("table-1", "A", SURFACE, [cell(0, 0, left)])
        second = make_table_pass("table-1", "B", SURFACE, [cell(0, 1, right)])
        index = {left["observationHash"]: left, right["observationHash"]: right}
        decisions = reconcile_table_passes([first, second], index, required_pass_ids=("A", "B"))
        self.assertEqual([item["state"] for item in decisions], ["review_required", "review_required"])
        self.assertTrue(all("TABLE_CELL_PASS_MISSING" in item["diagnosticCodes"] for item in decisions))


if __name__ == "__main__":
    unittest.main()
