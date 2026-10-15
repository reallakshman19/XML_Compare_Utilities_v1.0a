from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "web" / "document-conversion"


class DocumentConversionUiStaticTest(unittest.TestCase):
    def test_ui_assets_exist_and_javascript_stays_below_repo_limit(self):
        expected = {
            "index.html",
            "styles.css",
            "app.js",
            "api-client.js",
            "ui-render.js",
        }
        self.assertEqual({path.name for path in UI.iterdir() if path.is_file()}, expected)
        for name in ("app.js", "api-client.js", "ui-render.js"):
            lines = (UI / name).read_text(encoding="utf-8").splitlines()
            self.assertLess(len(lines), 300, f"{name} must stay below 300 physical lines")

    def test_ui_is_same_origin_and_wires_search_then_convert(self):
        client = (UI / "api-client.js").read_text(encoding="utf-8")
        app = (UI / "app.js").read_text(encoding="utf-8")
        self.assertIn("'/v1/search'", client)
        self.assertIn("'/v1/convert'", client)
        self.assertIn("await searchPdf(payload)", app)
        self.assertIn("await convertDocument(payload)", app)
        self.assertIn("selectedPages", app)
        self.assertIn("pages: { start, end }", app)
        self.assertNotRegex(client, r"https?://")

    def test_extracted_text_is_rendered_without_html_injection(self):
        renderer = (UI / "ui-render.js").read_text(encoding="utf-8")
        html = (UI / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("innerHTML", renderer)
        self.assertIn("document.createTextNode", renderer)
        self.assertIn('type="module" src="./app.js"', html)
        self.assertNotRegex(html, r"<script(?![^>]+src=)[^>]*>")

    def test_ui_exposes_ocr_provenance_and_explicit_page_authority(self):
        renderer = (UI / "ui-render.js").read_text(encoding="utf-8")
        html = (UI / "index.html").read_text(encoding="utf-8")
        app = (UI / "app.js").read_text(encoding="utf-8")
        self.assertIn("match.extraction === 'ocr'", renderer)
        self.assertIn("match.confidence", renderer)
        self.assertIn('id="page-start"', html)
        self.assertIn('id="page-end"', html)
        self.assertIn('id="search-ocr"', html)
        self.assertIn('id="pdf-password"', html)
        self.assertIn("withPassword(payload)", app)

    def test_ui_has_no_remote_assets(self):
        for path in UI.iterdir():
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            urls = re.findall(r"https?://[^\s\"')>]+", text)
            self.assertEqual(urls, [], f"remote asset/reference found in {path.name}: {urls}")


if __name__ == "__main__":
    unittest.main()
