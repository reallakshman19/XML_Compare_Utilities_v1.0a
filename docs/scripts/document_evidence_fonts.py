"""Content-addressed resolved-font manifests for render-profile authority."""
from __future__ import annotations

from document_evidence_surface import canonical_hash


class FontManifestError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_font_manifest(entries) -> dict:
    normalized = [_font_entry(item) for item in entries]
    normalized.sort(key=lambda item: (item["requestedFamily"].casefold(), item["resolvedFamily"].casefold(), item["fileHash"]))
    identity = {"schema": "ResolvedFontManifest.v1", "entries": normalized}
    digest = canonical_hash(identity)
    substitutions = [item for item in normalized if item["substituted"]]
    return {
        **identity,
        "fontManifestHash": digest,
        "substitutionCount": len(substitutions),
        "diagnosticCodes": ["DOCX_FONT_SUBSTITUTION"] if substitutions else [],
    }


def bind_font_manifest(render_profile: dict, manifest: dict) -> dict:
    if render_profile.get("documentKind") != "docx":
        raise FontManifestError("DOCX_RENDER_PROFILE_REQUIRED", "font manifest binding requires a DOCX render profile")
    declared = render_profile.get("fontManifestHash")
    actual = manifest.get("fontManifestHash")
    if declared != actual:
        raise FontManifestError("DOCX_FONT_MANIFEST_MISMATCH", "render profile font manifest hash does not match resolved font evidence")
    if manifest.get("substitutionCount", 0):
        return {"trustedLayout": False, "diagnosticCode": "DOCX_FONT_SUBSTITUTION", "fontManifestHash": actual}
    return {"trustedLayout": True, "diagnosticCode": None, "fontManifestHash": actual}


def _font_entry(item):
    required = ("requestedFamily", "resolvedFamily", "fileHash")
    if not isinstance(item, dict) or not all(item.get(key) for key in required):
        raise FontManifestError("DOCX_FONT_EVIDENCE_INVALID", "font evidence requires requested family, resolved family, and font-file hash")
    file_hash = item["fileHash"]
    if not isinstance(file_hash, str) or not file_hash.startswith("sha256:") or len(file_hash) != 71:
        raise FontManifestError("DOCX_FONT_EVIDENCE_INVALID", "font-file hash must be sha256:<64 hex>")
    result = {
        "requestedFamily": str(item["requestedFamily"]),
        "resolvedFamily": str(item["resolvedFamily"]),
        "fileHash": file_hash,
        "substituted": bool(item.get("substituted", item["requestedFamily"] != item["resolvedFamily"])),
    }
    for key in ("style", "weight", "fallbackReason", "sourcePathHint"):
        if item.get(key) is not None:
            result[key] = item[key]
    return result
