import tempfile
import unittest
from pathlib import Path

from pdf_figures import PdfPlumberFigureBackend, PdfiumFigureRasterizer


class PdfFiguresIntegrationTest(unittest.TestCase):
    def test_generated_pdf_image_bbox_and_crop(self):
        try:
            from PIL import Image, ImageDraw
            from reportlab.pdfgen import canvas
        except ImportError:
            self.skipTest("optional PDF figure integration dependencies are unavailable")
        try:
            import pdfplumber  # noqa: F401
            import pypdfium2  # noqa: F401
        except ImportError:
            self.skipTest("pdfplumber/pypdfium2 are unavailable")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image_path = root / "figure.png"
            image = Image.new("RGB", (200, 120), "white")
            draw = ImageDraw.Draw(image)
            draw.rectangle((10, 10, 190, 110), outline="black")
            draw.text((30, 45), "Pump curve", fill="black")
            image.save(image_path)

            pdf_path = root / "sample.pdf"
            pdf = canvas.Canvas(str(pdf_path), pagesize=(600, 800))
            pdf.drawString(100, 700, "Figure test")
            pdf.drawImage(str(image_path), 100, 400, width=300, height=180)
            pdf.drawString(100, 380, "Figure 1 - Pump curve")
            pdf.save()

            data = pdf_path.read_bytes()
            candidates = PdfPlumberFigureBackend().extract(data)
            self.assertEqual(len(candidates[1]), 1)
            candidate = candidates[1][0]
            self.assertEqual(candidate.bbox, (100.0, 220.0, 400.0, 400.0))
            self.assertAlmostEqual(candidate.area_ratio, 0.1125)

            raster = PdfiumFigureRasterizer().render_region(data, candidate)
            self.assertEqual((raster.width, raster.height), (600, 360))
            self.assertEqual(raster.scale, 2.0)
            self.assertGreater(len(raster.png_bytes), 100)


if __name__ == "__main__":
    unittest.main()
