/** Pure readiness and workspace reconstruction for swapping loaded revision roles. */
import { finishWorkspaceLoad, startWorkspaceLoad } from './revision-workspace-state.js';

const SWAPPABLE_STATUSES = Object.freeze(['READY', 'SCOPED']);

function slotIsSwappable(slot) {
  return Boolean(slot?.document && slot?.jsonSnapshot && SWAPPABLE_STATUSES.includes(slot.status));
}

export function revisionCompareSwapReadiness(state) {
  const blockers = [];
  if (state?.evidencePackageImport?.status === 'VERIFIED') {
    blockers.push('Imported evidence workspaces are read-only.');
  }
  if (!slotIsSwappable(state?.slots?.baseline)) blockers.push('Load a valid Rev A before swapping revisions.');
  if (!slotIsSwappable(state?.slots?.candidate)) blockers.push('Load a valid Rev B before swapping revisions.');
  return Object.freeze({
    status: blockers.length ? 'BLOCKED' : 'READY',
    blockers: Object.freeze(blockers),
  });
}

function assertSwapResult(result, slotId) {
  if (!result?.document || !result?.jsonSnapshot) throw new TypeError(`Swapped ${slotId} result is incomplete.`);
  if (result.document.slotId !== slotId) throw new TypeError(`Swapped ${slotId} document has the wrong slot identity.`);
  if (result.jsonSnapshot.sourceDocumentId !== result.document.documentId) {
    throw new TypeError(`Swapped ${slotId} snapshot does not match its document identity.`);
  }
}

function beginSwappedLoad(state, slotId, result, updatedAt) {
  return startWorkspaceLoad(
    state,
    slotId,
    result.generation,
    result.document.fileName,
    result.document.fileSizeBytes,
    updatedAt,
  );
}

export function applyRevisionCompareSwapResults(state, results, updatedAt) {
  const readiness = revisionCompareSwapReadiness(state);
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  assertSwapResult(results?.baseline, 'baseline');
  assertSwapResult(results?.candidate, 'candidate');
  let next = beginSwappedLoad(state, 'baseline', results.baseline, updatedAt);
  next = beginSwappedLoad(next, 'candidate', results.candidate, updatedAt);
  next = finishWorkspaceLoad(next, 'baseline', results.baseline, updatedAt);
  return finishWorkspaceLoad(next, 'candidate', results.candidate, updatedAt);
}

export const _test = Object.freeze({ assertSwapResult, slotIsSwappable });
