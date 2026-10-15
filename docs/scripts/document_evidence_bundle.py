"""Deterministic evidence-bundle manifests and ZIP artifacts."""
from __future__ import annotations

from io import BytesIO
import hashlib
from zipfile import ZIP_STORED, ZipFile, ZipInfo

from document_evidence_surface import canonical_hash, canonical_json_bytes


class EvidenceBundleError(ValueError):
    pass


def make_bundle_manifest(entries: dict[str, bytes], *, source_hash: str, machine_evidence_hash: str, schema_major: int = 1) -> dict:
    normalized = _normalize_entries(entries)
    identity = {
        "schema": "EvidenceBundleManifest.v1",
        "schemaMajor": int(schema_major),
        "sourceHash": source_hash,
        "machineEvidenceHash": machine_evidence_hash,
        "entries": [
            {"path": path, "sha256": _sha(data), "sizeBytes": len(data)}
            for path, data in normalized
        ],
    }
    bundle_hash = canonical_hash(identity)
    return {**identity, "bundleHash": bundle_hash}


def build_deterministic_bundle(entries: dict[str, bytes], manifest: dict) -> bytes:
    normalized = _normalize_entries(entries)
    expected = make_bundle_manifest(
        dict(normalized), source_hash=manifest["sourceHash"],
        machine_evidence_hash=manifest["machineEvidenceHash"], schema_major=manifest["schemaMajor"],
    )
    if expected != manifest:
        raise EvidenceBundleError("manifest does not match bundle entries")
    all_entries = [("manifest.json", canonical_json_bytes(manifest) + b"\n"), *normalized]
    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_STORED) as archive:
        for path, data in sorted(all_entries, key=lambda item: item[0]):
            info = ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_STORED
            info.external_attr = 0o600 << 16
            archive.writestr(info, data)
    return stream.getvalue()


def cache_identity(
    source_hash: str,
    *,
    operation: str,
    selection: dict,
    canonical_options: dict,
    schema_major: int = 1,
    provider_profile_hash: str | None = None,
    render_profile_hash: str | None = None,
    preprocessing_profile_hash: str | None = None,
) -> str:
    if not operation or not isinstance(selection, dict) or not isinstance(canonical_options, dict):
        raise EvidenceBundleError("cache identity requires operation, selection and canonical options")
    identity = {
        "schema": "EvidenceCacheKey.v1", "schemaMajor": int(schema_major),
        "sourceHash": source_hash, "operation": operation,
        "selection": selection, "canonicalOptions": canonical_options,
    }
    for key, value in (
        ("providerProfileHash", provider_profile_hash),
        ("renderProfileHash", render_profile_hash),
        ("preprocessingProfileHash", preprocessing_profile_hash),
    ):
        if value is not None:
            identity[key] = value
    return canonical_hash(identity)


def _normalize_entries(entries):
    result = []
    for path, data in entries.items():
        if not isinstance(path, str) or not path or path.startswith("/") or ".." in path.split("/") or path == "manifest.json":
            raise EvidenceBundleError(f"unsafe or reserved bundle path: {path!r}")
        if not isinstance(data, (bytes, bytearray)):
            raise EvidenceBundleError(f"bundle entry must be bytes: {path}")
        result.append((path, bytes(data)))
    return sorted(result, key=lambda item: item[0])


def _sha(data):
    return f"sha256:{hashlib.sha256(data).hexdigest()}"
