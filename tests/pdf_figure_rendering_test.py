import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, SourceRef
from pdf_figure_conversion import build_parser, render_pdf_document
from pdf_figures import FigureBlock


class PdfFigureRenderingTest(unittest.TestCase):
    def test_materialized_figure_renders_stable_logical_asset_path(self):
        block = FigureBlock(
            "pdf:p1:figure:0", "sha256-abc",
            SourceRef("pdf", page=1, bbox=(100, 100, 300, 250), extraction="pdf-image-object"),
            alt_text="Figure 1 - Pump curve", caption="Figure 1 - Pump curve",
            filename="pdf-figure-abc.png", source_index=0,
        )
        document = DocumentModel("pdf", (block,), semantic_schema_version="7-pdf-figures")
        self.assertEqual(
            render_pdf_document(document),
            "![Figure 1 - Pump curve](assets/pdf-figure-abc.png)\n",
        )

    def test_skip_mode_renders_explicit_marker(self):
        block = FigureBlock(
            "pdf:p2:figure:3", "pdf-image-p2-3",
            SourceRef("pdf", page=2, bbox=(50, 50, 150, 150), extraction="pdf-image-object"),
            source_index=3,
        )
        document = DocumentModel("pdf", (block,), semantic_schema_version="7-pdf-figures")
        self.assertEqual(render_pdf_document(document), "⟦FIGURE_SKIPPED:PAGE 2 IMAGE 3⟧\n")

    def test_cli_exposes_image_policy_and_physical_asset_directory(self):
        args = build_parser().parse_args([
            "input.pdf", "--images", "skip", "--assets", "out-assets",
            "--figure-max-assets", "12", "--figure-scale", "1.5",
        ])
        self.assertEqual(args.images, "skip")
        self.assertEqual(args.assets, Path("out-assets"))
        self.assertEqual(args.figure_max_assets, 12)
        self.assertEqual(args.figure_scale, 1.5)


if __name__ == "__main__":
    unittest.main()
