import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "docx_to_markdown.py"

DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Example Heading</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Alpha</w:t><w:tab/><w:t>Beta</w:t><w:br/><w:t>Gamma</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:br w:type="page"/><w:t>After page break</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
          <w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>Outer</w:t></w:r></w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>Nested 1</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>Nested 2</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>
"""

STYLES_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="BaseOutline">
    <w:name w:val="Corporate Section"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CustomSection">
    <w:name w:val="Engineering Section"/>
    <w:basedOn w:val="BaseOutline"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListStyle">
    <w:name w:val="Corporate List"/>
    <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="5"/></w:numPr></w:pPr>
  </w:style>
</w:styles>
"""

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>
"""

ROOT_RELS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdOffice" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

NUMBERING_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="7">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="5">
    <w:abstractNumId w:val="7"/>
    <w:lvlOverride w:ilvl="1"><w:startOverride w:val="3"/></w:lvlOverride>
  </w:num>
</w:numbering>
"""

STYLE_NUMBERING_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="CustomSection"/></w:pPr><w:r><w:t>Custom Heading</w:t></w:r></w:p>
    <w:p><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:r><w:t>Direct Heading</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="ListStyle"/></w:pPr><w:r><w:t>Bullet item</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="5"/></w:numPr></w:pPr><w:r><w:t>Nested item</w:t></w:r></w:p>
  </w:body>
</w:document>
"""

RELATIONSHIPS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/doc" TargetMode="External"/>
</Relationships>
"""

ORDER_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>A</w:t></w:r></w:p>
    <w:sdt><w:sdtContent>
      <w:p>
        <w:r><w:t>B</w:t></w:r>
        <w:hyperlink r:id="rId9"><w:r><w:t>Link</w:t></w:r></w:hyperlink>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText>REF HiddenInstruction</w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>
        <w:r><w:t>Shown</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
        <w:del><w:r><w:delText>Deleted</w:delText></w:r></w:del>
        <w:ins><w:r><w:t>Inserted</w:t></w:r></w:ins>
        <w:r><w:noBreakHyphen/><w:t>C</w:t><w:sym w:font="Arial" w:char="00B2"/></w:r>
      </w:p>
    </w:sdtContent></w:sdt>
    <w:p><w:r><w:t>D</w:t></w:r></w:p>
  </w:body>
</w:document>
"""

MISSING_REL_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body><w:p><w:hyperlink r:id="rId404"><w:r><w:t>Keep label</w:t></w:r></w:hyperlink></w:p></w:body>
</w:document>
"""

TABLE_GRID_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:tbl>
    <w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid>
    <w:tr>
      <w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>Merged12</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>R1C</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge/></w:tcPr><w:p/></w:tc>
      <w:tc><w:p><w:r><w:t>R2C</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>A3</w:t></w:r></w:p></w:tc>
      <w:tc><w:p/></w:tc>
      <w:tc><w:p><w:r><w:t>C3</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl></w:body>
</w:document>
"""

OMITTED_GRID_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:tbl>
    <w:tblGrid><w:gridCol/><w:gridCol/><w:gridCol/><w:gridCol/></w:tblGrid>
    <w:tr>
      <w:trPr><w:gridBefore w:val="1"/></w:trPr>
      <w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc>
      <w:tc><w:p/></w:tc>
      <w:tc><w:p><w:r><w:t>D1</w:t></w:r></w:p></w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>A2</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>C2</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>D2</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl></w:body>
</w:document>
"""

ORPHAN_VMERGE_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:tbl>
    <w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>
    <w:tr>
      <w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p><w:r><w:t>Orphan</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl></w:body>
</w:document>
"""

EXPECTED_HTML = '# Example Heading\n\nAlpha\tBeta\nGamma\n\n---\n\nAfter page break\n\n<table>\n  <tr>\n    <td colspan="2">A &amp; B</td>\n    <td>Outer<br><table>\n  <tr>\n    <td>Nested 1</td>\n    <td>Nested 2</td>\n  </tr>\n</table></td>\n  </tr>\n</table>\n'
EXPECTED_TSV = '# Example Heading\n\nAlpha\tBeta\nGamma\n\n---\n\nAfter page break\n\nA & B\tOuter Nested 1 | Nested 2\n'


def build_docx(path: Path, document_xml: str = DOCUMENT_XML, extra_parts: dict[str, str] | None = None):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as package:
        package.writestr("word/document.xml", document_xml)
        for name, content in (extra_parts or {}).items():
            package.writestr(name, content)


class DocxToMarkdownTest(unittest.TestCase):
    def run_converter(self, table_format: str = "html", evidence: bool = False, document_xml: str = DOCUMENT_XML, extra_parts=None):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "sample.docx"
            output = root / "sample.md"
            evidence_path = root / "sample.evidence.json"
            build_docx(source, document_xml, extra_parts)
            command = [sys.executable, str(SCRIPT), str(source), "--output", str(output), "--table-format", table_format, "--stats-json"]
            if evidence:
                command.extend(["--evidence", str(evidence_path)])
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            evidence_json = json.loads(evidence_path.read_text()) if evidence else None
            return output.read_text(encoding="utf-8"), json.loads(result.stdout), evidence_json

    def test_legacy_convert_document_xml_function_stays_compatible(self):
        scripts_dir = SCRIPT.parent
        sys.path.insert(0, str(scripts_dir))
        try:
            spec = importlib.util.spec_from_file_location("docx_to_markdown_under_test", SCRIPT)
            module = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            markdown, stats = module.convert_document_xml(DOCUMENT_XML.encode("utf-8"), "html")
        finally:
            sys.modules.pop("docx_to_markdown_under_test", None)
            sys.path.remove(str(scripts_dir))
        self.assertEqual(markdown, EXPECTED_HTML)
        self.assertEqual(stats["tables"], 1)

    def test_html_mode_preserves_order_breaks_and_table_structure(self):
        markdown, stats, _ = self.run_converter("html")
        self.assertEqual(markdown, EXPECTED_HTML)
        self.assertEqual(stats["tables"], 1)
        self.assertEqual(stats["nonempty_text_nodes"], 9)

    def test_tsv_mode_preserves_table_text_and_reports_hashes(self):
        markdown, stats, _ = self.run_converter("tsv")
        self.assertEqual(markdown, EXPECTED_TSV)
        self.assertEqual(len(stats["source_git_blob_sha"]), 40)
        self.assertEqual(len(stats["output_sha256"]), 64)
        self.assertEqual(stats["table_format"], "tsv")

    def test_expected_source_hash_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "sample.docx"
            build_docx(source)
            result = subprocess.run([sys.executable, str(SCRIPT), str(source), "--expected-git-blob-sha", "0" * 40], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("source Git blob SHA mismatch", result.stderr)

    def test_evidence_is_versioned_and_traces_blocks(self):
        _, stats, evidence = self.run_converter("html", evidence=True)
        self.assertEqual(evidence["semanticSchemaVersion"], "3")
        self.assertEqual(evidence["canonicalizationVersion"], "3")
        self.assertEqual(evidence["optionsHash"], stats["options_hash"])
        self.assertEqual(evidence["blocks"][0]["provenance"]["paragraph_index"], 0)
        table = next(block for block in evidence["blocks"] if block["kind"] == "table")
        self.assertEqual(table["rows"][0][0]["columnSpan"], 2)
        self.assertEqual(table["rows"][0][0]["provenance"]["cell_index"], 0)

    def test_evidence_is_byte_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "sample.docx"
            build_docx(source)
            outputs = []
            for index in range(2):
                evidence = root / f"evidence-{index}.json"
                subprocess.run([sys.executable, str(SCRIPT), str(source), "--evidence", str(evidence)], check=True, capture_output=True, text=True)
                outputs.append(evidence.read_bytes())
            self.assertEqual(outputs[0], outputs[1])

    def test_effective_style_inheritance_and_numbering_graph(self):
        parts = {
            "[Content_Types].xml": CONTENT_TYPES_XML,
            "_rels/.rels": ROOT_RELS_XML,
            "word/styles.xml": STYLES_XML,
            "word/numbering.xml": NUMBERING_XML,
        }
        markdown, stats, evidence = self.run_converter(evidence=True, document_xml=STYLE_NUMBERING_DOCUMENT_XML, extra_parts=parts)
        self.assertEqual(markdown, "## Custom Heading\n\n### Direct Heading\n\n- Bullet item\n  1. Nested item\n")
        self.assertEqual(stats["styles"], 3)
        self.assertEqual(stats["numbering_instances"], 1)
        self.assertEqual(stats["content_types"], 5)
        self.assertEqual(stats["relationships"], 1)
        self.assertIn("[Content_Types].xml", evidence["metadata"]["packageParts"])
        self.assertEqual(evidence["blocks"][0]["styleChain"], ["BaseOutline", "CustomSection"])
        self.assertEqual(evidence["blocks"][0]["headingLevel"], 2)
        self.assertEqual(evidence["blocks"][3]["list"]["start"], 3)
        self.assertEqual(evidence["blocks"][3]["list"]["number_format"], "lowerLetter")

    def test_sdt_hyperlink_field_revision_and_symbol_order(self):
        parts = {"word/_rels/document.xml.rels": RELATIONSHIPS_XML}
        markdown, stats, evidence = self.run_converter(evidence=True, document_xml=ORDER_DOCUMENT_XML, extra_parts=parts)
        self.assertEqual(markdown, "A\n\nB[Link](https://example.test/doc)ShownInserted‑C²\n\nD\n")
        self.assertNotIn("HiddenInstruction", markdown)
        self.assertNotIn("Deleted", markdown)
        self.assertEqual(stats["relationships"], 1)
        middle = evidence["blocks"][1]
        hyperlink = next(item for item in middle["inlines"] if item["kind"] == "hyperlink")
        self.assertEqual(hyperlink["target"], "https://example.test/doc")
        self.assertIn("DOCX_SYMBOL_PRESERVED", [item["code"] for item in evidence["diagnostics"]])

    def test_missing_hyperlink_relationship_keeps_label_and_diagnoses(self):
        markdown, _, evidence = self.run_converter(evidence=True, document_xml=MISSING_REL_DOCUMENT_XML)
        self.assertEqual(markdown, "Keep label\n")
        codes = [item["code"] for item in evidence["diagnostics"]]
        self.assertIn("DOCX_RELATIONSHIP_MISSING", codes)
        hyperlink = evidence["blocks"][0]["inlines"][0]
        self.assertIsNone(hyperlink["target"])

    def test_unresolved_style_is_not_invented(self):
        document = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="MissingStyle"/></w:pPr><w:r><w:t>Ordinary</w:t></w:r></w:p></w:body></w:document>"""
        markdown, _, evidence = self.run_converter(evidence=True, document_xml=document, extra_parts={"word/styles.xml": STYLES_XML})
        self.assertEqual(markdown, "Ordinary\n")
        self.assertNotIn("headingLevel", evidence["blocks"][0])
        self.assertIn("DOCX_STYLE_UNRESOLVED", [item["code"] for item in evidence["diagnostics"]])

    def test_logical_grid_combines_gridspan_and_vertical_merge(self):
        markdown, _, evidence = self.run_converter(evidence=True, document_xml=TABLE_GRID_DOCUMENT_XML)
        expected = '<table>\n  <tr>\n    <td colspan="2" rowspan="2">Merged12</td>\n    <td>R1C</td>\n  </tr>\n  <tr>\n    <td>R2C</td>\n  </tr>\n  <tr>\n    <td>A3</td>\n    <td></td>\n    <td>C3</td>\n  </tr>\n</table>\n'
        self.assertEqual(markdown, expected)
        table = evidence["blocks"][0]
        self.assertEqual(table["gridWidth"], 3)
        merged = table["rows"][0][0]
        self.assertEqual((merged["row"], merged["column"]), (0, 0))
        self.assertEqual((merged["rowSpan"], merged["columnSpan"]), (2, 2))
        self.assertEqual(len(merged["sourceProvenance"]), 2)
        self.assertEqual(table["rows"][1][0]["column"], 2)
        self.assertEqual(table["rows"][2][1]["column"], 1)

    def test_tsv_source_rows_preserve_empty_and_merge_positions(self):
        markdown, _, evidence = self.run_converter("tsv", evidence=True, document_xml=TABLE_GRID_DOCUMENT_XML)
        self.assertEqual(markdown, "Merged12\tR1C\n\tR2C\nA3\t\tC3\n")
        table = evidence["blocks"][0]
        continuation = table["sourceRows"][1][0]
        self.assertEqual(continuation["column"], 0)
        self.assertEqual(continuation["vMerge"], "continue")
        self.assertEqual(table["sourceRows"][2][1]["column"], 1)
        self.assertFalse(any(cell.get("omitted") for cell in table["sourceRows"][1]))

    def test_gridbefore_and_empty_cells_cannot_shift_values(self):
        markdown, _, evidence = self.run_converter("tsv", evidence=True, document_xml=OMITTED_GRID_DOCUMENT_XML)
        self.assertEqual(markdown, "\tB1\t\tD1\nA2\tB2\tC2\tD2\n")
        table = evidence["blocks"][0]
        self.assertEqual(table["gridWidth"], 4)
        self.assertTrue(table["rows"][0][0]["omitted"])
        self.assertEqual(table["sourceRowGrid"][0]["gridBefore"], 1)
        self.assertEqual(table["sourceRows"][0][0]["column"], 1)
        self.assertTrue(table["positionRows"][0][0]["omitted"])
        self.assertEqual(table["rows"][0][0]["column"], 0)
        self.assertEqual(table["rows"][0][1]["column"], 1)
        self.assertEqual(table["rows"][0][2]["column"], 2)
        self.assertEqual(table["rows"][0][3]["column"], 3)

    def test_orphan_vertical_merge_is_diagnosed_without_column_shift(self):
        markdown, _, evidence = self.run_converter(evidence=True, document_xml=ORPHAN_VMERGE_DOCUMENT_XML)
        self.assertIn("Orphan", markdown)
        self.assertIn("TABLE_VERTICAL_MERGE_ORPHAN", [item["code"] for item in evidence["diagnostics"]])
        table = evidence["blocks"][0]
        self.assertEqual(table["rows"][0][0]["column"], 0)
        self.assertEqual(table["rows"][0][1]["column"], 1)

    def test_zip_path_traversal_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "unsafe.docx"
            with zipfile.ZipFile(source, "w") as package:
                package.writestr("word/document.xml", DOCUMENT_XML)
                package.writestr("../escape.xml", "x")
            result = subprocess.run([sys.executable, str(SCRIPT), str(source)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("Unsafe DOCX part path", result.stderr)


if __name__ == "__main__":
    unittest.main()
