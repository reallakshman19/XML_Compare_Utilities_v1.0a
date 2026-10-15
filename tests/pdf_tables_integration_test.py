import sys
import unittest
from io import BytesIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import ParagraphBlock, TableBlock
from pdf_conversion import convert_pdf_bytes, parse_pdf_bytes

try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None


def ruled_pdf():
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(600, 800))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, 740, "Before table")
    x0, y0, cell_width, row_height = 50, 650, 120, 25
    for index in range(4):
        x = x0 + index * cell_width
        pdf.line(x, y0, x, y0 - 3 * row_height)
    for index in range(4):
        y = y0 - index * row_height
        pdf.line(x0, y, x0 + 3 * cell_width, y)
    for row_index, values in enumerate((("A", "B", "C"), ("1", "2", "3"), ("4", "5", "6"))):
        for column_index, value in enumerate(values):
            pdf.drawString(x0 + 5 + column_index * cell_width, y0 - 18 - row_index * row_height, value)
    pdf.drawString(50, 540, "After table")
    pdf.save()
    return output.getvalue()


def text_aligned_pdf():
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(600, 800))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, 740, "Before table")
    for row_index, values in enumerate((("H1", "H2", "H3"), ("A", "B", "C"), ("D", "E", "F"), ("G", "H", "I"))):
        y = 680 - row_index * 25
        for column_index, value in enumerate(values):
            pdf.drawString(60 + column_index * 140, y, value)
    pdf.drawString(50, 520, "After table")
    pdf.save()
    return output.getvalue()


def two_column_prose_pdf():
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(600, 800))
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(50, 740, "Engineering Assessment")
    pdf.setFont("Helvetica", 10)
    for index in range(3):
        pdf.drawString(50, 680 - index * 20, f"Left column line {index + 1} with value 3.15")
        pdf.drawString(350, 680 - index * 20, f"Right column line {index + 1} with OD 273 mm")
    pdf.save()
    return output.getvalue()


@unittest.skipIf(canvas is None, "reportlab unavailable")
class PdfTablesIntegrationTest(unittest.TestCase):
    def test_ruled_table_enters_shared_model_without_duplicate_body_text(self):
        document, stats = parse_pdf_bytes(ruled_pdf())
        tables = [block for block in document.blocks if isinstance(block, TableBlock)]
        paragraphs = [block.text for block in document.blocks if isinstance(block, ParagraphBlock)]
        self.assertEqual(stats["tables"], 1)
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0].provenance.extraction, "embedded-table-ruled")
        self.assertEqual(len(tables[0].rows), 3)
        self.assertEqual(tables[0].grid_width, 3)
        self.assertNotIn("A", paragraphs)
        self.assertEqual(paragraphs, ["Before table", "After table"])
        self.assertEqual(document.metadata["pages"][0]["classification"], "TABLE_HEAVY")
        markdown, _ = convert_pdf_bytes(ruled_pdf())
        text = markdown.decode()
        self.assertLess(text.index("Before table"), text.index("| Column 1"))
        self.assertLess(text.index("| Column 1"), text.index("After table"))
        self.assertEqual(text.count("| A | B | C |"), 1)

    def test_text_aligned_table_uses_source_rows_without_blank_gap_rows(self):
        document, stats = parse_pdf_bytes(text_aligned_pdf())
        tables = [block for block in document.blocks if isinstance(block, TableBlock)]
        self.assertEqual(stats["tables"], 1)
        self.assertEqual(tables[0].provenance.extraction, "embedded-table-text")
        self.assertEqual(len(tables[0].rows), 4)
        self.assertEqual(tables[0].grid_width, 3)
        self.assertTrue(all(cell.row_span == 1 for row in tables[0].rows for cell in row.cells))
        markdown, _ = convert_pdf_bytes(text_aligned_pdf())
        text = markdown.decode()
        self.assertIn("| H1 | H2 | H3 |", text)
        self.assertIn("| G | H | I |", text)
        self.assertEqual(text.count("| H1 | H2 | H3 |"), 1)

    def test_two_column_prose_is_not_promoted_to_whitespace_table(self):
        document, stats = parse_pdf_bytes(two_column_prose_pdf())
        self.assertEqual(stats["tables"], 0)
        self.assertEqual(document.metadata["pages"][0]["readingOrder"], "two-column")
        self.assertEqual(document.metadata["pages"][0]["acceptedTableCount"], 0)
        codes = [item["code"] for item in document.diagnostics]
        self.assertIn("PDF_TABLE_LOW_CONFIDENCE", codes)


if __name__ == "__main__":
    unittest.main()
