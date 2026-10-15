/** Command-authoritative Topology scope classification and target authorization. */
import { immutableJson } from '../../contracts/contract-values.js';
import {
  TOPOLOGY_SCOPED_EDIT_AUTHORIZATION_V1, TOPOLOGY_SCOPED_EDIT_COMMAND_SCOPE_V1,
  TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1, TOPOLOGY_SCOPED_EDIT_REJECTION,
  topologyScopedEditCodedError,
} from './topology-scoped-edit-authority-contracts.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { topologySourceBranchIndex } from './topology-scoped-edit-command-targets.js';

export const TOPOLOGY_COMMAND_AUTHORITY_MODE = Object.freeze({
  SMALL_FULL: 'SMALL_FULL', LARGE_SCOPED: 'LARGE_SCOPED',
  MODEL_WIDE_REVIEWED_FIX: 'MODEL_WIDE_REVIEWED_FIX',
  MODEL_WIDE_SAFE_AUTOFIX: 'MODEL_WIDE_SAFE_AUTOFIX',
});
const COLLECTIONS = Object.freeze(['nodes', 'edges', 'supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures']);
function canonicalRows(canonical) { return COLLECTIONS.flatMap((collection) => asArray(objectRecord(canonical)[collection]).map(objectRecord).filter((row) => cleanText(row.id)).map((row) => ({ collection, row }))); }
function rowBranches(row) { return [...new Set(asArray(row.sourcePaths).map(topologySourceBranchIndex).filter((value) => value !== null))]; }
function explicitReferences(collection, row) {
  if (collection === 'edges') return [row.fromNodeId, row.toNodeId];
  if (collection === 'supports') return [row.nodeId];
  if (collection === 'rigids') return [row.edgeId, row.nodeId];
  if (collection === 'junctions' || collection === 'boundaries') return [row.nodeId, ...asArray(row.participatingEdgeIds)];
  if (collection === 'bends') return [row.nodeId, ...asArray(row.edgeIds)];
  if (collection === 'pointFeatures') return [row.nodeId, row.edgeId];
  return [];
}
function adjacency(rows) {
  const ids = new Set(rows.map(({ row }) => cleanText(row.id))), graph = new Map([...ids].map((id) => [id, new Set()]));
  for (const { collection, row } of rows) { const id = cleanText(row.id); for (const reference of explicitReferences(collection, row).map(cleanText).filter((value) => ids.has(value))) { graph.get(id).add(reference); graph.get(reference).add(id); } }
  return graph;
}
function boundaryClosure(editable, graph) {
  const visited = new Set(editable), queue = [...editable].sort(), boundary = new Set();
  for (let cursor = 0; cursor < queue.length; cursor += 1) for (const next of [...(graph.get(queue[cursor]) ?? [])].sort()) { if (visited.has(next)) continue; visited.add(next); boundary.add(next); queue.push(next); }
  return boundary;
}
function modelWideGrant(input, mode) {
  const grant = input.modelWideGrant;
  if (grant?.schema !== TOPOLOGY_SCOPED_EDIT_MODEL_WIDE_GRANT_V1
    || grant.authorityMode !== mode || grant.originKind !== 'AUTOFIX') {
    throw topologyScopedEditCodedError(TOPOLOGY_SCOPED_EDIT_REJECTION.INVALID_MODEL_WIDE_AUTHORITY,
      'Model-wide mutation requires a service-issued authority grant bound to the exact batch.', TypeError);
  }
  return grant;
}
export function createTopologyScopedEditCommandScope(input = {}) {
  const rows = canonicalRows(input.canonical), allIds = rows.map(({ row }) => cleanText(row.id)).sort();
  if (new Set(allIds).size !== allIds.length) throw new TypeError('Canonical entity IDs must be unique for command scope.');
  const allBranches = [...new Set(rows.flatMap(({ row }) => rowBranches(row)))].sort((a, b) => a - b);
  const mode = cleanText(input.authorityMode).toUpperCase();
  if (!Object.values(TOPOLOGY_COMMAND_AUTHORITY_MODE).includes(mode)) throw topologyScopedEditCodedError(
    TOPOLOGY_SCOPED_EDIT_REJECTION.INVALID_MODEL_WIDE_AUTHORITY, `Unsupported command authority mode ${mode || '(missing)'}.`, TypeError);
  const modelWide = [TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_REVIEWED_FIX,
    TOPOLOGY_COMMAND_AUTHORITY_MODE.MODEL_WIDE_SAFE_AUTOFIX].includes(mode);
  const selectedBranches = modelWide || mode === TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL
    ? allBranches : [...new Set(asArray(input.editScope?.sourceBranchIndexes).map(Number))].sort((a, b) => a - b);
  if (mode === TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED && !selectedBranches.length) throw topologyScopedEditCodedError(
    TOPOLOGY_SCOPED_EDIT_REJECTION.INVALID_MODEL_WIDE_AUTHORITY, 'Large scoped command authority requires selected source branches.', TypeError);
  const editable = new Set(modelWide || mode === TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL
    ? allIds : rows.filter(({ row }) => rowBranches(row).some((index) => selectedBranches.includes(index))).map(({ row }) => cleanText(row.id)));
  const boundary = modelWide || mode === TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL ? new Set() : boundaryClosure(editable, adjacency(rows));
  const excluded = allIds.filter((id) => !editable.has(id) && !boundary.has(id));
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_COMMAND_SCOPE_V1, authorityMode: mode,
    editableEntityIds: [...editable].sort(), boundaryEntityIds: [...boundary].sort(), excludedEntityIds: excluded,
    editableSourceBranchIndexes: selectedBranches, originKind: cleanText(input.originKind).toUpperCase(),
    modelWideGrant: modelWide ? modelWideGrant(input, mode) : null,
  }, 'Topology scoped-edit command scope');
}
function fail(code, message) { throw topologyScopedEditCodedError(code, message, RangeError); }
export function authorizeTopologyCommandTargets(input = {}) {
  const targets = input.targets, scope = input.scope, commandType = cleanText(input.commandType).toUpperCase();
  if (targets?.commandType !== commandType) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH,
    `Authorized command ${targets?.commandType} does not match append command ${commandType}.`);
  const editable = new Set(scope?.editableEntityIds), boundary = new Set(scope?.boundaryEntityIds), excluded = new Set(scope?.excludedEntityIds);
  for (const id of targets.entityIds) { if (boundary.has(id)) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.BOUNDARY_TARGET_NOT_EDITABLE, `Boundary entity ${id} is not editable.`); if (excluded.has(id) || !editable.has(id)) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.EXCLUDED_TARGET_NOT_EDITABLE, `Excluded entity ${id} is not editable.`); }
  const branches = new Set(scope.editableSourceBranchIndexes);
  for (const index of targets.sourceBranchIndexes) if (!branches.has(index)) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.SOURCE_BRANCH_OUTSIDE_SCOPE, `Source branch ${index} is outside command authority.`);
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_AUTHORIZATION_V1, commandType,
    authorityMode: scope.authorityMode, originKind: cleanText(input.originKind).toUpperCase(), targets, scope,
  }, 'Topology scoped-edit authorization');
}
export function revalidateTopologyScopedEditAuthorization(authorization, commandType) {
  if (authorization?.schema !== TOPOLOGY_SCOPED_EDIT_AUTHORIZATION_V1) fail(TOPOLOGY_SCOPED_EDIT_REJECTION.COMMAND_AUTHORITY_MISMATCH, 'Topology command authorization schema is invalid.');
  return authorizeTopologyCommandTargets({ targets: authorization.targets, scope: authorization.scope, commandType, originKind: authorization.originKind });
}
export const _test = Object.freeze({ canonicalRows, explicitReferences, rowBranches });
