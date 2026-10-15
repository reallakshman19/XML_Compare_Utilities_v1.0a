import assert from 'node:assert/strict';
import { createTopologySequentialMoveNodeRequest } from '../tabs/topology-trace-validator/topology-sequential-move-node-request.js';
import {
  assertSequentialNodeStretchRequestPlan,
  createSequentialNodeStretchRequestPlan,
  parseSequentialNodeStretchRequestText,
  sequentialNodeStretchRequestPreviewInput,
  validateSequentialNodeStretchRequestPlan,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-request-adapter.js';

const CREATED_AT = '2026-07-29T08:20:00.000Z';
const requestInput = Object.freeze({
  canonical: Object.freeze({
    schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:move-17',
    nodes: Object.freeze([Object.freeze({ id: 'CN-17',
      position: Object.freeze({ x: 1, y: 2, z: 3 }), sourcePaths: Object.freeze(['$.objects[1]']) })]),
  }),
  draft: Object.freeze({ schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft:move-17' }),
  commandAuthority: Object.freeze({ authorityId: 'authority:move-17' }),
  projectDocument: Object.freeze({
    schema: 'ProjectDocument.v1', documentId: 'document:move-17', slotId: 'baseline', fileName: 'model.json',
    sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64), stagedSchema: 'inputxml-managed-stage/v1',
    rootShape: 'objects', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: Object.freeze({ branchCount: 2, componentCount: 4, scanned: 2, matched: 2, filtered: 0 }),
    scope: Object.freeze({ wildcard: '', selectedIds: Object.freeze([]) }), createdAt: CREATED_AT,
  }),
  nodeId: 'CN-17', targetPosition: Object.freeze({ x: 10, y: 20, z: 30 }), createdAt: CREATED_AT,
});
const request = createTopologySequentialMoveNodeRequest(requestInput);
assert.deepEqual(parseSequentialNodeStretchRequestText(JSON.stringify(request)), request);

const planInput = Object.freeze({
  request, selectedObjectId: 'entity:pipe-4', sequentialNodeId: 'node:port-b',
  profile: Object.freeze({ minimumLengthMm: 2, zeroLengthToleranceMm: 1e-8, collinearityTolerance: 1e-7 }),
});
const plan = createSequentialNodeStretchRequestPlan(planInput);
assert.equal(plan.authorityMapping, 'EXPLICIT_OPERATOR_SELECTION');
assert.equal(plan.publicationState, 'NOT_PUBLISHED');
assert.equal(plan.validatorNodeId, 'CN-17');
assert.equal(plan.selectedObjectId, 'entity:pipe-4');
assert.equal(plan.sequentialNodeId, 'node:port-b');
assert.deepEqual(plan.targetPosition, { x: 10, y: 20, z: 30 });
assert.equal(assertSequentialNodeStretchRequestPlan(plan), plan);
assert.deepEqual(validateSequentialNodeStretchRequestPlan(plan, planInput), plan);
assert.deepEqual(sequentialNodeStretchRequestPreviewInput(plan), {
  selectedObjectId: 'entity:pipe-4', sequentialNodeId: 'node:port-b',
  stageInput: { targetPosition: { x: 10, y: 20, z: 30 }, profile: plan.profile,
    operationId: plan.planFingerprint },
});
assert.throws(() => createSequentialNodeStretchRequestPlan({ request, sequentialNodeId: 'node:port-b' }),
  (error) => error.code === 'SEQUENTIAL_NODE_STRETCH_EXPLICIT_IDENTITY_REQUIRED');
assert.throws(() => createSequentialNodeStretchRequestPlan({ request, selectedObjectId: 'entity:pipe-4' }),
  (error) => error.code === 'SEQUENTIAL_NODE_STRETCH_EXPLICIT_IDENTITY_REQUIRED');

const tampered = JSON.parse(JSON.stringify(request));
tampered.sourceCommand.payload.position.x = 999;
assert.throws(() => createSequentialNodeStretchRequestPlan({ ...planInput, request: tampered }),
  (error) => error.code === 'SEQUENTIAL_NODE_STRETCH_REQUEST_INVALID');

console.log('[PASS] explicit MOVE_NODE request plan and non-publishing stretch preview input');
