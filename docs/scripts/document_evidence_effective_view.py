"""Reviewed effective text views without mutating machine observations."""
from __future__ import annotations

from document_evidence_correction import correction_set_hash
from document_evidence_surface import canonical_hash


class EffectiveViewError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_effective_view(observation: dict, corrections=()) -> dict:
    events = tuple(corrections)
    _validate_targets(observation, events)
    approved = tuple(item for item in events if item.get("status") == "approved")
    selected = _select_terminal_approved(approved)
    identity = {"schema":"EffectiveEvidenceView.v1","observationHash":observation["observationHash"],"correctionSetHash":correction_set_hash(events),"effectiveText":observation["normalizedText"],"effectiveSource":"machine-observation","lineage":{"observationHash":observation["observationHash"]}}
    if observation.get("extensions", {}).get("numericValue") is not None: identity["effectiveNumericValue"] = observation["extensions"]["numericValue"]
    if selected is not None:
        identity.update({"effectiveText":selected["correctedText"],"effectiveSource":"reviewer-correction","selectedCorrectionHash":selected["eventHash"]})
        identity["lineage"]["correctionHash"] = selected["eventHash"]
        if "correctedNumericValue" in selected: identity["effectiveNumericValue"] = selected["correctedNumericValue"]
        else: identity.pop("effectiveNumericValue", None)
    return {**identity,"effectiveViewHash":canonical_hash(identity)}


def make_search_record(view: dict, *, document_id: str, field_id: str | None = None) -> dict:
    record={"schema":"EffectiveSearchRecord.v1","documentId":document_id,"text":view["effectiveText"],"effectiveViewHash":view["effectiveViewHash"],"observationHash":view["observationHash"],"correctionSetHash":view["correctionSetHash"]}
    if field_id is not None: record["fieldId"] = field_id
    if view.get("selectedCorrectionHash"): record["selectedCorrectionHash"] = view["selectedCorrectionHash"]
    return record


def _validate_targets(observation, events):
    expected=observation.get("observationHash")
    for event in events:
        if event.get("targetObservationHash") != expected: raise EffectiveViewError("CORRECTION_TARGET_MISMATCH","correction targets a different immutable observation")


def _select_terminal_approved(approved):
    if not approved: return None
    by_hash={item["eventHash"]:item for item in approved}
    superseded={item.get("supersedesCorrectionHash") for item in approved if item.get("supersedesCorrectionHash") in by_hash}
    terminals=[item for item in approved if item["eventHash"] not in superseded]
    if len(terminals)!=1: raise EffectiveViewError("CORRECTION_APPROVAL_CONFLICT","multiple terminal approved corrections require review")
    return terminals[0]
