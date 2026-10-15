import hashlib
import unittest
from types import SimpleNamespace

from document_evidence_bundle import EvidenceBundleError, cache_identity
from document_evidence_ocr_table_assignment import assign_ocr_words_to_cells
from document_evidence_ocr_table_provider import (
    make_ocr_table_pass,
    reconcile_table_evidence_passes,
)
from document_evidence_pdf_ocr_provider import adapt_ocr_page
from document_evidence_surface import canonical_hash, canonical_json_bytes
from document_evidence_table_extract import extract_table_evidence

SOURCE = "sha256:" + "e" * 64
GEO = {"type": "Quad", "coordinates": [[10, 20], [70, 20], [70, 40], [10, 40]]}


def ocr_result(words, png=b"png"):
    raster = SimpleNamespace(
        page=1, png_bytes=png, page_width=100.0, page_height=100.0,
        raster_width=200, raster_height=200, scale=2.0,
    )
    values = tuple(
        SimpleNamespace(
            text=text, bbox=bbox, confidence=confidence, block_num=1,
            par_num=1, line_num=1, word_num=index + 1,
        )
        for index, (text, bbox, confidence) in enumerate(words)
    )
    return SimpleNamespace(
        raster=raster, words=values, engine_version="tesseract-5",
        rasterizer_version="pdfium-1",
    )


class DocumentEvidenceReviewRegressionsTest(unittest.TestCase):
    def test_rfc8785_example_and_number_thresholds(self):
        value = {
            "numbers": [333333333.33333329, 1e30, 4.50, 2e-3, 1e-27],
            "string": "€$\x0f\nA'B\"\\\"/",
            "literals": [None, True, False],
        }
        expected = b'{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"\xe2\x82\xac$\\u000f\\nA\'B\\\"\\\\\\\"/"}'
        self.assertEqual(canonical_json_bytes(value), expected)
        self.assertEqual(
            canonical_json_bytes([1e-6, 1e-7, 1e20, 1e21, -0.0]),
            b"[0.000001,1e-7,100000000000000000000,1e+21,0]",
        )

    def test_rfc8785_large_ieee754_integer_samples(self):
        self.assertEqual(canonical_json_bytes(9_007_199_254_740_992), b"9007199254740992")
        self.assertEqual(
            canonical_json_bytes(295_147_905_179_352_830_000),
            b"295147905179352830000",
        )
        self.assertEqual(canonical_json_bytes(10**30), b"1e+30")

    def test_utf16_sort_and_schema_domain_hash(self):
        value = {"\ue000": 2, "😀": 1}
        self.assertEqual(canonical_json_bytes(value), '{"😀":1,"\ue000":2}'.encode())
        typed = {"schema": "Example.v1", "value": 1}
        expected = hashlib.sha256(b"Example.v1\0" + canonical_json_bytes(typed)).hexdigest()
        self.assertEqual(canonical_hash(typed), "sha256:" + expected)

    def test_jcs_rejects_nonfinite_or_unrepresentable_numbers(self):
        for value in (float("nan"), float("inf"), 10**400):
            with self.assertRaises(ValueError):
                canonical_json_bytes(value)

    def test_pass_id_is_bound_to_provider_profile(self):
        result = ocr_result((("10", (10, 20, 30, 40), 0.8),))
        first = adapt_ocr_page(SOURCE, result, pass_id="ocr:A")
        second = adapt_ocr_page(SOURCE, result, pass_id="ocr:B")
        self.assertNotEqual(first["providerProfile"]["profileHash"], second["providerProfile"]["profileHash"])
        self.assertNotEqual(first["observations"][0]["observationHash"], second["observations"][0]["observationHash"])
        self.assertEqual(first["observations"][0]["providerProfileHash"], first["providerProfile"]["profileHash"])

    def test_multiword_cell_is_one_reconstructed_observation(self):
        result = ocr_result((
            ("10.0", (10, 20, 35, 40), 0.9),
            ("MPa", (40, 20, 70, 40), 0.9),
        ))
        cell = {"rowIndex": 0, "columnIndex": 0, "geometry": GEO, "wordIndexes": [0, 1]}
        bundle = make_ocr_table_pass(SOURCE, result, "table-1", [cell], pass_id="ocr:A")
        self.assertEqual(len(bundle["ocrEvidence"]["observations"]), 2)
        self.assertEqual(len(bundle["cellObservations"]), 1)
        self.assertEqual(bundle["cellObservations"][0]["normalizedText"], "10.0 MPa")
        decision = reconcile_table_evidence_passes([bundle], required_pass_ids=("ocr:A",))[0]
        self.assertEqual(decision["state"], "accepted")
        self.assertEqual(decision["effectiveText"], "10.0 MPa")

    def test_numeric_disagreement_still_fails_closed(self):
        cell = {"rowIndex": 0, "columnIndex": 0, "geometry": GEO, "wordIndexes": [0]}
        first = make_ocr_table_pass(
            SOURCE, ocr_result((("10.0", (10, 20, 30, 40), 0.88),), b"a"),
            "table-1", [cell], pass_id="ocr:A",
        )
        second = make_ocr_table_pass(
            SOURCE, ocr_result((("100", (10, 20, 30, 40), 0.97),), b"b"),
            "table-1", [cell], pass_id="ocr:B",
        )
        decision = reconcile_table_evidence_passes(
            [first, second], required_pass_ids=("ocr:A", "ocr:B"),
        )[0]
        self.assertEqual(decision["state"], "review_required")
        self.assertEqual(decision["diagnosticCodes"], ["OCR_NUMERIC_DISAGREEMENT"])
        self.assertNotIn("effectiveNumericValue", decision)

    def test_skewed_polygon_uses_polygon_not_bounding_box(self):
        polygon = {"type": "Quad", "coordinates": [[0, 10], [10, 0], [20, 10], [10, 20]]}
        table_pass = {"cells": [{"cellId": "diamond", "rowIndex": 0, "columnIndex": 0, "geometry": polygon}]}
        outside = SimpleNamespace(text="OUT", bbox=(0, 0, 2, 2))
        inside = SimpleNamespace(text="IN", bbox=(9, 9, 11, 11))
        assigned = assign_ocr_words_to_cells(table_pass, (outside, inside))
        self.assertEqual(assigned["cells"][0]["wordIndexes"], [1])

    def test_shared_polygon_boundary_stays_ambiguous(self):
        left = {"cellId": "left", "rowIndex": 0, "columnIndex": 0, "geometry": {"type": "Quad", "coordinates": [[0, 0], [50, 0], [50, 20], [0, 20]]}}
        right = {"cellId": "right", "rowIndex": 0, "columnIndex": 1, "geometry": {"type": "Quad", "coordinates": [[50, 0], [100, 0], [100, 20], [50, 20]]}}
        word = SimpleNamespace(text="X", bbox=(49, 5, 51, 15))
        result = assign_ocr_words_to_cells({"cells": [left, right]}, (word,))
        self.assertEqual(result["cells"], [])
        self.assertEqual(result["diagnostics"][0]["matchingCellIds"], ["left", "right"])

    def test_cache_identity_separates_operation_selection_options(self):
        with self.assertRaises(EvidenceBundleError):
            cache_identity(SOURCE, operation="", selection={}, canonical_options={})
        keys = {
            cache_identity(SOURCE, operation="table-extract", selection={"pages": [3]}, canonical_options={"ocr": "never"}),
            cache_identity(SOURCE, operation="table-extract", selection={"pages": [30]}, canonical_options={"ocr": "never"}),
            cache_identity(SOURCE, operation="search", selection={"pages": [3]}, canonical_options={"ocr": "never"}),
            cache_identity(SOURCE, operation="table-extract", selection={"pages": [3]}, canonical_options={"ocr": "always"}),
        }
        self.assertEqual(len(keys), 4)

    def test_native_table_provider_profile_is_normative(self):
        class Row:
            cells = ((10, 10, 50, 30),)
            texts = ("10",)

        class Candidate:
            page = 1
            strategy = "ruled"
            bbox = (10, 10, 50, 30)
            rows = (Row(),)
            confidence = 0.9
            reasons = ("fixture",)
            row_count = 1
            column_count = 1

        source = b"pdf"
        source_hash = "sha256:" + hashlib.sha256(source).hexdigest()

        def page_provider(_, page):
            return {
                "page": page, "width": 100, "height": 100,
                "providerVersions": {"pdfplumber": "1"},
                "candidates": (Candidate(),), "diagnostics": (),
            }

        output = extract_table_evidence(source, source_hash, [1], page_provider)
        profile = output["tables"][0]["providerProfile"]
        self.assertEqual(profile["schema"], "ProviderProfile.v1")
        self.assertEqual(output["tables"][0]["observations"][0]["providerProfileHash"], profile["profileHash"])


if __name__ == "__main__":
    unittest.main()
