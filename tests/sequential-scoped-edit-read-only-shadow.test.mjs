import assert from 'node:assert/strict';
import { createEngineeringScopeRequest } from '../core/engineering-scope/engineering-scope-contracts.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import {
  SEQUENTIAL_READ_ONLY_COMMAND_DENIED,
  STALE_SEQUENTIAL_READ_ONLY_HOST,
  createSequentialScopedEditProductionShadow,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-only-index.js';
import {
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function ownerState(fixture, selection = '') {
  return {
    session: fixture.session,
    evidenceModel: fixture.evidenceModel,
    indexes: fixture.indexes,
    confirmedConstruction: fixture.confirmedConstruction || null,
    supportProjection: fixture.supportProjection || null,
    visibleProjection: 'ISO',
    constructionCandidateSelection: selection,
    engineeringSceneSelection: '',
    reviewQueueSelection: '',
    inspectorSelection: selection,
  };
}

let current = null;
let publish = null;
const bridge = createSequentialEngineeringSvgOwnerBridge({
  readOwnerState: () => current,
  registerPublisher(value) { publish = value; },
});
const diagnostics = [];
const shadow = createSequentialScopedEditProductionShadow({
  snapshotProvider: bridge.getSnapshot,
  subscribe: bridge.subscribe,
  onDiagnostic: (value) => diagnostics.push(value),
});

assert.equal(shadow.evidence().status, 'IDLE');
assert.equal(shadow.host(), null);

const blocked = blockedSequentialFixture();
current = ownerState({ ...blocked, session: blocked.initial });
publish('branch-opened');
assert.equal(shadow.evidence().status, 'MOUNTED');
assert.equal(shadow.host().scene().entities.length, 0,
  'a valid open branch must mount even before visible entities exist');
assert.deepEqual(shadow.evidence().lastDiagnostic.mount, {
  authorityId: shadow.readModel().authorityId,
  sceneHash: shadow.evidence().lastDiagnostic.mount.sceneHash,
  scopeHash: shadow.evidence().lastDiagnostic.mount.scopeHash,
  entityCount: 0,
  mountedCount: 0,
});
const emptyHost = shadow.host();

const candidateId = blocked.session.currentDecisionRequest.candidates[0].candidateId;
current = ownerState(blocked, candidateId);
publish('construction-advanced');
assert.equal(shadow.evidence().status, 'MOUNTED');
assert.equal(shadow.readModel().schema, 'SequentialScopedEditReadModel.v1');
assert.deepEqual(shadow.readModel().selectionSnapshot.entityIds, [`ssk:candidate:${candidateId}`]);
assert.throws(() => emptyHost.scene(), /destroyed/);

const firstHost = shadow.host();
const scene = firstHost.scene();
assert.equal(scene.sceneId, shadow.readModel().sceneId);
assert(scene.entities.some((entity) => entity.id === `ssk:candidate:${candidateId}`));
const request = createEngineeringScopeRequest({
  schema: 'EngineeringScopeRequest.v1',
  kind: 'SELECTION',
  boundaryPolicy: 'FROZEN',
  elementBudget: scene.entities.length,
  selection: { entityIds: [`ssk:candidate:${candidateId}`], closureDepth: 0 },
});
const scope = firstHost.resolveScope(request);
assert.deepEqual(scope.entityIds, [`ssk:candidate:${candidateId}`]);
assert.equal(firstHost.entityGeometry(`ssk:candidate:${candidateId}`).entityId, `ssk:candidate:${candidateId}`);
assert.throws(() => firstHost.appendEditCommand(), (error) => error.code === SEQUENTIAL_READ_ONLY_COMMAND_DENIED);

current = ownerState(blocked);
publish('selection-changed');
const host = shadow.host();
assert.notEqual(host, firstHost, 'selection-only owner changes must remount the read-only shadow');
assert.deepEqual(shadow.readModel().selectionSnapshot.entityIds, []);
assert.throws(() => firstHost.scene(), /destroyed/);

const supported = confirmedSupportSequentialFixture();
current = ownerState(supported);
assert.throws(() => host.scene(), (error) => error.code === STALE_SEQUENTIAL_READ_ONLY_HOST);
publish('route-complete');
assert.equal(shadow.evidence().status, 'MOUNTED');
assert.notEqual(shadow.host(), host);
assert(shadow.host().scene().entities.some((entity) => entity.domainType === 'SEQUENTIAL_CONFIRMED_SUPPORT'));

current = null;
publish('source-reloaded');
assert.equal(shadow.evidence().status, 'IDLE');
assert.equal(shadow.host(), null);
assert(diagnostics.length >= 4);

assert.equal(shadow.destroy().status, 'DESTROYED');
assert.equal(shadow.destroy().status, 'DESTROYED');
bridge.destroy();
console.log('Sequential SSK-TS-1B read-only Draft Edit shadow: ok');
