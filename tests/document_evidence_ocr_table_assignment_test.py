import unittest
from types import SimpleNamespace

from document_evidence_ocr_table_assignment import assign_ocr_words_to_cells


def cell(cell_id, row, column, x0, top, x1, bottom):
    return {
        "cellId": cell_id,
        "rowIndex": row,
        "columnIndex": column,
        "geometry": {"type": "Quad", "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]]},
    }


def word(text, bbox):
    return SimpleNamespace(text=text, bbox=bbox)


class OcrTableAssignmentTest(unittest.TestCase):
    def test_assignment_uses_geometry_not_input_order(self):
        table_pass = {"cells": [cell("left", 0, 0, 0, 0, 50, 20), cell("right", 0, 1, 50, 0, 100, 20)]}
        words = (word("RIGHT", (70, 2, 90, 18)), word("LEFT", (10, 2, 30, 18)))
        result = assign_ocr_words_to_cells(table_pass, words)
        by_column = {item["columnIndex"]: item["wordIndexes"] for item in result["cells"]}
        self.assertEqual(by_column, {0: [1], 1: [0]})
        self.assertEqual(result["diagnostics"], [])

    def test_ambiguous_shared_boundary_is_retained_not_guessed(self):
        table_pass = {"cells": [cell("left", 0, 0, 0, 0, 50, 20), cell("right", 0, 1, 50, 0, 100, 20)]}
        result = assign_ocr_words_to_cells(table_pass, (word("X", (49, 5, 51, 15)),))
        self.assertEqual(result["cells"], [])
        self.assertEqual(result["diagnostics"][0]["code"], "OCR_TABLE_WORD_AMBIGUOUS")
        self.assertEqual(result["diagnostics"][0]["matchingCellIds"], ["left", "right"])


if __name__ == "__main__":
    unittest.main()
