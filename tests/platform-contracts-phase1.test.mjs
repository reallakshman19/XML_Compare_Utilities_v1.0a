import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createCommandEnvelope, validateCommandEnvelope } from '../contracts/command-envelope.js';
import { createCommandJournal } from '../contracts/command-journal.js';
import { createExportPlan, validateExportPlan } from '../contracts/export-plan.js';
import {
  attachProjectDocument, createProjectDocument, createProjectSession,
} from '../contracts/project-session-contracts.js';
import { createVisualGeometryModelV2, validateVisualGeometryModelV2 } from '../contracts/visual-geometry-model.js';
import { createTopologyMeasurement } from '../tabs/topology-trace-validator/topology-edit-measurement.js';
import { createTopologyEditCanvasRuntime } from '../tabs/topology-trace-validator/topology-edit-3d-canvas.js';
import {
  buildTopologyExportPlan, createTopologyPlatformContext,
} from '../tabs/topology-trace-validator/topology-platform-adapter.js';

const NOW = '2026-07-17T10:48:47.000Z';
const HASH = 'a'.repeat(64);
const document = createProjectDocument({
  documentId: 'document-a', slotId: 'baseline', fileName: 'a.json', sourceHash: HASH, scopedHash: HASH,
  stagedSchema: 'test/v1', rootShape: 'branches', unit: 'MM', verticalAxis: 'Y', coordinateFrame: 'PLANT',
  stats: { branchCount: 1, componentCount: 1, scanned: 1, matched: 1, filtered: 0 },
  scope: { wildcard: '', selectedIds: [] }, createdAt: NOW,
});
const session = attachProjectDocument(createProjectSession({ sessionId: 'session-a', createdAt: NOW }), document, NOW);
assert.equal(session.documents.baseline, document);

const payload = { nodeId: 'CN-1', position: [1, 2, 3] };
const envelope = createCommandEnvelope({
  commandId: 'EC-000001', sessionId: session.sessionId, documentId: document.documentId, sequence: 1,
  commandType: 'MOVE_NODE', payload, basis: { documentHash: 'canonical:1', revision: 'TopologyEditDraft.v1' },
  origin: { kind: 'USER', actorId: 'LOCAL_USER', issuedAt: NOW }, transactionId: null, inverse: null,
});
payload.position[0] = 999;
assert.deepEqual(envelope.payload.position, [1, 2, 3]);
assert.deepEqual(validateCommandEnvelope(envelope), []);
assert.throws(() => createCommandEnvelope({ ...envelope, origin: { kind: 'USER', actorId: 'x', issuedAt: null } }), /issuedAt/);

const plan = createExportPlan({
  planId: 'plan-a', sessionId: session.sessionId, documentId: document.documentId, writerId: 'writer-a', createdAt: NOW,
  hierarchy: { groups: [{ id: 'topology', fileIds: ['file-1'] }] }, calculations: { count: 1 },
  files: [{ fileId: 'file-1', name: 'a.json', mime: 'application/json', role: 'CANONICAL', sourceSchema: 'a/v1', contentHash: HASH, byteLength: 2, order: 0 }],
  gate: { status: 'READY', blockers: [] },
});
assert.deepEqual(validateExportPlan(plan), []);
assert(Object.isFrozen(plan.hierarchy.groups));

const visual = createVisualGeometryModelV2({
  modelId: 'model-a', documentId: document.documentId, revisionId: 'rev-a', unit: 'MM',
  coordinateFrame: 'PLANT', verticalAxis: 'Y', origin: [0, 0, 0],
  segments: [
    { objectId: 'CE-1', start: [0, 0, 0], end: [1, 0, 0], radiusMm: 2 },
    { objectId: 'CE-1', start: [0, 0, 0], end: [0, 1, 0], radiusMm: 2 },
  ], markers: [{ objectId: 'CN-1', nodeId: 'CN-1', position: [0, 0, 0], kind: 'NODE' }],
  bounds: { min: [0, 0, 0], max: [1, 1, 0] },
});
assert.deepEqual(validateVisualGeometryModelV2(visual), []);
assert.equal(new Set(visual.segments.map((row) => row.primitiveId)).size, 2);
assert(Object.isFrozen(visual.segments[0].start));

const measureA = createTopologyMeasurement(), measureB = createTopologyMeasurement();
measureA.addPoint([0, 0, 0]); measureA.addPoint([3, 4, 0]);
assert.deepEqual(measureA.evidence().lengths, [5]);
assert.equal(measureB.evidence().points.length, 0, 'measurement runtimes must be isolated');
const runtimeA = createTopologyEditCanvasRuntime(), runtimeB = createTopologyEditCanvasRuntime();
runtimeA.setMeasurementActive(true);
assert.equal(runtimeA.evidence().measurement.active, true);
assert.equal(runtimeB.evidence().measurement.active, false, 'canvas runtimes must not share state');
runtimeA.dispose(); runtimeB.dispose();

const staged = [{ name: '/A', children: [{ type: 'PIPE' }] }];
const context = await createTopologyPlatformContext({
  sourceText: JSON.stringify(staged), sourceName: 'staged.json', sourceBranches: staged,
  verticalAxis: 'Y', createdAt: NOW, cryptoRef: globalThis.crypto,
});
const nextDraft = { baseCanonicalTopologyHash: 'canonical:1', topologyEditDraftHash: 'draft:1', commands: [
  { schema: 'TopologyEditCommand.v1', id: 'EC-000001', type: 'MOVE_NODE', payload: { nodeId: 'CN-1', position: { x: 1, y: 2, z: 3 } } },
] };
const topologyJournal = createCommandJournal({ journalId: 'journal:platform', sessionId: context.session.sessionId,
  documentId: context.document.documentId, createdAt: NOW });
const exportPlan = await buildTopologyExportPlan({
  context, draft: nextDraft, commandJournal: topologyJournal,
  built: { editLedger: { topologyEditLedgerHash: 'ledger:1' }, canonicalTopology: { canonicalTopologyHash: 'canonical:2', nodes: [], edges: [], supports: [], rigids: [] }, editValidation: { findings: [] } },
  outputs: [{ name: 'topology.json', mime: 'application/json', text: '{"schema":"CanonicalTopology.v1"}' }],
  createdAt: NOW, cryptoRef: globalThis.crypto,
});
assert.equal(exportPlan.files[0].role, 'CANONICAL_TOPOLOGY');
assert.equal(exportPlan.gate.status, 'READY');
assert.equal(exportPlan.calculations.counts.activeCommands, 0);

const contractFiles = ['contract-values.js', 'project-session-contracts.js', 'command-envelope.js', 'export-plan.js', 'visual-geometry-model.js'];
for (const name of contractFiles) {
  const source = readFileSync(fileURLToPath(new URL(`../contracts/${name}`, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${name} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${name} must use named exports`);
}
const canvasSource = readFileSync(fileURLToPath(new URL('../tabs/topology-trace-validator/topology-edit-3d-canvas.js', import.meta.url)), 'utf8');
assert.doesNotMatch(canvasSource, /^let viewer/m, 'topology canvas must not own a module-level singleton viewer');
assert.match(canvasSource, /createTopologyEditCanvasRuntime/);
console.log('[SIMULATED] Phase 1 project, command, export, visual-v2, and runtime-isolation contracts passed.');
