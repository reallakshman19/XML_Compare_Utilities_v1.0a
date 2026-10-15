import sys
import types
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from document_to_markdown import _input_kind, run_cli


class DocumentDispatchTest(unittest.TestCase):
    def tearDown(self):
        sys.modules.pop("docx_conversion", None)
        sys.modules.pop("pdf_engineering_conversion", None)

    def test_input_kind_is_case_insensitive(self):
        self.assertEqual(_input_kind(["REPORT.PDF"]), "pdf")
        self.assertEqual(_input_kind(["file.DoCx"]), "docx")

    def test_docx_dispatch_preserves_source_specific_argv(self):
        module = types.ModuleType("docx_conversion")
        module.run_cli = lambda argv: 11 if argv == ["x.docx", "--table-mode", "auto"] else 99
        sys.modules["docx_conversion"] = module
        self.assertEqual(run_cli(["x.docx", "--table-mode", "auto"]), 11)

    def test_pdf_dispatch_preserves_source_specific_argv(self):
        module = types.ModuleType("pdf_engineering_conversion")
        expected = ["x.pdf", "--ocr", "auto", "--images", "extract", "--engineering-regions", "auto"]
        module.run_cli = lambda argv: 12 if argv == expected else 99
        sys.modules["pdf_engineering_conversion"] = module
        self.assertEqual(run_cli(expected), 12)

    def test_unknown_input_fails_closed(self):
        with self.assertRaises(ValueError):
            run_cli(["x.txt"])


if __name__ == "__main__":
    unittest.main()
