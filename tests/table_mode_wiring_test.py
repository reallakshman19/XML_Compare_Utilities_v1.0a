import importlib.util
import sys
import types
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import DocumentModel, ParagraphBlock, SourceRef, TableBlock, TableCell, TableRow


def install_parser_stubs():
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
    install_parser_stubs()
    path = SCRIPTS / "docx_to_markdown.py"
    spec = importlib.util.spec_from_file_location("docx_to_markdown_policy_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def simple_document():
    source = SourceRef("docx", "word/document.xml", table_index=0)
    cells = []
    for column, text in enumerate(("A", "B")):
        cell_ref = SourceRef("docx", "word/document.xml", table_index=0, row_index=0, cell_index=column)
        paragraph = ParagraphBlock(f"p{column}", text, cell_ref)
        cells.append(TableCell((paragraph,), cell_ref, row_index=0, column_index=column))
    table = TableBlock("t0", (TableRow(tuple(cells)),), source, grid_width=2)
    return DocumentModel("docx", (table,))


class TableModeWiringTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    @classmethod
    def tearDownClass(cls):
        for name in ("docx_to_markdown_policy_test", "docx_ooxml_parser", "ooxml_package"):
            sys.modules.pop(name, None)

    def test_legacy_render_path_stays_html(self):
        rendered = self.module.render_document(simple_document(), "html")
        self.assertTrue(rendered.startswith("<table>"))

    def test_auto_mode_wires_to_policy_and_records_decision(self):
        decisions = []
        rendered = self.module.render_document(
            simple_document(), "html", table_mode="auto", table_decisions=decisions,
        )
        self.assertTrue(rendered.startswith("| Column 1 | Column 2 |"))
        self.assertEqual(decisions[0][1].renderer, "markdown")

    def test_new_api_can_request_table_mode_without_legacy_argument(self):
        rendered = self.module.render_document(simple_document(), table_mode="auto")
        self.assertTrue(rendered.startswith("| Column 1 | Column 2 |"))

    def test_cli_defaults_preserve_legacy_html(self):
        args = self.module.build_parser().parse_args(["input.docx"])
        self.assertIsNone(args.table_mode)
        self.assertIsNone(args.table_format)

    def test_cli_exposes_semantic_table_modes(self):
        args = self.module.build_parser().parse_args(["input.docx", "--table-mode", "records"])
        self.assertEqual(args.table_mode, "records")


if __name__ == "__main__":
    unittest.main()
