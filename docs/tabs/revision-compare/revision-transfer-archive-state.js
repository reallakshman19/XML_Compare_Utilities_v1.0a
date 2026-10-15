/** Immutable workspace lifecycle for deterministic offline transfer archives. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { captureRevisionCompareTransferCompletionAuthority } from './revision-transfer-completion-state.js';
import { REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA, revisionCompareTransferArchiveReadiness } from './revision-transfer-archive.js';

export const REVISION_COMPARE_TRANSFER_ARCHIVE_STATE_SCHEMA = 'RevisionCompareTransferArchiveState.v1';
export const REVISION_COMPARE_TRANSFER_ARCHIVE_STATUS = Object.freeze({ IDLE: 'IDLE', READY: 'READY', CREATED: 'CREATED', STALE: 'STALE', FAILED: 'FAILED' });
function blank(status = 'IDLE') { return { schema: REVISION_COMPARE_TRANSFER_ARCHIVE_STATE_SCHEMA, status, artifact: null, sourceBundleId: null, sourceBundleContentSha256: null, sourceCompletionReportId: null, sourceCompletionReportContentSha256: null, sourcePatchedTargetSha256: null, error: null }; }
function artifactReference(item) { return { schema: item?.schema ?? null, classification: item?.classification ?? null, filename: item?.filename ?? null, mimeType: item?.mimeType ?? null, contentSha256: item?.contentSha256 ?? null, sizeBytes: item?.sizeBytes ?? null }; }
export function createRevisionCompareTransferArchiveState() { return deepFreeze(blank()); }
export function revisionCompareTransferArchiveStateForReadiness(workspace) {
  const current = workspace?.transferArchive; if (current?.artifact) return current;
  return deepFreeze(blank(revisionCompareTransferArchiveReadiness(workspace).status === 'READY' ? 'READY' : 'IDLE'));
}
export function completeRevisionCompareTransferArchiveState(artifact, workspace) {
  if (artifact?.schema !== REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA) throw new TypeError('One transfer archive artifact is required.');
  const completion = workspace.transferCompletion; if (artifact.sourceBundleId !== completion.bundle?.bundleId || artifact.sourceBundleContentSha256 !== completion.bundle?.contentSha256 || artifact.sourceCompletionReportId !== completion.report?.reportId || artifact.sourceCompletionReportContentSha256 !== completion.report?.contentSha256 || artifact.sourcePatchedTargetSha256 !== completion.report?.transferEvidence?.patchedTargetSha256) throw new Error('Offline transfer archive source identities do not match the current completion authority.');
  const state = deepFreeze({ schema: REVISION_COMPARE_TRANSFER_ARCHIVE_STATE_SCHEMA, status: 'CREATED', artifact, sourceBundleId: artifact.sourceBundleId, sourceBundleContentSha256: artifact.sourceBundleContentSha256, sourceCompletionReportId: artifact.sourceCompletionReportId, sourceCompletionReportContentSha256: artifact.sourceCompletionReportContentSha256, sourcePatchedTargetSha256: artifact.sourcePatchedTargetSha256, error: null });
  assertJsonSafe(state, REVISION_COMPARE_TRANSFER_ARCHIVE_STATE_SCHEMA); return state;
}
export function failRevisionCompareTransferArchiveState(error, prior) {
  const message = String(error?.message ?? error);
  return prior?.artifact ? deepFreeze({ ...prior, error: message }) : deepFreeze({ ...blank('FAILED'), error: message });
}
export function staleRevisionCompareTransferArchiveState(state) { if (!state?.artifact || state.status === 'STALE') return state ?? createRevisionCompareTransferArchiveState(); return deepFreeze({ ...state, status: 'STALE', error: null }); }
export function captureRevisionCompareTransferArchiveAuthority(workspace) {
  const completion = workspace?.transferCompletion;
  return deepFreeze({ completionAuthority: captureRevisionCompareTransferCompletionAuthority(workspace), completionStatus: completion?.status ?? null, reportId: completion?.report?.reportId ?? null, reportContentSha256: completion?.report?.contentSha256 ?? null, bundleId: completion?.bundle?.bundleId ?? null, bundleContentSha256: completion?.bundle?.contentSha256 ?? null, reportArtifact: artifactReference(completion?.reportArtifact), bundleArtifact: artifactReference(completion?.bundleArtifact) });
}
export function revisionCompareTransferArchiveAuthorityMatches(before, after) { return stableStringify(captureRevisionCompareTransferArchiveAuthority(before)) === stableStringify(captureRevisionCompareTransferArchiveAuthority(after)) && revisionCompareTransferArchiveReadiness(after).status === 'READY'; }
export const _test = Object.freeze({ artifactReference, blank });
