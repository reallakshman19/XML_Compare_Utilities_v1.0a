import sys
import unittest
from io import BytesIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pdf_conversion import convert_pdf_bytes, parse_pdf_bytes
from pdf_native import PdfExtractionError, PdfPlumberBackend

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pdfencrypt import StandardEncryption
except ImportError:
    canvas = None
    StandardEncryption = None


def fixture_pdf(encrypted=False):
    output = BytesIO()
    encryption = StandardEncryption("secret") if encrypted and StandardEncryption else None
    pdf = canvas.Canvas(output, pagesize=(600, 800), encrypt=encryption)
    for page in range(2):
        pdf.setFont("Helvetica", 8)
        pdf.drawString(50, 785, "Project Alpha")
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(50, 740, "Engineering Assessment")
        pdf.setFont("Helvetica", 10)
        for index in range(3):
            pdf.drawString(50, 680 - index * 20, f"Left column line {index + 1} with value 3.15")
            pdf.drawString(350, 680 - index * 20, f"Right column line {index + 1} with OD 273 mm")
        pdf.setFont("Helvetica", 8)
        pdf.drawString(50, 15, "Confidential")
        pdf.showPage()
    pdf.save()
    return output.getvalue()


@unittest.skipIf(canvas is None, "reportlab unavailable")
class PdfPlumberIntegrationTest(unittest.TestCase):
    def test_real_adapter_extracts_positioned_two_column_pdf(self):
        data = fixture_pdf()
        document, stats = parse_pdf_bytes(data, backend=PdfPlumberBackend())
        self.assertEqual(stats["pages"], 2)
        self.assertEqual(document.metadata["pages"][0]["readingOrder"], "two-column")
        self.assertEqual(document.metadata["runningHeaderCount"], 0)  # only two pages: fail closed
        markdown, _ = convert_pdf_bytes(data, backend=PdfPlumberBackend())
        text = markdown.decode()
        self.assertIn("Engineering Assessment", text)
        self.assertLess(text.index("Left column line 1"), text.index("Right column line 1"))

    def test_encrypted_pdf_fails_closed_without_password(self):
        if StandardEncryption is None:
            self.skipTest("reportlab encryption unavailable")
        with self.assertRaises(PdfExtractionError) as caught:
            parse_pdf_bytes(fixture_pdf(encrypted=True), backend=PdfPlumberBackend())
        self.assertEqual(caught.exception.code, "PDF_ENCRYPTED")

    def test_encrypted_pdf_can_use_explicit_password(self):
        if StandardEncryption is None:
            self.skipTest("reportlab encryption unavailable")
        document, stats = parse_pdf_bytes(
            fixture_pdf(encrypted=True), password="secret", backend=PdfPlumberBackend(),
        )
        self.assertEqual(stats["pages"], 2)
        self.assertEqual(document.source_type, "pdf")


if __name__ == "__main__":
    unittest.main()
