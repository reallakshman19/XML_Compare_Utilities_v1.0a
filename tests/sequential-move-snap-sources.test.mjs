import assert from 'node:assert/strict';
import { createSegmentGeometry } from '../core/engineering-scene/index.js';
import {
  SEQUENTIAL_MOVE_SNAP_MODE,
  createSequentialMoveSnapProfile,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-contracts.js';
import {
  deriveSequentialMoveSnapSourceCandidates,
  projectSequentialSnapAnchors,
  projectSequentialSnapSegments,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-move-snap-sources.js';

const profile = createSequentialMoveSnapProfile({
  enabledModes: Object.values(SEQUENTIAL_MOVE_SNAP_MODE), aperturePx: 50,
  grid: { enabled: true, spacing: 5, origin: { x: 0, y: 0, z: 0 } },
});
const target = { componentId: 'COMP-1', geometryPartIds: ['part-selected'] };
const scene = { entities: [
  { id: 'part-selected', domainRef: { category: 'confirmed', componentId: 'COMP-1' },
    geometry: createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }) },
  { id: 'part-2', domainRef: { category: 'confirmed', componentId: 'COMP-2' },
    geometry: createSegmentGeometry({ x: 10, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }) },
] };
const snapshot = { nodes: [{
  nodeId: 'NODE-2', position: { x: 10, y: 0, z: 0 }, portIds: ['PORT-2'],
  incidentComponentIds: ['COMP-2'], incidentGeometryPartIds: ['part-2'],
}] };
const segments = projectSequentialSnapSegments(scene, target, profile);
assert.equal(segments.length, 1);
assert.equal(segments[0].geometryPartId, 'part-2');
const anchors = projectSequentialSnapAnchors(snapshot, target, profile);
assert.equal(anchors.length, 1);
const result = deriveSequentialMoveSnapSourceCandidates({
  scene, snapshot, target, rawWorldPoint: { x: 13, y: 2, z: 0 },
  constraint: 'XY', profile,
});
const modes = new Set(result.candidates.map((row) => row.mode));
for (const mode of ['endpoint', 'midpoint', 'sequential:centerline',
  'sequential:axis-x', 'sequential:axis-y', 'sequential:grid']) assert(modes.has(mode));
assert(result.candidates.every((row) => !row.sourceEntityIds.includes('part-selected')));
const reversed = deriveSequentialMoveSnapSourceCandidates({
  scene: { entities: [...scene.entities].reverse() },
  snapshot: { nodes: [...snapshot.nodes].reverse() }, target,
  rawWorldPoint: { x: 13, y: 2, z: 0 }, constraint: 'XY', profile,
});
assert.equal(JSON.stringify(reversed), JSON.stringify(result),
  'source order must not change snap source evidence');
const centerline = result.candidates.find((row) => row.mode === 'sequential:centerline');
assert(centerline.metadata.parameter > 0 && centerline.metadata.parameter < 1);

console.log('Sequential move snap sources: ok');
