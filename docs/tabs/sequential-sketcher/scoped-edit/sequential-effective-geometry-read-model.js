/** Independently regenerable effective read authority layered over a certified base read model. */
import { createEngineeringRevisionToken } from '../../../core/engineering-scene/index.js';
import { immutableJson } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { assertSequentialGeometryEditJournal } from './sequential-geometry-edit-journal.js';

export const SEQUENTIAL_EFFECTIVE_GEOMETRY_READ_MODEL_SCHEMA =
  'SequentialEffectiveGeometryReadModel.v1';

function assertBase(value) {
  if (value?.schema !== 'SequentialScopedEditReadModel.v1'
    || value.geometryEditJournal || value.baseReadModel) {
    throw new TypeError('Effective geometry authority requires one base Sequential read model.');
  }
  return value;
}
function effectiveRevision(base, journal) {
  return createEngineeringRevisionToken({
    schema: SEQUENTIAL_EFFECTIVE_GEOMETRY_READ_MODEL_SCHEMA,
    baseRevision: base.revision,
    geometryEditJournalHeadFingerprint: journal.headFingerprint,
  });
}
function authorityId(base, journal, revision) {
  return sequentialSemanticFingerprint('SSKGEOMETRYREAD', {
    baseAuthorityId: base.authorityId,
    branchId: base.branchId,
    revision,
    geometryEditJournalHeadFingerprint: journal.headFingerprint,
  });
}
export function createSequentialEffectiveGeometryReadModel(baseInput, journalInput) {
  const base = assertBase(baseInput);
  const journal = assertSequentialGeometryEditJournal(journalInput);
  if (journal.branchId !== base.branchId
    || journal.confirmedConstructionFingerprint !== base.confirmedConstructionFingerprint) {
    throw new RangeError('Geometry journal does not match the base read-model branch authority.');
  }
  const revision = effectiveRevision(base, journal);
  const id = authorityId(base, journal, revision);
  return immutableJson({
    ...base,
    authorityId: id,
    sceneId: `sequential-scoped-edit:${base.branchId}:${id}`,
    revision,
    baseReadModel: base,
    geometryEditJournal: journal,
    geometryEditJournalFingerprint: journal.headFingerprint,
    effectiveGeometrySchema: SEQUENTIAL_EFFECTIVE_GEOMETRY_READ_MODEL_SCHEMA,
    selectionSnapshot: {
      ...base.selectionSnapshot,
      authorityId: id,
    },
  }, 'Sequential effective geometry read model');
}
export function isSequentialEffectiveGeometryReadModel(value) {
  return value?.schema === 'SequentialScopedEditReadModel.v1'
    && value?.effectiveGeometrySchema === SEQUENTIAL_EFFECTIVE_GEOMETRY_READ_MODEL_SCHEMA
    && value?.geometryEditJournal?.schema === 'SequentialGeometryEditJournal.v1';
}
export function assertSequentialEffectiveGeometryReadModel(value) {
  if (!isSequentialEffectiveGeometryReadModel(value)) {
    throw new TypeError(`Effective geometry read model must use ${SEQUENTIAL_EFFECTIVE_GEOMETRY_READ_MODEL_SCHEMA}.`);
  }
  const rebuilt = createSequentialEffectiveGeometryReadModel(
    value.baseReadModel,
    value.geometryEditJournal,
  );
  if (!sameSequentialContractValue(rebuilt, value)) {
    throw new RangeError('Effective geometry read model differs from canonical regeneration.');
  }
  return rebuilt;
}
