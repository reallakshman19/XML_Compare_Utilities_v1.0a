import assert from 'node:assert/strict';
import { _test as shadowTest } from '../tabs/topology-trace-validator/topology-scoped-edit-production-shadow.js';

const zeroEffects = Object.freeze({ sourceMutations: 0, recoveryPersistence: 0, writerAcquisitions: 0,
  productionAcceptance: 0, controllerMutations: 0, rendererRefreshes: 0,
  selectionPublications: 0, domMounts: 0, gestureRegistrations: 0 });
const scene = Object.freeze({ sceneId: 'SCENE', revision: Object.freeze({ value: 'A0' }),
  entities: Object.freeze([{ id: 'N1' }]) });
const scope = Object.freeze({ entityIds: Object.freeze(['N1']), boundaryIds: Object.freeze([]) });
function envelope() {
  return Object.freeze({ commandId: 'C1', commandType: 'TOPOLOGY_COMMAND', sequence: 1,
    documentId: 'D1', sessionId: 'S1', payload: Object.freeze({ nativeCommand: Object.freeze({
      id: 'EC1', type: 'MOVE_NODE', payload: Object.freeze({ nodeId: 'N1', position: { x: 1, y: 0, z: 0 } }) }) }) });
}
function model(authorityId, entries, projection, replay) {
  return Object.freeze({ schema: 'TopologyScopedEditReadModel.v1', authorityId,
    canonicalTopology: Object.freeze({ nodes: Object.freeze([{ id: 'N1' }]), edges: Object.freeze([]),
      supports: Object.freeze([]), rigids: Object.freeze([]), junctions: Object.freeze([]),
      boundaries: Object.freeze([]), bends: Object.freeze([]), pointFeatures: Object.freeze([]) }),
    commandScopeBasis: Object.freeze({ editableEntityIds: Object.freeze(['N1']) }),
    selectionSnapshot: Object.freeze({ entityIds: Object.freeze(['N1']) }),
    commandJournal: Object.freeze({ entries: Object.freeze(entries) }),
    journalProjection: Object.freeze({ projection }), replayState: replay });
}
const baseProjection = Object.freeze({ initialState: Object.freeze({}), envelopes: Object.freeze([]),
  activeCommandIds: Object.freeze([]) });
const nextProjection = Object.freeze({ initialState: Object.freeze({}), envelopes: Object.freeze([envelope()]),
  activeCommandIds: Object.freeze(['C1']) });
const replay0 = Object.freeze({ state: 'A0' }), replay1 = Object.freeze({ state: 'A1' });
const a0 = model('A0', [], baseProjection, replay0), a1 = model('A1', [envelope()], nextProjection, replay1);
let current = a0, liveAuthority = 'A0', mountCount = 0, destroyCount = 0, snapshotCalls = 0;
function composition(readModel, request) {
  mountCount += 1;
  return Object.freeze({ scopeRequest: request,
    directHost: Object.freeze({ scene: () => scene, resolveScope: () => scope,
      entityGeometry: () => Object.freeze({ entityId: 'N1', anchor: Object.freeze([0, 0, 0]) }),
      destroy: () => { destroyCount += 1; return Object.freeze({ destroyed: true }); } }),
    runtimeHost: Object.freeze({ destroy: () => { destroyCount += 1; return Object.freeze({ destroyed: true }); } }),
    runtime: Object.freeze({ getState: () => Object.freeze({ scope }),
      destroy: () => { destroyCount += 1; return Object.freeze({ status: 'DESTROYED' }); } }),
    context: Object.freeze({ scene }), sideEffects: () => zeroEffects, readModel });
}
const factories = Object.freeze({ createReadModel: async (value) => value,
  assertReadModel: async (value) => value,
  createShadow: async ({ readModel, scopeRequest }) => composition(readModel, scopeRequest),
  resolveTargets: () => Object.freeze({ entityIds: Object.freeze(['N1']) }),
  runPositive: () => Object.freeze({ direct: Object.freeze({ evidence: Object.freeze({
    candidateProjection: nextProjection, candidateReplay: replay1,
    projectionHash: 'PH', candidateReplayHash: 'RH' }) }) }) });
const shadow = shadowTest.createWithFactories({ snapshotKeyProvider: () => liveAuthority,
  snapshotProvider: async () => { snapshotCalls += 1; return current; },
  authorityProvider: () => liveAuthority }, {}, factories);
await shadow.observe();
assert.equal(shadow.evidence().status, 'MOUNTED');
await shadow.observe();
assert.equal(snapshotCalls, 1, 'unchanged renders must not rebuild the authority snapshot');
current = a1; liveAuthority = 'A1';
await shadow.observe();
assert.equal(shadow.evidence().lastDiagnostic.transition.status, 'PASS');
assert.equal(shadow.evidence().authorityId, 'A1');
assert(mountCount >= 3, 'expected initial, next and temporary transition mounts');
shadow.destroy();
assert.equal(shadow.evidence().status, 'DESTROYED');
assert(destroyCount >= 3);
console.log('[PASS] P4B remounts on authority change and verifies one accepted native transition');
