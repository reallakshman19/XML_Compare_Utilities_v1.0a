import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  evaluateTopologyEditCapabilities,
  topologyEditCapabilityById,
} from '../tabs/topology-trace-validator/topology-edit-capability-registry.js';
import {
  createTopologySequentialMergeNodesController,
} from '../tabs/topology-trace-validator/topology-sequential-merge-nodes-controller.js';

const capability = topologyEditCapabilityById('operation.merge-request');
assert.equal(capability.value, 'MERGE_SEQUENTIAL_REQUEST');
const enabled = evaluateTopologyEditCapabilities({ initialized: true, selection: [
  { kind: 'node', id: 'CN-A' }, { kind: 'node', id: 'CN-B' },
] });
assert.equal(enabled['operation.merge-request'].enabled, true);
const disabled = evaluateTopologyEditCapabilities({ initialized: true,
  selection: [{ kind: 'node', id: 'CN-A' }, { kind: 'edge', id: 'CE-A' }],
});
assert.equal(disabled['operation.merge-request'].enabled, false);

let delegated = null, downloaded = null;
const anchor = { click() { downloaded = { href: this.href, download: this.download }; }, remove() {} };
const documentRef = {
  createElement: () => anchor,
  body: { appendChild() {} },
  defaultView: { URL: { createObjectURL: () => 'blob:merge', revokeObjectURL() {} }, Blob },
};
const evidence = {
  editedArtifacts: { canonicalTopology: {
    schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:ui',
    nodes: [
      { id: 'CN-A', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$.objects[0]'] },
      { id: 'CN-B', position: { x: 1, y: 0, z: 0 }, sourcePaths: ['$.objects[1]'] },
    ], edges: [],
  } },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft:ui' },
  commandAuthority: { authorityId: 'authority:ui' },
  projectDocument: {
    schema: 'ProjectDocument.v1', documentId: 'document:ui', slotId: 'baseline', fileName: 'ui.json',
    sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64), stagedSchema: 'inputxml-managed-stage/v1',
    rootShape: 'objects', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: 2, componentCount: 2, scanned: 2, matched: 2, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: '2026-07-29T08:30:00.000Z',
  },
  selection: [{ kind: 'node', id: 'CN-A' }, { kind: 'node', id: 'CN-B' }],
};
const baseController = Object.freeze({
  evidence: () => evidence,
  runOperation: (operation) => { delegated = operation; return operation; },
});
const controller = createTopologySequentialMergeNodesController(baseController, {
  documentRef, now: () => '2026-07-29T08:31:00.000Z',
});
const request = controller.runOperation('MERGE_SEQUENTIAL_REQUEST');
assert.deepEqual(request.sourceCommand.payload, { sourceNodeId: 'CN-A', targetNodeId: 'CN-B' });
assert.equal(request.sequentialIntent.publicationState, 'NOT_PUBLISHED');
assert.match(downloaded.download, /CN-A-to-CN-B/);
assert.equal(delegated, null, 'merge request must not enter the native operation path');
assert.equal(controller.runOperation('DELETE'), 'DELETE');
assert.equal(delegated, 'DELETE', 'all other operations must delegate unchanged');

const tab = await readFile(new URL('../tabs/topology-trace-validator/topology-trace-validator-tab.js', import.meta.url), 'utf8');
assert.match(tab, /createTopologySequentialMergeNodesController/);
assert.match(tab, /baseEditController/);
assert.doesNotMatch(tab, /topology-edit-controller\.js[^\n]*MERGE_SEQUENTIAL_REQUEST/);

console.log('[PASS] exactly-two-node toolbar decorator exports merge request and delegates all other operations');
