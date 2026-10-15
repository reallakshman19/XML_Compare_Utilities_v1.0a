"""Hard bounded OCR resource policy for DocumentEvidence.v1."""
from __future__ import annotations

from dataclasses import dataclass

MIB = 1024 * 1024
OCR_POLICY = {"maxPagesPerJob":256,"maxRegionsPerJob":1024,"maxPixelsPerInput":24000000,"maxDimensionPx":12000,"maxProviderInvocationsPerJob":512,"maxConcurrencyPerJob":2,"callTimeoutSeconds":30,"pageBudgetSeconds":90,"jobWallBudgetSeconds":1800,"maxAttemptMemoryBytes":512*MIB,"maxWorkerRssBytes":768*MIB,"maxJobOcrMemoryBytes":2048*MIB,"maxPersistedObservationBytes":128*MIB}
PASS_PROFILES = {"single":("normal",),"auto":("normal","fallback"),"enhanced":("normal","normalized-resample","threshold","alternate-deskew-resample")}

class OcrResourceError(ValueError):
    def __init__(self, code, message):
        super().__init__(message); self.code=code

@dataclass(frozen=True)
class OcrJobUsage:
    pages:int=0; regions:int=0; provider_invocations:int=0; admitted_memory_bytes:int=0; persisted_observation_bytes:int=0

def pass_profiles(mode):
    if mode not in PASS_PROFILES: raise OcrResourceError("OCR_PROFILE_MODE_INVALID",f"unsupported OCR pass mode: {mode}")
    return PASS_PROFILES[mode]

def max_call_bound(region_count, mode):
    regions=int(region_count)
    if regions<0 or regions>OCR_POLICY["maxRegionsPerJob"]: raise OcrResourceError("OCR_REGION_LIMIT","OCR region count exceeds policy")
    return min(OCR_POLICY["maxProviderInvocationsPerJob"], regions*len(pass_profiles(mode)))

def attempt_memory_estimate(width,height):
    width,height=int(width),int(height)
    if width<=0 or height<=0: raise OcrResourceError("OCR_RASTER_DIMENSIONS_INVALID","OCR raster dimensions must be positive")
    return 16*width*height+64*MIB

def admit_attempt(width,height,usage):
    width,height=int(width),int(height); pixels=width*height
    if max(width,height)>OCR_POLICY["maxDimensionPx"] or pixels>OCR_POLICY["maxPixelsPerInput"]: raise OcrResourceError("OCR_RESOURCE_LIMIT","OCR raster exceeds pixel or dimension policy")
    memory=attempt_memory_estimate(width,height)
    if memory>OCR_POLICY["maxAttemptMemoryBytes"] or usage.provider_invocations+1>OCR_POLICY["maxProviderInvocationsPerJob"] or usage.admitted_memory_bytes+memory>OCR_POLICY["maxJobOcrMemoryBytes"]: raise OcrResourceError("OCR_RESOURCE_LIMIT","OCR attempt exceeds bounded job policy")
    return OcrJobUsage(usage.pages,usage.regions,usage.provider_invocations+1,usage.admitted_memory_bytes+memory,usage.persisted_observation_bytes)

def admit_job_shape(pages,regions,persisted_bytes=0):
    pages,regions,persisted_bytes=int(pages),int(regions),int(persisted_bytes)
    if pages<0 or pages>OCR_POLICY["maxPagesPerJob"] or regions<0 or regions>OCR_POLICY["maxRegionsPerJob"] or persisted_bytes<0 or persisted_bytes>OCR_POLICY["maxPersistedObservationBytes"]: raise OcrResourceError("OCR_RESOURCE_LIMIT","OCR job shape exceeds policy")
    return OcrJobUsage(pages=pages,regions=regions,persisted_observation_bytes=persisted_bytes)

def stop_reason(*,accepted=False,numeric_conflict=False,profiles_exhausted=False,resource_limited=False):
    if accepted:return "accepted"
    if numeric_conflict:return "review-required-numeric-conflict"
    if resource_limited:return "resource-limit"
    if profiles_exhausted:return "profiles-exhausted"
    return None
