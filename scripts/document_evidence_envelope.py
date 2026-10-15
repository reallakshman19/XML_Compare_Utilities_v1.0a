"""Deterministic MachineEvidenceEnvelope builder and lineage validation."""
from __future__ import annotations

from document_evidence_surface import canonical_hash


class EvidenceEnvelopeError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def make_machine_evidence(
    source: dict,
    *,
    surfaces=(), transforms=(), observations=(), decisions=(), geometry_evidence=(), diagnostics=(),
    provider_profiles=(), render_profiles=(), operation: str, selection: dict,
    canonical_options: dict,
) -> dict:
    source_hash = source.get("sha256")
    if not source_hash:
        raise EvidenceEnvelopeError("EVIDENCE_SOURCE_UNBOUND", "source sha256 is required")
    surfaces = tuple(surfaces)
    transforms = tuple(transforms)
    observations = tuple(observations)
    decisions = tuple(decisions)
    geometry_evidence = tuple(geometry_evidence)
    _validate_lineage(source_hash, surfaces, transforms, observations, decisions, geometry_evidence)
    identity = {
        "schema": "MachineEvidenceEnvelope.v1",
        "source": source,
        "surfaces": _ordered(surfaces, "surfaceHash"),
        "transforms": _ordered(transforms, "transformHash"),
        "observations": _ordered(observations, "observationHash"),
        "decisions": _ordered(decisions, "decisionHash"),
        "geometryEvidence": _ordered(geometry_evidence, "geometryHash"),
        "diagnostics": sorted((dict(item) for item in diagnostics), key=canonical_hash),
        "providerProfiles": _ordered(provider_profiles, "profileHash"),
        "renderProfiles": _ordered(render_profiles, "renderProfileHash"),
        "operation": operation,
        "selection": selection,
        "canonicalOptions": canonical_options,
    }
    evidence_hash = canonical_hash(identity)
    return {**identity, "machineEvidenceHash": evidence_hash}


def _validate_lineage(source_hash, surfaces, transforms, observations, decisions, geometry_evidence):
    for surface in surfaces:
        if surface.get("sourceHash") != source_hash:
            raise EvidenceEnvelopeError("EVIDENCE_SOURCE_UNBOUND", "surface source does not match envelope source")
    surface_ids = {item.get("surfaceId") for item in surfaces}
    for transform in transforms:
        if transform.get("sourceSurfaceId") not in surface_ids or transform.get("targetSurfaceId") not in surface_ids:
            raise EvidenceEnvelopeError("TRANSFORM_SURFACE_UNBOUND", "transform references a surface outside the envelope")
    observation_hashes = set()
    for observation in observations:
        if observation.get("sourceHash") != source_hash or observation.get("surfaceId") not in surface_ids:
            raise EvidenceEnvelopeError("EVIDENCE_SOURCE_UNBOUND", "observation source/surface is outside the envelope")
        observation_hashes.add(observation.get("observationHash"))
    for decision in decisions:
        if not set(decision.get("observationHashes", ())).issubset(observation_hashes):
            raise EvidenceEnvelopeError("DECISION_OBSERVATION_UNBOUND", "decision references observation outside envelope")
    for geometry in geometry_evidence:
        if geometry.get("sourceHash") != source_hash or geometry.get("surfaceId") not in surface_ids:
            raise EvidenceEnvelopeError("GEOMETRY_EVIDENCE_UNBOUND", "geometry evidence source/surface is outside envelope")


def _ordered(values, hash_key):
    return sorted((dict(item) for item in values), key=lambda item: item.get(hash_key, ""))
