"""Adapters from existing PDF table/page backends into governed evidence providers."""
from __future__ import annotations


def make_pdf_table_candidate_provider(
    *, max_source_pages=2000, table_backend=None, reconciler=None,
):
    backend = table_backend or _default_table_backend()
    reconcile = reconciler or _default_reconciler()

    def provider(source_bytes):
        raw = backend.extract(source_bytes, max_pages=max_source_pages)
        accepted, diagnostics = {}, []
        for page_number in sorted(raw):
            result = reconcile(raw[page_number])
            accepted[page_number] = tuple(result.accepted)
            diagnostics.extend(result.diagnostics)
        return accepted, tuple(diagnostics)

    return provider


def make_pdf_table_page_provider(
    *, max_source_pages=2000, range_backend_factory=None, reconciler=None,
):
    factory = range_backend_factory or _default_range_backend_factory()
    reconcile = reconciler or _default_reconciler()

    def provider(source_bytes, page_number):
        backends = factory(page_number, max_source_pages)
        native = backends.native.extract(source_bytes, max_pages=1)
        raw = backends.table.extract(source_bytes, max_pages=1)
        result = reconcile(raw.get(page_number, ()))
        page = native.pages[0]
        if page.signals.page != page_number:
            raise ValueError("range backend returned a different source page")
        return {
            "page": page_number,
            "width": page.signals.width,
            "height": page.signals.height,
            "providerVersions": native.backend_versions,
            "candidates": tuple(result.accepted),
            "diagnostics": tuple(result.diagnostics),
        }

    return provider


def _default_table_backend():
    from pdf_tables import PdfPlumberTableBackend
    return PdfPlumberTableBackend()


def _default_reconciler():
    from pdf_tables import reconcile_page_tables
    return reconcile_page_tables


def _default_range_backend_factory():
    from pdf_page_range import PageRange, make_page_range_backends

    def factory(page_number, max_source_pages):
        return make_page_range_backends(
            PageRange(page_number, page_number),
            max_source_pages=max_source_pages,
        )

    return factory
