/** Immutable lifecycle for one verified imported transfer handover. */
import { deepFreeze } from './revision-contract-utils.js';

export const REVISION_COMPARE_HANDOVER_INSPECTION_SCHEMA = 'RevisionCompareTransferHandoverInspectionState.v1';
export const REVISION_COMPARE_HANDOVER_INSPECTION_STATUS = Object.freeze({
  IDLE: 'IDLE', IMPORTING: 'IMPORTING', VERIFIED: 'VERIFIED', FAILED: 'FAILED',
});

function blank(requestGeneration = 0) {
  return {
    schema: REVISION_COMPARE_HANDOVER_INSPECTION_SCHEMA, status: 'IDLE', requestGeneration,
    fileName: '', sourceSizeBytes: 0, bundle: null, bundleId: null, bundleContentSha256: null,
    evidencePackageId: null, evidencePackageContentSha256: null,
    completionReportId: null, completionReportContentSha256: null,
    planId: null, planContentSha256: null, resultId: null, resultContentSha256: null,
    originalTargetDocumentId: null, originalTargetSha256: null,
    patchedTargetDocumentId: null, patchedTargetSha256: null, error: null,
  };
}
export function createRevisionCompareHandoverInspectionState() {
  return deepFreeze(blank());
}
export function startRevisionCompareHandoverInspection(state, file) {
  const current = state ?? createRevisionCompareHandoverInspectionState();
  if (current.status === 'VERIFIED') return current;
  return deepFreeze({
    ...blank(current.requestGeneration + 1), status: 'IMPORTING',
    fileName: String(file?.name ?? ''), sourceSizeBytes: Number(file?.size ?? 0),
  });
}
function verifiedFields(bundle) {
  const payload = bundle.payload; const result = payload.transferResult;
  return {
    bundle, bundleId: bundle.bundleId, bundleContentSha256: bundle.contentSha256,
    evidencePackageId: payload.evidencePackage.packageId,
    evidencePackageContentSha256: payload.evidencePackage.contentSha256,
    completionReportId: payload.completionReport.reportId,
    completionReportContentSha256: payload.completionReport.contentSha256,
    planId: payload.transferPlan.planId, planContentSha256: payload.transferPlan.contentSha256,
    resultId: result.resultId, resultContentSha256: result.contentSha256,
    originalTargetDocumentId: result.targetDocumentId, originalTargetSha256: result.originalTargetSha256,
    patchedTargetDocumentId: result.patchedTargetDocumentId, patchedTargetSha256: result.patchedTargetSha256,
  };
}
export function completeRevisionCompareHandoverInspection(state, generation, bundle) {
  if (state.requestGeneration !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({ ...state, status: 'VERIFIED', ...verifiedFields(bundle), error: null });
}
export function failRevisionCompareHandoverInspection(state, generation, error) {
  if (state.requestGeneration !== generation || state.status !== 'IMPORTING') return state;
  return deepFreeze({
    ...blank(generation), status: 'FAILED', fileName: state.fileName,
    sourceSizeBytes: state.sourceSizeBytes, error: String(error?.message ?? error),
  });
}
export function clearRevisionCompareHandoverInspection(state) {
  return deepFreeze(blank((state?.requestGeneration ?? 0) + 1));
}
