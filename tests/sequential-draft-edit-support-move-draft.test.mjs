import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../core/engineering-scene/index.js';
import {
  composeSequentialSupportMoveDraftScene,
  createSequentialDraftEditSupportMoveDraftStore,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-support-move-draft.js';
import { _test as visual } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-visual-model.js';

const REVISION = createEngineeringRevisionToken({ support: 'REV-3H' });
const ENTITY_ID = 'ssk:support:SUPPORT-3H';
const ORIGINAL = Object.freeze({ x: 250, y: 0, z: 0 });
const TARGET = Object.freeze({
  schema: 'SequentialDraftEditSupportMoveTarget.v1',
  authorityId: 'SAUTH-3H', readAuthorityId: 'READ-3H', branchId: '/SSK/3H',
  sceneRevision: REVISION, supportId: 'SUPPORT-3H', familyId: 'FAMILY-3H',
  carrierId: 'PIPE-3H', entityId: ENTITY_ID, originalPosition: ORIGINAL,
  supportMoveTargetId: 'SSK3D-SUPPORT-MOVE-TARGET-3H',
});
function input(position) {
  return {
    target: TARGET, position,
    actorId: 'operator-3h', reason: 'Preview exact support relocation.',
    evidenceNote: 'Requested coordinates checked against the support layout.',
  };
}
function scene() {
  return createEngineeringScene({
    sceneId: 'scene-3h', revision: REVISION,
    entities: [createEngineeringSceneEntity({
      id: ENTITY_ID, kind: 'point', domainType: 'SEQUENTIAL_CONFIRMED_SUPPORT',
      geometry: createPointGeometry(ORIGINAL),
      domainRef: {
        owner: 'sequential-sketcher', category: 'support', supportId: 'SUPPORT-3H',
        familyId: 'FAMILY-3H', carrierId: 'PIPE-3H',
      },
      editCapabilities: ['MOVE_DRAFT'], propertySetIds: [], layer: 'sequential-support',
      metadata: { sequential: { category: 'support', status: 'RESOLVED' } },
    })],
  });
}

{
  const store = createSequentialDraftEditSupportMoveDraftStore();
  const originalTarget = JSON.stringify(TARGET);
  const preview = store.stage(input({ x: '260', y: '5', z: '-10' }));
  assert.equal(preview.schema, 'SequentialDraftEditSupportMovePreview.v1');
  assert.equal(preview.intent.type, 'MOVE_ENTITY');
  assert.deepEqual(preview.intent.entityIds, [ENTITY_ID]);
  assert.deepEqual(preview.draftPosition, { x: 260, y: 5, z: -10 });
  assert.deepEqual(preview.delta, { x: 10, y: 5, z: -10, magnitude: 15 });
  assert.equal(preview.publicationState, 'NOT_PUBLISHED');
  assert.equal(preview.draft.geometry[ENTITY_ID].original.kind, 'point');
  assert.equal(preview.draft.geometry[ENTITY_ID].draft.kind, 'point');
  assert.equal(JSON.stringify(TARGET), originalTarget);
  assert(Object.isFrozen(preview));
  assert.equal('commit' in store, false);

  const overlay = composeSequentialSupportMoveDraftScene(scene(), store.getDraft());
  const ghost = overlay.entities.find((row) => row.metadata.engineeringSvgOverlay?.type === 'ghost');
  const draft = overlay.entities.find((row) => row.metadata.engineeringSvgOverlay?.type === 'draft');
  assert(ghost); assert(draft);
  assert.deepEqual(ghost.geometry.position, ORIGINAL);
  assert.deepEqual(draft.geometry.position, { x: 260, y: 5, z: -10 });
  assert.equal(visual.marker(ghost).label, 'ORIGINAL SUPPORT');
  assert.equal(visual.marker(draft).label, 'DRAFT SUPPORT');
  assert.notEqual(visual.marker(ghost).colorInt, visual.marker(draft).colorInt);

  store.cancel('operator-cancel');
  assert.equal(store.getDraft().operationId, null);
  assert.equal(store.getPreview(), null);
  store.destroy();
}

for (const [position, pattern] of [
  [{ x: '', y: 0, z: 0 }, /X is required/],
  [{ x: 'not-a-number', y: 0, z: 0 }, /X must be finite/],
  [ORIGINAL, /must differ/],
]) {
  const store = createSequentialDraftEditSupportMoveDraftStore();
  assert.throws(() => store.stage(input(position)), pattern);
  assert.equal(store.getDraft().operationId, null);
  store.destroy();
}

for (const patch of [
  { actorId: '' }, { reason: '' }, { evidenceNote: '' },
]) {
  const store = createSequentialDraftEditSupportMoveDraftStore();
  assert.throws(() => store.stage({ ...input({ x: 251, y: 0, z: 0 }), ...patch }), /required/);
  assert.equal(store.getDraft().operationId, null);
  store.destroy();
}

console.log('Sequential SSK-TS-3H support move draft preview: ok');
