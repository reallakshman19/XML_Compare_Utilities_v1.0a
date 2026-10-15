/** Narrow controller decorator for non-publishing DISCONNECT_ENDPOINT request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologySequentialDisconnectEndpointRequest,
  topologySequentialDisconnectEndpointRequestFileName,
} from './topology-sequential-disconnect-endpoint-request.js';

export const TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_CONTROLLER_SCHEMA =
  'TopologySequentialDisconnectEndpointController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function resolveInspector(documentRef) {
  if (typeof documentRef?.querySelectorAll !== 'function') {
    throw new TypeError('Sequential disconnect request requires document query authority.');
  }
  const mounted = [...documentRef.querySelectorAll('[data-ttv-edit-inspector]')]
    .filter((element) => element?.isConnected !== false);
  if (mounted.length !== 1) {
    throw new RangeError(`Sequential disconnect request requires exactly one mounted Edit Draft inspector; found ${mounted.length}.`);
  }
  return mounted[0];
}

function selectedEndpoint(inspector) {
  const value = String(inspector.querySelector('[data-ttv-edit-disconnect-endpoint]')?.value || '')
    .trim().toUpperCase();
  if (!['FROM', 'TO'].includes(value)) {
    throw new TypeError('Sequential disconnect request endpoint must be FROM or TO.');
  }
  return value;
}

function selectedIntent(evidence, inspector) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const edges = rows.filter((row) => row?.kind === 'edge' && String(row.id || '').trim());
  if (rows.length !== 1 || edges.length !== 1) {
    throw new RangeError('Sequential disconnect request requires exactly one selected edge.');
  }
  return Object.freeze({ edgeId: edges[0].id, endpoint: selectedEndpoint(inspector) });
}

function currentCanonical(evidence) {
  return evidence.editedArtifacts?.canonicalTopology
    ?? evidence.baseArtifacts?.canonicalTopology
    ?? null;
}

function requestInput(evidence, intent, createdAt) {
  return {
    canonical: currentCanonical(evidence), draft: evidence.draft,
    commandAuthority: evidence.commandAuthority, projectDocument: evidence.projectDocument,
    edgeId: intent.edgeId, endpoint: intent.endpoint, createdAt,
  };
}

function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialDisconnectEndpointRequest(
    requestInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialDisconnectEndpointRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`,
    'application/json;charset=utf-8');
  return request;
}

export function createTopologySequentialDisconnectEndpointController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Disconnect request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString());
  requiredFunction(now, 'now');

  function exportSequentialDisconnectEndpointRequest(intent = selectedIntent(
    evidence(), resolveInspector(documentRef),
  )) {
    return exportRequest(baseController, documentRef, intent, now);
  }

  function runOperation(operation) {
    if (operation === 'DISCONNECT_SEQUENTIAL_REQUEST') {
      return exportSequentialDisconnectEndpointRequest();
    }
    return baseRunOperation.call(baseController, operation);
  }

  return Object.freeze({
    ...baseController,
    schema: TOPOLOGY_SEQUENTIAL_DISCONNECT_ENDPOINT_CONTROLLER_SCHEMA,
    runOperation,
    exportSequentialDisconnectEndpointRequest,
  });
}

export const _test = Object.freeze({
  resolveInspector, selectedEndpoint, selectedIntent, currentCanonical, requestInput,
});
