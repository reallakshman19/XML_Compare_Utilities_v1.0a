/** Pure construction-impact evidence for an explicit Sequential ADD_STRAIGHT_ELEMENT request mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialAddStraightRequest } from '../../topology-trace-validator/topology-sequential-add-straight-request.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_ADD_STRAIGHT_IMPACT_PREVIEW_SCHEMA =
  'SequentialAddStraightImpactPreview.v1';
export const SEQUENTIAL_ADD_STRAIGHT_ALLOWED_TYPES = Object.freeze(['PIPE']);
export const SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_ADD_STRAIGHT_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_ADD_STRAIGHT_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_ADD_STRAIGHT_EXPLICIT_IDENTITY_REQUIRED',
  NODE_MISSING: 'SEQUENTIAL_ADD_STRAIGHT_NODE_MISSING',
  PORT_MISSING: 'SEQUENTIAL_ADD_STRAIGHT_PORT_MISSING',
  PORT_NODE_MISMATCH: 'SEQUENTIAL_ADD_STRAIGHT_PORT_NODE_MISMATCH',
  BRANCH_MISSING: 'SEQUENTIAL_ADD_STRAIGHT_BRANCH_MISSING',
  TYPE_INVALID: 'SEQUENTIAL_ADD_STRAIGHT_TYPE_INVALID',
  PREVIEW_INVALID: 'SEQUENTIAL_ADD_STRAIGHT_PREVIEW_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}
function exactRequest(value) {
  try {
    const request = assertTopologySequentialAddStraightRequest(value);
    const intent = request.sequentialIntent;
    if (intent?.requiredOperation !== 'ADD_STRAIGHT_ELEMENT'
      || intent?.candidateNativeOperation !== null
      || intent?.currentNativeConstructionAuthority !== 'UNAVAILABLE'
      || intent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request does not preserve explicit ADD_STRAIGHT_ELEMENT authority.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator add-straight request is invalid: ${error.message || String(error)}`, TypeError);
  }
}
function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') {
    fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.TOPOLOGY_INVALID,
      'Add-straight impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  }
  return value;
}
function exactRow(rows, key, id, label, code) {
  const row = rows.find((item) => item[key] === id);
  if (!row) fail(code, `${label} is unavailable in current Sequential topology: ${id}`);
  return row;
}
function exactNode(topology, nodeId) {
  return exactRow(topology.nodes, 'nodeId', nodeId, 'Start node',
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.NODE_MISSING);
}
function exactPort(topology, portId) {
  return exactRow(topology.ports, 'portId', portId, 'Start port',
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.PORT_MISSING);
}
function exactBranch(topology, branchId) {
  const branchIds = topology.branch?.branchIds || [];
  if (!branchIds.includes(branchId)) fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.BRANCH_MISSING,
    `Target branch is unavailable in current Sequential topology: ${branchId}`);
  return branchId;
}
function exactType(value) {
  const type = requiredText(value, 'newComponentCanonicalType').toUpperCase();
  if (!SEQUENTIAL_ADD_STRAIGHT_ALLOWED_TYPES.includes(type)) fail(
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.TYPE_INVALID,
    `ADD_STRAIGHT_ELEMENT currently accepts only ${SEQUENTIAL_ADD_STRAIGHT_ALLOWED_TYPES.join(', ')}; received ${type}.`);
  return type;
}
function assertPortBinding(node, port) {
  if (port.nodeId !== node.nodeId || !node.portIds.includes(port.portId)) {
    fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.PORT_NODE_MISMATCH,
      `Start port ${port.portId} does not belong to node ${node.nodeId}.`);
  }
}
function sortedUnique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function vector(from, to) {
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
}
function pointDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
function nodeEvidence(node) {
  return {
    nodeId: node.nodeId, position: node.position, degree: node.degree,
    boundaryClass: node.boundaryClass, positionProvenance: node.positionProvenance,
    portIds: sortedUnique(node.portIds), incidentComponentIds: sortedUnique(node.incidentComponentIds),
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
function portEvidence(topology, port) {
  const connections = portConnections(topology, port.portId);
  return {
    portId: port.portId, nodeId: port.nodeId, componentId: port.componentId,
    branchId: port.branchId, role: port.role || null, position: port.position,
    connectionIds: sortedUnique(connections.map((row) => row.connectionId)),
  };
}
function affectedRecords(topology, node, port) {
  const componentIds = sortedUnique([...node.incidentComponentIds, port.componentId]);
  const components = topology.components.filter((row) => componentIds.includes(row.componentId));
  return {
    componentIds, branchIds: sortedUnique(components.map((row) => row.branchId)),
    geometryPartIds: sortedUnique(node.incidentGeometryPartIds),
    internalEdgeIds: sortedUnique(node.incidentEdgeIds),
    connectionIds: sortedUnique([...node.committedConnectionIds, ...port.connectionIds]),
    supportAttachmentIds: sortedUnique(components.flatMap((row) => row.supportAttachmentIds)),
  };
}
function blocker(code, entityIds, message) {
  return { code, entityIds: sortedUnique(entityIds), message };
}
function boundaryBlockers(node) {
  if (node.boundaryClass === 'REPAIR_BOUNDARY') return [blocker(
    'REPAIR_BOUNDARY', [node.nodeId], 'Construction would originate at repair-mediated continuity.',
  )];
  if (node.boundaryClass === 'EXTERNAL_BOUNDARY') return [blocker(
    'EXTERNAL_BOUNDARY', [node.nodeId], 'Construction would alter an external boundary.',
  )];
  return [];
}
function relationshipBlockers(topology, node, port, branchId, affected, target) {
  const collisionIds = topology.nodes.filter((row) => row.nodeId !== node.nodeId
    && pointDistance(row.position, target) === 0).map((row) => row.nodeId);
  const branchMismatch = affected.branchIds.length && !affected.branchIds.includes(branchId);
  return [
    ...(port.connectionIds.length ? [blocker('PORT_ALREADY_CONNECTED',
      [port.portId, ...port.connectionIds], 'Selected start port already participates in committed connection evidence.')] : []),
    ...(affected.supportAttachmentIds.length ? [blocker('SUPPORTED_START_COMPONENT',
      affected.supportAttachmentIds, 'The start component carries support attachments.')] : []),
    ...(branchMismatch ? [blocker('TARGET_BRANCH_DISCONTINUITY',
      [branchId, ...affected.branchIds], 'Target branch does not match the mapped start-component branch.')] : []),
    ...(collisionIds.length ? [blocker('TARGET_NODE_COLLISION', collisionIds,
      'The proposed endpoint exactly coincides with an existing distinct Sequential node.')] : []),
  ];
}
function reviewFlags(request, node, port, branchId, affected) {
  const sourceOffsetMm = pointDistance(request.sourceNode.position, node.position);
  return [
    ...(sourceOffsetMm ? ['SOURCE_POSITION_MISMATCH'] : []),
    ...(port.branchId && port.branchId !== branchId ? ['PORT_BRANCH_DIFFERS_FROM_TARGET'] : []),
    ...(affected.branchIds.length > 1 ? ['MULTI_BRANCH_START_NODE'] : []),
    ...(node.boundaryClass === 'CONNECTED' ? ['CONNECTED_NODE_WITH_OPEN_SELECTED_PORT'] : []),
  ];
}
function previewMaterial(topology, request, nodeInput, portInput, canonicalType, branchId) {
  const node = nodeEvidence(nodeInput); const port = portEvidence(topology, portInput);
  const affected = affectedRecords(topology, node, port);
  const target = request.proposedSegment.targetPosition;
  const displacement = vector(node.position, target);
  const blockers = [...boundaryBlockers(node),
    ...relationshipBlockers(topology, node, port, branchId, affected, target)]
    .sort((left, right) => left.code.localeCompare(right.code));
  return {
    schema: SEQUENTIAL_ADD_STRAIGHT_IMPACT_PREVIEW_SCHEMA,
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
      sequentialFromNodeId: node.nodeId, sequentialFromPortId: port.portId,
      newComponentCanonicalType: canonicalType, targetBranchId: branchId,
      disposition: 'EXPLICIT_OPERATOR_SELECTION',
    },
    validatorContextEdge: request.contextEdge,
    validatorProposedSegment: request.proposedSegment,
    startNode: node, startPort: port,
    proposedSegment: { startPosition: node.position, targetPosition: target,
      displacement, lengthMm: Math.hypot(displacement.x, displacement.y, displacement.z) },
    sourcePositionOffsetMm: pointDistance(request.sourceNode.position, node.position),
    affected, blockers, reviewFlags: reviewFlags(request, node, port, branchId, affected),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    applicationDisposition: 'REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY',
    currentNativeConstructionAuthority: 'UNAVAILABLE',
    candidateNativeOperation: null,
    publicationState: 'NOT_PUBLISHED',
  };
}
export function parseSequentialAddStraightRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator add-straight request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}
export function createSequentialAddStraightImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput); const request = exactRequest(input.request);
  const nodeId = requiredText(input.sequentialFromNodeId, 'sequentialFromNodeId');
  const portId = requiredText(input.sequentialFromPortId, 'sequentialFromPortId');
  const type = exactType(input.newComponentCanonicalType);
  const branchId = exactBranch(topology, requiredText(input.targetBranchId, 'targetBranchId'));
  const node = exactNode(topology, nodeId); const port = exactPort(topology, portId);
  assertPortBinding(node, port);
  const material = previewMaterial(topology, request, node, port, type, branchId);
  return immutableJson({ ...material,
    previewFingerprint: sequentialSemanticFingerprint('SSKADDSTRAIGHTIMPACT', material) },
  'Sequential ADD_STRAIGHT_ELEMENT impact preview');
}
export function assertSequentialAddStraightImpact(value) {
  if (value?.schema !== SEQUENTIAL_ADD_STRAIGHT_IMPACT_PREVIEW_SCHEMA) fail(
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.PREVIEW_INVALID,
    `Add-straight preview must use ${SEQUENTIAL_ADD_STRAIGHT_IMPACT_PREVIEW_SCHEMA}.`, TypeError);
  const material = { ...value }; delete material.previewFingerprint;
  if (!sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKADDSTRAIGHTIMPACT', material))) fail(
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Add-straight preview fingerprint is invalid.');
  immutableJson(value, 'Sequential ADD_STRAIGHT_ELEMENT impact preview'); return value;
}
export function validateSequentialAddStraightImpact(value, topology, input = {}) {
  const preview = assertSequentialAddStraightImpact(value);
  const rebuilt = createSequentialAddStraightImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_ADD_STRAIGHT_IMPACT_REJECTION.PREVIEW_INVALID,
    'Add-straight preview differs from current topology regeneration.');
  return rebuilt;
}
