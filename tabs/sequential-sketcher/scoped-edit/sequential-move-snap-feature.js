/** Acquisition and explicit-review lifecycle for SSK-TS-3M move snap evidence. */
import { acquireSequentialMoveSnapCandidates,
  validateSequentialMoveSnapAcquisition } from './sequential-move-snap-acquisition.js';
import { createSequentialMoveSnapReviewStore,
  validateSequentialMoveSnapSelection } from './sequential-move-snap-review-store.js';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function add(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function projectPoint(viewer, worldPoint) {
  if (typeof viewer?.worldToScreen !== 'function') {
    throw new TypeError('Move snap requires viewer.worldToScreen.');
  }
  return viewer.worldToScreen([worldPoint.x, worldPoint.y, worldPoint.z]);
}

function acquisitionInput(state, preview, rawScreenPoint) {
  const viewer = state.readViewer();
  return {
    target: state.readTarget(),
    readModel: state.readModel(),
    scene: state.readScene(),
    rawWorldPoint: add(preview.pivot, preview.rawDelta),
    rawScreenPoint,
    constraint: preview.constraint,
    profile: state.readProfile(),
    projectPoint: (point) => viewer.worldToScreen(point),
  };
}

function notify(state) {
  state.onChanged({
    acquisition: state.review.getAcquisition(),
    review: state.review.getState(),
    selection: state.review.getSelection(),
  });
}

function acquire(state, preview, screenPoint = null) {
  const rawWorldPoint = add(preview.pivot, preview.rawDelta);
  const rawScreenPoint = screenPoint || projectPoint(state.readViewer(), rawWorldPoint);
  if (!rawScreenPoint) throw new RangeError('Raw move point is outside the current viewer projection.');
  const acquisition = acquireSequentialMoveSnapCandidates(
    acquisitionInput(state, preview, rawScreenPoint),
  );
  state.review.setAcquisition(acquisition);
  notify(state);
  return acquisition;
}

function selectedCandidate(state) {
  const preview = state.readPreview();
  const acquisition = state.review.getAcquisition();
  const selection = state.review.getSelection();
  if (!preview || !acquisition || !selection) {
    throw new RangeError('Select one current snap candidate before using it.');
  }
  const current = validateSequentialMoveSnapAcquisition(acquisition,
    acquisitionInput(state, preview, acquisition.rawScreenPoint));
  return { preview, selection: validateSequentialMoveSnapSelection(selection, current) };
}

function useSelected(state) {
  const selected = selectedCandidate(state);
  const preview = state.stageSnapped({
    constraint: selected.preview.constraint,
    rawDelta: selected.preview.rawDelta,
    delta: subtract(selected.selection.candidate.worldPoint, selected.preview.pivot),
    snapSelection: selected.selection,
    interaction: {
      kind: selected.preview.interaction.kind,
      source: 'explicit-snap-selection',
    },
  });
  notify(state);
  return preview;
}

function clearSnap(state) {
  const preview = state.readPreview();
  if (!preview) return null;
  state.review.clearSelection();
  if (!preview.snapApplied) { notify(state); return preview; }
  const raw = state.stageRaw({
    constraint: preview.constraint,
    delta: preview.rawDelta,
    rawDelta: preview.rawDelta,
    interaction: { kind: preview.interaction.kind, source: 'raw-preview-restored' },
  });
  notify(state);
  return raw;
}

function select(state, action) {
  const result = action();
  notify(state);
  return result;
}

function candidateSpheres(acquisition, selectedId) {
  return (acquisition?.candidates || []).map((candidate) => ({
    position: [candidate.worldPoint.x, candidate.worldPoint.y, candidate.worldPoint.z],
    radiusMm: candidate.id === selectedId ? 22 : 10,
    colorInt: candidate.id === selectedId ? 0xf472b6 : 0x22d3ee,
  }));
}

function transientOverlay(state, preview) {
  if (!preview) return null;
  const acquisition = state.review.getAcquisition();
  const selectedId = state.review.getSelection()?.candidate.id || null;
  const raw = add(preview.pivot, preview.rawDelta);
  const effective = add(preview.pivot, preview.delta);
  return {
    lines: [{
      points: [[preview.pivot.x, preview.pivot.y, preview.pivot.z],
        [effective.x, effective.y, effective.z]],
      colorInt: preview.snapApplied ? 0xf472b6 : 0x38bdf8,
    }],
    spheres: [
      { position: [raw.x, raw.y, raw.z], radiusMm: 16, colorInt: 0xfacc15 },
      ...candidateSpheres(acquisition, selectedId),
    ],
  };
}

export function createSequentialMoveSnapFeature(options = {}) {
  const state = {
    readScene: requiredFunction(options.readScene, 'readScene'),
    readModel: requiredFunction(options.readModel, 'readModel'),
    readViewer: requiredFunction(options.readViewer, 'readViewer'),
    readTarget: requiredFunction(options.readTarget, 'readTarget'),
    readPreview: requiredFunction(options.readPreview, 'readPreview'),
    readProfile: requiredFunction(options.readProfile, 'readProfile'),
    stageRaw: requiredFunction(options.stageRaw, 'stageRaw'),
    stageSnapped: requiredFunction(options.stageSnapped, 'stageSnapped'),
    onChanged: requiredFunction(options.onChanged, 'onChanged'),
    review: createSequentialMoveSnapReviewStore(),
    destroyed: false,
  };
  return Object.freeze({
    schema: 'SequentialMoveSnapFeature.v1',
    acquire: (preview, screenPoint) => acquire(state, preview, screenPoint),
    select: (candidateId) => select(state, () => state.review.select(candidateId)),
    next: () => select(state, state.review.next),
    previous: () => select(state, state.review.previous),
    useSelected: () => useSelected(state),
    clearSnap: () => clearSnap(state),
    clear() { const result = state.review.clear(); notify(state); return result; },
    getAcquisition: state.review.getAcquisition,
    getSelection: state.review.getSelection,
    getState: state.review.getState,
    transient: (preview) => transientOverlay(state, preview),
    destroy() {
      if (state.destroyed) return false;
      state.destroyed = true; state.review.destroy(); return true;
    },
  });
}
