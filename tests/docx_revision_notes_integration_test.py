import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "docx_to_markdown.py"

DOCUMENT = '''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p>
  <w:r><w:t>A</w:t></w:r>
  <w:del w:id="1" w:author="Old" w:date="2026-01-01T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del>
  <w:ins w:id="2" w:author="New" w:date="2026-01-02T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins>
  <w:r><w:footnoteReference w:id="1"/></w:r>
  <w:r><w:endnoteReference w:id="2"/></w:r>
  <w:r><w:commentReference w:id="7"/></w:r>
  <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF Target </w:instrText></w:r>
  <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Shown</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
</w:p>
</w:body></w:document>'''
FOOTNOTES = '''<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:footnote w:id="1"><w:p><w:r><w:t>Foot </w:t></w:r><w:del><w:r><w:delText>old</w:delText></w:r></w:del><w:ins><w:r><w:t>new</w:t></w:r></w:ins></w:p></w:footnote>
</w:footnotes>'''
ENDNOTES = '''<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnote w:id="2"><w:p><w:r><w:t>End</w:t></w:r></w:p></w:endnote></w:endnotes>'''
COMMENTS = '''<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="Reviewer" w:date="2026-01-03T00:00:00Z"><w:p><w:r><w:t>Comment evidence</w:t></w:r></w:p></w:comment></w:comments>'''
HEADER = '''<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Header text</w:t></w:r></w:p></w:hdr>'''
FOOTER = '''<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Footer text</w:t></w:r></w:p></w:ftr>'''


def build_docx(path: Path):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr("word/document.xml", DOCUMENT)
        package.writestr("word/footnotes.xml", FOOTNOTES)
        package.writestr("word/endnotes.xml", ENDNOTES)
        package.writestr("word/comments.xml", COMMENTS)
        package.writestr("word/header1.xml", HEADER)
        package.writestr("word/footer1.xml", FOOTER)


class DocxRevisionNotesIntegrationTest(unittest.TestCase):
    def convert(self, *args):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.docx"
            output = root / "output.md"
            evidence = root / "evidence.json"
            build_docx(source)
            command = [
                sys.executable, str(SCRIPT), str(source), "-o", str(output),
                "--evidence", str(evidence), *args,
            ]
            subprocess.run(command, check=True, capture_output=True, text=True)
            return output.read_text(), json.loads(evidence.read_text())

    def test_accepted_and_rejected_modes_select_opposite_revision_content(self):
        accepted, accepted_evidence = self.convert("--revisions", "accepted")
        rejected, rejected_evidence = self.convert("--revisions", "rejected")
        self.assertIn("Anew[^fn1][^en2]Shown", accepted)
        self.assertNotIn("old", accepted.split("[^fn1]")[0])
        self.assertIn("Aold[^fn1][^en2]Shown", rejected)
        self.assertNotIn("new", rejected.split("[^fn1]")[0])
        self.assertIn("[^fn1]: Foot new", accepted)
        self.assertIn("[^fn1]: Foot old", rejected)
        self.assertNotEqual(accepted_evidence["optionsHash"], rejected_evidence["optionsHash"])

    def test_markup_and_forensic_evidence_retain_revision_and_field_metadata(self):
        markdown, evidence = self.convert("--revisions", "markup")
        self.assertIn("A<del>old</del><ins>new</ins>[^fn1][^en2]Shown", markdown)
        self.assertEqual(
            [item["revisionType"] for item in evidence["metadata"]["revisionEvents"]],
            ["del", "ins"],
        )
        self.assertEqual(evidence["metadata"]["fields"][0]["instruction"], "REF Target")
        self.assertEqual(evidence["metadata"]["fields"][0]["result"], "Shown")
        self.assertEqual(evidence["comments"][0]["author"], "Reviewer")
        paragraph = evidence["blocks"][0]
        revision_items = [item for item in paragraph["inlines"] if item["kind"] == "revision"]
        self.assertEqual(
            [item["revisionType"] for item in revision_items], ["del", "ins"],
        )

    def test_headers_footers_default_to_metadata_and_keep_is_explicit(self):
        default_markdown, evidence = self.convert()
        self.assertNotIn("Header text", default_markdown)
        self.assertNotIn("Footer text", default_markdown)
        self.assertEqual(
            evidence["metadata"]["runningHeaders"][0]["part"], "word/header1.xml",
        )
        kept, _ = self.convert("--headers", "keep", "--footers", "keep")
        self.assertIn("<!-- DOCX HEADER PART word/header1.xml -->\nHeader text", kept)
        self.assertIn("<!-- DOCX FOOTER PART word/footer1.xml -->\nFooter text", kept)

    def test_drop_policy_is_explicit_in_diagnostics(self):
        _, evidence = self.convert("--headers", "drop", "--footers", "drop")
        self.assertNotIn("runningHeaders", evidence["metadata"])
        self.assertNotIn("runningFooters", evidence["metadata"])
        codes = [item["code"] for item in evidence["diagnostics"]]
        self.assertIn("DOCX_HEADER_DROPPED", codes)
        self.assertIn("DOCX_FOOTER_DROPPED", codes)


if __name__ == "__main__":
    unittest.main()
