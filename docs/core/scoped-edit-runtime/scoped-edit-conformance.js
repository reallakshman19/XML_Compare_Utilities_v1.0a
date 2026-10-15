/** Reusable certification for the synthetic scoped-edit integration boundary. */
import { immutableJson } from '../../contracts/contract-values.js';
import { replayEditJournal } from '../edit-journal/index.js';
import { validateScopeClosure } from '../engineering-scope/index.js';
import {
  SCOPED_EDIT_RUNTIME_CONFORMANCE_V1,
  SCOPED_EDIT_RUNTIME_STATUS,
  validateScopedEditJournalProjection,
} from './scoped-edit-contracts.js';
import {
  assertScopedEditHostContract,
  isScopedEditDeeplyFrozen,
  readScopedEditHostContext,
} from './scoped-edit-host.js';
import { createScopedEditRuntime } from './scoped-edit-runtime.js';

function requiredFixture(fixtures) {
  if (!fixtures?.synthetic || typeof fixtures.createFixture !== 'function') {
    throw new TypeError('Conformance requires an explicit synthetic fixture family.');
  }
  for (const name of ['dragRequest', 'validRay', 'envelope', 'referencesOf']) {
    if (typeof fixtures[name] !== 'function') throw new TypeError(`Synthetic fixture is missing ${name}().`);
  }
  return fixtures;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function certify(checks) {
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`Scoped-edit conformance failed: ${failed.join(', ')}.`);
  return checks;
}

function observedHost(host, evidence) {
  return Object.freeze({
    scene() { evidence.sceneCalls += 1; return host.scene(); },
    resolveScope(request) { evidence.scopeCalls += 1; return host.resolveScope(request); },
    entityGeometry(entityId) { evidence.geometryCalls += 1; return host.entityGeometry(entityId); },
    appendEditCommand(projection, envelope) {
      evidence.appendCalls += 1; evidence.callOrder.push(`append:${envelope.commandId}`);
      return host.appendEditCommand(projection, envelope);
    },
  });
}

function observedRegistry(registry, evidence) {
  if (!registry || typeof registry.getReducer !== 'function' || typeof registry.reduce !== 'function') {
    throw new TypeError('Conformance requires a reducer registry.');
  }
  return Object.freeze({
    commandTypes: registry.commandTypes,
    has: typeof registry.has === 'function' ? (value) => registry.has(value) : undefined,
    getReducer: (value) => registry.getReducer(value),
    reduce(state, envelope) {
      evidence.callOrder.push(`replay:${envelope.commandId}`);
      return registry.reduce(state, envelope);
    },
  });
}

function runtimeFor(host, scopeRequest, registry, journalProjection) {
  return createScopedEditRuntime({ host, scopeRequest, reducerRegistry: registry, journalProjection });
}

function solveOnce(runtime, fixtures, entityId = fixtures.editableIds[0]) {
  runtime.beginDrag({ entityId, dragRequest: fixtures.dragRequest(entityId) });
  return runtime.solveDrag(fixtures.validRay(entityId));
}

function nextSequence(projection) {
  return Math.max(0, ...projection.envelopes.map((entry) => entry.sequence)) + 1;
}

function primaryTransaction(input, fixtures, host, registry, projection, evidence) {
  const firstRuntime = runtimeFor(host, input.scopeRequest, registry, projection);
  const firstResult = solveOnce(firstRuntime, fixtures);
  const twinRuntime = runtimeFor(host, input.scopeRequest, registry, projection);
  const twinResult = solveOnce(twinRuntime, fixtures);
  const appendCallsBeforeCommit = evidence.appendCalls;
  const envelope = fixtures.envelope(nextSequence(projection), 'ENTITY_POSITION_SET',
    fixtures.editableIds[0], firstResult.point);
  firstRuntime.prepareCommit({ commandName: 'ENTITY_POSITION_SET',
    targetIds: [fixtures.editableIds[0]], envelope });
  const committed = firstRuntime.commitPrepared();
  return { firstRuntime, firstResult, twinResult, envelope, committed, appendCallsBeforeCommit };
}

function boundaryDenied(fixtures, policy) {
  const fixture = fixtures.createFixture({ boundaryPolicy: policy });
  const runtime = runtimeFor(fixture.host, fixture.scopeRequest,
    fixture.reducerRegistry, fixture.journalProjection);
  const dragResult = solveOnce(runtime, fixture);
  const envelope = fixture.envelope(1, 'ENTITY_POSITION_SET', fixture.editableIds[0], dragResult.point);
  const result = runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET',
    targetIds: [fixture.editableIds[0], fixture.boundaryIds[0]], envelope });
  return result.status === 'REJECTED' && fixture.readEvidence().appendCalls === 0;
}

function commitFixture(fixture, sequence = nextSequence(fixture.journalProjection)) {
  const runtime = runtimeFor(fixture.host, fixture.scopeRequest,
    fixture.reducerRegistry, fixture.journalProjection);
  const dragResult = solveOnce(runtime, fixture);
  const envelope = fixture.envelope(sequence, 'ENTITY_POSITION_SET', fixture.editableIds[0], dragResult.point);
  runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET', targetIds: [fixture.editableIds[0]], envelope });
  return runtime.commitPrepared();
}

function corruptAppendRejected(fixtures) {
  const seed = fixtures.envelope(1, 'ENTITY_REMARK_SET', fixtures.editableIds[1], 'seed');
  const projection = fixtures.createFixture().journalProjection;
  const seeded = immutableJson({ ...projection, envelopes: [seed], activeCommandIds: [seed.commandId] }, 'Seeded projection');
  const fixture = fixtures.createFixture({ corruption: 'OMIT_APPENDED', journalProjection: seeded });
  const result = commitFixture(fixture, 2);
  return result.status === 'REJECTED' && result.rejectionCode === 'APPEND_PROJECTION_INVALID'
    && sameJson(result.journalProjection, seeded);
}

function reducerFailureContained(fixtures) {
  const fixture = fixtures.createFixture({ failCommandType: 'ENTITY_POSITION_SET' });
  const result = commitFixture(fixture);
  return result.status === 'REJECTED' && result.rejectionCode === 'REPLAY_FAILED'
    && sameJson(result.journalProjection, fixture.journalProjection) && /SER-000001/.test(result.message);
}

function replayDeterministic(result, registry) {
  const input = { initialState: result.journalProjection.initialState,
    envelopes: result.journalProjection.envelopes,
    activeCommandIds: result.journalProjection.activeCommandIds, registry };
  return sameJson(replayEditJournal(input), replayEditJournal(input));
}

function destroyTerminal(runtime, fixtures) {
  const first = runtime.destroy(), second = runtime.destroy();
  let rejected = false;
  try { runtime.beginDrag({ entityId: fixtures.editableIds[0], dragRequest: fixtures.dragRequest() }); }
  catch (error) { rejected = error.code === 'RUNTIME_DESTROYED'; }
  return sameJson(first, second) && first.status === SCOPED_EDIT_RUNTIME_STATUS.DESTROYED && rejected;
}

/** Certify the supplied synthetic host; use fixture hosts only for negative fault injection. */
export function runScopedEditRuntimeConformance(input = {}) {
  const fixtures = requiredFixture(input.fixtures);
  const projection = validateScopedEditJournalProjection(input.journalProjection);
  const evidence = { sceneCalls: 0, scopeCalls: 0, geometryCalls: 0, appendCalls: 0, callOrder: [] };
  const hostReport = assertScopedEditHostContract(input.host);
  const host = observedHost(input.host, evidence), registry = observedRegistry(input.reducerRegistry, evidence);
  const context = readScopedEditHostContext(host, input.scopeRequest);
  const closure = validateScopeClosure(context.scopedScene, { referencesOf: fixtures.referencesOf });
  const before = JSON.stringify({ scene: context.scene, request: input.scopeRequest, projection });
  const primary = primaryTransaction(input, fixtures, host, registry, projection, evidence);
  const appendIndex = evidence.callOrder.indexOf(`append:${primary.envelope.commandId}`);
  const replayIndex = evidence.callOrder.indexOf(`replay:${primary.envelope.commandId}`);
  const checks = certify({
    hostShapeValid: hostReport.valid === true,
    sceneValidAndImmutable: isScopedEditDeeplyFrozen(context.scene),
    scopeValidAndClosed: closure.closed && isScopedEditDeeplyFrozen(context.scope),
    editableAuthorizationCorrect: context.scopedScene.entityRoles[fixtures.editableIds[0]] === 'EDITABLE',
    boundaryAuthorizationCorrect: boundaryDenied(fixtures, 'FROZEN') && boundaryDenied(fixtures, 'GHOSTED'),
    dragResultDeterministic: sameJson(primary.firstResult, primary.twinResult),
    primaryTransactionCommitted: primary.committed.status === 'COMMITTED',
    appendCalledOnlyAfterAuthorization: primary.appendCallsBeforeCommit === 0 && evidence.appendCalls === 1,
    appendPrecedesReplay: appendIndex >= 0 && replayIndex > appendIndex,
    replayDeterministic: replayDeterministic(primary.committed, input.reducerRegistry),
    corruptAppendRejected: corruptAppendRejected(fixtures),
    reducerFailureContained: reducerFailureContained(fixtures),
    inputsUnchanged: before === JSON.stringify({ scene: context.scene, request: input.scopeRequest, projection }),
    outputsImmutable: [context.scope, context.scopedScene, primary.firstResult, primary.committed]
      .every((value) => isScopedEditDeeplyFrozen(value)),
    destroyTerminal: destroyTerminal(primary.firstRuntime, fixtures),
  });
  return immutableJson({ schema: SCOPED_EDIT_RUNTIME_CONFORMANCE_V1,
    passed: true, syntheticOnly: true, checks }, 'Scoped edit runtime conformance report');
}
