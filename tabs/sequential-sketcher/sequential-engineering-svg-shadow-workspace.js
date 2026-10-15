import { createEngineeringSvgAdapterBridge } from '../../core/engineering-svg/engineering-svg-adapter-bridge.js';
import { createEngineeringSvgWorkspaceShellFromAdapterBridge } from '../../core/engineering-svg/shell-runtime.js';
import { createSequentialEngineeringSvgAdapter } from './sequential-engineering-svg-adapter.js';
import { validateSequentialEngineeringSvgParity as validateSequentialEngineeringSvgShadowParity } from './sequential-engineering-svg-parity-validation.js';

export { validateSequentialEngineeringSvgShadowParity };

export const SEQUENTIAL_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA = 'SequentialEngineeringSvgShadowWorkspace.v1';

const PROJECTIONS = Object.freeze(['ISO', 'XY', 'XZ', 'YZ']);
function requiredHost(value) {
  if (!value?.ownerDocument?.createElement) {
    throw new TypeError('Sequential engineering SVG shadow workspace requires a DOM host.');
  }
  return value;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Sequential engineering SVG shadow workspace requires ${label}.`);
  return result;
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`Sequential engineering SVG shadow workspace requires ${label}.`);
  }
  return value;
}

function ownerState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Sequential engineering SVG owner state must be an object.');
  }
  return value;
}

function ownerEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Sequential engineering SVG owner event must be an object.');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'state')) {
    throw new TypeError('Sequential engineering SVG owner event requires state.');
  }
  const reason = String(value.reason ?? '').trim();
  if (!reason) throw new TypeError('Sequential engineering SVG owner event requires reason.');
  if (value.visibleProjection != null && !PROJECTIONS.includes(value.visibleProjection)) {
    throw new TypeError(`Sequential engineering SVG owner event has unsupported projection "${value.visibleProjection}".`);
  }
  return Object.freeze({ ...value, state: ownerState(value.state), reason });
}

function subscribeOwner(subscribe, sequential, listener) {
  const unsubscribe = subscribe((rawEvent) => {
    const event = ownerEvent(rawEvent);
    const snapshot = sequential.buildSnapshot(event.state, {
      visibleProjection: event.visibleProjection,
    });
    validateSequentialEngineeringSvgShadowParity(snapshot.parity);
    listener(event);
  });
  if (typeof unsubscribe !== 'function') {
    throw new TypeError('Sequential engineering SVG owner subscription must return an unsubscribe function.');
  }
  return unsubscribe;
}

function childSnapshot(host) {
  return new Set(host.children ? [...host.children] : []);
}

function removeAddedChildren(host, before) {
  if (!host.children) return;
  [...host.children].forEach((child) => {
    if (!before.has(child)) child.remove();
  });
}

function reconcileSelection(shell, scene) {
  const available = new Set(scene.entities.map((entity) => entity.id));
  const selected = shell.getSelection();
  const surviving = selected.filter((id) => available.has(id));
  if (surviving.length !== selected.length) shell.setSelection(surviving, 'scene-identity-reconcile');
}

export async function createSequentialEngineeringSvgShadowWorkspace(options = {}) {
  const host = requiredHost(options.host);
  const adapterId = requiredText(options.adapterId, 'adapterId');
  const sceneId = requiredText(options.sceneId, 'sceneId');
  const shellId = requiredText(options.shellId, 'shellId');
  const getState = requiredFunction(options.getState, 'getState owner function');
  const subscribeState = requiredFunction(options.subscribeState, 'subscribeState owner function');
  const initialState = ownerState(getState());
  let sequential;

  sequential = createSequentialEngineeringSvgAdapter({
    adapterId,
    sceneId,
    getState: () => ownerState(getState()),
    subscribeState: (listener) => subscribeOwner(subscribeState, sequential, listener),
    coordinateSystem: options.coordinateSystem,
  });
  const initialBuild = sequential.buildSnapshot(initialState, {
    visibleProjection: options.projection ?? initialState.visibleProjection,
  });
  const initialParityEvidence = validateSequentialEngineeringSvgShadowParity(initialBuild.parity);
  const bridge = await createEngineeringSvgAdapterBridge(sequential.adapter);
  const before = childSnapshot(host);
  let shell;

  try {
    shell = createEngineeringSvgWorkspaceShellFromAdapterBridge({
      bridge,
      shellId,
      host,
      projection: options.projection,
      viewport: options.viewport,
      padding: options.padding,
      selectedIds: options.selectedIds,
      ariaLabel: options.ariaLabel,
    });
  } catch (error) {
    removeAddedChildren(host, before);
    bridge.dispose();
    throw error;
  }

  let unsubscribeReconcile;
  try {
    const sceneSource = bridge.getDependencies().sceneSource;
    unsubscribeReconcile = sceneSource.subscribe((event) => {
      validateSequentialEngineeringSvgShadowParity(sequential.getParityReport());
      reconcileSelection(shell, event.scene);
    });
  } catch (error) {
    shell.destroy();
    bridge.dispose();
    throw error;
  }

  let destroyed = false;
  return Object.freeze({
    schema: SEQUENTIAL_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA,
    adapter: sequential.adapter,
    bridge,
    shell,
    initialParityEvidence,
    buildSnapshot: sequential.buildSnapshot,
    getParityReport: sequential.getParityReport,
    getParityEvidence: () => validateSequentialEngineeringSvgShadowParity(sequential.getParityReport()),
    getAuthoritySnapshot: () => {
      const snapshot = sequential.buildSnapshot(ownerState(getState()));
      validateSequentialEngineeringSvgShadowParity(snapshot.parity);
      return snapshot.authority;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      unsubscribeReconcile();
      try {
        shell.destroy();
      } finally {
        bridge.dispose();
      }
      return true;
    },
  });
}
