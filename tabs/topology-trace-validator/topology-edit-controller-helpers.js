/** Pure state, identity, path-selection, and download helpers for Edit Draft. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const EDIT_KINDS = Object.freeze(['node', 'edge', 'support', 'bend', 'issue']);

export function emptyEditNavigation() {
  return Object.freeze({ fit: () => {}, zoomIn: () => {}, zoomOut: () => {}, destroy: () => {} });
}

export function producerSourceText(raw) {
  if (Array.isArray(raw)) return JSON.stringify(raw);
  const rows = raw?.hierarchy ?? raw?.branches ?? raw?.objects;
  if (!Array.isArray(rows) || !rows.length) throw new TypeError('Edit Draft requires a managed source branch array.');
  return JSON.stringify(rows);
}

export function producerOptions(traceEvidence) {
  const artifacts = objectRecord(traceEvidence.artifacts);
  const canonical = objectRecord(artifacts.canonical), ledger = objectRecord(artifacts.ledger);
  const configuration = objectRecord(ledger.topologyConfiguration), sourceIdentity = objectRecord(canonical.sourceIdentity);
  const sourceName = cleanText(sourceIdentity.sourceName)
    || cleanText(objectRecord(traceEvidence.fileNames).source)
    || 'topology-edit-source.json';
  return Object.freeze({
    sourceName,
    jobName: `${sourceName.replace(/\.json$/i, '')}-EDIT-DRAFT`,
    toleranceMm: Number(canonical.toleranceMm ?? configuration.topologyToleranceMm ?? 0.1),
    supportProjectionToleranceMm: Number(configuration.supportProjectionToleranceMm ?? 50),
    enrichmentConfig: Object.freeze({}),
  });
}

export function outputStem(name) {
  return cleanText(name).replace(/\.json$/i, '') || 'topology-edit';
}

export function downloadText(documentRef, name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = documentRef.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

export function uniqueSelection(rows) {
  const seen = new Set();
  return Object.freeze(rows.flatMap((row) => {
    const kind = cleanText(row.kind), id = cleanText(row.id), key = `${kind}:${id}`;
    if (!EDIT_KINDS.includes(kind) || !id || seen.has(key)) return [];
    seen.add(key); return [Object.freeze({ kind, id })];
  }));
}

export function shortestPathSelection(canonical, startId, targetId) {
  if (startId === targetId) return Object.freeze([{ kind: 'node', id: startId }]);
  const adjacency = new Map();
  for (const edge of asArray(canonical.edges).map(objectRecord)) {
    const from = cleanText(edge.fromNodeId), to = cleanText(edge.toNodeId), id = cleanText(edge.id);
    adjacency.set(from, [...(adjacency.get(from) ?? []), { nodeId: to, edgeId: id }]);
    adjacency.set(to, [...(adjacency.get(to) ?? []), { nodeId: from, edgeId: id }]);
  }
  const queue = [startId], predecessor = new Map([[startId, null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current === targetId) break;
    for (const next of adjacency.get(current) ?? []) {
      if (predecessor.has(next.nodeId)) continue;
      predecessor.set(next.nodeId, { nodeId: current, edgeId: next.edgeId });
      queue.push(next.nodeId);
    }
  }
  if (!predecessor.has(targetId)) return Object.freeze([{ kind: 'node', id: targetId }]);
  const rows = [], nodes = [];
  let current = targetId;
  while (current) {
    nodes.push(current);
    const previous = predecessor.get(current);
    if (!previous) break;
    rows.push({ kind: 'edge', id: previous.edgeId });
    current = previous.nodeId;
  }
  return uniqueSelection([...nodes.reverse().map((id) => ({ kind: 'node', id })), ...rows.reverse()]);
}

export function selectionForObjectId(canonical, objectId) {
  if (asArray(canonical.nodes).some((row) => cleanText(objectRecord(row).id) === objectId)) return { kind: 'node', id: objectId };
  if (asArray(canonical.edges).some((row) => cleanText(objectRecord(row).id) === objectId)) return { kind: 'edge', id: objectId };
  if (asArray(canonical.supports).some((row) => cleanText(objectRecord(row).id) === objectId)) return { kind: 'support', id: objectId };
  return null;
}

export function objectForSelection(canonical, selection, validation) {
  const collections = { node: 'nodes', edge: 'edges', support: 'supports' };
  if (collections[selection.kind]) return asArray(canonical[collections[selection.kind]]).map(objectRecord).find((row) => cleanText(row.id) === selection.id) ?? null;
  if (selection.kind === 'bend') {
    const edgeId = selection.id.replace(/^bend:/, '');
    return asArray(canonical.edges).map(objectRecord).find((row) => cleanText(row.id) === edgeId) ?? null;
  }
  if (selection.kind === 'issue') {
    const index = Number(selection.id.replace(/^finding-/, '')) - 1;
    return objectRecord(asArray(validation.findings)[index]);
  }
  return null;
}

export function uniqueContextEdges(canonical, selection, currentId) {
  const selectedNodeIds = new Set(selection.filter((row) => row.kind === 'node').map((row) => row.id));
  const selectedEdgeIds = new Set(selection.filter((row) => row.kind === 'edge').map((row) => row.id));
  if (currentId) selectedEdgeIds.add(currentId);
  return asArray(canonical.edges).map(objectRecord).filter((edge) => (
    selectedEdgeIds.has(cleanText(edge.id))
    || selectedNodeIds.has(cleanText(edge.fromNodeId))
    || selectedNodeIds.has(cleanText(edge.toNodeId))
  ));
}
