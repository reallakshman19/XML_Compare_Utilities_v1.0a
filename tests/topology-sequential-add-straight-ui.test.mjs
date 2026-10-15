import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTopologySequentialAddStraightController,
} from '../tabs/topology-trace-validator/topology-sequential-add-straight-controller.js';

const root = new URL('../tabs/topology-trace-validator/', import.meta.url);
const inspectorSource = await readFile(new URL('topology-edit-inspector-registry.js', root), 'utf8');
const mergeSource = await readFile(new URL('topology-sequential-merge-nodes-controller.js', root), 'utf8');
const addSource = await readFile(new URL('topology-sequential-add-straight-controller.js', root), 'utf8');
assert.match(inspectorSource, /Download Sequential add request/);
assert.match(inspectorSource, /ADD_SEQUENTIAL_REQUEST/);
assert.match(mergeSource, /createTopologySequentialAddStraightController/);
assert.match(mergeSource, /bridgeController/);
assert.doesNotMatch(addSource, /executeCommand|append.*Journal|publishCandidate|\.accept\(/);

const CREATED_AT = '2026-07-29T10:15:00.000Z';
const evidenceValue = {
  editedArtifacts: { canonicalTopology: {
    schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-add-1',
    nodes: [
      { id: 'N-START', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0]'] },
      { id: 'A', position: { x: 0, y: 1, z: 0 }, sourcePaths: ['$[0]'] },
      { id: 'B', position: { x: 1, y: 1, z: 0 }, sourcePaths: ['$[0]'] },
    ],
    edges: [{ id: 'E-CONTEXT', fromNodeId: 'A', toNodeId: 'B',
      sourcePaths: ['$[0]'], componentType: 'PIPE' }],
  } },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-add-1' },
  commandAuthority: { authorityId: 'AUTH-ADD-1' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'DOC-ADD-1', slotId: 'candidate',
    fileName: 'model.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
    verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: 1, componentCount: 1, scanned: 1, matched: 1, filtered: 0 },
    scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT,
  },
  selection: [{ kind: 'node', id: 'N-START' }],
  contextEdgeId: 'E-CONTEXT',
};
const values = { x: '3', y: '4', z: '0' };
const inspector = {
  isConnected: true,
  querySelector: (selector) => ({ value: values[selector.match(/"([xyz])"/)?.[1]] }),
};
const delegated = [], clicked = [];
const baseController = {
  evidence: () => evidenceValue,
  runOperation: (operation) => { delegated.push(operation); return operation; },
  retain: true,
};
const documentRef = {
  querySelectorAll: () => [inspector],
  createElement: () => ({ dataset: {}, click() { clicked.push(this.download); } }),
};
const controller = createTopologySequentialAddStraightController(baseController, {
  documentRef, now: () => CREATED_AT,
});
const request = controller.runOperation('ADD_SEQUENTIAL_REQUEST');
assert.deepEqual(request.proposedSegment.displacement, { x: 3, y: 4, z: 0 });
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.equal(delegated.length, 0);
assert.equal(clicked.length, 1);
assert.equal(controller.retain, true);
assert.equal(controller.runOperation('ADD'), 'ADD');
assert.deepEqual(delegated, ['ADD']);

assert.throws(() => createTopologySequentialAddStraightController(baseController, {
  documentRef: { ...documentRef, querySelectorAll: () => [] }, now: () => CREATED_AT,
}).runOperation('ADD_SEQUENTIAL_REQUEST'), /exactly one mounted Edit Draft inspector/);
assert.throws(() => createTopologySequentialAddStraightController(baseController, {
  documentRef: { ...documentRef, querySelectorAll: () => [inspector, inspector] },
  now: () => CREATED_AT,
}).runOperation('ADD_SEQUENTIAL_REQUEST'), /exactly one mounted Edit Draft inspector/);

console.log('[PASS] visible add request action, fail-closed inspector and unchanged Add delegation');
