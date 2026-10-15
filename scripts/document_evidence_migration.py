"""Fail-closed compatibility classification for legacy evidence artifacts."""
from __future__ import annotations


REBUILD_REASONS = {
    "ocr": ("sourceHash", "inputSurfaceHash", "preprocessingTransformHash"),
    "docx-visual": ("sourceHash", "renderProfileHash", "surfaceHash"),
    "overlay": ("sourceHash", "surfaceHash", "surfaceTransformHash"),
    "curve": ("sourceHash", "surfaceHash", "controlPointsPreserved"),
}


def classify_legacy_artifact(kind: str, metadata: dict) -> dict:
    if kind == "text-search" and metadata.get("sourceHash"):
        return _result("legacy-compatible", (), False)
    required = REBUILD_REASONS.get(kind)
    if required is None:
        return _result("legacy-unverified", ("ARTIFACT_KIND_UNKNOWN",), True)
    missing = tuple(key for key in required if not metadata.get(key))
    if missing:
        return _result("rebuild-required", tuple(f"MISSING_{key}" for key in missing), True)
    if kind == "curve" and metadata.get("controlPointsPreserved") is not True:
        return _result("rebuild-required", ("GEOMETRY_CONTROL_POINTS_LOST",), True)
    return _result("trusted-compatible", (), False)


def schema_read_compatibility(artifact_major: int, reader_major: int = 1) -> dict:
    if artifact_major == reader_major:
        return {"readable": True, "adapterRequired": False, "diagnosticCode": None}
    if artifact_major < reader_major:
        return {"readable": False, "adapterRequired": True, "diagnosticCode": "EVIDENCE_LEGACY_ADAPTER_REQUIRED"}
    return {"readable": False, "adapterRequired": False, "diagnosticCode": "EVIDENCE_SCHEMA_FUTURE_MAJOR"}


def _result(status, diagnostics, blocked):
    return {"status": status, "diagnosticCodes": list(diagnostics), "trustedUseBlocked": blocked}
