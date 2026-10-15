/** Immutable export request from Topology Validator MERGE_NODES to Sequential structural editing. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_SCHEMA =
  'TopologySequentialMergeNodesRequest.v1';

export const TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_DRAFT_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_NODE_INVALID',
  SAME_NODE: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_SAME_NODE',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label, code) {
  const result = cleanText(value);
  if (!result) fail(code, `${label} is required.`, TypeError);
  return result;
}

function finitePoint(value, label) {
  const source = objectRecord(value);
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, Number(source[axis])]));
  if (!Object.values(point).every(Number.isFinite)) {
    fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.NODE_INVALID,
      `${label} must contain finite x, y and z coordinates.`, TypeError);
  }
  return Object.freeze(point);
}

function canonicalEvidence(input) {
  const canonical = objectRecord(input.canonical);
  if (canonical.schema !== 'CanonicalTopology.v1') {
    fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.CANONICAL_INVALID,
      'MERGE_NODES request requires CanonicalTopology.v1.', TypeError);
  }
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') {
    fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.DRAFT_INVALID,
      'MERGE_NODES request requires TopologyEditDraft.v1.', TypeError);
  }
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function exactNode(canonical, nodeId) {
  const node = asArray(canonical.nodes).map(objectRecord)
    .find((row) => cleanText(row.id) === nodeId);
  if (!node) fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.NODE_INVALID,
    `Canonical node is unavailable: ${nodeId}`);
  return node;
}

function sourceBranchIndex(sourcePath) {
  const match = cleanText(sourcePath).match(/^\$(?:\.(?:objects|hierarchy|branches))?\[(\d+)\]/);
  return match ? Number(match[1]) : null;
}

function nodeEvidence(canonical, node, role) {
  const nodeId = cleanText(node.id);
  const sourcePaths = [...new Set(asArray(node.sourcePaths).map(cleanText).filter(Boolean))].sort();
  const sourceBranchIndexes = [...new Set(sourcePaths.map(sourceBranchIndex)
    .filter((value) => value !== null))].sort((left, right) => left - right);
  const incidentEdgeIds = asArray(canonical.edges).map(objectRecord)
    .filter((edge) => cleanText(edge.fromNodeId) === nodeId || cleanText(edge.toNodeId) === nodeId)
    .map((edge) => cleanText(edge.id)).filter(Boolean).sort();
  return { role, nodeId, position: finitePoint(node.position, `${role} node position`),
    sourcePaths, sourceBranchIndexes, incidentEdgeIds };
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y, right.z - left.z);
}

function requestMaterial(input, canonical, currentDraftHash, authority, sourceNode, targetNode) {
  const retired = nodeEvidence(canonical.canonical, sourceNode, 'RETIRED');
  const retained = nodeEvidence(canonical.canonical, targetNode, 'RETAINED');
  return {
    schema: TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'MERGE_NODES', payload: {
      sourceNodeId: retired.nodeId, targetNodeId: retained.nodeId } },
    validatorAuthority: {
      canonicalTopologyHash: canonical.hash,
      topologyEditDraftHash: currentDraftHash,
      commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName,
    },
    sourceNodes: [retired, retained],
    separationMm: distance(retired.position, retained.position),
    sequentialIntent: {
      requiredOperation: 'MERGE_NODES',
      automaticIdentityMapping: false,
      requiredExplicitInputs: ['sequentialSourceNodeId', 'sequentialTargetNodeId'],
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

export function createTopologySequentialMergeNodesRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const sourceNodeId = requiredText(input.sourceNodeId, 'sourceNodeId',
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.NODE_INVALID);
  const targetNodeId = requiredText(input.targetNodeId, 'targetNodeId',
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.NODE_INVALID);
  if (sourceNodeId === targetNodeId) fail(
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.SAME_NODE,
    'MERGE_NODES request requires two distinct nodes.');
  const authority = authorityEvidence(input);
  const material = requestMaterial(input, canonical, draftHash(input), authority,
    exactNode(canonical.canonical, sourceNodeId), exactNode(canonical.canonical, targetNodeId));
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential MERGE_NODES request');
}

export function assertTopologySequentialMergeNodesRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_SCHEMA) {
    fail(TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.REQUEST_INVALID,
      `MERGE_NODES request must use ${TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_SCHEMA}.`, TypeError);
  }
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'MERGE_NODES request');
  if (value.requestFingerprint !== semanticHash(material)) fail(
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.REQUEST_INVALID,
    'MERGE_NODES request differs from canonical immutable fingerprint evidence.');
  return value;
}

export function validateTopologySequentialMergeNodesRequest(value, input = {}) {
  const request = assertTopologySequentialMergeNodesRequest(value);
  const rebuilt = createTopologySequentialMergeNodesRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_MERGE_NODES_REQUEST_REJECTION.REQUEST_INVALID,
    'MERGE_NODES request differs from current canonical regeneration.');
  return rebuilt;
}

export function topologySequentialMergeNodesRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialMergeNodesRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const source = request.sourceCommand.payload.sourceNodeId.replace(/[^a-z0-9_-]+/gi, '-');
  const target = request.sourceCommand.payload.targetNodeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${source}-to-${target}.topology-sequential-merge-nodes-request.v1.json`;
}
