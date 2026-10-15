import sys
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_conversion_service import ConversionServiceConfig, DocumentConversionService

try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None


def sixty_page_pdf():
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=(600, 800))
    for page in range(1, 61):
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(50, 740, f"Controlled Engineering Page {page}")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(50, 700, f"Page-specific pressure marker P-{page:02d}")
        pdf.showPage()
    pdf.save()
    return output.getvalue()


@unittest.skipIf(canvas is None, "reportlab unavailable")
class DocumentConversionApiIntegrationTest(unittest.TestCase):
    def test_real_converter_reads_only_requested_original_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            source = root / "range-source.pdf"
            source.write_bytes(sixty_page_pdf())
            service = DocumentConversionService(ConversionServiceConfig(
                (root,), max_source_bytes=16 * 1024 * 1024,
                max_range_pages=10, max_source_pages=100,
            ))
            result = service.convert({
                "sourcePath": str(source),
                "pages": {"start": 50, "end": 55},
                "options": {
                    "tableMode": "auto",
                    "ocr": "never",
                    "images": "skip",
                    "engineeringRegions": "never",
                },
            })

        markdown = result["markdown"]
        self.assertIn("Controlled Engineering Page 50", markdown)
        self.assertIn("Controlled Engineering Page 55", markdown)
        self.assertNotIn("Controlled Engineering Page 49", markdown)
        self.assertNotIn("Controlled Engineering Page 56", markdown)
        self.assertEqual(result["pageRange"], {"start": 50, "end": 55, "count": 6})
        self.assertEqual(result["stats"]["pages"], 6)
        self.assertEqual(result["stats"]["source_total_pages"], 60)
        self.assertIn(
            "PDF_PAGE_RANGE_CONTEXT_LIMITED",
            {item["code"] for item in result["diagnostics"]},
        )


if __name__ == "__main__":
    unittest.main()
