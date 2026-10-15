import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../contracts/project-session-contracts.js';
import { createTopologyDraftRecovery } from '../tabs/topology-trace-validator/topology-draft-recovery.js';
import { createTopologyEditJournalService } from '../tabs/topology-trace-validator/topology-edit-journal-service.js';
import {
  createTopologyScopedEditAuthorityBasis, createTopologyScopedEditCommandTargets,
  createTopologyScopedEditModelWideGrant, createTopologyScopedEditRegenerationEvidence,
  TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1, TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1,
  TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1,
} from '../tabs/topology-trace-validator/topology-scoped-edit-authority-contracts.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE, createTopologyScopedEditCommandScope } from '../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';

export const NOW = '2026-07-25T18:00:00.000Z';
export const later = (n) => new Date(Date.parse(NOW) + n * 1000).toISOString();
export class TopologyTestLockManager {
  constructor() { this.held = new Set(); }
  async request(name, options, callback) {
    if (options?.ifAvailable && this.held.has(name)) return callback(null);
    this.held.add(name); try { return await callback(Object.freeze({ name, mode: 'exclusive' })); }
    finally { this.held.delete(name); }
  }
}
export function topologyTestStorage({ failWrites = false } = {}) {
  const values = new Map(); let attempts = 0, writes = 0;
  return Object.freeze({
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem(key, value) { attempts += 1; if (failWrites) throw new Error('storage failed'); values.set(key, String(value)); writes += 1; },
    removeItem: (key) => values.delete(key), seed: (key, value) => values.set(key, String(value)),
    attempts: () => attempts, writes: () => writes, entries: () => new Map(values),
  });
}
export const topologyTestCanonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'canonical-live',
  nodes: Object.freeze([
    Object.freeze({ id: 'CN-A', sourcePaths: Object.freeze(['$[0].children[0]']) }),
    Object.freeze({ id: 'CN-B', sourcePaths: Object.freeze(['$[1].children[0]']) }),
    Object.freeze({ id: 'CN-X', sourcePaths: Object.freeze(['$[2].children[0]']) }),
  ]),
  edges: Object.freeze([
    Object.freeze({ id: 'CE-AB', fromNodeId: 'CN-A', toNodeId: 'CN-B', sourcePaths: Object.freeze(['$[0].children[0]']) }),
    Object.freeze({ id: 'CE-X', fromNodeId: 'CN-X', toNodeId: 'CN-X', sourcePaths: Object.freeze(['$[2].children[0]']) }),
  ]), supports: Object.freeze([]), rigids: Object.freeze([]), junctions: Object.freeze([]),
  boundaries: Object.freeze([]), bends: Object.freeze([]), pointFeatures: Object.freeze([]),
});
export const topologyTestBaseDraft = Object.freeze({ schema: 'TopologyEditDraft.v1', baseCanonicalTopologyHash: 'canonical-base',
  commands: Object.freeze([]), redoCommands: Object.freeze([]), engineeringOverrides: Object.freeze({}),
  settings: Object.freeze({}), nextCommandSequence: 1, topologyEditDraftHash: 'draft-base' });
export const topologyTestCore = Object.freeze({ appendTopologyEditCommand(draft, type, payload) {
  const sequence = draft.nextCommandSequence;
  const command = Object.freeze({ schema: 'TopologyEditCommand.v1', id: `EC-${String(sequence).padStart(6, '0')}`,
    type: String(type), payload: structuredClone(payload) });
  const material = { ...draft, commands: Object.freeze([...draft.commands, command]), redoCommands: Object.freeze([]), nextCommandSequence: sequence + 1 };
  return Object.freeze({ ...material, topologyEditDraftHash: semanticHash(material) });
} });
function topologyTestContext(documentId) {
  const document = createProjectDocument({ documentId, slotId: 'baseline', fileName: 'test.json', sourceHash: 'b'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM', verticalAxis: 'Y', coordinateFrame: 'UNKNOWN',
    stats: { branchCount: 3, componentCount: 5, scanned: 3, matched: 3, filtered: 0 }, scope: { wildcard: '', selectedIds: [] }, createdAt: NOW });
  return Object.freeze({ document, session: attachProjectDocument(createProjectSession({ sessionId: `topology-session:${documentId}`, createdAt: NOW }), document, NOW) });
}
export function topologyTestCommand(draft = topologyTestBaseDraft, id = 'CN-A', position = { x: 1, y: 2, z: 3 }) {
  const candidate = topologyTestCore.appendTopologyEditCommand(draft, 'MOVE_NODE', { nodeId: id, position });
  return Object.freeze({ candidate, nativeCommand: candidate.commands.at(-1) });
}
export function topologyTestBuilt(prepared, overrides = {}) {
  const editDraft = prepared.candidateReplayState.draft;
  return Object.freeze({ editDraft, canonicalTopology: Object.freeze({ ...topologyTestCanonical,
    canonicalTopologyHash: overrides.canonicalTopologyHash ?? `edited-${semanticHash(editDraft).split(':')[1]}` }),
    editLedger: Object.freeze({}), editValidation: Object.freeze({ findings: Object.freeze([]) }) });
}
export async function createTopologyAuthorityFixture(options = {}) {
  const documentId = options.documentId ?? 'topology-document:test';
  const storage = options.storage ?? topologyTestStorage({ failWrites: options.failWrites });
  const lockManager = options.lockManager ?? new TopologyTestLockManager();
  const recovery = createTopologyDraftRecovery(storage, { lockManager }); await recovery.acquireWriter(documentId);
  const capability = Object.freeze({ token: `autofix:${documentId}` });
  let reviewEvidence = Object.freeze({ report: Object.freeze({ schema: 'TopologyCheckReport.v1', canonicalTopologyHash: topologyTestCanonical.canonicalTopologyHash, issues: Object.freeze([]) }), suggestions: Object.freeze([]), reviewState: Object.freeze({ schema: 'TopologyReviewState.v1', canonicalTopologyHash: topologyTestCanonical.canonicalTopologyHash, issueStates: Object.freeze({}), topologyReviewStateHash: 'review-empty' }), policyHash: 'policy-live' });
  const mode = options.mode ?? TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL;
  const context = topologyTestContext(documentId);
  const service = createTopologyEditJournalService({ core: topologyTestCore, context, baseDraft: topologyTestBaseDraft,
    recovery, createdAt: NOW, autoFixCapability: capability, canonicalProvider: () => topologyTestCanonical,
    reviewAuthorityProvider: () => reviewEvidence,
    scopeProvider: (request) => createTopologyScopedEditCommandScope({ canonical: topologyTestCanonical,
      authorityMode: request.authorityMode ?? mode,
      editScope: mode === TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED ? { sourceBranchIndexes: [0] } : null,
      originKind: request.origin?.kind, modelWideGrant: request.modelWideGrant }) });
  const uiState = Object.freeze({ projection: 'XY', tool: 'SELECT', contextEdgeId: '', supportScale: 2.5, selection: Object.freeze([]) });
  const origin = Object.freeze({ kind: 'USER', actorId: 'LOCAL_USER', issuedAt: later(1) });
  const makeInput = (id) => { const row = topologyTestCommand(service.evidence().state.draft, id); return Object.freeze({
    expectedAuthorityId: service.currentAuthority().authorityId, nativeCommand: row.nativeCommand,
    origin, uiState, updatedAt: origin.issuedAt, expectedDraftHash: row.candidate.topologyEditDraftHash }); };
  let clock = 10;
  const setReviewEvidence = (suggestions) => {
    const issues = suggestions.map((row, index) => Object.freeze({ id: row.issueId || `ISSUE-${index + 1}`, confidence: row.confidence || 'HIGH' }));
    reviewEvidence = Object.freeze({ report: Object.freeze({ schema: 'TopologyCheckReport.v1', canonicalTopologyHash: topologyTestCanonical.canonicalTopologyHash, issues: Object.freeze(issues) }), suggestions: Object.freeze(suggestions), reviewState: Object.freeze({ schema: 'TopologyReviewState.v1', canonicalTopologyHash: topologyTestCanonical.canonicalTopologyHash, issueStates: Object.freeze({}), topologyReviewStateHash: `review-${semanticHash(issues).split(':')[1]}` }), policyHash: 'policy-live' });
    return reviewEvidence;
  };
  return Object.freeze({ service, storage, lockManager, recovery, capability, uiState, origin, documentId,
    setReviewEvidence, authorizedInput: makeInput('CN-A'), boundaryInput: makeInput('CN-B'), excludedInput: makeInput('CN-X'),
    regenerate: (prepared) => topologyTestBuilt(prepared), nextTime: () => later(clock++),
    persistenceWrites: storage.writes, persistenceAttempts: storage.attempts });
}

function runContractAssertions() {
  const base = { documentId: 'doc-1', sourceHash: 'a'.repeat(64), baseCanonicalTopologyHash: 'canonical-1', currentDraftHash: 'draft-1', journalHash: 'journal-1', replayHash: 'replay-1', activeCommandIds: ['CJ-000002', 'CJ-000001'], redoCommandIds: ['CJ-000003'] };
  const first = createTopologyScopedEditAuthorityBasis(base), second = createTopologyScopedEditAuthorityBasis({ ...base, activeCommandIds: [...base.activeCommandIds].reverse() });
  assert.equal(first.schema, TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1); assert.equal(first.authorityId, second.authorityId); assert(Object.isFrozen(first));
  for (const [field, value] of [['sourceHash', 'b'.repeat(64)], ['currentDraftHash', 'draft-2'], ['journalHash', 'journal-2'], ['replayHash', 'replay-2']]) assert.notEqual(createTopologyScopedEditAuthorityBasis({ ...base, [field]: value }).authorityId, first.authorityId, field);
  const targets = createTopologyScopedEditCommandTargets({ commandKind: 'NATIVE', commandType: 'MOVE_NODE', entityIds: ['N2', 'N1', 'N1'], sourcePaths: ['$[1].children[0]', '$[0].children[0]'], sourceBranchIndexes: [1, 0, 1] });
  assert.deepEqual(targets.entityIds, ['N1', 'N2']); assert.throws(() => createTopologyScopedEditCommandTargets({ commandKind: 'NATIVE', commandType: 'MOVE_NODE', entityIds: [], sourcePaths: [], sourceBranchIndexes: [] }), (error) => error.code === 'EMPTY_COMMAND_TARGET_SET');
  const grantInput = { authorityMode: 'MODEL_WIDE_REVIEWED_FIX', sourceAuthorityId: first.authorityId, originKind: 'AUTOFIX', evidenceKind: 'REVIEWED_FIX', evidenceId: 'S-1', evidenceHash: 'review-hash', commandIdentityHash: 'command-hash', targetHash: 'target-hash', nativeCommandIds: ['EC-2', 'EC-1'] };
  const grant = createTopologyScopedEditModelWideGrant(grantInput); assert.equal(grant.schema, TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1); assert.equal(grant.grantId, createTopologyScopedEditModelWideGrant({ ...grantInput, nativeCommandIds: ['EC-1', 'EC-2'] }).grantId);
  const regeneration = createTopologyScopedEditRegenerationEvidence({ preparedId: 'TPREP-1', candidateDraftHash: 'draft-2', canonicalTopologyHash: 'canonical-2', artifactsHash: 'artifacts-2' });
  assert.equal(regeneration.schema, TOPOLOGY_SCOPED_EDIT_REGENERATION_EVIDENCE_V1); assert.doesNotThrow(() => JSON.stringify({ first, targets, grant, regeneration }));
  console.log('[PASS] authority, grant, target, and regeneration contracts');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runContractAssertions();
