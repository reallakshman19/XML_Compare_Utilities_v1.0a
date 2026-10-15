/** Narrow controller decorator for non-publishing ADD_STRAIGHT_ELEMENT request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologySequentialAddStraightRequest,
  topologySequentialAddStraightRequestFileName,
} from './topology-sequential-add-straight-request.js';

export const TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_CONTROLLER_SCHEMA =
  'TopologySequentialAddStraightController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function resolveInspector(documentRef) {
  if (typeof documentRef?.querySelectorAll !== 'function') {
    throw new TypeError('Sequential add request requires document query authority.');
  }
  const mounted = [...documentRef.querySelectorAll('[data-ttv-edit-inspector]')]
    .filter((element) => element?.isConnected !== false);
  if (mounted.length !== 1) {
    throw new RangeError(`Sequential add request requires exactly one mounted Edit Draft inspector; found ${mounted.length}.`);
  }
  return mounted[0];
}

function requiredNumber(inspector, axis) {
  const selector = `[data-ttv-edit-target="${axis}"]`;
  const text = String(inspector.querySelector(selector)?.value ?? '').trim();
  const value = Number(text);
  if (!text || !Number.isFinite(value)) {
    throw new TypeError(`Target ${axis.toUpperCase()} must be a finite number.`);
  }
  return value;
}

function targetPosition(inspector) {
  return Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis,
    requiredNumber(inspector, axis)]));
}

function selectedIntent(evidence, inspector) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const nodes = rows.filter((row) => row?.kind === 'node' && String(row.id || '').trim());
  const contextEdgeId = String(evidence?.contextEdgeId || '').trim();
  if (rows.length !== 1 || nodes.length !== 1) {
    throw new RangeError('Sequential add request requires exactly one selected start node.');
  }
  if (!contextEdgeId) {
    throw new RangeError('Sequential add request requires one explicit context edge.');
  }
  return Object.freeze({ nodeId: nodes[0].id, contextEdgeId,
    targetPosition: targetPosition(inspector) });
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
    nodeId: intent.nodeId,
    contextEdgeId: intent.contextEdgeId,
    targetPosition: intent.targetPosition,
    createdAt,
  };
}

function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialAddStraightRequest(
    requestInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialAddStraightRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`,
    'application/json;charset=utf-8');
  return request;
}

export function createTopologySequentialAddStraightController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Add request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString());
  requiredFunction(now, 'now');

  function exportSequentialAddStraightRequest(intent = selectedIntent(
    evidence(), resolveInspector(documentRef),
  )) {
    return exportRequest(baseController, documentRef, intent, now);
  }

  function runOperation(operation) {
    if (operation === 'ADD_SEQUENTIAL_REQUEST') {
      return exportSequentialAddStraightRequest();
    }
    return baseRunOperation.call(baseController, operation);
  }

  return Object.freeze({
    ...baseController,
    schema: TOPOLOGY_SEQUENTIAL_ADD_STRAIGHT_CONTROLLER_SCHEMA,
    runOperation,
    exportSequentialAddStraightRequest,
  });
}

export const _test = Object.freeze({
  resolveInspector, requiredNumber, targetPosition, selectedIntent, currentCanonical, requestInput,
});
