import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pdf_native import (
    NativeChar, NativeLine, PageSignals, classify_page, cluster_chars_into_lines,
    detect_running_content, group_lines_into_blocks, infer_heading_levels,
    native_text_quality, reconstruct_reading_order,
)


def char(text, x0, top, x1, bottom, size=10, font="Helvetica"):
    return NativeChar(text, (x0, top, x1, bottom), font, size)


def line(line_id, text, x0, top, x1, bottom, size=10, bold=False):
    font = "Helvetica-Bold" if bold else "Helvetica"
    chars = (char(text, x0, top, x1, bottom, size, font),)
    return NativeLine(line_id, text, (x0, top, x1, bottom), chars, (), size, font, bold, False)


class PdfNativeTest(unittest.TestCase):
    def test_superscript_stays_on_same_line(self):
        values = (
            char("m", 10, 20, 16, 30, 10),
            char("²", 16, 16, 20, 23, 7),
            char(" ", 20, 20, 23, 30, 10),
            char("x", 23, 20, 29, 30, 10),
        )
        lines = cluster_chars_into_lines(values, 1)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].text, "m² x")

    def test_large_horizontal_gutter_splits_same_baseline_into_columns(self):
        values = tuple(
            [char(value, 50 + index * 6, 100, 56 + index * 6, 110) for index, value in enumerate("Left")] +
            [char(value, 350 + index * 6, 100, 356 + index * 6, 110) for index, value in enumerate("Right")]
        )
        lines = cluster_chars_into_lines(values, 1)
        self.assertEqual([value.text for value in lines], ["Left", "Right"])

    def test_two_column_order_is_left_then_right(self):
        lines = tuple(
            [line(f"L{i}", f"Left {i}", 50, 100 + i * 20, 220, 112 + i * 20) for i in range(3)] +
            [line(f"R{i}", f"Right {i}", 360, 100 + i * 20, 540, 112 + i * 20) for i in range(3)]
        )
        result = reconstruct_reading_order(lines, 600, 800, 1)
        self.assertEqual(result.mode, "two-column")
        self.assertEqual([value.text for value in result.lines], [
            "Left 0", "Left 1", "Left 2", "Right 0", "Right 1", "Right 2",
        ])

    def test_full_width_heading_precedes_two_columns(self):
        values = [line("H", "Engineering Assessment", 40, 40, 560, 60, 18, True)]
        values += [line(f"L{i}", f"Left {i}", 50, 100 + i * 20, 220, 112 + i * 20) for i in range(3)]
        values += [line(f"R{i}", f"Right {i}", 360, 100 + i * 20, 540, 112 + i * 20) for i in range(3)]
        result = reconstruct_reading_order(tuple(values), 600, 800, 1)
        self.assertEqual(result.lines[0].text, "Engineering Assessment")
        self.assertEqual(result.mode, "two-column")

    def test_competing_column_clusters_fail_visible(self):
        values = tuple(
            [line(f"L{i}", f"Left {i}", 80, 100 + i * 20, 330, 112 + i * 20) for i in range(3)] +
            [line(f"R{i}", f"Right {i}", 300, 100 + i * 20, 540, 112 + i * 20) for i in range(3)]
        )
        result = reconstruct_reading_order(values, 600, 800, 2)
        self.assertEqual(result.mode, "ambiguous")
        self.assertEqual(result.diagnostics[0]["code"], "PDF_READING_ORDER_AMBIGUOUS")

    def test_paragraph_grouping_does_not_cross_columns(self):
        values = (
            line("a", "first", 50, 100, 200, 112),
            line("b", "second", 50, 114, 200, 126),
            line("c", "other", 350, 100, 500, 112),
        )
        ordered = tuple([
            values[0].__class__(**{**values[0].__dict__, "region": "left:0"}),
            values[1].__class__(**{**values[1].__dict__, "region": "left:0"}),
            values[2].__class__(**{**values[2].__dict__, "region": "right:0"}),
        ])
        blocks = group_lines_into_blocks(ordered, 1)
        self.assertEqual([value.text for value in blocks], ["first second", "other"])

    def test_heading_inference_uses_size_plus_weight_not_largest_only_rule(self):
        ordered = (
            line("h", "1 System Design", 50, 40, 300, 60, 16, True),
            line("b1", "This is a normal body paragraph with enough characters.", 50, 80, 500, 92, 10),
            line("b2", "Another normal body paragraph with enough characters.", 50, 96, 500, 108, 10),
        )
        blocks = group_lines_into_blocks(tuple(
            value.__class__(**{**value.__dict__, "region": "single:0"}) for value in ordered
        ), 1)
        inferred = infer_heading_levels(blocks)
        self.assertEqual(inferred[0].heading_level, 1)
        self.assertIsNone(inferred[1].heading_level)

    def test_classification_distinguishes_born_digital_scanned_and_table_heavy(self):
        chars = tuple(char("A", i * 5, 10, i * 5 + 4, 20) for i in range(30))
        quality = native_text_quality(chars)
        born = classify_page(PageSignals(1, 600, 800, 30, 30, 0, 0, 0, 0, 0.0, 0.0), quality)
        self.assertEqual(born.page_type, "BORN_DIGITAL")
        scanned = classify_page(PageSignals(1, 600, 800, 0, 0, 0, 0, 0, 1, 0.9, 0.0), native_text_quality(()))
        self.assertEqual(scanned.page_type, "SCANNED")
        table = classify_page(PageSignals(1, 600, 800, 30, 30, 20, 5, 0, 0, 0.0, 0.0), quality)
        self.assertEqual(table.page_type, "TABLE_HEAVY")

    def test_exact_edge_repeat_is_running_metadata(self):
        pages = []
        for page in range(1, 4):
            lines = (
                line(f"h{page}", "Project Alpha", 50, 10, 200, 22),
                line(f"b{page}", f"Body {page}", 50, 100, 200, 112),
                line(f"f{page}", "Confidential", 50, 760, 180, 772),
            )
            pages.append((page, 800.0, lines))
        suppressed, metadata = detect_running_content(tuple(pages))
        self.assertEqual(len(suppressed), 6)
        self.assertEqual({item["kind"] for item in metadata}, {"header", "footer"})


if __name__ == "__main__":
    unittest.main()
