import assert from 'node:assert/strict';
import { createEngineeringRevisionToken, createSegmentGeometry } from '../core/engineering-scene/index.js';
import { createSequentialNodeStretchDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-draft.js';
import { SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-target.js';
const p = (x, y = 0, z = 0) => ({ x, y, z });
const target = Object.freeze({ schema: SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA,
  stretchTargetId: 'T1', authorityId: 'A1', sceneRevision: createEngineeringRevisionToken('R1'),
  selection: { selectionId: 'S1' }, selectionId: 'S1', selectedObjectId: 'G1',
  selectedComponentId: 'P1', nodeId: 'N1', originalPosition: p(10), portIds: ['PB'],
  committedConnectionIds: [], affectedComponentIds: ['P1'], geometryPartIds: ['G1'],
  geometryParts: [{ geometryPartId: 'G1', componentId: 'P1', canonicalType: 'PIPE',
    role: 'primary', nodeIds: ['N0', 'N1'], geometry: createSegmentGeometry(p(0), p(10)) }],
  eligibilityId: 'EL1', boundaryClass: 'OPEN_TERMINAL', snapshotFingerprint: 'SF',
  topologyFingerprint: 'TF', geometryFingerprint: 'GF' });
const store = createSequentialNodeStretchDraftStore();
const preview = store.stage({ target, targetPosition: p(15),
  profile: { minimumLengthMm: 1, zeroLengthToleranceMm: 1e-9,
    collinearityTolerance: 1e-9 }, operationId: 'STRETCH-1' });
assert.equal(preview.schema, 'SequentialNodeStretchDraft.v1');
assert.equal(preview.previewDisposition, 'PREVIEW_ONLY_NODE_STRETCH_QUALIFIED');
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.deepEqual(preview.geometryParts[0].draftGeometry.end, p(15));
assert.equal(store.getDraft().operationId, 'STRETCH-1');
assert(Object.isFrozen(preview));
const noChange = store.stage({ target, targetPosition: p(10), profile: preview.profile,
  operationId: 'STRETCH-2' });
assert.equal(noChange.noChange, true); assert.equal(noChange.previewDisposition, 'NO_CHANGE');
store.cancel('test'); assert.equal(store.getPreview(), null); store.destroy();
console.log('Sequential node stretch draft: ok');
