"""Immutable text/OCR observation builders for DocumentEvidence.v1."""
from __future__ import annotations

import unicodedata

from document_evidence_surface import canonical_hash


class ObservationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFKC", str(value)).replace("\r\n", "\n").replace("\r", "\n").strip()


def validate_provider_profile(profile: dict) -> dict:
    if not isinstance(profile, dict) or profile.get("schema") != "ProviderProfile.v1":
        raise ObservationError("PROVIDER_PROFILE_SCHEMA_INVALID", "profile must use ProviderProfile.v1")
    claimed = profile.get("profileHash")
    identity = {key: value for key, value in profile.items() if key not in {"profileId", "profileHash"}}
    if claimed != canonical_hash(identity):
        raise ObservationError("PROVIDER_PROFILE_HASH_INVALID", "provider profile hash does not match content")
    return profile


def validate_native_quality(quality: dict) -> dict:
    if not isinstance(quality, dict) or quality.get("schema") != "NativeTextQuality.v1":
        raise ObservationError("NATIVE_QUALITY_SCHEMA_INVALID", "native quality must use NativeTextQuality.v1")
    claimed = quality.get("nativeQualityHash")
    identity = {key: value for key, value in quality.items() if key != "nativeQualityHash"}
    if claimed != canonical_hash(identity):
        raise ObservationError("NATIVE_QUALITY_HASH_INVALID", "native quality hash does not match content")
    if identity.get("status") in {"strong", "mapping_corrupt"}:
        _validate_decisive_quality(identity)
    return quality


def make_observation(
    kind: str, source_hash: str, surface: dict, provider: str, provider_version: str,
    raw_text: str, document_geometry: dict, *, provider_profile_hash: str | None = None,
    provider_profile: dict | None = None, input_raster_hash: str | None = None,
    provider_confidence_raw: float | None = None, provider_geometry: dict | None = None,
    provider_surface: dict | None = None, preprocessing_transform_hashes=(),
    native_quality: dict | None = None, raw_provider_evidence_hash: str | None = None,
    extensions: dict | None = None,
) -> dict:
    _validate_binding(kind, source_hash, surface, provider, provider_version)
    _validate_provider_geometry(source_hash, provider_geometry, provider_surface)
    profile_hash = _profile_hash(kind, provider, provider_version, provider_profile, provider_profile_hash)
    _validate_quality_binding(kind, native_quality, profile_hash)
    identity = _base_identity(kind, source_hash, surface, provider, provider_version, raw_text, document_geometry)
    _attach_optionals(identity, profile_hash, input_raster_hash, provider_geometry, provider_surface, native_quality, raw_provider_evidence_hash)
    if provider_confidence_raw is not None:
        identity["providerConfidenceRaw"] = float(provider_confidence_raw)
    if preprocessing_transform_hashes:
        identity["preprocessingTransformHashes"] = list(preprocessing_transform_hashes)
    if extensions:
        identity["extensions"] = extensions
    observation_hash = canonical_hash(identity)
    prefix = "native" if kind == "native-text" else "ocr"
    return {**identity, "observationId": f"observation:{prefix}:{observation_hash[7:31]}", "observationHash": observation_hash}


def _profile_hash(kind, provider, version, profile, explicit_hash):
    if profile is None:
        return explicit_hash
    validate_provider_profile(profile)
    actual = (profile.get("role"), profile.get("provider"), profile.get("providerVersion"))
    if actual != (kind, provider, version):
        raise ObservationError("OBSERVATION_PROVIDER_PROFILE_CONFLICT", "provider profile does not match observation")
    profile_hash = profile["profileHash"]
    if explicit_hash is not None and explicit_hash != profile_hash:
        raise ObservationError("OBSERVATION_PROVIDER_PROFILE_CONFLICT", "explicit profile hash conflicts with supplied profile")
    return profile_hash


def _validate_quality_binding(kind, quality, profile_hash):
    if quality is None:
        return
    if kind != "native-text":
        raise ObservationError("OBSERVATION_NATIVE_QUALITY_KIND_INVALID", "native quality is valid only for native text")
    validate_native_quality(quality)
    assessment_hash = quality.get("assessmentProfileHash")
    if assessment_hash is not None and assessment_hash != profile_hash:
        raise ObservationError("NATIVE_QUALITY_PROFILE_CONFLICT", "quality assessment profile does not match observation profile")


def _validate_decisive_quality(identity):
    if not identity.get("assessmentProfileHash"):
        raise ObservationError("NATIVE_QUALITY_PROFILE_REQUIRED", "decisive quality requires assessment profile hash")
    signals = (
        "toUnicodeStatus", "validUnicodeFraction", "replacementCharacterCount",
        "privateUseCharacterCount", "glyphCharacterConsistency", "diagnosticCodes",
    )
    if not any(key in identity and identity[key] not in (None, [], ()) for key in signals):
        raise ObservationError("NATIVE_QUALITY_EVIDENCE_REQUIRED", "decisive quality requires supporting evidence")


def _attach_optionals(identity, profile_hash, raster_hash, geometry, provider_surface, quality, raw_hash):
    values = {
        "providerProfileHash": profile_hash, "inputRasterHash": raster_hash, "providerGeometry": geometry,
        "providerSurfaceId": provider_surface.get("surfaceId") if provider_surface else None,
        "providerSurfaceHash": provider_surface.get("surfaceHash") if provider_surface else None,
        "nativeQuality": quality, "rawProviderEvidenceHash": raw_hash,
    }
    for key, value in values.items():
        _optional(identity, key, value)


def _base_identity(kind, source_hash, surface, provider, provider_version, raw_text, document_geometry):
    return {
        "schema": "Observation.v1", "kind": kind, "sourceHash": source_hash,
        "surfaceId": surface["surfaceId"], "surfaceHash": surface["surfaceHash"],
        "provider": provider, "providerVersion": provider_version,
        "rawText": str(raw_text), "normalizedText": normalize_text(raw_text),
        "documentGeometry": document_geometry,
    }


def _validate_provider_geometry(source_hash, geometry, provider_surface):
    if geometry is None:
        return
    if provider_surface is None:
        raise ObservationError("OBSERVATION_PROVIDER_SURFACE_REQUIRED", "provider geometry requires an explicit provider surface")
    if provider_surface.get("sourceHash") != source_hash:
        raise ObservationError("EVIDENCE_SOURCE_UNBOUND", "provider surface source does not match observation source")


def _validate_binding(kind, source_hash, surface, provider, provider_version):
    if kind not in {"native-text", "ocr"}:
        raise ObservationError("OBSERVATION_KIND_INVALID", f"unsupported observation kind: {kind}")
    if surface.get("sourceHash") != source_hash:
        raise ObservationError("EVIDENCE_SOURCE_UNBOUND", "observation source does not match surface source")
    if not provider or not provider_version:
        raise ObservationError("OBSERVATION_PROVIDER_REQUIRED", "provider and provider version are required")


def _optional(target: dict, key: str, value) -> None:
    if value is not None:
        target[key] = value
