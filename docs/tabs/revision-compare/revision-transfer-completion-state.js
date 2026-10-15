/** Immutable WorkspaceState lifecycle for patched-target completion evidence. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import {
  REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA,
  revisionCompareTransferCompletionReadiness,
} from './revision-transfer-completion.js';
import { REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA } from './revision-transfer-handover.js';

export const REVISION_COMPARE_TRANSFER_COMPLETION_STATE_SCHEMA = 'RevisionCompareTransferCompletionState.v1';
export const REVISION_COMPARE_TRANSFER_COMPLETION_STATUS = Object.freeze({
  IDLE: 'IDLE', READY: 'READY', CREATED: 'CREATED', STALE: 'STALE', FAILED: 'FAILED',
});

function same(left, right) { return stableStringify(left) === stableStringify(right); }
function blank(status = 'IDLE') {
  return {
    schema: REVISION_COMPARE_TRANSFER_COMPLETION_STATE_SCHEMA, status,
    report: null, bundle: null, reportArtifact: null, bundleArtifact: null,
    sourceEvidencePackageId: null, sourceEvidencePackageContentSha256: null,
    sourcePlanId: null, sourcePlanContentSha256: null,
    sourceResultId: null, sourceResultContentSha256: null,
    sourcePatchedTargetSha256: null, error: null,
  };
}
function transferArtifactReference(item) {
  return {
    descriptorSchema: item?.descriptorSchema ?? null, filename: item?.filename ?? null,
    schema: item?.schema ?? null, mimeType: item?.mimeType ?? null,
    contentSha256: item?.contentSha256 ?? null, sizeBytes: item?.sizeBytes ?? null,
  };
}
function completionArtifactValue(artifact, label) {
  if (!artifact || artifact.mimeType !== 'application/json' || typeof artifact.text !== 'string') {
    throw new TypeError(`${label} retained JSON artifact is required.`);
  }
  try { return JSON.parse(artifact.text); }
  catch (error) { throw new TypeError(`${label} retained JSON artifact is invalid: ${error.message}`); }
}
function reportWorkspaceErrors(report, workspace) {
  const transfer = workspace?.transfer; const result = transfer?.result;
  const source = report?.sourceEvidence ?? {}; const evidence = report?.transferEvidence ?? {};
  const expectedDescriptors = (transfer?.artifacts ?? []).map(transferArtifactReference);
  const errors = [];
  if (source.sessionId !== workspace?.session?.sessionId || source.basisId !== workspace?.basis?.basisId
      || source.auditId !== workspace?.compare?.audit?.auditId
      || source.reviewSessionId !== workspace?.review?.session?.reviewSessionId
      || source.reviewRevision !== workspace?.review?.session?.revision
      || source.decisionLedgerId !== workspace?.decision?.ledger?.ledgerId
      || source.decisionRevision !== workspace?.decision?.ledger?.revision) {
    errors.push('Completion report review authority does not match the current workspace.');
  }
  if (evidence.planId !== transfer?.plan?.planId || evidence.planContentSha256 !== transfer?.plan?.contentSha256
      || evidence.resultId !== result?.resultId || evidence.resultContentSha256 !== result?.contentSha256
      || evidence.originalTargetDocumentId !== result?.targetDocumentId
      || evidence.originalTargetSha256 !== result?.originalTargetSha256
      || evidence.patchedTargetDocumentId !== result?.patchedTargetDocumentId
      || evidence.patchedTargetSha256 !== result?.patchedTargetSha256
      || evidence.transferAuditContentSha256 !== transfer?.audit?.contentSha256
      || evidence.transferProofContentSha256 !== transfer?.proof?.contentSha256
      || evidence.transferManifestContentSha256 !== transfer?.manifest?.contentSha256
      || !same(evidence.artifactDescriptors, expectedDescriptors)) {
    errors.push('Completion report transfer authority does not match the current APPLIED evidence.');
  }
  return errors;
}
function bundleApplicationErrors(application, workspace) {
  const report = application.report; const bundle = application.bundle; const transfer = workspace.transfer;
  const payload = bundle?.payload ?? {}; const identity = bundle?.identity ?? {}; const errors = [];
  if (identity.sessionId !== workspace.session?.sessionId
      || identity.evidencePackageId !== report.sourceEvidence?.packageId
      || identity.completionReportId !== report.reportId
      || identity.planId !== transfer.plan?.planId || identity.resultId !== transfer.result?.resultId
      || identity.originalTargetSha256 !== transfer.result?.originalTargetSha256
      || identity.patchedTargetSha256 !== transfer.result?.patchedTargetSha256) {
    errors.push('Transfer handover identity does not match the current completion authority.');
  }
  if (payload.evidencePackage?.packageId !== report.sourceEvidence?.packageId
      || payload.evidencePackage?.contentSha256 !== report.sourceEvidence?.packageContentSha256
      || !same(payload.transferPlan, transfer.plan) || !same(payload.transferResult, transfer.result)
      || !same(payload.transferAudit, transfer.audit) || !same(payload.transferProof, transfer.proof)
      || !same(payload.transferManifest, transfer.manifest)
      || !same(payload.transferArtifacts, transfer.artifacts)
      || !same(payload.completionReport, report)) {
    errors.push('Transfer handover payload does not contain the exact current authorities.');
  }
  return errors;
}
export function validateRevisionCompareTransferCompletionApplication(application, workspace) {
  const report = application?.report; const bundle = application?.bundle;
  if (report?.schema !== REVISION_COMPARE_TRANSFER_COMPLETION_REPORT_SCHEMA
      || bundle?.schema !== REVISION_COMPARE_TRANSFER_HANDOVER_BUNDLE_SCHEMA) {
    throw new TypeError('One complete transfer completion report and handover bundle are required.');
  }
  const errors = [...reportWorkspaceErrors(report, workspace), ...bundleApplicationErrors(application, workspace)];
  if (!same(completionArtifactValue(application.reportArtifact, 'Transfer completion report'), report)) {
    errors.push('Retained transfer completion report text does not match the report authority.');
  }
  if (!same(completionArtifactValue(application.bundleArtifact, 'Transfer handover bundle'), bundle)) {
    errors.push('Retained transfer handover text does not match the bundle authority.');
  }
  if (errors.length) throw new Error(errors.join(' '));
  return application;
}

export function createRevisionCompareTransferCompletionState() { return deepFreeze(blank()); }
export function revisionCompareTransferCompletionStateForReadiness(workspace) {
  const current = workspace?.transferCompletion;
  if (current?.report) return current;
  const status = revisionCompareTransferCompletionReadiness(workspace).status === 'READY' ? 'READY' : 'IDLE';
  return deepFreeze(blank(status));
}
export function completeRevisionCompareTransferCompletionState(application, workspace) {
  validateRevisionCompareTransferCompletionApplication(application, workspace);
  const report = application.report; const bundle = application.bundle;
  const state = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_COMPLETION_STATE_SCHEMA, status: 'CREATED', report, bundle,
    reportArtifact: application.reportArtifact, bundleArtifact: application.bundleArtifact,
    sourceEvidencePackageId: report.sourceEvidence.packageId,
    sourceEvidencePackageContentSha256: report.sourceEvidence.packageContentSha256,
    sourcePlanId: report.transferEvidence.planId,
    sourcePlanContentSha256: report.transferEvidence.planContentSha256,
    sourceResultId: report.transferEvidence.resultId,
    sourceResultContentSha256: report.transferEvidence.resultContentSha256,
    sourcePatchedTargetSha256: report.transferEvidence.patchedTargetSha256, error: null,
  });
  assertJsonSafe(state, REVISION_COMPARE_TRANSFER_COMPLETION_STATE_SCHEMA); return state;
}
export function failRevisionCompareTransferCompletionState(error) {
  return deepFreeze({ ...blank('FAILED'), error: String(error?.message ?? error) });
}
export function staleRevisionCompareTransferCompletionState(state) {
  if (!state?.report || state.status === 'STALE') return state ?? createRevisionCompareTransferCompletionState();
  return deepFreeze({ ...state, status: 'STALE', error: null });
}
function patchedSnapshotReference(snapshot) {
  return {
    sourceDocumentId: snapshot?.sourceDocumentId ?? null,
    sourceContentSha256: snapshot?.sourceContentSha256 ?? null,
    rootKind: snapshot?.rootKind ?? null, profile: snapshot?.profile ?? null,
  };
}
export function captureRevisionCompareTransferCompletionAuthority(workspace) {
  const transfer = workspace?.transfer;
  return deepFreeze({
    sessionId: workspace?.session?.sessionId ?? null, basisId: workspace?.basis?.basisId ?? null,
    auditId: workspace?.compare?.audit?.auditId ?? null,
    reviewSessionId: workspace?.review?.session?.reviewSessionId ?? null,
    reviewRevision: workspace?.review?.session?.revision ?? null,
    decisionLedgerId: workspace?.decision?.ledger?.ledgerId ?? null,
    decisionRevision: workspace?.decision?.ledger?.revision ?? null,
    transferStatus: transfer?.status ?? null, selection: transfer?.selection ?? null,
    policyVersion: transfer?.policyVersion ?? null,
    planId: transfer?.plan?.planId ?? null, planContentSha256: transfer?.plan?.contentSha256 ?? null,
    resultId: transfer?.result?.resultId ?? null, resultContentSha256: transfer?.result?.contentSha256 ?? null,
    transferAuditId: transfer?.audit?.auditId ?? null,
    transferAuditContentSha256: transfer?.audit?.contentSha256 ?? null,
    transferProofId: transfer?.proof?.proofId ?? null,
    transferProofContentSha256: transfer?.proof?.contentSha256 ?? null,
    transferManifestId: transfer?.manifest?.manifestId ?? null,
    transferManifestContentSha256: transfer?.manifest?.contentSha256 ?? null,
    artifactDescriptors: (transfer?.artifacts ?? []).map(transferArtifactReference),
    patchedSnapshot: patchedSnapshotReference(transfer?.patchedSnapshot),
  });
}
export function revisionCompareTransferCompletionAuthorityMatches(before, after) {
  return same(captureRevisionCompareTransferCompletionAuthority(before), captureRevisionCompareTransferCompletionAuthority(after))
    && revisionCompareTransferCompletionReadiness(after).status === 'READY';
}
export const _test = Object.freeze({
  blank, bundleApplicationErrors, completionArtifactValue, patchedSnapshotReference,
  reportWorkspaceErrors, transferArtifactReference,
});
