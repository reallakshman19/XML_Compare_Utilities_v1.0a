/** Supervised prepare/accept service for one deterministic straight-pipe split. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { createSequentialEffectiveTopologyReadModel } from './sequential-effective-topology-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from './sequential-scoped-edit-scene-adapter.js';
import { createSequentialPipeSplitDraftStore } from './sequential-pipe-split-draft.js';
import { createSequentialPipeSplitReplacement } from './sequential-pipe-split-identities.js';
import { validateSequentialPipeSplitTarget } from './sequential-pipe-split-target.js';
import { SEQUENTIAL_PREPARED_TOPOLOGY_EDIT_CANDIDATE_SCHEMA } from './sequential-topology-edit-boundary.js';
import { appendSequentialTopologyEdit } from './sequential-topology-edit-journal.js';

export const SEQUENTIAL_PREPARED_PIPE_SPLIT_SCHEMA = 'SequentialPreparedPipeSplit.v1';
export const SEQUENTIAL_PIPE_SPLIT_ACCEPTANCE_SCHEMA = 'SequentialPipeSplitAcceptance.v1';
export const SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION = Object.freeze({
  PREVIEW_INVALID: 'SEQUENTIAL_PIPE_SPLIT_PREVIEW_INVALID',
  TARGET_STALE: 'SEQUENTIAL_PIPE_SPLIT_TARGET_STALE',
  PREPARED_INVALID: 'SEQUENTIAL_PIPE_SPLIT_PREPARED_INVALID',
  AUTHORITY_STALE: 'SEQUENTIAL_PIPE_SPLIT_AUTHORITY_STALE',
  PUBLICATION_FAILED: 'SEQUENTIAL_PIPE_SPLIT_PUBLICATION_FAILED',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PREVIEW_INVALID,
    `${label} is required.`, TypeError);
  return result;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Pipe split clock must return an exact ISO timestamp.');
  return value;
}
function validatePreview(preview, target) {
  if (preview?.schema !== 'SequentialPipeSplitDraft.v1'
    || preview.publicationState !== 'NOT_PUBLISHED') {
    fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PREVIEW_INVALID,
      'Pipe split requires one exact non-published preview.', TypeError);
  }
  const store = createSequentialPipeSplitDraftStore();
  try {
    const rebuilt = store.stage({ target, mode: preview.location.mode,
      parameter: preview.location.parameter, acquiredPoint: preview.location.acquiredPoint,
      minimumEndDistance: preview.location.minimumEndDistance,
      projectionTolerance: preview.location.projectionTolerance,
      operationId: preview.operationId });
    if (!sameSequentialContractValue(rebuilt, preview)) {
      fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PREVIEW_INVALID,
        'Pipe split preview differs from canonical regeneration.');
    }
  } finally { store.destroy(); }
  return preview;
}
function current(preview, view) {
  const target = validateSequentialPipeSplitTarget(preview.target, {
    readModel: view.readModel, scene: view.scene });
  const topology = createSequentialEditableTopologySnapshot(view.readModel);
  if (topology.snapshotFingerprint !== target.snapshotFingerprint) {
    fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.TARGET_STALE,
      'Pipe split topology authority is stale.');
  }
  return { target, topology };
}
function operatorRecord(input, appliedAt) {
  return { actorId: text(input?.actorId, 'actorId'),
    reason: text(input?.reason, 'reason'),
    evidenceNote: String(input?.evidenceNote || '').trim() || null, appliedAt };
}
function ancestry(preview, target) {
  return { authorityId: target.authorityId, splitTargetId: target.splitTargetId,
    snapshotFingerprint: target.snapshotFingerprint,
    topologyFingerprint: target.topologyFingerprint,
    geometryFingerprint: target.geometryFingerprint,
    topologyEditJournalFingerprint: target.topologyEditJournalFingerprint,
    sceneRevision: target.sceneRevision, draftFingerprint: preview.draftFingerprint,
    parentAncestry: target.parentComponent.ancestry };
}
function entryEvidence(preview, target, topology, scene, operator) {
  const replacement = createSequentialPipeSplitReplacement({ preview, target, topology, scene });
  return { type: 'SPLIT_PIPE', operationId: preview.operationId,
    targetId: target.splitTargetId, parentComponentId: target.parentComponentId,
    parentGeometryPartId: target.parentGeometryPartId,
    location: preview.location, identities: preview.identities,
    before: replacement.before, after: replacement.after, scene: replacement.scene,
    ancestry: ancestry(preview, target), operator };
}
function candidateEvidence(view, journal, entry, expectedJournalFingerprint) {
  const readModel = createSequentialEffectiveTopologyReadModel(view.baseReadModel, journal);
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const topology = createSequentialEditableTopologySnapshot(readModel);
  return immutableJson({ schema: SEQUENTIAL_PREPARED_TOPOLOGY_EDIT_CANDIDATE_SCHEMA,
    expectedJournalFingerprint, journal, entry,
    effectiveReadAuthorityId: readModel.authorityId,
    effectiveSceneFingerprint: sequentialSemanticFingerprint('SSKTOPOLOGYSCENE', scene),
    effectiveTopologyFingerprint: topology.topologyFingerprint },
  'Sequential prepared topology edit candidate');
}
function preparedMaterial(preview, expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_PIPE_SPLIT_SCHEMA,
    preview, expectedAuthority, candidate };
}
function validatePrepared(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_PIPE_SPLIT_SCHEMA) {
    fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PREPARED_INVALID,
      `Prepared split must use ${SEQUENTIAL_PREPARED_PIPE_SPLIT_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.preview, value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSK3QSPLITPREP', material)) {
    fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PREPARED_INVALID,
      'Prepared split differs from canonical evidence regeneration.');
  }
  return value;
}
function prepare(runtime, previewInput, operatorInput = {}) {
  const view = runtime.readView(); const data = current(previewInput, view);
  const preview = validatePreview(previewInput, data.target);
  const journal = runtime.readJournal();
  const expectedAuthority = deriveSequentialEditAuthority(runtime.readCurrentState());
  const evidence = entryEvidence(preview, data.target, data.topology, view.scene,
    operatorRecord(operatorInput, exactNow(runtime.now)));
  const appended = appendSequentialTopologyEdit(journal, evidence);
  const candidate = candidateEvidence(view, appended.journal, appended.entry,
    journal.journalFingerprint);
  const material = preparedMaterial(preview, expectedAuthority, candidate);
  return immutableJson({ ...material,
    preparedId: sequentialSemanticFingerprint('SSK3QSPLITPREP', material),
    publicationState: 'NOT_PUBLISHED' }, 'Sequential prepared pipe split');
}
function acceptance(prepared, accepted, publication = null) {
  return immutableJson({ schema: SEQUENTIAL_PIPE_SPLIT_ACCEPTANCE_SCHEMA,
    accepted, reasonCode: accepted ? null
      : SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.AUTHORITY_STALE,
    preparedId: prepared.preparedId,
    publicationState: accepted ? 'COMMITTED' : 'NOT_PUBLISHED', publication },
  'Sequential pipe split acceptance');
}
function accept(runtime, preparedInput) {
  const prepared = validatePrepared(preparedInput);
  const authority = deriveSequentialEditAuthority(runtime.readCurrentState());
  if (!sameSequentialContractValue(authority, prepared.expectedAuthority)) {
    return acceptance(prepared, false);
  }
  try {
    return acceptance(prepared, true, runtime.publishCandidate({
      preparedId: prepared.preparedId, expectedAuthority: prepared.expectedAuthority,
      candidate: prepared.candidate }));
  } catch (error) {
    fail(SEQUENTIAL_PIPE_SPLIT_APPLICATION_REJECTION.PUBLICATION_FAILED,
      error?.message || String(error), Error);
  }
}
export function createSequentialPipeSplitApplicationService(options = {}) {
  const runtime = { readCurrentState: requiredFunction(options.readCurrentState, 'readCurrentState'),
    readView: requiredFunction(options.readView, 'readView'),
    readJournal: requiredFunction(options.readJournal, 'readJournal'),
    publishCandidate: requiredFunction(options.publishCandidate, 'publishCandidate'),
    now: requiredFunction(options.now, 'now') };
  return Object.freeze({ schema: 'SequentialPipeSplitApplicationService.v1',
    prepare: (preview, operator) => prepare(runtime, preview, operator),
    accept: (prepared) => accept(runtime, prepared) });
}
export const _test = Object.freeze({ validatePreview, entryEvidence, validatePrepared });
