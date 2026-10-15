/** Immutable RevisionIntakeState.v1 transitions. */

import { cleanText, deepFreeze } from './revision-contract-utils.js';
import { revisionCompareJsonSnapshotMatchesDocument } from './revision-json-document.js';

export const REVISION_INTAKE_STATE_SCHEMA = 'RevisionIntakeState.v1';
export const REVISION_INTAKE_STATUS = Object.freeze({
  EMPTY: 'EMPTY',
  LOADING: 'LOADING',
  READY: 'READY',
  SCOPED: 'SCOPED',
  BLOCKED: 'BLOCKED',
  ERROR: 'ERROR',
});

function emptyScope() {
  return deepFreeze({ selectedIds: [], exclusions: [] });
}

export function createRevisionIntakeState(slotId, role) {
  return deepFreeze({
    schema: REVISION_INTAKE_STATE_SCHEMA,
    slotId: cleanText(slotId),
    role: cleanText(role),
    requestGeneration: 0,
    status: REVISION_INTAKE_STATUS.EMPTY,
    fileName: '',
    fileSizeBytes: 0,
    contentHash: '',
    document: null,
    jsonSnapshot: null,
    branchTree: [],
    branchIndex: [],
    branchIndexSummary: null,
    scopeDraft: emptyScope(),
    scopeResult: null,
    warnings: [],
    blockers: [],
    error: null,
  });
}

export function beginRevisionLoad(state, generation, fileName, fileSizeBytes) {
  return deepFreeze({
    ...createRevisionIntakeState(state.slotId, state.role),
    requestGeneration: generation,
    status: REVISION_INTAKE_STATUS.LOADING,
    fileName: cleanText(fileName),
    fileSizeBytes: Math.max(0, Math.trunc(Number(fileSizeBytes) || 0)),
  });
}

export function completeRevisionLoad(state, result) {
  if (result.generation !== state.requestGeneration) return state;
  const blockers = [...(result.blockers ?? [])];
  if (!revisionCompareJsonSnapshotMatchesDocument(result.jsonSnapshot, result.document)) {
    blockers.push('Lossless staged-JSON snapshot does not match the loaded document authority.');
  }
  return deepFreeze({
    ...state,
    status: blockers.length ? REVISION_INTAKE_STATUS.BLOCKED : REVISION_INTAKE_STATUS.READY,
    fileName: result.document.fileName,
    fileSizeBytes: result.document.fileSizeBytes,
    contentHash: result.document.sourceHash,
    document: result.document,
    jsonSnapshot: result.jsonSnapshot,
    branchTree: result.branchTree,
    branchIndex: result.branchIndex,
    branchIndexSummary: result.branchIndexSummary,
    scopeDraft: emptyScope(),
    scopeResult: result.scopeResult,
    warnings: result.warnings ?? [],
    blockers: Object.freeze(blockers),
    error: null,
  });
}

export function completeRevisionScope(state, result, scopeDraft) {
  if (result.generation !== state.requestGeneration) return state;
  if (!revisionCompareJsonSnapshotMatchesDocument(state.jsonSnapshot, result.document)) {
    throw new Error('Scoped document identity does not match the retained lossless staged-JSON snapshot.');
  }
  return deepFreeze({
    ...state,
    status: REVISION_INTAKE_STATUS.SCOPED,
    document: result.document,
    scopeDraft,
    scopeResult: result.scopeResult,
    warnings: result.warnings ?? state.warnings,
    blockers: result.blockers ?? state.blockers,
    error: null,
  });
}

export function failRevisionLoad(state, generation, error) {
  if (generation !== state.requestGeneration) return state;
  return deepFreeze({
    ...state,
    status: REVISION_INTAKE_STATUS.ERROR,
    blockers: [cleanText(error?.message ?? error)],
    error: cleanText(error?.message ?? error),
  });
}
