import { engineeringRevisionTokensEqual } from '../../core/engineering-svg/engineering-svg-command-gateway.js';
import { createEngineeringSvgPropertyProvider } from '../../core/engineering-svg/engineering-svg-property-provider.js';
import { createEngineeringSvgAdapter } from '../../core/engineering-svg/engineering-svg-adapter.js';
import { buildTopologyEngineeringSvgPropertySets } from './topology-engineering-svg-properties.js';
import { buildTopologyEngineeringSvgScene } from './topology-engineering-svg-scene.js';

export const TOPOLOGY_ENGINEERING_SVG_ADAPTER_SCHEMA = 'TopologyEngineeringSvgAdapter.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

export function createTopologyEngineeringSvgAdapter(options = {}) {
  const getViewModel = requiredFunction(options.getViewModel, 'Topology engineering SVG getViewModel');
  const getRevision = requiredFunction(options.getRevision, 'Topology engineering SVG getRevision');
  const subscribeViewModel = requiredFunction(options.subscribeViewModel, 'Topology engineering SVG subscribeViewModel');
  const sceneId = String(options.sceneId || '').trim();
  const adapterId = String(options.adapterId || '').trim();
  if (!sceneId || !adapterId) throw new TypeError('Topology engineering SVG requires sceneId and adapterId.');
  let lastBuild = null;

  function build(viewModel = getViewModel(), revision = getRevision()) {
    lastBuild = buildTopologyEngineeringSvgScene(viewModel, {
      sceneId,
      revision,
      coordinateSystem: options.coordinateSystem,
    });
    return lastBuild;
  }

  const propertyProvider = createEngineeringSvgPropertyProvider({
    getPropertySets({ selectedIds, revision }) {
      const current = build();
      if (!engineeringRevisionTokensEqual(current.scene.revision, revision)) {
        throw new Error('Topology engineering SVG property request uses a stale scene revision.');
      }
      return buildTopologyEngineeringSvgPropertySets(current.scene, selectedIds);
    },
  });

  const adapter = createEngineeringSvgAdapter({
    descriptor: {
      adapterId,
      domainType: 'TOPOLOGY_TRACE_VALIDATOR',
      accessMode: 'read-only',
      projections: ['ISO', 'XY', 'XZ', 'YZ'],
      capabilities: { selection: true, properties: true, parity: true, editing: false },
      metadata: { owner: 'topology-trace-validator' },
    },
    getScene: () => build().scene,
    subscribeScene(listener) {
      const unsubscribe = subscribeViewModel((event) => {
        const viewModel = event?.viewModel ?? event?.value ?? event ?? getViewModel();
        const revision = event?.revision ?? getRevision();
        listener({
          scene: build(viewModel, revision).scene,
          reason: String(event?.reason || 'topology-view-model-update'),
        });
      });
      if (typeof unsubscribe !== 'function') {
        throw new TypeError('Topology engineering SVG subscribeViewModel must return an unsubscribe function.');
      }
      return unsubscribe;
    },
    propertyProvider,
  });

  return Object.freeze({
    schema: TOPOLOGY_ENGINEERING_SVG_ADAPTER_SCHEMA,
    adapter,
    buildSnapshot: build,
    getParityReport: () => lastBuild?.parity ?? build().parity,
  });
}
