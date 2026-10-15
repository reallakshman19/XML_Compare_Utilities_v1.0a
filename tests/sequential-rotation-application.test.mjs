import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import { createSequentialRotationDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-draft.js';
import { SEQUENTIAL_ROTATION_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-target.js';
import { SEQUENTIAL_PREPARED_ROTATION_SCHEMA, _test } from '../tabs/sequential-sketcher/scoped-edit/sequential-rotation-application.js';

const point = (x, y, z = 0) => ({ x, y, z });
const geometry = { kind: 'segment', start: point(0, 0), end: point(10, 0) };
const target = Object.freeze({
  schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
  rotationTargetId: 'ROTATION-TARGET', selectedObjectId: 'PART-A',
  authorityId: 'AUTH-1', sceneRevision: createEngineeringRevisionToken('R1'),
  seedComponentId: 'A', scope: 'COMPONENT_ONLY', affectedComponentIds: ['A'],
  geometryPartIds: ['PART-A'], portIds: ['A0', 'A1'], nodeIds: ['N0', 'N1'],
  geometryParts: [{ geometryPartId: 'PART-A', componentId: 'A',
    nodeIds: ['N0', 'N1'], geometry }],
  ports: [{ portId: 'A0', position: point(0, 0) },
    { portId: 'A1', position: point(10, 0) }],
  nodes: [{ nodeId: 'N0', position: point(0, 0) },
    { nodeId: 'N1', position: point(10, 0) }],
  boundaryCuts: [], locks: [], rotationEligible: true, eligibilityIds: ['EA'],
  snapshotFingerprint: 'SNAP', topologyFingerprint: 'TOPO',
  geometryFingerprint: 'GEOM', geometryEditJournalFingerprint: null,
});
const topology = Object.freeze({
  components: [{ componentId: 'A', geometryPartIds: ['PART-A'],
    portIds: ['A0', 'A1'], nodeIds: ['N0', 'N1'], supportAttachmentIds: [] }],
  geometryParts: [{ geometryPartId: 'PART-A', componentId: 'A',
    nodeIds: ['N0', 'N1'], geometry }],
  ports: [{ portId: 'A0', componentId: 'A', position: point(0, 0) },
    { portId: 'A1', componentId: 'A', position: point(10, 0) }],
  nodes: [{ nodeId: 'N0', position: point(0, 0) },
    { nodeId: 'N1', position: point(10, 0) }],
});
const store = createSequentialRotationDraftStore();
const preview = store.stage({ target, pivot: point(0, 0),
  axis: point(0, 0, 1), angleDegrees: 90 });
assert.deepEqual(_test.validatePreview(preview, target), preview);
assert.deepEqual(_test.assertEligible(preview, target, topology), ['A']);
const evidence = _test.entryEvidence(preview, target, topology, {
  actorId: 'ROTATION_TEST', reason: 'Exact rigid rotation reviewed.',
  evidenceNote: null, appliedAt: '2026-07-29T02:30:00.000Z',
});
assert.equal(evidence.type, 'ROTATE_SUBGRAPH');
assert.deepEqual(evidence.affectedComponentIds, ['A']);
assert.deepEqual(evidence.after.ports.map((row) => row.position),
  [point(0, 0), point(0, 10)]);
const material = {
  schema: SEQUENTIAL_PREPARED_ROTATION_SCHEMA,
  preview, expectedAuthority: { authorityId: 'AUTHORITY' },
  candidate: { schema: 'SequentialPreparedGeometryEditCandidate.v1' },
};
const prepared = Object.freeze({ ...material,
  preparedId: sequentialSemanticFingerprint('SSK3PROTATIONPREP', material),
  publicationState: 'NOT_PUBLISHED' });
assert.deepEqual(_test.validatePrepared(prepared), prepared);
assert.throws(() => _test.validatePrepared({ ...prepared, preparedId: 'TAMPERED' }),
  /differs from canonical evidence regeneration/);
assert.throws(() => _test.assertEligible({ ...preview,
  previewDisposition: 'PREVIEW_ONLY_BOUNDARY_DISCONNECTION' }, target, topology),
/boundary-compatible/);
store.destroy();
console.log('Sequential rotation application: ok');
