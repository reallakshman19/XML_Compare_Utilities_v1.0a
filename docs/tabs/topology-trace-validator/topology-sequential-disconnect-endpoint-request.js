/** Immutable export request from Topology Validator DISCONNECT_ENDPOINT to Sequential topology review. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_SCHEMA =
  'TopologySequentialDisconnectEndpointRequest.v1';

export const TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_DRAFT_INVALID',
  EDGE_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_EDGE_INVALID',
  ENDPOINT_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_NODE_INVALID',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_DISCONNECT_REQUEST_INVALID',
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
  const coordinates = ['x', 'y', 'z'].map((axis) => source[axis]);
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis, index) =>
    [axis, Number(coordinates[index])]));
  if (coordinates.some((coordinate) => coordinate === null || coordinate === undefined
    || cleanText(coordinate) === '') || !Object.values(point).every(Number.isFinite)) fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.NODE_INVALID,
    `${label} must contain finite x, y and z coordinates.`, TypeError,
  );
  return point;
}

function normalizeEndpoint(value) {
  const endpoint = cleanText(value).toUpperCase();
  if (!['FROM', 'TO'].includes(endpoint)) fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.ENDPOINT_INVALID,
    `Disconnect endpoint must be FROM or TO; received ${value}.`, TypeError,
  );
  return endpoint;
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
  if (canonical.schema !== 'CanonicalTopology.v1') fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.CANONICAL_INVALID,
    'DISCONNECT_ENDPOINT request requires CanonicalTopology.v1.', TypeError,
  );
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.DRAFT_INVALID,
    'DISCONNECT_ENDPOINT request requires TopologyEditDraft.v1.', TypeError,
  );
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function exactRecord(rows, id, kind, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${kind} is unavailable: ${id}`);
  return record;
}

function edgeEvidence(edge) {
  return {
    edgeId: cleanText(edge.id), fromNodeId: cleanText(edge.fromNodeId),
    toNodeId: cleanText(edge.toNodeId), canonicalRecord: edge, ...sourceEvidence(edge),
  };
}

function nodeEvidence(canonical, node) {
  const nodeId = cleanText(node.id);
  const incidentEdgeIds = asArray(canonical.edges).map(objectRecord)
    .filter((edge) => cleanText(edge.fromNodeId) === nodeId || cleanText(edge.toNodeId) === nodeId)
    .map((edge) => cleanText(edge.id)).filter(Boolean).sort();
  return {
    nodeId, position: finitePoint(node.position, `Node ${nodeId} position`),
    incidentEdgeIds, ...sourceEvidence(node),
  };
}

function referencesEntity(record, nodeId, edgeId) {
  const values = [record.nodeId, record.fromNodeId, record.toNodeId, record.edgeId,
    ...asArray(record.nodeIds), ...asArray(record.edgeIds)].map(cleanText);
  return values.includes(nodeId) || values.includes(edgeId);
}

function relatedRecords(canonical, collection, nodeId, edgeId) {
  return asArray(canonical[collection]).map(objectRecord)
    .filter((row) => referencesEntity(row, nodeId, edgeId));
}

function endpointContext(canonical, nodeId, edgeId) {
  const collections = ['supports', 'rigids', 'junctions', 'boundaries'];
  return Object.fromEntries(collections.map((collection) => [collection,
    relatedRecords(canonical, collection, nodeId, edgeId)]));
}

function geometryEvidence(fromNode, toNode) {
  const from = finitePoint(fromNode.position, 'FROM node position');
  const to = finitePoint(toNode.position, 'TO node position');
  const displacement = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  return { fromPosition: from, toPosition: to, displacement,
    lengthMm: Math.hypot(displacement.x, displacement.y, displacement.z) };
}

function endpointRecords(canonical, edge, endpoint) {
  const selectedNodeId = endpoint === 'FROM' ? cleanText(edge.fromNodeId) : cleanText(edge.toNodeId);
  const oppositeNodeId = endpoint === 'FROM' ? cleanText(edge.toNodeId) : cleanText(edge.fromNodeId);
  const code = TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.NODE_INVALID;
  const selectedNode = exactRecord(canonical.nodes, selectedNodeId, 'selected endpoint node', code);
  const oppositeNode = exactRecord(canonical.nodes, oppositeNodeId, 'opposite endpoint node', code);
  return { selectedNode, oppositeNode };
}

function requestMaterial(input, canonical, currentDraftHash, authority, edge, endpoint) {
  const nodes = endpointRecords(canonical.canonical, edge, endpoint);
  const selected = nodeEvidence(canonical.canonical, nodes.selectedNode);
  const opposite = nodeEvidence(canonical.canonical, nodes.oppositeNode);
  return {
    schema: TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'DISCONNECT_ENDPOINT', payload: { edgeId: cleanText(edge.id), endpoint } },
    validatorAuthority: {
      canonicalTopologyHash: canonical.hash, topologyEditDraftHash: currentDraftHash,
      commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName,
    },
    sourceEdge: edgeEvidence(edge),
    selectedEndpoint: { endpoint, ...selected,
      context: endpointContext(canonical.canonical, selected.nodeId, cleanText(edge.id)) },
    oppositeEndpoint: opposite,
    edgeGeometry: geometryEvidence(
      endpoint === 'FROM' ? nodes.selectedNode : nodes.oppositeNode,
      endpoint === 'FROM' ? nodes.oppositeNode : nodes.selectedNode,
    ),
    sequentialIntent: {
      requiredOperation: 'DISCONNECT_ENDPOINT', candidateNativeOperation: null,
      currentNativeDisconnectAuthority: 'UNAVAILABLE', automaticIdentityMapping: false,
      supportedRelationshipKinds: ['INTERNAL_EDGE', 'COMMITTED_CONNECTION'],
      requiredExplicitInputs: ['sequentialRelationshipKind', 'sequentialRelationshipId',
        'sequentialEndpointNodeId', 'sequentialEndpointPortId'],
      applicationDisposition: 'REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY',
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

export function createTopologySequentialDisconnectEndpointRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const edgeId = requiredText(input.edgeId, 'edgeId',
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.EDGE_INVALID);
  const endpoint = normalizeEndpoint(input.endpoint);
  const authority = authorityEvidence(input);
  const edge = exactRecord(canonical.canonical.edges, edgeId, 'edge',
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.EDGE_INVALID);
  const material = requestMaterial(input, canonical, draftHash(input), authority, edge, endpoint);
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential DISCONNECT_ENDPOINT request');
}


function endpointInvariant(value) {
  const command = objectRecord(value.sourceCommand), payload = objectRecord(command.payload);
  const edge = objectRecord(value.sourceEdge), selected = objectRecord(value.selectedEndpoint);
  const opposite = objectRecord(value.oppositeEndpoint), endpoint = cleanText(payload.endpoint).toUpperCase();
  const selectedNodeId = endpoint === 'FROM' ? cleanText(edge.fromNodeId) : cleanText(edge.toNodeId);
  const oppositeNodeId = endpoint === 'FROM' ? cleanText(edge.toNodeId) : cleanText(edge.fromNodeId);
  return cleanText(payload.edgeId) === cleanText(edge.edgeId)
    && cleanText(selected.endpoint).toUpperCase() === endpoint
    && cleanText(selected.nodeId) === selectedNodeId
    && cleanText(opposite.nodeId) === oppositeNodeId;
}

export function assertTopologySequentialDisconnectEndpointRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_SCHEMA) fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.REQUEST_INVALID,
    `DISCONNECT_ENDPOINT request must use ${TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_SCHEMA}.`,
    TypeError,
  );
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'DISCONNECT_ENDPOINT request');
  const intent = value.sequentialIntent;
  if (value.requestFingerprint !== semanticHash(material)
    || value.sourceCommand?.type !== 'DISCONNECT_ENDPOINT'
    || !['FROM', 'TO'].includes(value.sourceCommand?.payload?.endpoint)
    || !endpointInvariant(value)
    || intent?.requiredOperation !== 'DISCONNECT_ENDPOINT'
    || intent?.candidateNativeOperation !== null
    || intent?.currentNativeDisconnectAuthority !== 'UNAVAILABLE'
    || intent?.automaticIdentityMapping !== false
    || intent?.applicationDisposition !== 'REQUIRES_QUALIFIED_TOPOLOGY_AUTHORITY'
    || intent?.publicationState !== 'NOT_PUBLISHED') fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.REQUEST_INVALID,
    'DISCONNECT_ENDPOINT request differs from canonical immutable authority evidence.',
  );
  return value;
}

export function validateTopologySequentialDisconnectEndpointRequest(value, input = {}) {
  const request = assertTopologySequentialDisconnectEndpointRequest(value);
  const rebuilt = createTopologySequentialDisconnectEndpointRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_REJECTION.REQUEST_INVALID,
    'DISCONNECT_ENDPOINT request differs from current canonical regeneration.',
  );
  return rebuilt;
}

export function topologySequentialDisconnectEndpointRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialDisconnectEndpointRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const edge = request.sourceEdge.edgeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${edge}.${request.selectedEndpoint.endpoint.toLowerCase()}.topology-sequential-disconnect-endpoint-request.v1.json`;
}
