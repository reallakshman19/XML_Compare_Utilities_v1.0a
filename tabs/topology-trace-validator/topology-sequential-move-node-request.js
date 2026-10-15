/** Immutable export request from Topology Validator MOVE_NODE to Sequential STRETCH_NODE. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import {
  asArray,
  cleanText,
  objectRecord,
  semanticHash,
  semanticStringify,
} from './topology-validator-values.js';

export const TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_SCHEMA =
  'TopologySequentialMoveNodeRequest.v1';

export const TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_DRAFT_INVALID',
  NODE_INVALID: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_NODE_INVALID',
  NO_CHANGE: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_NO_CHANGE',
  REQUEST_INVALID: 'TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
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
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.NODE_INVALID,
      `${label} must contain finite x, y and z coordinates.`, TypeError);
  }
  return Object.freeze(point);
}

function samePoint(left, right) {
  return ['x', 'y', 'z'].every((axis) => left[axis] === right[axis]);
}

function sourceBranchIndex(sourcePath) {
  const match = cleanText(sourcePath).match(/^\$(?:\.(?:objects|hierarchy|branches))?\[(\d+)\]/);
  return match ? Number(match[1]) : null;
}

function exactNode(canonical, nodeId) {
  const node = asArray(canonical.nodes).map(objectRecord)
    .find((row) => cleanText(row.id) === nodeId);
  if (!node) fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.NODE_INVALID,
    `Canonical node is unavailable: ${nodeId}`);
  return node;
}

function canonicalEvidence(input) {
  const canonical = objectRecord(input.canonical);
  if (canonical.schema !== 'CanonicalTopology.v1') {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.CANONICAL_INVALID,
      'MOVE_NODE request requires CanonicalTopology.v1.', TypeError);
  }
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}

function draftEvidence(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.DRAFT_INVALID,
      'MOVE_NODE request requires TopologyEditDraft.v1.', TypeError);
  }
  return requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.DRAFT_INVALID);
}

function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId, 'commandAuthority.authorityId',
    TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}

function sourceEvidence(node) {
  const sourcePaths = [...new Set(asArray(node.sourcePaths).map(cleanText).filter(Boolean))].sort();
  const sourceBranchIndexes = [...new Set(sourcePaths.map(sourceBranchIndex)
    .filter((value) => value !== null))].sort((left, right) => left - right);
  return { sourcePaths, sourceBranchIndexes };
}

function requestMaterial(input, canonical, draftHash, authority, node, targetPosition) {
  const currentPosition = finitePoint(node.position, 'current node position');
  if (samePoint(currentPosition, targetPosition)) {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.NO_CHANGE,
      'MOVE_NODE request target equals the current node position.');
  }
  return {
    schema: TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_SCHEMA,
    createdAt: input.createdAt,
    sourceCommand: { type: 'MOVE_NODE', payload: { nodeId: cleanText(node.id), position: targetPosition } },
    validatorAuthority: {
      canonicalTopologyHash: canonical.hash,
      topologyEditDraftHash: draftHash,
      commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName,
    },
    sourceNode: { nodeId: cleanText(node.id), currentPosition, ...sourceEvidence(node) },
    sequentialIntent: {
      requiredOperation: 'STRETCH_NODE',
      automaticIdentityMapping: false,
      requiredExplicitInputs: ['selectedObjectId', 'sequentialNodeId'],
      publicationState: 'NOT_PUBLISHED',
    },
  };
}

export function createTopologySequentialMoveNodeRequest(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input);
  const draftHash = draftEvidence(input);
  const authority = authorityEvidence(input);
  const nodeId = requiredText(input.nodeId, 'nodeId',
    TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.NODE_INVALID);
  const node = exactNode(canonical.canonical, nodeId);
  const targetPosition = finitePoint(input.targetPosition, 'targetPosition');
  const material = requestMaterial(input, canonical, draftHash, authority, node, targetPosition);
  return immutableJson({ ...material, requestFingerprint: semanticHash(material) },
    'Topology Sequential MOVE_NODE request');
}

export function assertTopologySequentialMoveNodeRequest(value) {
  if (value?.schema !== TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_SCHEMA) {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.REQUEST_INVALID,
      `MOVE_NODE request must use ${TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_SCHEMA}.`, TypeError);
  }
  const material = { ...value };
  delete material.requestFingerprint;
  immutableJson(value, 'MOVE_NODE request');
  if (value.requestFingerprint !== semanticHash(material)) {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.REQUEST_INVALID,
      'MOVE_NODE request differs from canonical immutable fingerprint evidence.');
  }
  return value;
}

export function validateTopologySequentialMoveNodeRequest(value, input = {}) {
  const request = assertTopologySequentialMoveNodeRequest(value);
  const rebuilt = createTopologySequentialMoveNodeRequest(input);
  if (semanticStringify(rebuilt) !== semanticStringify(request)) {
    fail(TOPOLOGY_SEQUENTIAL_MOVE_NODE_REQUEST_REJECTION.REQUEST_INVALID,
      'MOVE_NODE request differs from current canonical regeneration.');
  }
  return rebuilt;
}

export function topologySequentialMoveNodeRequestFileName(requestInput, sourceStem = 'topology') {
  const request = assertTopologySequentialMoveNodeRequest(requestInput);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const node = request.sourceNode.nodeId.replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${node}.topology-sequential-move-node-request.v1.json`;
}
