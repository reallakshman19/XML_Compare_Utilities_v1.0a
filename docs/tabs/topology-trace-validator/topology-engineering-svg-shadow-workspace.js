import { assertEngineeringRevisionToken } from '../../core/engineering-scene/index.js';
import { createEngineeringSvgAdapterBridge } from '../../core/engineering-svg/engineering-svg-adapter-bridge.js';
import { createEngineeringSvgWorkspaceShellFromAdapterBridge } from '../../core/engineering-svg/shell-runtime.js';
import { createTopologyEngineeringSvgAdapter } from './topology-engineering-svg-adapter.js';

export const TOPOLOGY_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA = 'TopologyEngineeringSvgShadowWorkspace.v1';

function requiredHost(value) {
  if (!value?.ownerDocument?.createElement) {
    throw new TypeError('Topology engineering SVG shadow workspace requires a DOM host.');
  }
  return value;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Topology engineering SVG shadow workspace requires ${label}.`);
  return result;
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`Topology engineering SVG shadow workspace requires ${label}.`);
  }
  return value;
}

function ownerViewModel(reader) {
  const value = reader();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Topology engineering SVG owner getViewModel must return a view-model object.');
  }
  return value;
}

function ownerRevision(reader) {
  return assertEngineeringRevisionToken(
    reader(),
    'Topology engineering SVG owner revision',
  );
}

function ownerEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Topology engineering SVG owner event must be an object.');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'viewModel')) {
    throw new TypeError('Topology engineering SVG owner event requires viewModel.');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'revision')) {
    throw new TypeError('Topology engineering SVG owner event requires revision.');
  }
  const reason = String(value.reason ?? '').trim();
  if (!reason) throw new TypeError('Topology engineering SVG owner event requires reason.');
  if (!value.viewModel || typeof value.viewModel !== 'object' || Array.isArray(value.viewModel)) {
    throw new TypeError('Topology engineering SVG owner event viewModel must be an object.');
  }
  assertEngineeringRevisionToken(value.revision, 'Topology engineering SVG owner event revision');
  return value;
}

function ownerSubscription(subscribe, listener) {
  const unsubscribe = subscribe((event) => listener(ownerEvent(event)));
  if (typeof unsubscribe !== 'function') {
    throw new TypeError('Topology engineering SVG owner subscription must return an unsubscribe function.');
  }
  return unsubscribe;
}

export async function createTopologyEngineeringSvgShadowWorkspace(options = {}) {
  const host = requiredHost(options.host);
  const adapterId = requiredText(options.adapterId, 'adapterId');
  const sceneId = requiredText(options.sceneId, 'sceneId');
  const shellId = requiredText(options.shellId, 'shellId');
  const getViewModel = requiredFunction(options.getViewModel, 'getViewModel owner function');
  const getRevision = requiredFunction(options.getRevision, 'getRevision owner function');
  const subscribeViewModel = requiredFunction(options.subscribeViewModel, 'subscribeViewModel owner function');

  const topology = createTopologyEngineeringSvgAdapter({
    adapterId,
    sceneId,
    getViewModel: () => ownerViewModel(getViewModel),
    getRevision: () => ownerRevision(getRevision),
    subscribeViewModel: (listener) => ownerSubscription(subscribeViewModel, listener),
    coordinateSystem: options.coordinateSystem,
  });
  const bridge = await createEngineeringSvgAdapterBridge(topology.adapter);
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

  let destroyed = false;
  return Object.freeze({
    schema: TOPOLOGY_ENGINEERING_SVG_SHADOW_WORKSPACE_SCHEMA,
    adapter: topology.adapter,
    bridge,
    shell,
    buildSnapshot: topology.buildSnapshot,
    buildAdapterSnapshot: topology.buildSnapshot,
    getParityReport: topology.getParityReport,
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
