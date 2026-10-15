import { createEngineeringSvgAdapterBridge } from '../../core/engineering-svg/engineering-svg-adapter-bridge.js';
import { createEngineeringSvgWorkspaceShellFromAdapterBridge } from '../../core/engineering-svg/shell-runtime.js';
import { createSequentialEngineeringSvgAdapter } from './sequential-engineering-svg-adapter.js';
import { validateSequentialEngineeringSvgParity } from './sequential-engineering-svg-parity-validation.js';

export const SEQUENTIAL_ENGINEERING_SVG_PREVIEW_WORKSPACE_SCHEMA =
  'SequentialEngineeringSvgPreviewWorkspace.v1';

const PROJECTIONS = Object.freeze(['ISO', 'XY', 'XZ', 'YZ']);
const DEFAULT_FACTORIES = Object.freeze({
  createAdapter: createSequentialEngineeringSvgAdapter,
  createBridge: createEngineeringSvgAdapterBridge,
  createShell: createEngineeringSvgWorkspaceShellFromAdapterBridge,
});

function requiredElement(root, selector) {
  const value = root?.querySelector?.(selector);
  if (!value) throw new Error(`Sequential Engineering SVG preview element missing: ${selector}`);
  return value;
}

function setInteractiveSurface(element, visible) {
  element.hidden = !visible;
  element.setAttribute('aria-hidden', String(!visible));
  if (visible) element.removeAttribute('inert');
  else element.setAttribute('inert', '');
}

function measuredViewport(element) {
  const bounds = element.getBoundingClientRect?.();
  const width = Number(bounds?.width ?? element.clientWidth);
  const height = Number(bounds?.height ?? element.clientHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Sequential Engineering SVG preview requires a visible positive viewport.');
  }
  return Object.freeze({ width, height });
}

export function createSequentialEngineeringSvgPreviewSurface(root) {
  const construction = requiredElement(root, '[data-ssk-construction-surface]');
  const previewHost = requiredElement(root, '[data-ssk-engineering-svg-preview-host]');
  const constructionButton = requiredElement(root, '[data-ssk-renderer="CONSTRUCTION_SVG"]');
  const previewButton = requiredElement(root, '[data-ssk-renderer="ENGINEERING_SVG_PREVIEW"]');
  const status = requiredElement(root, '[data-ssk-preview-status]');
  const setPressed = (renderer) => {
    const constructionActive = renderer === 'CONSTRUCTION_SVG';
    constructionButton.classList.toggle('is-active', constructionActive);
    previewButton.classList.toggle('is-active', !constructionActive);
    constructionButton.setAttribute('aria-pressed', String(constructionActive));
    previewButton.setAttribute('aria-pressed', String(!constructionActive));
  };
  return Object.freeze({
    previewHost,
    currentProjection: () => root.querySelector('[data-ssk-view].is-active')?.dataset?.sskView || 'ISO',
    getViewport: () => measuredViewport(construction),
    setAvailability: (available) => { previewButton.disabled = !available; },
    setProjection(projection) { root.querySelectorAll('[data-ssk-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.sskView === projection)); },
    show(renderer) {
      const active = renderer === 'ENGINEERING_SVG_PREVIEW';
      setInteractiveSurface(construction, !active); setInteractiveSurface(previewHost, active); setPressed(renderer);
    },
    announce(message, state = 'ready') { status.textContent = message; status.setAttribute('data-ssk-preview-state', state); },
    clearPreviewRoot: () => previewHost.replaceChildren(),
  });
}

function requiredHost(value) {
  if (!value?.ownerDocument?.createElement) throw new TypeError('Sequential Engineering SVG preview requires a DOM host.');
  return value;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Sequential Engineering SVG preview requires ${label}.`);
  return result;
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`Sequential Engineering SVG preview requires ${label}.`);
  return value;
}

function injectFailure(factory, stage) {
  if (typeof factory !== 'function') return;
  const result = factory(stage);
  if (result instanceof Error) throw result;
  if (result) throw new Error(String(result));
}

function snapshot(value) {
  if (value?.schema !== 'SequentialEngineeringSvgOwnerSnapshot.v1'
    || value.session?.schema !== 'SequentialConstructionSession.v1'
    || !PROJECTIONS.includes(value.visibleProjection)) {
    throw new TypeError('Sequential Engineering SVG preview requires a valid owner snapshot.');
  }
  return value;
}

function ownerEvent(value) {
  if (value?.schema !== 'SequentialEngineeringSvgOwnerEvent.v1'
    || !String(value.reason || '').trim() || !Object.hasOwn(value, 'snapshot')) {
    throw new TypeError('Sequential Engineering SVG preview received an invalid owner event.');
  }
  return Object.freeze({ ...value, snapshot: snapshot(value.snapshot) });
}

function factorySet(value = {}) {
  return Object.freeze({
    createAdapter: value.createAdapter || DEFAULT_FACTORIES.createAdapter,
    createBridge: value.createBridge || DEFAULT_FACTORIES.createBridge,
    createShell: value.createShell || DEFAULT_FACTORIES.createShell,
  });
}

function removeAddedChildren(host, before) {
  if (!host.children) return;
  [...host.children].forEach((child) => { if (!before.has(child)) child.remove(); });
}

function reconcileSelection(shell, scene) {
  const available = new Set(scene.entities.map((entity) => entity.id));
  const selected = shell.getSelection();
  const surviving = selected.filter((id) => available.has(id));
  if (surviving.length !== selected.length) shell.setSelection(surviving, 'scene-identity-reconcile');
}

async function mapCandidateSelection(adapter, shell, candidateId) {
  const target = String(candidateId || '').trim();
  if (!target) return shell.setSelection([], 'candidate-domain-ref-empty');
  const scene = await adapter.getScene();
  const entity = scene.entities.find((row) => row.domainRef?.candidateId === target);
  return shell.setSelection(entity ? [entity.id] : [], 'candidate-domain-ref');
}

function subscribeValidated(options, sequential, listener) {
  const unsubscribe = options.subscribeSnapshot((rawEvent) => {
    const event = ownerEvent(rawEvent);
    injectFailure(options.failureFactory, 'scene-refresh');
    const build = sequential.buildSnapshot(event.snapshot, { visibleProjection: event.snapshot.visibleProjection });
    validateSequentialEngineeringSvgParity(build.parity);
    listener(event);
  });
  if (typeof unsubscribe !== 'function') throw new TypeError('Sequential preview fanout must return an unsubscribe function.');
  return unsubscribe;
}

function createSequentialRuntime(options, factories, getSnapshot, subscribeSnapshot) {
  let sequential;
  injectFailure(options.failureFactory, 'adapter-creation');
  sequential = factories.createAdapter({
    adapterId: requiredText(options.adapterId, 'adapterId'),
    sceneId: requiredText(options.sceneId, 'sceneId'),
    getState: () => snapshot(getSnapshot()),
    subscribeState: (listener) => subscribeValidated({
      subscribeSnapshot, failureFactory: options.failureFactory,
    }, sequential, listener),
    coordinateSystem: options.coordinateSystem,
  });
  return sequential;
}

function shellOptions(options, bridge, host) {
  return {
    bridge, host, shellId: requiredText(options.shellId, 'shellId'), accessMode: 'read-only',
    projection: options.projection, viewport: options.viewport, padding: options.padding,
    selectedIds: options.selectedIds, ariaLabel: options.ariaLabel || 'Sequential Engineering SVG preview',
  };
}

function assertReadOnlyBoundary(bridge, shell) {
  const dependencies = bridge.getDependencies();
  if (shell.accessMode !== 'read-only' || dependencies.commandGateway !== null) {
    throw new Error('Sequential Engineering SVG preview crossed the read-only boundary.');
  }
  return dependencies;
}

async function mountRuntime(state, initial) {
  injectFailure(state.options.failureFactory, 'parity-validation');
  const build = state.sequential.buildSnapshot(initial, {
    visibleProjection: state.options.projection ?? initial.visibleProjection,
  });
  state.initialParityEvidence = validateSequentialEngineeringSvgParity(build.parity);
  injectFailure(state.options.failureFactory, 'bridge-creation');
  state.bridge = await state.factories.createBridge(state.sequential.adapter);
  injectFailure(state.options.failureFactory, 'shell-mounting');
  state.shell = state.factories.createShell(shellOptions(state.options, state.bridge, state.host));
  const dependencies = assertReadOnlyBoundary(state.bridge, state.shell);
  state.unsubscribeScene = dependencies.sceneSource.subscribe((event) => {
    validateSequentialEngineeringSvgParity(state.sequential.getParityReport());
    reconcileSelection(state.shell, event.scene);
  });
  if (typeof state.unsubscribeScene !== 'function') throw new TypeError('Sequential preview scene subscription must return an unsubscribe function.');
  await mapCandidateSelection(state.sequential.adapter, state.shell, state.options.selectedCandidateId);
}

function cleanupRuntime(state) {
  try { state.unsubscribeScene?.(); } catch {}
  try { state.shell?.destroy(); } catch {}
  try { state.bridge?.dispose(); } catch {}
}

function previewApi(state) {
  let destroyed = false;
  return Object.freeze({
    schema: SEQUENTIAL_ENGINEERING_SVG_PREVIEW_WORKSPACE_SCHEMA,
    accessMode: 'read-only', commandGateway: null, adapter: state.sequential.adapter,
    bridge: state.bridge, shell: state.shell, initialParityEvidence: state.initialParityEvidence,
    getSelection: state.shell.getSelection, setSelection: state.shell.setSelection,
    clearSelection: () => state.shell.setSelection([], 'preview-clear'),
    getProjection: state.shell.workspace.getProjection,
    setProjection(value) {
      if (destroyed) throw new Error('Sequential Engineering SVG preview is destroyed.');
      injectFailure(state.options.failureFactory, 'projection');
      return state.shell.workspace.setProjection(value);
    },
    apply: () => state.shell.apply(),
    destroy() {
      if (destroyed) return false;
      destroyed = true; cleanupRuntime(state); return true;
    },
  });
}

export async function createSequentialEngineeringSvgPreviewWorkspace(options = {}) {
  const host = requiredHost(options.host);
  const getSnapshot = requiredFunction(options.getSnapshot, 'getSnapshot');
  const subscribeSnapshot = requiredFunction(options.subscribeSnapshot, 'subscribeSnapshot');
  const state = {
    options, host, factories: factorySet(options.factories), bridge: null, shell: null,
    unsubscribeScene: null, initialParityEvidence: null, sequential: null,
  };
  const initial = snapshot(getSnapshot());
  const before = new Set(host.children ? [...host.children] : []);
  try {
    state.sequential = createSequentialRuntime(options, state.factories, getSnapshot, subscribeSnapshot);
    await mountRuntime(state, initial);
    return previewApi(state);
  } catch (error) {
    cleanupRuntime(state); removeAddedChildren(host, before); throw error;
  }
}
