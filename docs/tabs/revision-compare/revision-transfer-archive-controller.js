/** Explicit archive creation, byte-checked download, and presentation-only print boundary. */
import { createRevisionCompareTransferArchiveArtifact, revisionCompareTransferArchiveReadiness, validateRevisionCompareTransferArchiveArtifact } from './revision-transfer-archive.js';
function attribute(target, name) { return Boolean(target?.hasAttribute?.(name)); }
function printTarget(windowRef, cleanup) {
  return { document: windowRef.document, focus: () => windowRef.focus?.(), print: () => { windowRef.addEventListener?.('afterprint', cleanup, { once: true }); windowRef.print(); } };
}
export async function downloadRevisionCompareTransferArchive(root, artifact, options = {}) {
  const windowRef = root.ownerDocument.defaultView; await validateRevisionCompareTransferArchiveArtifact(artifact, options.cryptoRef ?? windowRef.crypto);
  const URLRef = options.URLRef ?? windowRef.URL; const BlobRef = options.BlobRef ?? windowRef.Blob;
  const url = URLRef.createObjectURL(new BlobRef([artifact.text], { type: artifact.mimeType })); const anchor = root.ownerDocument.createElement('a'); anchor.href = url; anchor.download = artifact.filename;
  try { root.appendChild(anchor); anchor.click(); } finally { anchor.remove(); URLRef.revokeObjectURL(url); }
  return artifact;
}
export async function printRevisionCompareTransferArchive(printWindow, artifact, cryptoRef) {
  if (!printWindow) throw new Error('The print window could not be opened.');
  await validateRevisionCompareTransferArchiveArtifact(artifact, cryptoRef);
  printWindow.document.open(); printWindow.document.write(artifact.text); printWindow.document.close(); printWindow.focus?.(); printWindow.print(); return artifact;
}
export function syncRevisionCompareTransferArchiveControls(root, state, busy = false) {
  const ready = revisionCompareTransferArchiveReadiness(state).status === 'READY';
  root.querySelectorAll('[data-revc-create-transfer-archive],[data-revc-create-new-transfer-archive]').forEach((button) => { button.disabled = busy || !ready; });
}
export function createRevisionCompareTransferArchiveController(options) {
  let destroyed = false; let busy = false; const printWindows = new Set(); const deps = options.dependencies;
  function commit(next) { if (!destroyed && next !== options.readState()) { options.writeState(next); options.render(next); } }
  function completionBusy() { return options.isCompletionBusy?.() === true; }
  function sync() { if (!destroyed) syncRevisionCompareTransferArchiveControls(options.root, options.readState(), busy || completionBusy()); }
  async function create() { if (busy) return; if (completionBusy()) throw new Error('Wait for active patched-target completion creation to finish.'); const captured = options.readState(); busy = true; sync(); try { const artifact = await createRevisionCompareTransferArchiveArtifact(captured, { cryptoRef: options.cryptoRef }); if (destroyed) return; const next = deps.complete(options.readState(), captured, artifact); commit(next); if (next.transferArchive.status !== 'CREATED') throw new Error(next.transferArchive.error ?? 'Offline transfer archive authority changed during creation.'); options.showToast?.('Offline transfer archive created.', 'success'); } catch (error) { if (!destroyed) { commit(deps.fail(options.readState(), error)); throw error; } } finally { busy = false; sync(); } }
  function retained() { const state = options.readState(); const artifact = state.transferArchive?.artifact; if (!artifact || !['CREATED', 'STALE'].includes(state.transferArchive.status)) throw new Error('No current or historical offline transfer archive is available.'); return artifact; }
  async function print() { const windowRef = options.openWindow?.() ?? options.root.ownerDocument.defaultView.open('', '_blank'); if (windowRef) printWindows.add(windowRef); const cleanup = () => { printWindows.delete(windowRef); windowRef?.close?.(); }; try { return await printRevisionCompareTransferArchive(windowRef ? printTarget(windowRef, cleanup) : null, retained(), options.cryptoRef); } catch (error) { cleanup(); throw error; } }
  async function handleClick(button) { try { if (attribute(button, 'data-revc-create-transfer-archive') || attribute(button, 'data-revc-create-new-transfer-archive')) await create(); else if (attribute(button, 'data-revc-download-transfer-archive')) await downloadRevisionCompareTransferArchive(options.root, retained(), { cryptoRef: options.cryptoRef }); else if (attribute(button, 'data-revc-print-transfer-archive')) await print(); } catch (error) { options.reportFailure(error); } }
  return Object.freeze({ handleClick, sync, busy: () => busy, destroy: () => { destroyed = true; busy = false; printWindows.forEach((item) => item.close?.()); printWindows.clear(); } });
}
export const _test = Object.freeze({ attribute });
