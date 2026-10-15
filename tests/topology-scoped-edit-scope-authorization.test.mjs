import assert from 'node:assert/strict';
import { createTopologyScopedEditModelWideGrant } from '../tabs/topology-trace-validator/topology-scoped-edit-authority-contracts.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE } from '../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import { createTopologyAuthorityFixture as fixture, topologyTestCommand as command, topologyTestBuilt as builtFor, topologyTestCanonical as canonical } from './topology-scoped-edit-authority-contracts.test.mjs';

const scoped = await fixture({ mode: TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED });
let boundaryRejected = 0, excludedRejected = 0, attributeRejected = 0, remarkRejected = 0;
for (let index = 0; index < 1000; index += 1) {
  assert.throws(() => scoped.service.prepareNative(scoped.boundaryInput), (error) => error.code === 'BOUNDARY_TARGET_NOT_EDITABLE');
  assert.throws(() => scoped.service.prepareNative(scoped.excludedInput), (error) => error.code === 'EXCLUDED_TARGET_NOT_EDITABLE');
  boundaryRejected += 1; excludedRejected += 1;
}
for (let index = 0; index < 500; index += 1) {
  assert.throws(() => scoped.service.prepareAttribute({ expectedAuthorityId: scoped.service.currentAuthority().authorityId,
    edit: { branchIndex: 2, childIndex: 0, sourcePath: '$[2].children[0]', field: 'STATUS', before: '', after: 'CHECKED', reason: 'scope-test', fixCode: 'SCOPE' },
    origin: scoped.origin, uiState: scoped.uiState, updatedAt: scoped.origin.issuedAt }),
  (error) => ['EXCLUDED_TARGET_NOT_EDITABLE', 'SOURCE_BRANCH_OUTSIDE_SCOPE'].includes(error.code));
  assert.throws(() => scoped.service.prepareRemark({ expectedAuthorityId: scoped.service.currentAuthority().authorityId,
    targetId: 'CN-X', value: `outside-${index}`, origin: scoped.origin, uiState: scoped.uiState,
    updatedAt: scoped.origin.issuedAt }), (error) => error.code === 'EXCLUDED_TARGET_NOT_EDITABLE');
  attributeRejected += 1; remarkRejected += 1;
}
assert.equal(scoped.storage.attempts(), 0, 'scope rejection never reaches persistence');
scoped.service.destroy();

const serviceFixture = await fixture();
const origin = Object.freeze({ kind: 'AUTOFIX', actorId: 'TOPOLOGY_CHECKER', issuedAt: serviceFixture.origin.issuedAt });
let row = command(serviceFixture.service.evidence().state.draft, 'CN-A');
assert.throws(() => serviceFixture.service.prepareNativeBatch({
  expectedAuthorityId: serviceFixture.service.currentAuthority().authorityId,
  nativeCommands: [row.nativeCommand], origin, uiState: serviceFixture.uiState,
  updatedAt: origin.issuedAt, expectedDraftHash: row.candidate.topologyEditDraftHash,
  authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX,
}), (error) => error.code === 'INVALID_MODEL_WIDE_AUTHORITY');
const forged = createTopologyScopedEditModelWideGrant({
  authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX,
  sourceAuthorityId: serviceFixture.service.currentAuthority().authorityId, originKind: 'AUTOFIX',
  evidenceKind: 'REVIEWED_FIX', evidenceId: 'S-FORGED', evidenceHash: 'forged',
  commandIdentityHash: 'forged', targetHash: 'forged', nativeCommandIds: [row.nativeCommand.id],
});
assert.throws(() => serviceFixture.service.prepareNativeBatch({
  expectedAuthorityId: serviceFixture.service.currentAuthority().authorityId,
  nativeCommands: [row.nativeCommand], origin, uiState: serviceFixture.uiState,
  updatedAt: origin.issuedAt, expectedDraftHash: row.candidate.topologyEditDraftHash,
  modelWideGrant: forged,
}), (error) => error.code === 'MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID');
serviceFixture.service.destroy();

function suggestion(id, payload, approvedByDefault = true) {
  return Object.freeze({ id, issueId: `ISSUE-${id}`, approvedByDefault,
    effectiveFixMode: approvedByDefault ? 'AUTO' : 'CONFIRM', confidence: 'HIGH',
    operations: Object.freeze([{ type: 'MOVE_NODE', payload }]) });
}
async function modelWideCase(index, mode) {
  const f = await fixture(), draft = f.service.evidence().state.draft;
  const offset = mode === 'safe' ? 500 : 0;
  const next = command(draft, 'CN-A', { x: offset + index, y: 2, z: 3 });
  const record = suggestion(`${mode === 'safe' ? 'SS' : 'RS'}-${index}`, next.nativeCommand.payload);
  f.setReviewEvidence([record]);
  const current = f.service.currentAuthority();
  const authorityMode = mode === 'safe' ? TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_SAFE_AUTOFIX
    : TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX;
  const evidence = mode === 'safe' ? { plan: Object.freeze({ candidateDraft: next.candidate,
    run: Object.freeze({ committed: true, runId: `SAFE-${index}`,
      beforeTopologyHash: canonical.canonicalTopologyHash, policyHash: 'policy-live',
      selectedIssueIds: Object.freeze([record.issueId]),
      applied: Object.freeze([{ issue: Object.freeze({ id: record.issueId }), suggestion: record }]) }) }) }
    : { selectedSuggestions: [record], approvedOnly: true, approvalDisposition: 'AUTO_APPROVED' };
  const grant = f.service.issueModelWideAuthority({ capability: f.capability,
    expectedAuthorityId: current.authorityId, authorityMode, nativeCommands: [next.nativeCommand], canonical, evidence });
  const prepared = f.service.prepareNativeBatch({ expectedAuthorityId: current.authorityId,
    nativeCommands: [next.nativeCommand], origin, uiState: f.uiState, updatedAt: origin.issuedAt,
    expectedDraftHash: next.candidate.topologyEditDraftHash, modelWideGrant: grant });
  const accepted = f.service.acceptPrepared(prepared, f.service.certifyRegeneration(prepared, builtFor(prepared)));
  assert.equal(accepted.accepted, true); assert.equal(f.storage.writes(), 1); f.service.destroy();
}
for (let index = 1; index <= 250; index += 1) await modelWideCase(index, 'reviewed');
for (let index = 1; index <= 250; index += 1) await modelWideCase(index, 'safe');

const mismatchedFixture = await fixture();
row = command(mismatchedFixture.service.evidence().state.draft, 'CN-A', { x: 999, y: 2, z: 3 });
const mismatched = suggestion('BAD', { nodeId: 'CN-X', position: { x: 999, y: 2, z: 3 } });
mismatchedFixture.setReviewEvidence([mismatched]);
assert.throws(() => mismatchedFixture.service.issueModelWideAuthority({ capability: mismatchedFixture.capability,
  expectedAuthorityId: mismatchedFixture.service.currentAuthority().authorityId,
  authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX,
  nativeCommands: [row.nativeCommand], canonical,
  evidence: { selectedSuggestions: [mismatched], approvedOnly: true, approvalDisposition: 'AUTO_APPROVED' },
}), (error) => error.code === 'MODEL_WIDE_AUTHORITY_PROVENANCE_INVALID');
mismatchedFixture.service.destroy();
console.log(`[PASS] boundary=${boundaryRejected} excluded=${excludedRejected} attribute=${attributeRejected} remark=${remarkRejected} modelWide=500`);
