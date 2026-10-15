/** Immutable RC-002 comparison lifecycle and visual-review UI state. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  normalizeRevisionCompareViewerBackend,
} from './revision-compare-viewer-backend.js';
import {
  REVISION_COMPARE_DEFAULT_VIEWER_POLICY,
  createRevisionCompareViewerPolicy,
} from './revision-compare-viewer-policy.js';

export const COMPARE_STATUS = Object.freeze({
  IDLE: 'IDLE', READY: 'READY', PROJECTING: 'PROJECTING', COMPARING: 'COMPARING',
  BUILDING_VISUAL: 'BUILDING_VISUAL', COMPLETE: 'COMPLETE', CANCELLED: 'CANCELLED', FAILED: 'FAILED', STALE: 'STALE',
});
function defaultQueue() {
  return deepFreeze({ categories: ['CHANGED', 'ADDED', 'REMOVED'], needsDecisionOnly: false, changedReasons: ['GEOMETRY', 'PROPERTIES', 'CONNECTIVITY', 'SUPPORT_HIERARCHY'], search: '' });
}
export function createComparisonLifecycleState(viewerPolicy = REVISION_COMPARE_DEFAULT_VIEWER_POLICY) {
  const policy = createRevisionCompareViewerPolicy(viewerPolicy);
  return deepFreeze({
    schema: 'RevisionCompareLifecycle.v1', status: COMPARE_STATUS.IDLE, runGeneration: 0, runId: null,
    progress: null, audit: null, auditBasisId: null, error: null,
    presentationMode: policy.defaultSvgPresentation, viewerBackend: policy.defaultBackend, viewerPolicy: policy,
    queue: defaultQueue(), selectedDifferenceId: null, reviewVisible: false,
  });
}
export function invalidateComparisonState(compare) {
  const hadResult = Boolean(compare.audit || compare.runId);
  return deepFreeze({
    ...compare, status: hadResult ? COMPARE_STATUS.STALE : COMPARE_STATUS.IDLE,
    runGeneration: compare.runGeneration + 1, runId: null, progress: null, audit: null,
    auditBasisId: null, error: null, selectedDifferenceId: null, reviewVisible: false,
  });
}
export function readyComparisonState(compare) { return deepFreeze({ ...invalidateComparisonState(compare), status: COMPARE_STATUS.READY }); }
export function startComparisonState(compare, token) {
  return deepFreeze({
    ...compare, status: COMPARE_STATUS.PROJECTING, runGeneration: token.generation, runId: token.runId,
    progress: { stage: 'Projecting Rev A scope', recordsProcessed: 0, candidatePairsEvaluated: 0, maximumCandidatesForOneRecord: 0 },
    error: null, reviewVisible: false,
  });
}
function statusForStage(stage) {
  if (/Projecting/.test(stage)) return COMPARE_STATUS.PROJECTING;
  if (stage === 'Building visual review') return COMPARE_STATUS.BUILDING_VISUAL;
  return COMPARE_STATUS.COMPARING;
}
export function progressComparisonState(compare, token, progress) {
  if (compare.runGeneration !== token.generation) return compare;
  return deepFreeze({ ...compare, status: statusForStage(progress.stage), progress });
}
function firstQueueRow(audit) { return audit.differenceRows.find((row) => row.differenceCategory !== 'UNCHANGED')?.differenceId ?? audit.differenceRows[0]?.differenceId ?? null; }
export function completeComparisonState(compare, token, audit) {
  if (compare.runGeneration !== token.generation) return compare;
  return deepFreeze({
    ...compare, status: COMPARE_STATUS.COMPLETE, runId: null, progress: null, audit,
    auditBasisId: audit.basisId, error: null, selectedDifferenceId: firstQueueRow(audit), reviewVisible: true,
  });
}
export function cancelComparisonState(compare) {
  return deepFreeze({
    ...compare, status: compare.audit ? COMPARE_STATUS.COMPLETE : COMPARE_STATUS.CANCELLED,
    runGeneration: compare.runGeneration + 1, runId: null, progress: null, error: null,
    reviewVisible: Boolean(compare.audit),
  });
}
export function failComparisonState(compare, error) {
  return deepFreeze({ ...compare, status: COMPARE_STATUS.FAILED, runId: null, progress: null, error: String(error?.message ?? error), reviewVisible: Boolean(compare.audit) });
}
export function setComparisonSelection(compare, differenceId) {
  if (!compare.audit?.differenceRows.some((row) => row.differenceId === differenceId)) return compare;
  return deepFreeze({ ...compare, selectedDifferenceId: differenceId });
}
export function setComparisonPresentation(compare, mode) { return deepFreeze({ ...compare, presentationMode: mode === 'side-by-side' ? 'side-by-side' : 'overlay' }); }
export function setComparisonViewerBackend(compare, backend) {
  const viewerBackend = normalizeRevisionCompareViewerBackend(backend);
  return viewerBackend === compare.viewerBackend ? compare : deepFreeze({ ...compare, viewerBackend });
}
export function setComparisonQueueSearch(compare, value) { return deepFreeze({ ...compare, queue: { ...compare.queue, search: String(value ?? '') } }); }
export function toggleComparisonCategory(compare, category) {
  const current = new Set(compare.queue.categories); if (current.has(category)) current.delete(category); else current.add(category);
  return deepFreeze({ ...compare, queue: { ...compare.queue, categories: [...current].sort() } });
}
export function toggleChangedReason(compare, reason) {
  const current = new Set(compare.queue.changedReasons); if (current.has(reason)) current.delete(reason); else current.add(reason);
  return deepFreeze({ ...compare, queue: { ...compare.queue, changedReasons: [...current].sort() } });
}
export function setNeedsDecisionOnly(compare, enabled) { return deepFreeze({ ...compare, queue: { ...compare.queue, needsDecisionOnly: Boolean(enabled) } }); }
export function setComparisonReviewVisible(compare, visible) { return deepFreeze({ ...compare, reviewVisible: Boolean(visible && compare.audit) }); }
