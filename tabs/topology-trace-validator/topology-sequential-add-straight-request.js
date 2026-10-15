/** Immutable export request from Topology Validator ADD_STRAIGHT_ELEMENT to Sequential construction review. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_SCHEMA =
  'TopologySequentialAddStraightRequest.v1';

export const TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_DRAFT_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_NODE_INVALID',
  EDGE_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_EDGE_INVALID',
  TARGET_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_TARGET_INVALID',
  ZERO_LENGTH: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_ZERO_LENGTH',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label, code) {
  const result = cleanText(value);
  if (!result) fail(code, `${label} is required.`, TypeError);
  return result;
}

function finitePoint(value, label, code) {
  const source = objectRecord(value);
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, Number(source[axis])]));
  if (!Object.values(point).every(Number.isFinite)) {
    fail(code, `${label} must contain finite x, y and z coordinates.`, TypeError);
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
    fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.CANONICAL_INVALID,
      'ADD_STRAIGHT_ELEMENT request requires CanonicalTopology.v1.', TypeError);
  }
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') {
    fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.DRAFT_INVALID,
      'ADD_STRAIGHT_ELEMENT request requires TopologyEditDraft.v1.', TypeError);
  }
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function exactRecord(rows, id, kind, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${kind} is unavailable: ${id}`);
  return record;
}

function nodeEvidence(canonical, node) {
  const nodeId = cleanText(node.id);
  const incidentEdgeIds = asArray(canonical.edges).map(objectRecord)
    .filter((edge) => cleanText(edge.fromNodeId) === nodeId || cleanText(edge.toNodeId) === nodeId)
    .map((edge) => cleanText(edge.id)).filter(Boolean).sort();
  return {
    nodeId, position: finitePoint(node.position, 'Source node position',
      TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.NODE_INVALID),
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

function segmentEvidence(source, target) {
  const displacement = {
    x: target.x - source.x,
    y: target.y - source.y,
    z: target.z - source.z,
  };
  const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (lengthMm === 0) fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.ZERO_LENGTH,
    'ADD_STRAIGHT_ELEMENT request requires a non-zero segment length.');
  return { targetPosition: target, displacement, lengthMm };
}

function requestMaterial(input, canonical, currentDraftHash, authority, sourceNode, contextEdge) {
  const source = nodeEvidence(canonical.canonical, sourceNode);
  const target = finitePoint(input.targetPosition, 'Target position',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.TARGET_INVALID);
  return {
    schema: TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'ADD_STRAIGHT_ELEMENT', payload: {
      fromNodeId: source.nodeId, toPosition: target, contextEdgeId: cleanText(contextEdge.id),
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
    sourceNode: source,
    proposedSegment: segmentEvidence(source.position, target),
    contextEdge: edgeEvidence(contextEdge),
    sequentialIntent: {
      requiredOperation: 'ADD_STRAIGHT_ELEMENT',
      candidateNativeOperation: null,
      currentNativeConstructionAuthority: 'UNAVAILABLE',
      automaticIdentityMapping: false,
      requiredExplicitInputs: [
        'sequentialFromNodeId', 'sequentialFromPortId',
        'newComponentCanonicalType', 'targetBranchId',
      ],
      applicationDisposition: 'REQUIRES_QUALIFIED_CONSTRUCTION_AUTHORITY',
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

export function createTopologySequentialAddStraightRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const nodeId = requiredText(input.nodeId, 'nodeId',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.NODE_INVALID);
  const contextEdgeId = requiredText(input.contextEdgeId, 'contextEdgeId',
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.EDGE_INVALID);
  const authority = authorityEvidence(input);
  const material = requestMaterial(input, canonical, draftHash(input), authority,
    exactRecord(canonical.canonical.nodes, nodeId, 'node',
      TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.NODE_INVALID),
    exactRecord(canonical.canonical.edges, contextEdgeId, 'context edge',
      TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.EDGE_INVALID));
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential ADD_STRAIGHT_ELEMENT request');
}

export function assertTopologySequentialAddStraightRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_SCHEMA) {
    fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.REQUEST_INVALID,
      `ADD_STRAIGHT_ELEMENT request must use ${TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_SCHEMA}.`,
      TypeError);
  }
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'ADD_STRAIGHT_ELEMENT request');
  const intent = value.sequentialIntent;
  if (value.requestFingerprint !== semanticHash(material)
    || value.sourceCommand?.type !== 'ADD_STRAIGHT_ELEMENT'
    || intent?.requiredOperation !== 'ADD_STRAIGHT_ELEMENT'
    || intent?.candidateNativeOperation !== null
    || intent?.automaticIdentityMapping !== false
    || intent?.publicationState !== 'NOT_PUBLISHED') {
    fail(TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.REQUEST_INVALID,
      'ADD_STRAIGHT_ELEMENT request differs from canonical immutable authority evidence.');
  }
  return value;
}

export function validateTopologySequentialAddStraightRequest(value, input = {}) {
  const request = assertTopologySequentialAddStraightRequest(value);
  const rebuilt = createTopologySequentialAddStraightRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_REQUEST_REJECTION.REQUEST_INVALID,
    'ADD_STRAIGHT_ELEMENT request differs from current canonical regeneration.');
  return rebuilt;
}

export function topologySequentialAddStraightRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialAddStraightRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const source = request.sourceNode.nodeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${source}.topology-sequential-add-straight-request.v1.json`;
}
