"""Provider-neutral surface identity helpers for DocumentEvidence.v1."""
from __future__ import annotations

from decimal import Decimal
import hashlib
import json
import math


def canonical_json_bytes(value) -> bytes:
    """Serialize JSON-compatible data using RFC 8785/JCS rules."""
    return _jcs(value).encode("utf-8")


def canonical_hash(value) -> str:
    """Hash canonical JSON, domain-separated by a schema name when present."""
    payload = canonical_json_bytes(value)
    schema = value.get("schema") if isinstance(value, dict) else None
    if isinstance(schema, str) and schema:
        payload = schema.encode("utf-8") + b"\0" + payload
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def _jcs(value) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return _jcs_string(value)
    if isinstance(value, int):
        return _jcs_integer(value)
    if isinstance(value, float):
        return _jcs_float(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(_jcs(item) for item in value) + "]"
    if isinstance(value, dict):
        return _jcs_object(value)
    raise TypeError(f"value is not JCS JSON-compatible: {type(value).__name__}")


def _jcs_string(value: str) -> str:
    try:
        value.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ValueError("JCS strings must not contain lone Unicode surrogates") from exc
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _jcs_integer(value: int) -> str:
    try:
        ieee_value = float(value)
    except OverflowError as exc:
        raise ValueError("JCS numbers must be expressible as IEEE-754 doubles") from exc
    if not math.isfinite(ieee_value):
        raise ValueError("JCS numbers must be expressible as IEEE-754 doubles")
    return _jcs_float(ieee_value)


def _jcs_float(value: float) -> str:
    if not math.isfinite(value):
        raise ValueError("JCS numbers must be finite")
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    decimal = Decimal(repr(abs(value))).normalize()
    digits = "".join(str(item) for item in decimal.as_tuple().digits) or "0"
    exponent = len(digits) + decimal.as_tuple().exponent - 1
    return sign + _ecmascript_decimal(digits, exponent)


def _ecmascript_decimal(digits: str, exponent: int) -> str:
    decimal_point = exponent + 1
    if 0 < decimal_point <= 21:
        if len(digits) <= decimal_point:
            return digits + "0" * (decimal_point - len(digits))
        return digits[:decimal_point] + "." + digits[decimal_point:]
    if -6 < decimal_point <= 0:
        return "0." + "0" * (-decimal_point) + digits
    fraction = "." + digits[1:] if len(digits) > 1 else ""
    exponent_text = f"+{exponent}" if exponent >= 0 else str(exponent)
    return digits[0] + fraction + "e" + exponent_text


def _jcs_object(value: dict) -> str:
    if any(not isinstance(key, str) for key in value):
        raise TypeError("JCS object keys must be strings")
    try:
        keys = sorted(value, key=lambda key: key.encode("utf-16be"))
    except UnicodeEncodeError as exc:
        raise ValueError("JCS object keys must not contain lone Unicode surrogates") from exc
    pairs = (_jcs_string(key) + ":" + _jcs(value[key]) for key in keys)
    return "{" + ",".join(pairs) + "}"


def validate_render_profile(profile: dict) -> dict:
    if not isinstance(profile, dict) or profile.get("schema") != "RenderProfile.v1":
        raise ValueError("RENDER_PROFILE_SCHEMA_INVALID")
    claimed = profile.get("renderProfileHash")
    identity = {key: value for key, value in profile.items() if key not in {"renderProfileId", "renderProfileHash"}}
    if claimed != canonical_hash(identity):
        raise ValueError("RENDER_PROFILE_HASH_INVALID")
    if identity.get("documentKind") == "docx":
        _validate_docx_render_profile(identity)
    return profile


def make_surface(
    source_hash: str, kind: str, width: float, height: float, unit: str, origin: str,
    x_axis: str, y_axis: str, *, page_number: int | None = None,
    parent_surface_id: str | None = None, provider_profile_hash: str | None = None,
    render_profile_hash: str | None = None, metadata: dict | None = None,
) -> dict:
    identity = {
        "schema": "Surface.v1", "sourceHash": source_hash, "kind": kind,
        "width": round(float(width), 6), "height": round(float(height), 6),
        "unit": unit, "origin": origin, "xAxis": x_axis, "yAxis": y_axis,
    }
    _optional(identity, "pageNumber", page_number)
    _optional(identity, "parentSurfaceId", parent_surface_id)
    _optional(identity, "providerProfileHash", provider_profile_hash)
    _optional(identity, "renderProfileHash", render_profile_hash)
    if metadata:
        identity["metadata"] = metadata
    surface_hash = canonical_hash(identity)
    return {**identity, "surfaceId": f"surface:{kind}:{surface_hash[7:31]}", "surfaceHash": surface_hash}


def canonical_pdf_page_surface(source_hash: str, page_number: int, width: float, height: float, *, metadata: dict | None = None) -> dict:
    return make_surface(source_hash, "pdf-canonical-page", width, height, "pt", "top-left", "right", "down", page_number=page_number, metadata=metadata)


def rendered_raster_surface(
    source_hash: str, page_surface: dict, width: int, height: int, *, image_sha256: str,
    renderer: str, renderer_version: str, render_scale: float,
    render_profile_hash: str | None = None, render_profile: dict | None = None,
    metadata: dict | None = None,
) -> dict:
    profile_hash = _render_profile_hash(render_profile, render_profile_hash)
    raster_metadata = {
        "imageSha256": image_sha256, "renderer": renderer,
        "rendererVersion": renderer_version, "renderScale": round(float(render_scale), 6),
        **(metadata or {}),
    }
    return make_surface(
        source_hash, "rendered-raster", width, height, "px", "top-left", "right", "down",
        page_number=page_surface.get("pageNumber"), parent_surface_id=page_surface["surfaceId"],
        render_profile_hash=profile_hash, metadata=raster_metadata,
    )


def _render_profile_hash(profile, explicit_hash):
    if profile is None:
        return explicit_hash
    validate_render_profile(profile)
    profile_hash = profile["renderProfileHash"]
    if explicit_hash is not None and explicit_hash != profile_hash:
        raise ValueError("RENDER_PROFILE_HASH_CONFLICT")
    return profile_hash


def _validate_docx_render_profile(identity):
    required = {"rendererBinaryHash", "fontManifestHash", "locale", "trackedRevisionDisplay", "fieldUpdatePolicy", "environment"}
    missing = sorted(key for key in required if key not in identity)
    environment = identity.get("environment") or {}
    if not environment.get("osFamily") or not environment.get("architecture"):
        missing.append("environment.osFamily+architecture")
    if missing:
        raise ValueError(f"DOCX_RENDER_PROFILE_INCOMPLETE: {', '.join(missing)}")


def canonical_pdf_coordinate_system() -> dict:
    return {
        "contract": "DocumentEvidence.v1", "surfaceKind": "pdf-canonical-page",
        "units": "PDF points", "origin": "top-left", "xDirection": "right",
        "yDirection": "down", "bboxOrder": ["x0", "top", "x1", "bottom"],
        "nonAxisAlignedGeometry": "polygon-or-quad",
    }


def _optional(target: dict, key: str, value) -> None:
    if value is not None:
        target[key] = value
