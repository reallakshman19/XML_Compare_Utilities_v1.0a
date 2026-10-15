/** Pure structural-impact evidence for an explicit Sequential MERGE_NODES request mapping. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { assertTopologySequentialMergeNodesRequest } from '../../topology-trace-validator/topology-sequential-merge-nodes-request.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_MERGE_NODES_IMPACT_PREVIEW_SCHEMA =
  'SequentialMergeNodesImpactPreview.v1';

export const SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION = Object.freeze({
  REQUEST_INVALID: 'SEQUENTIAL_MERGE_NODES_REQUEST_INVALID',
  TOPOLOGY_INVALID: 'SEQUENTIAL_MERGE_NODES_TOPOLOGY_INVALID',
  EXPLICIT_IDENTITY_REQUIRED: 'SEQUENTIAL_MERGE_NODES_EXPLICIT_IDENTITY_REQUIRED',
  SAME_NODE: 'SEQUENTIAL_MERGE_NODES_SAME_NODE',
  NODE_MISSING: 'SEQUENTIAL_MERGE_NODES_NODE_MISSING',
  PREVIEW_INVALID: 'SEQUENTIAL_MERGE_NODES_PREVIEW_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.EXPLICIT_IDENTITY_REQUIRED,
    `${label} is required.`, TypeError);
  return result;
}

function exactRequest(value) {
  try {
    const request = assertTopologySequentialMergeNodesRequest(value);
    if (request.sourceCommand?.type !== 'MERGE_NODES'
      || request.sequentialIntent?.requiredOperation !== 'MERGE_NODES'
      || request.sequentialIntent?.automaticIdentityMapping !== false) {
      throw new TypeError('Request does not preserve explicit MERGE_NODES authority.');
    }
    return request;
  } catch (error) {
    fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator merge request is invalid: ${error.message || String(error)}`, TypeError);
  }
}

function exactTopology(value) {
  if (value?.schema !== 'SequentialEditableTopologySnapshot.v1') {
    fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.TOPOLOGY_INVALID,
      'Merge impact requires SequentialEditableTopologySnapshot.v1.', TypeError);
  }
  return value;
}

function exactNode(topology, nodeId, label) {
  const node = topology.nodes.find((row) => row.nodeId === nodeId);
  if (!node) fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.NODE_MISSING,
    `${label} is unavailable in current Sequential topology: ${nodeId}`);
  return node;
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function vector(source, target) {
  return {
    x: target.position.x - source.position.x,
    y: target.position.y - source.position.y,
    z: target.position.z - source.position.z,
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

function affectedRecords(topology, nodes) {
  const componentIds = sortedUnique(nodes.flatMap((row) => row.incidentComponentIds));
  const components = topology.components.filter((row) => componentIds.includes(row.componentId));
  return {
    componentIds,
    geometryPartIds: sortedUnique(nodes.flatMap((row) => row.incidentGeometryPartIds)),
    portIds: sortedUnique(nodes.flatMap((row) => row.portIds)),
    internalEdgeIds: sortedUnique(nodes.flatMap((row) => row.incidentEdgeIds)),
    connectionIds: sortedUnique(nodes.flatMap((row) => row.committedConnectionIds)),
    supportAttachmentIds: sortedUnique(components.flatMap((row) => row.supportAttachmentIds)),
    branchIds: sortedUnique(components.map((row) => row.branchId)),
  };
}

function pairMatch(row, sourceId, targetId) {
  return (row.fromNodeId === sourceId && row.toNodeId === targetId)
    || (row.fromNodeId === targetId && row.toNodeId === sourceId);
}

function blocker(code, entityIds, message) {
  return { code, entityIds: sortedUnique(entityIds), message };
}

function boundaryBlockers(source, target) {
  return [source, target].flatMap((node) => {
    if (node.boundaryClass === 'REPAIR_BOUNDARY') return [blocker(
      'REPAIR_BOUNDARY', [node.nodeId], 'Merge would cross repair-mediated continuity.',
    )];
    if (node.boundaryClass === 'EXTERNAL_BOUNDARY') return [blocker(
      'EXTERNAL_BOUNDARY', [node.nodeId], 'Merge would alter an external boundary.',
    )];
    return [];
  });
}

function relationshipBlockers(topology, source, target, affected) {
  const shared = source.incidentComponentIds
    .filter((componentId) => target.incidentComponentIds.includes(componentId));
  const directEdges = topology.internalEdges
    .filter((row) => pairMatch(row, source.nodeId, target.nodeId)).map((row) => row.edgeId);
  const directConnections = topology.committedConnections
    .filter((row) => pairMatch(row, source.nodeId, target.nodeId)).map((row) => row.connectionId);
  return [
    ...(shared.length ? [blocker('SHARED_COMPONENT_COLLAPSE', shared,
      'Merge would collapse geometry inside a shared component.')] : []),
    ...(directEdges.length ? [blocker('INTERNAL_EDGE_COLLAPSE', directEdges,
      'Merge would collapse an existing internal edge.')] : []),
    ...(directConnections.length ? [blocker('COMMITTED_CONNECTION_COLLAPSE', directConnections,
      'Merge would collapse an existing committed connection.')] : []),
    ...(affected.supportAttachmentIds.length ? [blocker('SUPPORTED_COMPONENT',
      affected.supportAttachmentIds, 'Affected components carry support attachments.')] : []),
  ];
}

function reviewFlags(source, target, affected) {
  const coincident = ['x', 'y', 'z'].every((axis) => source.position[axis] === target.position[axis]);
  return [
    ...(coincident ? ['COINCIDENT_DISTINCT_NODES'] : []),
    ...(affected.branchIds.length > 1 ? ['CROSS_BRANCH_IMPACT'] : []),
    ...(source.boundaryClass !== target.boundaryClass ? ['MIXED_BOUNDARY_CLASS'] : []),
  ];
}

function previewMaterial(topology, request, source, target) {
  const sourceEvidence = nodeEvidence(source, 'RETIRED');
  const targetEvidence = nodeEvidence(target, 'RETAINED');
  const affected = affectedRecords(topology, [sourceEvidence, targetEvidence]);
  const blockers = [...boundaryBlockers(sourceEvidence, targetEvidence),
    ...relationshipBlockers(topology, sourceEvidence, targetEvidence, affected)]
    .sort((left, right) => left.code.localeCompare(right.code));
  const displacement = vector(sourceEvidence, targetEvidence);
  return {
    schema: SEQUENTIAL_MERGE_NODES_IMPACT_PREVIEW_SCHEMA,
    requestFingerprint: request.requestFingerprint,
    topologyAuthority: {
      authorityId: topology.authority.authorityId,
      topologyFingerprint: topology.topologyFingerprint,
      geometryFingerprint: topology.geometryFingerprint,
      ancestryFingerprint: topology.ancestryFingerprint,
      snapshotFingerprint: topology.snapshotFingerprint,
    },
    mapping: {
      validatorSourceNodeId: request.sourceCommand.payload.sourceNodeId,
      validatorTargetNodeId: request.sourceCommand.payload.targetNodeId,
      sequentialSourceNodeId: source.nodeId,
      sequentialTargetNodeId: target.nodeId,
      disposition: 'EXPLICIT_OPERATOR_SELECTION',
    },
    nodes: [sourceEvidence, targetEvidence],
    displacement, separationMm: Math.hypot(displacement.x, displacement.y, displacement.z),
    affected, blockers, reviewFlags: reviewFlags(sourceEvidence, targetEvidence, affected),
    impactStatus: blockers.length ? 'BLOCKED' : 'REVIEWABLE',
    applicationDisposition: 'REQUIRES_QUALIFIED_STRUCTURAL_JOURNAL',
    publicationState: 'NOT_PUBLISHED',
  };
}

export function parseSequentialMergeNodesRequestText(text) {
  try { return exactRequest(JSON.parse(String(text))); }
  catch (error) {
    if (error.code) throw error;
    fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.REQUEST_INVALID,
      `Validator merge request JSON is invalid: ${error.message || String(error)}`, TypeError);
  }
}

export function createSequentialMergeNodesImpact(topologyInput, input = {}) {
  const topology = exactTopology(topologyInput);
  const request = exactRequest(input.request);
  const sourceId = requiredText(input.sequentialSourceNodeId, 'sequentialSourceNodeId');
  const targetId = requiredText(input.sequentialTargetNodeId, 'sequentialTargetNodeId');
  if (sourceId === targetId) fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.SAME_NODE,
    'Sequential merge preview requires two distinct nodes.');
  const material = previewMaterial(topology, request,
    exactNode(topology, sourceId, 'Source node'), exactNode(topology, targetId, 'Target node'));
  return immutableJson({ ...material,
    previewFingerprint: sequentialSemanticFingerprint('SSKMERGEIMPACT', material) },
  'Sequential MERGE_NODES impact preview');
}

export function assertSequentialMergeNodesImpact(value) {
  if (value?.schema !== SEQUENTIAL_MERGE_NODES_IMPACT_PREVIEW_SCHEMA) {
    fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.PREVIEW_INVALID,
      `Merge impact preview must use ${SEQUENTIAL_MERGE_NODES_IMPACT_PREVIEW_SCHEMA}.`, TypeError);
  }
  const material = { ...value }; delete material.previewFingerprint;
  if (!sameSequentialContractValue(value.previewFingerprint,
    sequentialSemanticFingerprint('SSKMERGEIMPACT', material))) {
    fail(SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.PREVIEW_INVALID,
      'Merge impact preview fingerprint is invalid.');
  }
  immutableJson(value, 'Sequential MERGE_NODES impact preview'); return value;
}

export function validateSequentialMergeNodesImpact(value, topology, input = {}) {
  const preview = assertSequentialMergeNodesImpact(value);
  const rebuilt = createSequentialMergeNodesImpact(topology, input);
  if (!sameSequentialContractValue(preview, rebuilt)) fail(
    SEQUENTIAL_MERGE_NODES_IMPACT_REJECTION.PREVIEW_INVALID,
    'Merge impact preview differs from current topology regeneration.');
  return rebuilt;
}
