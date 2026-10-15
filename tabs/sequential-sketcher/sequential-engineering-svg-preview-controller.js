import { SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY, SEQUENTIAL_ENGINEERING_SVG_RENDERER } from './sequential-engineering-svg-preview-policy.js';
import { createSequentialEngineeringSvgPreviewSurface, createSequentialEngineeringSvgPreviewWorkspace } from './sequential-engineering-svg-preview-workspace.js';

export const SEQUENTIAL_ENGINEERING_SVG_PREVIEW_CONTROLLER_SCHEMA = 'SequentialEngineeringSvgPreviewController.v1';

const CONTROLLERS = new WeakMap();
const PROJECTIONS = Object.freeze(['ISO', 'XY', 'XZ', 'YZ']);
const PRE_SESSION_REASONS = Object.freeze(['source-inspected', 'source-reloaded']);

function requiredWorkspace(value) {
  if (typeof value?.getEngineeringSvgOwnerSnapshot !== 'function'
    || typeof value?.subscribeEngineeringSvgOwnerState !== 'function') {
    throw new TypeError('Sequential Engineering SVG preview requires the production workspace owner bridge.');
  }
  return value;
}

function injectFailure(factory, stage) {
  if (typeof factory !== 'function') return;
  const result = factory(stage);
  if (result instanceof Error) throw result;
  if (result) throw new Error(String(result));
}

function validSnapshot(value) {
  if (value?.schema !== 'SequentialEngineeringSvgOwnerSnapshot.v1'
    || value.session?.schema !== 'SequentialConstructionSession.v1'
    || value.revision?.schema !== 'EngineeringRevisionToken.v1'
    || !String(value.sessionFingerprint || '').trim()
    || !PROJECTIONS.includes(value.visibleProjection)) {
    throw new TypeError('Sequential Engineering SVG owner snapshot is invalid or stale.');
  }
  return value;
}

function validOwnerEvent(value) {
  if (value?.schema !== 'SequentialEngineeringSvgOwnerEvent.v1'
    || !String(value.reason || '').trim()
    || !Object.hasOwn(value, 'snapshot')) {
    throw new TypeError('Sequential Engineering SVG owner event is invalid.');
  }
  if (value.snapshot !== null) return validSnapshot(value.snapshot) && value;
  if (!PRE_SESSION_REASONS.includes(value.reason)) {
    throw new TypeError('Only source inspection or reload may publish a null owner snapshot.');
  }
  return value;
}

function previewAvailable(state) { return state.ownerSnapshot !== null; }
function syncAvailability(state) { state.surface.setAvailability(previewAvailable(state)); }

function subscribeSnapshot(state, listener) {
  if (state.destroyed) throw new Error('Sequential preview controller is destroyed.');
  state.fanout.add(listener);
  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    return state.fanout.delete(listener);
  };
}

function publishSnapshot(state, event) {
  const failures = [];
  [...state.fanout].forEach((listener) => {
    try { listener(event); } catch (error) { failures.push(error); }
  });
  if (failures.length) throw new AggregateError(failures, 'Shared preview scene refresh failed.');
  state.refreshCount += 1;
}

function disposePreview(state) {
  const current = state.preview;
  state.preview = null;
  if (!current) { state.surface.clearPreviewRoot(); return false; }
  try { current.clearSelection(); } catch {}
  try { current.destroy(); } catch {} finally { state.surface.clearPreviewRoot(); }
  return true;
}

function showConstruction(state, message = 'Construction SVG active.', status = 'ready') {
  disposePreview(state);
  state.renderer = SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION;
  state.surface.show(state.renderer);
  state.surface.setProjection(state.constructionProjection);
  state.surface.announce(message, status);
  return true;
}

function containFailure(state, error, stage) {
  state.failureCount += 1;
  const detail = String(error?.message || error);
  showConstruction(state,
    `Engineering SVG preview failed during ${stage}: ${detail}. Construction SVG retained; select the preview to retry.`,
    'error');
  state.options.onFailure?.(Object.freeze({ stage, message: detail }));
  return false;
}

function handleOwnerEvent(state, rawEvent) {
  if (state.destroyed) return false;
  try {
    const event = validOwnerEvent(rawEvent);
    state.ownerSnapshot = event.snapshot;
    syncAvailability(state);
    if (event.snapshot === null) {
      return showConstruction(state, 'Construction SVG active. Engineering SVG preview requires an open branch.');
    }
    if (state.renderer !== SEQUENTIAL_ENGINEERING_SVG_RENDERER.PREVIEW || !state.preview) return true;
    publishSnapshot(state, event);
    const rejected = state.preview.bridge.getLastRejectedEvent();
    if (rejected) throw new Error(rejected.message);
    state.surface.announce(`Engineering SVG preview refreshed: ${event.reason}.`, 'ready');
    return true;
  } catch (error) {
    state.ownerSnapshot = null;
    syncAvailability(state);
    return containFailure(state, error, 'owner-state refresh');
  }
}

function ensureOwnerSubscription(state) {
  if (state.destroyed) return false;
  if (state.ownerUnsubscribe) return true;
  state.subscriptionAttempts += 1;
  try {
    injectFailure(state.options.failureFactory, 'owner-subscription');
    const unsubscribe = state.workspace.subscribeEngineeringSvgOwnerState(state.handleOwnerEvent);
    if (typeof unsubscribe !== 'function') throw new TypeError('Sequential owner subscription must return an unsubscribe function.');
    state.ownerUnsubscribe = unsubscribe;
    return true;
  } catch (error) {
    return containFailure(state, error, 'owner subscription');
  }
}

function previewOptions(state, captured) {
  return {
    adapterId: 'sequential-engineering-svg-preview-adapter',
    sceneId: 'sequential-engineering-svg-preview-scene',
    shellId: 'sequential-engineering-svg-preview-shell',
    host: state.surface.previewHost,
    viewport: state.surface.getViewport(),
    projection: captured.visibleProjection,
    getSnapshot: () => state.ownerSnapshot,
    subscribeSnapshot: (listener) => subscribeSnapshot(state, listener),
    selectedCandidateId: captured.constructionCandidateSelection,
    failureFactory: state.options.failureFactory,
    ariaLabel: 'Sequential Engineering SVG preview',
  };
}

async function showPreview(state) {
  if (state.destroyed || !previewAvailable(state) || !ensureOwnerSubscription(state)) return false;
  const captured = state.ownerSnapshot;
  state.constructionProjection = state.surface.currentProjection();
  try {
    const mounted = await state.createPreview(previewOptions(state, captured));
    if (state.destroyed || state.ownerSnapshot !== captured) {
      mounted.destroy();
      throw new Error('Owner snapshot changed while the preview was mounting. Retry the preview.');
    }
    state.preview = mounted;
    state.renderer = SEQUENTIAL_ENGINEERING_SVG_RENDERER.PREVIEW;
    state.surface.show(state.renderer);
    state.surface.setProjection(mounted.getProjection());
    state.surface.announce('Engineering SVG preview active. Read-only presentation and properties.', 'ready');
    return true;
  } catch (error) {
    return containFailure(state, error, 'preview mount');
  }
}

async function switchRenderer(state, value) {
  if (state.destroyed) return false;
  if (value === SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION) return showConstruction(state);
  if (value === SEQUENTIAL_ENGINEERING_SVG_RENDERER.PREVIEW) return showPreview(state);
  return containFailure(state, new TypeError(`Unsupported Sequential renderer "${value}".`), 'renderer switch');
}

function switchProjection(state, value) {
  if (state.destroyed || !PROJECTIONS.includes(value)) return false;
  if (state.renderer === SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION) {
    state.constructionProjection = value;
    return true;
  }
  try {
    state.preview.setProjection(value);
    state.surface.setProjection(value);
    state.surface.announce(`Engineering SVG preview projection: ${value}.`, 'ready');
    return true;
  } catch (error) {
    return containFailure(state, error, 'projection');
  }
}

function handleClick(state, event) {
  const rendererButton = event.target?.closest?.('[data-ssk-renderer]');
  if (rendererButton) {
    event.preventDefault(); event.stopImmediatePropagation();
    switchRenderer(state, rendererButton.dataset.sskRenderer);
    return;
  }
  const projectionButton = event.target?.closest?.('[data-ssk-view]');
  if (!projectionButton) return;
  if (state.renderer === SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION) {
    state.constructionProjection = projectionButton.dataset.sskView;
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  switchProjection(state, projectionButton.dataset.sskView);
}

function initialize(state) {
  try {
    const initial = state.workspace.getEngineeringSvgOwnerSnapshot();
    state.ownerSnapshot = initial === null ? null : validSnapshot(initial);
  } catch (error) {
    containFailure(state, error, 'initial owner snapshot');
  }
  syncAvailability(state);
  showConstruction(state, previewAvailable(state)
    ? 'Construction SVG active. Engineering SVG preview is available.'
    : 'Construction SVG active. Engineering SVG preview requires an open branch.');
  ensureOwnerSubscription(state);
  state.root.addEventListener('click', state.onClick, true);
}

function destroyController(state) {
  if (state.destroyed) return false;
  state.destroyed = true;
  state.root.removeEventListener('click', state.onClick, true);
  const unsubscribe = state.ownerUnsubscribe;
  state.ownerUnsubscribe = null;
  try { unsubscribe?.(); } catch {}
  disposePreview(state);
  state.fanout.clear();
  state.surface.show(SEQUENTIAL_ENGINEERING_SVG_RENDERER.CONSTRUCTION);
  CONTROLLERS.delete(state.root);
  return true;
}

function controllerApi(state) {
  return Object.freeze({
    schema: SEQUENTIAL_ENGINEERING_SVG_PREVIEW_CONTROLLER_SCHEMA,
    policy: SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY,
    switchRenderer: (value) => switchRenderer(state, value),
    setProjection: (value) => switchProjection(state, value),
    getPreviewWorkspace: () => state.preview,
    getState: () => Object.freeze({
      renderer: state.renderer, previewAvailable: previewAvailable(state), previewMounted: Boolean(state.preview),
      ownerSubscriptionActive: Boolean(state.ownerUnsubscribe), ownerSubscriptionAttempts: state.subscriptionAttempts,
      ownerFanoutListeners: state.fanout.size, refreshCount: state.refreshCount,
      failureCount: state.failureCount, destroyed: state.destroyed,
    }),
    destroy: () => destroyController(state),
  });
}

export function mountSequentialEngineeringSvgPreviewController(root, options = {}) {
  if (!root?.querySelector) throw new TypeError('Sequential preview controller requires a root.');
  const existing = CONTROLLERS.get(root);
  if (existing) return existing;
  const state = {
    root, options, workspace: requiredWorkspace(options.workspace),
    surface: createSequentialEngineeringSvgPreviewSurface(root),
    createPreview: options.createPreviewWorkspace || createSequentialEngineeringSvgPreviewWorkspace,
    fanout: new Set(), ownerSnapshot: null, ownerUnsubscribe: null, preview: null,
    renderer: SEQUENTIAL_ENGINEERING_SVG_PREVIEW_POLICY.defaultRenderer,
    constructionProjection: 'ISO', destroyed: false, subscriptionAttempts: 0, refreshCount: 0, failureCount: 0,
  };
  state.constructionProjection = state.surface.currentProjection();
  state.handleOwnerEvent = (event) => handleOwnerEvent(state, event);
  state.onClick = (event) => handleClick(state, event);
  const controller = controllerApi(state);
  CONTROLLERS.set(root, controller);
  initialize(state);
  return controller;
}

export function getSequentialEngineeringSvgPreviewController(root) { return CONTROLLERS.get(root) || null; }
