import assert from 'node:assert/strict';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function assertDeepImmutableJson(value, path = '$') {
  if (value === null || typeof value !== 'object') {
    assert.notEqual(typeof value, 'function', `${path} must not contain functions`);
    return;
  }
  assert.equal(value instanceof Map, false, `${path} must not expose Map`);
  assert.equal(value instanceof Set, false, `${path} must not expose Set`);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepImmutableJson(child, `${path}.${key}`);
  }
}

function ownerState(fixture, overrides = {}) {
  return {
    session: fixture.session,
    evidenceModel: fixture.evidenceModel,
    indexes: fixture.indexes,
    confirmedConstruction: fixture.confirmedConstruction || null,
    supportProjection: fixture.supportProjection || null,
    visibleProjection: 'ISO',
    constructionCandidateSelection: '',
    engineeringSceneSelection: '',
    reviewQueueSelection: '',
    inspectorSelection: '',
    ...overrides,
  };
}

const blocked = blockedSequentialFixture();
let currentState = null;
let publish = null;
const bridge = createSequentialEngineeringSvgOwnerBridge({
  readOwnerState: () => currentState,
  registerPublisher(value) { publish = value; },
});
const events = [];
const unsubscribe = bridge.subscribe((event) => events.push(event));

assert.equal(bridge.schema, 'SequentialEngineeringSvgOwnerBridge.v1');
assert.deepEqual(Object.keys(bridge).sort(), ['destroy', 'getSnapshot', 'schema', 'subscribe']);
assert.equal('publishSettledTransition' in bridge, false);
assert.equal(typeof publish, 'function');
assert.equal(bridge.getSnapshot(), null);

const inspected = publish('source-inspected');
assert.deepEqual(inspected, {
  schema: 'SequentialEngineeringSvgOwnerEvent.v1',
  reason: 'source-inspected',
  snapshot: null,
});
assert.equal('revision' in inspected, false);
assert.equal(events.length, 1);
assertDeepImmutableJson(inspected);
assert.throws(
  () => publish('branch-opened'),
  /requires a valid session-bearing snapshot/,
);
assert.equal(events.length, 1, 'invalid pre-session publication must emit zero events');

currentState = ownerState(blocked);
const opened = publish('branch-opened');
assert.equal(events.length, 2);
assert.equal(opened.snapshot.schema, 'SequentialEngineeringSvgOwnerSnapshot.v1');
assert.equal(opened.snapshot.session.schema, 'SequentialConstructionSession.v1');
assert.equal(opened.snapshot.indexProjection.schema, 'SequentialEngineeringSvgIndexProjection.v1');
assert.equal(opened.snapshot.constructionCandidateSelection, null);
assert.equal(opened.snapshot.engineeringSceneSelection, null);
assert.equal(opened.snapshot.reviewQueueSelection, null);
assert.equal(opened.snapshot.inspectorSelection, null);
assertDeepImmutableJson(opened.snapshot);

const revision = opened.snapshot.revision;
currentState = ownerState(blocked, {
  visibleProjection: 'XZ',
  constructionCandidateSelection: blocked.session.currentDecisionRequest.candidates[0].candidateId,
  inspectorSelection: blocked.session.currentDecisionRequest.candidates[0].candidateId,
});
const projected = publish('projection-changed');
assert.deepEqual(projected.snapshot.revision, revision);
const selected = publish('selection-changed');
assert.deepEqual(selected.snapshot.revision, revision);
assert.equal(
  selected.snapshot.constructionCandidateSelection,
  blocked.session.currentDecisionRequest.candidates[0].candidateId,
);
assert.equal(selected.snapshot.engineeringSceneSelection, null);
assert.equal(selected.snapshot.reviewQueueSelection, null);

const support = confirmedSupportSequentialFixture();
currentState = ownerState(support);
const completed = publish('route-complete');
assert.equal(
  completed.snapshot.confirmedConstructionFingerprint,
  support.confirmedConstruction.constructionFingerprint,
);
assert.equal(
  completed.snapshot.supportConstructionFingerprint,
  support.supportProjection.constructionFingerprint,
);

currentState = ownerState(blocked, {
  confirmedConstruction: support.confirmedConstruction,
  supportProjection: null,
});
assert.throws(
  () => publish('construction-advanced'),
  /does not match the current Sequential session/,
);
assert.equal(events.length, 5, 'stale confirmed construction must emit zero events');

currentState = ownerState(support, {
  supportProjection: {
    ...support.supportProjection,
    constructionFingerprint: 'stale-support-fingerprint',
  },
});
assert.throws(
  () => publish('support-refreshed'),
  /not fingerprint-matched/,
);
assert.equal(events.length, 5, 'stale support projection must emit zero events');

currentState = null;
const reloaded = publish('source-reloaded');
assert.equal(reloaded.snapshot, null);
assert.equal(events.length, 6);
assert.equal(bridge.getSnapshot(), null, 'reload must invalidate the former session');
assert.throws(
  () => publish('selection-changed'),
  /requires a valid session-bearing snapshot/,
);
assert.equal(events.length, 6);

unsubscribe();
unsubscribe();
currentState = ownerState(blocked);
publish('branch-opened');
assert.equal(events.length, 6, 'unsubscribed listener must receive no event');
assert.equal(bridge.destroy(), true);
assert.equal(bridge.destroy(), false);
assert.equal(bridge.getSnapshot(), null);
assert.equal(publish('branch-opened'), null);
assert.throws(() => bridge.subscribe(() => {}), /destroyed/);

const remounted = createSequentialEngineeringSvgOwnerBridge({
  readOwnerState: () => null,
});
assert.equal(remounted.getSnapshot(), null);
assert.equal(remounted.destroy(), true);

console.log('Sequential Engineering SVG owner bridge: ok');
