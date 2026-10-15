"""Storage/retention policy for evidence artifacts."""
from __future__ import annotations
from document_evidence_surface import canonical_hash

class EvidenceStoragePolicyError(ValueError):
    def __init__(self,code,message): super().__init__(message); self.code=code

def make_storage_policy(mode,*,ttl_seconds=None,access_scope="job",eviction="on-job-complete",encryption_at_rest="not-claimed",max_retained_bytes=None):
    if mode not in {"ephemeral","content-addressed-persistent"}: raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_MODE_INVALID",f"unsupported storage mode: {mode}")
    if access_scope not in {"job","principal","workspace","service"}: raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_ACCESS_INVALID",f"unsupported access scope: {access_scope}")
    if eviction not in {"on-job-complete","ttl","lru-with-ttl","manual-admin"}: raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_EVICTION_INVALID",f"unsupported eviction policy: {eviction}")
    if encryption_at_rest not in {"required","platform-managed","not-claimed"}: raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_ENCRYPTION_INVALID","invalid encryption-at-rest claim")
    if ttl_seconds is not None and (isinstance(ttl_seconds,bool) or int(ttl_seconds)<=0): raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_TTL_INVALID","TTL must be a positive integer")
    if max_retained_bytes is not None and (isinstance(max_retained_bytes,bool) or int(max_retained_bytes)<=0): raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_LIMIT_INVALID","max retained bytes must be positive")
    if mode=="content-addressed-persistent":
        missing=[]
        if ttl_seconds is None: missing.append("ttlSeconds")
        if max_retained_bytes is None: missing.append("maxRetainedBytes")
        if access_scope=="job": missing.append("nonJobAccessScope")
        if eviction=="on-job-complete": missing.append("persistentEviction")
        if missing: raise EvidenceStoragePolicyError("EVIDENCE_STORAGE_POLICY_INCOMPLETE","persistent evidence policy missing: "+", ".join(missing))
    identity={"schema":"EvidenceStoragePolicy.v1","mode":mode,"accessScope":access_scope,"eviction":eviction,"encryptionAtRest":encryption_at_rest}
    if ttl_seconds is not None: identity["ttlSeconds"]=int(ttl_seconds)
    if max_retained_bytes is not None: identity["maxRetainedBytes"]=int(max_retained_bytes)
    return {**identity,"storagePolicyHash":canonical_hash(identity)}

def retrieval_eligible(policy):
    if policy.get("mode")=="content-addressed-persistent": return {"retrievalEndpointEligible":True,"diagnosticCode":None}
    return {"retrievalEndpointEligible":False,"diagnosticCode":"EVIDENCE_STORAGE_NOT_PERSISTENT"}
