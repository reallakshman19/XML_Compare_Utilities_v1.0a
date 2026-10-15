import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { activeJournalCommands, parseCommandJournal, serializeCommandJournal, validateCommandJournal } from '../contracts/command-journal.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../contracts/project-session-contracts.js';
import { createTopologyDraftRecovery } from '../tabs/topology-trace-validator/topology-draft-recovery.js';
import { createTopologyEditJournalService } from '../tabs/topology-trace-validator/topology-edit-journal-service.js';
import { assertTopologyDraftBasis, parseTopologyEditSessionDraft, serializeTopologyEditSessionDraft } from '../tabs/topology-trace-validator/topology-edit-session-draft.js';
import { replayTopologyCommandJournal, topologyReplayStateHash } from '../tabs/topology-trace-validator/topology-command-replay.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE, createTopologyScopedEditCommandScope } from '../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
const NOW = '2026-07-17T11:11:44.000Z', later = (seconds) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();
class Locks { constructor() { this.held = new Set(); } async request(name, options, callback) { if (options.ifAvailable && this.held.has(name)) return callback(null); this.held.add(name); try { return await callback({ name }); } finally { this.held.delete(name); } } }
function memoryStorage() { const values = new Map(); return Object.freeze({ getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }); }
const sourceHash = 'b'.repeat(64), document = createProjectDocument({ documentId: 'topology-document:test', slotId: 'baseline', fileName: 'test.json', sourceHash, scopedHash: sourceHash,
  stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM', verticalAxis: 'Y', coordinateFrame: 'UNKNOWN', stats: { branchCount: 1, componentCount: 3, scanned: 1, matched: 1, filtered: 0 }, scope: { wildcard: '', selectedIds: [] }, createdAt: NOW });
const session = attachProjectDocument(createProjectSession({ sessionId: 'topology-session:test', createdAt: NOW }), document, NOW), context = Object.freeze({ document, session });
const baseDraft = Object.freeze({ schema: 'TopologyEditDraft.v1', baseCanonicalTopologyHash: 'canonical:test', commands: Object.freeze([]), redoCommands: Object.freeze([]), engineeringOverrides: Object.freeze({}), settings: Object.freeze({}), nextCommandSequence: 1, topologyEditDraftHash: 'draft:base' });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical:live', nodes: Object.freeze(['CN-1', 'CN-2', 'CN-3'].map((id) => Object.freeze({ id, sourcePaths: Object.freeze(['$[0].children[0]']) }))), edges: Object.freeze([]), supports: Object.freeze([]), rigids: Object.freeze([]), junctions: Object.freeze([]), boundaries: Object.freeze([]), bends: Object.freeze([]), pointFeatures: Object.freeze([]) });
const fakeCore = Object.freeze({ appendTopologyEditCommand(draft, type, payload) { const sequence = draft.nextCommandSequence, command = Object.freeze({ schema: 'TopologyEditCommand.v1', id: `EC-${String(sequence).padStart(6, '0')}`, type, payload: structuredClone(payload) }); const next = { ...draft, commands: Object.freeze([...draft.commands, command]), redoCommands: Object.freeze([]), nextCommandSequence: sequence + 1 }; return Object.freeze({ ...next, topologyEditDraftHash: semanticHash(next) }); } });
const built = (prepared) => Object.freeze({ editDraft: prepared.candidateReplayState.draft, canonicalTopology: canonical, editLedger: Object.freeze({}), editValidation: Object.freeze({ findings: Object.freeze([]) }) });
async function service(storage, locks) { const recovery = createTopologyDraftRecovery(storage, { lockManager: locks }); await recovery.acquireWriter(document.documentId); return createTopologyEditJournalService({ core: fakeCore, context, baseDraft, recovery, createdAt: NOW, canonicalProvider: () => canonical, scopeProvider: ({ origin }) => createTopologyScopedEditCommandScope({ canonical, authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL, originKind: origin?.kind }) }); }
function acceptPrepared(serviceRef, prepared) { return serviceRef.acceptPrepared(prepared, serviceRef.certifyRegeneration(prepared, built(prepared))); }
const storage = memoryStorage(), locks = new Locks(), journal = await service(storage, locks), uiState = Object.freeze({ projection: 'XY', tool: 'SELECT', contextEdgeId: '', supportScale: 2.5, selection: [] }), origin = Object.freeze({ kind: 'USER', actorId: 'LOCAL_USER', issuedAt: later(1) });
let candidate = fakeCore.appendTopologyEditCommand(baseDraft, 'MOVE_NODE', { nodeId: 'CN-1', position: { x: 1, y: 2, z: 3 } });
let prepared = journal.prepareNative({ expectedAuthorityId: journal.currentAuthority().authorityId, nativeCommand: candidate.commands.at(-1), origin, uiState, updatedAt: later(1), expectedDraftHash: candidate.topologyEditDraftHash });
assert.equal(acceptPrepared(journal, prepared).accepted, true);
journal.appendAttribute({ branchIndex: 0, childIndex: 0, sourcePath: '$[0].children[0]', field: 'STATUS', before: '', after: 'CHECKED', reason: 'review', fixCode: 'REVIEW' }, { ...origin, issuedAt: later(2) }, uiState, later(2));
journal.setRemark('EC-000001', 'verified', { ...origin, issuedAt: later(3) }, uiState, later(3));
let evidence = journal.evidence(); assert.equal(evidence.journal.entries.length, 3); assert(evidence.commandEnvelopes.every((entry) => entry.inverse)); assert.deepEqual(validateCommandJournal(evidence.journal), []); assert.equal(parseCommandJournal(serializeCommandJournal(evidence.journal)).entries.length, 3);
prepared = journal.prepareUndo(uiState, later(4), journal.currentAuthority().authorityId); assert.equal(acceptPrepared(journal, prepared).accepted, true);
prepared = journal.prepareUndo(uiState, later(5), journal.currentAuthority().authorityId); assert.equal(acceptPrepared(journal, prepared).accepted, true);
prepared = journal.prepareRedo(uiState, later(6), journal.currentAuthority().authorityId); assert.equal(acceptPrepared(journal, prepared).accepted, true);
prepared = journal.prepareRedo(uiState, later(7), journal.currentAuthority().authorityId); assert.equal(acceptPrepared(journal, prepared).accepted, true);
for (let index = 0; index < 7; index += 1) { const time = later(8 + index); journal.setRemark(`CN-${(index % 3) + 1}`, `value-${index}`, { ...origin, issuedAt: time }, uiState, time); }
evidence = journal.evidence(); assert.equal(evidence.journal.activeCommandIds.length, 10); assert.equal(evidence.journal.checkpoints.length, 1); assert.equal(evidence.journal.checkpoints[0].stateHash, topologyReplayStateHash(evidence.state));
const persisted = parseTopologyEditSessionDraft(serializeTopologyEditSessionDraft(evidence.lastSnapshot));
const acceptedAuthority = journal.currentAuthority().authorityId; journal.destroy(); await new Promise((resolve) => setTimeout(resolve, 0));
const restoredService = await service(storage, locks), restored = restoredService.restore(); assert.equal(restored.authority.authorityId, acceptedAuthority); assert.deepEqual(replayTopologyCommandJournal(persisted.commandJournal, baseDraft, fakeCore), restored.state); assert.deepEqual(activeJournalCommands(persisted.commandJournal).map((entry) => entry.commandId), persisted.commandJournal.activeCommandIds);
const mismatchedContext = Object.freeze({ ...context, document: Object.freeze({ ...document, sourceHash: 'c'.repeat(64) }) }); assert.throws(() => assertTopologyDraftBasis(persisted, mismatchedContext), /does not match loaded source/); restoredService.destroy();
const batchStorage = memoryStorage(), batchLocks = new Locks(), batchService = await service(batchStorage, batchLocks);
const first = fakeCore.appendTopologyEditCommand(baseDraft, 'MOVE_NODE', { nodeId: 'CN-2' }), second = fakeCore.appendTopologyEditCommand(first, 'MOVE_NODE', { nodeId: 'CN-3' });
prepared = batchService.prepareNativeBatch({ expectedAuthorityId: batchService.currentAuthority().authorityId, nativeCommands: second.commands, origin, uiState, updatedAt: later(15), expectedDraftHash: second.topologyEditDraftHash });
assert.equal(acceptPrepared(batchService, prepared).accepted, true); const batchEvidence = batchService.evidence(); assert.equal(new Set(batchEvidence.commandEnvelopes.map((entry) => entry.transactionId)).size, 1); assert.equal(batchEvidence.state.draft.commands.length, 2); batchService.destroy();
const modules = ['contracts/command-journal.js', 'tabs/topology-trace-validator/topology-command-replay.js', 'tabs/topology-trace-validator/topology-edit-session-draft.js', 'tabs/topology-trace-validator/topology-draft-recovery.js', 'tabs/topology-trace-validator/topology-edit-journal-service.js', 'tabs/topology-trace-validator/topology-edit-persistence-actions.js', 'tabs/topology-trace-validator/topology-edit-ui-state.js'];
for (const relative of modules) { const source = readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8'); assert(source.split(/\r?\n/).length <= 300); assert.doesNotMatch(source, /export\s+default/); }
console.log('[SIMULATED] Phase 2 journal, regeneration-before-acceptance, writer lease, checkpoints, replay, and recovery passed.');
await import('./sequential-command-authority-foundation.test.mjs');
await import('./sequential-redo-head-authority.test.mjs');
await import('./sequential-native-command-identity.test.mjs');
await import('./sequential-command-time-normalization.test.mjs');
await import('./scoped-edit-command-runtime.test.mjs');
await import('./scoped-edit-command-runtime-static.test.mjs');
await import('./sequential-workspace-command-authority-package.test.js');
