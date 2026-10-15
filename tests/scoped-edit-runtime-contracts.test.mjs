import assert from 'node:assert/strict';
import {
  SCOPED_EDIT_COMMIT_PROPOSAL_V1,
  SCOPED_EDIT_COMMIT_RESULT_V1,
  SCOPED_EDIT_COMMIT_STATUS,
  SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  SCOPED_EDIT_HOST_CONTRACT_V1,
  SCOPED_EDIT_JOURNAL_PROJECTION_V1,
  SCOPED_EDIT_RUNTIME_CONFORMANCE_V1,
  SCOPED_EDIT_RUNTIME_STATE_V1,
  SCOPED_EDIT_RUNTIME_STATUS,
  assertScopedEditHostContract,
  createScopedEditRuntime,
  validateScopedEditCommitProposal,
  validateScopedEditCommitResult,
  validateScopedEditEntityGeometry,
  validateScopedEditJournalProjection,
  validateScopedEditRuntimeState,
} from '../core/scoped-edit-runtime/index.js';
import { createEditDragSession } from '../core/edit-3d/index.js';
import {
  SCOPED_EDIT_FIXTURE_COUNTS,
  createScopedEditRuntimeFixture,
} from './fixtures/scoped-edit-runtime-fixture.js';

let checked = 0, hostCalls = 0;

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  assert.equal(value instanceof Map || value instanceof Set, false);
  for (const child of Object.values(value)) {
    assert.notEqual(typeof child, 'function');
    assertDeepFrozen(child);
  }
}

function assertContractValue(value) {
  assertDeepFrozen(value);
  assert.doesNotThrow(() => JSON.stringify(value));
  checked += 1;
}

assert.deepEqual({
  state: SCOPED_EDIT_RUNTIME_STATE_V1,
  proposal: SCOPED_EDIT_COMMIT_PROPOSAL_V1,
  result: SCOPED_EDIT_COMMIT_RESULT_V1,
  projection: SCOPED_EDIT_JOURNAL_PROJECTION_V1,
  geometry: SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  conformance: SCOPED_EDIT_RUNTIME_CONFORMANCE_V1,
}, {
  state: 'ScopedEditRuntimeState.v1', proposal: 'ScopedEditCommitProposal.v1',
  result: 'ScopedEditCommitResult.v1', projection: 'ScopedEditJournalProjection.v1',
  geometry: 'ScopedEditEntityGeometry.v1', conformance: 'ScopedEditRuntimeConformance.v1',
});
checked += 1;

const geometryInput = { schema: SCOPED_EDIT_ENTITY_GEOMETRY_V1, entityId: 'entity:1', anchor: [10, 20, 30] };
const geometry = validateScopedEditEntityGeometry(geometryInput);
assertContractValue(geometry);
assert.notEqual(geometry.anchor, geometryInput.anchor);
assert.throws(() => validateScopedEditEntityGeometry({ ...geometryInput, schema: undefined }), /schema/);
assert.throws(() => validateScopedEditEntityGeometry({ ...geometryInput, entityId: '' }), /entityId/);
for (const anchor of [[1, 2], [1, 2, Number.NaN], [1, 2, Infinity]]) {
  assert.throws(() => validateScopedEditEntityGeometry({ ...geometryInput, anchor }), TypeError);
  checked += 1;
}

const projection = validateScopedEditJournalProjection({
  schema: SCOPED_EDIT_JOURNAL_PROJECTION_V1, initialState: {}, envelopes: [], activeCommandIds: [],
});
assertContractValue(projection);
assert.throws(() => validateScopedEditJournalProjection({ ...projection, schema: undefined }), /schema/);
assert.throws(() => validateScopedEditJournalProjection({ ...projection, envelopes: {} }), /array/);
assert.throws(() => validateScopedEditJournalProjection({ ...projection, activeCommandIds: ['unknown'] }), /has no envelope/);
checked += 3;

const fixture = createScopedEditRuntimeFixture();
assert.deepEqual({
  entities: fixture.scene.entities.length,
  editable: fixture.editableIds.length,
  boundary: fixture.boundaryIds.length,
  excluded: fixture.excludedIds.length,
  structuralIdentifiers: fixture.structuralIdentifiers.length,
  selectionSeeds: fixture.selectionSeeds.length,
  sectionalRegions: fixture.sectionalRegions.length,
  reducerBindings: fixture.reducerRegistry.commandTypes.length,
}, SCOPED_EDIT_FIXTURE_COUNTS);
checked += 1;

const hostReport = assertScopedEditHostContract(fixture.host);
assert.equal(hostReport.schema, SCOPED_EDIT_HOST_CONTRACT_V1);
assertContractValue(hostReport);
assert.equal(fixture.readEvidence().sceneCalls, 0, 'shape validation must not call host methods');

const methods = ['scene', 'appendEditCommand', 'entityGeometry', 'resolveScope'];
const inertHost = Object.freeze(Object.fromEntries(methods.map((name) => [name, () => { hostCalls += 1; }])));
for (const missing of methods) {
  const host = Object.fromEntries(methods.filter((name) => name !== missing).map((name) => [name, inertHost[name]]));
  assert.throws(() => assertScopedEditHostContract(host), new RegExp(missing));
  checked += 1;
}
assert.throws(() => assertScopedEditHostContract({ ...inertHost, scene: {} }), /scene/);
assert.equal(hostCalls, 0);
checked += 1;

const runtime = createScopedEditRuntime({
  host: fixture.host, scopeRequest: fixture.scopeRequest,
  reducerRegistry: fixture.reducerRegistry, journalProjection: fixture.journalProjection,
});
const state = runtime.getState();
assert.equal(state.schema, SCOPED_EDIT_RUNTIME_STATE_V1);
assert.equal(state.status, SCOPED_EDIT_RUNTIME_STATUS.READY);
assertContractValue(state);
assert.equal(state.scope.entityIds.length, 8);
assert.equal(state.scope.boundaryIds.length, 4);

const proposalFixture = createScopedEditRuntimeFixture();
const proposalRuntime = createScopedEditRuntime({
  host: proposalFixture.host, scopeRequest: proposalFixture.scopeRequest,
  reducerRegistry: proposalFixture.reducerRegistry, journalProjection: proposalFixture.journalProjection,
});
const entityId = proposalFixture.editableIds[0];
proposalRuntime.beginDrag({ entityId, dragRequest: proposalFixture.dragRequest(entityId) });
const validDrag = proposalRuntime.solveDrag(proposalFixture.validRay(entityId));
const proposalEnvelope = proposalFixture.envelope(1, 'ENTITY_POSITION_SET', entityId, validDrag.point);
const prepared = proposalRuntime.prepareCommit({
  commandName: 'ENTITY_POSITION_SET', targetIds: [entityId], envelope: proposalEnvelope,
});
assertContractValue(validateScopedEditCommitProposal(prepared));
const invalidDragSession = createEditDragSession(proposalFixture.dragRequest(entityId));
const invalidDrag = invalidDragSession.solve(proposalFixture.invalidRay(entityId));
assert.equal(invalidDrag.valid, false);
assert.throws(() => validateScopedEditCommitProposal({ ...prepared, dragResult: invalidDrag }),
  /prepared commit requires a valid drag result/);
assert.throws(() => validateScopedEditCommitProposal({ ...prepared, dragResult: undefined }), TypeError);
checked += 2;

const committed = proposalRuntime.commitPrepared();
const committedState = proposalRuntime.getState();
assertContractValue(validateScopedEditCommitResult(committed));
for (const name of ['entityId', 'commandId', 'dragResult', 'boundaryDecision']) {
  assert.throws(() => validateScopedEditCommitResult({ ...committed, [name]: null }), TypeError);
  checked += 1;
}
assert.throws(() => validateScopedEditCommitResult({ ...committed, dragResult: invalidDrag }),
  /committed result requires a valid drag result/);
assert.throws(() => validateScopedEditCommitResult({
  ...committed, boundaryDecision: { ...committed.boundaryDecision, allowed: false, reason: 'BOUNDARY_FROZEN' },
}), /committed result requires an allowed boundary decision/);
assert.throws(() => validateScopedEditCommitResult({ ...committed, commandId: 'SER-999999' }),
  /must exist in journalProjection/);
assert.throws(() => validateScopedEditCommitResult({
  ...committed, journalProjection: { ...committed.journalProjection, activeCommandIds: [] },
}), /must be active in journalProjection/);
assert.throws(() => validateScopedEditCommitResult({ ...committed, appliedCommandIds: [] }),
  /must match replayState.appliedCommandIds/);
assert.throws(() => validateScopedEditCommitResult({
  ...committed,
  replayState: { ...committed.replayState, appliedCommandIds: [] },
  appliedCommandIds: [],
}), /must be present in replayState.appliedCommandIds/);
checked += 6;

const rejected = validateScopedEditCommitResult({
  schema: SCOPED_EDIT_COMMIT_RESULT_V1,
  status: SCOPED_EDIT_COMMIT_STATUS.REJECTED,
  entityId: null,
  commandId: null,
  rejectionCode: 'EARLY_REJECTION',
  message: 'Rejected before drag or command evidence existed.',
  dragResult: null,
  boundaryDecision: null,
  journalProjection: projection,
  replayState: { state: projection.initialState, appliedCommandIds: [] },
  appliedCommandIds: [],
});
assertContractValue(rejected);
assert.throws(() => validateScopedEditCommitResult({ ...rejected, appliedCommandIds: ['SER-000001'] }),
  /Commit result appliedCommandIds must match replayState.appliedCommandIds/);
checked += 1;

assert.throws(() => validateScopedEditRuntimeState({ ...committedState, appliedCommandIds: [] }),
  /Runtime state appliedCommandIds must match replayState.appliedCommandIds/);
const divergentProjectionResult = validateScopedEditCommitResult({
  ...committed,
  journalProjection: { ...committed.journalProjection, initialState: { divergent: true } },
});
assert.throws(() => validateScopedEditRuntimeState({
  ...committedState, lastCommitResult: divergentProjectionResult,
}), /lastCommitResult journalProjection must match/);
const divergentReplayResult = validateScopedEditCommitResult({
  ...committed,
  replayState: { ...committed.replayState, state: { ...committed.replayState.state, divergent: true } },
});
assert.throws(() => validateScopedEditRuntimeState({
  ...committedState, lastCommitResult: divergentReplayResult,
}), /lastCommitResult replayState must match/);
checked += 3;

console.log(`[PASS] scoped-edit runtime contracts: ${checked} contract and host-shape cases.`);
