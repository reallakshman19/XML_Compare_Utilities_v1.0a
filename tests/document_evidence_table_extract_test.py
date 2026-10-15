import hashlib
import unittest
from dataclasses import dataclass

from document_evidence_table_extract import (
    GovernedTableError,
    discover_table_candidates,
    extract_table_evidence,
)


@dataclass(frozen=True)
class Row:
    cells: tuple
    texts: tuple


@dataclass(frozen=True)
class Candidate:
    page: int
    strategy: str
    bbox: tuple
    rows: tuple
    confidence: float
    reasons: tuple

    @property
    def row_count(self):
        return len(self.rows)

    @property
    def column_count(self):
        return max(len(row.cells) for row in self.rows)


SOURCE = b"controlled-pdf-fixture"
SOURCE_HASH = "sha256:" + hashlib.sha256(SOURCE).hexdigest()
CANDIDATE = Candidate(
    3,
    "ruled",
    (10.0, 10.0, 90.0, 50.0),
    (
        Row(((10, 10, 50, 30), (50, 10, 90, 30)), ("10.0", "20")),
        Row(((10, 30, 50, 50), (50, 30, 90, 50)), ("30", "40")),
    ),
    0.95,
    ("fixture",),
)


def page_provider(source_bytes, page_number):
    return {
        "page": page_number,
        "width": 100.0,
        "height": 100.0,
        "providerVersions": {"pdfplumber": "fixture-1"},
        "candidates": (CANDIDATE,) if page_number == 3 else (),
        "diagnostics": (),
    }


class GovernedTableExtractionTest(unittest.TestCase):
    def test_discovery_returns_candidates_without_authorizing_extraction(self):
        result = discover_table_candidates(
            SOURCE,
            lambda _: ({3: (CANDIDATE,)}, ()),
        )
        self.assertEqual(result["sourceHash"], SOURCE_HASH)
        self.assertEqual(result["candidates"][0]["page"], 3)
        self.assertNotIn("tables", result)

    def test_wrong_source_hash_fails_before_provider(self):
        called = []
        with self.assertRaises(GovernedTableError) as caught:
            extract_table_evidence(
                SOURCE,
                "sha256:" + "0" * 64,
                [3],
                lambda *_: called.append(True),
            )
        self.assertEqual(caught.exception.code, "EVIDENCE_SOURCE_HASH_MISMATCH")
        self.assertEqual(called, [])

    def test_explicit_pages_are_required(self):
        with self.assertRaises(GovernedTableError) as caught:
            extract_table_evidence(SOURCE, SOURCE_HASH, [], page_provider)
        self.assertEqual(caught.exception.code, "TABLE_EXPLICIT_PAGES_REQUIRED")

    def test_page_provider_must_return_exact_requested_page(self):
        with self.assertRaises(GovernedTableError) as caught:
            extract_table_evidence(
                SOURCE,
                SOURCE_HASH,
                [3],
                lambda *_: {"page": 4, "width": 100, "height": 100},
            )
        self.assertEqual(caught.exception.code, "TABLE_PAGE_PROVIDER_MISMATCH")

    def test_explicit_page_produces_bound_table_evidence(self):
        result = extract_table_evidence(SOURCE, SOURCE_HASH, [3], page_provider)
        self.assertEqual(result["pages"], [3])
        table = result["tables"][0]
        self.assertEqual(table["tablePass"]["sourceHash"], SOURCE_HASH)
        self.assertEqual(len(table["observations"]), 4)
        self.assertTrue(all(item["state"] == "accepted" for item in table["cellDecisions"]))
        self.assertTrue(all(item["sourceHash"] == SOURCE_HASH for item in table["observations"]))


if __name__ == "__main__":
    unittest.main()
