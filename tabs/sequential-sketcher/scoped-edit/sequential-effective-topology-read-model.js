/** Independently regenerable structural read authority layered over current geometry authority. */
import { createEngineeringRevisionToken } from '../../../core/engineering-scene/index.js';
import { immutableJson } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { assertSequentialTopologyEditJournal } from './sequential-topology-edit-journal.js';

export const SEQUENTIAL_EFFECTIVE_TOPOLOGY_READ_MODEL_SCHEMA =
  'SequentialEffectiveTopologyReadModel.v1';
function assertBase(value) {
  if (value?.schema !== 'SequentialScopedEditReadModel.v1'
    || value.effectiveTopologySchema || value.topologyEditJournal) {
    throw new TypeError('Effective topology authority requires one current Sequential read model.');
  }
  return value;
}
function revision(base, journal) {
  return createEngineeringRevisionToken({ schema: SEQUENTIAL_EFFECTIVE_TOPOLOGY_READ_MODEL_SCHEMA,
    baseRevision: base.revision, topologyEditActiveHeadFingerprint: journal.activeHeadFingerprint,
    topologyEditCursor: journal.cursor });
}
function authorityId(base, journal, nextRevision) {
  return sequentialSemanticFingerprint('SSKTOPOLOGYREAD', {
    baseAuthorityId: base.authorityId, branchId: base.branchId, revision: nextRevision,
    topologyEditActiveHeadFingerprint: journal.activeHeadFingerprint,
    topologyEditJournalFingerprint: journal.journalFingerprint,
  });
}
export function createSequentialEffectiveTopologyReadModel(baseInput, journalInput) {
  const base = assertBase(baseInput); const journal = assertSequentialTopologyEditJournal(journalInput);
  if (journal.branchId !== base.branchId || journal.baseAuthorityId !== base.authorityId) {
    throw new RangeError('Topology journal does not match current geometry read authority.');
  }
  const nextRevision = revision(base, journal); const id = authorityId(base, journal, nextRevision);
  return immutableJson({ ...base, authorityId: id,
    sceneId: `sequential-scoped-edit:${base.branchId}:${id}`, revision: nextRevision,
    topologyBaseReadModel: base, topologyEditJournal: journal,
    topologyEditJournalFingerprint: journal.activeHeadFingerprint,
    topologyEditHistoryFingerprint: journal.journalFingerprint,
    effectiveTopologySchema: SEQUENTIAL_EFFECTIVE_TOPOLOGY_READ_MODEL_SCHEMA,
    selectionSnapshot: { ...base.selectionSnapshot, authorityId: id } },
  'Sequential effective topology read model');
}
export function isSequentialEffectiveTopologyReadModel(value) {
  return value?.schema === 'SequentialScopedEditReadModel.v1'
    && value?.effectiveTopologySchema === SEQUENTIAL_EFFECTIVE_TOPOLOGY_READ_MODEL_SCHEMA
    && value?.topologyEditJournal?.schema === 'SequentialTopologyEditJournal.v1';
}
export function assertSequentialEffectiveTopologyReadModel(value) {
  if (!isSequentialEffectiveTopologyReadModel(value)) {
    throw new TypeError(`Effective topology read model must use ${SEQUENTIAL_EFFECTIVE_TOPOLOGY_READ_MODEL_SCHEMA}.`);
  }
  const rebuilt = createSequentialEffectiveTopologyReadModel(
    value.topologyBaseReadModel, value.topologyEditJournal,
  );
  if (!sameSequentialContractValue(rebuilt, value)) {
    throw new RangeError('Effective topology read model differs from canonical regeneration.');
  }
  return rebuilt;
}
