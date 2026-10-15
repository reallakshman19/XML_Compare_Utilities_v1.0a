import {
  PipelineCadMarkupMode,
  PipelineCadMarkupStage,
  createPipelineCadMarkupInteractionState,
  emptyPipelineCadMarkupInteractionState,
  isPipelineCadMarkupDimensionMode,
  pipelineCadMarkupInitialStage,
} from './pipeline-3d-model-cad-markup-interaction-contracts.js';

export const PIPELINE_CAD_MARKUP_INTERACTION_SESSION_SCHEMA =
  'PipelineCadMarkupInteractionSession.v1';

function point(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Pointer point must be finite.');
  return Object.freeze({ x, y });
}

function samePoint(left, right) {
  return Math.abs(left.x - right.x) <= 1e-9 && Math.abs(left.y - right.y) <= 1e-9;
}

function resetForMode(state) {
  return createPipelineCadMarkupInteractionState({
    mode: state.mode,
    graph: state.graph,
    stage: pipelineCadMarkupInitialStage(state.mode),
    selected: state.selected,
  });
}

function selectedRecord(value) {
  if (!value) return null;
  const id = String(value.id || '').trim();
  const kind = String(value.kind || '').toUpperCase();
  if (!id || !['DIMENSION', 'ANNOTATION'].includes(kind)) {
    throw new TypeError('Markup selection requires an exact dimension or annotation ID.');
  }
  return Object.freeze({ id, kind, graph: String(value.graph || ''), status: String(value.status || '') });
}

export function createPipelineCadMarkupInteractionSession() {
  let state = emptyPipelineCadMarkupInteractionState();
  let destroyed = false;
  const listeners = new Set();

  function assertActive() {
    if (destroyed) throw new Error('Pipeline CAD markup interaction session is destroyed.');
  }
  function publish(next, reason) {
    assertActive();
    state = next;
    const event = Object.freeze({ reason, state });
    listeners.forEach((listener) => listener(event));
    return state;
  }
  function activate(mode, graph) {
    assertActive();
    return publish(createPipelineCadMarkupInteractionState({ mode, graph }), 'mode-changed');
  }
  function deactivate() {
    return publish(emptyPipelineCadMarkupInteractionState(), 'mode-disabled');
  }
  function setSelection(value) {
    assertActive();
    const selected = selectedRecord(value);
    return publish(createPipelineCadMarkupInteractionState({
      ...state,
      selected,
      drag: null,
      stage: state.mode === PipelineCadMarkupMode.MARKUP_SELECT
        ? PipelineCadMarkupStage.SELECT : state.stage,
    }), 'selection-changed');
  }
  function acceptAnchor(acquisition) {
    assertActive();
    if (!acquisition?.anchor || !acquisition?.worldPoint) throw new TypeError('A validated markup anchor acquisition is required.');
    if (isPipelineCadMarkupDimensionMode(state.mode)) {
      if (state.stage === PipelineCadMarkupStage.FIRST_ANCHOR) {
        return publish(createPipelineCadMarkupInteractionState({
          ...state, first: acquisition, feedback: acquisition,
          stage: PipelineCadMarkupStage.SECOND_ANCHOR,
        }), 'first-anchor');
      }
      if (state.stage === PipelineCadMarkupStage.SECOND_ANCHOR) {
        if (samePoint(state.first.worldPoint, acquisition.worldPoint)) {
          throw new Error('Dimension anchors must resolve to different points.');
        }
        return publish(createPipelineCadMarkupInteractionState({
          ...state, second: acquisition, pointer: acquisition.worldPoint,
          feedback: acquisition, stage: PipelineCadMarkupStage.OFFSET,
        }), 'second-anchor');
      }
    }
    if (state.mode === PipelineCadMarkupMode.ANNOTATION && state.stage === PipelineCadMarkupStage.ANCHOR) {
      return publish(createPipelineCadMarkupInteractionState({
        ...state, annotation: acquisition, feedback: acquisition,
        stage: PipelineCadMarkupStage.PALETTE,
      }), 'annotation-anchor');
    }
    throw new Error('Markup anchor is not accepted in the current interaction stage.');
  }
  function updatePointer(value, feedback = state.feedback) {
    assertActive();
    if (!state.mode) return state;
    return publish(createPipelineCadMarkupInteractionState({
      ...state, pointer: point(value), feedback,
    }), 'pointer-preview');
  }
  function backspace() {
    assertActive();
    if (!isPipelineCadMarkupDimensionMode(state.mode)) return false;
    if (state.stage === PipelineCadMarkupStage.OFFSET) {
      publish(createPipelineCadMarkupInteractionState({
        ...state, second: null, pointer: state.first?.worldPoint || null,
        stage: PipelineCadMarkupStage.SECOND_ANCHOR,
      }), 'backspace');
      return true;
    }
    if (state.stage === PipelineCadMarkupStage.SECOND_ANCHOR) {
      publish(resetForMode(state), 'backspace');
      return true;
    }
    return false;
  }
  function beginDrag(input) {
    assertActive();
    if (state.mode !== PipelineCadMarkupMode.MARKUP_SELECT || !state.selected) {
      throw new Error('Markup drag requires select mode and an exact selected record.');
    }
    const drag = Object.freeze({ ...input, startWorld: point(input.startWorld), previewPatch: null });
    return publish(createPipelineCadMarkupInteractionState({
      ...state, drag, stage: PipelineCadMarkupStage.DRAGGING,
    }), 'drag-started');
  }
  function updateDrag(previewPatch, pointerValue) {
    assertActive();
    if (!state.drag) return false;
    const drag = Object.freeze({ ...state.drag, previewPatch: Object.freeze({ ...previewPatch }) });
    publish(createPipelineCadMarkupInteractionState({
      ...state, drag, pointer: point(pointerValue), stage: PipelineCadMarkupStage.DRAGGING,
    }), 'drag-preview');
    return true;
  }
  function finishDrag() {
    assertActive();
    if (!state.drag) return null;
    const drag = state.drag;
    publish(createPipelineCadMarkupInteractionState({
      ...state, drag: null, pointer: null, stage: PipelineCadMarkupStage.SELECT,
    }), 'drag-finished');
    return drag;
  }
  function cancelTransient(reason = 'cancelled') {
    assertActive();
    const hasPlacement = Boolean(state.first || state.second || state.annotation || state.drag);
    if (hasPlacement || state.stage === PipelineCadMarkupStage.PALETTE) {
      publish(resetForMode(state), reason);
      return true;
    }
    if (state.mode === PipelineCadMarkupMode.MARKUP_SELECT && state.selected) {
      setSelection(null);
      return true;
    }
    return false;
  }
  function reconcileSelection(ids) {
    assertActive();
    if (!state.selected || ids.has(state.selected.id)) return state.selected;
    setSelection(null);
    return null;
  }

  return Object.freeze({
    schema: PIPELINE_CAD_MARKUP_INTERACTION_SESSION_SCHEMA,
    getState: () => state,
    subscribe(listener) {
      assertActive();
      if (typeof listener !== 'function') throw new TypeError('Interaction listener must be a function.');
      listeners.add(listener);
      let active = true;
      return () => { if (active) { active = false; listeners.delete(listener); } };
    },
    activate,
    deactivate,
    setSelection,
    acceptAnchor,
    updatePointer,
    backspace,
    beginDrag,
    updateDrag,
    finishDrag,
    cancelTransient,
    reconcileSelection,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      listeners.clear();
      state = emptyPipelineCadMarkupInteractionState();
      return true;
    },
  });
}

export const _markupInteractionSessionTest = Object.freeze({ samePoint, resetForMode, selectedRecord });
