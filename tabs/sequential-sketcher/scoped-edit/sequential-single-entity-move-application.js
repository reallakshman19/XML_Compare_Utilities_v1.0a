/** Supervised prepare/accept service for topology-preserving component move publication. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import {
  appendSequentialGeometryEdit,
} from './sequential-geometry-edit-journal.js';
import {
  applySequentialGeometryEditJournalToScene,
  applySequentialGeometryEditJournalToTopology,
} from './sequential-geometry-edit-projection.js';
import { createSequentialEffectiveGeometryReadModel } from './sequential-effective-geometry-read-model.js';
import {
  SEQUENTIAL_PREPARED_GEOMETRY_MOVE_CANDIDATE_SCHEMA,
} from './sequential-geometry-edit-boundary.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { createSequentialSingleEntityMoveDraftStore } from './sequential-single-entity-move-draft.js';
import { validateSequentialSingleEntityMoveTarget } from './sequential-single-entity-move-target.js';

export const SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA =
  'SequentialPreparedGeometryMove.v1';
export const SEQUENTIAL_GEOMETRY_MOVE_ACCEPTANCE_SCHEMA =
  'SequentialGeometryMoveAcceptance.v1';
export const SEQUENTIAL_GEOMETRY_MOVE_REJECTION = Object.freeze({
  PREVIEW_INVALID: 'SEQUENTIAL_GEOMETRY_MOVE_PREVIEW_INVALID',
  TARGET_INELIGIBLE: 'SEQUENTIAL_GEOMETRY_MOVE_TARGET_INELIGIBLE',
  AUTHORITY_STALE: 'SEQUENTIAL_GEOMETRY_MOVE_AUTHORITY_STALE',
  PREPARED_INVALID: 'SEQUENTIAL_GEOMETRY_MOVE_PREPARED_INVALID',
  PUBLICATION_FAILED: 'SEQUENTIAL_GEOMETRY_MOVE_PUBLICATION_FAILED',
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
  if (!result) fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PREVIEW_INVALID,
    `${label} is required.`, TypeError);
  return result;
}
function exactNow(now) {
  const value = now();
  if (!isIsoTimestamp(value)) throw new TypeError('Geometry move clock must return an exact ISO timestamp.');
  return value;
}
function add(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}
function validatePreview(preview, target) {
  if (preview?.schema !== 'SequentialSingleEntityMoveDraft.v1'
    || preview.publicationState !== 'NOT_PUBLISHED') {
    fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PREVIEW_INVALID,
      'Geometry move requires one exact non-published move preview.', TypeError);
  }
  const store = createSequentialSingleEntityMoveDraftStore();
  try {
    const rebuilt = store.stage({
      target,
      constraint: preview.constraint,
      rawDelta: preview.rawDelta,
      delta: preview.delta,
      operationId: preview.operationId,
      interaction: preview.interaction,
      snapSelection: preview.snapSelection,
    });
    if (!sameSequentialContractValue(rebuilt, preview)) {
      fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PREVIEW_INVALID,
        'Move preview differs from canonical regeneration.');
    }
  } finally { store.destroy(); }
  return preview;
}
function currentTarget(preview, view) {
  const target = validateSequentialSingleEntityMoveTarget(preview.target, {
    readModel: view.readModel,
    scene: view.scene,
  });
  return { target, topology: createSequentialEditableTopologySnapshot(view.readModel) };
}
function assertEligible(preview, target, topology) {
  const component = topology.components.find((row) => row.componentId === target.componentId);
  if (!component || !target.rigidMoveEligible || target.boundaryCuts.length
    || component.supportAttachmentIds.length || preview.noChange
    || preview.delta.magnitude <= 0
    || preview.boundaryDiagnosis.aggregateDisposition !== 'PRESERVED') {
    fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.TARGET_INELIGIBLE,
      'Move application requires one non-zero isolated unsupported rigid component with preserved boundaries.');
  }
  return component;
}
function entryEvidence(preview, target, topology, component, operator) {
  const partIds = new Set(component.geometryPartIds);
  const portIds = new Set(component.portIds);
  const nodeIds = new Set(component.nodeIds);
  const beforeParts = topology.geometryParts.filter((row) => partIds.has(row.geometryPartId))
    .map((row) => ({ geometryPartId: row.geometryPartId, geometry: row.geometry }));
  const afterByPart = new Map(preview.geometryParts.map((row) => [row.geometryPartId, row.draftGeometry]));
  const beforePorts = topology.ports.filter((row) => portIds.has(row.portId))
    .map((row) => ({ portId: row.portId, position: row.position }));
  const beforeNodes = topology.nodes.filter((row) => nodeIds.has(row.nodeId))
    .map((row) => ({ nodeId: row.nodeId, position: row.position }));
  return {
    componentId: target.componentId,
    targetId: target.moveTargetId,
    operationId: preview.operationId,
    eligibilityId: target.eligibilityId,
    rawDelta: preview.rawDelta,
    delta: preview.delta,
    snapSelection: preview.snapSelection,
    before: { geometryParts: beforeParts, ports: beforePorts, nodes: beforeNodes },
    after: {
      geometryParts: beforeParts.map((row) => ({
        geometryPartId: row.geometryPartId,
        geometry: afterByPart.get(row.geometryPartId),
      })),
      ports: beforePorts.map((row) => ({ portId: row.portId, position: add(row.position, preview.delta) })),
      nodes: beforeNodes.map((row) => ({ nodeId: row.nodeId, position: add(row.position, preview.delta) })),
    },
    ancestry: {
      authorityId: target.authorityId,
      snapshotFingerprint: target.snapshotFingerprint,
      topologyFingerprint: target.topologyFingerprint,
      geometryFingerprint: target.geometryFingerprint,
      sceneRevision: target.sceneRevision,
      draftFingerprint: preview.draftFingerprint,
    },
    operator,
  };
}
function operatorRecord(input, appliedAt) {
  return {
    actorId: text(input?.actorId, 'actorId'),
    reason: text(input?.reason, 'reason'),
    evidenceNote: String(input?.evidenceNote || '').trim() || null,
    appliedAt,
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
    schema: SEQUENTIAL_PREPARED_GEOMETRY_MOVE_CANDIDATE_SCHEMA,
    expectedJournalHeadFingerprint: expectedHead,
    journal,
    entry,
    effectiveReadAuthorityId: readModel.authorityId,
    effectiveSceneFingerprint: sequentialSemanticFingerprint('SSKGEOMETRYSCENE', scene),
    effectiveTopologyFingerprint: topology.effectiveGeometryFingerprint,
  }, 'Sequential prepared geometry move candidate');
}
function preparedMaterial(preview, expectedAuthority, candidate) {
  return { schema: SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA,
    preview, expectedAuthority, candidate };
}
function validatePrepared(value) {
  if (value?.schema !== SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA) {
    fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PREPARED_INVALID,
      `Prepared move must use ${SEQUENTIAL_PREPARED_GEOMETRY_MOVE_SCHEMA}.`, TypeError);
  }
  const material = preparedMaterial(value.preview, value.expectedAuthority, value.candidate);
  if (value.preparedId !== sequentialSemanticFingerprint('SSKGEOMETRYMOVEPREP', material)) {
    fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PREPARED_INVALID,
      'Prepared move differs from canonical evidence regeneration.');
  }
  return value;
}
function prepareMove(runtime, previewInput, operatorInput = {}) {
  const view = runtime.readView();
  const current = currentTarget(previewInput, view);
  const preview = validatePreview(previewInput, current.target);
  const component = assertEligible(preview, current.target, current.topology);
  const journal = runtime.readJournal();
  const expectedAuthority = deriveSequentialEditAuthority(runtime.readCurrentState());
  const evidence = entryEvidence(preview, current.target, current.topology, component,
    operatorRecord(operatorInput, exactNow(runtime.now)));
  const appended = appendSequentialGeometryEdit(
    journal,
    evidence,
    createSequentialEditableTopologySnapshot(view.baseReadModel),
  );
  const candidate = candidateEvidence(view, appended.journal, appended.entry,
    journal.headFingerprint);
  const material = preparedMaterial(preview, expectedAuthority, candidate);
  return immutableJson({
    ...material,
    preparedId: sequentialSemanticFingerprint('SSKGEOMETRYMOVEPREP', material),
    publicationState: 'NOT_PUBLISHED',
  }, 'Sequential prepared geometry move');
}
function staleAcceptance(prepared) {
  return immutableJson({
    schema: SEQUENTIAL_GEOMETRY_MOVE_ACCEPTANCE_SCHEMA,
    accepted: false,
    reasonCode: SEQUENTIAL_GEOMETRY_MOVE_REJECTION.AUTHORITY_STALE,
    preparedId: prepared.preparedId,
    publicationState: 'NOT_PUBLISHED',
    publication: null,
  }, 'Sequential geometry move acceptance');
}
function acceptedRecord(prepared, publication) {
  return immutableJson({
    schema: SEQUENTIAL_GEOMETRY_MOVE_ACCEPTANCE_SCHEMA,
    accepted: true,
    reasonCode: null,
    preparedId: prepared.preparedId,
    publicationState: 'COMMITTED',
    publication,
  }, 'Sequential geometry move acceptance');
}
function acceptMove(runtime, preparedInput) {
  const prepared = validatePrepared(preparedInput);
  const currentAuthority = deriveSequentialEditAuthority(runtime.readCurrentState());
  if (!sameSequentialContractValue(currentAuthority, prepared.expectedAuthority)) {
    return staleAcceptance(prepared);
  }
  try {
    const publication = runtime.publishCandidate({
      preparedId: prepared.preparedId,
      expectedAuthority: prepared.expectedAuthority,
      candidate: prepared.candidate,
    });
    return acceptedRecord(prepared, publication);
  } catch (error) {
    fail(SEQUENTIAL_GEOMETRY_MOVE_REJECTION.PUBLICATION_FAILED,
      error?.message || String(error), Error);
  }
}
export function createSequentialSingleEntityMoveApplicationService(options = {}) {
  const runtime = {
    readCurrentState: requiredFunction(options.readCurrentState, 'readCurrentState'),
    readView: requiredFunction(options.readView, 'readView'),
    readJournal: requiredFunction(options.readJournal, 'readJournal'),
    publishCandidate: requiredFunction(options.publishCandidate, 'publishCandidate'),
    now: requiredFunction(options.now, 'now'),
  };
  return Object.freeze({
    schema: 'SequentialSingleEntityMoveApplicationService.v1',
    prepare: (preview, operator) => prepareMove(runtime, preview, operator),
    accept: (prepared) => acceptMove(runtime, prepared),
  });
}

export const _test = Object.freeze({
  assertEligible, candidateEvidence, entryEvidence, validatePrepared, validatePreview,
});
