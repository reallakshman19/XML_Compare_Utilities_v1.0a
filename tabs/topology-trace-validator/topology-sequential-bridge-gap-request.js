/** Immutable export request from Topology Validator BRIDGE_GAP to Sequential connection review. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_SCHEMA =
  'TopologySequentialBridgeGapRequest.v1';

export const TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_DRAFT_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_NODE_INVALID',
  EDGE_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_EDGE_INVALID',
  SAME_NODE: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_SAME_NODE',
  DIRECT_EDGE_EXISTS: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_DIRECT_EDGE_EXISTS',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_INVALID',
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
    fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.NODE_INVALID,
      `${label} must contain finite x, y and z coordinates.`, TypeError);
  }
  return point;
}

function sourceBranchIndex(sourcePath) {
  const match = cleanText(sourcePath).match(/^\$(?:\.(?:objects|hierarchy|branches))?\[(\d+)\]/);
  return match ? Number(match[1]) : null;
}

function sourceEvidence(value) {
  const sourcePaths = [...new Set(asArray(value.sourcePaths).map(cleanText).filter(Boolean))].sort();
  const sourceBranchIndexes = [...new Set(sourcePaths.map(sourceBranchIndex)
    .filter((index) => index !== null))].sort((left, right) => left - right);
  return { sourcePaths, sourceBranchIndexes };
}

function canonicalEvidence(input) {
  const canonical = objectRecord(input.canonical);
  if (canonical.schema !== 'CanonicalTopology.v1') {
    fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.CANONICAL_INVALID,
      'BRIDGE_GAP request requires CanonicalTopology.v1.', TypeError);
  }
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') {
    fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.DRAFT_INVALID,
      'BRIDGE_GAP request requires TopologyEditDraft.v1.', TypeError);
  }
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function exactRecord(rows, id, kind, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${kind} is unavailable: ${id}`);
  return record;
}

function pairMatch(edge, fromNodeId, toNodeId) {
  return (cleanText(edge.fromNodeId) === fromNodeId && cleanText(edge.toNodeId) === toNodeId)
    || (cleanText(edge.fromNodeId) === toNodeId && cleanText(edge.toNodeId) === fromNodeId);
}

function assertGap(canonical, fromNodeId, toNodeId) {
  const direct = asArray(canonical.edges).map(objectRecord)
    .filter((edge) => pairMatch(edge, fromNodeId, toNodeId))
    .map((edge) => cleanText(edge.id)).filter(Boolean).sort();
  if (direct.length) fail(
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.DIRECT_EDGE_EXISTS,
    `BRIDGE_GAP endpoints already have direct edge evidence: ${direct.join(', ')}.`,
  );
}

function nodeEvidence(canonical, node, role) {
  const nodeId = cleanText(node.id);
  const incidentEdgeIds = asArray(canonical.edges).map(objectRecord)
    .filter((edge) => cleanText(edge.fromNodeId) === nodeId || cleanText(edge.toNodeId) === nodeId)
    .map((edge) => cleanText(edge.id)).filter(Boolean).sort();
  return {
    role, nodeId, position: finitePoint(node.position, `${role} node position`),
    incidentEdgeIds, ...sourceEvidence(node),
  };
}

function edgeEvidence(edge) {
  return {
    edgeId: cleanText(edge.id),
    fromNodeId: cleanText(edge.fromNodeId),
    toNodeId: cleanText(edge.toNodeId),
    canonicalRecord: edge,
    ...sourceEvidence(edge),
  };
}

function displacement(from, to) {
  return {
    x: to.position.x - from.position.x,
    y: to.position.y - from.position.y,
    z: to.position.z - from.position.z,
  };
}

function requestMaterial(input, canonical, currentDraftHash, authority, fromNode, toNode, contextEdge) {
  const from = nodeEvidence(canonical.canonical, fromNode, 'FROM');
  const to = nodeEvidence(canonical.canonical, toNode, 'TO');
  const vector = displacement(from, to);
  return {
    schema: TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'BRIDGE_GAP', payload: {
      fromNodeId: from.nodeId, toNodeId: to.nodeId, contextEdgeId: cleanText(contextEdge.id),
    } },
    validatorAuthority: {
      canonicalTopologyHash: canonical.hash,
      topologyEditDraftHash: currentDraftHash,
      commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName,
    },
    endpoints: [from, to],
    contextEdge: edgeEvidence(contextEdge),
    gap: { displacement: vector,
      separationMm: Math.hypot(vector.x, vector.y, vector.z) },
    sequentialIntent: {
      requiredOperation: 'BRIDGE_GAP',
      candidateNativeOperation: 'MANUAL_CONNECT',
      candidateNativeOperationIsDecisionBound: true,
      automaticIdentityMapping: false,
      requiredExplicitInputs: [
        'sequentialFromNodeId', 'sequentialToNodeId',
        'sequentialFromPortId', 'sequentialToPortId',
      ],
      applicationDisposition: 'REQUIRES_QUALIFIED_CONNECTION_AUTHORITY',
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

export function createTopologySequentialBridgeGapRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const fromNodeId = requiredText(input.fromNodeId, 'fromNodeId',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.NODE_INVALID);
  const toNodeId = requiredText(input.toNodeId, 'toNodeId',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.NODE_INVALID);
  if (fromNodeId === toNodeId) fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.SAME_NODE,
    'BRIDGE_GAP request requires two distinct nodes.');
  const contextEdgeId = requiredText(input.contextEdgeId, 'contextEdgeId',
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.EDGE_INVALID);
  assertGap(canonical.canonical, fromNodeId, toNodeId);
  const authority = authorityEvidence(input);
  const material = requestMaterial(input, canonical, draftHash(input), authority,
    exactRecord(canonical.canonical.nodes, fromNodeId, 'node',
      TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.NODE_INVALID),
    exactRecord(canonical.canonical.nodes, toNodeId, 'node',
      TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.NODE_INVALID),
    exactRecord(canonical.canonical.edges, contextEdgeId, 'context edge',
      TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.EDGE_INVALID));
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential BRIDGE_GAP request');
}

export function assertTopologySequentialBridgeGapRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_SCHEMA) {
    fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.REQUEST_INVALID,
      `BRIDGE_GAP request must use ${TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_SCHEMA}.`, TypeError);
  }
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'BRIDGE_GAP request');
  if (value.requestFingerprint !== semanticHash(material)
    || value.sourceCommand?.type !== 'BRIDGE_GAP'
    || value.sequentialIntent?.requiredOperation !== 'BRIDGE_GAP'
    || value.sequentialIntent?.automaticIdentityMapping !== false
    || value.sequentialIntent?.publicationState !== 'NOT_PUBLISHED') {
    fail(TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.REQUEST_INVALID,
      'BRIDGE_GAP request differs from canonical immutable authority evidence.');
  }
  return value;
}

export function validateTopologySequentialBridgeGapRequest(value, input = {}) {
  const request = assertTopologySequentialBridgeGapRequest(value);
  const rebuilt = createTopologySequentialBridgeGapRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_REQUEST_REJECTION.REQUEST_INVALID,
    'BRIDGE_GAP request differs from current canonical regeneration.');
  return rebuilt;
}

export function topologySequentialBridgeGapRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialBridgeGapRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const from = request.sourceCommand.payload.fromNodeId.replace(/[^a-z0-9_-]+/gi, '-');
  const to = request.sourceCommand.payload.toNodeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${from}-to-${to}.topology-sequential-bridge-gap-request.v1.json`;
}
