"""Provider portability/conformance checks for DocumentEvidence.v1."""
from __future__ import annotations

from document_evidence_surface import canonical_hash


class ProviderConformanceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


_COORDINATE_ROLES = {"ocr", "pdf-geometry"}


def make_provider_profile(role: str, provider: str, provider_version: str, *, determinism: dict, **fields) -> dict:
    allowed_roles = {"native-text", "ocr", "pdf-geometry", "renderer", "docx-semantic", "other"}
    if role not in allowed_roles:
        raise ProviderConformanceError("PROVIDER_ROLE_INVALID", f"unsupported provider role: {role}")
    identity = {"schema": "ProviderProfile.v1", "role": role, "provider": provider, "providerVersion": provider_version, "determinism": _determinism(determinism)}
    identity.update({key: value for key, value in fields.items() if value is not None})
    if role in _COORDINATE_ROLES and not identity.get("coordinateConvention"):
        raise ProviderConformanceError("PROVIDER_COORDINATE_NONCONFORMANT", "geometry-bearing provider must declare coordinate convention")
    digest = canonical_hash(identity)
    return {**identity, "profileId": f"provider-profile:{digest[7:31]}", "profileHash": digest}


def conformance_status(profile: dict, *, geometry_bearing: bool = False, trusted_coordinate_use: bool = False) -> dict:
    diagnostics = []
    convention = profile.get("coordinateConvention")
    if geometry_bearing and convention in {None, "unknown", "provider-native"}:
        diagnostics.append("PROVIDER_COORDINATE_NONCONFORMANT")
    if trusted_coordinate_use and convention in {None, "unknown", "provider-native"}:
        diagnostics.append("PROVIDER_PIXEL_CONVENTION_UNKNOWN")
    if profile.get("role") == "ocr" and not profile.get("model") and not profile.get("providerBinaryHash"):
        diagnostics.append("PROVIDER_REPRODUCIBILITY_INCOMPLETE")
    return {"conformant": not diagnostics, "diagnosticCodes": sorted(set(diagnostics)), "textEqualityRequiredAcrossProviders": False}


def compare_provider_outputs(left: dict, right: dict) -> dict:
    _bound_observation(left); _bound_observation(right)
    if left["sourceHash"] != right["sourceHash"]:
        raise ProviderConformanceError("EVIDENCE_SOURCE_CONFLICT", "provider outputs refer to different sources")
    return {"sameSource": True, "sameText": left.get("normalizedText") == right.get("normalizedText"), "bothRetained": True, "textEqualityRequired": False, "leftObservationHash": left["observationHash"], "rightObservationHash": right["observationHash"]}


def _bound_observation(item):
    for key in ("observationHash", "sourceHash", "surfaceId", "surfaceHash", "provider", "providerVersion"):
        if not item.get(key):
            raise ProviderConformanceError("PROVIDER_CONFORMANCE_FAILED", f"observation missing {key}")
    if item.get("providerGeometry") and (not item.get("providerSurfaceId") or not item.get("providerSurfaceHash")):
        raise ProviderConformanceError("OBSERVATION_PROVIDER_SURFACE_REQUIRED", "provider geometry requires provider surface identity")


def _determinism(value):
    required = ("semantic", "artifact", "bitwiseRaster")
    allowed = {"guaranteed", "profile-bound", "not-claimed", "not-applicable"}
    if not isinstance(value, dict) or any(value.get(key) not in allowed for key in required):
        raise ProviderConformanceError("PROVIDER_CONFORMANCE_FAILED", "invalid provider determinism declaration")
    return {key: value[key] for key in required}
