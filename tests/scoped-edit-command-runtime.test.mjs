import assert from 'node:assert/strict';
import { immutableJson } from '../contracts/contract-values.js';
import {
  SCOPED_EDIT_COMMAND_RESULT_V1,
  SCOPED_EDIT_COMMAND_RUNTIME_STATUS,
  createScopedEditCommandRuntime,
} from '../core/scoped-edit-runtime/index.js';
import { createScopedEditReferenceHostFixture } from './fixtures/scoped-edit-reference-host-fixture.js';
import { createScopedEditRuntimeFixture } from './fixtures/scoped-edit-runtime-fixture.js';

function createRuntime(fixture, overrides = {}) {
  return createScopedEditCommandRuntime({
    host: overrides.host ?? fixture.host,
    scopeRequest: fixture.scopeRequest,
    reducerRegistry: fixture.reducerRegistry,
    journalProjection: fixture.journalProjection,
    allowedCommandNames: overrides.allowedCommandNames ?? ['ENTITY_ATTRIBUTE_SET', 'ENTITY_REMARK_SET'],
  });
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_ATTRIBUTE_SET', 'E-01', 'command-only:value');
  const inputs = JSON.stringify({ request: fixture.scopeRequest, projection: fixture.journalProjection, envelope });
  const proposal = runtime.prepareCommand({
    commandName: 'ENTITY_ATTRIBUTE_SET', targetIds: ['E-01'], envelope,
  });
  assert.equal(proposal.status, 'PREPARED');
  assert.equal('dragResult' in proposal, false);
  const result = runtime.commitPrepared();
  assert.equal(result.schema, SCOPED_EDIT_COMMAND_RESULT_V1);
  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.commandId, envelope.commandId);
  assert.equal(result.replayState.state.attributes['E-01'], 'command-only:value');
  assert.equal(runtime.getState().status, SCOPED_EDIT_COMMAND_RUNTIME_STATUS.COMMITTED);
  assert.equal(JSON.stringify({ request: fixture.scopeRequest, projection: fixture.journalProjection, envelope }), inputs);
  assert.deepEqual(fixture.readEvidence(), {
    sceneCalls: 2, scopeCalls: 2, geometryCalls: 0, appendCalls: 1, reducerCalls: 1,
    callOrder: [`append:${envelope.commandId}`, `replay:${envelope.commandId}`],
  });
}


{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_REMARK_SET', 'E-01', 'mismatch');
  const result = runtime.prepareCommand({
    commandName: 'ENTITY_ATTRIBUTE_SET', targetIds: ['E-01'], envelope,
  });
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'COMMAND_NAME_MISMATCH');
  assert.equal(result.boundaryDecision, null);
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_POSITION_SET', 'E-01', [50, 0, 0]);
  const result = runtime.prepareCommand({
    commandName: 'ENTITY_POSITION_SET', targetIds: ['E-01'], envelope,
  });
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'COMMAND_NOT_ALLOWED');
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_ATTRIBUTE_SET', 'E-01', 'blocked');
  const result = runtime.prepareCommand({
    commandName: 'ENTITY_ATTRIBUTE_SET', targetIds: ['X-01', 'E-01', 'B-01'], envelope,
  });
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'BOUNDARY_FROZEN');
  assert.deepEqual(result.boundaryDecision.escapingIds, ['B-01', 'X-01']);
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'PROPAGATE' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_REMARK_SET', 'E-01', 'propagated');
  const proposal = runtime.prepareCommand({
    commandName: 'ENTITY_REMARK_SET', targetIds: ['X-01', 'E-01', 'B-01'], envelope,
  });
  assert.equal(proposal.status, 'PREPARED');
  assert.deepEqual(proposal.boundaryDecision.escapingIds, ['B-01', 'X-01']);
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.replayState.state.remarks['E-01'], 'propagated');
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const changedScene = immutableJson({
    ...fixture.scene, metadata: { ...fixture.scene.metadata, staleCommandAuthority: true },
  }, 'Stale command scene');
  let stale = false;
  const host = Object.freeze({
    scene: () => stale ? changedScene : fixture.host.scene(),
    resolveScope: (request) => fixture.host.resolveScope(request),
    entityGeometry: (entityId) => fixture.host.entityGeometry(entityId),
    appendEditCommand: (projection, envelope) => fixture.host.appendEditCommand(projection, envelope),
  });
  const runtime = createRuntime(fixture, { host });
  const envelope = fixture.envelope(1, 'ENTITY_ATTRIBUTE_SET', 'E-01', 'stale');
  assert.equal(runtime.prepareCommand({ commandName: 'ENTITY_ATTRIBUTE_SET', targetIds: ['E-01'], envelope }).status, 'PREPARED');
  stale = true;
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, 'SCOPE_REVALIDATION_FAILED');
  assert.equal(fixture.readEvidence().appendCalls, 0);
}

for (const [options, code] of [
  [{ corruption: 'OMIT_APPENDED' }, 'APPEND_PROJECTION_INVALID'],
  [{ failCommandType: 'ENTITY_ATTRIBUTE_SET' }, 'REPLAY_FAILED'],
]) {
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN', ...options });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_ATTRIBUTE_SET', 'E-01', code);
  runtime.prepareCommand({ commandName: 'ENTITY_ATTRIBUTE_SET', targetIds: ['E-01'], envelope });
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionCode, code);
  assert.deepEqual(result.journalProjection, fixture.journalProjection);
}

{
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: 'FROZEN' });
  const runtime = createRuntime(fixture);
  const envelope = fixture.envelope(1, 'ENTITY_REMARK_SET', 'E-01', 'cancelled');
  runtime.prepareCommand({ commandName: 'ENTITY_REMARK_SET', targetIds: ['E-01'], envelope });
  assert.equal(runtime.cancelPrepared().status, 'READY');
  assert.equal(fixture.readEvidence().appendCalls, 0);
  assert.equal(runtime.destroy().status, 'DESTROYED');
  assert.throws(() => runtime.prepareCommand({ commandName: 'ENTITY_REMARK_SET', targetIds: ['E-01'], envelope }),
    (error) => error.code === 'RUNTIME_DESTROYED');
}

{
  const fixture = createScopedEditReferenceHostFixture();
  const store = fixture.createStore();
  const snapshot = store.getSnapshot();
  const targetId = fixture.editableIds[0];
  const commandName = fixture.commandTypes[1];
  const envelope = fixture.createEnvelope(snapshot, commandName, {
    targetId, key: 'commandOnly', value: 'qualified',
  }, '2026-07-27T03:40:00.000Z');
  const runtime = createScopedEditCommandRuntime({
    host: store.createRuntimeHost(),
    scopeRequest: fixture.scopeRequest('STRUCTURAL', 'FROZEN', 0),
    reducerRegistry: fixture.reducerRegistry,
    journalProjection: snapshot.journalProjection,
    allowedCommandNames: fixture.commandTypes.slice(1),
  });
  const proposal = runtime.prepareCommand({ commandName, targetIds: [targetId], envelope });
  assert.equal(proposal.status, 'PREPARED');
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'COMMITTED');
  const entity = result.replayState.state.entities.find((row) => row.entityId === targetId);
  assert.equal(entity.attributes.commandOnly, 'qualified');
  assert.equal('dragResult' in result, false);
}

console.log('[PASS] CORE-SCR-1 command-only runtime: no drag fabrication, exact scope revalidation, journal replay, reference-host compatibility.');
