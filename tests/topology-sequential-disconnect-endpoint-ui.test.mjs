import assert from 'node:assert/strict';
import { buildRegisteredTopologyEditInspectorMarkup } from '../tabs/topology-trace-validator/topology-edit-inspector-registry.js';
import { createTopologySequentialDisconnectEndpointController } from '../tabs/topology-trace-validator/topology-sequential-disconnect-endpoint-controller.js';

const CREATED_AT = '2026-07-29T11:05:00.000Z';
const canonical = {
  schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-disconnect-ui',
  nodes: [
    { id: 'N-FROM', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N-TO', position: { x: 10, y: 0, z: 0 }, sourcePaths: ['$[0].to'] },
  ],
  edges: [{ id: 'E-1', fromNodeId: 'N-FROM', toNodeId: 'N-TO', segmentRole: 'ROUTE',
    sourcePaths: ['$[0].edge'] }], supports: [], rigids: [], junctions: [], boundaries: [],
};
const markup = buildRegisteredTopologyEditInspectorMarkup({
  canonical, validation: { findings: [] }, selection: [{ kind: 'edge', id: 'E-1' }],
  contextEdgeId: '',
});
assert.match(markup, /data-ttv-edit-inspector-action="DISCONNECT"/);
assert.match(markup, /data-ttv-edit-inspector-action="DISCONNECT_SEQUENTIAL_REQUEST"/);
assert.match(markup, /Download Sequential disconnect request/);

const inspector = {
  isConnected: true,
  querySelector(selector) {
    return selector === '[data-ttv-edit-disconnect-endpoint]' ? { value: 'TO' } : null;
  },
};
let clicks = 0;
const documentRef = {
  querySelectorAll: () => [inspector],
  createElement: () => ({ click() { clicks += 1; } }),
};
let delegated = [];
const evidence = {
  editedArtifacts: { canonicalTopology: canonical }, baseArtifacts: null,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-ui' },
  commandAuthority: { authorityId: 'AUTH-UI' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'DOC-UI', slotId: 'candidate',
    fileName: 'ui.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM', verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 1, scanned: 1,
      matched: 1, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT,
  },
  selection: [{ kind: 'edge', id: 'E-1' }],
};
const base = {
  evidence: () => evidence,
  runOperation(operation) { delegated.push(operation); return `delegated:${operation}`; },
};
const controller = createTopologySequentialDisconnectEndpointController(base, {
  documentRef, now: () => CREATED_AT,
});
const request = controller.runOperation('DISCONNECT_SEQUENTIAL_REQUEST');
assert.equal(request.selectedEndpoint.endpoint, 'TO');
assert.equal(request.selectedEndpoint.nodeId, 'N-TO');
assert.equal(clicks, 1);
assert.deepEqual(delegated, []);
assert.equal(controller.runOperation('DISCONNECT'), 'delegated:DISCONNECT');
assert.deepEqual(delegated, ['DISCONNECT']);
assert.throws(() => createTopologySequentialDisconnectEndpointController(base, {
  documentRef: { ...documentRef, querySelectorAll: () => [] }, now: () => CREATED_AT,
}).runOperation('DISCONNECT_SEQUENTIAL_REQUEST'), /exactly one mounted Edit Draft inspector/);

console.log('[PASS] visible disconnect request action, fail-closed routing and native delegation');
