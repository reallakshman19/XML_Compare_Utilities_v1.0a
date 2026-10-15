/** Immutable export request from Topology Validator SPLIT_EDGE to Sequential structural-topology review. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_SCHEMA =
  'TopologySequentialSplitEdgeRequest.v1';

export const TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_DRAFT_INVALID',
  EDGE_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_EDGE_INVALID',
  FRACTION_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_FRACTION_INVALID',
  GEOMETRY_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_GEOMETRY_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_NODE_INVALID',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}

function requiredText(value, label, code) {
  const result = cleanText(value);
  if (!result) fail(code, `${label} is required.`, TypeError);
  return result;
}

function strictFraction(value) {
  if (value === null || value === undefined || cleanText(value) === '') fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.FRACTION_INVALID,
    'Split fraction is required.', TypeError,
  );
  const fraction = Number(value);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.FRACTION_INVALID,
    'Split fraction must be finite and strictly between 0 and 1.', RangeError,
  );
  return fraction;
}

function finitePoint(value, label) {
  const source = objectRecord(value);
  const coordinates = ['x', 'y', 'z'].map((axis) => source[axis]);
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis, index) =>
    [axis, Number(coordinates[index])]));
  if (coordinates.some((coordinate) => coordinate === null || coordinate === undefined
    || cleanText(coordinate) === '') || !Object.values(point).every(Number.isFinite)) fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.NODE_INVALID,
    `${label} must contain finite x, y and z coordinates.`, TypeError,
  );
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
  if (canonical.schema !== 'CanonicalTopology.v1') fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.CANONICAL_INVALID,
    'SPLIT_EDGE request requires CanonicalTopology.v1.', TypeError,
  );
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.DRAFT_INVALID,
    'SPLIT_EDGE request requires TopologyEditDraft.v1.', TypeError,
  );
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function exactRecord(rows, id, label, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${label} is unavailable: ${id}`);
  return record;
}

function nodeEvidence(node, role) {
  return {
    role, nodeId: cleanText(node.id), position: finitePoint(node.position, `${role} node position`),
    canonicalRecord: node, ...sourceEvidence(node),
  };
}

function edgeEvidence(edge) {
  return {
    edgeId: cleanText(edge.id), fromNodeId: cleanText(edge.fromNodeId),
    toNodeId: cleanText(edge.toNodeId), segmentRole: cleanText(edge.segmentRole) || null,
    canonicalRecord: edge, ...sourceEvidence(edge),
  };
}

function splitGeometry(fromPosition, toPosition, fraction) {
  const displacement = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, toPosition[axis] - fromPosition[axis]]));
  const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (!(lengthMm > 0)) fail(TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.GEOMETRY_INVALID,
    'SPLIT_EDGE request requires a non-zero edge length.');
  const splitPosition = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, fromPosition[axis] + displacement[axis] * fraction]));
  return { fraction, fromPosition, toPosition, displacement, lengthMm, splitPosition,
    leftLengthMm: lengthMm * fraction, rightLengthMm: lengthMm * (1 - fraction) };
}

function referencesEntity(record, nodeIds, edgeId) {
  const values = [record.nodeId, record.fromNodeId, record.toNodeId, record.edgeId,
    ...asArray(record.nodeIds), ...asArray(record.edgeIds)].map(cleanText);
  return values.includes(edgeId) || nodeIds.some((nodeId) => values.includes(nodeId));
}

function relatedEvidence(canonical, nodeIds, edgeId) {
  const collections = ['supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures'];
  return Object.fromEntries(collections.map((collection) => [collection,
    asArray(canonical[collection]).map(objectRecord)
      .filter((row) => referencesEntity(row, nodeIds, edgeId))]));
}

function requestMaterial(input, canonical, currentDraftHash, authority, edge, fraction) {
  const code = TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.NODE_INVALID;
  const fromNode = exactRecord(canonical.canonical.nodes, cleanText(edge.fromNodeId), 'FROM node', code);
  const toNode = exactRecord(canonical.canonical.nodes, cleanText(edge.toNodeId), 'TO node', code);
  const from = nodeEvidence(fromNode, 'FROM'), to = nodeEvidence(toNode, 'TO');
  return {
    schema: TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'SPLIT_EDGE', payload: { edgeId: cleanText(edge.id), fraction } },
    validatorAuthority: {
      canonicalTopologyHash: canonical.hash, topologyEditDraftHash: currentDraftHash,
      commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName,
    },
    sourceEdge: edgeEvidence(edge), fromEndpoint: from, toEndpoint: to,
    splitGeometry: splitGeometry(from.position, to.position, fraction),
    relatedEvidence: relatedEvidence(canonical.canonical, [from.nodeId, to.nodeId], cleanText(edge.id)),
    sequentialIntent: {
      requiredOperation: 'SPLIT_EDGE', candidateNativeOperation: 'SPLIT_PIPE',
      candidateNativeOperationIsBounded: true, currentNativeSplitAuthority: 'BOUNDED_ADAPTER_UNQUALIFIED',
      supportedCanonicalTypes: ['PIPE'], automaticIdentityMapping: false,
      requiredExplicitInputs: ['sequentialComponentId', 'sequentialGeometryPartId',
        'sequentialInternalEdgeId', 'sequentialBranchId'],
      applicationDisposition: 'REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY',
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

function invariantGeometry(value) {
  try {
    const edge = objectRecord(value.sourceEdge), from = objectRecord(value.fromEndpoint);
    const to = objectRecord(value.toEndpoint), payload = objectRecord(value.sourceCommand?.payload);
    const fraction = strictFraction(payload.fraction);
    const fromPosition = finitePoint(from.position, 'FROM endpoint position');
    const toPosition = finitePoint(to.position, 'TO endpoint position');
    const expected = splitGeometry(fromPosition, toPosition, fraction);
    return cleanText(payload.edgeId) === cleanText(edge.edgeId)
      && cleanText(edge.fromNodeId) === cleanText(from.nodeId)
      && cleanText(edge.toNodeId) === cleanText(to.nodeId)
      && cleanText(edge.canonicalRecord?.id) === cleanText(edge.edgeId)
      && cleanText(edge.canonicalRecord?.fromNodeId) === cleanText(edge.fromNodeId)
      && cleanText(edge.canonicalRecord?.toNodeId) === cleanText(edge.toNodeId)
      && cleanText(from.canonicalRecord?.id) === cleanText(from.nodeId)
      && cleanText(to.canonicalRecord?.id) === cleanText(to.nodeId)
      && semanticStringify(finitePoint(from.canonicalRecord?.position, 'Canonical FROM position'))
        === semanticStringify(fromPosition)
      && semanticStringify(finitePoint(to.canonicalRecord?.position, 'Canonical TO position'))
        === semanticStringify(toPosition)
      && semanticStringify(expected) === semanticStringify(value.splitGeometry);
  } catch { return false; }
}

export function createTopologySequentialSplitEdgeRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const edgeId = requiredText(input.edgeId, 'edgeId',
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.EDGE_INVALID);
  const edge = exactRecord(canonical.canonical.edges, edgeId, 'edge',
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.EDGE_INVALID);
  const material = requestMaterial(input, canonical, draftHash(input), authorityEvidence(input),
    edge, strictFraction(input.fraction));
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential SPLIT_EDGE request');
}

export function assertTopologySequentialSplitEdgeRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_SCHEMA) fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    `SPLIT_EDGE request must use ${TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_SCHEMA}.`, TypeError,
  );
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'SPLIT_EDGE request');
  const intent = value.sequentialIntent;
  if (value.requestFingerprint !== semanticHash(material)
    || value.sourceCommand?.type !== 'SPLIT_EDGE'
    || !invariantGeometry(value)
    || intent?.requiredOperation !== 'SPLIT_EDGE'
    || intent?.candidateNativeOperation !== 'SPLIT_PIPE'
    || intent?.candidateNativeOperationIsBounded !== true
    || intent?.currentNativeSplitAuthority !== 'BOUNDED_ADAPTER_UNQUALIFIED'
    || intent?.automaticIdentityMapping !== false
    || semanticStringify(intent?.supportedCanonicalTypes) !== semanticStringify(['PIPE'])
    || semanticStringify(intent?.requiredExplicitInputs) !== semanticStringify([
      'sequentialComponentId', 'sequentialGeometryPartId',
      'sequentialInternalEdgeId', 'sequentialBranchId',
    ])
    || intent?.applicationDisposition !== 'REQUIRES_QUALIFIED_STRUCTURAL_TOPOLOGY_AUTHORITY'
    || intent?.publicationState !== 'NOT_PUBLISHED') fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    'SPLIT_EDGE request differs from canonical immutable authority evidence.',
  );
  return value;
}

export function validateTopologySequentialSplitEdgeRequest(value, input = {}) {
  const request = assertTopologySequentialSplitEdgeRequest(value);
  const rebuilt = createTopologySequentialSplitEdgeRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    'SPLIT_EDGE request differs from current canonical regeneration.');
  return rebuilt;
}

export function topologySequentialSplitEdgeRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialSplitEdgeRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const edge = request.sourceEdge.edgeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${edge}.topology-sequential-split-edge-request.v1.json`;
}
