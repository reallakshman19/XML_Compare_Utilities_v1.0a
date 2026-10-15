/** Exact current straight-PIPE target resolution for supervised split editing. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA = 'SequentialPipeSplitTarget.v1';
export const SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION = Object.freeze({
  OBJECT_INVALID: 'SEQUENTIAL_PIPE_SPLIT_OBJECT_INVALID',
  COMPONENT_INVALID: 'SEQUENTIAL_PIPE_SPLIT_COMPONENT_INVALID',
  GEOMETRY_INVALID: 'SEQUENTIAL_PIPE_SPLIT_GEOMETRY_INVALID',
  ENDPOINT_INVALID: 'SEQUENTIAL_PIPE_SPLIT_ENDPOINT_INVALID',
  SUPPORT_ATTACHED: 'SEQUENTIAL_PIPE_SPLIT_SUPPORT_ATTACHED',
  REPAIR_BOUNDARY: 'SEQUENTIAL_PIPE_SPLIT_REPAIR_BOUNDARY',
  EXTERNAL_BOUNDARY: 'SEQUENTIAL_PIPE_SPLIT_EXTERNAL_BOUNDARY',
  ANCESTRY_INCOMPLETE: 'SEQUENTIAL_PIPE_SPLIT_ANCESTRY_INCOMPLETE',
  TARGET_STALE: 'SEQUENTIAL_PIPE_SPLIT_TARGET_STALE',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function samePoint(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y && left.z === right.z);
}
function certified(input) {
  const readModel = input.readModel;
  const scene = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene), readModel,
  );
  return { readModel, scene, topology: createSequentialEditableTopologySnapshot(readModel) };
}
function selectedEntity(objectId, scene) {
  const id = requiredContractText(objectId, 'pipe split objectId');
  const entity = scene.entities.find((row) => row.id === id);
  if (entity?.domainRef?.category !== 'confirmed' || !entity.domainRef.componentId) {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.OBJECT_INVALID,
      `Pipe split selection must reference confirmed geometry: ${id}`);
  }
  return entity;
}
function component(entity, topology) {
  const value = topology.components.find((row) => row.componentId === entity.domainRef.componentId);
  if (!value || value.canonicalType !== 'PIPE') {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.COMPONENT_INVALID,
      'Pipe split requires one canonical PIPE component.');
  }
  if (value.supportAttachmentIds.length) fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.SUPPORT_ATTACHED,
    `Supported pipe cannot be split: ${value.componentId}`);
  if (!value.ancestry?.strokeId) fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.ANCESTRY_INCOMPLETE,
    `Pipe split ancestry is incomplete: ${value.componentId}`);
  return value;
}
function partRecord(entity, owner, topology) {
  const parts = topology.geometryParts.filter((row) => row.componentId === owner.componentId);
  if (parts.length !== 1 || parts[0].geometry?.kind !== 'segment'
    || parts[0].geometryPartId !== entity.id || parts[0].nodeIds?.length !== 2) {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.GEOMETRY_INVALID,
      'Pipe split requires one exact segment geometry part.');
  }
  const edges = topology.internalEdges.filter((row) => row.componentId === owner.componentId);
  if (edges.length !== 1) fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.GEOMETRY_INVALID,
    'Pipe split requires one canonical internal edge.');
  return { part: parts[0], edge: edges[0] };
}
function endpoint(topology, owner, nodeId, position, label) {
  const node = topology.nodes.find((row) => row.nodeId === nodeId);
  const ports = topology.ports.filter((row) => (
    row.componentId === owner.componentId && row.nodeId === nodeId
  ));
  if (!node || ports.length !== 1 || !samePoint(node.position, position)
    || !samePoint(ports[0].position, position)) {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.ENDPOINT_INVALID,
      `${label} endpoint authority is incomplete.`);
  }
  if (node.boundaryClass === 'EXTERNAL_BOUNDARY') {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.EXTERNAL_BOUNDARY,
      `${label} endpoint is an external boundary.`);
  }
  const repaired = node.boundaryClass === 'REPAIR_BOUNDARY'
    || topology.committedConnections.some((row) => (
      node.committedConnectionIds.includes(row.connectionId)
        && row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY'
    ));
  if (repaired) fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.REPAIR_BOUNDARY,
    `${label} endpoint is repair-mediated.`);
  return { node, port: ports[0] };
}
function targetMaterial(entity, owner, record, endpoints, data) {
  const cuts = data.topology.componentBoundaryCuts
    .filter((row) => row.componentId === owner.componentId);
  return {
    schema: SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA,
    authorityId: data.readModel.authorityId,
    sceneRevision: data.readModel.revision,
    selectedObjectId: entity.id,
    parentComponentId: owner.componentId,
    parentGeometryPartId: record.part.geometryPartId,
    canonicalType: owner.canonicalType,
    geometry: record.part.geometry,
    nodeIds: record.part.nodeIds,
    portIds: [endpoints.start.port.portId, endpoints.end.port.portId],
    startNode: endpoints.start.node, endNode: endpoints.end.node,
    startPort: endpoints.start.port, endPort: endpoints.end.port,
    parentComponent: owner, parentGeometryPart: record.part,
    parentInternalEdge: record.edge, boundaryCuts: cuts,
    parentSceneEntity: entity,
    snapshotFingerprint: data.topology.snapshotFingerprint,
    topologyFingerprint: data.topology.topologyFingerprint,
    geometryFingerprint: data.topology.geometryFingerprint,
    topologyEditJournalFingerprint: data.readModel.topologyEditJournalFingerprint || null,
  };
}
export function selectSequentialPipeSplitTarget(input = {}) {
  const data = certified(input);
  const entity = selectedEntity(input.objectId, data.scene);
  const owner = component(entity, data.topology);
  const record = partRecord(entity, owner, data.topology);
  const endpoints = {
    start: endpoint(data.topology, owner, record.part.nodeIds[0], record.part.geometry.start, 'Start'),
    end: endpoint(data.topology, owner, record.part.nodeIds[1], record.part.geometry.end, 'End'),
  };
  if (endpoints.start.node.nodeId === endpoints.end.node.nodeId
    || endpoints.start.port.portId === endpoints.end.port.portId) {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.ENDPOINT_INVALID,
      'Pipe split requires two distinct endpoint nodes and ports.');
  }
  const material = targetMaterial(entity, owner, record, endpoints, data);
  return immutableJson({ ...material,
    splitTargetId: sequentialSemanticFingerprint('SSK3QSPLITTARGET', material) },
  'Sequential pipe split target');
}
export function validateSequentialPipeSplitTarget(value, input = {}) {
  if (value?.schema !== SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA) {
    throw new TypeError(`Pipe split target must use ${SEQUENTIAL_PIPE_SPLIT_TARGET_SCHEMA}.`);
  }
  const rebuilt = selectSequentialPipeSplitTarget({ objectId: value.selectedObjectId,
    readModel: input.readModel, scene: input.scene });
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail(SEQUENTIAL_PIPE_SPLIT_TARGET_REJECTION.TARGET_STALE,
      'Pipe split target differs from deterministic authority regeneration.');
  }
  return rebuilt;
}
