/** Certified immutable Sequential owner snapshot for the Draft Edit host. */
import { freezeJsonValue } from '../../../core/engineering-scene/engineering-json-value.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/engineering-contract-validation.js';
import { classifySequentialEngineeringSvgAuthority } from '../sequential-engineering-svg-authority.js';
import { buildSequentialEngineeringSvgScene } from '../sequential-engineering-svg-scene.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';
import {
  assertSequentialEffectiveGeometryReadModel,
  isSequentialEffectiveGeometryReadModel,
} from './sequential-effective-geometry-read-model.js';
import {
  assertSequentialEffectiveTopologyReadModel,
  isSequentialEffectiveTopologyReadModel,
} from './sequential-effective-topology-read-model.js';

export const SEQUENTIAL_SCOPED_EDIT_READ_MODEL_V1 = 'SequentialScopedEditReadModel.v1';
export const SEQUENTIAL_SCOPED_EDIT_SELECTION_V1 = 'SequentialScopedEditSelection.v1';
export const SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION = Object.freeze({
  SNAPSHOT_INVALID: 'SEQUENTIAL_READ_MODEL_SNAPSHOT_INVALID',
  AUTHORITY_MISMATCH: 'SEQUENTIAL_READ_MODEL_AUTHORITY_MISMATCH',
  SCENE_MISMATCH: 'SEQUENTIAL_READ_MODEL_SCENE_MISMATCH',
});

function fail(code, message, Constructor = TypeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredSnapshot(value) {
  if (value?.schema !== 'SequentialEngineeringSvgOwnerSnapshot.v1') {
    fail(SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION.SNAPSHOT_INVALID,
      'Sequential read model requires SequentialEngineeringSvgOwnerSnapshot.v1.');
  }
  return value;
}
function authorityMaterial(snapshot) {
  const authority = classifySequentialEngineeringSvgAuthority(snapshot);
  const matches = sameSequentialContractValue(authority.revision, snapshot.revision)
    && authority.sessionFingerprint === snapshot.sessionFingerprint
    && authority.confirmedConstructionFingerprint === snapshot.confirmedConstructionFingerprint
    && authority.supportConstructionFingerprint === snapshot.supportConstructionFingerprint
    && authority.supportProjectionFingerprint === snapshot.supportProjectionFingerprint
    && authority.supportAdjustmentRegisterFingerprint
      === snapshot.supportAdjustmentRegisterFingerprint;
  if (!matches) fail(SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
    'Sequential owner snapshot does not match independently derived construction authority.', RangeError);
  return authority;
}
function deriveAuthorityId(snapshot, authority) {
  return sequentialSemanticFingerprint('SSK3DREAD', {
    revision: snapshot.revision,
    branchId: authority.session.rootBranchId,
    sessionFingerprint: authority.sessionFingerprint,
    confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
    supportConstructionFingerprint: authority.supportConstructionFingerprint,
    supportProjectionFingerprint: authority.supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: authority.supportAdjustmentRegisterFingerprint,
  });
}
function sceneId(snapshot, authorityId) {
  return `sequential-scoped-edit:${snapshot.session.rootBranchId}:${authorityId}`;
}
function selectionCandidates(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return [text, `ssk:candidate:${text}`, `ssk:reversal:${text}`,
    `ssk:component:${text}`, `ssk:support:${text}`, `ssk:repair:${text}`,
    `ssk:port:${text}`];
}
function selectionSnapshot(snapshot, scene, authorityId) {
  const available = new Set(scene.entities.map((entity) => entity.id));
  const sourceValues = [
    snapshot.engineeringSceneSelection,
    snapshot.constructionCandidateSelection,
    snapshot.reviewQueueSelection,
    snapshot.inspectorSelection,
  ];
  const entityIds = [...new Set(sourceValues.flatMap(selectionCandidates)
    .filter((id) => available.has(id)))].sort();
  return freezeJsonValue({
    schema: SEQUENTIAL_SCOPED_EDIT_SELECTION_V1,
    authorityId,
    entityIds,
  });
}
function buildCertified(snapshotInput) {
  const snapshot = requiredSnapshot(snapshotInput);
  const authority = authorityMaterial(snapshot);
  const authorityId = deriveAuthorityId(snapshot, authority);
  const id = sceneId(snapshot, authorityId);
  const built = buildSequentialEngineeringSvgScene(snapshot, {
    sceneId: id,
    visibleProjection: snapshot.visibleProjection,
  });
  const scene = validateEngineeringScene(built.scene);
  if (scene.sceneId !== id || !sameSequentialContractValue(scene.revision, snapshot.revision)
    || !sameSequentialContractValue(built.authority, authority)) {
    fail(SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION.SCENE_MISMATCH,
      'Sequential scene does not match the certified owner-snapshot authority.', RangeError);
  }
  return freezeJsonValue({
    schema: SEQUENTIAL_SCOPED_EDIT_READ_MODEL_V1,
    authorityId,
    sceneId: id,
    branchId: authority.session.rootBranchId,
    sessionState: authority.state,
    revision: snapshot.revision,
    sessionFingerprint: authority.sessionFingerprint,
    confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
    supportConstructionFingerprint: authority.supportConstructionFingerprint,
    supportProjectionFingerprint: authority.supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: authority.supportAdjustmentRegisterFingerprint,
    ownerSnapshot: snapshot,
    selectionSnapshot: selectionSnapshot(snapshot, scene, authorityId),
    parity: built.parity,
  });
}

export function deriveSequentialScopedEditAuthorityId(snapshotInput) {
  const snapshot = requiredSnapshot(snapshotInput);
  return deriveAuthorityId(snapshot, authorityMaterial(snapshot));
}
export function createSequentialScopedEditReadModel(snapshot) {
  return buildCertified(snapshot);
}
export function assertSequentialScopedEditReadModel(value) {
  if (isSequentialEffectiveTopologyReadModel(value)) {
    return assertSequentialEffectiveTopologyReadModel(value);
  }
  if (isSequentialEffectiveGeometryReadModel(value)) {
    return assertSequentialEffectiveGeometryReadModel(value);
  }
  if (value?.schema !== SEQUENTIAL_SCOPED_EDIT_READ_MODEL_V1) {
    fail(SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION.SNAPSHOT_INVALID,
      `Sequential read model must use ${SEQUENTIAL_SCOPED_EDIT_READ_MODEL_V1}.`);
  }
  const rebuilt = buildCertified(value.ownerSnapshot);
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail(SEQUENTIAL_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
      'Sequential read model differs from independent owner-snapshot regeneration.', RangeError);
  }
  return rebuilt;
}
