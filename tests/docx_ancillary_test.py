import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from docx_ancillary import (
    COMMENTS_PART,
    ENDNOTES_PART,
    FOOTNOTES_PART,
    parse_comments,
    parse_notes,
    parse_running_content,
    revision_visible,
)


class Package:
    def __init__(self, parts):
        self.parts = parts

    def xml(self, part):
        value = self.parts.get(part)
        return ET.fromstring(value) if value is not None else None


FOOTNOTES = '''<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:footnote w:id="-1" w:type="separator"><w:p><w:r><w:t>sep</w:t></w:r></w:p></w:footnote>
<w:footnote w:id="1"><w:p><w:r><w:t>Before </w:t></w:r><w:del><w:r><w:delText>old</w:delText></w:r></w:del><w:ins><w:r><w:t>new</w:t></w:r></w:ins></w:p></w:footnote>
</w:footnotes>'''
ENDNOTES = '''<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:endnote w:id="2"><w:p><w:r><w:t>End note</w:t></w:r></w:p></w:endnote>
</w:endnotes>'''
HEADER = '''<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Header text</w:t></w:r></w:p></w:hdr>'''
FOOTER = '''<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Footer text</w:t></w:r></w:p></w:ftr>'''
COMMENTS = '''<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:comment w:id="7" w:author="Alice" w:date="2026-01-02T03:04:05Z"><w:p><w:r><w:t>Review me</w:t></w:r></w:p></w:comment>
</w:comments>'''


class DocxAncillaryTest(unittest.TestCase):
    def setUp(self):
        self.package = Package({
            FOOTNOTES_PART: FOOTNOTES,
            ENDNOTES_PART: ENDNOTES,
            COMMENTS_PART: COMMENTS,
            "word/header1.xml": HEADER,
            "word/footer1.xml": FOOTER,
        })

    def test_accepted_and_rejected_note_text_are_deliberate(self):
        accepted, _ = parse_notes(self.package, "footnote", "accepted")
        rejected, _ = parse_notes(self.package, "footnote", "rejected")
        self.assertEqual(accepted[0].text, "Before new")
        self.assertEqual(rejected[0].text, "Before old")

    def test_markup_note_text_retains_revision_markup(self):
        notes, _ = parse_notes(self.package, "footnote", "markup")
        self.assertEqual(notes[0].text, "Before <del>old</del><ins>new</ins>")

    def test_separator_notes_are_not_emitted(self):
        notes, _ = parse_notes(self.package, "footnote")
        self.assertEqual([note.note_id for note in notes], ["1"])

    def test_endnote_and_comment_provenance_are_stable(self):
        notes, _ = parse_notes(self.package, "endnote")
        comments = parse_comments(self.package)
        self.assertEqual(notes[0].provenance.part, ENDNOTES_PART)
        self.assertEqual(comments[0].comment_id, "7")
        self.assertEqual(comments[0].author, "Alice")
        self.assertEqual(comments[0].text, "Review me")

    def test_running_header_footer_content_is_part_ordered_metadata(self):
        headers, header_diagnostics = parse_running_content(self.package, "header")
        footers, footer_diagnostics = parse_running_content(self.package, "footer")
        self.assertEqual(headers[0]["part"], "word/header1.xml")
        self.assertEqual(headers[0]["text"], "Header text")
        self.assertEqual(footers[0]["text"], "Footer text")
        self.assertEqual(header_diagnostics, ())
        self.assertEqual(footer_diagnostics, ())

    def test_revision_visibility_modes(self):
        self.assertTrue(revision_visible("ins", "accepted"))
        self.assertFalse(revision_visible("del", "accepted"))
        self.assertTrue(revision_visible("del", "rejected"))
        self.assertTrue(revision_visible("moveFrom", "markup"))


if __name__ == "__main__":
    unittest.main()
