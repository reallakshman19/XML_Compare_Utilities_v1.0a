/** Pure connection-impact evidence for an explicit Sequential BRIDGE_GAP request mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialBridgeGapRequest } from '../../topology-trace-validator/topology-sequential-bridge-gap-request.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_BRIDGE_GAP_IMPACT_PREVIEW_SCHEMA =
  'SequentialBridgeGapImpactPreview.v1';

export const SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_BRIDGE_GAP_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_BRIDGE_GAP_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_BRIDGE_GAP_EXPLICIT_IDENTITY_REQUIRED',
  SAME_NODE: 'SEQUENTIAL_BRIDGE_GAP_SAME_NODE',
  SAME_PORT: 'SEQUENTIAL_BRIDGE_GAP_SAME_PORT',
  NODE_MISSING: 'SEQUENTIAL_BRIDGE_GAP_NODE_MISSING',
  PORT_MISSING: 'SEQUENTIAL_BRIDGE_GAP_PORT_MISSING',
  PORT_NODE_MISMATCH: 'SEQUENTIAL_BRIDGE_GAP_PORT_NODE_MISMATCH',
  PREVIEW_INVALID: 'SEQUENTIAL_BRIDGE_GAP_PREVIEW_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}

function exactRequest(value) {
  try {
    const request = assertTopologySequentialBridgeGapRequest(value);
    const intent = request.sequentialIntent;
    if (intent?.requiredOperation !== 'BRIDGE_GAP'
      || intent?.candidateNativeOperation !== 'MANUAL_CONNECT'
      || intent?.candidateNativeOperationIsDecisionBound !== true
      || intent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request does not preserve explicit BRIDGE_GAP authority.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator bridge request is invalid: ${error.message || String(error)}`, TypeError);
  }
}

function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') {
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.TOPOLOGY_INVALID,
      'Bridge impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  }
  return value;
}

function exactRow(rows, key, id, label, code) {
  const row = rows.find((item) => item[key] === id);
  if (!row) fail(code, `${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}

function exactNode(topology, nodeId, label) {
  return exactRow(topology.nodes, 'nodeId', nodeId, label,
    SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.NODE_MISSING);
}

function exactPort(topology, portId, label) {
  return exactRow(topology.ports, 'portId', portId, label,
    SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.PORT_MISSING);
}

function assertPortBinding(node, port, label) {
  if (port.nodeId !== node.nodeId || !node.portIds.includes(port.portId)) {
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.PORT_NODE_MISMATCH,
      `${label} ${port.portId} does not belong to node ${node.nodeId}.`);
  }
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function pairMatch(row, fromId, toId, fromKey, toKey) {
  return (row[fromKey] === fromId && row[toKey] === toId)
    || (row[fromKey] === toId && row[toKey] === fromId);
}

function vector(from, to) {
  return {
    x: to.position.x - from.position.x,
    y: to.position.y - from.position.y,
    z: to.position.z - from.position.z,
  };
}

function nodeEvidence(node, role) {
  return {
    role, nodeId: node.nodeId, position: node.position, degree: node.degree,
    boundaryClass: node.boundaryClass, positionProvenance: node.positionProvenance,
    portIds: sortedUnique(node.portIds),
    incidentComponentIds: sortedUnique(node.incidentComponentIds),
    incidentGeometryPartIds: sortedUnique(node.incidentGeometryPartIds),
    incidentEdgeIds: sortedUnique(node.incidentEdgeIds),
    committedConnectionIds: sortedUnique(node.committedConnectionIds),
  };
}

function portConnections(topology, portId) {
  return topology.committedConnections.filter((row) => (
    row.fromPortId === portId || row.toPortId === portId
  ));
}

function portEvidence(topology, port, role) {
  const connections = portConnections(topology, port.portId);
  return {
    role, portId: port.portId, nodeId: port.nodeId,
    componentId: port.componentId, position: port.position,
    connectionIds: sortedUnique(connections.map((row) => row.connectionId)),
  };
}

function affectedRecords(topology, nodes, ports) {
  const componentIds = sortedUnique([
    ...nodes.flatMap((row) => row.incidentComponentIds),
    ...ports.map((row) => row.componentId),
  ]);
  const components = topology.components.filter((row) => componentIds.includes(row.componentId));
  return {
    componentIds,
    branchIds: sortedUnique(components.map((row) => row.branchId)),
    geometryPartIds: sortedUnique(nodes.flatMap((row) => row.incidentGeometryPartIds)),
    internalEdgeIds: sortedUnique(nodes.flatMap((row) => row.incidentEdgeIds)),
    connectionIds: sortedUnique([
      ...nodes.flatMap((row) => row.committedConnectionIds),
      ...ports.flatMap((row) => row.connectionIds),
    ]),
    supportAttachmentIds: sortedUnique(components.flatMap((row) => row.supportAttachmentIds)),
  };
}

function blocker(code, entityIds, message) {
  return { code, entityIds: sortedUnique(entityIds), message };
}

function boundaryBlockers(from, to) {
  return [from, to].flatMap((node) => {
    if (node.boundaryClass === 'REPAIR_BOUNDARY') return [blocker(
      'REPAIR_BOUNDARY', [node.nodeId], 'Bridge would cross repair-mediated continuity.',
    )];
    if (node.boundaryClass === 'EXTERNAL_BOUNDARY') return [blocker(
      'EXTERNAL_BOUNDARY', [node.nodeId], 'Bridge would alter an external boundary.',
    )];
    return [];
  });
}

function relationshipBlockers(topology, from, to, ports, affected) {
  const directEdges = topology.internalEdges.filter((row) => (
    pairMatch(row, from.nodeId, to.nodeId, 'fromNodeId', 'toNodeId')
  )).map((row) => row.edgeId);
  const directConnections = topology.committedConnections.filter((row) => (
    pairMatch(row, from.nodeId, to.nodeId, 'fromNodeId', 'toNodeId')
      || pairMatch(row, ports[0].portId, ports[1].portId, 'fromPortId', 'toPortId')
  )).map((row) => row.connectionId);
  const sharedComponents = from.incidentComponentIds
    .filter((componentId) => to.incidentComponentIds.includes(componentId));
  const occupied = ports.filter((port) => port.connectionIds.length);
  return [
    ...(directEdges.length ? [blocker('DIRECT_INTERNAL_EDGE_EXISTS', directEdges,
      'Endpoint nodes already share an internal edge.')] : []),
    ...(directConnections.length ? [blocker('DIRECT_COMMITTED_CONNECTION_EXISTS',
      directConnections, 'Endpoint nodes or ports are already committed together.')] : []),
    ...(sharedComponents.length ? [blocker('SAME_COMPONENT_LOOP', sharedComponents,
      'Bridge would create a loop within one existing component.')] : []),
    ...(occupied.length ? [blocker('PORT_ALREADY_CONNECTED',
      occupied.flatMap((port) => [port.portId, ...port.connectionIds]),
      'One or both selected ports already participate in committed connection evidence.')] : []),
    ...(affected.supportAttachmentIds.length ? [blocker('SUPPORTED_COMPONENT',
      affected.supportAttachmentIds, 'Affected components carry support attachments.')] : []),
  ];
}

function reviewFlags(from, to, affected) {
  const coincident = ['x', 'y', 'z'].every((axis) => from.position[axis] === to.position[axis]);
  return [
    ...(coincident ? ['COINCIDENT_DISTINCT_NODES'] : []),
    ...(affected.branchIds.length > 1 ? ['CROSS_BRANCH_IMPACT'] : []),
    ...(from.boundaryClass !== to.boundaryClass ? ['MIXED_BOUNDARY_CLASS'] : []),
  ];
}

function previewMaterial(topology, request, fromNode, toNode, fromPort, toPort) {
  const nodes = [nodeEvidence(fromNode, 'FROM'), nodeEvidence(toNode, 'TO')];
  const ports = [portEvidence(topology, fromPort, 'FROM'), portEvidence(topology, toPort, 'TO')];
  const affected = affectedRecords(topology, nodes, ports);
  const blockers = [...boundaryBlockers(...nodes),
    ...relationshipBlockers(topology, ...nodes, ports, affected)]
    .sort((left, right) => left.code.localeCompare(right.code));
  const displacement = vector(nodes[0], nodes[1]);
  return {
    schema: SEQUENTIAL_BRIDGE_GAP_IMPACT_PREVIEW_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    topologyAuthority: {
      authorityId: topology.authority.authorityId,
      topologyFingerprint: topology.topologyFingerprint,
      geometryFingerprint: topology.geometryFingerprint,
      ancestryFingerprint: topology.ancestryFingerprint,
      snapshotFingerprint: topology.snapshotFingerprint,
    },
    mapping: {
      validatorFromNodeId: request.sourceCommand.payload.fromNodeId,
      validatorToNodeId: request.sourceCommand.payload.toNodeId,
      sequentialFromNodeId: fromNode.nodeId,
      sequentialToNodeId: toNode.nodeId,
      sequentialFromPortId: fromPort.portId,
      sequentialToPortId: toPort.portId,
      disposition: 'EXPLICIT_OPERATOR_SELECTION',
    },
    validatorContextEdge: request.contextEdge,
    nodes, ports, displacement,
    separationMm: Math.hypot(displacement.x, displacement.y, displacement.z),
    affected, blockers, reviewFlags: reviewFlags(...nodes, affected),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    applicationDisposition: 'REQUIRES_QUALIFIED_CONNECTION_AUTHORITY',
    candidateNativeOperation: 'MANUAL_CONNECT',
    candidateNativeOperationIsDecisionBound: true,
    publicationState: 'NOT_PUBLISHED',
  };
}

export function parseSequentialBridgeGapRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator bridge request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}

export function createSequentialBridgeGapImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput);
  const request = exactRequest(input.request);
  const fromNodeId = requiredText(input.sequentialFromNodeId, 'sequentialFromNodeId');
  const toNodeId = requiredText(input.sequentialToNodeId, 'sequentialToNodeId');
  const fromPortId = requiredText(input.sequentialFromPortId, 'sequentialFromPortId');
  const toPortId = requiredText(input.sequentialToPortId, 'sequentialToPortId');
  if (fromNodeId === toNodeId) fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.SAME_NODE,
    'Sequential bridge preview requires two distinct nodes.');
  if (fromPortId === toPortId) fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.SAME_PORT,
    'Sequential bridge preview requires two distinct ports.');
  const fromNode = exactNode(topology, fromNodeId, 'From node');
  const toNode = exactNode(topology, toNodeId, 'To node');
  const fromPort = exactPort(topology, fromPortId, 'From port');
  const toPort = exactPort(topology, toPortId, 'To port');
  assertPortBinding(fromNode, fromPort, 'From port');
  assertPortBinding(toNode, toPort, 'To port');
  const material = previewMaterial(topology, request, fromNode, toNode, fromPort, toPort);
  return immutableJson({ ...material,
    previewFingerprint: sequentialSemanticFingerprint('SSKBRIDGEIMPACT', material) },
  'Sequential BRIDGE_GAP impact preview');
}

export function assertSequentialBridgeGapImpact(value) {
  if (value?.schema !== SEQUENTIAL_BRIDGE_GAP_IMPACT_PREVIEW_SCHEMA) {
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.PREVIEW_INVALID,
      `Bridge impact preview must use ${SEQUENTIAL_BRIDGE_GAP_IMPACT_PREVIEW_SCHEMA}.`, TypeError);
  }
  const material = { ...value }; delete material.previewFingerprint;
  if (!sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKBRIDGEIMPACT', material))) {
    fail(SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.PREVIEW_INVALID,
      'Bridge impact preview fingerprint is invalid.');
  }
  immutableJson(value, 'Sequential BRIDGE_GAP impact preview'); return value;
}

export function validateSequentialBridgeGapImpact(value, topology, input = {}) {
  const preview = assertSequentialBridgeGapImpact(value);
  const rebuilt = createSequentialBridgeGapImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_BRIDGE_GAP_IMPACT_REJECTION.PREVIEW_INVALID,
    'Bridge impact preview differs from current topology regeneration.');
  return rebuilt;
}
