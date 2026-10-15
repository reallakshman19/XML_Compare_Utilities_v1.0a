"""Fail-closed overlay anchoring for DocumentEvidence.v1."""
from __future__ import annotations

from document_evidence_surface import canonical_hash


class OverlayEvidenceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_overlay(kind, surface, transform_hash, geometry, evidence_refs=(), **optional) -> dict:
    if not transform_hash:
        raise OverlayEvidenceError("OVERLAY_TRANSFORM_REQUIRED", "overlay requires an authoritative transform hash")
    identity = {
        "schema": "Overlay.v1", "kind": kind, "sourceHash": surface["sourceHash"],
        "surfaceId": surface["surfaceId"], "surfaceHash": surface["surfaceHash"],
        "surfaceTransformHash": transform_hash, "geometry": geometry,
        "evidenceRefs": list(evidence_refs),
    }
    for key in ("payload", "styleHint", "producer", "producerVersion"):
        if key in optional and optional[key] is not None:
            identity[key] = optional[key]
    overlay_hash = canonical_hash(identity)
    return {**identity, "overlayId": f"overlay:{kind}:{overlay_hash[7:31]}"}


def overlay_anchor_status(overlay: dict, surface: dict, transform_hash: str) -> dict:
    if overlay.get("sourceHash") != surface.get("sourceHash"):
        return _stale("OVERLAY_STALE_SOURCE")
    if overlay.get("surfaceId") != surface.get("surfaceId") or overlay.get("surfaceHash") != surface.get("surfaceHash"):
        return _stale("OVERLAY_STALE_SOURCE")
    if overlay.get("surfaceTransformHash") != transform_hash:
        return _stale("OVERLAY_STALE_TRANSFORM")
    return {"aligned": True, "diagnosticCode": None, "trustedUseBlocked": False}


def aligned_overlay_geometry(overlay: dict, surface: dict, transform_hash: str) -> dict:
    status = overlay_anchor_status(overlay, surface, transform_hash)
    if not status["aligned"]:
        raise OverlayEvidenceError(status["diagnosticCode"], "overlay anchor is stale; aligned rendering is blocked")
    return overlay["geometry"]


def _stale(code):
    return {"aligned": False, "diagnosticCode": code, "trustedUseBlocked": True}
