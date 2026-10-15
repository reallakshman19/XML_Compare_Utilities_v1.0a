/** Explicit, fail-closed target extraction for the complete native Topology command vocabulary. */
import { TOPOLOGY_SCOPED_EDIT_REJECTION, createTopologyScopedEditCommandTargets, topologyScopedEditCodedError } from './topology-scoped-edit-authority-contracts.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
export const TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES = Object.freeze(['MOVE_NODE', 'MERGE_NODES', 'BRIDGE_GAP', 'ADD_STRAIGHT_ELEMENT', 'SPLIT_EDGE', 'DISCONNECT_ENDPOINT', 'DELETE_EDGE', 'ADD_BEND_DEFINITION', 'ADD_JUNCTION_DEFINITION', 'TRIM_EDGE', 'TRANSACTION']);
const CANONICAL_COLLECTIONS = Object.freeze(['nodes', 'edges', 'supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures']);
function requiredId(payload, key, commandType) { const value = cleanText(payload[key]); if (!value) throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.EMPTY_COMMAND_TARGET_SET, `${commandType} requires ${key}.`, TypeError); return value; }
function canonicalIndex(canonical) {
  const index = new Map();
  for (const collection of CANONICAL_COLLECTIONS) for (const row of asArray(objectRecord(canonical)[collection]).map(objectRecord)) {
    const id = cleanText(row.id); if (!id) continue;
    if (index.has(id)) throw new TypeError(`Canonical entity id ${id} is duplicated.`);
    index.set(id, Object.freeze({ row, collection }));
  }
  return index;
}
export function topologySourceBranchIndex(sourcePath) { const match = cleanText(sourcePath).match(/^\$(?:\.(?:objects|hierarchy|branches))?\[(\d+)\]/); return match ? Number(match[1]) : null; }
function evidenceForIds(commandType, entityIds, canonical, childTargets = []) {
  const index = canonicalIndex(canonical), sourcePaths = [], branchIndexes = [];
  for (const entityId of entityIds) { const entry = index.get(entityId); if (!entry) continue; for (const path of asArray(entry.row.sourcePaths).map(cleanText).filter(Boolean)) { sourcePaths.push(path); const branch = topologySourceBranchIndex(path); if (branch !== null) branchIndexes.push(branch); } }
  return createTopologyScopedEditCommandTargets({ commandKind: 'NATIVE', commandType, entityIds, sourcePaths, sourceBranchIndexes: branchIndexes, childTargets });
}
function idsFromNative(command, canonical) {
  const type = cleanText(command.type).toUpperCase(), payload = objectRecord(command.payload);
  if (type === 'MOVE_NODE') return [requiredId(payload, 'nodeId', type)];
  if (type === 'MERGE_NODES') return [requiredId(payload, 'sourceNodeId', type), requiredId(payload, 'targetNodeId', type)];
  if (type === 'BRIDGE_GAP') return ['fromNodeId', 'toNodeId', 'contextEdgeId'].map((key) => requiredId(payload, key, type));
  if (type === 'ADD_STRAIGHT_ELEMENT') return [requiredId(payload, 'fromNodeId', type), requiredId(payload, 'contextEdgeId', type), cleanText(payload.toNodeId)].filter(Boolean);
  if (type === 'SPLIT_EDGE' || type === 'DELETE_EDGE') return [requiredId(payload, 'edgeId', type)];
  if (type === 'ADD_BEND_DEFINITION' || type === 'ADD_JUNCTION_DEFINITION') return [requiredId(payload, 'nodeId', type), ...asArray(payload.edgeIds).map(cleanText).filter(Boolean)];
  if (type === 'DISCONNECT_ENDPOINT' || type === 'TRIM_EDGE') { const edgeId = requiredId(payload, 'edgeId', type), edge = canonicalIndex(canonical).get(edgeId)?.row; const endpoint = requiredId(payload, 'endpoint', type).toUpperCase(); const nodeId = endpoint === 'FROM' ? cleanText(edge?.fromNodeId) : endpoint === 'TO' ? cleanText(edge?.toNodeId) : ''; return [edgeId, nodeId].filter(Boolean); }
  throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.UNSUPPORTED_COMMAND_TARGET_RESOLVER, `No explicit target resolver exists for native command ${type || '(missing)'}.`, RangeError);
}
function resolveTransaction(command, canonical) {
  const operations = asArray(objectRecord(command.payload).operations);
  if (!operations.length) throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.EMPTY_COMMAND_TARGET_SET, 'TRANSACTION requires operations.', TypeError);
  const children = operations.map((operation, index) => { const child = objectRecord(operation); if (cleanText(child.type).toUpperCase() === 'TRANSACTION') throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.UNSUPPORTED_COMMAND_TARGET_RESOLVER, `Nested transaction child ${index + 1} is unsupported.`, RangeError); return resolveTopologyNativeCommandTargets({ type: child.type, payload: child.payload }, canonical); });
  return evidenceForIds('TRANSACTION', children.flatMap((child) => child.entityIds), canonical, children);
}
export function resolveTopologyNativeCommandTargets(nativeCommand, canonical) { const command = objectRecord(nativeCommand), type = cleanText(command.type).toUpperCase(); if (type === 'TRANSACTION') return resolveTransaction(command, canonical); return evidenceForIds(type, idsFromNative(command, canonical), canonical); }
export function resolveTopologyAttributeTargets(editInput, canonical) {
  const edit = objectRecord(editInput), sourcePath = requiredId(edit, 'sourcePath', 'ATTRIBUTE_EDIT'), branchIndex = topologySourceBranchIndex(sourcePath);
  if (branchIndex === null || Number(edit.branchIndex) !== branchIndex) throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Attribute edit branchIndex does not match its explicit sourcePath.', TypeError);
  const ids = []; for (const [id, entry] of canonicalIndex(canonical)) if (asArray(entry.row.sourcePaths).map(cleanText).includes(sourcePath)) ids.push(id);
  return createTopologyScopedEditCommandTargets({ commandKind: 'ATTRIBUTE', commandType: 'ATTRIBUTE_EDIT', entityIds: ids, sourcePaths: [sourcePath], sourceBranchIndexes: [branchIndex], childTargets: [] });
}
export function resolveTopologyRemarkTargets(targetIdInput, canonical, replayState) {
  const targetId = cleanText(targetIdInput), command = asArray(replayState?.draft?.commands).find((row) => cleanText(row.id) === targetId);
  if (command) { const native = resolveTopologyNativeCommandTargets(command, canonical); return createTopologyScopedEditCommandTargets({ ...native, commandKind: 'REMARK', commandType: 'REMARK_SET' }); }
  const edit = asArray(replayState?.attributeLedger?.edits).find((row) => cleanText(row.id) === targetId);
  if (edit) { const attribute = resolveTopologyAttributeTargets(edit, canonical); return createTopologyScopedEditCommandTargets({ ...attribute, commandKind: 'REMARK', commandType: 'REMARK_SET' }); }
  return evidenceForIds('REMARK_SET', canonicalIndex(canonical).has(targetId) ? [targetId] : [], canonical);
}
export const _test = Object.freeze({ canonicalIndex, idsFromNative });
