import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import ParagraphBlock, SourceRef, TableBlock, TableCell, TableRow
from table_rendering import choose_table_renderer, render_table_by_policy


def ref(row=0, cell=0):
    return SourceRef("docx", "word/document.xml", table_index=0, row_index=row, cell_index=cell)


def paragraph(text, row=0, cell=0):
    return ParagraphBlock(f"p-{row}-{cell}-{text}", text, ref(row, cell))


def cell(text, row, column, *, column_span=1, row_span=1, omitted=False, nested=None):
    blocks = (nested,) if nested is not None else ((paragraph(text, row, column),) if text is not None else ())
    return TableCell(blocks, ref(row, column), column_span, row_span, row, column, omitted)


def table(rows, width):
    return TableBlock("t0", tuple(TableRow(tuple(row)) for row in rows), ref(), grid_width=width)


def cell_text(value):
    return " ".join(getattr(block, "text", "[nested]") for block in value.blocks)


def html_renderer(value):
    return f"<table data-width=\"{value.grid_width}\"></table>"


class TableRenderingTest(unittest.TestCase):
    def test_auto_simple_uses_markdown_without_header_inference(self):
        value = table([[cell("A", 0, 0), cell("B", 0, 1)]], 2)
        rendered, decision = render_table_by_policy(
            value, "auto", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.classification, "SIMPLE")
        self.assertEqual(decision.renderer, "markdown")
        self.assertEqual(
            rendered,
            "| Column 1 | Column 2 |\n| --- | --- |\n| A | B |",
        )

    def test_zero_column_table_uses_html(self):
        rendered, decision = render_table_by_policy(
            table([], 0), "auto", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.renderer, "html")
        self.assertEqual(decision.classification, "COMPLEX_MERGED")
        self.assertTrue(rendered.startswith("<table"))

    def test_auto_merged_uses_html(self):
        value = table([[cell("Merged", 0, 0, column_span=2)]], 2)
        rendered, decision = render_table_by_policy(
            value, "auto", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.classification, "COMPLEX_MERGED")
        self.assertEqual(decision.renderer, "html")
        self.assertTrue(rendered.startswith("<table"))

    def test_explicit_markdown_falls_back_for_merged_table(self):
        value = table([[cell("Merged", 0, 0, row_span=2)]], 1)
        _, decision = render_table_by_policy(
            value, "markdown", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.renderer, "html")
        self.assertEqual(decision.diagnostic["code"], "TABLE_RENDER_MODE_FALLBACK")

    def test_auto_wide_uses_records(self):
        row = [cell(str(index), 0, index) for index in range(8)]
        rendered, decision = render_table_by_policy(
            table([row], 8), "auto", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.classification, "WIDE_ENGINEERING")
        self.assertEqual(decision.renderer, "records")
        self.assertIn("**Row 1**", rendered)
        self.assertIn("- C8: 7", rendered)

    def test_records_preserve_span_coordinates_and_empty_marker(self):
        value = table([[cell("X", 0, 0, column_span=2, row_span=2), cell(None, 0, 2)]], 3)
        rendered, _ = render_table_by_policy(
            value, "records", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertIn("- C1-C2 (R1-R2): X", rendered)
        self.assertIn("- C3: ⟦EMPTY⟧", rendered)

    def test_omitted_cell_is_explicit_in_records(self):
        value = table([[cell(None, 0, 0, omitted=True), cell("B", 0, 1)]], 2)
        rendered, _ = render_table_by_policy(
            value, "records", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertIn("- C1: ⟦OMITTED⟧", rendered)

    def test_nested_records_request_falls_back_to_html(self):
        nested = table([[cell("N", 0, 0)]], 1)
        outer = table([[cell(None, 0, 0, nested=nested)]], 1)
        _, decision = render_table_by_policy(
            outer, "records", cell_text=cell_text, html_renderer=html_renderer,
        )
        self.assertEqual(decision.classification, "NESTED")
        self.assertEqual(decision.renderer, "html")
        self.assertIsNotNone(decision.diagnostic)


if __name__ == "__main__":
    unittest.main()
