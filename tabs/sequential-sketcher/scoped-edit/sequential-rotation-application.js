/** Supervised prepare/accept service for one qualified component or subgraph rotation. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  appendSequentialGeometryEdit,
  SEQUENTIAL_GEOMETRY_EDIT_TYPE,
} from './sequential-geometry-edit-journal.js';
import {
  applySequentialGeometryEditJournalToScene,
  applySequentialGeometryEditJournalToTopology,
} from './sequential-geometry-edit-projection.js';
import { createSequentialEffectiveGeometryReadModel } from './sequential-effective-geometry-read-model.js';
import { SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA } from './sequential-geometry-edit-boundary.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { createSequentialRotationDraftStore } from './sequential-rotation-draft.js';
import { validateSequentialRotationTarget } from './sequential-rotation-target.js';

export const SEQUENTIAL_PREPARED_ROTATION_SCHEMA = 'SequentialPreparedRotation.v1';
export const SEQUENTIAL_ROTATION_ACCEPTANCE_SCHEMA = 'SequentialRotationAcceptance.v1';
export const SEQUENTIAL_ROTATION_APPLICATION_REJECTION = Object.freeze({
  PREVIEW_INVALID: 'SEQUENTIAL_ROTATION_PREVIEW_INVALID',
  TARGET_INELIGIBLE: 'SEQUENTIAL_ROTATION_TARGET_INELIGIBLE',
  AUTHORITY_STALE: 'SEQUENTIAL_ROTATION_AUTHORITY_STALE',
  PREPARED_INVALID: 'SEQUENTIAL_ROTATION_PREPARED_INVALID',
  PUBLICATION_FAILED: 'SEQUENTIAL_ROTATION_PUBLICATION_FAILED',
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
  if (!result) fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PREVIEW_INVALID,
    `${label} is required.`, TypeError);
  return result;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Rotation clock must return an exact ISO timestamp.');
  return value;
}
function validatePreview(preview, target) {
  if (preview?.schema !== 'SequentialRotationDraft.v1'
    || preview.publicationState !== 'NOT_PUBLISHED') {
    fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PREVIEW_INVALID,
      'Rotation requires one exact non-published preview.', TypeError);
  }
  const store = createSequentialRotationDraftStore();
  try {
    const rebuilt = store.stage({
      target, pivot: preview.transform.pivot, axis: preview.transform.axis,
      angleDegrees: preview.transform.angleDegrees, profile: preview.transform.profile,
      operationId: preview.operationId,
    });
    if (!sameSequentialContractValue(rebuilt, preview)) {
      fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PREVIEW_INVALID,
        'Rotation preview differs from canonical regeneration.');
    }
  } finally { store.destroy(); }
  return preview;
}
function currentTarget(preview, view) {
  const target = validateSequentialRotationTarget(preview.target, {
    readModel: view.readModel, scene: view.scene,
  });
  return { target, topology: createSequentialEditableTopologySnapshot(view.readModel) };
}
function assertEligible(preview, target, topology) {
  const currentIds = topology.components.filter((row) => target.affectedComponentIds.includes(row.componentId))
    .map((row) => row.componentId).sort();
  if (!target.rotationEligible || target.locks.length || preview.noChange
    || preview.previewDisposition !== 'PREVIEW_ONLY_ROTATION_CLEAR'
    || preview.boundaryDiagnosis.aggregateDisposition !== 'PRESERVED'
    || !sameSequentialContractValue(currentIds, target.affectedComponentIds)) {
    fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.TARGET_INELIGIBLE,
      'Rotation application requires a current non-zero boundary-compatible eligible target.');
  }
  return currentIds;
}
function operatorRecord(input, appliedAt) {
  return {
    actorId: text(input?.actorId, 'actorId'),
    reason: text(input?.reason, 'reason'),
    evidenceNote: String(input?.evidenceNote || '').trim() || null,
    appliedAt,
  };
}
function beforeEvidence(target, topology) {
  const partIds = new Set(target.geometryPartIds);
  const portIds = new Set(target.portIds);
  const nodeIds = new Set(target.nodeIds);
  return {
    geometryParts: topology.geometryParts.filter((row) => partIds.has(row.geometryPartId))
      .map((row) => ({ geometryPartId: row.geometryPartId,
        geometry: row.geometry, nodeIds: row.nodeIds })),
    ports: topology.ports.filter((row) => portIds.has(row.portId))
      .map((row) => ({ portId: row.portId, position: row.position })),
    nodes: topology.nodes.filter((row) => nodeIds.has(row.nodeId))
      .map((row) => ({ nodeId: row.nodeId, position: row.position })),
  };
}
function afterEvidence(preview, before) {
  const parts = new Map(preview.geometryParts.map((row) => [row.geometryPartId, row]));
  const ports = new Map(preview.ports.map((row) => [row.portId, row.position]));
  const nodes = new Map(preview.nodes.map((row) => [row.nodeId, row.position]));
  return {
    geometryParts: before.geometryParts.map((row) => ({
      geometryPartId: row.geometryPartId,
      geometry: parts.get(row.geometryPartId)?.draftGeometry,
      nodeIds: row.nodeIds,
    })),
    ports: before.ports.map((row) => ({ portId: row.portId, position: ports.get(row.portId) })),
    nodes: before.nodes.map((row) => ({ nodeId: row.nodeId, position: nodes.get(row.nodeId) })),
  };
}
function rotationAncestry(preview, target) {
  return {
    authorityId: target.authorityId,
    snapshotFingerprint: target.snapshotFingerprint,
    topologyFingerprint: target.topologyFingerprint,
    geometryFingerprint: target.geometryFingerprint,
    geometryEditJournalFingerprint: target.geometryEditJournalFingerprint,
    sceneRevision: target.sceneRevision,
    targetFingerprint: target.rotationTargetId,
    draftFingerprint: preview.draftFingerprint,
  };
}
function entryEvidence(preview, target, topology, operator) {
  const before = beforeEvidence(target, topology);
  const transform = preview.transform;
  return {
    type: SEQUENTIAL_GEOMETRY_EDIT_TYPE.ROTATE_SUBGRAPH,
    componentId: target.seedComponentId,
    seedComponentId: target.seedComponentId,
    scope: target.scope,
    affectedComponentIds: target.affectedComponentIds,
    targetId: target.rotationTargetId,
    operationId: preview.operationId,
    eligibilityId: target.eligibilityIds[0] || target.rotationTargetId,
    rawDelta: { x: 0, y: 0, z: 0 },
    delta: { x: 0, y: 0, z: 0 },
    pivot: transform.pivot, axis: transform.axis,
    angleDegrees: transform.angleDegrees, angleRadians: transform.angleRadians,
    transformFingerprint: transform.transformFingerprint,
    profile: transform.profile,
    boundaryDiagnosis: preview.boundaryDiagnosis,
    snapSelection: null,
    before, after: afterEvidence(preview, before),
    ancestry: rotationAncestry(preview, target), operator,
  };
}
function candidateEvidence(view, journal, entry, expectedHead) {
  const baseTopology = createSequentialEditableTopologySnapshot(view.baseReadModel);
  const readModel = createSequentialEffectiveGeometryReadModel(view.baseReadModel, journal);
  const scene = applySequentialGeometryEditJournalToScene(view.baseScene, journal, {
    revision: readModel.revision, sceneId: readModel.sceneId,
  });
  const topology = applySequentialGeometryEditJournalToTopology(baseTopology, journal);
  return immutableJson({
    schema: SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA,
    expectedJournalHeadFingerprint: expectedHead,
    journal, entry,
    effectiveReadAuthorityId: readModel.authorityId,
    effectiveSceneFingerprint: sequentialSemanticFingerprint('SSKGEOMETRYSCENE', scene),
    effectiveTopologyFingerprint: topology.effectiveGeometryFingerprint,
  }, 'Sequential prepared rotation candidate');
}
function preparedMaterial(preview, expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_ROTATION_SCHEMA, preview, expectedAuthority, candidate };
}
function validatePrepared(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_ROTATION_SCHEMA) {
    fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PREPARED_INVALID,
      `Prepared rotation must use ${SEQUENTIAL_PREPARED_ROTATION_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.preview, value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSK3PROTATIONPREP', material)) {
    fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PREPARED_INVALID,
      'Prepared rotation differs from canonical evidence regeneration.');
  }
  return value;
}
function prepareRotation(runtime, previewInput, operatorInput = {}) {
  const view = runtime.readView();
  const current = currentTarget(previewInput, view);
  const preview = validatePreview(previewInput, current.target);
  assertEligible(preview, current.target, current.topology);
  const journal = runtime.readJournal();
  const expectedAuthority = deriveSequentialEditAuthority(runtime.readCurrentState());
  const evidence = entryEvidence(preview, current.target, current.topology,
    operatorRecord(operatorInput, exactNow(runtime.now)));
  const appended = appendSequentialGeometryEdit(
    journal, evidence, createSequentialEditableTopologySnapshot(view.baseReadModel),
  );
  const candidate = candidateEvidence(view, appended.journal, appended.entry,
    journal.headFingerprint);
  const material = preparedMaterial(preview, expectedAuthority, candidate);
  return immutableJson({
    ...material,
    preparedId: sequentialSemanticFingerprint('SSK3PROTATIONPREP', material),
    publicationState: 'NOT_PUBLISHED',
  }, 'Sequential prepared rotation');
}
function acceptance(prepared, accepted, publication = null) {
  return immutableJson({
    schema: SEQUENTIAL_ROTATION_ACCEPTANCE_SCHEMA,
    accepted,
    reasonCode: accepted ? null : SEQUENTIAL_ROTATION_APPLICATION_REJECTION.AUTHORITY_STALE,
    preparedId: prepared.preparedId,
    publicationState: accepted ? 'COMMITTED' : 'NOT_PUBLISHED',
    publication,
  }, 'Sequential rotation acceptance');
}
function acceptRotation(runtime, preparedInput) {
  const prepared = validatePrepared(preparedInput);
  const currentAuthority = deriveSequentialEditAuthority(runtime.readCurrentState());
  if (!sameSequentialContractValue(currentAuthority, prepared.expectedAuthority)) {
    return acceptance(prepared, false);
  }
  try {
    const publication = runtime.publishCandidate({
      preparedId: prepared.preparedId,
      expectedAuthority: prepared.expectedAuthority,
      candidate: prepared.candidate,
    });
    return acceptance(prepared, true, publication);
  } catch (error) {
    fail(SEQUENTIAL_ROTATION_APPLICATION_REJECTION.PUBLICATION_FAILED,
      error?.message || String(error), Error);
  }
}
export function createSequentialRotationApplicationService(options = {}) {
  const runtime = {
    readCurrentState: requiredFunction(options.readCurrentState, 'readCurrentState'),
    readView: requiredFunction(options.readView, 'readView'),
    readJournal: requiredFunction(options.readJournal, 'readJournal'),
    publishCandidate: requiredFunction(options.publishCandidate, 'publishCandidate'),
    now: requiredFunction(options.now, 'now'),
  };
  return Object.freeze({
    schema: 'SequentialRotationApplicationService.v1',
    prepare: (preview, operator) => prepareRotation(runtime, preview, operator),
    accept: (prepared) => acceptRotation(runtime, prepared),
  });
}
export const _test = Object.freeze({ assertEligible, entryEvidence, validatePrepared, validatePreview });
