/** Explicit candidate review state; selection never changes geometry by itself. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue } from './sequential-command-contracts.js';
import {
  SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA,
  SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA,
  createSequentialMoveSnapSelection,
} from './sequential-move-snap-contracts.js';

function assertLive(state) {
  if (state.destroyed) throw new Error('Sequential move snap review store is destroyed.');
}

function assertAcquisition(value) {
  if (value?.schema !== SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA) {
    throw new TypeError(`Snap review requires ${SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA}.`);
  }
  return value;
}

export function validateSequentialMoveSnapSelection(selection, acquisition) {
  if (selection?.schema !== SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA) {
    throw new TypeError(`Snap selection must use ${SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA}.`);
  }
  const current = assertAcquisition(acquisition);
  if (selection.acquisitionFingerprint !== current.acquisitionFingerprint) {
    const error = new RangeError('Snap selection belongs to a stale acquisition.');
    error.code = 'SEQUENTIAL_MOVE_SNAP_ACQUISITION_STALE';
    throw error;
  }
  const rebuilt = createSequentialMoveSnapSelection({
    acquisition: current,
    candidateId: selection.candidate.id,
  });
  if (!sameSequentialContractValue(rebuilt, selection)) {
    const error = new RangeError('Snap selection candidate evidence was changed or tampered.');
    error.code = 'SEQUENTIAL_MOVE_SNAP_CANDIDATE_TAMPERED';
    throw error;
  }
  return rebuilt;
}

function setAcquisition(state, acquisition) {
  assertLive(state);
  const current = assertAcquisition(acquisition);
  if (state.acquisition?.acquisitionFingerprint !== current.acquisitionFingerprint) {
    state.selection = null;
  }
  state.acquisition = current;
  return snapshot(state);
}

function selectCandidate(state, candidateId) {
  assertLive(state);
  if (!state.acquisition) throw new RangeError('Acquire snap candidates before selecting one.');
  state.selection = createSequentialMoveSnapSelection({
    acquisition: state.acquisition,
    candidateId,
  });
  return snapshot(state);
}

function cycleCandidate(state, amount) {
  assertLive(state);
  const acquisition = state.acquisition;
  if (!acquisition?.candidates.length) throw new RangeError('No snap candidates are available to cycle.');
  if (!state.selection) {
    return selectCandidate(state,
      acquisition.suggestedCandidateId || acquisition.candidates[amount < 0 ? -1 : 0].id);
  }
  const index = acquisition.candidates.findIndex((row) => row.id === state.selection.candidate.id);
  const next = (index + amount + acquisition.candidates.length) % acquisition.candidates.length;
  return selectCandidate(state, acquisition.candidates[next].id);
}

function clearReview(state, clearAcquisition) {
  assertLive(state);
  state.selection = null;
  if (clearAcquisition) state.acquisition = null;
  return snapshot(state);
}

function snapshot(state) {
  const candidates = state.acquisition?.candidates || [];
  return immutableJson({
    schema: 'SequentialMoveSnapReviewState.v1',
    acquisitionFingerprint: state.acquisition?.acquisitionFingerprint || null,
    candidateCount: candidates.length,
    suggestedCandidateId: state.acquisition?.suggestedCandidateId || null,
    selectedCandidateId: state.selection?.candidate.id || null,
    selectedIndex: state.selection
      ? candidates.findIndex((row) => row.id === state.selection.candidate.id) : -1,
    selection: state.selection,
    destroyed: state.destroyed,
  }, 'Sequential move snap review state');
}

export function createSequentialMoveSnapReviewStore() {
  const state = { acquisition: null, selection: null, destroyed: false };
  return Object.freeze({
    schema: 'SequentialMoveSnapReviewStore.v1',
    setAcquisition: (value) => setAcquisition(state, value),
    select: (candidateId) => selectCandidate(state, candidateId),
    next: () => cycleCandidate(state, 1),
    previous: () => cycleCandidate(state, -1),
    clearSelection: () => clearReview(state, false),
    clear: () => clearReview(state, true),
    getAcquisition() { assertLive(state); return state.acquisition; },
    getSelection() { assertLive(state); return state.selection; },
    getState: () => snapshot(state),
    destroy() {
      if (state.destroyed) return false;
      state.acquisition = null; state.selection = null; state.destroyed = true;
      return true;
    },
  });
}
