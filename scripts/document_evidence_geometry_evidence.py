"""Provider-neutral geometry evidence wrapper preserving raw backend lineage."""
from __future__ import annotations

from document_evidence_surface import canonical_hash


class GeometryEvidenceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_geometry_evidence(
    source_hash: str,
    surface: dict,
    object_kind: str,
    geometry: dict,
    *,
    provider: str,
    provider_object_id: str | None = None,
    style: dict | None = None,
    clip_stack=(),
    effective_ctm=None,
    z_order: int | None = None,
    image: dict | None = None,
    raw_evidence_ref: str | None = None,
    diagnostics=(),
) -> dict:
    if surface.get("sourceHash") != source_hash:
        raise GeometryEvidenceError("EVIDENCE_SOURCE_UNBOUND", "geometry surface is bound to another source")
    if object_kind not in {"line", "rectangle", "image", "path", "text", "other"}:
        raise GeometryEvidenceError("GEOMETRY_OBJECT_KIND_INVALID", f"unsupported object kind: {object_kind}")
    if not provider:
        raise GeometryEvidenceError("GEOMETRY_PROVIDER_REQUIRED", "geometry provider is required")
    identity = {
        "schema": "GeometryEvidence.v1",
        "sourceHash": source_hash,
        "surfaceId": surface["surfaceId"],
        "surfaceHash": surface["surfaceHash"],
        "objectKind": object_kind,
        "geometry": geometry,
        "provider": provider,
        "clipStack": [_clip_item(item) for item in clip_stack],
        "diagnosticCodes": sorted(set(diagnostics)),
    }
    for key, value in (
        ("providerObjectId", provider_object_id), ("style", style),
        ("effectiveCtm", _ctm(effective_ctm) if effective_ctm is not None else None),
        ("zOrder", int(z_order) if z_order is not None else None),
        ("image", _image_evidence(image) if image is not None else None),
        ("rawEvidenceRef", raw_evidence_ref),
    ):
        if value is not None:
            identity[key] = value
    digest = canonical_hash(identity)
    return {**identity, "geometryId": f"geometry:{object_kind}:{digest[7:31]}", "geometryHash": digest}


def _clip_item(item):
    if not isinstance(item, dict) or "geometry" not in item:
        raise GeometryEvidenceError("GEOMETRY_CLIP_INVALID", "clip stack item requires geometry")
    return {
        "geometry": item["geometry"],
        "operation": item.get("operation", "intersect"),
        "fillRule": item.get("fillRule", "nonzero"),
        **({"ctm": _ctm(item["ctm"])} if item.get("ctm") is not None else {}),
    }


def _ctm(value):
    values = [float(item) for item in value]
    if len(values) not in {6, 9}:
        raise GeometryEvidenceError("GEOMETRY_CTM_INVALID", "CTM must contain six affine or nine homogeneous values")
    if len(values) == 6:
        a, b, c, d, e, f = values
        values = [a, c, e, b, d, f, 0.0, 0.0, 1.0]
    return values


def _image_evidence(image):
    required = ("intrinsicWidth", "intrinsicHeight", "imageHash")
    if not all(image.get(key) is not None for key in required):
        raise GeometryEvidenceError("GEOMETRY_IMAGE_EVIDENCE_INVALID", "image evidence requires intrinsic dimensions and hash")
    return dict(image)
