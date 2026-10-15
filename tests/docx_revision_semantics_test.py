import sys
import unittest
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_model import (
    DocumentModel, InlineRevision, InlineText, ParagraphBlock, SourceRef,
)
from docx_revision_semantics import (
    enrich_document_model, extract_field_evidence, prepare_package_for_revisions,
)

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DOC = '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>
<w:r><w:t>A</w:t></w:r>
<w:del w:id="1" w:author="Old" w:date="2026-01-01T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del>
<w:ins w:id="2" w:author="New" w:date="2026-01-02T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins>
<w:r><w:footnoteReference w:id="5"/></w:r><w:r><w:commentReference w:id="7"/></w:r>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF X </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Shown</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
</w:p></w:body></w:document>'''
FOOT = '''<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="5"><w:p><w:r><w:t>Foot</w:t></w:r></w:p></w:footnote></w:footnotes>'''
COMMENTS = '''<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="Reviewer"><w:p><w:r><w:t>Comment</w:t></w:r></w:p></w:comment></w:comments>'''


@dataclass(frozen=True)
class Package:
    parts: dict
    crc32: dict
    relationships_by_part: dict
    content_types: dict

    def xml(self, part):
        value = self.parts.get(part)
        return ET.fromstring(value) if value is not None else None


def package():
    return Package(
        {
            "word/document.xml": DOC.encode(),
            "word/footnotes.xml": FOOT.encode(),
            "word/comments.xml": COMMENTS.encode(),
        },
        {"word/document.xml": 1}, {}, {},
    )


def parsed_document_from_prepared(prepared):
    root = prepared.xml("word/document.xml")
    paragraph = root.find(".//" + W + "p")
    inlines = tuple(InlineText(node.text or "") for node in paragraph.iter(W + "t"))
    text = "".join(value.text for value in inlines)
    block = ParagraphBlock(
        "p0", text, SourceRef("docx", "word/document.xml", paragraph_index=0),
        inlines=inlines,
    )
    return DocumentModel("docx", (block,))


class DocxRevisionSemanticsTest(unittest.TestCase):
    def test_accepted_and_rejected_rewrite_source_nodes(self):
        accepted, events, _ = prepare_package_for_revisions(package(), "accepted")
        rejected, _, _ = prepare_package_for_revisions(package(), "rejected")
        accepted_text = "".join(
            node.text or "" for node in accepted.xml("word/document.xml").iter(W + "t")
        )
        rejected_text = "".join(
            node.text or "" for node in rejected.xml("word/document.xml").iter(W + "t")
        )
        self.assertIn("new", accepted_text)
        self.assertNotIn("old", accepted_text)
        self.assertIn("old", rejected_text)
        self.assertNotIn("new", rejected_text)
        self.assertEqual([event["revisionType"] for event in events], ["del", "ins"])

    def test_markup_becomes_semantic_revision_and_note_reference(self):
        original = package()
        prepared, events, fields = prepare_package_for_revisions(original, "markup")
        enriched = enrich_document_model(
            parsed_document_from_prepared(prepared), original, "markup", events, fields,
        )
        paragraph = enriched.blocks[0]
        revisions = [value for value in paragraph.inlines if isinstance(value, InlineRevision)]
        self.assertEqual([value.revision_type for value in revisions], ["del", "ins"])
        self.assertEqual(revisions[0].author, "Old")
        self.assertIn("[^fn5]", paragraph.text)
        self.assertNotIn("COMMENT", paragraph.text)
        self.assertEqual(enriched.notes[0].text, "Foot")
        self.assertEqual(enriched.comments[0].author, "Reviewer")

    def test_complex_field_instructions_are_forensic_evidence(self):
        fields = extract_field_evidence(package().xml("word/document.xml"))
        self.assertEqual(fields[0]["instruction"], "REF X")
        self.assertEqual(fields[0]["result"], "Shown")
        self.assertEqual(fields[0]["kind"], "complex")

    def test_revision_mode_is_attached_to_document_metadata(self):
        original = package()
        prepared, events, fields = prepare_package_for_revisions(original, "accepted")
        enriched = enrich_document_model(
            parsed_document_from_prepared(prepared), original, "accepted", events, fields,
        )
        self.assertEqual(enriched.metadata["revisionMode"], "accepted")
        self.assertEqual(len(enriched.metadata["revisionEvents"]), 2)
        self.assertEqual(enriched.metadata["commentCount"], 1)


if __name__ == "__main__":
    unittest.main()
