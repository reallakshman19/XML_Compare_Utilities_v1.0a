/** Read-only Engineering SVG implementation of RevisionCompareViewerFactory.v1. */
import {
  createRevisionCompareEngineeringSvgScene,
  createRevisionCompareSvgFitScene,
  createRevisionCompareSvgPaneScene,
  revisionCompareSvgSceneCompatibilityKey,
} from './revision-compare-engineering-svg-scene.js';
import { createRevisionCompareSvgSurfaceRuntime } from './revision-compare-svg-surfaces.js';
import { normalizeRevisionCompareSvgViewportState } from './revision-compare-svg-viewport.js';

export const REVISION_COMPARE_SVG_VIEWER_SNAPSHOT_SCHEMA = 'RevisionCompareSvgViewerSnapshot.v2';
const LEGACY_SNAPSHOT_SCHEMA = 'RevisionCompareSvgViewerSnapshot.v1';

function requiredHost(value) {
  if (!value?.ownerDocument?.createElementNS) throw new TypeError('Revision Compare SVG viewer requires a DOM host.');
  return value;
}

function jsonSnapshot(value) {
  if (![REVISION_COMPARE_SVG_VIEWER_SNAPSHOT_SCHEMA, LEGACY_SNAPSHOT_SCHEMA].includes(value?.schema)) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

function statusObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  return value && typeof value === 'object' ? { ...value } : {};
}

function normalizedMode(value) { return value === 'side-by-side' ? 'side-by-side' : 'overlay'; }
function emptyFit() { return Object.freeze({ scope: 'all', entityIds: Object.freeze([]) }); }
function activeFit(context) { return context.fitHistory[context.mode]; }
function fitIds(context) { return activeFit(context).scope === 'selection' ? activeFit(context).entityIds : null; }
function fitScene(context) { return createRevisionCompareSvgFitScene(context.baseScene, fitIds(context)); }

function surfaceScene(context, side) {
  const scene = fitScene(context);
  return side ? createRevisionCompareSvgPaneScene(scene, side) : scene;
}

function saveViewport(context) {
  if (context.runtime) context.viewportHistory[context.mode] = context.runtime.getViewportState();
}

function disconnectRuntime(context) {
  if (!context.runtime) return false;
  saveViewport(context);
  context.runtime.dispose();
  context.runtime = null;
  return true;
}

function onRuntimeSelection(context, selectedIds, reason) {
  context.selectedIds = [...selectedIds];
  if (['pointer', 'keyboard', 'pointer-empty'].includes(reason)) {
    context.callbacks.onPick?.({ objectId: selectedIds[0] ?? null });
  }
}

function mount(context) {
  if (!context.baseScene || context.runtime) return;
  context.runtime = createRevisionCompareSvgSurfaceRuntime({
    host: context.host,
    mode: context.mode,
    sceneForSide: (side) => surfaceScene(context, side),
    entities: () => context.baseScene.entities,
    selectedIds: context.selectedIds,
    statusByObjectId: context.statusByObjectId,
    workspaceFactory: context.callbacks.workspaceFactory,
    resizeObserverFactory: context.callbacks.resizeObserverFactory,
    initialViewportState: context.viewportHistory[context.mode],
    onViewportChange: (state) => { context.viewportHistory[context.mode] = state; },
    onSelection: (ids, reason) => onRuntimeSelection(context, ids, reason),
  });
}

function publishScene(context, reason) {
  context.runtime?.setSceneForSide((side) => surfaceScene(context, side), reason);
}

function resetHistory(context) {
  context.viewportHistory = {
    overlay: normalizeRevisionCompareSvgViewportState(),
    'side-by-side': normalizeRevisionCompareSvgViewportState(),
  };
  context.fitHistory = { overlay: emptyFit(), 'side-by-side': emptyFit() };
  context.initialFitCount += 1;
}

function snapshotFitHistory(initial) {
  const mode = normalizedMode(initial?.mode);
  const legacy = Object.freeze({
    scope: initial?.fitScope === 'selection' ? 'selection' : 'all',
    entityIds: Object.freeze([...(initial?.fitEntityIds ?? [])]),
  });
  return {
    overlay: initial?.fitHistory?.overlay ?? (mode === 'overlay' ? legacy : emptyFit()),
    'side-by-side': initial?.fitHistory?.['side-by-side'] ?? (mode === 'side-by-side' ? legacy : emptyFit()),
  };
}

function normalizeFit(value) {
  return Object.freeze({
    scope: value?.scope === 'selection' ? 'selection' : 'all',
    entityIds: Object.freeze([...(value?.entityIds ?? [])].filter(Boolean)),
  });
}

function applyCompatibleSnapshot(context, key) {
  const initial = context.initialSnapshot;
  if (!initial || initial.sceneCompatibilityKey !== key) {
    resetHistory(context);
    return false;
  }
  context.mode = normalizedMode(initial.mode);
  context.selectedIds = [...(initial.selectedIds ?? [])];
  context.fitCounts = {
    all: initial.fitCounts?.all ?? 0,
    selection: initial.fitCounts?.selection ?? 0,
    noGeometry: initial.fitCounts?.noGeometry ?? 0,
  };
  const fits = snapshotFitHistory(initial);
  context.fitHistory = { overlay: normalizeFit(fits.overlay), 'side-by-side': normalizeFit(fits['side-by-side']) };
  context.viewportHistory = {
    overlay: normalizeRevisionCompareSvgViewportState(initial.viewportHistory?.overlay),
    'side-by-side': normalizeRevisionCompareSvgViewportState(initial.viewportHistory?.['side-by-side']),
  };
  return true;
}

function setModels(context, nextModels) {
  const projection = createRevisionCompareEngineeringSvgScene({ models: nextModels, statusByObjectId: context.statusByObjectId });
  const key = revisionCompareSvgSceneCompatibilityKey(projection.scene);
  const first = context.sceneCompatibilityKey == null;
  const changed = !first && key !== context.sceneCompatibilityKey;
  if (changed) disconnectRuntime(context);
  context.models = nextModels;
  context.baseScene = projection.scene;
  context.omissions = projection.omissions;
  context.entityById = new Map(context.baseScene.entities.map((entity) => [entity.id, entity]));
  if (first) applyCompatibleSnapshot(context, key);
  else if (changed) resetHistory(context);
  context.sceneCompatibilityKey = key;
  context.initialSnapshot = null;
  mount(context);
  publishScene(context, 'revision-compare-models');
  context.runtime?.setSelection(context.selectedIds);
}

function setStatuses(context, value) {
  context.statusByObjectId = statusObject(value);
  context.runtime?.setStatuses(context.statusByObjectId);
}

function setMode(context, value) {
  const mode = normalizedMode(value);
  if (mode === context.mode) return mode;
  disconnectRuntime(context);
  context.mode = mode;
  mount(context);
  context.runtime?.setSelection(context.selectedIds);
  return mode;
}

function setSelection(context, primaryObjectId, relatedObjectIds = []) {
  context.selectedIds = [primaryObjectId, ...relatedObjectIds].filter(Boolean);
  context.runtime?.setSelection(context.selectedIds);
}

function fit(context, scope) {
  if (!context.baseScene) return false;
  if (scope === 'selection') {
    const ids = context.selectedIds.filter((id) => context.entityById.has(id));
    if (!ids.length) {
      context.fitCounts.noGeometry += 1;
      context.lastFitResult = 'no-geometry';
      return false;
    }
    context.fitHistory[context.mode] = normalizeFit({ scope: 'selection', entityIds: ids });
    context.fitCounts.selection += 1;
  } else {
    context.fitHistory[context.mode] = emptyFit();
    context.fitCounts.all += 1;
  }
  context.lastFitResult = 'applied';
  publishScene(context, `revision-compare-fit-${activeFit(context).scope}`);
  context.runtime?.resetViewport(`fit-${activeFit(context).scope}`);
  return true;
}

function reattach(context, nextHost) {
  const host = requiredHost(nextHost);
  if (host === context.host) return false;
  disconnectRuntime(context);
  context.host = host;
  mount(context);
  context.runtime?.setSelection(context.selectedIds);
  return true;
}

function snapshot(context) {
  saveViewport(context);
  const runtimeEvidence = context.runtime?.getEvidence() ?? {
    roots: 0, observers: 0, selectionSubscriptions: 0, viewportListeners: 0,
    visibleEntityCounts: {}, hiddenFitAuthorityCounts: {},
  };
  return Object.freeze({
    schema: REVISION_COMPARE_SVG_VIEWER_SNAPSHOT_SCHEMA,
    backend: 'SVG',
    mode: context.mode,
    sceneId: context.baseScene?.sceneId ?? null,
    revision: context.baseScene?.revision ?? null,
    sceneCompatibilityKey: context.sceneCompatibilityKey,
    verticalAxis: context.verticalAxis,
    selectedIds: Object.freeze([...context.selectedIds]),
    fitScope: activeFit(context).scope,
    fitHistory: Object.freeze({ ...context.fitHistory }),
    fitCounts: Object.freeze({ ...context.fitCounts }),
    lastFitResult: context.lastFitResult,
    viewportHistory: Object.freeze({ ...context.viewportHistory }),
    entityCount: context.baseScene?.entities.length ?? 0,
    visibleEntityCounts: runtimeEvidence.visibleEntityCounts,
    hiddenFitAuthorityCounts: runtimeEvidence.hiddenFitAuthorityCounts,
    omissions: Object.freeze(context.omissions.map((item) => ({ ...item }))),
    resources: Object.freeze({
      roots: runtimeEvidence.roots,
      observers: runtimeEvidence.observers,
      selectionSubscriptions: runtimeEvidence.selectionSubscriptions,
      viewportListeners: runtimeEvidence.viewportListeners,
    }),
    initialFitCount: context.initialFitCount,
  });
}

export async function createRevisionCompareEngineeringSvgViewer(host, callbacks = {}) {
  const initial = jsonSnapshot(callbacks.initialSnapshot);
  const context = {
    host: requiredHost(host), callbacks, initialSnapshot: initial, models: null, baseScene: null,
    entityById: new Map(), runtime: null, statusByObjectId: {}, selectedIds: initial?.selectedIds ?? [],
    mode: normalizedMode(initial?.mode),
    fitHistory: { overlay: emptyFit(), 'side-by-side': emptyFit() },
    fitCounts: {
      all: initial?.fitCounts?.all ?? 0,
      selection: initial?.fitCounts?.selection ?? 0,
      noGeometry: initial?.fitCounts?.noGeometry ?? 0,
    },
    viewportHistory: {
      overlay: normalizeRevisionCompareSvgViewportState(initial?.viewportHistory?.overlay),
      'side-by-side': normalizeRevisionCompareSvgViewportState(initial?.viewportHistory?.['side-by-side']),
    },
    sceneCompatibilityKey: null, verticalAxis: initial?.verticalAxis ?? 'Z', omissions: [],
    lastFitResult: null, initialFitCount: 0, disposed: false,
  };
  return Object.freeze({
    setModels: (models) => setModels(context, models),
    setStatuses: (statuses) => setStatuses(context, statuses),
    setMode: (mode) => setMode(context, mode),
    setSelection: (primary, related) => setSelection(context, primary, related),
    setVerticalAxis: (axis) => { context.verticalAxis = ['X', 'Y', 'Z'].includes(axis) ? axis : context.verticalAxis; },
    fitAll: () => fit(context, 'all'),
    fitSelection: () => fit(context, 'selection'),
    reattach: (nextHost) => reattach(context, nextHost),
    getStateSnapshot: () => snapshot(context),
    dispose() {
      if (context.disposed) return false;
      context.disposed = true;
      disconnectRuntime(context);
      context.baseScene = null;
      return true;
    },
  });
}
