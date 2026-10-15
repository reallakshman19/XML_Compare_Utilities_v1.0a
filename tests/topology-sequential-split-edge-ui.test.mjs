import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTopologySequentialSplitEdgeController,
  _test,
} from '../tabs/topology-trace-validator/topology-sequential-split-edge-controller.js';

const inspector = { isConnected: true, querySelector(selector) {
  if (selector === '[data-ttv-edit-split-fraction]') return { value: '0.4' };
  return null;
} };
const clicked = [];
const documentRef = {
  querySelectorAll(selector) { return selector === '[data-ttv-edit-inspector]' ? [inspector] : []; },
  createElement() { return { click() { clicked.push(this.download); } }; },
};
const CREATED_AT = '2026-07-29T12:00:00.000Z';
const canonical = { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'split-ui-1',
  nodes: [{ id: 'N1', position: { x: 0, y: 0, z: 0 } },
    { id: 'N2', position: { x: 10, y: 0, z: 0 } }],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2' }],
  supports: [], rigids: [], junctions: [], boundaries: [], bends: [], pointFeatures: [] };
const evidence = { selection: [{ kind: 'edge', id: 'E1' }],
  editedArtifacts: { canonicalTopology: canonical }, draft: { schema: 'TopologyEditDraft.v1',
    topologyEditDraftHash: 'draft-ui-1' }, commandAuthority: { authorityId: 'AUTH-UI-1' },
  projectDocument: { schema: 'ProjectDocument.v1', documentId: 'DOC-UI-1', slotId: 'candidate',
    fileName: 'ui.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM', verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 1, scanned: 1,
      matched: 1, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT } };
const delegated = [];
const base = { evidence: () => evidence, runOperation(operation) { delegated.push(operation); return operation; } };
const controller = createTopologySequentialSplitEdgeController(base, { documentRef, now: () => CREATED_AT });
const request = controller.runOperation('SPLIT_SEQUENTIAL_REQUEST');
assert.equal(request.sourceCommand.payload.fraction, 0.4);
assert.equal(clicked.length, 1);
assert.equal(controller.runOperation('SPLIT'), 'SPLIT');
assert.deepEqual(delegated, ['SPLIT']);
assert.equal(_test.resolveInspector(documentRef), inspector);
assert.throws(() => _test.resolveInspector({ querySelectorAll: () => [] }), RangeError);
assert.throws(() => _test.resolveInspector({ querySelectorAll: () => [inspector, inspector] }), RangeError);

const registry = await readFile(new URL('../tabs/topology-trace-validator/topology-edit-inspector-registry.js', import.meta.url), 'utf8');
const chain = await readFile(new URL('../tabs/topology-trace-validator/topology-sequential-merge-nodes-controller.js', import.meta.url), 'utf8');
assert.match(registry, /SPLIT_SEQUENTIAL_REQUEST/);
assert.match(registry, /Download Sequential split request/);
assert.match(chain, /createTopologySequentialSplitEdgeController/);
assert.doesNotMatch(chain, /appendTopology|publishTopology|topologyJournal|geometryJournal/i);
console.log('[PASS] SPLIT_EDGE visible action, fail-closed inspector, native delegation and chain');
