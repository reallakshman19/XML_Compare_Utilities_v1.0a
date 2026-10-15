/**
 * geometry-buffer-store.js — VisualGeometryModel.v1 → GeometryBufferStore.v1.
 *
 * Typed-array geometry lives here, separate from the JSON contracts: audits
 * and plans stay serializable, while the viewer (and the future large-model
 * instanced path, Phase 9) can consume flat buffers directly.
 */

import { CONTRACT_VERSIONS } from '../contracts/contracts.js';

export function buildGeometryBufferStore(visualModel) {
  const segments = visualModel.segments ?? [];
  const positions = new Float32Array(segments.length * 6);
  const radii = new Float32Array(segments.length);
  const objectIdByIndex = new Array(segments.length);
  segments.forEach((seg, i) => {
    positions.set(seg.start, i * 6);
    positions.set(seg.end, i * 6 + 3);
    radii[i] = seg.radiusMm ?? 25;
    objectIdByIndex[i] = seg.objectId;
  });
  return {
    contract: CONTRACT_VERSIONS.GeometryBufferStore,
    modelId: visualModel.modelId,
    unit: visualModel.unit ?? 'mm',
    segmentCount: segments.length,
    positions,
    radii,
    objectIdByIndex,
  };
}
