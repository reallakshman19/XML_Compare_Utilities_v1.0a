/** Narrow controller decorator for non-publishing DELETE_EDGE retirement request export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import { createTopologySequentialDeleteEdgeRequest, topologySequentialDeleteEdgeRequestFileName } from './topology-sequential-delete-edge-request.js';
export const TOPOLOGY_SEQUENTIAL_DELETE_EDGE_CONTROLLER_SCHEMA = 'TopologySequentialDeleteEdgeController.v1';
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function resolveInspector(documentRef) {
  if (typeof documentRef?.querySelectorAll !== 'function') throw new TypeError('Sequential retirement request requires document query authority.');
  const mounted = [...documentRef.querySelectorAll('[data-ttv-edit-inspector]')].filter((element) => element?.isConnected !== false);
  if (mounted.length !== 1) throw new RangeError(`Sequential retirement request requires exactly one mounted Edit Draft inspector; found ${mounted.length}.`);
  return mounted[0];
}
function selectedIntent(evidence, inspector) {
  if (!inspector?.querySelector) throw new TypeError('Sequential retirement request requires an inspector.');
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const edges = rows.filter((row) => row?.kind === 'edge' && String(row.id || '').trim());
  if (rows.length !== 1 || edges.length !== 1) throw new RangeError('Sequential retirement request requires exactly one selected edge.');
  return Object.freeze({ edgeId: edges[0].id });
}
function currentCanonical(evidence) {
  return evidence.editedArtifacts?.canonicalTopology ?? evidence.baseArtifacts?.canonicalTopology ?? null;
}
function requestInput(evidence, intent, createdAt) {
  return { canonical: currentCanonical(evidence), draft: evidence.draft,
    commandAuthority: evidence.commandAuthority, projectDocument: evidence.projectDocument,
    edgeId: intent.edgeId, createdAt };
}
function exportRequest(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const request = createTopologySequentialDeleteEdgeRequest(requestInput(evidence, intent, now()));
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologySequentialDeleteEdgeRequestFileName(request, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(request, null, 2)}\n`, 'application/json;charset=utf-8');
  return request;
}
export function createTopologySequentialDeleteEdgeController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation, 'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Retirement request controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString()); requiredFunction(now, 'now');
  function exportSequentialDeleteEdgeRequest(intent = selectedIntent(evidence(), resolveInspector(documentRef))) {
    return exportRequest(baseController, documentRef, intent, now);
  }
  function runOperation(operation) {
    if (operation === 'DELETE_SEQUENTIAL_REQUEST') return exportSequentialDeleteEdgeRequest();
    return baseRunOperation.call(baseController, operation);
  }
  return Object.freeze({ ...baseController, schema: TOPOLOGY_SEQUENTIAL_DELETE_EDGE_CONTROLLER_SCHEMA,
    runOperation, exportSequentialDeleteEdgeRequest });
}
export const _test = Object.freeze({ resolveInspector, selectedIntent, currentCanonical, requestInput });
