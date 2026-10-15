/** Pure canonical projection helpers for Sequential editable topology. */
import {
  copySequentialTopologyPoint,
  resolveSequentialPortTopology,
  sameSequentialTopologyPoint,
  sequentialInternalNodeId,
  sequentialTopologyGeometryPoints,
} from './sequential-editable-topology-identity.js';

export const SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION = Object.freeze({
  DUPLICATE_ID: 'SEQUENTIAL_EDITABLE_TOPOLOGY_DUPLICATE_ID',
  GEOMETRY_MISSING: 'SEQUENTIAL_EDITABLE_TOPOLOGY_GEOMETRY_MISSING',
  PORT_MISSING: 'SEQUENTIAL_EDITABLE_TOPOLOGY_PORT_MISSING',
  SUPPORT_INVALID: 'SEQUENTIAL_EDITABLE_TOPOLOGY_SUPPORT_INVALID',
});

function fail(code, message, Constructor = Error) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}
function sorted(rows, key) {
  return [...rows].sort((left, right) => String(left[key]).localeCompare(String(right[key])));
}
function assertUnique(rows, key, label) {
  const values = rows.map((row) => row[key]);
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.DUPLICATE_ID,
    `Duplicate ${label}: ${duplicate}`, RangeError);
}
function partVertices(entity, componentPorts, nodeByPort) {
  return sequentialTopologyGeometryPoints(entity.geometry).map((position) => {
    const port = componentPorts.find((row) => (
      sameSequentialTopologyPoint(row.position, position)
    ));
    const nodeId = port ? nodeByPort.get(port.portId)
      : sequentialInternalNodeId(entity.domainRef.componentId, position);
    return { nodeId, position, portId: port?.portId || null };
  });
}
function geometryPartRecords(scene, topology) {
  const confirmed = scene.entities.filter((row) => row.domainRef?.category === 'confirmed');
  return sorted(confirmed.map((entity) => {
    const componentId = entity.domainRef.componentId;
    const ports = topology.ports.filter((row) => row.componentId === componentId);
    const vertices = partVertices(entity, ports, topology.nodeByPort);
    if (!vertices.length) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.GEOMETRY_MISSING,
      `Confirmed scene geometry is missing: ${entity.id}`, RangeError);
    return {
      geometryPartId: entity.id, sceneEntityId: entity.id, componentId,
      role: entity.domainRef.geometryRole || 'primary', geometry: entity.geometry,
      nodeIds: vertices.map((row) => row.nodeId),
      portIds: vertices.map((row) => row.portId).filter(Boolean), vertices,
    };
  }), 'geometryPartId');
}
function internalEdges(parts) {
  return parts.flatMap((part) => part.nodeIds.slice(1).map((toNodeId, index) => ({
    edgeId: `ssk:edge:${part.geometryPartId}:${index}`,
    componentId: part.componentId, geometryPartId: part.geometryPartId, order: index,
    fromNodeId: part.nodeIds[index], toNodeId,
  })));
}
function connectionRecords(authority, topology) {
  return sorted(authority.committedConnections.map((row) => {
    const fromNodeId = topology.nodeByPort.get(row.fromPortId);
    const toNodeId = topology.nodeByPort.get(row.toPortId);
    if (!fromNodeId || !toNodeId) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.PORT_MISSING,
      `Committed connection references unresolved ports: ${row.connectionId}`, RangeError);
    const repaired = topology.repairedConnectionIds.has(row.connectionId);
    return {
      ...row, fromNodeId, toNodeId,
      nodeRelation: repaired ? 'REPAIR_MEDIATED_CONTINUITY'
        : fromNodeId === toNodeId ? 'MERGED_BY_COMMITTED_IDENTITY' : 'CONNECTED_DISTINCT_NODES',
    };
  }), 'connectionId');
}
function neighborIds(componentId, connections, portOwner) {
  return [...new Set(connections.flatMap((row) => {
    const left = portOwner.get(row.fromPortId); const right = portOwner.get(row.toPortId);
    if (left === componentId && right && right !== left) return [right];
    if (right === componentId && left && left !== right) return [left];
    return [];
  }))].sort();
}
function boundaryCuts(components, connections, portOwner) {
  return components.flatMap((component) => connections.flatMap((row) => {
    const left = portOwner.get(row.fromPortId); const right = portOwner.get(row.toPortId);
    const selectedPortId = left === component.componentId ? row.fromPortId
      : right === component.componentId ? row.toPortId : null;
    const stationaryPortId = selectedPortId === row.fromPortId ? row.toPortId : row.fromPortId;
    const stationaryComponentId = portOwner.get(stationaryPortId);
    if (!selectedPortId || !stationaryComponentId || stationaryComponentId === component.componentId) return [];
    return [{
      boundaryCutId: `ssk:boundary-cut:${component.componentId}:${row.connectionId}`,
      componentId: component.componentId, connectionId: row.connectionId,
      selectedPortId, stationaryPortId, stationaryComponentId,
      nodeRelation: row.nodeRelation, status: row.status,
      currentCoincidence: row.fromNodeId === row.toNodeId,
      rigidTransformDisposition: 'BLOCKED_STATIONARY_TOPOLOGY_BOUNDARY',
    }];
  }));
}
function supportRecords(authority) {
  const carrierIds = new Set(authority.confirmedComponents.map((row) => row.componentId));
  if (authority.unresolvedSupportFamilies.length) fail(
    SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.SUPPORT_INVALID,
    'Editable topology cannot omit unresolved support families.',
    RangeError,
  );
  return sorted(authority.supports.map(({ glyph, family }) => {
    const position = copySequentialTopologyPoint(glyph.centerlinePointGlobal);
    if (!carrierIds.has(glyph.carrierId) || !family || !position) fail(
      SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.SUPPORT_INVALID,
      `Support attachment evidence is incomplete: ${glyph.glyphId}`, RangeError);
    return {
      supportAttachmentId: `ssk:support-attachment:${glyph.glyphId}`,
      supportId: glyph.glyphId, carrierId: glyph.carrierId, familyId: glyph.familyId,
      position, resolutionStatus: glyph.resolutionStatus, glyph, family,
    };
  }), 'supportAttachmentId');
}
function strokeMap(confirmed) {
  return new Map(confirmed.strokeLedger
    .filter((row) => row.componentId && row.op.startsWith('DRAW_'))
    .map((row, index) => [row.componentId, { ...row,
      strokeId: `ssk:stroke:${row.componentId}:${index}` }]));
}
function componentRecords(authority, parts, edges, connections, supports, topology) {
  const strokes = strokeMap(authority.confirmedConstruction);
  const portOwner = new Map(topology.ports.map((row) => [row.portId, row.componentId]));
  return authority.confirmedComponents.map((component, routeOrder) => {
    const ownedParts = parts.filter((row) => row.componentId === component.componentId);
    if (!ownedParts.length) fail(SEQUENTIAL_EDITABLE_TOPOLOGY_PROJECTION_REJECTION.GEOMETRY_MISSING,
      `Component has no owned geometry part: ${component.componentId}`, RangeError);
    const stroke = strokes.get(component.componentId);
    const supportAttachmentIds = supports.filter((row) => row.carrierId === component.componentId)
      .map((row) => row.supportAttachmentId);
    return {
      componentId: component.componentId, canonicalType: component.canonicalType,
      branchId: component.branchId, routeOrder,
      portIds: component.ports.map((row) => row.portId),
      nodeIds: [...new Set([
        ...ownedParts.flatMap((row) => row.nodeIds),
        ...component.ports.map((row) => topology.nodeByPort.get(row.portId)).filter(Boolean),
      ])].sort(),
      geometryPartIds: ownedParts.map((row) => row.geometryPartId),
      geometryKinds: [...new Set(ownedParts.map((row) => row.geometry.kind))].sort(),
      internalEdgeIds: edges.filter((row) => row.componentId === component.componentId)
        .map((row) => row.edgeId),
      neighbourComponentIds: neighborIds(component.componentId, connections, portOwner),
      supportAttachmentIds,
      ancestry: {
        sourceComponentId: component.sourceComponentId, sourceIndex: component.sourceIndex,
        sourceBranchId: component.branchId, sessionFingerprint: authority.sessionFingerprint,
        confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
        strokeId: stroke?.strokeId || null, strokeOperation: stroke?.op || null,
        sceneEntityIds: ownedParts.map((row) => row.sceneEntityId),
      },
    };
  });
}
function nodeBoundaryClass(external, repaired, terminal, connected, portCount) {
  if (external) return 'EXTERNAL_BOUNDARY';
  if (repaired) return 'REPAIR_BOUNDARY';
  if (terminal) return 'INTENTIONAL_TERMINAL';
  if (connected) return 'CONNECTED';
  return portCount ? 'OPEN_TERMINAL' : 'INTERNAL_GEOMETRY';
}
function nodeRecord(nodeId, topology, vertices, edges, connections, context) {
  const owned = vertices.filter((row) => row.nodeId === nodeId);
  const nodePorts = topology.ports.filter((row) => topology.nodeByPort.get(row.portId) === nodeId);
  const portIds = nodePorts.map((row) => row.portId).sort();
  const incidentConnections = connections
    .filter((row) => row.fromNodeId === nodeId || row.toNodeId === nodeId);
  const incidentEdges = edges.filter((row) => row.fromNodeId === nodeId || row.toNodeId === nodeId);
  const external = context.boundaryClassifications
    .some((row) => portIds.includes(row.activePortId));
  const repaired = incidentConnections
    .some((row) => row.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY');
  const terminal = portIds.some((portId) => context.terminalPorts.has(portId));
  return {
    nodeId, position: owned[0]?.position || nodePorts[0].position, portIds,
    incidentComponentIds: [...new Set([
      ...owned.map((row) => row.componentId),
      ...nodePorts.map((row) => row.componentId),
    ])].sort(),
    incidentGeometryPartIds: [...new Set(owned.map((row) => row.geometryPartId))].sort(),
    incidentEdgeIds: incidentEdges.map((row) => row.edgeId).sort(),
    committedConnectionIds: incidentConnections.map((row) => row.connectionId).sort(),
    degree: incidentConnections.length + incidentEdges.length,
    boundaryClass: nodeBoundaryClass(external, repaired, terminal,
      incidentConnections.length > 0, portIds.length),
    positionProvenance: portIds.length ? 'CONFIRMED_PORT' : 'COMPONENT_GEOMETRY',
    positionAncestry: nodePorts.map((row) => ({
      portId: row.portId, componentId: row.componentId,
      sourcePosition: row.sourcePosition, resolvedPosition: row.position,
    })),
  };
}
function nodeRecords(topology, parts, edges, connections, authority) {
  const terminalPorts = new Set(authority.confirmedComponents
    .filter((row) => ['CAP', 'BLIND'].includes(row.canonicalType))
    .flatMap((row) => row.ports.map((port) => port.portId)));
  const vertices = parts.flatMap((part) => part.vertices.map((vertex) => ({
    ...vertex, componentId: part.componentId, geometryPartId: part.geometryPartId,
  })));
  const nodeIds = [...new Set([
    ...vertices.map((row) => row.nodeId),
    ...topology.ports.map((row) => topology.nodeByPort.get(row.portId)),
  ])].sort();
  const context = {
    terminalPorts,
    boundaryClassifications: authority.confirmedConstruction.boundaryClassifications,
  };
  return nodeIds.map((nodeId) => (
    nodeRecord(nodeId, topology, vertices, edges, connections, context)
  ));
}
function repairRecords(authority, connections, nodeByPort) {
  return sorted(authority.repairs.map((row) => {
    const connection = connections.find((item) => item.connectionId === row.connectionId);
    return { ...row, fromNodeId: nodeByPort.get(connection?.fromPortId),
      toNodeId: nodeByPort.get(connection?.toPortId) };
  }), 'repairId');
}

export function projectSequentialEditableTopology(authority, scene) {
  const topology = resolveSequentialPortTopology(authority);
  const partsWithVertices = geometryPartRecords(scene, topology);
  const internalEdgeRows = internalEdges(partsWithVertices);
  const committedConnections = connectionRecords(authority, topology);
  const supportAttachments = supportRecords(authority);
  const components = componentRecords(authority, partsWithVertices, internalEdgeRows,
    committedConnections, supportAttachments, topology);
  const portOwner = new Map(topology.ports.map((row) => [row.portId, row.componentId]));
  const componentBoundaryCuts = boundaryCuts(components, committedConnections, portOwner);
  const nodes = nodeRecords(topology, partsWithVertices, internalEdgeRows,
    committedConnections, authority);
  const ports = sorted(topology.ports
    .map((row) => ({ ...row, nodeId: topology.nodeByPort.get(row.portId) })), 'portId');
  const componentById = new Map(components.map((row) => [row.componentId, row]));
  const geometryParts = partsWithVertices.map(({ vertices, ...row }) => ({
    ...row, sourceStrokeId: componentById.get(row.componentId)?.ancestry.strokeId || null,
  }));
  assertUnique(geometryParts, 'geometryPartId', 'geometry-part ID');
  return {
    nodes, ports, components, geometryParts, internalEdges: internalEdgeRows,
    committedConnections, componentBoundaryCuts,
    repairs: repairRecords(authority, committedConnections, topology.nodeByPort),
    supportAttachments,
  };
}
