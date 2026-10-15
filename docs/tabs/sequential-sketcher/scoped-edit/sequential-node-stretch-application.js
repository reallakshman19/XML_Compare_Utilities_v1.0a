/** Supervised prepare/accept service for one qualified certified-node stretch. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
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
import {
  SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA,
} from './sequential-geometry-edit-boundary.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { createSequentialNodeStretchDraftStore } from './sequential-node-stretch-draft.js';
import { validateSequentialNodeStretchTarget } from './sequential-node-stretch-target.js';

export const SEQUENTIAL_PREPARED_NODE_STRETCH_SCHEMA = 'SequentialPreparedNodeStretch.v1';
export const SEQUENTIAL_NODE_STRETCH_ACCEPTANCE_SCHEMA = 'SequentialNodeStretchAcceptance.v1';
export const SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION = Object.freeze({
  PREVIEW_INVALID: 'SEQUENTIAL_NODE_STRETCH_PREVIEW_INVALID',
  TARGET_INELIGIBLE: 'SEQUENTIAL_NODE_STRETCH_TARGET_INELIGIBLE',
  AUTHORITY_STALE: 'SEQUENTIAL_NODE_STRETCH_AUTHORITY_STALE',
  PREPARED_INVALID: 'SEQUENTIAL_NODE_STRETCH_PREPARED_INVALID',
  PUBLICATION_FAILED: 'SEQUENTIAL_NODE_STRETCH_PUBLICATION_FAILED',
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
  if (!result) fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PREVIEW_INVALID,
    `${label} is required.`, TypeError);
  return result;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Node stretch clock must return an exact ISO timestamp.');
  return value;
}
function validatePreview(preview, target) {
  if (preview?.schema !== 'SequentialNodeStretchDraft.v1'
    || preview.publicationState !== 'NOT_PUBLISHED') {
    fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PREVIEW_INVALID,
      'Node stretch requires one exact non-published preview.', TypeError);
  }
  const store = createSequentialNodeStretchDraftStore();
  try {
    const rebuilt = store.stage({
      target,
      targetPosition: preview.targetPosition,
      profile: preview.profile,
      operationId: preview.operationId,
    });
    if (!sameSequentialContractValue(rebuilt, preview)) {
      fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PREVIEW_INVALID,
        'Node stretch preview differs from canonical regeneration.');
    }
  } finally { store.destroy(); }
  return preview;
}
function currentTarget(preview, view) {
  const target = validateSequentialNodeStretchTarget(preview.target, {
    selection: preview.target.selection,
    readModel: view.readModel,
    scene: view.scene,
  });
  return { target, topology: createSequentialEditableTopologySnapshot(view.readModel) };
}
function assertEligible(preview, target, topology) {
  const node = topology.nodes.find((row) => row.nodeId === target.nodeId);
  if (!node || preview.noChange || preview.delta.magnitude <= 0
    || node.boundaryClass === 'EXTERNAL_BOUNDARY'
    || node.boundaryClass === 'REPAIR_BOUNDARY'
    || !sameSequentialContractValue([...node.portIds].sort(), [...target.portIds].sort())) {
    fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.TARGET_INELIGIBLE,
      'Stretch application requires one current non-zero qualified port-bearing node.');
  }
  return node;
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
  const geometryParts = topology.geometryParts.filter((row) => partIds.has(row.geometryPartId))
    .map((row) => ({ geometryPartId: row.geometryPartId,
      geometry: row.geometry, nodeIds: row.nodeIds }));
  const ports = topology.ports.filter((row) => portIds.has(row.portId))
    .map((row) => ({ portId: row.portId, position: row.position }));
  const node = topology.nodes.find((row) => row.nodeId === target.nodeId);
  return { geometryParts, ports, nodes: [{ nodeId: node.nodeId, position: node.position }] };
}
function afterEvidence(preview, before) {
  const byPart = new Map(preview.geometryParts.map((row) => (
    [row.geometryPartId, row.draftGeometry]
  )));
  return {
    geometryParts: before.geometryParts.map((row) => ({
      geometryPartId: row.geometryPartId,
      geometry: byPart.get(row.geometryPartId),
      nodeIds: row.nodeIds,
    })),
    ports: before.ports.map((row) => ({
      portId: row.portId, position: preview.targetPosition,
    })),
    nodes: before.nodes.map((row) => ({
      nodeId: row.nodeId, position: preview.targetPosition,
    })),
  };
}
function stretchAncestry(preview, target) {
  return {
    authorityId: target.authorityId,
    selectionId: target.selectionId,
    snapshotFingerprint: target.snapshotFingerprint,
    topologyFingerprint: target.topologyFingerprint,
    geometryFingerprint: target.geometryFingerprint,
    sceneRevision: target.sceneRevision,
    draftFingerprint: preview.draftFingerprint,
  };
}
function entryEvidence(preview, target, topology, operator) {
  const before = beforeEvidence(target, topology);
  return {
    type: SEQUENTIAL_GEOMETRY_EDIT_TYPE.STRETCH_NODE,
    componentId: target.selectedComponentId,
    nodeId: target.nodeId,
    affectedComponentIds: target.affectedComponentIds,
    targetId: target.stretchTargetId,
    operationId: preview.operationId,
    eligibilityId: target.eligibilityId,
    rawDelta: preview.delta,
    delta: preview.delta,
    targetPosition: preview.targetPosition,
    profile: preview.profile,
    snapSelection: null,
    before,
    after: afterEvidence(preview, before),
    ancestry: stretchAncestry(preview, target),
    operator,
  };
}
function candidateEvidence(view, journal, entry, expectedHead) {
  const baseTopology = createSequentialEditableTopologySnapshot(view.baseReadModel);
  const readModel = createSequentialEffectiveGeometryReadModel(view.baseReadModel, journal);
  const scene = applySequentialGeometryEditJournalToScene(view.baseScene, journal, {
    revision: readModel.revision,
    sceneId: readModel.sceneId,
  });
  const topology = applySequentialGeometryEditJournalToTopology(baseTopology, journal);
  return immutableJson({
    schema: SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA,
    expectedJournalHeadFingerprint: expectedHead,
    journal,
    entry,
    effectiveReadAuthorityId: readModel.authorityId,
    effectiveSceneFingerprint: sequentialSemanticFingerprint('SSKGEOMETRYSCENE', scene),
    effectiveTopologyFingerprint: topology.effectiveGeometryFingerprint,
  }, 'Sequential prepared node stretch candidate');
}
function preparedMaterial(preview, expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_NODE_STRETCH_SCHEMA,
    preview, expectedAuthority, candidate };
}
function validatePrepared(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_NODE_STRETCH_SCHEMA) {
    fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PREPARED_INVALID,
      `Prepared stretch must use ${SEQUENTIAL_PREPARED_NODE_STRETCH_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.preview, value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSK3OSTRETCHPREP', material)) {
    fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PREPARED_INVALID,
      'Prepared stretch differs from canonical evidence regeneration.');
  }
  return value;
}
function prepareStretch(runtime, previewInput, operatorInput = {}) {
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
    preparedId: sequentialSemanticFingerprint('SSK3OSTRETCHPREP', material),
    publicationState: 'NOT_PUBLISHED',
  }, 'Sequential prepared node stretch');
}
function acceptance(prepared, accepted, publication = null) {
  return immutableJson({
    schema: SEQUENTIAL_NODE_STRETCH_ACCEPTANCE_SCHEMA,
    accepted,
    reasonCode: accepted ? null : SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.AUTHORITY_STALE,
    preparedId: prepared.preparedId,
    publicationState: accepted ? 'COMMITTED' : 'NOT_PUBLISHED',
    publication,
  }, 'Sequential node stretch acceptance');
}
function acceptStretch(runtime, preparedInput) {
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
    fail(SEQUENTIAL_NODE_STRETCH_APPLICATION_REJECTION.PUBLICATION_FAILED,
      error?.message || String(error), Error);
  }
}
export function createSequentialNodeStretchApplicationService(options = {}) {
  const runtime = {
    readCurrentState: requiredFunction(options.readCurrentState, 'readCurrentState'),
    readView: requiredFunction(options.readView, 'readView'),
    readJournal: requiredFunction(options.readJournal, 'readJournal'),
    publishCandidate: requiredFunction(options.publishCandidate, 'publishCandidate'),
    now: requiredFunction(options.now, 'now'),
  };
  return Object.freeze({
    schema: 'SequentialNodeStretchApplicationService.v1',
    prepare: (preview, operator) => prepareStretch(runtime, preview, operator),
    accept: (prepared) => acceptStretch(runtime, prepared),
  });
}

export const _test = Object.freeze({ assertEligible, entryEvidence, validatePrepared, validatePreview });
