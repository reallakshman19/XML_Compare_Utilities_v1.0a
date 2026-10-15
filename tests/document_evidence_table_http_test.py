import hashlib
import unittest
from types import SimpleNamespace

from document_evidence_table_http import (
    discover_tables_request,
    extract_tables_request,
    table_api_capabilities,
)

SOURCE = b"pdf-fixture"
SOURCE_HASH = "sha256:" + hashlib.sha256(SOURCE).hexdigest()
CONFIG = SimpleNamespace(
    max_source_pages=2000,
    max_range_pages=50,
    search_ocr_max_job_pixels=250_000_000,
    search_ocr_timeout_seconds=60.0,
)


def loader(request, config):
    return SOURCE, {"logicalPath": request["sourcePath"], "type": "pdf", "sizeBytes": len(SOURCE)}


def empty_page(source_bytes, page):
    return {"page": page, "width": 100, "height": 100, "providerVersions": {}, "candidates": (), "diagnostics": ()}


class TableHttpAdapterTest(unittest.TestCase):
    def test_capabilities_declare_bounded_ocr(self):
        value = table_api_capabilities()["documentEvidenceTables"]
        self.assertEqual(value["governedExtractionRequires"], ["sourceHash", "pages"])
        self.assertEqual(value["ocr"], ["never", "always"])
        self.assertEqual(value["ocrAttemptsPerPage"], 1)
        self.assertLessEqual(value["ocrMaxPagePixels"], 24_000_000)

    def test_discovery_remains_advisory_with_source_identity(self):
        result = discover_tables_request(
            {"sourcePath": "fixture.pdf"}, CONFIG,
            source_loader=loader, candidate_provider=lambda _: ({}, ()),
        )
        self.assertEqual(result["schema"], "DocumentEvidenceTableDiscovery.v1")
        self.assertNotIn("tables", result)
        self.assertEqual(result["source"]["schema"], "SourceIdentity.v1")
        self.assertEqual(result["source"]["sha256"], SOURCE_HASH)
        self.assertEqual(result["source"]["mediaType"], "application/pdf")
        self.assertEqual(result["source"]["logicalPath"], "fixture.pdf")

    def test_ocr_always_is_one_bounded_pass_per_selected_page(self):
        calls = []
        def ocr_runner(source_bytes, page, language, max_pixels, max_output, timeout):
            calls.append((page, language, max_pixels, max_output, timeout))
            return SimpleNamespace(words=())
        result = extract_tables_request(
            {
                "sourcePath": "fixture.pdf", "sourceHash": SOURCE_HASH,
                "pages": [2, 7], "options": {"ocr": "always", "ocrLanguage": "eng"},
            },
            CONFIG,
            source_loader=loader,
            page_provider=empty_page,
            ocr_runner=ocr_runner,
        )
        self.assertEqual([item[0] for item in calls], [2, 7])
        self.assertTrue(all(item[1] == "eng" for item in calls))
        self.assertTrue(all(item[2] <= 24_000_000 for item in calls))
        self.assertTrue(all(item[3] <= 64 * 1024 * 1024 for item in calls))
        self.assertTrue(all(item[4] <= 30.0 for item in calls))
        self.assertEqual(result["source"]["sha256"], SOURCE_HASH)
        self.assertEqual(result["options"], {"ocr": "always", "ocrLanguage": "eng"})

    def test_source_metadata_mismatch_fails_closed(self):
        def bad_loader(request, config):
            return SOURCE, {"logicalPath": request["sourcePath"], "sizeBytes": len(SOURCE) + 1}
        with self.assertRaises(ValueError) as caught:
            discover_tables_request(
                {"sourcePath": "fixture.pdf"}, CONFIG,
                source_loader=bad_loader, candidate_provider=lambda _: ({}, ()),
            )
        self.assertIn("source metadata size", str(caught.exception))

    def test_unknown_ocr_mode_fails_closed(self):
        with self.assertRaises(ValueError):
            extract_tables_request(
                {
                    "sourcePath": "fixture.pdf", "sourceHash": SOURCE_HASH,
                    "pages": [1], "options": {"ocr": "enhanced"},
                },
                CONFIG,
                source_loader=loader,
                page_provider=empty_page,
            )


if __name__ == "__main__":
    unittest.main()
