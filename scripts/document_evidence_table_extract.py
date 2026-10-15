"""Transport-neutral governed table discovery and explicit-page extraction."""
from __future__ import annotations

import hashlib

from document_evidence_observation import make_observation
from document_evidence_provider_conformance import make_provider_profile
from document_evidence_surface import canonical_hash, canonical_pdf_page_surface
from document_evidence_table import make_table_pass, reconcile_table_passes


class GovernedTableError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def discover_table_candidates(source_bytes, candidate_provider) -> dict:
    if candidate_provider is None:
        raise GovernedTableError(
            "TABLE_DISCOVERY_PROVIDER_REQUIRED",
            "table discovery requires an explicit provider adapter",
        )
    source_hash = _source_hash(source_bytes)
    candidates, diagnostics = candidate_provider(source_bytes)
    values = []
    for page in sorted(candidates):
        values.extend(
            _candidate_summary(source_hash, candidate, index)
            for index, candidate in enumerate(candidates[page])
        )
    return {
        "schema": "DocumentEvidenceTableDiscovery.v1",
        "sourceHash": source_hash,
        "candidates": values,
        "diagnostics": list(diagnostics),
    }


def extract_table_evidence(
    source_bytes,
    expected_source_hash,
    pages,
    page_provider,
    *,
    max_selected_pages=50,
) -> dict:
    actual_hash = _source_hash(source_bytes)
    _require_source_hash(expected_source_hash, actual_hash)
    selected = _explicit_pages(pages, max_selected_pages)
    _require_page_provider(page_provider)
    tables, diagnostics = _extract_selected_pages(
        source_bytes, actual_hash, selected, page_provider,
    )
    return {
        "schema": "DocumentEvidenceTableExtraction.v1",
        "sourceHash": actual_hash,
        "pages": list(selected),
        "tables": tables,
        "diagnostics": diagnostics,
    }


def _extract_selected_pages(source_bytes, source_hash, selected, page_provider):
    tables, diagnostics = [], []
    for page_number in selected:
        page = page_provider(source_bytes, page_number)
        _validate_page_record(page, page_number)
        diagnostics.extend(page.get("diagnostics", ()))
        surface = canonical_pdf_page_surface(
            source_hash, page_number, page["width"], page["height"],
        )
        tables.extend(
            _candidate_evidence(
                source_hash, surface, candidate, index, page.get("providerVersions", {}),
            )
            for index, candidate in enumerate(page.get("candidates", ()))
        )
    return tables, diagnostics


def _require_source_hash(expected, actual):
    if expected != actual:
        raise GovernedTableError(
            "EVIDENCE_SOURCE_HASH_MISMATCH",
            "provided source hash does not match source bytes",
        )


def _require_page_provider(page_provider):
    if page_provider is None:
        raise GovernedTableError(
            "TABLE_PAGE_PROVIDER_REQUIRED",
            "governed extraction requires an explicit page provider adapter",
        )


def _candidate_evidence(source_hash, surface, candidate, index, provider_versions):
    candidate_id = _candidate_id(source_hash, candidate, index)
    observations, cells = [], []
    provider_version = provider_versions.get("pdfplumber", "unknown")
    profile = _native_provider_profile(provider_version, candidate.strategy)
    for row_index, row in enumerate(candidate.rows):
        _append_row_evidence(
            observations, cells, source_hash, surface, candidate, row,
            row_index, provider_version, profile,
        )
    table_pass = make_table_pass(
        candidate_id, f"native:{candidate.strategy}", surface, cells,
    )
    observation_index = {item["observationHash"]: item for item in observations}
    decisions = reconcile_table_passes((table_pass,), observation_index)
    return {
        "candidate": _candidate_summary(source_hash, candidate, index),
        "providerProfile": profile,
        "observations": observations,
        "tablePass": table_pass,
        "cellDecisions": list(decisions),
    }


def _native_provider_profile(provider_version, strategy):
    return make_provider_profile(
        "native-text", "pdfplumber-table", provider_version,
        determinism={
            "semantic": "profile-bound",
            "artifact": "not-applicable",
            "bitwiseRaster": "not-applicable",
        },
        options={"strategy": strategy},
    )


def _append_row_evidence(
    observations, cells, source_hash, surface, candidate, row,
    row_index, provider_version, profile,
):
    for column_index, bbox in enumerate(row.cells):
        if bbox is None:
            continue
        text = row.texts[column_index] if column_index < len(row.texts) else ""
        geometry = _bbox_quad(bbox)
        observation = make_observation(
            "native-text", source_hash, surface, "pdfplumber-table",
            provider_version, text, geometry, provider_profile=profile,
            extensions={
                "strategy": candidate.strategy,
                "candidateConfidence": candidate.confidence,
            },
        )
        observations.append(observation)
        cells.append({
            "rowIndex": row_index,
            "columnIndex": column_index,
            "geometry": geometry,
            "observations": [observation],
        })


def _candidate_summary(source_hash, candidate, index=0):
    return {
        "candidateId": _candidate_id(source_hash, candidate, index),
        "page": candidate.page,
        "strategy": candidate.strategy,
        "bbox": list(candidate.bbox),
        "rowCount": candidate.row_count,
        "columnCount": candidate.column_count,
        "confidence": candidate.confidence,
        "reasons": list(candidate.reasons),
    }


def _candidate_id(source_hash, candidate, index):
    identity = {
        "sourceHash": source_hash,
        "page": candidate.page,
        "index": index,
        "strategy": candidate.strategy,
        "bbox": list(candidate.bbox),
        "rowCount": candidate.row_count,
        "columnCount": candidate.column_count,
    }
    return f"table-candidate:{canonical_hash(identity)[7:31]}"


def _explicit_pages(pages, limit):
    values = tuple(pages or ())
    if not values:
        raise GovernedTableError(
            "TABLE_EXPLICIT_PAGES_REQUIRED",
            "governed extraction requires explicit pages",
        )
    if len(values) > limit:
        raise GovernedTableError(
            "TABLE_PAGE_LIMIT_EXCEEDED",
            f"requested {len(values)} pages; limit is {limit}",
        )
    invalid = any(
        isinstance(value, bool) or not isinstance(value, int) or value < 1
        for value in values
    )
    if invalid:
        raise GovernedTableError(
            "TABLE_PAGE_SELECTION_INVALID",
            "pages must be positive 1-based integers",
        )
    if len(set(values)) != len(values):
        raise GovernedTableError(
            "TABLE_PAGE_SELECTION_DUPLICATE",
            "pages must not contain duplicates",
        )
    return tuple(sorted(values))


def _validate_page_record(page, expected_page):
    if page.get("page") != expected_page:
        raise GovernedTableError(
            "TABLE_PAGE_PROVIDER_MISMATCH",
            "page provider returned a different source page",
        )
    if page.get("width", 0) <= 0 or page.get("height", 0) <= 0:
        raise GovernedTableError(
            "TABLE_PAGE_GEOMETRY_INVALID",
            "page provider returned invalid dimensions",
        )


def _source_hash(source_bytes):
    return f"sha256:{hashlib.sha256(source_bytes).hexdigest()}"


def _bbox_quad(bbox):
    x0, top, x1, bottom = (float(value) for value in bbox)
    return {
        "type": "Quad",
        "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]],
    }
