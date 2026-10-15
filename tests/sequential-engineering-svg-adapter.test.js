import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import { runEngineeringSvgAdapterConformance } from '../core/engineering-svg/engineering-svg-adapter-conformance.js';
import { createSequentialEngineeringSvgAdapter } from '../tabs/sequential-sketcher/sequential-engineering-svg-adapter.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  adapterState,
  blockedSequentialFixture,
  rejectedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function geometryLedger(scene) {
  return scene.entities.map((entity) => ({ id: entity.id, geometry: entity.geometry }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function bridgeSnapshot(fixture, visibleProjection = 'ISO') {
  const legacy = adapterState(fixture, visibleProjection);
  const bridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({
      ...legacy,
      visibleProjection,
      constructionCandidateSelection: '',
      engineeringSceneSelection: '',
      reviewQueueSelection: '',
      inspectorSelection: '',
    }),
  });
  const snapshot = bridge.getSnapshot();
  bridge.destroy();
  return snapshot;
}

const blocked = blockedSequentialFixture();
let currentState = bridgeSnapshot(blocked, 'ISO');
const listeners = new Set();
const before = JSON.stringify(blocked.session);
const sequentialAdapter = createSequentialEngineeringSvgAdapter({
  adapterId: 'ssk-fixture-adapter',
  sceneId: 'ssk-fixture-scene',
  getState: () => currentState,
  subscribeState(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
});

assert.equal(sequentialAdapter.schema, 'SequentialEngineeringSvgAdapter.v1');
assert.equal(sequentialAdapter.adapter.descriptor.accessMode, 'read-only');
assert.deepEqual(sequentialAdapter.adapter.descriptor.capabilities, {
  selection: true, properties: true, parity: true, editing: false,
});
assert.equal(sequentialAdapter.adapter.commandGateway, null);
assert.deepEqual(sequentialAdapter.adapter.snapProviders, []);
assert.equal('advanceConstruction' in sequentialAdapter, false);
assert.equal('applyConstructionDecision' in sequentialAdapter, false);

const conformance = await runEngineeringSvgAdapterConformance(sequentialAdapter.adapter);
assert.equal(conformance.passed, true, JSON.stringify(conformance.checks));
assert.equal(listeners.size, 0, 'conformance bridge must clean up its subscription');
assert.equal(JSON.stringify(blocked.session), before, 'adapter conformance must not mutate construction');

const scene = await sequentialAdapter.adapter.getScene();
const ids = scene.entities.map((entity) => entity.id);
const properties = await sequentialAdapter.adapter.propertyProvider.getPropertySets(ids, scene.revision);
assert.deepEqual(properties.map((set) => set.ownerIds[0]), ids);
assert(properties.every((set) => set.fields.every((field) => field.editable === false)));
const candidateSet = properties.find((set) => set.ownerIds[0].startsWith('ssk:candidate:'));
assert(candidateSet.fields.some((field) => field.key === 'candidateStatus' && field.value === 'NOT_CONFIRMED'));
const activeSet = properties.find((set) => set.ownerIds[0].startsWith('ssk:port:'));
assert(activeSet.fields.some((field) => field.key === 'portId' && field.value === blocked.session.activeExitPortId));

await assert.rejects(
  sequentialAdapter.adapter.propertyProvider.getPropertySets(ids.slice(0, 1), createEngineeringRevisionToken({ stale: true })),
  /stale domain revision/,
);

const events = [];
const unsubscribe = sequentialAdapter.adapter.subscribeScene((event) => events.push(event));
assert.equal(listeners.size, 1);
currentState = bridgeSnapshot(blocked, 'XZ');
for (const listener of listeners) listener({
  schema: 'SequentialEngineeringSvgOwnerEvent.v1',
  snapshot: currentState,
  reason: 'projection-changed',
});
assert.equal(events.length, 1);
assert.equal(events[0].reason, 'projection-changed');
assert.deepEqual(geometryLedger(events[0].scene), geometryLedger(scene));
for (const listener of listeners) listener({
  schema: 'SequentialEngineeringSvgOwnerEvent.v1',
  snapshot: null,
  reason: 'source-reloaded',
});
assert.equal(events.length, 1, 'pre-session owner events must not emit an invalid scene');
unsubscribe();
assert.equal(listeners.size, 0);

const rejected = rejectedSequentialFixture();
currentState = bridgeSnapshot(rejected);
const rejectedScene = await sequentialAdapter.adapter.getScene();
assert.notDeepEqual(rejectedScene.revision, scene.revision);
assert(rejectedScene.entities.some((entity) => entity.domainRef.category === 'rejectedCandidate'));

console.log('Sequential engineering SVG adapter conformance: ok');
