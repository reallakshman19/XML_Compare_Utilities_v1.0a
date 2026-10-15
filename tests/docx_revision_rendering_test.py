import importlib.util
import sys
import types
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import (
    DocumentModel,
    InlineNoteReference,
    InlineRevision,
    InlineText,
    NoteDefinition,
    ParagraphBlock,
    SourceRef,
)


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
    spec = importlib.util.spec_from_file_location("docx_revision_rendering_under_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class DocxRevisionRenderingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    @classmethod
    def tearDownClass(cls):
        for name in (
            "docx_revision_rendering_under_test", "docx_ooxml_parser", "ooxml_package",
        ):
            sys.modules.pop(name, None)

    def test_markup_and_footnote_definition_render_deterministically(self):
        ref = SourceRef("docx", "word/document.xml", paragraph_index=0)
        inlines = (
            InlineText("A"),
            InlineRevision("del", (InlineText("old"),), "Alice", "2026-01-01T00:00:00Z"),
            InlineRevision("ins", (InlineText("new"),), "Bob", "2026-01-02T00:00:00Z"),
            InlineNoteReference("footnote", "1"),
        )
        paragraph = ParagraphBlock("p0", "Aoldnew[^fn1]", ref, inlines=inlines)
        note = NoteDefinition(
            "footnote", "1", "Line one\nLine two",
            SourceRef("docx", "word/footnotes.xml", note_type="footnote", note_id="1"),
        )
        document = DocumentModel("docx", (paragraph,), notes=(note,))
        rendered = self.module.render_document(document)
        self.assertEqual(
            rendered,
            "A<del>old</del><ins>new</ins>[^fn1]\n\n[^fn1]: Line one\n    Line two\n",
        )

    def test_move_markup_carries_revision_type_without_author_in_markdown(self):
        ref = SourceRef("docx", "word/document.xml", paragraph_index=0)
        paragraph = ParagraphBlock(
            "p0", "moved", ref,
            inlines=(
                InlineRevision("moveTo", (InlineText("moved"),), "Alice", "2026-01-01"),
            ),
        )
        rendered = self.module.render_document(DocumentModel("docx", (paragraph,)))
        self.assertEqual(rendered, '<ins data-revision="moveTo">moved</ins>\n')
        self.assertNotIn("Alice", rendered)

    def test_running_content_is_metadata_by_default_and_explicit_when_kept(self):
        ref = SourceRef("docx", "word/document.xml", paragraph_index=0)
        paragraph = ParagraphBlock("p0", "Body", ref, inlines=(InlineText("Body"),))
        document = DocumentModel(
            "docx", (paragraph,),
            metadata={
                "runningHeaders": [
                    {"kind": "header", "part": "word/header1.xml", "text": "Head"},
                ],
                "runningFooters": [
                    {"kind": "footer", "part": "word/footer1.xml", "text": "Foot"},
                ],
            },
        )
        self.assertEqual(self.module.render_document(document), "Body\n")
        kept = self.module.render_document(document, header_mode="keep", footer_mode="keep")
        self.assertIn("<!-- DOCX HEADER PART word/header1.xml -->\nHead", kept)
        self.assertIn("<!-- DOCX FOOTER PART word/footer1.xml -->\nFoot", kept)
        self.assertLess(kept.index("Head"), kept.index("Body"))
        self.assertLess(kept.index("Body"), kept.index("Foot"))

    def test_revision_mode_enters_canonical_options(self):
        accepted = self.module._canonical_options("html", revision_mode="accepted")
        rejected = self.module._canonical_options("html", revision_mode="rejected")
        self.assertNotEqual(accepted, rejected)
        self.assertEqual(rejected["revisions"], "rejected")


if __name__ == "__main__":
    unittest.main()
