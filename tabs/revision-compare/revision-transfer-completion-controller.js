/** Atomic creation, retained downloads, and UI controller for transfer completion. */
import { deepFreeze, stableStringify } from './revision-contract-utils.js';
import { createRevisionCompareEvidencePackage } from './revision-evidence-package.js';
import { sha256Text } from './revision-hash.js';
import {
  createRevisionCompareTransferCompletionReport, normalizeRevisionCompareTransferCompletionDeclarant,
  revisionCompareTransferCompletionFileName, revisionCompareTransferCompletionReadiness,
  serializeRevisionCompareTransferCompletionReport, validateRevisionCompareTransferCompletionReportIdentity,
} from './revision-transfer-completion.js';
import {
  createRevisionCompareTransferHandoverBundle, revisionCompareTransferHandoverFileName,
  serializeRevisionCompareTransferHandoverBundle, validateRevisionCompareTransferHandoverBundleIdentity,
} from './revision-transfer-handover.js';

function byteSize(text) { return new TextEncoder().encode(text).byteLength; }
function reparse(text, value, label) { let parsed; try { parsed = JSON.parse(text); } catch (error) { throw new Error(`${label} serialization does not reparse: ${error.message}`); } if (stableStringify(parsed) !== stableStringify(value)) throw new Error(`${label} serialization changes the retained payload.`); }
async function retainedArtifact(kind, filename, text, cryptoRef) { return deepFreeze({ kind, filename, mimeType: 'application/json', text, contentSha256: await sha256Text(text, cryptoRef), sizeBytes: byteSize(text) }); }
export async function createRevisionCompareTransferCompletionApplication(workspace, input, declaredAt, options = {}) {
  const readiness = revisionCompareTransferCompletionReadiness(workspace); if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const cryptoRef = options.cryptoRef ?? globalThis.crypto; const creator = options.createEvidencePackage ?? createRevisionCompareEvidencePackage;
  const preflight = typeof options.preflight === 'function' ? options.preflight(workspace) : options.preflight;
  const evidencePackage = await creator(workspace, preflight, cryptoRef);
  const report = await createRevisionCompareTransferCompletionReport(workspace, evidencePackage, input, declaredAt, options);
  await validateRevisionCompareTransferCompletionReportIdentity(report, cryptoRef);
  const bundle = await createRevisionCompareTransferHandoverBundle({ workspace, evidencePackage, report }, { cryptoRef });
  await validateRevisionCompareTransferHandoverBundleIdentity(bundle, cryptoRef);
  const reportText = serializeRevisionCompareTransferCompletionReport(report); const bundleText = serializeRevisionCompareTransferHandoverBundle(bundle);
  reparse(reportText, report, 'Transfer completion report'); reparse(bundleText, bundle, 'Transfer handover bundle');
  const sessionId = workspace.session.sessionId;
  const reportArtifact = await retainedArtifact('TRANSFER_COMPLETION_REPORT', revisionCompareTransferCompletionFileName(sessionId, report.reportId), reportText, cryptoRef);
  const bundleArtifact = await retainedArtifact('TRANSFER_HANDOVER_BUNDLE', revisionCompareTransferHandoverFileName(sessionId, bundle.bundleId), bundleText, cryptoRef);
  return deepFreeze({ report, bundle, reportArtifact, bundleArtifact });
}
export async function validateRevisionCompareTransferCompletionDownload(artifact, cryptoRef) { if (!artifact || artifact.mimeType !== 'application/json' || typeof artifact.text !== 'string') throw new TypeError('A retained transfer completion JSON artifact is required.'); if (await sha256Text(artifact.text, cryptoRef) !== artifact.contentSha256) throw new Error('Retained transfer completion text SHA-256 does not match.'); if (byteSize(artifact.text) !== artifact.sizeBytes) throw new Error('Retained transfer completion byte size does not match.'); return artifact; }
export async function downloadRevisionCompareTransferCompletion(root, artifact, options = {}) { const windowRef = root?.ownerDocument?.defaultView; const cryptoRef = options.cryptoRef ?? windowRef?.crypto; await validateRevisionCompareTransferCompletionDownload(artifact, cryptoRef); const URLRef = options.URLRef ?? windowRef.URL; const BlobRef = options.BlobRef ?? windowRef.Blob; const url = URLRef.createObjectURL(new BlobRef([artifact.text], { type: artifact.mimeType })); const anchor = root.ownerDocument.createElement('a'); anchor.href = url; anchor.download = artifact.filename; try { root.appendChild(anchor); anchor.click(); } finally { anchor.remove(); URLRef.revokeObjectURL(url); } return artifact; }
export function revisionCompareTransferCompletionInput(root) { return { declarantName: root.querySelector('[data-revc-transfer-completion-name]')?.value ?? '', declarantRole: root.querySelector('[data-revc-transfer-completion-role]')?.value ?? '', organization: root.querySelector('[data-revc-transfer-completion-organization]')?.value ?? '', confirmed: Boolean(root.querySelector('[data-revc-transfer-completion-confirm]')?.checked) }; }
function validInput(input) { if (!input.confirmed) return false; try { normalizeRevisionCompareTransferCompletionDeclarant(input); return true; } catch { return false; } }
export function syncRevisionCompareTransferCompletionControls(root, state, busy = false) { const ready = revisionCompareTransferCompletionReadiness(state).status === 'READY'; const disabled = busy || !ready || !validInput(revisionCompareTransferCompletionInput(root)); root.querySelectorAll('[data-revc-create-transfer-completion],[data-revc-create-new-transfer-completion]').forEach((button) => { button.disabled = disabled; }); }
function attribute(target, name) { return Boolean(target?.hasAttribute?.(name)); }
export function createRevisionCompareTransferCompletionController(options) {
  let destroyed = false; let busy = false; const deps = options.dependencies;
  function commit(next) { if (!destroyed && next !== options.readState()) { options.writeState(next); options.render(next); } }
  function sync() { if (!destroyed) syncRevisionCompareTransferCompletionControls(options.root, options.readState(), busy); }
  async function create() { if (busy) return; const captured = options.readState(); const input = revisionCompareTransferCompletionInput(options.root); if (!input.confirmed) throw new Error('Confirm the fixed patched-target completion declaration before creation.'); const declaredAt = options.now(); busy = true; sync(); try { const application = await createRevisionCompareTransferCompletionApplication(captured, input, declaredAt, { cryptoRef: options.cryptoRef, preflight: deps.preflight, createEvidencePackage: deps.createEvidencePackage, captureTransferAuthority: deps.captureTransferAuthority, planTransferAuthority: deps.planTransferAuthority }); if (destroyed) return; const next = deps.complete(options.readState(), captured, application); commit(next); if (next.transferCompletion.status !== 'CREATED') throw new Error(next.transferCompletion.error ?? 'Transfer completion authority changed during creation.'); options.showToast?.('Patched-target completion report and handover bundle created.', 'success'); } catch (error) { if (!destroyed) { commit(deps.fail(options.readState(), error)); throw error; } } finally { busy = false; sync(); } }
  async function download(kind) { const state = options.readState(); if (state.transferCompletion?.status !== 'CREATED') throw new Error('Only a current CREATED transfer completion can download.'); const artifact = kind === 'REPORT' ? state.transferCompletion.reportArtifact : state.transferCompletion.bundleArtifact; return downloadRevisionCompareTransferCompletion(options.root, artifact, { cryptoRef: options.cryptoRef }); }
  async function handleClick(button) { try { if (attribute(button, 'data-revc-create-transfer-completion') || attribute(button, 'data-revc-create-new-transfer-completion')) await create(); else if (attribute(button, 'data-revc-download-transfer-completion')) await download('REPORT'); else if (attribute(button, 'data-revc-download-transfer-handover')) await download('BUNDLE'); } catch (error) { options.reportFailure(error); } }
  return Object.freeze({ handleClick, handleInput: sync, sync, busy: () => busy, destroy: () => { destroyed = true; busy = false; } });
}
export const _test = Object.freeze({ attribute, byteSize, reparsed: reparse, retainedArtifact, validInput });
