/** Exact identity resolution for canonical Sequential editable topology. */
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION = Object.freeze({
  DUPLICATE_PORT_ID: 'SEQUENTIAL_EDITABLE_TOPOLOGY_DUPLICATE_PORT_ID',
  PORT_POSITION_MISSING: 'SEQUENTIAL_EDITABLE_TOPOLOGY_PORT_POSITION_MISSING',
  PORT_POSITION_CONFLICT: 'SEQUENTIAL_EDITABLE_TOPOLOGY_PORT_POSITION_CONFLICT',
});

function fail(code, message, Constructor = Error) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}

export function copySequentialTopologyPoint(value) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) return null;
  return { x: value.x, y: value.y, z: value.z };
}

export function sameSequentialTopologyPoint(left, right) {
  return Boolean(left && right
    && left.x === right.x && left.y === right.y && left.z === right.z);
}

export function sequentialTopologyGeometryPoints(geometry) {
  if (geometry?.kind === 'point') {
    return [copySequentialTopologyPoint(geometry.position)].filter(Boolean);
  }
  if (geometry?.kind === 'segment') {
    return [geometry.start, geometry.end].map(copySequentialTopologyPoint).filter(Boolean);
  }
  if (geometry?.kind === 'polyline') {
    return (geometry.points || []).map(copySequentialTopologyPoint).filter(Boolean);
  }
  return [];
}

export function sequentialInternalNodeId(componentId, position) {
  const digest = sequentialSemanticFingerprint('SSKINTERNALNODE', { componentId, position })
    .split(':').at(-1);
  return `ssk:node:internal:${componentId}:${digest}`;
}

function connectionPositionEvidence(portId, connections) {
  return connections.flatMap((row) => {
    if (row.fromPortId === portId) {
      return [{ connectionId: row.connectionId,
        position: copySequentialTopologyPoint(row.fromPosition) }];
    }
    if (row.toPortId === portId) {
      return [{ connectionId: row.connectionId,
        position: copySequentialTopologyPoint(row.toPosition) }];
    }
    return [];
  });
}

function resolvedPortPosition(port, connections) {
  const evidence = connectionPositionEvidence(port.portId, connections);
  const invalid = evidence.find((row) => !row.position);
  if (invalid) fail(
    SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.PORT_POSITION_MISSING,
    `Committed connection position is missing: ${invalid.connectionId} / ${port.portId}`,
    RangeError,
  );
  const positions = evidence.map((row) => row.position);
  const first = positions[0] || copySequentialTopologyPoint(port.sourcePosition);
  if (!first) fail(
    SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.PORT_POSITION_MISSING,
    `Confirmed port position is missing: ${port.portId}`,
    RangeError,
  );
  if (positions.some((position) => !sameSequentialTopologyPoint(position, first))) {
    fail(
      SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.PORT_POSITION_CONFLICT,
      `Committed connections disagree on port position: ${port.portId}`,
      RangeError,
    );
  }
  return first;
}

function confirmedPorts(authority) {
  const ports = authority.confirmedComponents.flatMap((component) => component.ports.map((port) => ({
    ...port,
    componentId: component.componentId,
    branchId: component.branchId,
    position: resolvedPortPosition(port, authority.committedConnections),
  })));
  const ids = ports.map((row) => row.portId);
  const duplicate = ids.find((value, index) => ids.indexOf(value) !== index);
  if (duplicate) fail(
    SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.DUPLICATE_PORT_ID,
    `Duplicate confirmed port ID: ${duplicate}`,
    RangeError,
  );
  return ports;
}

function repairConnectionIds(authority) {
  return new Set(authority.repairs.map((repair) => repair.connectionId));
}

function identityConnection(connection, repaired) {
  return !repaired.has(connection.connectionId)
    && sameSequentialTopologyPoint(
      copySequentialTopologyPoint(connection.fromPosition),
      copySequentialTopologyPoint(connection.toPosition),
    );
}

function portAdjacency(portIds, connections, repaired) {
  const result = new Map(portIds.map((id) => [id, []]));
  connections.filter((row) => identityConnection(row, repaired)).forEach((row) => {
    result.get(row.fromPortId)?.push(row.toPortId);
    result.get(row.toPortId)?.push(row.fromPortId);
  });
  return result;
}

function connectedPortGroups(portIds, adjacency) {
  const remaining = new Set(portIds);
  const groups = [];
  while (remaining.size) {
    const first = [...remaining].sort()[0];
    const queue = [first];
    const group = [];
    remaining.delete(first);
    while (queue.length) {
      const current = queue.shift();
      group.push(current);
      for (const next of adjacency.get(current) || []) {
        if (!remaining.has(next)) continue;
        remaining.delete(next);
        queue.push(next);
      }
    }
    groups.push(group.sort());
  }
  return groups.sort((left, right) => left[0].localeCompare(right[0]));
}

function nodeIdForPorts(portIds) {
  const digest = sequentialSemanticFingerprint('SSKNODE', portIds).split(':').at(-1);
  return `ssk:node:${digest}`;
}

export function resolveSequentialPortTopology(authority) {
  const ports = confirmedPorts(authority);
  const repairedConnectionIds = repairConnectionIds(authority);
  const portIds = ports.map((row) => row.portId);
  const groups = connectedPortGroups(
    portIds,
    portAdjacency(portIds, authority.committedConnections, repairedConnectionIds),
  );
  const nodeByPort = new Map(groups.flatMap((group) => (
    group.map((portId) => [portId, nodeIdForPorts(group)])
  )));
  return { ports, repairedConnectionIds, nodeByPort };
}
