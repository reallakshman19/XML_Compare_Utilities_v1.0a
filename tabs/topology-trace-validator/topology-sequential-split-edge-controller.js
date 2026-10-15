/** Narrow controller decorator for non-publishing SPLIT_EDGE request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologySequentialSplitEdgeRequest,
  topologySequentialSplitEdgeRequestFileName,
} from './topology-sequential-split-edge-request.js';

export const TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_CONTROLLER_SCHEMA =
  'TopologySequentialSplitEdgeController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function resolveInspector(documentRef) {
  if (typeof documentRef?.querySelectorAll !== 'function') {
    throw new TypeError('Sequential split request requires document query authority.');
  }
  const mounted = [...documentRef.querySelectorAll('[data-ttv-edit-inspector]')]
    .filter((element) => element?.isConnected !== false);
  if (mounted.length !== 1) {
    throw new RangeError(`Sequential split request requires exactly one mounted Edit Draft inspector; found ${mounted.length}.`);
  }
  return mounted[0];
}

function selectedFraction(inspector) {
  const raw = inspector.querySelector('[data-ttv-edit-split-fraction]')?.value;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    throw new TypeError('Sequential split request fraction is required.');
  }
  const fraction = Number(raw);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) {
    throw new RangeError('Sequential split request fraction must be strictly between 0 and 1.');
  }
  return fraction;
}

function selectedIntent(evidence, inspector) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const edges = rows.filter((row) => row?.kind === 'edge' && String(row.id || '').trim());
  if (rows.length !== 1 || edges.length !== 1) {
    throw new RangeError('Sequential split request requires exactly one selected edge.');
  }
  return Object.freeze({ edgeId: edges[0].id, fraction: selectedFraction(inspector) });
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
    edgeId: intent.edgeId, fraction: intent.fraction, createdAt,
  };
}

function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialSplitEdgeRequest(
    requestInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialSplitEdgeRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`,
    'application/json;charset=utf-8');
  return request;
}

export function createTopologySequentialSplitEdgeController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Split request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString());
  requiredFunction(now, 'now');

  function exportSequentialSplitEdgeRequest(intent = selectedIntent(
    evidence(), resolveInspector(documentRef),
  )) {
    return exportRequest(baseController, documentRef, intent, now);
  }

  function runOperation(operation) {
    if (operation === 'SPLIT_SEQUENTIAL_REQUEST') return exportSequentialSplitEdgeRequest();
    return baseRunOperation.call(baseController, operation);
  }

  return Object.freeze({
    ...baseController,
    schema: TOPOLOGY_SEQUENTIAL_SPLIT_EDGE_CONTROLLER_SCHEMA,
    runOperation,
    exportSequentialSplitEdgeRequest,
  });
}

export const _test = Object.freeze({
  resolveInspector, selectedFraction, selectedIntent, currentCanonical, requestInput,
});
