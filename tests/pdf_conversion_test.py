import json
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pdf_conversion import conversion_evidence, convert_pdf_bytes, parse_pdf_bytes
from pdf_native import NativeChar, PageExtraction, PageSignals, PdfBackendResult


def chars_for(text, x, top, size=10, font="Helvetica"):
    values = []
    cursor = x
    for value in text:
        width = 3 if value == " " else 6
        values.append(NativeChar(value, (cursor, top, cursor + width, top + size), font, size))
        cursor += width
    return values


class Backend:
    def extract(self, data, **kwargs):
        values = []
        values += chars_for("Engineering Report", 50, 40, 18, "Helvetica-Bold")
        values += chars_for("Body paragraph contains technical value 3.15.", 50, 90)
        page = PageExtraction(
            PageSignals(1, 600, 800, len(values), len(values), 0, 0, 0, 0, 0.0, 0.0),
            tuple(values),
        )
        return PdfBackendResult((page,), {"Title": "Fixture"}, {"pdfplumber": "test", "pdfminer.six": "test"})


class PdfConversionTest(unittest.TestCase):
    def test_semantic_pdf_provenance_and_positioned_spans(self):
        document, stats = parse_pdf_bytes(b"pdf", backend=Backend())
        self.assertEqual(document.source_type, "pdf")
        self.assertEqual(document.blocks[0].provenance.page, 1)
        self.assertEqual(document.blocks[0].provenance.extraction, "embedded-text")
        self.assertTrue(document.blocks[0].positioned_spans)
        self.assertEqual(stats["pages"], 1)

    def test_pdf_markdown_and_evidence_are_deterministic(self):
        first, first_stats = convert_pdf_bytes(b"pdf", backend=Backend())
        second, second_stats = convert_pdf_bytes(b"pdf", backend=Backend())
        self.assertEqual(first, second)
        self.assertEqual(first_stats["output_sha256"], second_stats["output_sha256"])
        self.assertIn(b"# Engineering Report", first)
        evidence = conversion_evidence(b"pdf", backend=Backend())
        block = evidence["blocks"][0]
        self.assertEqual(block["provenance"]["source_type"], "pdf")
        self.assertEqual(block["provenance"]["page"], 1)
        self.assertTrue(block["positionedSpans"])
        self.assertEqual(evidence["metadata"]["coordinateSystem"], "top-left-points")

    def test_backend_versions_are_canonical_evidence_metadata(self):
        evidence = conversion_evidence(b"pdf", backend=Backend())
        self.assertEqual(evidence["metadata"]["backendVersions"]["pdfplumber"], "test")
        json.dumps(evidence, sort_keys=True)

    def test_backend_versions_participate_in_options_identity(self):
        first = conversion_evidence(b"pdf", backend=Backend())

        class OtherBackend(Backend):
            def extract(self, data, **kwargs):
                result = super().extract(data, **kwargs)
                return result.__class__(result.pages, result.metadata, {"pdfplumber": "other", "pdfminer.six": "test"})

        second = conversion_evidence(b"pdf", backend=OtherBackend())
        self.assertNotEqual(first["optionsHash"], second["optionsHash"])


if __name__ == "__main__":
    unittest.main()
