import assert from 'node:assert/strict';
import { createScopedEditRuntime } from '../core/scoped-edit-runtime/index.js';
import { createScopedEditRuntimeFixture } from './fixtures/scoped-edit-runtime-fixture.js';

const counts = { FROZEN: 0, GHOSTED: 0, PROPAGATE: 0 };
const variants = { FROZEN: new Set(), GHOSTED: new Set(), PROPAGATE: new Set() };
const hostVariants = { FROZEN: new Set(), GHOSTED: new Set(), PROPAGATE: new Set() };
let inputMutations = 0;

function runtimeFor(fixture) {
  return createScopedEditRuntime({
    host: fixture.host, scopeRequest: fixture.scopeRequest,
    reducerRegistry: fixture.reducerRegistry, journalProjection: fixture.journalProjection,
  });
}

function prepare(policy) {
  const fixture = createScopedEditRuntimeFixture({ boundaryPolicy: policy });
  const runtime = runtimeFor(fixture), request = fixture.dragRequest('E-01'), ray = fixture.validRay('E-01');
  const envelope = fixture.envelope(1, 'ENTITY_POSITION_SET', 'E-01', [110, 0, 0]);
  const targets = ['X-01', 'E-01', 'B-01'];
  const before = JSON.stringify({ scene: fixture.scene, scopeRequest: fixture.scopeRequest,
    projection: fixture.journalProjection, request, ray, envelope, targets });
  runtime.beginDrag({ entityId: 'E-01', dragRequest: request });
  const drag = runtime.solveDrag(ray);
  assert.equal(drag.valid, true);
  const proposal = runtime.prepareCommit({ commandName: 'ENTITY_POSITION_SET', targetIds: targets, envelope });
  if (before !== JSON.stringify({ scene: fixture.scene, scopeRequest: fixture.scopeRequest,
    projection: fixture.journalProjection, request, ray, envelope, targets })) inputMutations += 1;
  return { fixture, runtime, proposal, envelope };
}

for (const policy of ['FROZEN', 'GHOSTED']) {
  for (let index = 0; index < 1000; index += 1) {
    const { fixture, runtime, proposal } = prepare(policy);
    assert.equal(proposal.status, 'REJECTED');
    assert.equal(proposal.rejectionCode, `BOUNDARY_${policy}`);
    assert.equal(proposal.boundaryDecision.allowed, false);
    assert.deepEqual(proposal.boundaryDecision.escapingIds, ['B-01', 'X-01']);
    assert.deepEqual(proposal.journalProjection, fixture.journalProjection);
    assert.deepEqual(proposal.replayState, runtime.getState().replayState);
    const evidence = fixture.readEvidence();
    assert.equal(evidence.appendCalls, 0);
    assert.equal(evidence.reducerCalls, 0);
    variants[policy].add(JSON.stringify(proposal));
    hostVariants[policy].add(JSON.stringify(evidence));
    counts[policy] += 1;
  }
  assert.equal(variants[policy].size, 1);
  assert.equal(hostVariants[policy].size, 1);
}

for (let index = 0; index < 1000; index += 1) {
  const { fixture, runtime, proposal, envelope } = prepare('PROPAGATE');
  assert.equal(proposal.status, 'PREPARED');
  assert.equal(proposal.boundaryDecision.allowed, true);
  assert.deepEqual(proposal.boundaryDecision.escapingIds, ['B-01', 'X-01']);
  assert.deepEqual(proposal.targetIds, ['B-01', 'E-01', 'X-01']);
  const result = runtime.commitPrepared();
  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.commandId, envelope.commandId);
  assert.deepEqual(result.boundaryDecision.escapingIds, ['B-01', 'X-01']);
  assert.deepEqual(runtime.getState().lastBoundaryDecision.escapingIds, ['B-01', 'X-01']);
  const evidence = fixture.readEvidence();
  assert.equal(evidence.appendCalls, 1);
  assert.equal(evidence.reducerCalls, 1);
  variants.PROPAGATE.add(JSON.stringify(result));
  hostVariants.PROPAGATE.add(JSON.stringify(evidence));
  counts.PROPAGATE += 1;
}
assert.equal(variants.PROPAGATE.size, 1);
assert.equal(hostVariants.PROPAGATE.size, 1);
assert.equal(inputMutations, 0);
assert.deepEqual(counts, { FROZEN: 1000, GHOSTED: 1000, PROPAGATE: 1000 });
console.log('[PASS] scoped-edit boundary: FROZEN=1000, GHOSTED=1000, PROPAGATE=1000; escaping-ID delta=0; mutations=0.');
