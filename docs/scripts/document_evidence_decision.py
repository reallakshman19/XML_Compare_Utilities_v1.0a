"""Extraction-only reconciliation decisions for DocumentEvidence.v1."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
import json
from pathlib import Path

from document_evidence_surface import canonical_hash


class EvidenceDecisionError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def reconcile_cell(observations, *, logical_cell_id: str | None = None) -> dict:
    values = tuple(observations)
    if not values:
        return make_decision("not_found", (), diagnostics=("TABLE_CELL_NOT_FOUND",), notes=_notes(logical_cell_id))
    _validate_observations(values)
    texts = {item["normalizedText"] for item in values}
    if len(texts) == 1:
        selected = _deterministic_selection(values)
        numeric = _exact_decimal(selected["normalizedText"])
        return make_decision("accepted", values, selected=selected, effective_text=selected["normalizedText"], effective_numeric=numeric, notes=_notes(logical_cell_id))
    numeric_values = tuple(_exact_decimal(item["normalizedText"]) for item in values)
    if all(value is not None for value in numeric_values):
        if len(set(numeric_values)) == 1:
            selected = _deterministic_selection(values)
            return make_decision("accepted", values, selected=selected, effective_text=selected["normalizedText"], effective_numeric=numeric_values[0], notes=_notes(logical_cell_id))
        return make_decision("review_required", values, diagnostics=("OCR_NUMERIC_DISAGREEMENT",), notes=_notes(logical_cell_id))
    resolved = _reconcile_native_ocr_text(values, logical_cell_id)
    if resolved is not None:
        return resolved
    return make_decision("review_required", values, diagnostics=("TEXT_OBSERVATION_CONFLICT",), notes=_notes(logical_cell_id))


def _reconcile_native_ocr_text(observations, logical_cell_id):
    native = tuple(item for item in observations if item["kind"] == "native-text")
    ocr = tuple(item for item in observations if item["kind"] == "ocr")
    if len(native) != 1 or not ocr:
        return None
    quality = _native_quality_state(native[0])
    ocr_texts = {item["normalizedText"] for item in ocr}
    if quality == "mapping_corrupt" and len(ocr_texts) == 1:
        return _accepted_text(observations, _deterministic_selection(ocr), "PDF_TEXT_MAPPING_CORRUPT", logical_cell_id)
    if quality == "strong" and all(_confusable_equivalent(native[0]["normalizedText"], text) for text in ocr_texts):
        return _accepted_text(observations, native[0], "TEXT_CONFUSABLE_DISAGREEMENT", logical_cell_id)
    return None


def _accepted_text(observations, selected, diagnostic_code, logical_cell_id):
    return make_decision("accepted", observations, selected=selected, effective_text=selected["normalizedText"], diagnostics=(diagnostic_code,), notes=_notes(logical_cell_id))


def _native_quality_state(observation):
    quality = observation.get("nativeQuality") or {}
    status = quality.get("status")
    return status if status in {"strong", "mapping_corrupt"} else "unknown"


def _confusable_equivalent(left, right):
    translation = str.maketrans({"l": "1", "i": "1", "|": "1", "o": "0"})
    return str(left).casefold().translate(translation) == str(right).casefold().translate(translation)


def make_decision(state: str, observations, *, selected: dict | None = None, effective_text: str | None = None, effective_numeric: Decimal | None = None, diagnostics=(), reconciliation_profile_hash: str | None = None, notes: dict | None = None) -> dict:
    if state not in {"accepted", "review_required", "blocked", "not_found"}:
        raise EvidenceDecisionError("EVIDENCE_DECISION_STATE_INVALID", f"unsupported decision state: {state}")
    if state == "accepted" and selected is None:
        raise EvidenceDecisionError("EVIDENCE_DECISION_SELECTION_REQUIRED", "accepted decision requires selected observation")
    identity = {"schema": "EvidenceDecision.v1", "state": state, "observationHashes": sorted(item["observationHash"] for item in observations), "diagnosticCodes": sorted(set(diagnostics))}
    if selected is not None:
        identity["selectedObservationHash"] = selected["observationHash"]
    if state == "accepted" and effective_text is not None:
        identity["effectiveText"] = str(effective_text)
    if state == "accepted" and effective_numeric is not None:
        identity["effectiveNumericValue"] = float(effective_numeric)
    if reconciliation_profile_hash is not None:
        identity["reconciliationProfileHash"] = reconciliation_profile_hash
    if notes:
        identity["notes"] = notes
    decision_hash = canonical_hash(identity)
    return {**identity, "decisionId": f"decision:{state}:{decision_hash[7:31]}", "decisionHash": decision_hash}


def _validate_observations(observations):
    source_hashes = {item["sourceHash"] for item in observations}
    if len(source_hashes) != 1:
        raise EvidenceDecisionError("EVIDENCE_SOURCE_CONFLICT", "cell observations must share one source")


def _deterministic_selection(observations):
    return sorted(observations, key=lambda item: (item["kind"] != "native-text", item["observationHash"]))[0]


def _exact_decimal(text):
    try:
        value = Decimal(str(text))
    except (InvalidOperation, ValueError):
        return None
    return value if value.is_finite() else None


def _notes(logical_cell_id):
    return {"logicalCellId": logical_cell_id} if logical_cell_id else None


class DiagnosticError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def load_diagnostic_catalog() -> dict:
    path = Path(__file__).resolve().parents[1] / "contracts" / "document-evidence" / "v1" / "diagnostic-catalog.json"
    return json.loads(path.read_text(encoding="utf-8"))


def diagnostic(code: str, *, subject_id: str | None = None, details: dict | None = None) -> dict:
    entry = _diagnostic_entry(code)
    value = {"schema": "Diagnostic.v1", "code": code, "severity": entry["severity"], "message": entry["message"], "retainedEvidence": list(entry["retainedEvidence"]), "blockedDownstream": list(entry["blockedDownstream"]), "reviewerResolution": entry["reviewerResolution"]}
    if subject_id is not None:
        value["subjectId"] = str(subject_id)
    if details:
        value["details"] = dict(details)
    return value


def fail_closed_matrix() -> dict:
    catalog = load_diagnostic_catalog()
    fields = ("severity", "message", "detection", "retainedEvidence", "blockedDownstream", "reviewerResolution")
    cases = [{"code": code, **{key: entry[key] for key in fields}} for code, entry in sorted(catalog["codes"].items()) if entry.get("matrixCase")]
    return {"schema": "DocumentEvidenceFailClosedMatrix.v1", "cases": cases}


def reviewer_can_resolve(code: str) -> bool:
    return _diagnostic_entry(code)["reviewerResolution"] == "REVIEWER_CAN_RESOLVE"


def blocked_downstream(code: str) -> tuple[str, ...]:
    return tuple(_diagnostic_entry(code)["blockedDownstream"])


def _diagnostic_entry(code):
    entry = load_diagnostic_catalog().get("codes", {}).get(code)
    if entry is None:
        raise DiagnosticError("DIAGNOSTIC_CODE_UNKNOWN", f"unknown DocumentEvidence diagnostic code: {code}")
    return entry
