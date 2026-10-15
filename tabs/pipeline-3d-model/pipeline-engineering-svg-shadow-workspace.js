import { assertEngineeringRevisionToken } from '../../core/engineering-scene/index.js';
import { createEngineeringSvgAdapterBridge } from '../../core/engineering-svg/engineering-svg-adapter-bridge.js';
import { createEngineeringSvgWorkspaceShellFromAdapterBridge } from '../../core/engineering-svg/shell-runtime.js';
import { createPipelineEngineeringSvgAdapter } from './pipeline-engineering-svg-adapter.js';

export const PIPELINE_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA = 'PipelineEngineeringSvgShadowWorkspace.v1';

function requiredHost(value) {
  if (!value?.ownerDocument?.createElement) {
    throw new TypeError('Pipeline engineering SVG shadow workspace requires a DOM host.');
  }
  return value;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Pipeline engineering SVG shadow workspace requires ${label}.`);
  return result;
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`Pipeline engineering SVG shadow workspace requires ${label}.`);
  }
  return value;
}

function ownerSnapshot(reader, path = 'Pipeline engineering SVG owner snapshot') {
  const value = reader();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'revision')) {
    throw new TypeError(`${path} requires revision.`);
  }
  assertEngineeringRevisionToken(value.revision, `${path} revision`);
  return value;
}

function ownerEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Pipeline engineering SVG owner event must be an object.');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'snapshot')) {
    throw new TypeError('Pipeline engineering SVG owner event requires snapshot.');
  }
  const reason = String(value.reason ?? '').trim();
  if (!reason) throw new TypeError('Pipeline engineering SVG owner event requires reason.');
  return Object.freeze({
    snapshot: ownerSnapshot(() => value.snapshot, 'Pipeline engineering SVG owner event snapshot'),
    reason,
  });
}

function ownerSubscription(subscribe, listener) {
  const unsubscribe = subscribe((event) => listener(ownerEvent(event)));
  if (typeof unsubscribe !== 'function') {
    throw new TypeError('Pipeline engineering SVG owner subscription must return an unsubscribe function.');
  }
  return unsubscribe;
}

export async function createPipelineEngineeringSvgShadowWorkspace(options = {}) {
  const host = requiredHost(options.host);
  const adapterId = requiredText(options.adapterId, 'adapterId');
  const sceneId = requiredText(options.sceneId, 'sceneId');
  const shellId = requiredText(options.shellId, 'shellId');
  const getSnapshot = requiredFunction(options.getSnapshot, 'getSnapshot owner function');
  const subscribeSnapshot = requiredFunction(options.subscribeSnapshot, 'subscribeSnapshot owner function');

  const pipeline = createPipelineEngineeringSvgAdapter({
    adapterId,
    sceneId,
    getSnapshot: () => ownerSnapshot(getSnapshot),
    subscribeSnapshot: (listener) => ownerSubscription(subscribeSnapshot, listener),
  });
  const bridge = await createEngineeringSvgAdapterBridge(pipeline.adapter);
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
    bridge.dispose();
    throw error;
  }

  const buildSnapshot = () => pipeline.buildSnapshot(ownerSnapshot(getSnapshot));
  let destroyed = false;
  return Object.freeze({
    schema: PIPELINE_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA,
    adapter: pipeline.adapter,
    bridge,
    shell,
    buildSnapshot,
    buildAdapterSnapshot: buildSnapshot,
    getBuiltScene: () => buildSnapshot().scene,
    getParityReport: () => buildSnapshot().parity,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      try {
        shell.destroy();
      } finally {
        bridge.dispose();
      }
      return true;
    },
  });
}

export const _test = Object.freeze({ ownerEvent, ownerSnapshot, ownerSubscription });
