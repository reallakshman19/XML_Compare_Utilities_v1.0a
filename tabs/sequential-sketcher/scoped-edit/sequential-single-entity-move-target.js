/** Exact whole-component target resolution for Sequential move preview. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA =
  'SequentialSingleEntityMoveTarget.v1';
export const SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION = Object.freeze({
  TARGET_NOT_FOUND: 'SEQUENTIAL_MOVE_PREVIEW_TARGET_NOT_FOUND',
  TARGET_LOCKED: 'SEQUENTIAL_MOVE_PREVIEW_TARGET_LOCKED',
  TYPE_UNSUPPORTED: 'SEQUENTIAL_MOVE_PREVIEW_TYPE_UNSUPPORTED',
  GEOMETRY_INCOMPLETE: 'SEQUENTIAL_MOVE_PREVIEW_GEOMETRY_INCOMPLETE',
});

const SUPPORTED_TYPES = new Set([
  'PIPE', 'ELBOW', 'TEE', 'OLET', 'REDUCER', 'VALVE', 'FLANGE',
  'GASKET', 'INSTRUMENT', 'COUPLING', 'UNION', 'CAP', 'BLIND',
]);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function selectionEvidence(snapshot, objectId) {
  const candidate = snapshot.selectionCandidates.find((row) => row.sceneEntityId === objectId);
  if (!candidate) fail(
    SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TARGET_NOT_FOUND,
    `Confirmed move-preview selection was not found: ${objectId}`,
  );
  const group = snapshot.selectionGroups.find((row) => (
    row.selectionGroupId === candidate.selectionGroupId
  ));
  const component = snapshot.components.find((row) => (
    row.componentId === candidate.resolvedComponentId
  ));
  const eligibility = snapshot.eligibility.find((row) => (
    row.targetKind === 'COMPONENT' && row.componentId === candidate.resolvedComponentId
  ));
  if (!group || !component || !eligibility) fail(
    SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TARGET_NOT_FOUND,
    `Move-preview ownership evidence is incomplete: ${objectId}`,
  );
  return { candidate, group, component, eligibility };
}
function assertEligible(component, eligibility) {
  if (!SUPPORTED_TYPES.has(component.canonicalType)) fail(
    SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TYPE_UNSUPPORTED,
    `Move preview does not support ${component.canonicalType}.`,
  );
  if (eligibility.locks.length) fail(
    SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.TARGET_LOCKED,
    `Move-preview target is locked: ${eligibility.locks.join(', ')}.`,
  );
}
function geometryParts(scene, group, componentId) {
  const byId = new Map(scene.entities.map((row) => [row.id, row]));
  const parts = group.geometryPartIds.map((geometryPartId) => byId.get(geometryPartId));
  if (parts.some((row) => !row?.geometry || row.domainRef?.componentId !== componentId)) fail(
    SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_REJECTION.GEOMETRY_INCOMPLETE,
    `Whole-component scene geometry is incomplete: ${componentId}`,
  );
  return parts.map((entity) => ({
    geometryPartId: entity.id,
    role: entity.domainRef?.geometryRole || 'primary',
    geometry: entity.geometry,
  }));
}
function boundaryCuts(snapshot, componentId) {
  const ports = new Map(snapshot.ports.map((row) => [row.portId, row]));
  return snapshot.componentBoundaryCuts
    .filter((row) => row.componentId === componentId)
    .map((row) => ({
      ...row,
      selectedPosition: ports.get(row.selectedPortId)?.position || null,
      stationaryPosition: ports.get(row.stationaryPortId)?.position || null,
    }));
}
function targetMaterial(input, snapshot, scene) {
  const objectId = requiredContractText(input.objectId, 'move-preview objectId');
  const selected = selectionEvidence(snapshot, objectId);
  assertEligible(selected.component, selected.eligibility);
  const parts = geometryParts(scene, selected.group, selected.component.componentId);
  const cuts = boundaryCuts(snapshot, selected.component.componentId);
  return {
    schema: SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA,
    objectId,
    componentId: selected.component.componentId,
    canonicalType: selected.component.canonicalType,
    selectionGroupId: selected.group.selectionGroupId,
    geometryPartIds: selected.group.geometryPartIds,
    geometryParts: parts,
    componentPortIds: selected.component.portIds,
    componentNodeIds: selected.component.nodeIds,
    supportAttachmentIds: selected.component.supportAttachmentIds,
    boundaryCuts: cuts,
    authorityId: input.readModel.authorityId,
    sceneRevision: scene.revision,
    snapshotFingerprint: snapshot.snapshotFingerprint,
    topologyFingerprint: snapshot.topologyFingerprint,
    geometryFingerprint: snapshot.geometryFingerprint,
    eligibilityId: selected.eligibility.eligibilityId,
    rigidMoveEligible: selected.eligibility.capabilities.includes('RIGID_MOVE_ELIGIBLE'),
    previewDisposition: cuts.length
      ? 'BOUNDARY_DISCONNECTION_REVIEW_REQUIRED'
      : 'RIGID_MOVE_PREVIEW_CLEAR',
  };
}
function targetIdentity(material) {
  return {
    componentId: material.componentId,
    selectionGroupId: material.selectionGroupId,
    authorityId: material.authorityId,
    snapshotFingerprint: material.snapshotFingerprint,
    geometryFingerprint: material.geometryFingerprint,
    eligibilityId: material.eligibilityId,
  };
}
export function selectSequentialSingleEntityMoveTarget(input = {}) {
  const snapshot = createSequentialEditableTopologySnapshot(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene),
    input.readModel,
  );
  const material = targetMaterial(input, snapshot, scene);
  return immutableJson({
    ...material,
    moveTargetId: sequentialSemanticFingerprint('SSK3LMOVETARGET', targetIdentity(material)),
  }, 'Sequential single-entity move target');
}
export function validateSequentialSingleEntityMoveTarget(target, input = {}) {
  if (target?.schema !== SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA) {
    throw new TypeError(`Move-preview target must use ${SEQUENTIAL_SINGLE_ENTITY_MOVE_TARGET_SCHEMA}.`);
  }
  const rebuilt = selectSequentialSingleEntityMoveTarget({ ...input, objectId: target.objectId });
  if (!sameSequentialContractValue(rebuilt, target)) {
    throw new RangeError('Move-preview target differs from current topology authority.');
  }
  return rebuilt;
}
