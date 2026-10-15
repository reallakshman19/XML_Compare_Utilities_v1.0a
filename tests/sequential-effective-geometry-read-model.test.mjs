import assert from 'node:assert/strict';
import { createEngineeringRevisionToken } from '../core/engineering-scene/index.js';
import {
  createSequentialGeometryEditJournal,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js';
import {
  assertSequentialEffectiveGeometryReadModel,
  createSequentialEffectiveGeometryReadModel,
  isSequentialEffectiveGeometryReadModel,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-effective-geometry-read-model.js';

const base = Object.freeze({
  schema: 'SequentialScopedEditReadModel.v1', authorityId: 'BASE-AUTH',
  sceneId: 'BASE-SCENE', branchId: '/EFFECTIVE/READ',
  revision: createEngineeringRevisionToken('BASE-R1'),
  confirmedConstructionFingerprint: 'CONFIRMED-READ',
  selectionSnapshot: Object.freeze({
    schema: 'SequentialScopedEditSelection.v1', authorityId: 'BASE-AUTH', entityIds: [],
  }),
});
const journal = createSequentialGeometryEditJournal({
  branchId: base.branchId,
  confirmedConstructionFingerprint: base.confirmedConstructionFingerprint,
  baseFingerprint: 'BASE-GEOMETRY-FINGERPRINT',
});
const effective = createSequentialEffectiveGeometryReadModel(base, journal);
assert.equal(effective.schema, 'SequentialScopedEditReadModel.v1');
assert.equal(effective.effectiveGeometrySchema, 'SequentialEffectiveGeometryReadModel.v1');
assert.equal(effective.geometryEditJournalFingerprint, journal.headFingerprint);
assert.equal(effective.selectionSnapshot.authorityId, effective.authorityId);
assert.notEqual(effective.authorityId, base.authorityId);
assert(isSequentialEffectiveGeometryReadModel(effective));
assert.deepEqual(assertSequentialEffectiveGeometryReadModel(effective), effective);
assert.deepEqual(createSequentialEffectiveGeometryReadModel(base, journal), effective,
  'effective read authority must be deterministic');
assert.throws(() => createSequentialEffectiveGeometryReadModel({
  ...base, branchId: '/OTHER/BRANCH',
}, journal), /does not match the base read-model branch authority/);
assert.throws(() => assertSequentialEffectiveGeometryReadModel({
  ...effective, authorityId: 'TAMPERED',
}), /differs from canonical regeneration/);
console.log('Sequential effective geometry read model: ok');
