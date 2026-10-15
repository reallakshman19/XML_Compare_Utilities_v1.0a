/** Pure STRETCH_NODE journal validation and topology projection helpers. */
import { sameSequentialContractValue } from './sequential-command-contracts.js';

export const SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION = Object.freeze({
  ENTRY_STALE: 'SEQUENTIAL_GEOMETRY_EDIT_ENTRY_STALE',
  TARGET_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TARGET_INVALID',
  TRANSFORM_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TRANSFORM_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function geometryPoints(geometry) {
  if (geometry?.kind === 'point') return [geometry.position];
  if (geometry?.kind === 'segment') return [geometry.start, geometry.end];
  if (geometry?.kind === 'polyline') return geometry.points || [];
  fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
    `Unsupported stretch journal geometry: ${geometry?.kind || 'missing'}`, TypeError);
}
function geometryFromPoints(geometry, points) {
  if (geometry.kind === 'point') return { ...geometry, position: points[0] };
  if (geometry.kind === 'segment') return { ...geometry, start: points[0], end: points[1] };
  return { ...geometry, points };
}
export function regenerateSequentialStretchEntryGeometry(before, entry) {
  const points = geometryPoints(before.geometry);
  if (before.nodeIds?.length !== points.length || !before.nodeIds.includes(entry.nodeId)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
      `Stretch binding is invalid for ${before.geometryPartId}.`);
  }
  return geometryFromPoints(before.geometry, points.map((point, index) => (
    before.nodeIds[index] === entry.nodeId ? entry.targetPosition : point
  )));
}
function add(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}
function assertPosition(after, expected, label) {
  if (!sameSequentialContractValue(expected, after?.position)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
      `${label} after position differs from canonical stretch regeneration.`);
  }
}
export function validateSequentialStretchEntryPairs(entry, maps) {
  const beforeNode = maps.beforeNodes.get(entry.nodeId);
  if (maps.beforeNodes.size !== 1 || !beforeNode) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
      'Stretch entry must contain exactly the selected node.');
  }
  assertPosition(maps.afterNodes.get(entry.nodeId), entry.targetPosition, `Node ${entry.nodeId}`);
  if (!sameSequentialContractValue(add(beforeNode.position, entry.delta), entry.targetPosition)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
      'Stretch delta does not terminate at the selected target position.');
  }
  for (const before of maps.beforePorts.values()) {
    assertPosition(maps.afterPorts.get(before.portId), entry.targetPosition, `Port ${before.portId}`);
  }
  for (const before of maps.beforeParts.values()) {
    const expected = regenerateSequentialStretchEntryGeometry(before, entry);
    if (!sameSequentialContractValue(expected, maps.afterParts.get(before.geometryPartId)?.geometry)) {
      fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TRANSFORM_INVALID,
        `Stretch geometry differs from node-bound regeneration: ${before.geometryPartId}`);
    }
  }
}
function sameIds(left, right) {
  return sameSequentialContractValue([...left].sort(), [...right].sort());
}
function validateParts(maps, evidence, components, entry) {
  for (const before of evidence.beforeParts.values()) {
    const current = maps.parts.get(before.geometryPartId);
    if (!current || !components.has(current.componentId)
      || !sameSequentialContractValue(current.geometry, before.geometry)
      || !sameSequentialContractValue(current.nodeIds, before.nodeIds)) {
      fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.ENTRY_STALE,
        `Stretch geometry or node binding is stale: ${before.geometryPartId}`);
    }
  }
}
function validateComponents(maps, components) {
  for (const id of components) {
    const component = maps.components.get(id);
    if (!component || component.supportAttachmentIds.length) {
      fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TARGET_INVALID,
        `Stretch node touches a missing or supported component: ${id}`);
    }
  }
}
export function validateSequentialStretchTopology(snapshot, entry, maps, evidence) {
  const node = maps.nodes.get(entry.nodeId);
  if (!node || !node.portIds.length || node.boundaryClass === 'EXTERNAL_BOUNDARY'
    || node.boundaryClass === 'REPAIR_BOUNDARY'
    || !sameIds(node.incidentComponentIds, entry.affectedComponentIds)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TARGET_INVALID,
      `Stretch node is no longer a qualified canonical target: ${entry.nodeId}`);
  }
  const components = new Set(entry.affectedComponentIds);
  validateComponents(maps, components);
  const repaired = snapshot.committedConnections.some((row) => (
    node.committedConnectionIds.includes(row.connectionId)
      && row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY'
  ));
  if (repaired) fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.TARGET_INVALID,
    `Stretch node is repair-mediated: ${entry.nodeId}`);
  if (!sameIds(evidence.beforeParts.keys(), node.incidentGeometryPartIds)
    || !sameIds(evidence.beforePorts.keys(), node.portIds)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.ENTRY_STALE,
      `Stretch entry omits canonical node geometry or ports: ${entry.nodeId}`);
  }
  validateParts(maps, evidence, components, entry);
  for (const before of evidence.beforePorts.values()) {
    const current = maps.ports.get(before.portId);
    if (current?.nodeId !== entry.nodeId || !node.portIds.includes(before.portId)
      || !sameSequentialContractValue(current.position, before.position)) {
      fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.ENTRY_STALE,
        `Stretch port is stale for ${before.portId}.`);
    }
  }
  const beforeNode = evidence.beforeNodes.get(entry.nodeId);
  if (evidence.beforeNodes.size !== 1
    || !sameSequentialContractValue(node.position, beforeNode?.position)) {
    fail(SEQUENTIAL_NODE_STRETCH_PROJECTION_REJECTION.ENTRY_STALE,
      `Stretch node position is stale: ${entry.nodeId}.`);
  }
}
export function projectSequentialStretchConnections(connections, evidence) {
  return connections.map((row) => ({
    ...row,
    ...(evidence.afterPorts.has(row.fromPortId)
      ? { fromPosition: evidence.afterPorts.get(row.fromPortId).position } : {}),
    ...(evidence.afterPorts.has(row.toPortId)
      ? { toPosition: evidence.afterPorts.get(row.toPortId).position } : {}),
  }));
}
export function projectSequentialStretchNode(row, evidence) {
  if (!evidence.afterNodes.has(row.nodeId)) return row;
  return {
    ...row,
    position: evidence.afterNodes.get(row.nodeId).position,
    positionProvenance: 'GEOMETRY_EDIT_JOURNAL',
    positionAncestry: row.positionAncestry.map((item) => (
      evidence.afterPorts.has(item.portId)
        ? { ...item, resolvedPosition: evidence.afterPorts.get(item.portId).position }
        : item
    )),
  };
}

export const _test = Object.freeze({ geometryPoints, geometryFromPoints, sameIds });
