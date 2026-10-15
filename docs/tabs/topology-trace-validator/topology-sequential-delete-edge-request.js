/** Immutable DELETE_EDGE retirement request for qualified Sequential structural-topology review. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import { asArray, cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_SCHEMA = 'TopologySequentialDeleteEdgeRequest.v1';
export const TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_DRAFT_INVALID',
  EDGE_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_EDGE_INVALID',
  GEOMETRY_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_GEOMETRY_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_NODE_INVALID',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_INVALID',
});
const EXPLICIT_INPUTS = Object.freeze([
  'sequentialComponentId', 'sequentialGeometryPartId',
  'sequentialInternalEdgeId', 'sequentialBranchId',
]);
const RELATED_COLLECTIONS = Object.freeze([
  'supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures',
]);
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
  const point = Object.fromEntries(['x', 'y', 'z'].map((axis, index) => [axis, Number(coordinates[index])]));
  if (coordinates.some((coordinate) => coordinate === null || coordinate === undefined
    || cleanText(coordinate) === '') || !Object.values(point).every(Number.isFinite)) fail(
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.NODE_INVALID,
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
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.CANONICAL_INVALID,
    'DELETE_EDGE request requires CanonicalTopology.v1.', TypeError,
  );
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}
function draftHash(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') fail(
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.DRAFT_INVALID,
    'DELETE_EDGE request requires TopologyEditDraft.v1.', TypeError,
  );
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.DRAFT_INVALID);
}
function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId, 'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}
function exactRecord(rows, id, label, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${label} is unavailable: ${id}`);
  return record;
}
function sortedIncidentEdges(canonical, nodeId) {
  return asArray(canonical.edges).map(objectRecord).filter((row) => (
    cleanText(row.fromNodeId) === nodeId || cleanText(row.toNodeId) === nodeId
  )).sort((left, right) => cleanText(left.id).localeCompare(cleanText(right.id)));
}
function endpointEvidence(canonical, node, role, retiredEdgeId) {
  const nodeId = cleanText(node.id);
  const incidentEdges = sortedIncidentEdges(canonical, nodeId);
  const incidentEdgeIds = incidentEdges.map((row) => cleanText(row.id));
  return { role, nodeId, position: finitePoint(node.position, `${role} node position`),
    canonicalRecord: node, ...sourceEvidence(node), incidentEdgeIds,
    otherIncidentEdgeIds: incidentEdgeIds.filter((id) => id !== retiredEdgeId), incidentEdges };
}
function edgeEvidence(edge) {
  return { edgeId: cleanText(edge.id), fromNodeId: cleanText(edge.fromNodeId),
    toNodeId: cleanText(edge.toNodeId), segmentRole: cleanText(edge.segmentRole) || null,
    canonicalRecord: edge, ...sourceEvidence(edge) };
}
function retirementGeometry(fromPosition, toPosition) {
  const displacement = Object.fromEntries(['x', 'y', 'z'].map((axis) =>
    [axis, toPosition[axis] - fromPosition[axis]]));
  const lengthMm = Math.hypot(displacement.x, displacement.y, displacement.z);
  if (!(lengthMm > 0)) fail(TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.GEOMETRY_INVALID,
    'DELETE_EDGE request requires a non-zero edge length.');
  return { fromPosition, toPosition, displacement, lengthMm };
}
function referencesEntity(record, nodeIds, edgeId) {
  const values = [record.nodeId, record.fromNodeId, record.toNodeId, record.edgeId,
    ...asArray(record.nodeIds), ...asArray(record.edgeIds)].map(cleanText);
  return values.includes(edgeId) || nodeIds.some((nodeId) => values.includes(nodeId));
}
function relatedEvidence(canonical, nodeIds, edgeId) {
  return Object.fromEntries(RELATED_COLLECTIONS.map((collection) => [collection,
    asArray(canonical[collection]).map(objectRecord)
      .filter((row) => referencesEntity(row, nodeIds, edgeId))]));
}
function requestMaterial(input, canonical, currentDraftHash, authority, edge) {
  const code = TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.NODE_INVALID;
  const edgeId = cleanText(edge.id);
  const fromNode = exactRecord(canonical.canonical.nodes, cleanText(edge.fromNodeId), 'FROM node', code);
  const toNode = exactRecord(canonical.canonical.nodes, cleanText(edge.toNodeId), 'TO node', code);
  const from = endpointEvidence(canonical.canonical, fromNode, 'FROM', edgeId);
  const to = endpointEvidence(canonical.canonical, toNode, 'TO', edgeId);
  return { schema: TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_SCHEMA, createdAt: input.createdAt,
    sourceCommand: { type: 'DELETE_EDGE', payload: { edgeId } },
    validatorAuthority: { canonicalTopologyHash: canonical.hash, topologyEditDraftHash: currentDraftHash,
      commandAuthorityId: authority.authorityId, projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash, scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName },
    sourceEdge: edgeEvidence(edge), fromEndpoint: from, toEndpoint: to,
    retirementGeometry: retirementGeometry(from.position, to.position),
    relatedEvidence: relatedEvidence(canonical.canonical, [from.nodeId, to.nodeId], edgeId),
    sequentialIntent: { requiredOperation: 'DELETE_EDGE', candidateNativeOperation: null,
      currentNativeRetirementAuthority: 'UNAVAILABLE', retirementQualificationScope: 'WHOLE_COMPONENT_ONLY',
      automaticIdentityMapping: false, requiredExplicitInputs: EXPLICIT_INPUTS,
      applicationDisposition: 'REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY',
      publicationState: 'NOT_PUBLISHED' } };
}
function incidentInvariant(endpoint, edgeId, edgeRecord) {
  const nodeId = cleanText(endpoint.nodeId);
  const records = asArray(endpoint.incidentEdges).map(objectRecord);
  const ids = records.map((row) => cleanText(row.id));
  return ids.every(Boolean) && ids.length === new Set(ids).size
    && semanticStringify(ids) === semanticStringify([...ids].sort())
    && semanticStringify(endpoint.incidentEdgeIds) === semanticStringify(ids)
    && semanticStringify(endpoint.otherIncidentEdgeIds) === semanticStringify(ids.filter((id) => id !== edgeId))
    && ids.includes(edgeId)
    && semanticStringify(records.find((row) => cleanText(row.id) === edgeId))
      === semanticStringify(edgeRecord)
    && records.every((row) => cleanText(row.fromNodeId) === nodeId || cleanText(row.toNodeId) === nodeId);
}
function sourceInvariant(value, canonicalRecord) {
  const expected = sourceEvidence(canonicalRecord);
  return semanticStringify(value.sourcePaths) === semanticStringify(expected.sourcePaths)
    && semanticStringify(value.sourceBranchIndexes)
      === semanticStringify(expected.sourceBranchIndexes);
}
function relatedInvariant(value, nodeIds, edgeId) {
  const related = objectRecord(value);
  if (semanticStringify(Object.keys(related).sort())
    !== semanticStringify([...RELATED_COLLECTIONS].sort())) return false;
  return RELATED_COLLECTIONS.every((collection) => asArray(related[collection])
    .map(objectRecord).every((row) => referencesEntity(row, nodeIds, edgeId)));
}
function endpointInvariant(endpoint, role, edgeNodeId, edgeId, edgeRecord) {
  try {
    const position = finitePoint(endpoint.position, `${role} endpoint position`);
    const canonicalPosition = finitePoint(endpoint.canonicalRecord?.position, `Canonical ${role} endpoint position`);
    return endpoint.role === role && cleanText(endpoint.nodeId) === cleanText(edgeNodeId)
      && cleanText(endpoint.canonicalRecord?.id) === cleanText(endpoint.nodeId)
      && semanticStringify(position) === semanticStringify(canonicalPosition)
      && sourceInvariant(endpoint, endpoint.canonicalRecord)
      && incidentInvariant(endpoint, edgeId, edgeRecord);
  } catch { return false; }
}
function requestInvariant(value) {
  try {
    const edge = objectRecord(value.sourceEdge), payload = objectRecord(value.sourceCommand?.payload);
    const edgeId = cleanText(edge.edgeId), from = objectRecord(value.fromEndpoint), to = objectRecord(value.toEndpoint);
    const expected = retirementGeometry(finitePoint(from.position, 'FROM endpoint position'),
      finitePoint(to.position, 'TO endpoint position'));
    return cleanText(payload.edgeId) === edgeId && cleanText(edge.canonicalRecord?.id) === edgeId
      && cleanText(edge.canonicalRecord?.fromNodeId) === cleanText(edge.fromNodeId)
      && cleanText(edge.canonicalRecord?.toNodeId) === cleanText(edge.toNodeId)
      && cleanText(edge.segmentRole) === cleanText(edge.canonicalRecord?.segmentRole)
      && sourceInvariant(edge, edge.canonicalRecord)
      && endpointInvariant(from, 'FROM', edge.fromNodeId, edgeId, edge.canonicalRecord)
      && endpointInvariant(to, 'TO', edge.toNodeId, edgeId, edge.canonicalRecord)
      && semanticStringify(expected) === semanticStringify(value.retirementGeometry)
      && relatedInvariant(value.relatedEvidence, [from.nodeId, to.nodeId], edgeId);
  } catch { return false; }
}
function intentInvariant(intent) {
  return intent?.requiredOperation === 'DELETE_EDGE' && intent?.candidateNativeOperation === null
    && intent?.currentNativeRetirementAuthority === 'UNAVAILABLE'
    && intent?.retirementQualificationScope === 'WHOLE_COMPONENT_ONLY'
    && intent?.automaticIdentityMapping === false
    && semanticStringify(intent?.requiredExplicitInputs) === semanticStringify(EXPLICIT_INPUTS)
    && intent?.applicationDisposition === 'REQUIRES_QUALIFIED_STRUCTURAL_RETIREMENT_AUTHORITY'
    && intent?.publicationState === 'NOT_PUBLISHED';
}
export function createTopologySequentialDeleteEdgeRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const edgeId = requiredText(input.edgeId, 'edgeId', TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.EDGE_INVALID);
  const edge = exactRecord(canonical.canonical.edges, edgeId, 'edge',
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.EDGE_INVALID);
  const material = requestMaterial(input, canonical, draftHash(input), authorityEvidence(input), edge);
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential DELETE_EDGE request');
}
export function assertTopologySequentialDeleteEdgeRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_SCHEMA) fail(
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    `DELETE_EDGE request must use ${TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_SCHEMA}.`, TypeError);
  const material = { ...value }; delete material.requestFingerprint;
  immutableJson(value, 'DELETE_EDGE request');
  if (!isIsoTimestamp(value.createdAt) || value.requestFingerprint !== semanticHash(material)
    || value.sourceCommand?.type !== 'DELETE_EDGE'
    || !requestInvariant(value) || !intentInvariant(value.sequentialIntent)) fail(
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    'DELETE_EDGE request differs from canonical immutable retirement authority evidence.');
  return value;
}
export function validateTopologySequentialDeleteEdgeRequest(value, input = {}) {
  const request = assertTopologySequentialDeleteEdgeRequest(value);
  const rebuilt = createTopologySequentialDeleteEdgeRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) fail(
    TOPOLOGY_SEQUENTIAL_DELETE_EDGE_REQUEST_REJECTION.REQUEST_INVALID,
    'DELETE_EDGE request differs from current canonical regeneration.');
  return rebuilt;
}
export function topologySequentialDeleteEdgeRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialDeleteEdgeRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const edge = request.sourceEdge.edgeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${edge}.topology-sequential-delete-edge-request.v1.json`;
}
