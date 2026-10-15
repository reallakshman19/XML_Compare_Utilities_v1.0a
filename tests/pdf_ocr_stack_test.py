import shutil
import sys
import unittest
from io import BytesIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, ParagraphBlock, SourceRef, TableBlock
from pdf_ocr import (
    OcrError, OcrLine, OcrPageResult, OcrParagraph, OcrWord, RasterizedPage,
    choose_raster_scale, group_ocr_lines, group_ocr_paragraphs,
    merge_ocr_page_blocks, ocr_decision, pixel_bbox_to_pdf_points,
)
from pdf_ocr_conversion import apply_ocr, convert_pdf_bytes


class FakeRasterizer:
    def __init__(self, pixels=480000): self.calls, self.pixels = [], pixels
    def version(self): return "fake-raster-1"
    def render_page(self, pdf_bytes, page, **kwargs):
        self.calls.append((page, kwargs))
        width, height = 800, max(1, self.pixels // 800)
        return RasterizedPage(page, b"png", 600.0, 800.0, width, height, 1.0, self.pixels * 10, self.version())


class FakeEngine:
    def __init__(self, confidence=0.96, text="OCR pressure 3.15 bar"):
        self.confidence, self.text, self.calls = confidence, text, []
    def version(self): return "fake-ocr-1"
    def recognize(self, raster, **kwargs):
        self.calls.append((raster.page, kwargs))
        word = OcrWord(self.text, (10, 10, 200, 30), self.confidence, 1, 1, 1, 1)
        line = OcrLine(self.text, word.bbox, self.confidence, (word,), 1, 1, 1)
        para = OcrParagraph(self.text, word.bbox, self.confidence, (line,), 1, 1)
        return OcrPageResult(raster.page, (word,), (line,), (para,), self.confidence, self.version(), raster.rasterizer_version, raster)


def doc(classification="SCANNED", adequate=False):
    return DocumentModel("pdf", (), metadata={
        "pages": [{
            "page": 1, "width": 600.0, "height": 800.0,
            "classification": classification,
            "nativeTextQuality": {"adequate": adequate, "visibleCharCount": 200 if adequate else 0},
        }],
        "backendVersions": {"pdfplumber": "x", "pdfminer.six": "y"},
    })


def apply(doc_value, **overrides):
    rasterizer = overrides.pop("rasterizer", FakeRasterizer())
    engine = overrides.pop("engine", FakeEngine())
    kwargs = dict(
        password=None, mode="auto", language="eng", confidence_min=0.70,
        scale=2.0, max_pixels=16_000_000, max_memory_bytes=64 * 1024 * 1024,
        max_pages=100, max_job_pixels=250_000_000, timeout_seconds=60.0,
        rasterizer=rasterizer, engine=engine,
    )
    kwargs.update(overrides)
    converted, stats = apply_ocr(doc_value, b"pdf", **kwargs)
    return converted, stats, rasterizer, engine


class PdfOcrStackTest(unittest.TestCase):
    def test_auto_skips_healthy_native(self):
        self.assertFalse(ocr_decision({"classification":"BORN_DIGITAL","nativeTextQuality":{"adequate":True,"visibleCharCount":300}}, "auto").run)

    def test_auto_runs_scanned_and_never_disables(self):
        page = {"classification":"SCANNED","nativeTextQuality":{"adequate":False,"visibleCharCount":0}}
        self.assertTrue(ocr_decision(page, "auto").run)
        self.assertFalse(ocr_decision(page, "never").run)

    def test_table_heavy_ocr_is_layout_unsafe(self):
        page = {"classification":"TABLE_HEAVY","nativeTextQuality":{"adequate":False,"visibleCharCount":5}}
        self.assertFalse(ocr_decision(page, "auto").layout_safe)

    def test_raster_scale_reserves_peak_memory_headroom(self):
        scale = choose_raster_scale(600, 800, requested_scale=4.0, max_pixels=16_000_000, max_memory_bytes=64*1024*1024)
        self.assertLess(scale, 4.0)

    def test_raster_scale_fails_when_minimum_is_unsafe(self):
        with self.assertRaises(OcrError) as caught:
            choose_raster_scale(10000, 10000, requested_scale=2.0, max_pixels=100_000, max_memory_bytes=400_000)
        self.assertEqual(caught.exception.code, "OCR_RASTER_LIMIT_EXCEEDED")

    def test_pixel_bbox_maps_back_to_pdf_points(self):
        self.assertEqual(pixel_bbox_to_pdf_points((20,40,120,80),2.0,600,800),(10.0,20.0,60.0,40.0))

    def test_grouping_retains_confidence(self):
        words = (OcrWord("Engineering",(10,10,70,20),.9,1,1,1,1), OcrWord("3.15",(75,10,100,20),.95,1,1,1,2))
        paragraphs = group_ocr_paragraphs(group_ocr_lines(words))
        self.assertEqual(paragraphs[0].text, "Engineering 3.15")
        self.assertGreater(paragraphs[0].confidence, .9)

    def test_near_duplicate_keeps_native(self):
        native = ParagraphBlock("n","Engineering value 3.15",SourceRef("pdf",page=1,bbox=(10,10,200,40),extraction="embedded-text"))
        ocr = ParagraphBlock("o","Engineering value 3.15",SourceRef("pdf",page=1,bbox=(12,12,198,39),extraction="ocr",confidence=.95))
        result = merge_ocr_page_blocks((native,),(ocr,),page=1,page_width=600,page_height=800)
        self.assertEqual(result.blocks,(native,)); self.assertEqual(result.deduplicated,1)

    def test_numeric_conflict_keeps_native_and_diagnoses(self):
        native = ParagraphBlock("n","Pressure 3.15 bar",SourceRef("pdf",page=1,bbox=(10,10,200,40),extraction="embedded-text"))
        ocr = ParagraphBlock("o","Pressure 8.15 bar",SourceRef("pdf",page=1,bbox=(12,12,198,39),extraction="ocr",confidence=.95))
        result = merge_ocr_page_blocks((native,),(ocr,),page=1,page_width=600,page_height=800)
        self.assertEqual(result.blocks,(native,)); self.assertEqual(result.diagnostics[0]["code"],"OCR_NATIVE_CONFLICT")

    def test_ocr_overlap_with_native_table_is_deduplicated(self):
        table = TableBlock("t",(),SourceRef("pdf",page=1,bbox=(10,10,200,100),extraction="embedded-table-ruled"),grid_width=2)
        ocr = ParagraphBlock("o","A B C",SourceRef("pdf",page=1,bbox=(20,20,180,80),extraction="ocr",confidence=.9))
        result = merge_ocr_page_blocks((table,),(ocr,),page=1,page_width=600,page_height=800)
        self.assertEqual(result.blocks,(table,)); self.assertEqual(result.deduplicated,1)

    def test_apply_healthy_page_never_invokes_engine(self):
        converted, stats, rasterizer, engine = apply(doc("BORN_DIGITAL",True))
        self.assertEqual(stats["ocr_pages_requested"],0); self.assertEqual(rasterizer.calls,[]); self.assertEqual(engine.calls,[])
        self.assertEqual(converted.metadata["ocrPages"],[])

    def test_apply_scanned_page_adds_ocr_provenance(self):
        converted, stats, _, _ = apply(doc())
        block = next(value for value in converted.blocks if isinstance(value,ParagraphBlock))
        self.assertEqual(stats["ocr_pages_completed"],1); self.assertEqual(block.provenance.extraction,"ocr")
        self.assertEqual(converted.metadata["ocrPages"][0]["canonicalAction"],"merge")

    def test_low_confidence_emits_visible_marker(self):
        converted, stats, _, _ = apply(doc(),engine=FakeEngine(confidence=.4))
        block = next(value for value in converted.blocks if isinstance(value,ParagraphBlock))
        self.assertEqual(stats["ocr_pages_degraded"],1); self.assertIn("OCR_LOW_CONFIDENCE",block.text)

    def test_job_pixel_limit_fails_closed(self):
        with self.assertRaises(OcrError) as caught:
            apply(doc(),rasterizer=FakeRasterizer(2_000_000),max_job_pixels=1_000_000)
        self.assertEqual(caught.exception.code,"OCR_JOB_PIXEL_LIMIT_EXCEEDED")

    def test_real_image_only_pdf_when_dependencies_available(self):
        try:
            import pypdfium2  # noqa: F401
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            self.skipTest("real OCR Python dependencies unavailable")
        if shutil.which("tesseract") is None:
            self.skipTest("Tesseract unavailable")
        image = Image.new("RGB",(1600,1000),"white"); draw=ImageDraw.Draw(image)
        font_path="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        font=ImageFont.truetype(font_path,64) if Path(font_path).exists() else ImageFont.load_default()
        draw.text((120,160),"Engineering pressure 3.15 bar",font=font,fill="black")
        draw.text((120,280),"Pipe diameter 24 in",font=font,fill="black")
        stream=BytesIO(); image.save(stream,format="PDF",resolution=150.0)
        output, stats = convert_pdf_bytes(stream.getvalue(),ocr_mode="auto")
        self.assertEqual(stats["ocr_pages_completed"],1); self.assertEqual(stats["ocr_pages_degraded"],0)
        self.assertIn("3.15",output.decode()); self.assertIn("24",output.decode())


if __name__ == "__main__": unittest.main()
