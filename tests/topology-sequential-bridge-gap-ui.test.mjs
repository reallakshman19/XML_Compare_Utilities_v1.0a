import assert from 'node:assert/strict';
import {
  evaluateTopologyEditCapabilities,
  topologyEditCapabilityById,
} from '../tabs/topology-trace-validator/topology-edit-capability-registry.js';
import {
  createTopologySequentialBridgeGapController,
} from '../tabs/topology-trace-validator/topology-sequential-bridge-gap-controller.js';

const selection = Object.freeze([
  { kind: 'node', id: 'N-FROM' },
  { kind: 'node', id: 'N-TO' },
]);
assert.equal(topologyEditCapabilityById('operation.bridge-request').value,
  'BRIDGE_SEQUENTIAL_REQUEST');
assert.equal(evaluateTopologyEditCapabilities({
  initialized: true, selection, contextEdgeId: '',
})['operation.bridge-request'].enabled, false);
assert.equal(evaluateTopologyEditCapabilities({
  initialized: true, selection, contextEdgeId: 'E-CONTEXT',
})['operation.bridge-request'].enabled, true);
assert.equal(evaluateTopologyEditCapabilities({
  initialized: true, selection: [...selection, { kind: 'edge', id: 'E-CONTEXT' }],
  contextEdgeId: 'E-CONTEXT',
})['operation.bridge-request'].enabled, false);

const createdAt = '2026-07-29T09:40:00.000Z';
const evidenceValue = {
  editedArtifacts: { canonicalTopology: {
    schema: 'CanonicalTopology.v1',
    canonicalTopologyHash: 'canonical-bridge-1',
    nodes: [
      { id: 'N-FROM', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0]'] },
      { id: 'N-TO', position: { x: 10, y: 0, z: 0 }, sourcePaths: ['$[1]'] },
      { id: 'A', position: { x: 0, y: 1, z: 0 }, sourcePaths: ['$[0]'] },
      { id: 'B', position: { x: 1, y: 1, z: 0 }, sourcePaths: ['$[0]'] },
    ],
    edges: [{ id: 'E-CONTEXT', fromNodeId: 'A', toNodeId: 'B',
      sourcePaths: ['$[0]'], componentType: 'PIPE' }],
  } },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-bridge-1' },
  commandAuthority: { authorityId: 'AUTH-1' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'DOC-1', slotId: 'candidate',
    fileName: 'model.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
    verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: 2, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
    scope: { wildcard: '*', selectedIds: [] }, createdAt,
  },
  selection,
  contextEdgeId: 'E-CONTEXT',
};
const delegated = [];
const clicked = [];
const baseController = {
  evidence: () => evidenceValue,
  runOperation: (operation) => { delegated.push(operation); return operation; },
  retain: true,
};
const documentRef = {
  createElement: () => ({ click() { clicked.push(this.download); } }),
};
const controller = createTopologySequentialBridgeGapController(baseController, {
  documentRef,
  now: () => createdAt,
});
const request = controller.runOperation('BRIDGE_SEQUENTIAL_REQUEST');
assert.equal(request.publicationState, undefined);
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(delegated.length, 0);
assert.equal(clicked.length, 1);
assert.equal(controller.retain, true);
assert.equal(controller.runOperation('DELETE'), 'DELETE');
assert.deepEqual(delegated, ['DELETE']);

console.log('[PASS] exact bridge toolbar rule, non-publishing export and unchanged delegation');
