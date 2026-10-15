import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pdf_tables import (
    PdfTableCandidate, PdfTableSourceRow, candidate_to_table, line_inside_table,
    reconcile_page_tables,
)


def row(cells, texts):
    return PdfTableSourceRow(tuple(cells), tuple(texts))


class PdfTablesTest(unittest.TestCase):
    def test_same_shape_overlap_prefers_ruled_candidate(self):
        ruled = PdfTableCandidate(
            1, "ruled", (10, 10, 210, 110),
            (row(((10, 10, 110, 60), (110, 10, 210, 60)), ("A", "B")),
             row(((10, 60, 110, 110), (110, 60, 210, 110)), ("1", "2"))),
            0.95, ("ruled",),
        )
        text = PdfTableCandidate(1, "text", (10, 10, 210, 110), ruled.rows, 0.86, ("text",))
        result = reconcile_page_tables((text, ruled))
        self.assertEqual(len(result.accepted), 1)
        self.assertEqual(result.accepted[0].strategy, "ruled")
        self.assertGreater(result.accepted[0].confidence, ruled.confidence)

    def test_overlapping_shape_disagreement_fails_closed(self):
        two_by_two = PdfTableCandidate(
            1, "ruled", (10, 10, 210, 110),
            (row(((10, 10, 110, 60), (110, 10, 210, 60)), ("A", "B")),
             row(((10, 60, 110, 110), (110, 60, 210, 110)), ("1", "2"))), 0.95, (),
        )
        three_by_two = PdfTableCandidate(
            1, "text", (10, 10, 210, 110),
            (row(((10, 10, 110, 43), (110, 10, 210, 43)), ("A", "B")),
             row(((10, 43, 110, 76), (110, 43, 210, 76)), ("1", "2")),
             row(((10, 76, 110, 110), (110, 76, 210, 110)), ("3", "4"))), 0.9, (),
        )
        result = reconcile_page_tables((two_by_two, three_by_two))
        self.assertEqual(result.accepted, ())
        self.assertIn("PDF_TABLE_AMBIGUOUS", [item["code"] for item in result.diagnostics])

    def test_low_confidence_candidate_cannot_veto_high_confidence_overlap(self):
        ruled = PdfTableCandidate(
            1, "ruled", (10, 10, 210, 110),
            (row(((10, 10, 110, 60), (110, 10, 210, 60)), ("A", "B")),
             row(((10, 60, 110, 110), (110, 60, 210, 110)), ("1", "2"))), 0.95, (),
        )
        noisy = PdfTableCandidate(
            1, "text", (10, 10, 210, 110),
            (row(((10, 10, 80, 43), (80, 10, 150, 43), (150, 10, 210, 43)), ("x", "y", "z")),
             row(((10, 43, 80, 76), (80, 43, 150, 76), (150, 43, 210, 76)), ("1", "2", "3")),
             row(((10, 76, 80, 110), (80, 76, 150, 110), (150, 76, 210, 110)), ("4", "5", "6"))),
            0.40, ("word-dense false positive",),
        )
        result = reconcile_page_tables((noisy, ruled))
        self.assertEqual(len(result.accepted), 1)
        self.assertEqual(result.accepted[0].strategy, "ruled")
        self.assertIn("PDF_TABLE_LOW_CONFIDENCE", [item["code"] for item in result.diagnostics])

    def test_ruled_geometry_can_preserve_colspan(self):
        candidate = PdfTableCandidate(
            1, "ruled", (10, 10, 210, 110),
            (row(((10, 10, 210, 60), None), ("Merged", "")),
             row(((10, 60, 110, 110), (110, 60, 210, 110)), ("L", "R"))), 0.95, (),
        )
        table, diagnostics = candidate_to_table(candidate, 0)
        self.assertEqual(diagnostics, ())
        self.assertEqual(table.grid_width, 2)
        self.assertEqual(table.rows[0].cells[0].column_span, 2)
        self.assertEqual(table.rows[0].cells[0].row_span, 1)
        self.assertEqual([cell.column_index for cell in table.rows[1].cells], [0, 1])

    def test_text_strategy_uses_source_row_ordinal_not_whitespace_gap(self):
        candidate = PdfTableCandidate(
            1, "text", (10, 10, 210, 100),
            (row(((10, 10, 110, 20), (110, 10, 210, 20)), ("A", "B")),
             row(((10, 50, 110, 60), (110, 50, 210, 60)), ("C", "D")),
             row(((10, 90, 110, 100), (110, 90, 210, 100)), ("E", "F"))), 0.88, (),
        )
        table, diagnostics = candidate_to_table(candidate, 0)
        self.assertEqual(diagnostics, ())
        self.assertEqual(len(table.rows), 3)
        self.assertTrue(all(cell.row_span == 1 for value in table.rows for cell in value.cells))
        self.assertEqual(
            [[block.text for cell in value.cells for block in cell.blocks] for value in table.rows],
            [["A", "B"], ["C", "D"], ["E", "F"]],
        )

    def test_missing_text_cell_is_explicit_omission(self):
        candidate = PdfTableCandidate(
            1, "text", (10, 10, 210, 60),
            (row(((10, 10, 110, 20), None), ("A", "")),
             row(((10, 50, 110, 60), (110, 50, 210, 60)), ("C", "D"))), 0.88, (),
        )
        table, _ = candidate_to_table(candidate, 0)
        self.assertTrue(table.rows[0].cells[1].is_omitted)
        self.assertEqual(table.rows[0].cells[1].column_index, 1)

    def test_native_line_inside_accepted_table_is_suppressed(self):
        self.assertTrue(line_inside_table((20, 20, 100, 30), (10, 10, 210, 110)))
        self.assertFalse(line_inside_table((220, 20, 300, 30), (10, 10, 210, 110)))


if __name__ == "__main__":
    unittest.main()
