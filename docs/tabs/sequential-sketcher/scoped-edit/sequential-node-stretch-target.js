/** Exact component and port-bearing node target resolution for Sequential stretch editing. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_NODE_STRETCH_COMPONENT_SELECTION_SCHEMA =
  'SequentialNodeStretchComponentSelection.v1';
export const SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA = 'SequentialNodeStretchTarget.v1';
export const SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION = Object.freeze({
  OBJECT_INVALID: 'SEQUENTIAL_NODE_STRETCH_OBJECT_INVALID',
  COMPONENT_INVALID: 'SEQUENTIAL_NODE_STRETCH_COMPONENT_INVALID',
  NODE_MISSING: 'SEQUENTIAL_NODE_STRETCH_NODE_MISSING',
  NODE_INELIGIBLE: 'SEQUENTIAL_NODE_STRETCH_NODE_INELIGIBLE',
  SUPPORT_ATTACHED: 'SEQUENTIAL_NODE_STRETCH_SUPPORT_ATTACHED',
  REPAIR_BOUNDARY: 'SEQUENTIAL_NODE_STRETCH_REPAIR_BOUNDARY',
  EXTERNAL_BOUNDARY: 'SEQUENTIAL_NODE_STRETCH_EXTERNAL_BOUNDARY',
  BINDING_INCOMPLETE: 'SEQUENTIAL_NODE_STRETCH_BINDING_INCOMPLETE',
  TARGET_STALE: 'SEQUENTIAL_NODE_STRETCH_TARGET_STALE',
});

const GEOMETRY_KINDS = new Set(['point', 'segment', 'polyline']);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function certifiedInputs(input = {}) {
  const readModel = input.readModel;
  const scene = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene), readModel,
  );
  const topology = createSequentialEditableTopologySnapshot(readModel);
  return { readModel, scene, topology };
}
function selectedEntity(objectId, scene) {
  const id = requiredContractText(objectId, 'stretch selected objectId');
  const entity = scene.entities.find((row) => row.id === id);
  if (entity?.domainRef?.category !== 'confirmed' || !entity.domainRef.componentId) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.OBJECT_INVALID,
      `Stretch selection must reference confirmed component geometry: ${id}`);
  }
  return entity;
}
function componentRecord(entity, topology) {
  const component = topology.components.find((row) => (
    row.componentId === entity.domainRef.componentId
  ));
  if (!component) fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.COMPONENT_INVALID,
    `Canonical component is unavailable: ${entity.domainRef.componentId}`);
  return component;
}
function nodeEligibility(topology, nodeId) {
  return topology.eligibility.find((row) => (
    row.targetKind === 'NODE' && row.targetId === nodeId
  ));
}
function affectedComponents(topology, node) {
  return node.incidentComponentIds.map((componentId) => {
    const component = topology.components.find((row) => row.componentId === componentId);
    if (!component) fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.COMPONENT_INVALID,
      `Incident component is missing: ${componentId}`);
    if (component.supportAttachmentIds.length) {
      fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.SUPPORT_ATTACHED,
        `Stretch node touches a supported component: ${componentId}`);
    }
    return component;
  });
}
function repairLocked(topology, node) {
  const connections = topology.committedConnections.filter((row) => (
    node.committedConnectionIds.includes(row.connectionId)
  ));
  return connections.some((row) => row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY');
}
function geometryPointCount(geometry) {
  if (geometry?.kind === 'point') return 1;
  if (geometry?.kind === 'segment') return 2;
  if (geometry?.kind === 'polyline') return geometry.points?.length || 0;
  return 0;
}
function samePoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.z === right.z);
}
function boundParts(topology, node, components) {
  const componentById = new Map(components.map((row) => [row.componentId, row]));
  const parts = topology.geometryParts.filter((part) => (
    node.incidentGeometryPartIds.includes(part.geometryPartId)
  ));
  const complete = parts.length === node.incidentGeometryPartIds.length
    && parts.every((part) => (
      componentById.has(part.componentId)
        && GEOMETRY_KINDS.has(part.geometry?.kind)
        && part.nodeIds?.length === geometryPointCount(part.geometry)
        && part.nodeIds.includes(node.nodeId)
    ));
  if (!complete) fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.BINDING_INCOMPLETE,
    `Stretch geometry binding is incomplete for node ${node.nodeId}.`);
  return parts.map((part) => ({
    geometryPartId: part.geometryPartId,
    componentId: part.componentId,
    canonicalType: componentById.get(part.componentId).canonicalType,
    role: part.role,
    geometry: part.geometry,
    nodeIds: part.nodeIds,
  }));
}
function exactNode(topology, component, nodeId) {
  const node = topology.nodes.find((row) => row.nodeId === nodeId);
  if (!node || !component.nodeIds.includes(nodeId)) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.NODE_MISSING,
      `Stretch node does not belong to selected component: ${nodeId}`);
  }
  if (!node.portIds.length) fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.NODE_INELIGIBLE,
    `Stretch node must be port-bearing: ${nodeId}`);
  const ports = topology.ports.filter((row) => node.portIds.includes(row.portId));
  if (ports.length !== node.portIds.length || ports.some((row) => !samePoint(row.position, node.position))) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.BINDING_INCOMPLETE,
      `Stretch node ports are not exactly coincident: ${nodeId}`);
  }
  if (node.boundaryClass === 'EXTERNAL_BOUNDARY') {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.EXTERNAL_BOUNDARY,
      `External boundary node cannot be stretched: ${nodeId}`);
  }
  if (node.boundaryClass === 'REPAIR_BOUNDARY' || repairLocked(topology, node)) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.REPAIR_BOUNDARY,
      `Repair-mediated node cannot be stretched: ${nodeId}`);
  }
  const eligibility = nodeEligibility(topology, nodeId);
  if (!eligibility?.capabilities?.includes('STRETCH_ELIGIBLE') || eligibility.locks.length) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.NODE_INELIGIBLE,
      `Node is not stretch eligible: ${nodeId}`);
  }
  return { node, eligibility };
}
function nodeSummary(topology, component, nodeId) {
  try {
    const exact = exactNode(topology, component, nodeId);
    const components = affectedComponents(topology, exact.node);
    boundParts(topology, exact.node, components);
    return {
      nodeId,
      position: exact.node.position,
      portIds: exact.node.portIds,
      affectedComponentIds: exact.node.incidentComponentIds,
      boundaryClass: exact.node.boundaryClass,
      eligibilityId: exact.eligibility.eligibilityId,
    };
  } catch { return null; }
}
function selectionMaterial(entity, component, topology, readModel) {
  const nodes = component.nodeIds.map((nodeId) => nodeSummary(topology, component, nodeId))
    .filter(Boolean);
  if (!nodes.length) fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.NODE_INELIGIBLE,
    `Component has no qualified port-bearing stretch node: ${component.componentId}`);
  return {
    schema: SEQUENTIAL_NODE_STRETCH_COMPONENT_SELECTION_SCHEMA,
    authorityId: readModel.authorityId,
    sceneRevision: readModel.revision,
    snapshotFingerprint: topology.snapshotFingerprint,
    topologyFingerprint: topology.topologyFingerprint,
    geometryFingerprint: topology.geometryFingerprint,
    selectedObjectId: entity.id,
    componentId: component.componentId,
    canonicalType: component.canonicalType,
    nodes,
  };
}
export function selectSequentialNodeStretchComponent(input = {}) {
  const certified = certifiedInputs(input);
  const entity = selectedEntity(input.objectId, certified.scene);
  const component = componentRecord(entity, certified.topology);
  const material = selectionMaterial(entity, component, certified.topology, certified.readModel);
  return immutableJson({
    ...material,
    selectionId: sequentialSemanticFingerprint('SSK3OSTRETCHSELECTION', material),
  }, 'Sequential node stretch component selection');
}
function targetMaterial(selection, node, eligibility, components, parts, certified) {
  return {
    schema: SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA,
    authorityId: certified.readModel.authorityId,
    sceneRevision: certified.readModel.revision,
    selection,
    selectionId: selection.selectionId,
    selectedObjectId: selection.selectedObjectId,
    selectedComponentId: selection.componentId,
    nodeId: node.nodeId,
    originalPosition: node.position,
    portIds: node.portIds,
    committedConnectionIds: node.committedConnectionIds,
    affectedComponentIds: components.map((row) => row.componentId).sort(),
    geometryPartIds: parts.map((row) => row.geometryPartId).sort(),
    geometryParts: parts,
    eligibilityId: eligibility.eligibilityId,
    boundaryClass: node.boundaryClass,
    snapshotFingerprint: certified.topology.snapshotFingerprint,
    topologyFingerprint: certified.topology.topologyFingerprint,
    geometryFingerprint: certified.topology.geometryFingerprint,
  };
}
export function createSequentialNodeStretchTarget(input = {}) {
  const certified = certifiedInputs(input);
  const selection = selectSequentialNodeStretchComponent({
    objectId: input.selection?.selectedObjectId,
    readModel: certified.readModel,
    scene: certified.scene,
  });
  if (!sameSequentialContractValue(selection, input.selection)) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.TARGET_STALE,
      'Stretch component selection differs from current authority.');
  }
  const component = certified.topology.components.find((row) => (
    row.componentId === selection.componentId
  ));
  const exact = exactNode(certified.topology, component, requiredContractText(input.nodeId, 'nodeId'));
  const components = affectedComponents(certified.topology, exact.node);
  const parts = boundParts(certified.topology, exact.node, components);
  const material = targetMaterial(selection, exact.node, exact.eligibility,
    components, parts, certified);
  return immutableJson({
    ...material,
    stretchTargetId: sequentialSemanticFingerprint('SSK3OSTRETCHTARGET', material),
  }, 'Sequential node stretch target');
}
export function validateSequentialNodeStretchTarget(value, input = {}) {
  if (value?.schema !== SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA) {
    throw new TypeError(`Stretch target must use ${SEQUENTIAL_NODE_STRETCH_TARGET_SCHEMA}.`);
  }
  const rebuilt = createSequentialNodeStretchTarget({
    selection: input.selection || value.selection,
    nodeId: value.nodeId,
    readModel: input.readModel,
    scene: input.scene,
  });
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail(SEQUENTIAL_NODE_STRETCH_TARGET_REJECTION.TARGET_STALE,
      'Stretch target differs from deterministic authority regeneration.');
  }
  return rebuilt;
}
