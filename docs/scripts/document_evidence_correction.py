"""Append-only correction events kept outside deterministic machine evidence."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from document_evidence_surface import canonical_hash


def make_correction_event(
    target_observation_hash: str,
    corrected_text: str,
    reviewer_principal: str,
    review_timestamp: str,
    *,
    status: str,
    reason: str | None = None,
    corrected_numeric_value=None,
    supersedes_correction_hash: str | None = None,
) -> dict:
    if status not in {"proposed", "approved", "rejected", "superseded"}:
        raise ValueError(f"unsupported correction status: {status}")
    identity = {
        "schema": "CorrectionEvent.v1",
        "targetObservationHash": target_observation_hash,
        "correctedText": str(corrected_text),
        "reviewerPrincipal": reviewer_principal,
        "reviewTimestamp": review_timestamp,
        "status": status,
    }
    if reason is not None:
        identity["reason"] = reason
    if corrected_numeric_value is not None:
        identity["correctedNumericValue"] = float(_finite_decimal(corrected_numeric_value))
    if supersedes_correction_hash is not None:
        identity["supersedesCorrectionHash"] = supersedes_correction_hash
    event_hash = canonical_hash(identity)
    return {
        **identity,
        "correctionId": f"correction:{event_hash[7:31]}",
        "eventHash": event_hash,
    }


def correction_set_hash(events) -> str:
    approved = sorted(
        (item for item in events if item.get("status") == "approved"),
        key=lambda item: item["eventHash"],
    )
    return canonical_hash({"schema": "CorrectionSet.v1", "approvedEventHashes": [item["eventHash"] for item in approved]})


def _finite_decimal(value):
    try:
        decimal = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("corrected numeric value must be finite") from exc
    if not decimal.is_finite():
        raise ValueError("corrected numeric value must be finite")
    return decimal
