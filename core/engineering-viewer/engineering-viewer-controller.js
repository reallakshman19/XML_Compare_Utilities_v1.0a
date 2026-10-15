/** Lifecycle owner for one active engineering viewer backend. */

import {
  ENGINEERING_VIEWER_LIFECYCLE_METHODS,
  createEngineeringViewerFactory,
} from './engineering-viewer-contract.js';

const ENGINEERING_VIEWER_CONTROLLER_SCHEMA = 'EngineeringViewerController.v1';
function freezeJsonValue(value, path = '$', seen = new Set()) {
  const type = typeof value;
  if (type === 'number' && !Number.isFinite(value)) throw new TypeError(`${path} must be finite.`);
  if (['undefined', 'function', 'symbol', 'bigint'].includes(type)) {
    throw new TypeError(`${path} contains unsupported type "${type}".`);
  }
  if (value === null || type !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must contain only arrays and plain objects.`);
  }
  if (seen.has(value)) throw new TypeError(`${path} contains a circular reference.`);
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((item, index) => freezeJsonValue(item, `${path}[${index}]`, seen))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => (
      [key, freezeJsonValue(item, `${path}.${key}`, seen)]
    )));
  seen.delete(value);
  return Object.freeze(result);
}
function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}
function optionalFunction(value, label) {
  if (value == null) return null;
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function backendIds(values) {
  if (!Array.isArray(values) || !values.length) {
    throw new TypeError('Engineering viewer backendIds must be a non-empty array.');
  }
  const result = values.map((value, index) => requiredText(value, `backendIds[${index}]`));
  if (new Set(result).size !== result.length) {
    throw new TypeError('Engineering viewer backendIds must be unique.');
  }
  return Object.freeze(result);
}

function normalizeFactories(ids, factories) {
  if (!factories || typeof factories !== 'object') {
    throw new TypeError('Engineering viewer factories must be an object.');
  }
  return new Map(ids.map((backendId) => [
    backendId,
    createEngineeringViewerFactory(factories[backendId], {
      label: `Engineering viewer backend "${backendId}"`,
      requiredMethods: ENGINEERING_VIEWER_LIFECYCLE_METHODS,
    }),
  ]));
}

function normalizeError(value) {
  return value instanceof Error ? value : new Error(`Engineering viewer failure: ${String(value)}`);
}

function reportFailure(context, value) {
  const error = normalizeError(value);
  context.failure = error;
  context.onError?.(error);
  return false;
}

function cloneSnapshot(viewer, backendId) {
  try {
    return freezeJsonValue(viewer.getStateSnapshot());
  } catch (error) {
    throw new TypeError(`Engineering viewer backend "${backendId}" returned an invalid snapshot: ${error.message}`);
  }
}

function disposeActive(context) {
  if (!context.viewer) return false;
  const viewer = context.viewer;
  const backendId = context.activeBackend;
  try {
    context.snapshots[backendId] = cloneSnapshot(viewer, backendId);
  } catch (error) {
    reportFailure(context, error);
  }
  Object.assign(context, { viewer: null, activeBackend: null, host: null });
  try {
    viewer.dispose();
  } catch (error) {
    reportFailure(context, error);
  }
  return true;
}

function ownsGeneration(context, generation, backendId) {
  return !context.disposed
    && generation === context.generation
    && backendId === context.requestedBackend;
}

function guardedCallbacks(context, generation, backendId) {
  return {
    onPick: (pick) => {
      if (ownsGeneration(context, generation, backendId)) context.onPick?.(pick);
    },
    onRuntimeError: (error) => {
      if (ownsGeneration(context, generation, backendId)) reportFailure(context, error);
    },
    initialSnapshot: context.snapshots[backendId] ?? null,
  };
}

function recordMountRequest(context, backendId) {
  context.mountRequests.push(backendId);
  if (context.mountRequests.length > 12) context.mountRequests.shift();
}

async function createViewer(context, host, generation, backendId) {
  recordMountRequest(context, backendId);
  try {
    const viewer = await context.factories.get(backendId)(
      host,
      guardedCallbacks(context, generation, backendId),
    );
    if (!ownsGeneration(context, generation, backendId)) {
      viewer.dispose();
      return null;
    }
    Object.assign(context, { viewer, activeBackend: backendId, host, failure: null });
    return viewer;
  } catch (error) {
    if (ownsGeneration(context, generation, backendId)) reportFailure(context, error);
    return null;
  }
}

function startCreation(context, host) {
  const generation = context.generation;
  const backendId = context.requestedBackend;
  const record = { generation, promise: null };
  record.promise = createViewer(context, host, generation, backendId).finally(() => {
    if (context.pending === record) context.pending = null;
  });
  context.pending = record;
  return record.promise;
}

function ensureViewer(context, host) {
  if (context.disposed) return null;
  if (context.viewer && context.activeBackend !== context.requestedBackend) disposeActive(context);
  if (context.viewer) {
    try {
      context.viewer.reattach(host);
      context.host = host;
      return context.viewer;
    } catch (error) {
      reportFailure(context, error);
      return null;
    }
  }
  if (context.pending?.generation === context.generation) return context.pending.promise;
  return startCreation(context, host);
}

function applySelection(context, viewer) {
  viewer.setSelection(context.selection.primaryId, context.selection.relatedIds);
}

function applyPresentation(context, viewer, presentation) {
  try {
    context.applyPresentation(viewer, presentation);
    applySelection(context, viewer);
    context.failure = null;
    return true;
  } catch (error) {
    return reportFailure(context, error);
  }
}

function render(context, host, presentation) {
  context.presentation = presentation;
  const result = ensureViewer(context, host);
  if (result && typeof result.then === 'function') {
    return result.then((viewer) => (viewer ? applyPresentation(context, viewer, presentation) : false));
  }
  return Promise.resolve(result ? applyPresentation(context, result, presentation) : false);
}

function setSelection(context, primaryId, relatedIds) {
  if (!Array.isArray(relatedIds)) throw new TypeError('Engineering viewer relatedIds must be an array.');
  context.selection = { primaryId: primaryId ?? null, relatedIds: Object.freeze([...relatedIds]) };
  if (!context.viewer) return true;
  try {
    applySelection(context, context.viewer);
    return true;
  } catch (error) {
    return reportFailure(context, error);
  }
}

function setBackend(context, value) {
  const backendId = requiredText(value, 'Engineering viewer backend id');
  if (!context.backendIds.includes(backendId)) {
    throw new TypeError(`Engineering viewer backend "${backendId}" is not registered.`);
  }
  if (backendId === context.requestedBackend) return false;
  context.failure = null;
  context.requestedBackend = backendId;
  context.generation += 1;
  context.pending = null;
  disposeActive(context);
  return true;
}

function fit(context, method) {
  if (!context.viewer) return false;
  try {
    return context.viewer[method]();
  } catch (error) {
    return reportFailure(context, error);
  }
}

function clear(context) {
  if (context.disposed) return false;
  context.generation += 1;
  context.pending = null;
  context.failure = null;
  disposeActive(context);
  context.presentation = null;
  context.selection = { primaryId: null, relatedIds: Object.freeze([]) };
  return true;
}
function evidence(context) {
  let viewer = null;
  if (context.viewer) {
    try { viewer = cloneSnapshot(context.viewer, context.activeBackend); }
    catch (error) { reportFailure(context, error); }
  }
  return freezeJsonValue({
    schema: ENGINEERING_VIEWER_CONTROLLER_SCHEMA,
    mounted: Boolean(context.viewer),
    disposed: context.disposed,
    failed: Boolean(context.failure),
    error: context.failure?.message ?? null,
    requestedBackend: context.requestedBackend,
    activeBackend: context.activeBackend,
    selection: context.selection,
    snapshots: context.snapshots,
    mountRequests: context.mountRequests,
    viewer,
  });
}
function createContext(options) {
  const ids = backendIds(options?.backendIds);
  const initialBackend = requiredText(options?.initialBackend, 'Engineering viewer initialBackend');
  if (!ids.includes(initialBackend)) throw new TypeError('Engineering viewer initialBackend is not registered.');
  if (typeof options?.applyPresentation !== 'function') {
    throw new TypeError('Engineering viewer applyPresentation must be a function.');
  }
  return {
    backendIds: ids,
    factories: normalizeFactories(ids, options.factories),
    applyPresentation: options.applyPresentation,
    onPick: optionalFunction(options.onPick, 'Engineering viewer onPick'),
    onError: optionalFunction(options.onError, 'Engineering viewer onError'),
    viewer: null, host: null, pending: null, failure: null, presentation: null,
    requestedBackend: initialBackend, activeBackend: null, snapshots: {},
    mountRequests: [], generation: 0, disposed: false,
    selection: { primaryId: null, relatedIds: Object.freeze([]) },
  };
}

export function createEngineeringViewerController(options) {
  const context = createContext(options);
  return Object.freeze({
    schema: ENGINEERING_VIEWER_CONTROLLER_SCHEMA,
    render: (host, presentation) => render(context, host, presentation),
    setBackend: (backendId) => setBackend(context, backendId),
    setSelection: (primaryId, relatedIds) => setSelection(context, primaryId, relatedIds),
    fitAll: () => fit(context, 'fitAll'),
    fitSelection: () => fit(context, 'fitSelection'),
    clear: () => clear(context),
    evidence: () => evidence(context),
    dispose() {
      if (context.disposed) return false;
      clear(context);
      context.disposed = true;
      return true;
    },
  });
}
