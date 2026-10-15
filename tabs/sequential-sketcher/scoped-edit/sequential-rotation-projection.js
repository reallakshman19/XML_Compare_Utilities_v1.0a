/** Pure ROTATE_SUBGRAPH journal validation and topology projection helpers. */
import { sameSequentialContractValue } from './sequential-command-contracts.js';
import {
  createSequentialRotationTransform,
  rotateSequentialGeometry,
  rotateSequentialPoint,
} from './sequential-rotation-geometry.js';

export const SEQUENTIAL_ROTATION_PROJECTION_REJECTION = Object.freeze({
  ENTRY_STALE: 'SEQUENTIAL_GEOMETRY_EDIT_ENTRY_STALE',
  TARGET_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TARGET_INVALID',
  TRANSFORM_INVALID: 'SEQUENTIAL_GEOMETRY_EDIT_TRANSFORM_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function sameIds(left, right) {
  return sameSequentialContractValue([...left].sort(), [...right].sort());
}
function transformFromEntry(entry) {
  const transform = createSequentialRotationTransform({
    pivot: entry.pivot, axis: entry.axis, angleDegrees: entry.angleDegrees,
    profile: entry.profile,
  });
  if (transform.angleRadians !== entry.angleRadians
    || transform.transformFingerprint !== entry.transformFingerprint) {
    fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.TRANSFORM_INVALID,
      'Rotation entry transform differs from canonical regeneration.');
  }
  return transform;
}
function assertPosition(after, expected, label) {
  if (!sameSequentialContractValue(after?.position, expected)) {
    fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.TRANSFORM_INVALID,
      `${label} differs from canonical rotation.`);
  }
}
export function validateSequentialRotationEntryPairs(entry, maps) {
  const transform = transformFromEntry(entry);
  for (const before of maps.beforeParts.values()) {
    const expected = rotateSequentialGeometry(before.geometry, transform);
    if (!sameSequentialContractValue(expected, maps.afterParts.get(before.geometryPartId)?.geometry)) {
      fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.TRANSFORM_INVALID,
        `Rotation geometry differs from canonical regeneration: ${before.geometryPartId}`);
    }
  }
  for (const before of maps.beforePorts.values()) {
    assertPosition(maps.afterPorts.get(before.portId),
      rotateSequentialPoint(before.position, transform), `Port ${before.portId}`);
  }
  for (const before of maps.beforeNodes.values()) {
    assertPosition(maps.afterNodes.get(before.nodeId),
      rotateSequentialPoint(before.position, transform), `Node ${before.nodeId}`);
  }
}
function validateComponents(maps, componentIds) {
  for (const componentId of componentIds) {
    const component = maps.components.get(componentId);
    if (!component || component.supportAttachmentIds.length) {
      fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.TARGET_INVALID,
        `Rotation touches a missing or supported component: ${componentId}`);
    }
  }
}
function validateParts(maps, evidence, selected) {
  for (const before of evidence.beforeParts.values()) {
    const current = maps.parts.get(before.geometryPartId);
    if (!current || !selected.has(current.componentId)
      || !sameSequentialContractValue(current.geometry, before.geometry)
      || !sameSequentialContractValue(current.nodeIds, before.nodeIds)) {
      fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.ENTRY_STALE,
        `Rotation geometry or node binding is stale: ${before.geometryPartId}`);
    }
  }
}
function validatePorts(maps, evidence, selected) {
  for (const before of evidence.beforePorts.values()) {
    const current = maps.ports.get(before.portId);
    if (!current || !selected.has(current.componentId)
      || !sameSequentialContractValue(current.position, before.position)) {
      fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.ENTRY_STALE,
        `Rotation port is stale: ${before.portId}`);
    }
  }
}
function movedNodeAllowed(node, after, selected) {
  const moved = !sameSequentialContractValue(node.position, after.position);
  return !moved || node.incidentComponentIds.every((id) => selected.has(id));
}
function validateNodes(maps, evidence, selected) {
  for (const before of evidence.beforeNodes.values()) {
    const current = maps.nodes.get(before.nodeId);
    const after = evidence.afterNodes.get(before.nodeId);
    if (!current || !sameSequentialContractValue(current.position, before.position)
      || !movedNodeAllowed(current, after, selected)) {
      fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.ENTRY_STALE,
        `Rotation node is stale or would move stationary authority: ${before.nodeId}`);
    }
  }
}
function validateBoundaryEvidence(entry) {
  if (entry.boundaryDiagnosis?.aggregateDisposition !== 'PRESERVED'
    || entry.boundaryDiagnosis.boundaries.some((row) => row.disposition !== 'PRESERVED')) {
    fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.TARGET_INVALID,
      'Rotation journal contains a disconnecting boundary.');
  }
}
export function validateSequentialRotationTopology(snapshot, entry, maps, evidence) {
  const selected = new Set(entry.affectedComponentIds);
  validateComponents(maps, selected);
  validateParts(maps, evidence, selected);
  validatePorts(maps, evidence, selected);
  validateNodes(maps, evidence, selected);
  validateBoundaryEvidence(entry);
  const components = snapshot.components.filter((row) => selected.has(row.componentId));
  const expectedPartIds = new Set(components.flatMap((row) => row.geometryPartIds));
  const expectedPortIds = new Set(components.flatMap((row) => row.portIds));
  const expectedNodeIds = new Set(components.flatMap((row) => row.nodeIds));
  if (!sameIds(evidence.beforeParts.keys(), expectedPartIds)
    || !sameIds(evidence.beforePorts.keys(), expectedPortIds)
    || !sameIds(evidence.beforeNodes.keys(), expectedNodeIds)) {
    fail(SEQUENTIAL_ROTATION_PROJECTION_REJECTION.ENTRY_STALE,
      'Rotation entry omits canonical selected-subgraph authority.');
  }
}
export function projectSequentialRotationConnections(connections, evidence) {
  return connections.map((row) => ({
    ...row,
    ...(evidence.afterPorts.has(row.fromPortId)
      ? { fromPosition: evidence.afterPorts.get(row.fromPortId).position } : {}),
    ...(evidence.afterPorts.has(row.toPortId)
      ? { toPosition: evidence.afterPorts.get(row.toPortId).position } : {}),
  }));
}
export function projectSequentialRotationNode(row, evidence) {
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
export const _test = Object.freeze({
  sameIds, transformFromEntry, movedNodeAllowed, validateBoundaryEvidence,
});
