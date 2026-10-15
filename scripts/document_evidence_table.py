"""Exact per-pass table-cell alignment before evidence reconciliation."""
from __future__ import annotations

from document_evidence_decision import make_decision, reconcile_cell
from document_evidence_surface import canonical_hash


class TableEvidenceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_table_pass(table_candidate_id, pass_id, surface, cells) -> dict:
    _validate_page_surface(surface)
    normalized = []
    seen = set()
    for cell in cells:
        key = _cell_key(cell)
        if key in seen:
            raise TableEvidenceError("TABLE_CELL_DUPLICATE", f"duplicate cell at row {key[0]}, column {key[1]}")
        seen.add(key)
        normalized.append(_make_cell(table_candidate_id, pass_id, cell))
    identity = {
        "schema": "TablePass.v1", "tableCandidateId": table_candidate_id,
        "passId": pass_id, "sourceHash": surface["sourceHash"],
        "surfaceId": surface["surfaceId"], "surfaceHash": surface["surfaceHash"],
        "cells": sorted(normalized, key=lambda item: (item["rowIndex"], item["columnIndex"])),
    }
    table_hash = canonical_hash(identity)
    return {**identity, "tablePassId": f"table-pass:{pass_id}:{table_hash[7:31]}", "tablePassHash": table_hash}


def reconcile_table_passes(table_passes, observation_index, *, required_pass_ids=None) -> tuple[dict, ...]:
    passes = tuple(table_passes)
    _validate_pass_set(passes)
    required = set(required_pass_ids or (item["passId"] for item in passes))
    indexed = {item["passId"]: _cells_by_key(item) for item in passes}
    keys = sorted({key for cells in indexed.values() for key in cells})
    return tuple(_reconcile_key(key, indexed, observation_index, required) for key in keys)


def _reconcile_key(key, indexed, observation_index, required):
    missing = sorted(pass_id for pass_id in required if key not in indexed.get(pass_id, {}))
    logical_id = f"cell:r{key[0]}:c{key[1]}"
    present = [cells[key] for cells in indexed.values() if key in cells]
    observations = [observation_index[hash_] for cell in present for hash_ in cell["observationHashes"]]
    if missing:
        return make_decision(
            "review_required", observations, diagnostics=("TABLE_CELL_PASS_MISSING",),
            notes={"logicalCellId": logical_id, "missingPassIds": missing},
        )
    return reconcile_cell(observations, logical_cell_id=logical_id)


def _make_cell(table_candidate_id, pass_id, cell):
    key = _cell_key(cell)
    observations = tuple(cell.get("observations") or ())
    if not observations:
        raise TableEvidenceError("TABLE_CELL_OBSERVATION_REQUIRED", "table cell requires at least one observation")
    identity = {
        "tableCandidateId": table_candidate_id, "passId": pass_id,
        "rowIndex": key[0], "columnIndex": key[1], "geometry": cell["geometry"],
        "observationHashes": sorted(item["observationHash"] for item in observations),
    }
    cell_hash = canonical_hash(identity)
    return {**identity, "cellId": f"table-cell:r{key[0]}:c{key[1]}:{cell_hash[7:23]}"}


def _validate_page_surface(surface):
    if surface.get("pageNumber") is None:
        raise TableEvidenceError("TABLE_PAGE_SURFACE_REQUIRED", "governed table pass requires explicit source page")


def _validate_pass_set(passes):
    if not passes:
        raise TableEvidenceError("TABLE_PASS_REQUIRED", "at least one table pass is required")
    candidates = {item["tableCandidateId"] for item in passes}
    surfaces = {(item["sourceHash"], item["surfaceHash"]) for item in passes}
    pass_ids = [item["passId"] for item in passes]
    if len(candidates) != 1 or len(surfaces) != 1:
        raise TableEvidenceError("TABLE_PASS_CONTEXT_CONFLICT", "table passes must share candidate and source surface")
    if len(set(pass_ids)) != len(pass_ids):
        raise TableEvidenceError("TABLE_PASS_ID_DUPLICATE", "table pass IDs must be unique")


def _cells_by_key(table_pass):
    return {_cell_key(item): item for item in table_pass["cells"]}


def _cell_key(cell):
    row, column = cell.get("rowIndex"), cell.get("columnIndex")
    invalid = isinstance(row, bool) or isinstance(column, bool) or not isinstance(row, int) or not isinstance(column, int)
    if invalid or row < 0 or column < 0:
        raise TableEvidenceError("TABLE_CELL_INDEX_INVALID", "rowIndex and columnIndex must be non-negative integers")
    return row, column
