import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import { createSequentialRotationDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-draft.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';

const point = (x, y, z = 0) => ({ x, y, z });
const target = Object.freeze({
  schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
  rotationTargetId: 'ROTATION-TARGET', scope: 'COMPONENT_ONLY', seedComponentId: 'A',
  affectedComponentIds: ['A'], locks: [], rotationEligible: true,
  geometryParts: [{ geometryPartId: 'PART-A', componentId: 'A', nodeIds: ['N0', 'N1'],
    geometry: { kind: 'segment', start: point(0, 0), end: point(10, 0) } }],
  ports: [{ portId: 'A0', position: point(0, 0) }, { portId: 'A1', position: point(10, 0) }],
  nodes: [{ nodeId: 'N0', position: point(0, 0) }, { nodeId: 'N1', position: point(10, 0) }],
  boundaryCuts: [{ boundaryId: 'B1', connectionId: 'C1', selectedPortId: 'A1',
    stationaryPortId: 'B0', selectedPosition: point(10, 0), stationaryPosition: point(10, 0) }],
  snapshotFingerprint: 'SNAP', sceneRevision: createEngineeringRevisionToken('R1'),
});
const store = createSequentialRotationDraftStore();
const clear = store.stage({ target, pivot: point(10, 0), axis: point(0, 0, 1), angleDegrees: 90 });
assert.equal(clear.previewDisposition, 'PREVIEW_ONLY_ROTATION_CLEAR');
assert.deepEqual(clear.geometryParts[0].draftGeometry,
  { kind: 'segment', start: point(10, -10), end: point(10, 0) });
assert.equal(clear.publicationState, 'NOT_PUBLISHED');
assert.deepEqual(store.stage({ target, pivot: point(10, 0), axis: point(0, 0, 1),
  angleDegrees: 90 }), clear, 'same input must regenerate the same draft');
const disconnected = store.stage({ target, pivot: point(0, 0),
  axis: point(0, 0, 1), angleDegrees: 90 });
assert.equal(disconnected.previewDisposition, 'PREVIEW_ONLY_BOUNDARY_DISCONNECTION');
store.cancel('test');
assert.equal(store.getPreview(), null);
store.destroy();
console.log('Sequential rotation draft: ok');
