import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appendJournalCommand, createCommandJournal } from '../contracts/command-journal.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../contracts/project-session-contracts.js';
import { buildTopologyEditBundle } from '../tabs/topology-trace-validator/topology-edit-persistence-actions.js';
import { buildExportPlanRowsMarkup, exportPlanInspectorRows, virtualExportPlanWindow } from '../tabs/topology-trace-validator/topology-export-inspector-model.js';
import { prepareTopologyExportSnapshot, topologyExportStateKey } from '../tabs/topology-trace-validator/topology-export-snapshot.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

const NOW = '2026-07-17T11:40:00.000Z', HASH = 'd'.repeat(64);
const document = createProjectDocument({
  documentId: 'document:phase3', slotId: 'baseline', fileName: 'phase3.json', sourceHash: HASH, scopedHash: HASH,
  stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM', verticalAxis: 'Y', coordinateFrame: 'UNKNOWN',
  stats: { branchCount: 1, componentCount: 2, scanned: 1, matched: 1, filtered: 0 },
  scope: { wildcard: '', selectedIds: [] }, createdAt: NOW,
});
const session = attachProjectDocument(createProjectSession({ sessionId: 'session:phase3', createdAt: NOW }), document, NOW);
const context = Object.freeze({ document, session });
const draft = Object.freeze({ schema: 'TopologyEditDraft.v1', baseCanonicalTopologyHash: 'canonical:base',
  topologyEditDraftHash: 'draft:phase3', commands: Object.freeze([]), redoCommands: Object.freeze([]) });
const journal = createCommandJournal({ journalId: 'journal:phase3', sessionId: session.sessionId, documentId: document.documentId, createdAt: NOW });
const canonicalTopology = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:edited',
  nodes: Object.freeze([{ id: 'CN-1' }]), edges: Object.freeze([{ id: 'CE-1' }]), supports: Object.freeze([]), rigids: Object.freeze([]) });
const built = Object.freeze({ canonicalTopology, editLedger: Object.freeze({ schema: 'TopologyEditLedger.v1', topologyEditLedgerHash: 'ledger:phase3' }),
  editValidation: Object.freeze({ ok: true, summary: Object.freeze({ blockingCount: 0 }), findings: Object.freeze([]) }) });
const outputText = `${JSON.stringify(canonicalTopology, null, 2)}\n`;
const core = Object.freeze({ topologyArtifactOutputs: () => Object.freeze([
  Object.freeze({ name: 'phase3.canonical-topology.json', mime: 'application/json', text: outputText }),
  Object.freeze({ name: 'phase3.topology.input.xml', mime: 'application/xml', text: '<InputXML />\n' }),
]) });

const checkerEvidence = Object.freeze({
  report: Object.freeze({ schema: 'TopologyCheckReport.v1', topologyCheckReportHash: 'check:phase3', issues: Object.freeze([
    Object.freeze({ id: 'ISSUE-1', code: 'SHORT_ELEMENT', category: 'GEOMETRY', severity: 'WARNING', fixability: 'NEEDS_CONFIRMATION', message: 'Review short element', objectIds: Object.freeze(['CE-1']) }),
  ]) }),
  suggestions: Object.freeze([]), reviewState: Object.freeze({ schema: 'TopologyReviewState.v1', topologyReviewStateHash: 'review:phase3', issueStates: Object.freeze({}) }),
});
const input = Object.freeze({ core, built, options: Object.freeze({ sourceName: 'phase3.json' }), context, draft,
  commandJournal: journal, createdAt: NOW, cryptoRef: globalThis.crypto, checkerEvidence,
  modelMode: Object.freeze({ kind: 'SMALL_FULL', elementCount: 1, threshold: 200 }), editScope: null, attributeLedger: null, remarks: Object.freeze({}) });
const snapshot = await prepareTopologyExportSnapshot(input);
assert.equal(snapshot.plan.gate.status, 'READY');
assert.equal(snapshot.plan.calculations.counts.nodes, 1);
assert.equal(snapshot.plan.calculations.counts.artifacts, 3);
assert.equal(snapshot.plan.calculations.counts.userConfirmationPending, 1);
assert.equal(snapshot.plan.files.at(-1).role, 'TOPOLOGY_EXPORT_LOG');
assert.equal(snapshot.plan.files[0].contentHash, await sha256Text(outputText, globalThis.crypto));
assert.deepEqual(snapshot.plan.hierarchy.editState.activeCommandIds, []);

const rows = exportPlanInspectorRows(snapshot.plan);
assert(rows.some((row) => row.path === 'hashes.commandJournalHash'));
assert(rows.some((row) => row.path === 'bundle.artifacts[0].role'));
const virtual = virtualExportPlanWindow([...rows, ...rows, ...rows], 280, 112);
assert(virtual.rows.length < rows.length * 3, 'virtual inspector must bound DOM rows');
assert(virtual.topSpacer > 0);
assert.match(buildExportPlanRowsMarkup(virtual), /data-export-row/);

const result = await buildTopologyEditBundle({ snapshot, draft, commandJournal: journal, cryptoRef: globalThis.crypto });
assert.equal(result.plan, snapshot.plan, 'writer consumes the exact inspected plan object');
assert.equal(result.bundle.files[0].text, outputText, 'writer consumes the exact planned output bytes');
assert.equal(result.bundle.exportPlan.files[0].contentHash, await sha256Text(result.bundle.files[0].text, globalThis.crypto));
const tampered = Object.freeze({ ...snapshot, outputs: Object.freeze([
  Object.freeze({ ...snapshot.outputs[0], text: outputText.replace('CN-1', 'CN-X') }), ...snapshot.outputs.slice(1),
]) });
await assert.rejects(() => buildTopologyEditBundle({ snapshot: tampered, draft, commandJournal: journal, cryptoRef: globalThis.crypto }), /inspected SHA-256/);

const updatedJournal = appendJournalCommand(journal, { commandType: 'ATTRIBUTE_EDIT', payload: { field: 'STATUS', value: 'CHECKED' },
  basis: { documentHash: 'canonical:base', revision: 'TopologyEditDraft.v1' },
  origin: { kind: 'USER', actorId: 'LOCAL_USER', issuedAt: NOW }, transactionId: null,
  inverse: { operation: 'SET_ATTRIBUTE', field: 'STATUS', value: null } }, NOW);
assert.notEqual(topologyExportStateKey(draft, journal, ''), topologyExportStateKey(draft, updatedJournal, ''));
await assert.rejects(() => buildTopologyEditBundle({ snapshot, draft, commandJournal: updatedJournal, cryptoRef: globalThis.crypto }), /stale/);

let editJournal = journal;
const editPlanIds = [];
for (const [index, commandType] of ['TOPOLOGY_COMMAND', 'ATTRIBUTE_EDIT', 'REMARK_SET'].entries()) {
  editJournal = appendJournalCommand(editJournal, { commandType, payload: { index },
    basis: { documentHash: 'canonical:base', revision: 'TopologyEditDraft.v1' },
    origin: { kind: 'USER', actorId: 'LOCAL_USER', issuedAt: NOW }, transactionId: null,
    inverse: { operation: 'REMOVE_EVIDENCE', index } }, NOW);
  const editSnapshot = await prepareTopologyExportSnapshot({ ...input, commandJournal: editJournal });
  assert.equal(editSnapshot.plan.calculations.counts.activeCommands, index + 1);
  editPlanIds.push(editSnapshot.plan.planId);
}
assert.equal(new Set(editPlanIds).size, 3, 'geometry, attribute and remark edits each revise the inspected plan');

const blockedBuilt = Object.freeze({ ...built, editValidation: Object.freeze({ ok: false, summary: Object.freeze({ blockingCount: 1 }),
  findings: Object.freeze([{ code: 'TOPOLOGY_GAP', message: 'Resolve gap', blocking: true }]) }) });
const documented = await prepareTopologyExportSnapshot({ ...input, built: blockedBuilt });
assert.equal(documented.plan.gate.status, 'READY', 'validation findings document export but never block it');
assert.deepEqual(documented.plan.gate.blockers, []);
const documentedBundle = await buildTopologyEditBundle({ snapshot: documented, draft, commandJournal: journal, cryptoRef: globalThis.crypto });
const exportLog = JSON.parse(documentedBundle.outputs.at(-1).text);
assert.equal(exportLog.exportPolicy, 'ALWAYS_ALLOWED');
assert.equal(exportLog.findings[0].status, 'USER_CONFIRMATION_PENDING');
assert.equal(exportLog.validationWarnings[0].status, 'INTEGRITY_WARNING');

for (const relative of ['topology-export-snapshot.js', 'topology-export-inspector-model.js', 'topology-export-plan-service.js']) {
  const source = readFileSync(fileURLToPath(new URL(`../tabs/topology-trace-validator/${relative}`, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${relative} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${relative} must use named exports`);
}
console.log('[SIMULATED] Phase 3 exact ExportPlan/writer parity, always-allowed documented export, hierarchy and virtualization passed.');
