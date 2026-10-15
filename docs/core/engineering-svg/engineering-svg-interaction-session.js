import {
  createEngineeringCommandResult,
  createEngineeringEditIntent,
  createEngineeringGeometryConstraint,
  createEngineeringPoint3D,
  freezeJsonValue,
  validateEngineeringScene,
} from '../engineering-scene/index.js';
import { engineeringRevisionTokensEqual } from './engineering-svg-command-gateway.js';
import { solveEngineeringSvgConstraintDrag } from './engineering-svg-constraint-solver.js';
import { engineeringGeometriesEqual, engineeringGeometryCentroid, engineeringPointDelta } from './engineering-svg-geometry-analysis.js';
import { translateEngineeringGeometry } from './engineering-svg-precision-geometry.js';
import { acquireEngineeringSvgSnap, composeEngineeringSvgSnapPoint } from './engineering-svg-snap-acquisition.js';

export const ENGINEERING_SVG_INTERACTION_SCHEMA = 'EngineeringSvgInteractionSession.v1';
export const ENGINEERING_SVG_INTERACTION_STATUS = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  COMMITTING: 'committing',
  COMMITTED: 'committed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function screenPoint(value, label) {
  const point = { x: Number(value?.x), y: Number(value?.y) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite x and y values.`);
  }
  return Object.freeze(point);
}

function fitRecord(value) {
  const fit = {
    scale: Number(value?.scale),
    offsetX: Number(value?.offsetX),
    offsetY: Number(value?.offsetY),
  };
  if (!Number.isFinite(fit.scale) || fit.scale <= 0
    || !Number.isFinite(fit.offsetX) || !Number.isFinite(fit.offsetY)) {
    throw new TypeError('Interaction fit must contain a positive scale and finite offsets.');
  }
  return Object.freeze(fit);
}

function supportedProjection(scene, value) {
  const projection = String(value || 'ISO');
  if (!scene.projections.includes(projection)) {
    throw new TypeError(`Scene does not support interaction projection "${projection}".`);
  }
  return projection;
}

function initialState() {
  return {
    schema: ENGINEERING_SVG_INTERACTION_SCHEMA,
    status: 'idle',
    operationId: null,
    entityId: null,
    baseRevision: null,
    constraint: null,
    projection: null,
    fit: null,
    startScreenPoint: null,
    currentScreenPoint: null,
    originalGeometry: null,
    draftGeometry: null,
    solution: null,
    acquisition: null,
    noChange: true,
    result: null,
    error: null,
  };
}

function stateSnapshot(value) {
  return freezeJsonValue(value);
}

function interactionEntity(scene, entityId) {
  const entity = scene.entities.find((value) => value.id === entityId);
  if (!entity) throw new Error(`Interaction entity "${entityId}" was not found.`);
  if (!entity.geometry) throw new Error(`Interaction entity "${entityId}" has no geometry.`);
  return entity;
}

function noChangeResult(operationId) {
  return createEngineeringCommandResult({
    operationId,
    status: 'cancelled',
    code: 'NO_CHANGE',
    message: 'The interaction did not change authoritative geometry.',
    commandReason: 'pointer-no-change',
  });
}

export function createEngineeringSvgInteractionSession(options = {}) {
  const { getScene, editCoordinator } = options;
  if (typeof getScene !== 'function' || !editCoordinator?.begin || !editCoordinator?.commit) {
    throw new TypeError('Engineering SVG interaction requires getScene and editCoordinator.');
  }
  let state = initialState();
  let previewSequence = 0;
  let disposed = false;
  const listeners = new Set();

  function assertActive() {
    if (disposed) throw new Error('Engineering SVG interaction session is disposed.');
  }

  function publish(reason) {
    const snapshot = stateSnapshot(state);
    listeners.forEach((listener) => listener(Object.freeze({ snapshot, reason })));
    return snapshot;
  }

  function begin(input = {}) {
    assertActive();
    if (state.status === 'dragging' || state.status === 'committing') {
      throw new Error('An engineering SVG interaction is already active.');
    }
    const scene = validateEngineeringScene(getScene());
    const operationId = requiredText(input.operationId, 'Interaction operationId');
    const entityId = requiredText(input.entityId, 'Interaction entityId');
    const baseRevision = input.baseRevision || scene.revision;
    if (!engineeringRevisionTokensEqual(baseRevision, scene.revision)) {
      throw new Error('Interaction base revision does not match the authoritative scene.');
    }
    const entity = interactionEntity(scene, entityId);
    const constraint = createEngineeringGeometryConstraint(input.constraint);
    const start = screenPoint(input.startScreenPoint, 'Interaction startScreenPoint');
    const projection = supportedProjection(scene, input.projection);
    const fit = fitRecord(input.fit);
    editCoordinator.begin({ operationId, baseRevision });
    previewSequence = 0;
    state = {
      ...initialState(),
      status: 'dragging',
      operationId,
      entityId,
      baseRevision,
      constraint,
      projection,
      fit,
      startScreenPoint: start,
      currentScreenPoint: start,
      originalGeometry: entity.geometry,
      draftGeometry: entity.geometry,
    };
    return publish('begin');
  }

  async function preview(input = {}) {
    assertActive();
    if (state.status !== 'dragging') throw new Error('Pointer preview requires an active dragging interaction.');
    const sequence = ++previewSequence;
    const current = screenPoint(input.currentScreenPoint, 'Interaction currentScreenPoint');
    const solution = solveEngineeringSvgConstraintDrag({
      start: state.startScreenPoint,
      current,
      projection: state.projection,
      fit: state.fit,
      constraint: state.constraint,
      resolveReferenceVector: options.resolveReferenceVector,
    });
    const rawGeometry = translateEngineeringGeometry(state.originalGeometry, solution.worldDelta);
    const originalCentroid = engineeringGeometryCentroid(state.originalGeometry);
    const rawCentroid = engineeringGeometryCentroid(rawGeometry);
    let acquisition = null;
    if (input.snapEnabled !== false && Array.isArray(options.snapProviders) && options.snapProviders.length) {
      acquisition = await acquireEngineeringSvgSnap({
        scene: validateEngineeringScene(getScene()),
        projection: state.projection,
        fit: state.fit,
        rawScreenPoint: current,
        rawWorldPoint: rawCentroid,
        aperture: input.aperture ?? options.aperture ?? 12,
        providers: options.snapProviders,
        enabledModes: input.enabledModes ?? options.enabledModes,
        excludeSourceEntityIds: input.excludeSourceEntityIds ?? [state.entityId],
        constraint: state.constraint,
        screenTolerance: input.screenTolerance ?? options.screenTolerance,
        worldTolerance: input.worldTolerance ?? options.worldTolerance,
        errorMode: input.errorMode ?? options.errorMode,
        metadata: input.metadata ?? {},
      });
    }
    if (sequence !== previewSequence || state.status !== 'dragging') return stateSnapshot(state);
    const targetCentroid = acquisition
      ? composeEngineeringSvgSnapPoint(rawCentroid, acquisition)
      : createEngineeringPoint3D(rawCentroid);
    const finalDelta = engineeringPointDelta(originalCentroid, targetCentroid);
    const draftGeometry = translateEngineeringGeometry(state.originalGeometry, finalDelta);
    editCoordinator.stageGeometry(state.entityId, {
      original: state.originalGeometry,
      draft: draftGeometry,
      constraint: state.constraint,
    });
    state = {
      ...state,
      currentScreenPoint: current,
      draftGeometry,
      solution,
      acquisition,
      noChange: engineeringGeometriesEqual(state.originalGeometry, draftGeometry),
      result: null,
      error: null,
    };
    return publish('preview');
  }

  async function commit() {
    assertActive();
    if (state.status !== 'dragging') throw new Error('Interaction commit requires an active dragging interaction.');
    if (state.noChange) {
      const result = noChangeResult(state.operationId);
      editCoordinator.cancel('no-change');
      state = { ...state, status: 'cancelled', result };
      publish('no-change');
      return result;
    }
    state = { ...state, status: 'committing', error: null };
    publish('committing');
    const intent = createEngineeringEditIntent({
      type: 'APPLY_CHANGES',
      operationId: state.operationId,
      baseRevision: state.baseRevision,
      entityIds: [state.entityId],
      changes: {
        geometry: {
          original: state.originalGeometry,
          draft: state.draftGeometry,
          constraint: state.constraint,
          solution: state.solution,
          acquisition: state.acquisition,
        },
      },
      source: { interaction: 'pointer', projection: state.projection },
    });
    try {
      const result = await editCoordinator.commit(intent);
      state = {
        ...state,
        status: result.status === 'committed' ? 'committed' : result.status,
        result,
      };
      publish(`command-${result.status}`);
      return result;
    } catch (error) {
      state = { ...state, status: 'rejected', error: String(error?.message || error) };
      publish('command-error');
      throw error;
    }
  }

  function cancel(reason = 'cancelled') {
    assertActive();
    if (state.status !== 'dragging' && state.status !== 'rejected') return stateSnapshot(state);
    previewSequence += 1;
    editCoordinator.cancel(String(reason));
    state = { ...state, status: 'cancelled', error: null };
    return publish('cancel');
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_INTERACTION_SCHEMA,
    getState: () => stateSnapshot(state),
    begin,
    preview,
    commit,
    cancel,
    subscribe(listener) {
      assertActive();
      if (typeof listener !== 'function') throw new TypeError('Interaction listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return false;
      if (state.status === 'dragging' || state.status === 'rejected') cancel('dispose');
      disposed = true;
      listeners.clear();
      return true;
    },
  });
}
