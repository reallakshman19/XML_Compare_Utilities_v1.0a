"""Canonical render-profile identity for PDF/DOCX visual authority."""
from __future__ import annotations
from document_evidence_surface import canonical_hash

class RenderProfileError(ValueError):
    def __init__(self, code, message): super().__init__(message); self.code=code

_DOCX_REQUIRED=("rendererBinaryHash","environment","fontManifestHash","layoutEngine","layoutEngineVersion","locale","languagePackHashes","hyphenationDictionaryHashes","measurementUnit","trackedRevisionDisplay","commentDisplay","hiddenTextDisplay","fieldUpdatePolicy","externalResourcePolicy","compatibilityMode","printerMetricsPolicy","dpiX","dpiY")

def make_render_profile(document_kind,renderer,renderer_version,*,determinism,**fields):
    if document_kind not in {"pdf","docx","other"}: raise RenderProfileError("RENDER_PROFILE_DOCUMENT_KIND_INVALID",f"unsupported document kind: {document_kind}")
    identity={"schema":"RenderProfile.v1","documentKind":document_kind,"renderer":renderer,"rendererVersion":renderer_version,"determinism":_determinism(determinism)}
    identity.update({k:v for k,v in fields.items() if v is not None})
    if document_kind=="docx": _validate_docx(identity)
    digest=canonical_hash(identity)
    return {**identity,"renderProfileId":f"render-profile:{digest[7:31]}","renderProfileHash":digest}

def _validate_docx(profile):
    missing=[k for k in _DOCX_REQUIRED if k not in profile]
    if missing: raise RenderProfileError("DOCX_RENDER_PROFILE_INCOMPLETE",f"missing DOCX render-profile fields: {', '.join(missing)}")
    env=profile["environment"]
    if not isinstance(env,dict) or not all(env.get(k) for k in ("osFamily","architecture","environmentHash")): raise RenderProfileError("DOCX_RENDER_PROFILE_INCOMPLETE","DOCX environment requires osFamily, architecture and environmentHash")
    _hash(env["environmentHash"],"environmentHash")
    for key in ("rendererBinaryHash","fontManifestHash"): _hash(profile[key],key)
    for key in ("languagePackHashes","hyphenationDictionaryHashes"):
        if not isinstance(profile[key],list): raise RenderProfileError("DOCX_RENDER_PROFILE_INCOMPLETE",f"{key} must be an ordered hash list")
        for value in profile[key]: _hash(value,key)
    if float(profile["dpiX"])<=0 or float(profile["dpiY"])<=0: raise RenderProfileError("DOCX_RENDER_PROFILE_INCOMPLETE","DOCX render DPI must be positive")

def _determinism(value):
    required=("semantic","artifact","bitwiseRaster"); allowed={"guaranteed","profile-bound","not-claimed","not-applicable"}
    if not isinstance(value,dict) or any(value.get(k) not in allowed for k in required): raise RenderProfileError("RENDER_PROFILE_DETERMINISM_INVALID","determinism requires semantic/artifact/bitwiseRaster claims")
    return {k:value[k] for k in required}

def _hash(value,name):
    if not isinstance(value,str) or not value.startswith("sha256:") or len(value)!=71: raise RenderProfileError("DOCX_RENDER_PROFILE_INCOMPLETE",f"{name} must be sha256:<64 hex>")
