/** Exact confirmed-component or connected-subgraph target resolution for rigid rotation. */
import { immutableJson, requiredContractText } from '../../../contracts/contract-values.js';
import { validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_ROTATION_SCOPE = Object.freeze({
  COMPONENT_ONLY: 'COMPONENT_ONLY',
  CONNECTED_SUBGRAPH: 'CONNECTED_SUBGRAPH',
});
export const SEQUENTIAL_ROTATION_TARGET_SCHEMA = 'SequentialRotationTarget.v1';
export const SEQUENTIAL_ROTATION_TARGET_REJECTION = Object.freeze({
  OBJECT_INVALID: 'SEQUENTIAL_ROTATION_OBJECT_INVALID',
  COMPONENT_INVALID: 'SEQUENTIAL_ROTATION_COMPONENT_INVALID',
  SCOPE_INVALID: 'SEQUENTIAL_ROTATION_SCOPE_INVALID',
  GEOMETRY_INCOMPLETE: 'SEQUENTIAL_ROTATION_GEOMETRY_INCOMPLETE',
  TARGET_STALE: 'SEQUENTIAL_ROTATION_TARGET_STALE',
});
const GEOMETRY_KINDS = new Set(['point', 'segment', 'polyline']);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function scopeValue(value) {
  const scope = String(value || SEQUENTIAL_ROTATION_SCOPE.COMPONENT_ONLY).trim().toUpperCase();
  if (!Object.values(SEQUENTIAL_ROTATION_SCOPE).includes(scope)) {
    fail(SEQUENTIAL_ROTATION_TARGET_REJECTION.SCOPE_INVALID,
      `Unsupported rotation scope: ${value}`, TypeError);
  }
  return scope;
}
function certified(input) {
  const readModel = input.readModel;
  const scene = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene), readModel,
  );
  return { readModel, scene, topology: createSequentialEditableTopologySnapshot(readModel) };
}
function selectedEntity(objectId, scene) {
  const id = requiredContractText(objectId, 'rotation selected objectId');
  const entity = scene.entities.find((row) => row.id === id);
  if (entity?.domainRef?.category !== 'confirmed' || !entity.domainRef.componentId) {
    fail(SEQUENTIAL_ROTATION_TARGET_REJECTION.OBJECT_INVALID,
      `Rotation selection must reference confirmed geometry: ${id}`);
  }
  return entity;
}
function topologyMaps(topology) {
  return {
    components: new Map(topology.components.map((row) => [row.componentId, row])),
    ports: new Map(topology.ports.map((row) => [row.portId, row])),
    nodes: new Map(topology.nodes.map((row) => [row.nodeId, row])),
  };
}
function seedComponent(entity, maps) {
  const component = maps.components.get(entity.domainRef.componentId);
  if (!component) fail(SEQUENTIAL_ROTATION_TARGET_REJECTION.COMPONENT_INVALID,
    `Rotation component is unavailable: ${entity.domainRef.componentId}`);
  return component;
}
function connectionComponents(connection, maps) {
  const from = maps.ports.get(connection.fromPortId)?.componentId;
  const to = maps.ports.get(connection.toPortId)?.componentId;
  return from && to ? [from, to] : [];
}
function traversable(connection) {
  return connection.nodeRelation !== 'REPAIR_MEDIATED_CONTINUITY'
    && connection.fromNodeId === connection.toNodeId;
}
function blockedComponent(component) {
  return !component || component.supportAttachmentIds.length > 0;
}
function adjacentConnections(topology, componentId, maps) {
  return topology.committedConnections.filter((row) => (
    connectionComponents(row, maps).includes(componentId)
  ));
}
function subgraphIds(topology, seedId, scope, maps) {
  if (scope === SEQUENTIAL_ROTATION_SCOPE.COMPONENT_ONLY) return [seedId];
  const selected = new Set([seedId]); const queue = [seedId];
  while (queue.length) {
    const current = queue.shift();
    for (const connection of adjacentConnections(topology, current, maps)) {
      if (!traversable(connection)) continue;
      const ids = connectionComponents(connection, maps);
      const neighbor = ids.find((id) => id !== current);
      if (!neighbor || selected.has(neighbor) || blockedComponent(maps.components.get(neighbor))) continue;
      selected.add(neighbor); queue.push(neighbor);
    }
  }
  return [...selected].sort();
}
function geometryPointCount(geometry) {
  if (geometry?.kind === 'point') return 1;
  if (geometry?.kind === 'segment') return 2;
  if (geometry?.kind === 'polyline') return geometry.points?.length || 0;
  return 0;
}
function selectedParts(topology, componentIds) {
  const selected = new Set(componentIds);
  const parts = topology.geometryParts.filter((row) => selected.has(row.componentId));
  const expected = topology.components.filter((row) => selected.has(row.componentId))
    .flatMap((row) => row.geometryPartIds).sort();
  const complete = sameSequentialContractValue(parts.map((row) => row.geometryPartId).sort(), expected)
    && parts.every((row) => GEOMETRY_KINDS.has(row.geometry?.kind)
      && row.nodeIds?.length === geometryPointCount(row.geometry));
  if (!complete) fail(SEQUENTIAL_ROTATION_TARGET_REJECTION.GEOMETRY_INCOMPLETE,
    'Rotation subgraph geometry or node binding is incomplete.');
  return parts.map((row) => ({
    geometryPartId: row.geometryPartId, componentId: row.componentId,
    role: row.role, geometry: row.geometry, nodeIds: row.nodeIds,
  }));
}
function selectedRecords(topology, componentIds) {
  const selected = new Set(componentIds);
  const components = topology.components.filter((row) => selected.has(row.componentId));
  const portIds = new Set(components.flatMap((row) => row.portIds));
  const nodeIds = new Set(components.flatMap((row) => row.nodeIds));
  return {
    components,
    ports: topology.ports.filter((row) => portIds.has(row.portId)),
    nodes: topology.nodes.filter((row) => nodeIds.has(row.nodeId)),
    parts: selectedParts(topology, componentIds),
  };
}
function boundaryCut(connection, selected, maps) {
  const [fromComponentId, toComponentId] = connectionComponents(connection, maps);
  const fromSelected = selected.has(fromComponentId);
  if (fromSelected === selected.has(toComponentId)) return null;
  const selectedPortId = fromSelected ? connection.fromPortId : connection.toPortId;
  const stationaryPortId = fromSelected ? connection.toPortId : connection.fromPortId;
  const selectedPort = maps.ports.get(selectedPortId);
  const stationaryPort = maps.ports.get(stationaryPortId);
  if (!selectedPort || !stationaryPort) return null;
  return {
    boundaryId: `rotation-boundary:${connection.connectionId}`,
    connectionId: connection.connectionId,
    selectedComponentId: selectedPort.componentId,
    stationaryComponentId: stationaryPort.componentId,
    selectedPortId, stationaryPortId,
    selectedPosition: selectedPort.position,
    stationaryPosition: stationaryPort.position,
    nodeRelation: connection.nodeRelation,
  };
}
function boundaryCuts(topology, componentIds, maps) {
  const selected = new Set(componentIds);
  return topology.committedConnections.map((row) => boundaryCut(row, selected, maps))
    .filter(Boolean).sort((left, right) => left.boundaryId.localeCompare(right.boundaryId));
}
function targetLocks(topology, records, cuts, maps) {
  const locks = [];
  for (const component of records.components) {
    if (component.supportAttachmentIds.length) locks.push(`SUPPORTED_COMPONENT:${component.componentId}`);
  }
  for (const node of records.nodes) {
    if (node.boundaryClass === 'EXTERNAL_BOUNDARY') locks.push(`EXTERNAL_BOUNDARY:${node.nodeId}`);
    if (node.boundaryClass === 'REPAIR_BOUNDARY') locks.push(`REPAIR_BOUNDARY:${node.nodeId}`);
  }
  for (const cut of cuts) {
    const connection = topology.committedConnections.find((row) => row.connectionId === cut.connectionId);
    if (!traversable(connection)) locks.push(`REPAIR_MEDIATED_CONNECTION:${cut.connectionId}`);
    if (blockedComponent(maps.components.get(cut.stationaryComponentId))) {
      locks.push(`STATIONARY_COMPONENT_LOCKED:${cut.stationaryComponentId}`);
    }
  }
  return [...new Set(locks)].sort();
}
function affectedConnections(topology, ids, maps) {
  return topology.committedConnections.filter((row) => (
    connectionComponents(row, maps).some((id) => ids.includes(id))
  )).map((row) => row.connectionId).sort();
}
function targetMaterial(current, entity, seed, scope, ids, records, cuts, locks, maps) {
  const topology = current.topology;
  const eligibilityIds = topology.eligibility.filter((row) => (
    row.targetKind === 'COMPONENT' && ids.includes(row.targetId)
  )).map((row) => row.eligibilityId).sort();
  return {
    schema: SEQUENTIAL_ROTATION_TARGET_SCHEMA,
    authorityId: current.readModel.authorityId,
    sceneRevision: current.readModel.revision,
    selectedObjectId: entity.id,
    seedComponentId: seed.componentId,
    seedCanonicalType: seed.canonicalType,
    scope,
    affectedComponentIds: ids,
    geometryPartIds: records.parts.map((row) => row.geometryPartId).sort(),
    portIds: records.ports.map((row) => row.portId).sort(),
    nodeIds: records.nodes.map((row) => row.nodeId).sort(),
    internalEdgeIds: topology.internalEdges.filter((row) => ids.includes(row.componentId))
      .map((row) => row.internalEdgeId).sort(),
    affectedConnectionIds: affectedConnections(topology, ids, maps),
    geometryParts: records.parts,
    ports: records.ports.map((row) => ({
      portId: row.portId, componentId: row.componentId, nodeId: row.nodeId, position: row.position,
    })),
    nodes: records.nodes.map((row) => ({
      nodeId: row.nodeId, incidentComponentIds: row.incidentComponentIds,
      portIds: row.portIds, position: row.position, boundaryClass: row.boundaryClass,
    })),
    boundaryCuts: cuts,
    locks,
    rotationEligible: locks.length === 0,
    eligibilityIds,
    snapshotFingerprint: topology.snapshotFingerprint,
    topologyFingerprint: topology.topologyFingerprint,
    geometryFingerprint: topology.geometryFingerprint,
    geometryEditJournalFingerprint: topology.geometryEditJournalFingerprint || null,
  };
}
export function selectSequentialRotationTarget(input = {}) {
  const current = certified(input);
  const entity = selectedEntity(input.objectId, current.scene);
  const maps = topologyMaps(current.topology);
  const seed = seedComponent(entity, maps);
  const scope = scopeValue(input.scope);
  const ids = subgraphIds(current.topology, seed.componentId, scope, maps);
  const records = selectedRecords(current.topology, ids);
  const cuts = boundaryCuts(current.topology, ids, maps);
  const locks = targetLocks(current.topology, records, cuts, maps);
  const material = targetMaterial(current, entity, seed, scope, ids, records, cuts, locks, maps);
  const identity = { ...material, selectedObjectId: null };
  return immutableJson({
    ...material,
    rotationTargetId: sequentialSemanticFingerprint('SSK3PROTATIONTARGET', identity),
  }, 'Sequential rotation target');
}
export function validateSequentialRotationTarget(value, input = {}) {
  if (value?.schema !== SEQUENTIAL_ROTATION_TARGET_SCHEMA) {
    throw new TypeError(`Rotation target must use ${SEQUENTIAL_ROTATION_TARGET_SCHEMA}.`);
  }
  const rebuilt = selectSequentialRotationTarget({
    objectId: value.selectedObjectId, scope: value.scope,
    readModel: input.readModel, scene: input.scene,
  });
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail(SEQUENTIAL_ROTATION_TARGET_REJECTION.TARGET_STALE,
      'Rotation target differs from deterministic authority regeneration.');
  }
  return rebuilt;
}
export const _test = Object.freeze({
  scopeValue, connectionComponents, traversable, subgraphIds, boundaryCuts, targetLocks,
});
