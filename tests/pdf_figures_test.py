import tempfile
import unittest
from pathlib import Path

from document_model import DocumentModel, ParagraphBlock, SourceRef
from pdf_figures import (
    FigureError, FigureRaster, PdfFigureCandidate, apply_pdf_figures,
    choose_figure_scale, materialize_figure_assets, select_figure_candidates,
)


def candidate(page=1, index=0, bbox=(100, 100, 300, 250), page_width=600, page_height=800):
    return PdfFigureCandidate(
        page, index, bbox, page_width, page_height,
        name=f"Im{index}", src_width=800, src_height=600,
    )


class FakeBackend:
    def __init__(self, mapping):
        self.mapping = mapping

    def extract(self, *args, **kwargs):
        return self.mapping


class FakeRasterizer:
    def __init__(self):
        self.calls = 0

    def render_region(self, pdf_bytes, value, **kwargs):
        self.calls += 1
        data = f"figure-{value.page}-{value.source_index}".encode()
        return FigureRaster(
            value.page, value.source_index, value.bbox, data,
            400, 300, 2.0, 1_200_000, "5.8.0", "12.3.0",
        )


class PdfFiguresTest(unittest.TestCase):
    def page_info(self, classification="BORN_DIGITAL", adequate=True):
        return {
            "page": 1, "width": 600, "height": 800,
            "classification": classification,
            "nativeTextQuality": {"adequate": adequate},
            "readingOrder": "single",
        }

    def test_rejects_full_page_scan_and_tiny_decoration(self):
        selection = select_figure_candidates(
            [candidate(bbox=(0, 0, 600, 780)), candidate(index=1, bbox=(5, 5, 25, 20)), candidate(index=2)],
            page_info=self.page_info("SCANNED", False),
        )
        self.assertEqual([value.source_index for value in selection.accepted], [2])
        codes = {item["code"] for item in selection.diagnostics}
        self.assertIn("PDF_FIGURE_PAGE_BACKGROUND", codes)
        self.assertIn("PDF_FIGURE_DECORATIVE_SMALL", codes)

    def test_rejects_table_overlap(self):
        selection = select_figure_candidates(
            [candidate()], page_info=self.page_info(),
            table_bboxes=[(90, 90, 310, 260)],
        )
        self.assertFalse(selection.accepted)
        self.assertEqual(selection.diagnostics[0]["code"], "PDF_FIGURE_TABLE_OVERLAP")

    def test_dedupes_same_visual_bbox(self):
        selection = select_figure_candidates(
            [candidate(index=1), candidate(index=2, bbox=(100.2, 100.1, 300.1, 250.1))],
            page_info=self.page_info(),
        )
        self.assertEqual(len(selection.accepted), 1)
        self.assertIn("PDF_FIGURE_DUPLICATE_CANDIDATE", [item["code"] for item in selection.diagnostics])

    def test_scale_clamps_by_memory(self):
        value = choose_figure_scale(
            1000, 1000, requested_scale=4,
            max_pixels=16_000_000, max_memory_bytes=10_000_000,
        )
        self.assertEqual(value, 1.0)

    def test_apply_extract_adds_asset_and_caption(self):
        paragraph = ParagraphBlock(
            "p1", "Figure 2 - Pump curve",
            SourceRef("pdf", page=1, bbox=(100, 260, 300, 280), extraction="embedded-text"),
        )
        document = DocumentModel("pdf", (paragraph,), metadata={"pages": [self.page_info()]})
        rasterizer = FakeRasterizer()
        result = apply_pdf_figures(
            document, b"x", backend=FakeBackend({1: (candidate(),)}), rasterizer=rasterizer,
        )
        self.assertEqual(rasterizer.calls, 1)
        figure = next(block for block in result.document.blocks if getattr(block, "kind", "") == "figure")
        self.assertEqual(figure.caption, "Figure 2 - Pump curve")
        self.assertTrue(figure.filename.endswith(".png"))
        self.assertEqual(len(result.document.assets), 1)
        self.assertEqual(result.stats["figures_rasterized"], 1)
        self.assertEqual(result.document.metadata["figureRasterizerVersion"], "5.8.0")
        self.assertEqual(list(result.payloads.values()), [b"figure-1-0"])
        self.assertEqual(result.document.semantic_schema_version, "7-pdf-figures")

    def test_skip_is_visible_and_never_rasterizes(self):
        document = DocumentModel("pdf", (), metadata={"pages": [self.page_info()]})
        rasterizer = FakeRasterizer()
        result = apply_pdf_figures(
            document, b"x", mode="skip",
            backend=FakeBackend({1: (candidate(),)}), rasterizer=rasterizer,
        )
        self.assertEqual(rasterizer.calls, 0)
        figure = next(block for block in result.document.blocks if getattr(block, "kind", "") == "figure")
        self.assertIsNone(figure.filename)
        self.assertIn("PDF_FIGURE_SKIPPED_BY_POLICY", [item["code"] for item in result.document.diagnostics])

    def test_asset_materialization_fails_on_collision(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            materialize_figure_assets({"a.png": b"A"}, root)
            with self.assertRaises(FigureError):
                materialize_figure_assets({"a.png": b"B"}, root)


if __name__ == "__main__":
    unittest.main()
