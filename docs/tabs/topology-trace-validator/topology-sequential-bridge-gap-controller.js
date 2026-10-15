/** Narrow controller decorator for non-publishing BRIDGE_GAP request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologySequentialBridgeGapRequest,
  topologySequentialBridgeGapRequestFileName,
} from './topology-sequential-bridge-gap-request.js';

export const TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_CONTROLLER_SCHEMA =
  'TopologySequentialBridgeGapController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function selectedBridgeIntent(evidence) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const nodes = rows.filter((row) => row?.kind === 'node' && String(row.id || '').trim());
  const contextEdgeId = String(evidence?.contextEdgeId || '').trim();
  if (rows.length !== 2 || nodes.length !== 2) {
    throw new RangeError('Sequential bridge request requires exactly two selected nodes.');
  }
  if (!contextEdgeId) {
    throw new RangeError('Sequential bridge request requires one explicit context edge.');
  }
  return Object.freeze({
    fromNodeId: nodes[0].id,
    toNodeId: nodes[1].id,
    contextEdgeId,
  });
}

function currentCanonical(evidence) {
  return evidence.editedArtifacts?.canonicalTopology
    ?? evidence.baseArtifacts?.canonicalTopology
    ?? null;
}

function requestInput(evidence, intent, createdAt) {
  return {
    canonical: currentCanonical(evidence),
    draft: evidence.draft,
    commandAuthority: evidence.commandAuthority,
    projectDocument: evidence.projectDocument,
    fromNodeId: intent.fromNodeId,
    toNodeId: intent.toNodeId,
    contextEdgeId: intent.contextEdgeId,
    createdAt,
  };
}

function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialBridgeGapRequest(
    requestInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialBridgeGapRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`,
    'application/json;charset=utf-8');
  return request;
}

export function createTopologySequentialBridgeGapController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Bridge request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString());
  requiredFunction(now, 'now');

  function exportSequentialBridgeGapRequest(intent = selectedBridgeIntent(evidence())) {
    return exportRequest(baseController, documentRef, intent, now);
  }

  function runOperation(operation) {
    if (operation === 'BRIDGE_SEQUENTIAL_REQUEST') {
      return exportSequentialBridgeGapRequest();
    }
    return baseRunOperation.call(baseController, operation);
  }

  return Object.freeze({
    ...baseController,
    schema: TOPOLOGY_SEQUENTIAL_BRIDGE_GAP_CONTROLLER_SCHEMA,
    runOperation,
    exportSequentialBridgeGapRequest,
  });
}

export const _test = Object.freeze({ selectedBridgeIntent, currentCanonical, requestInput });
