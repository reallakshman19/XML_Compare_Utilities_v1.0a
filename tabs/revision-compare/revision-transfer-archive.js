/** Deterministic offline archive artifact and fail-closed source validation. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { serializeRevisionCompareTransferCompletionReport, validateRevisionCompareTransferCompletionReportIdentity } from './revision-transfer-completion.js';
import { serializeRevisionCompareTransferHandoverBundle, validateRevisionCompareTransferHandoverBundleIdentity } from './revision-transfer-handover.js';
import { validateRevisionCompareTransferCompletionApplication } from './revision-transfer-completion-state.js';
import { extractRevisionCompareTransferArchiveBundle, renderRevisionCompareTransferArchiveHtml } from './revision-transfer-archive-html.js';

export const REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA = 'RevisionCompareTransferArchiveArtifact.v1';
export const REVISION_COMPARE_TRANSFER_ARCHIVE_CLASSIFICATION = 'PRESENTATION_ONLY';
function byteSize(text) { return new TextEncoder().encode(text).byteLength; }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function activeComparison(state) { return ['PROJECTING', 'COMPARING', 'BUILDING_VISUAL'].includes(state?.compare?.status); }
export function revisionCompareTransferArchiveReadiness(state) {
  const blockers = []; const completion = state?.transferCompletion;
  if (completion?.status !== 'CREATED') blockers.push('Offline transfer archive requires one current CREATED patched-target completion.');
  if (!completion?.report || !completion?.bundle) blockers.push('Offline transfer archive requires the retained completion report and handover bundle.');
  if (!completion?.reportArtifact || !completion?.bundleArtifact) blockers.push('Offline transfer archive requires retained completion and handover JSON artifacts.');
  if (state?.slots?.baseline?.status === 'LOADING' || state?.slots?.candidate?.status === 'LOADING') blockers.push('Wait for active revision source loading to finish.');
  if (activeComparison(state)) blockers.push('Wait for active comparison execution to finish.');
  if (state?.transfer?.request) blockers.push('Wait for the active transfer-plan request to finish.');
  if (state?.transfer?.applyRequest) blockers.push('Wait for the active transfer apply request to finish.');
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}
async function validateJsonArtifact(artifact, value, expectedText, label, cryptoRef) {
  if (!artifact || artifact.mimeType !== 'application/json' || typeof artifact.text !== 'string') throw new TypeError(`${label} retained JSON artifact is required.`);
  if (await sha256Text(artifact.text, cryptoRef) !== artifact.contentSha256) throw new Error(`${label} retained SHA-256 does not match.`);
  if (byteSize(artifact.text) !== artifact.sizeBytes) throw new Error(`${label} retained byte size does not match.`);
  if (artifact.text !== expectedText) throw new Error(`${label} retained text does not match the canonical serialization.`);
  let parsed; try { parsed = JSON.parse(artifact.text); } catch (error) { throw new Error(`${label} retained JSON is invalid: ${error.message}`); }
  if (!same(parsed, value)) throw new Error(`${label} retained JSON does not match its authority.`);
}
async function validateEmbeddedArtifacts(bundle, cryptoRef) {
  const artifacts = bundle?.payload?.transferArtifacts; const result = bundle?.payload?.transferResult;
  if (!Array.isArray(artifacts) || artifacts.length !== 4) throw new Error('Handover bundle must contain exactly four transfer artifacts.');
  for (const item of artifacts) {
    if (item?.descriptorSchema !== 'RevisionCompareTransferArtifact.v1' || typeof item.text !== 'string') throw new Error('Embedded transfer artifact descriptor is invalid.');
    if (await sha256Text(item.text, cryptoRef) !== item.contentSha256) throw new Error(`Embedded transfer artifact SHA-256 mismatch for ${item.filename}.`);
    if (byteSize(item.text) !== item.sizeBytes) throw new Error(`Embedded transfer artifact byte-size mismatch for ${item.filename}.`);
  }
  const patched = artifacts[0];
  if (patched.text !== result?.patchedTargetText || patched.contentSha256 !== result?.patchedTargetSha256) throw new Error('Embedded patched-target artifact does not match the transfer result.');
}
export async function validateRevisionCompareTransferArchiveAuthority(workspace, cryptoRef = globalThis.crypto) {
  const readiness = revisionCompareTransferArchiveReadiness(workspace); if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const completion = workspace.transferCompletion; const report = completion.report; const bundle = completion.bundle;
  await validateRevisionCompareTransferCompletionReportIdentity(report, cryptoRef);
  await validateJsonArtifact(completion.reportArtifact, report, serializeRevisionCompareTransferCompletionReport(report), 'Transfer completion report', cryptoRef);
  await validateEmbeddedArtifacts(bundle, cryptoRef);
  await validateRevisionCompareTransferHandoverBundleIdentity(bundle, cryptoRef);
  await validateJsonArtifact(completion.bundleArtifact, bundle, serializeRevisionCompareTransferHandoverBundle(bundle), 'Transfer handover bundle', cryptoRef);
  validateRevisionCompareTransferCompletionApplication({ report, bundle, reportArtifact: completion.reportArtifact, bundleArtifact: completion.bundleArtifact }, workspace);
  if (!same(bundle.payload?.completionReport, report)) throw new Error('Handover bundle does not contain the exact current completion report.');
  return bundle;
}
function safe(value) { return String(value ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '_'); }
export function revisionCompareTransferArchiveFileName(sessionId, bundleId) {
  if (!safe(sessionId) || !safe(bundleId)) throw new TypeError('Session ID and bundle ID are required for the archive filename.');
  return `${safe(sessionId)}.${safe(bundleId)}.offline-transfer-archive.html`;
}
export async function createRevisionCompareTransferArchiveArtifact(workspace, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto; const bundle = await validateRevisionCompareTransferArchiveAuthority(workspace, cryptoRef);
  const text = renderRevisionCompareTransferArchiveHtml(bundle); const extracted = extractRevisionCompareTransferArchiveBundle(text);
  if (!same(extracted, bundle)) throw new Error('Embedded handover bundle does not reparse to the retained authority.');
  const report = workspace.transferCompletion.report; const artifact = deepFreeze({
    schema: REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA, classification: REVISION_COMPARE_TRANSFER_ARCHIVE_CLASSIFICATION,
    sourceBundleId: bundle.bundleId, sourceBundleContentSha256: bundle.contentSha256,
    sourceCompletionReportId: report.reportId, sourceCompletionReportContentSha256: report.contentSha256,
    sourcePatchedTargetSha256: report.transferEvidence.patchedTargetSha256,
    filename: revisionCompareTransferArchiveFileName(workspace.session.sessionId, bundle.bundleId), mimeType: 'text/html', text,
    contentSha256: await sha256Text(text, cryptoRef), sizeBytes: byteSize(text), validation: { status: 'READY', errors: Object.freeze([]) },
  });
  assertJsonSafe(artifact, REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA); return artifact;
}
export async function validateRevisionCompareTransferArchiveArtifact(artifact, cryptoRef = globalThis.crypto) {
  if (artifact?.schema !== REVISION_COMPARE_TRANSFER_ARCHIVE_ARTIFACT_SCHEMA || artifact.classification !== REVISION_COMPARE_TRANSFER_ARCHIVE_CLASSIFICATION || artifact.mimeType !== 'text/html' || artifact.validation?.status !== 'READY' || typeof artifact.text !== 'string') throw new TypeError('A READY RevisionCompareTransferArchiveArtifact.v1 is required.');
  if (await sha256Text(artifact.text, cryptoRef) !== artifact.contentSha256) throw new Error('Offline transfer archive SHA-256 does not match.');
  if (byteSize(artifact.text) !== artifact.sizeBytes) throw new Error('Offline transfer archive UTF-8 byte size does not match.');
  return artifact;
}
export const _test = Object.freeze({ activeComparison, byteSize, safe, validateEmbeddedArtifacts, validateJsonArtifact });
