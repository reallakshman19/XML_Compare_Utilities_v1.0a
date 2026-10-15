import importlib.util
import sys
import types
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, InlineImage, ParagraphBlock, SourceRef, TableBlock, TableCell, TableRow


def install_stubs():
    parser = types.ModuleType("docx_ooxml_parser")
    parser.DOC_PART = "word/document.xml"
    for name in (
        "cell_colspan", "count_nonempty_text_nodes", "heading_level", "local_name",
        "paragraph_style", "paragraph_text", "parse_cell_blocks", "parse_document_xml",
        "parse_docx_package", "parse_table", "read_document_xml", "table_colspan",
    ):
        setattr(parser, name, lambda *args, **kwargs: None)
    sys.modules["docx_ooxml_parser"] = parser
    package = types.ModuleType("ooxml_package")
    package.OoxmlPackage = object
    sys.modules["ooxml_package"] = package


def load_module():
    install_stubs()
    path = SCRIPTS / "docx_to_markdown.py"
    spec = importlib.util.spec_from_file_location("docx_assets_rendering_under_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class DocxAssetsRenderingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    @classmethod
    def tearDownClass(cls):
        for name in ("docx_assets_rendering_under_test", "docx_ooxml_parser", "ooxml_package"):
            sys.modules.pop(name, None)

    def image_paragraph(self, supported=True):
        ref = SourceRef("docx", "word/document.xml", paragraph_index=0)
        image = InlineImage(
            "sha256-abc", "Pump curve", "rId5", "Figure 1", "asset-abc.png", supported,
        )
        return ParagraphBlock("p0", "[image:Pump curve]", ref, inlines=(image,))

    def test_supported_image_renders_stable_logical_asset_path(self):
        rendered = self.module.render_document(DocumentModel("docx", (self.image_paragraph(),)))
        self.assertEqual(rendered, "![Pump curve](assets/asset-abc.png)\n")

    def test_skip_and_unsupported_are_visible_markers(self):
        document = DocumentModel("docx", (self.image_paragraph(),))
        self.assertIn("⟦IMAGE_SKIPPED:sha256-abc⟧", self.module.render_document(document, image_mode="skip"))
        unsupported = DocumentModel("docx", (self.image_paragraph(False),))
        self.assertIn("⟦IMAGE_UNSUPPORTED:sha256-abc⟧", self.module.render_document(unsupported))

    def test_image_in_html_table_uses_img_element(self):
        paragraph = self.image_paragraph()
        ref = SourceRef("docx", "word/document.xml", table_index=0, row_index=0, cell_index=0)
        cell = TableCell((paragraph,), ref, row_index=0, column_index=0)
        table = TableBlock("t0", (TableRow((cell,)),), SourceRef("docx", "word/document.xml", table_index=0), grid_width=1)
        rendered = self.module.render_document(DocumentModel("docx", (table,)), "html")
        self.assertIn('<img src="assets/asset-abc.png" alt="Pump curve">', rendered)

    def test_image_mode_participates_in_canonical_options(self):
        extract = self.module._canonical_options("html", image_mode="extract")
        skip = self.module._canonical_options("html", image_mode="skip")
        self.assertNotEqual(extract, skip)
        self.assertEqual(skip["images"], "skip")


if __name__ == "__main__":
    unittest.main()
