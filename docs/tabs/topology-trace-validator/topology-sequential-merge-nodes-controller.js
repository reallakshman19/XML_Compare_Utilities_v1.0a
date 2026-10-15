/** Narrow controller decorator for non-publishing MERGE_NODES request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import { createTopologyBendDefinitionPreservationController } from './topology-bend-definition-preservation-controller.js';
import { createTopologyJunctionDefinitionPreservationController } from './topology-junction-definition-preservation-controller.js';
import { createTopologySequentialAddStraightController } from './topology-sequential-add-straight-controller.js';
import { createTopologySequentialBridgeGapController } from './topology-sequential-bridge-gap-controller.js';
import { createTopologySequentialDeleteEdgeController } from './topology-sequential-delete-edge-controller.js';
import { createTopologySequentialDisconnectEndpointController } from './topology-sequential-disconnect-endpoint-controller.js';
import { createTopologySequentialSplitEdgeController } from './topology-sequential-split-edge-controller.js';
import {
  createTopologySequentialMergeNodesRequest,
  topologySequentialMergeNodesRequestFileName,
} from './topology-sequential-merge-nodes-request.js';

export const TOPOLOGY_SEQUENTIAL_MERGE_NODES_CONTROLLER_SCHEMA =
  'TopologySequentialMergeNodesController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function selectedMergeIntent(selection) {
  const rows = Array.isArray(selection) ? selection : [];
  const nodes = rows.filter((row) => row?.kind === 'node' && String(row.id || '').trim());
  if (rows.length !== 2 || nodes.length !== 2) {
    throw new RangeError('Sequential merge request requires exactly two selected nodes.');
  }
  return Object.freeze({ sourceNodeId: nodes[0].id, targetNodeId: nodes[1].id });
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
    sourceNodeId: intent.sourceNodeId,
    targetNodeId: intent.targetNodeId,
    createdAt,
  };
}

function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialMergeNodesRequest(
    requestInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialMergeNodesRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`,
    'application/json;charset=utf-8');
  return request;
}

function decorateSequentialRequests(mergeController, documentRef, now) {
  const bridgeController = createTopologySequentialBridgeGapController(mergeController, {
    documentRef, now,
  });
  const addController = createTopologySequentialAddStraightController(bridgeController, {
    documentRef, now,
  });
  const disconnectController = createTopologySequentialDisconnectEndpointController(addController, {
    documentRef, now,
  });
  const splitController = createTopologySequentialSplitEdgeController(disconnectController, {
    documentRef, now,
  });
  const deleteController = createTopologySequentialDeleteEdgeController(splitController, { documentRef, now });
  const bendController = createTopologyBendDefinitionPreservationController(deleteController, { documentRef, now });
  return createTopologyJunctionDefinitionPreservationController(bendController, { documentRef, now });
}

export function createTopologySequentialMergeNodesController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Merge request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString());
  requiredFunction(now, 'now');

  function exportSequentialMergeNodesRequest(intent = selectedMergeIntent(evidence().selection)) {
    return exportRequest(baseController, documentRef, intent, now);
  }

  function runOperation(operation) {
    if (operation === 'MERGE_SEQUENTIAL_REQUEST') return exportSequentialMergeNodesRequest();
    return baseRunOperation.call(baseController, operation);
  }

  const mergeController = Object.freeze({
    ...baseController,
    schema: TOPOLOGY_SEQUENTIAL_MERGE_NODES_CONTROLLER_SCHEMA,
    runOperation,
    exportSequentialMergeNodesRequest,
  });
  return decorateSequentialRequests(mergeController, documentRef, now);
}

export const _test = Object.freeze({ selectedMergeIntent, currentCanonical, requestInput });
