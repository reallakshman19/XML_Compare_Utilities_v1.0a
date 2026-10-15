"""DOCX page authority and semantic-to-visual evidence helpers."""
from __future__ import annotations

from document_evidence_surface import canonical_hash, make_surface


class DocxEvidenceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_docx_page_surface(
    source_hash: str,
    semantic_content_hash: str,
    render_profile_hash: str,
    page_number: int,
    width: float,
    height: float,
) -> dict:
    _require_sha("sourceHash", source_hash)
    _require_sha("semanticContentHash", semantic_content_hash)
    _require_sha("renderProfileHash", render_profile_hash)
    if isinstance(page_number, bool) or not isinstance(page_number, int) or page_number < 1:
        raise DocxEvidenceError("DOCX_PAGE_NUMBER_INVALID", "DOCX rendered page number must be a positive integer")
    return make_surface(
        source_hash,
        "docx-rendered-page",
        width,
        height,
        "pt",
        "top-left",
        "right",
        "down",
        page_number=page_number,
        render_profile_hash=render_profile_hash,
        metadata={
            "semanticContentHash": semantic_content_hash,
            "pageAuthority": "render-profile-bound",
        },
    )


def make_semantic_visual_map(
    source_hash: str,
    semantic_content_hash: str,
    render_profile_hash: str,
    semantic_refs,
    visual_regions,
    *,
    mapping_method: str,
    status: str = "mapped",
    diagnostics=(),
) -> dict:
    if status not in {"mapped", "ambiguous", "unmapped", "stale"}:
        raise DocxEvidenceError("DOCX_MAPPING_STATUS_INVALID", f"unsupported mapping status: {status}")
    semantic = tuple(semantic_refs)
    regions = tuple(visual_regions)
    if status == "mapped" and (not semantic or not regions):
        raise DocxEvidenceError("DOCX_MAPPING_EVIDENCE_REQUIRED", "mapped relation requires semantic and visual evidence")
    _validate_regions(source_hash, render_profile_hash, regions)
    identity = {
        "schema": "DocxSemanticVisualMap.v1",
        "sourceHash": source_hash,
        "semanticContentHash": semantic_content_hash,
        "renderProfileHash": render_profile_hash,
        "semanticRefs": list(semantic),
        "visualRegions": list(regions),
        "mappingMethod": mapping_method,
        "cardinality": _cardinality(len(semantic), len(regions)),
        "status": status,
        "diagnosticCodes": sorted(set(diagnostics)),
        "exactLocationTrusted": status == "mapped",
    }
    mapping_hash = canonical_hash(identity)
    return {
        **identity,
        "mappingId": f"docx-map:{mapping_hash[7:31]}",
        "mappingHash": mapping_hash,
    }


def classify_docx_render_change(previous: dict, current: dict) -> dict:
    _require_snapshot(previous)
    _require_snapshot(current)
    if previous["semanticContentHash"] != current["semanticContentHash"]:
        return _change("semantic_content_changed", "DOCX_SEMANTIC_CONTENT_CHANGED", True, False)
    if previous["renderProfileHash"] != current["renderProfileHash"]:
        return _change("render_environment_changed", "DOCX_RENDER_PROFILE_CHANGED", False, True)
    if previous["surfaceHash"] != current["surfaceHash"]:
        return _change("render_nondeterministic", "DOCX_RENDER_NONDETERMINISTIC", False, True)
    return _change("stable", None, False, False)


def effective_docx_location(mapping: dict) -> tuple[dict, ...]:
    if mapping.get("status") != "mapped" or not mapping.get("exactLocationTrusted"):
        raise DocxEvidenceError(
            "DOCX_SEMANTIC_VISUAL_AMBIGUOUS",
            "exact DOCX visual location is unavailable until mapping is uniquely resolved",
        )
    return tuple(mapping["visualRegions"])


def _validate_regions(source_hash, render_profile_hash, regions):
    for region in regions:
        if region.get("sourceHash") != source_hash:
            raise DocxEvidenceError("OVERLAY_STALE_SOURCE", "DOCX visual region is bound to a different source")
        if region.get("renderProfileHash") != render_profile_hash:
            raise DocxEvidenceError("DOCX_RENDER_PROFILE_CHANGED", "DOCX visual region uses a different render profile")
        if not region.get("surfaceId") or not region.get("surfaceHash") or not region.get("geometry"):
            raise DocxEvidenceError("DOCX_VISUAL_REGION_INVALID", "DOCX visual region requires surface identity and geometry")


def _cardinality(semantic_count: int, region_count: int) -> str:
    if semantic_count <= 1 and region_count <= 1:
        return "one-to-one"
    if semantic_count <= 1:
        return "one-to-many"
    if region_count <= 1:
        return "many-to-one"
    return "many-to-many"


def _change(kind, diagnostic, content_changed, visual_changed):
    return {
        "kind": kind,
        "diagnosticCode": diagnostic,
        "semanticContentChanged": content_changed,
        "renderedSurfaceChanged": visual_changed,
    }


def _require_snapshot(value):
    for key in ("semanticContentHash", "renderProfileHash", "surfaceHash"):
        if not value.get(key):
            raise DocxEvidenceError("DOCX_RENDER_SNAPSHOT_INVALID", f"missing {key}")


def _require_sha(name, value):
    if not isinstance(value, str) or not value.startswith("sha256:") or len(value) != 71:
        raise DocxEvidenceError("DOCX_HASH_INVALID", f"{name} must be sha256:<64 hex>")
