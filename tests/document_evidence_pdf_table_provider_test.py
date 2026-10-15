import unittest
from dataclasses import dataclass
from types import SimpleNamespace

from document_evidence_pdf_table_provider import (
    make_pdf_table_candidate_provider,
    make_pdf_table_page_provider,
)


@dataclass(frozen=True)
class Reconciled:
    accepted: tuple
    diagnostics: tuple


class TableBackend:
    def __init__(self):
        self.calls = []

    def extract(self, source_bytes, *, max_pages):
        self.calls.append((source_bytes, max_pages))
        return {2: ("raw-a",), 5: ("raw-b",)}


class RangeLeaf:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def extract(self, source_bytes, *, max_pages):
        self.calls.append((source_bytes, max_pages))
        return self.result


class PdfTableProviderAdapterTest(unittest.TestCase):
    def test_discovery_adapter_reuses_backend_and_reconciler(self):
        backend = TableBackend()
        provider = make_pdf_table_candidate_provider(
            max_source_pages=77,
            table_backend=backend,
            reconciler=lambda raw: Reconciled((f"accepted:{raw[0]}",), (f"diag:{raw[0]}",)),
        )
        candidates, diagnostics = provider(b"pdf")
        self.assertEqual(backend.calls, [(b"pdf", 77)])
        self.assertEqual(candidates, {2: ("accepted:raw-a",), 5: ("accepted:raw-b",)})
        self.assertEqual(diagnostics, ("diag:raw-a", "diag:raw-b"))

    def test_page_adapter_requests_only_exact_source_page(self):
        page = SimpleNamespace(
            signals=SimpleNamespace(page=5, width=612.0, height=792.0),
        )
        native = RangeLeaf(SimpleNamespace(pages=(page,), backend_versions={"pdfplumber": "fixture"}))
        table = RangeLeaf({5: ("raw-table",)})
        factory_calls = []

        def factory(page_number, max_source_pages):
            factory_calls.append((page_number, max_source_pages))
            return SimpleNamespace(native=native, table=table)

        provider = make_pdf_table_page_provider(
            max_source_pages=88,
            range_backend_factory=factory,
            reconciler=lambda raw: Reconciled((f"accepted:{raw[0]}",), ()),
        )
        result = provider(b"pdf", 5)
        self.assertEqual(factory_calls, [(5, 88)])
        self.assertEqual(native.calls, [(b"pdf", 1)])
        self.assertEqual(table.calls, [(b"pdf", 1)])
        self.assertEqual(result["page"], 5)
        self.assertEqual(result["candidates"], ("accepted:raw-table",))


if __name__ == "__main__":
    unittest.main()
