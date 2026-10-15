import { engineeringRevisionTokensEqual } from '../../core/engineering-svg/engineering-svg-command-gateway.js';
import { createEngineeringSvgPropertyProvider } from '../../core/engineering-svg/engineering-svg-property-provider.js';
import { createEngineeringSvgAdapter } from '../../core/engineering-svg/engineering-svg-adapter.js';
import { buildPipelineEngineeringSvgPropertySets } from './pipeline-engineering-svg-properties.js';
import { buildPipelineEngineeringSvgScene } from './pipeline-engineering-svg-scene.js';

export const PIPELINE_ENGINEERING_SVG_ADAPTER_SCHEMA = 'PipelineEngineeringSvgAdapter.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

export function createPipelineEngineeringSvgAdapter(options = {}) {
  const getSnapshot = requiredFunction(options.getSnapshot, 'Pipeline engineering SVG getSnapshot');
  const subscribeSnapshot = requiredFunction(options.subscribeSnapshot, 'Pipeline engineering SVG subscribeSnapshot');
  const sceneId = String(options.sceneId ?? '').trim();
  const adapterId = String(options.adapterId ?? '').trim();
  if (!sceneId || !adapterId) throw new TypeError('Pipeline engineering SVG requires sceneId and adapterId.');
  let lastBuild = null;

  function build(snapshot = getSnapshot()) {
    lastBuild = buildPipelineEngineeringSvgScene(snapshot, { sceneId });
    return lastBuild;
  }

  const propertyProvider = createEngineeringSvgPropertyProvider({
    getPropertySets({ selectedIds, revision }) {
      const current = build();
      if (!engineeringRevisionTokensEqual(current.scene.revision, revision)) {
        throw new Error('Pipeline engineering SVG property request uses a stale scene revision.');
      }
      return buildPipelineEngineeringSvgPropertySets(
        current.scene,
        selectedIds,
        current.viewModel.branchInfo,
      );
    },
  });

  const adapter = createEngineeringSvgAdapter({
    descriptor: {
      adapterId,
      domainType: 'PIPELINE_3D_MODEL',
      accessMode: 'read-only',
      projections: ['ISO', 'XY', 'XZ', 'YZ'],
      capabilities: { selection: true, properties: true, parity: true, editing: false },
      metadata: { owner: 'pipeline-3d-model', authority: 'project-output' },
    },
    getScene: () => build().scene,
    subscribeScene(listener) {
      const unsubscribe = subscribeSnapshot((event) => {
        const snapshot = event?.snapshot ?? event?.value ?? event ?? getSnapshot();
        listener({
          scene: build(snapshot).scene,
          reason: String(event?.reason || 'pipeline-project-output-update'),
        });
      });
      if (typeof unsubscribe !== 'function') {
        throw new TypeError('Pipeline engineering SVG subscribeSnapshot must return an unsubscribe function.');
      }
      return unsubscribe;
    },
    propertyProvider,
  });

  return Object.freeze({
    schema: PIPELINE_ENGINEERING_SVG_ADAPTER_SCHEMA,
    adapter,
    buildSnapshot: build,
    getParityReport: () => lastBuild?.parity ?? build().parity,
  });
}
