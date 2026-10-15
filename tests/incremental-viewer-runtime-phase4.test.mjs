/** Phase 4 acceptance: real-data scene derivation plus focused runtime contracts. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build3dVisualGeometryModel } from '../tabs/topology-trace-validator/topology-3d-visual-model.js';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
import {
  deriveSceneRuntimeSnapshot, diffSceneChunks, querySceneSpatialIndex, SCENE_CHUNK_SIZE,
} from '../workbench3d/viewer/scene-runtime.js';

const OPTIONS = Object.freeze({ chunkSize: SCENE_CHUNK_SIZE, originGridMm: 1000, minimumCellMm: 100 });

function simpleModel(offset) {
  return {
    contract: 'VisualGeometryModel.v1',
    bounds: { min: [445000 + offset, -1132000, 1100], max: [446000 + offset, -1131000, 2100] },
    segments: [{ objectId: 'E1', kind: 'PIPE', start: [445000 + offset, -1132000, 1100], end: [446000 + offset, -1131000, 2100], radiusMm: 50 }],
    markers: [{ objectId: 'N1', kind: 'NODE', position: [445000 + offset, -1132000, 1100], sizeMm: 9, pickSizeMm: 28 }],
  };
}

const firstModels = { source: simpleModel(0), target: simpleModel(20), registrationTranslation: [0, 0, 0] };
const first = deriveSceneRuntimeSnapshot(firstModels, OPTIONS, null);
assert.equal(first.contract, 'SceneRuntimeSnapshot.v1');
assert(first.origin.some((value) => Math.abs(value) > 100000), 'floating origin must track engineering coordinates');
assert.equal(first.spatialIndex.entries.length, 4);
assert.equal(querySceneSpatialIndex(first.spatialIndex, { min: [444900, -1132100, 1000], max: [445100, -1131900, 1200] }).length, 4);

const unchanged = deriveSceneRuntimeSnapshot(firstModels, OPTIONS, first);
assert.deepEqual(unchanged.changedChunkIds, []);
const changedModels = { ...firstModels, target: simpleModel(200) };
const changed = deriveSceneRuntimeSnapshot(changedModels, OPTIONS, first);
assert.deepEqual(diffSceneChunks(first.chunks, changed.chunks), ['target:markers:0', 'target:segments:0']);

const nodeVisual = build3dVisualGeometryModel({
  canonicalNodes: [{ id: 'N1', position: { x: 0, y: 0, z: 0 } }], canonicalEdges: [], supports: [],
  sourceComponents: [], junctions: [], pointFeatures: [], boundaries: [], issues: [], topologyGaps: [], topologyOverlaps: [],
  visibility: { source: false, canonical: true }, labels: false,
});
const node = nodeVisual.markers.find((marker) => marker.kind === 'NODE');
assert.equal(node.sizeMm, 9, 'visible canonical node sphere must be subtle');
assert.equal(node.pickSizeMm, 28, 'canonical node hit target must remain workable');

const fixturePath = fileURLToPath(new URL('../../3D_Converters/Benchmarks/1885_NC/1885_NC.json', import.meta.url));
if (!existsSync(fixturePath)) {
  console.log(`Phase 4 real-data validation SKIPPED: fixture not found at ${fixturePath}`);
} else {
  const source = readManagedTopologySource(JSON.parse(readFileSync(fixturePath, 'utf8')));
  const visual = build3dVisualGeometryModel({
    sourceComponents: source.components, canonicalNodes: [], canonicalEdges: [], supports: [], junctions: [],
    pointFeatures: [], boundaries: [], issues: [], topologyGaps: [], topologyOverlaps: [],
    visibility: { source: true, canonical: false }, showComponentSymbols: false, labels: false,
  });
  const started = performance.now();
  const runtime = deriveSceneRuntimeSnapshot({ source: visual, target: null, registrationTranslation: [0, 0, 0] }, OPTIONS, null);
  const elapsedMs = performance.now() - started;
  assert.equal(source.metrics.sourceComponentCount, 4320);
  assert(visual.segments.length >= 2500, 'real visual model must retain routed component geometry');
  assert.equal(runtime.spatialIndex.entries.length, visual.segments.length + visual.markers.length);
  assert(runtime.chunks.length > 1, 'real model must be partitioned into incremental chunks');
  assert(elapsedMs < 5000, `real scene derivation exceeded 5 s gate: ${elapsedMs.toFixed(1)} ms`);
  console.log(`Phase 4 real-data gate: ${visual.segments.length} segments, ${runtime.chunks.length} chunks, ${elapsedMs.toFixed(1)} ms.`);
}

for (const path of [
  '../workbench3d/viewer/scene-runtime.js', '../workbench3d/viewer/scene-derivation-worker.js',
  '../workbench3d/viewer/scene-derivation-scheduler.js',
]) {
  const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length < 300, `${path} must stay under 300 lines`);
  assert(!/export\s+default\b/.test(source), `${path} must use named exports only`);
}

const viewerSource = readFileSync(fileURLToPath(new URL('../workbench3d/viewer/workbench-viewer.js', import.meta.url)), 'utf8');
assert.match(viewerSource, /layerMode: 'pick'/);
assert.match(viewerSource, /rebuildChangedChunks/);
assert.match(viewerSource, /new Worker\(new URL\('\.\/scene-derivation-worker\.js'/);
console.log('Phase 4 incremental viewer runtime acceptance passed.');
