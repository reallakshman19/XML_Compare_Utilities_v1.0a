/** Pure relationship-impact evidence for an explicit Sequential DISCONNECT_ENDPOINT request mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialDisconnectEndpointRequest } from '../../topology-trace-validator/topology-sequential-disconnect-endpoint-request.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_PREVIEW_SCHEMA =
  'SequentialDisconnectEndpointImpactPreview.v1';
export const SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KINDS = Object.freeze([
  'INTERNAL_EDGE', 'COMMITTED_CONNECTION',
]);
export const SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_DISCONNECT_ENDPOINT_EXPLICIT_IDENTITY_REQUIRED',
  RELATIONSHIP_KIND_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KIND_INVALID',
  RELATIONSHIP_MISSING: 'SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_MISSING',
  NODE_MISSING: 'SEQUENTIAL_DISCONNECT_ENDPOINT_NODE_MISSING',
  PORT_MISSING: 'SEQUENTIAL_DISCONNECT_ENDPOINT_PORT_MISSING',
  PORT_NODE_MISMATCH: 'SEQUENTIAL_DISCONNECT_ENDPOINT_PORT_NODE_MISMATCH',
  RELATIONSHIP_SIDE_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_SIDE_INVALID',
  COMPONENT_OWNERSHIP_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_COMPONENT_OWNERSHIP_INVALID',
  PREVIEW_INVALID: 'SEQUENTIAL_DISCONNECT_ENDPOINT_PREVIEW_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}
function exactRequest(value) {
  try {
    const request = assertTopologySequentialDisconnectEndpointRequest(value);
    const intent = request.sequentialIntent;
    if (intent?.requiredOperation !== 'DISCONNECT_ENDPOINT'
      || intent?.candidateNativeOperation !== null
      || intent?.currentNativeDisconnectAuthority !== 'UNAVAILABLE'
      || intent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request does not preserve explicit DISCONNECT_ENDPOINT authority.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator disconnect request is invalid: ${error.message || String(error)}`, TypeError);
  }
}
function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.TOPOLOGY_INVALID,
    'Disconnect impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  return value;
}
function relationshipKind(value) {
  const kind = requiredText(value, 'sequentialRelationshipKind').toUpperCase();
  if (!SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KINDS.includes(kind)) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.RELATIONSHIP_KIND_INVALID,
    `Relationship kind must be ${SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KINDS.join(' or ')}.`);
  return kind;
}
function exactRow(rows, key, id, label, code) {
  const row = rows.find((item) => item[key] === id);
  if (!row) fail(code, `${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}
function exactRelationship(topology, kind, id) {
  const rows = kind === 'INTERNAL_EDGE' ? topology.internalEdges : topology.committedConnections;
  const key = kind === 'INTERNAL_EDGE' ? 'edgeId' : 'connectionId';
  return exactRow(rows, key, id, `${kind} relationship`,
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.RELATIONSHIP_MISSING);
}
function exactNode(topology, id) {
  return exactRow(topology.nodes, 'nodeId', id, 'Endpoint node',
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.NODE_MISSING);
}
function exactPort(topology, id) {
  return exactRow(topology.ports, 'portId', id, 'Endpoint port',
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.PORT_MISSING);
}
function assertPortBinding(node, port) {
  if (port.nodeId !== node.nodeId || !node.portIds.includes(port.portId)) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.PORT_NODE_MISMATCH,
    `Endpoint port ${port.portId} does not belong to node ${node.nodeId}.`);
}
function relationshipSide(kind, relationship, node, port) {
  const fromMatch = relationship.fromNodeId === node.nodeId;
  const toMatch = relationship.toNodeId === node.nodeId;
  if (kind === 'COMMITTED_CONNECTION') {
    if (fromMatch && relationship.fromPortId === port.portId) return 'FROM';
    if (toMatch && relationship.toPortId === port.portId) return 'TO';
  } else if (fromMatch !== toMatch) return fromMatch ? 'FROM' : 'TO';
  fail(SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.RELATIONSHIP_SIDE_INVALID,
    `Endpoint node and port do not identify one exact ${kind} relationship side.`);
}
function assertComponentOwnership(kind, relationship, port) {
  if (kind === 'INTERNAL_EDGE' && relationship.componentId !== port.componentId) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.COMPONENT_OWNERSHIP_INVALID,
    `Port ${port.portId} is not owned by internal-edge component ${relationship.componentId}.`);
}
function sortedUnique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function relationshipId(kind, row) { return kind === 'INTERNAL_EDGE' ? row.edgeId : row.connectionId; }
function relationshipEvidence(kind, row) {
  return { kind, relationshipId: relationshipId(kind, row), canonicalRecord: row,
    fromNodeId: row.fromNodeId, toNodeId: row.toNodeId,
    fromPortId: row.fromPortId || null, toPortId: row.toPortId || null,
    componentId: row.componentId || null, geometryPartId: row.geometryPartId || null,
    nodeRelation: row.nodeRelation || null, status: row.status || null };
}
function nodeEvidence(node, side) {
  return { side, nodeId: node.nodeId, position: node.position, degree: node.degree,
    boundaryClass: node.boundaryClass, positionProvenance: node.positionProvenance,
    portIds: sortedUnique(node.portIds), incidentComponentIds: sortedUnique(node.incidentComponentIds),
    incidentGeometryPartIds: sortedUnique(node.incidentGeometryPartIds),
    incidentEdgeIds: sortedUnique(node.incidentEdgeIds),
    committedConnectionIds: sortedUnique(node.committedConnectionIds) };
}
function portConnectionIds(topology, portId) {
  return topology.committedConnections.filter((row) =>
    row.fromPortId === portId || row.toPortId === portId).map((row) => row.connectionId);
}
function portEvidence(topology, port, side) {
  return { side, portId: port.portId, nodeId: port.nodeId, componentId: port.componentId,
    branchId: port.branchId || null, role: port.role || null, position: port.position,
    connectionIds: sortedUnique(portConnectionIds(topology, port.portId)) };
}
function oppositeEvidence(topology, kind, relationship, side) {
  const nodeId = side === 'FROM' ? relationship.toNodeId : relationship.fromNodeId;
  const portId = kind === 'COMMITTED_CONNECTION'
    ? (side === 'FROM' ? relationship.toPortId : relationship.fromPortId) : null;
  const node = exactNode(topology, nodeId);
  const port = portId ? exactPort(topology, portId) : null;
  return { node: nodeEvidence(node, side === 'FROM' ? 'TO' : 'FROM'),
    port: port ? portEvidence(topology, port, side === 'FROM' ? 'TO' : 'FROM') : null,
    candidatePortIds: port ? [port.portId] : sortedUnique(node.portIds) };
}
function affectedRecords(topology, relationship, endpoint, opposite) {
  const componentIds = sortedUnique([
    relationship.componentId, endpoint.port.componentId, opposite.port?.componentId,
    ...endpoint.node.incidentComponentIds, ...opposite.node.incidentComponentIds,
  ]);
  const components = topology.components.filter((row) => componentIds.includes(row.componentId));
  const connectionIds = sortedUnique([...endpoint.node.committedConnectionIds,
    ...opposite.node.committedConnectionIds, relationship.connectionId]);
  return { componentIds, branchIds: sortedUnique(components.map((row) => row.branchId)),
    geometryPartIds: sortedUnique(components.flatMap((row) => row.geometryPartIds)),
    internalEdgeIds: sortedUnique(components.flatMap((row) => row.internalEdgeIds)),
    connectionIds, supportAttachmentIds: sortedUnique(components.flatMap((row) => row.supportAttachmentIds)),
    boundaryCutIds: sortedUnique(topology.componentBoundaryCuts.filter((row) =>
      componentIds.includes(row.componentId) || connectionIds.includes(row.connectionId))
      .map((row) => row.boundaryCutId)),
    repairIds: sortedUnique(topology.repairs.filter((row) =>
      connectionIds.includes(row.connectionId) || [endpoint.node.nodeId, opposite.node.nodeId]
        .includes(row.fromNodeId) || [endpoint.node.nodeId, opposite.node.nodeId].includes(row.toNodeId))
      .map((row) => row.repairId)) };
}
function blocker(code, ids, message) { return { code, entityIds: sortedUnique(ids), message }; }
function boundaryBlockers(endpoint) {
  if (endpoint.node.boundaryClass === 'EXTERNAL_BOUNDARY') return [blocker(
    'EXTERNAL_BOUNDARY', [endpoint.node.nodeId], 'Disconnect would alter an external boundary.')];
  if (endpoint.node.boundaryClass === 'REPAIR_BOUNDARY') return [blocker(
    'REPAIR_BOUNDARY', [endpoint.node.nodeId], 'Disconnect would alter repair-mediated continuity.')];
  return [];
}
function impactBlockers(kind, relationship, endpoint, affected) {
  const targetId = relationshipId(kind, relationship);
  const otherRelationships = [...endpoint.node.incidentEdgeIds, ...endpoint.node.committedConnectionIds]
    .filter((id) => id !== targetId);
  const expectedConnections = kind === 'COMMITTED_CONNECTION' ? [targetId] : [];
  const unexpectedPortConnections = endpoint.port.connectionIds
    .filter((id) => !expectedConnections.includes(id));
  return [
    ...(kind === 'INTERNAL_EDGE' ? [blocker('INTERNAL_COMPONENT_FRAGMENTATION',
      [targetId, relationship.componentId], 'Detaching an internal edge would fragment one component.')] : []),
    ...(relationship.nodeRelation === 'REPAIR_MEDIATED_CONTINUITY' || affected.repairIds.length
      ? [blocker('REPAIR_MEDIATED_CONTINUITY', [targetId, ...affected.repairIds],
        'Mapped relationship participates in repair-mediated continuity.')] : []),
    ...boundaryBlockers(endpoint),
    ...(affected.supportAttachmentIds.length ? [blocker('SUPPORTED_COMPONENT',
      affected.supportAttachmentIds, 'Affected components carry support attachments.')] : []),
    ...(otherRelationships.length > 1 ? [blocker('SHARED_NODE_FANOUT',
      [endpoint.node.nodeId, ...otherRelationships], 'Endpoint node has multiple remaining relationships.')] : []),
    ...(unexpectedPortConnections.length ? [blocker('PORT_RELATIONSHIP_AMBIGUITY',
      [endpoint.port.portId, ...unexpectedPortConnections],
      'Endpoint port participates in another committed relationship.')] : []),
  ];
}
function reviewFlags(request, relationship, endpoint, affected) {
  const opposite = relationship.opposite.node;
  const coincident = endpoint.node.nodeId !== opposite.nodeId
    && ['x', 'y', 'z'].every((axis) => endpoint.node.position[axis] === opposite.position[axis]);
  return [
    ...(request.selectedEndpoint.endpoint !== endpoint.side ? ['VALIDATOR_SIDE_DIFFERS_FROM_SEQUENTIAL_SIDE'] : []),
    ...(affected.branchIds.length > 1 ? ['CROSS_BRANCH_IMPACT'] : []),
    ...(affected.boundaryCutIds.length ? ['BOUNDARY_CUT_PRESENT'] : []),
    ...(coincident ? ['COINCIDENT_DISTINCT_ENDPOINT_NODES'] : []),
    ...(endpoint.node.degree > 1 ? ['ENDPOINT_HAS_REMAINING_RELATIONSHIP'] : []),
  ];
}
function previewMaterial(topology, request, kind, row, node, port, side) {
  const endpoint = { side, node: nodeEvidence(node, side), port: portEvidence(topology, port, side) };
  const opposite = oppositeEvidence(topology, kind, row, side);
  const relationship = { ...relationshipEvidence(kind, row), opposite };
  const affected = affectedRecords(topology, row, endpoint, opposite);
  const blockers = impactBlockers(kind, row, endpoint, affected)
    .sort((left, right) => left.code.localeCompare(right.code));
  return { schema: SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_PREVIEW_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    topologyAuthority: { authorityId: topology.authority.authorityId,
      topologyFingerprint: topology.topologyFingerprint, geometryFingerprint: topology.geometryFingerprint,
      ancestryFingerprint: topology.ancestryFingerprint, snapshotFingerprint: topology.snapshotFingerprint },
    mapping: { validatorEdgeId: request.sourceCommand.payload.edgeId,
      validatorEndpoint: request.sourceCommand.payload.endpoint,
      sequentialRelationshipKind: kind, sequentialRelationshipId: relationshipId(kind, row),
      sequentialEndpointNodeId: node.nodeId, sequentialEndpointPortId: port.portId,
      sequentialRelationshipSide: side, disposition: 'EXPLICIT_OPERATOR_SELECTION' },
    validatorSourceEdge: request.sourceEdge, validatorSelectedEndpoint: request.selectedEndpoint,
    relationship, endpoint, affected, blockers,
    reviewFlags: reviewFlags(request, relationship, endpoint, affected),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    applicationDisposition: 'REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY',
    currentNativeDisconnectAuthority: 'UNAVAILABLE', candidateNativeOperation: null,
    publicationState: 'NOT_PUBLISHED' };
}
export function parseSequentialDisconnectEndpointRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator disconnect request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}
export function createSequentialDisconnectEndpointImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput); const request = exactRequest(input.request);
  const kind = relationshipKind(input.sequentialRelationshipKind);
  const id = requiredText(input.sequentialRelationshipId, 'sequentialRelationshipId');
  const nodeId = requiredText(input.sequentialEndpointNodeId, 'sequentialEndpointNodeId');
  const portId = requiredText(input.sequentialEndpointPortId, 'sequentialEndpointPortId');
  const relationship = exactRelationship(topology, kind, id);
  const node = exactNode(topology, nodeId); const port = exactPort(topology, portId);
  assertPortBinding(node, port); assertComponentOwnership(kind, relationship, port);
  const side = relationshipSide(kind, relationship, node, port);
  const material = previewMaterial(topology, request, kind, relationship, node, port, side);
  return immutableJson({ ...material,
    previewFingerprint: sequentialSemanticFingerprint('SSKDISCONNECTIMPACT', material) },
  'Sequential DISCONNECT_ENDPOINT impact preview');
}
function previewInvariant(value) {
  const mapping = value.mapping || {}; const relationship = value.relationship || {};
  const endpoint = value.endpoint || {}; const opposite = relationship.opposite || {};
  const record = relationship.canonicalRecord || {}; const kind = mapping.sequentialRelationshipKind;
  const id = relationshipId(kind, record); const side = mapping.sequentialRelationshipSide;
  const nodeId = side === 'FROM' ? record.fromNodeId : record.toNodeId;
  const otherNodeId = side === 'FROM' ? record.toNodeId : record.fromNodeId;
  const portId = kind === 'COMMITTED_CONNECTION'
    ? (side === 'FROM' ? record.fromPortId : record.toPortId) : endpoint.port?.portId;
  const otherPortId = side === 'FROM' ? record.toPortId : record.fromPortId;
  return SEQUENTIAL_DISCONNECT_ENDPOINT_RELATIONSHIP_KINDS.includes(kind)
    && mapping.sequentialRelationshipId === id && relationship.relationshipId === id && relationship.kind === kind
    && relationship.fromNodeId === record.fromNodeId && relationship.toNodeId === record.toNodeId
    && mapping.sequentialRelationshipSide === endpoint.side && endpoint.node?.nodeId === nodeId
    && mapping.sequentialEndpointNodeId === nodeId && endpoint.port?.nodeId === nodeId
    && endpoint.port?.portId === portId && mapping.sequentialEndpointPortId === portId
    && opposite.node?.nodeId === otherNodeId && (kind !== 'COMMITTED_CONNECTION' || opposite.port?.portId === otherPortId)
    && (kind !== 'INTERNAL_EDGE' || endpoint.port?.componentId === record.componentId)
    && mapping.validatorEdgeId === value.validatorSourceEdge?.edgeId
    && mapping.validatorEndpoint === value.validatorSelectedEndpoint?.endpoint
    && value.applicationDisposition === 'REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY'
    && value.currentNativeDisconnectAuthority === 'UNAVAILABLE'
    && value.candidateNativeOperation === null && value.publicationState === 'NOT_PUBLISHED';
}
export function assertSequentialDisconnectEndpointImpact(value) {
  if (value?.schema !== SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_PREVIEW_SCHEMA) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.PREVIEW_INVALID,
    `Disconnect preview must use ${SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_PREVIEW_SCHEMA}.`, TypeError);
  const material = { ...value }; delete material.previewFingerprint;
  if (!previewInvariant(value) || !sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKDISCONNECTIMPACT', material))) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Disconnect preview differs from immutable relationship authority evidence.');
  immutableJson(value, 'Sequential DISCONNECT_ENDPOINT impact preview'); return value;
}
export function validateSequentialDisconnectEndpointImpact(value, topology, input = {}) {
  const preview = assertSequentialDisconnectEndpointImpact(value);
  const rebuilt = createSequentialDisconnectEndpointImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_DISCONNECT_ENDPOINT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Disconnect preview differs from current topology regeneration.');
  return rebuilt;
}
