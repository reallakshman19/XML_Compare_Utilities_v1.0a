/** Immutable branch-local structural edit journal with explicit undo/redo cursor. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_TOPOLOGY_EDIT_JOURNAL_SCHEMA = 'SequentialTopologyEditJournal.v1';
export const SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_SCHEMA = 'SequentialTopologyEditEntry.v1';
export const SEQUENTIAL_TOPOLOGY_EDIT_TYPE = Object.freeze({ SPLIT_PIPE: 'SPLIT_PIPE' });
export const SEQUENTIAL_TOPOLOGY_EDIT_REJECTION = Object.freeze({
  JOURNAL_INVALID: 'SEQUENTIAL_TOPOLOGY_EDIT_JOURNAL_INVALID',
  BASE_STALE: 'SEQUENTIAL_TOPOLOGY_EDIT_BASE_STALE',
  ENTRY_INVALID: 'SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_INVALID',
  OPERATION_REPLAY: 'SEQUENTIAL_TOPOLOGY_EDIT_OPERATION_REPLAY',
  HISTORY_LIMIT: 'SEQUENTIAL_TOPOLOGY_EDIT_HISTORY_LIMIT',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    `${label} is required.`, TypeError);
  return result;
}
function operatorRecord(value = {}) {
  const appliedAt = text(value.appliedAt, 'appliedAt');
  if (!isIsoTimestamp(appliedAt)) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    'Topology edit appliedAt must be an exact ISO timestamp.', TypeError);
  return { actorId: text(value.actorId, 'actorId'), reason: text(value.reason, 'reason'),
    evidenceNote: String(value.evidenceNote || '').trim() || null, appliedAt };
}

const STRUCTURAL_KEYS = Object.freeze({ components: 'componentId', geometryParts: 'geometryPartId',
  ports: 'portId', nodes: 'nodeId', internalEdges: 'edgeId',
  committedConnections: 'connectionId', componentBoundaryCuts: 'boundaryCutId',
  selectionGroups: 'selectionGroupId', selectionCandidates: 'selectionCandidateId',
  eligibility: 'eligibilityId', supportCarriers: 'carrierId' });
function rows(value, key, label) {
  if (!Array.isArray(value)) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    `${label} must be an array.`, TypeError);
  const ids = value.map((row) => text(row?.[key], `${label} ${key}`));
  if (new Set(ids).size !== ids.length) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    `${label} contains duplicate ${key} values.`);
  return value;
}
function structuralState(value, label) {
  if (!value || typeof value !== 'object') fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    `${label} structural evidence is required.`, TypeError);
  return Object.fromEntries(Object.entries(STRUCTURAL_KEYS)
    .map(([name, key]) => [name, rows(value[name], key, `${label} ${name}`)]));
}
function exactIds(values, expected, label) {
  const actual = [...values].sort(); const wanted = [...expected].sort();
  if (!sameSequentialContractValue(actual, wanted)) fail(
    SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    `${label} differs from deterministic split identities.`);
}
function assertSplitCardinality(before, after, scene) {
  const invalid = before.components.length < 1 || before.geometryParts.length !== 1
    || before.ports.length !== 2 || before.nodes.length !== 2
    || before.internalEdges.length !== 1 || before.committedConnections.length !== 0
    || before.selectionGroups.length !== 1 || before.selectionCandidates.length !== 1
    || before.supportCarriers.length !== 1 || scene.before.length !== 1
    || after.components.length !== before.components.length + 1
    || after.geometryParts.length !== 2 || after.ports.length !== 4
    || after.nodes.length !== 3 || after.internalEdges.length !== 2
    || after.committedConnections.length !== 1 || after.selectionGroups.length !== 2
    || after.selectionCandidates.length !== 2 || after.supportCarriers.length !== 2
    || scene.after.length !== 2;
  if (invalid) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    'SPLIT_PIPE before/after structural cardinality is invalid.');
}
function assertSplitIdentities(input, before, after, scene) {
  const ids = input.identities;
  exactIds(after.components.map((row) => row.componentId),
    [ids.upstreamComponentId, ids.downstreamComponentId,
      ...before.components.slice(1).map((row) => row.componentId)], 'Affected components');
  exactIds(after.geometryParts.map((row) => row.geometryPartId),
    [ids.upstreamGeometryPartId, ids.downstreamGeometryPartId], 'Child geometry parts');
  exactIds(after.ports.map((row) => row.portId), [
    ...before.ports.map((row) => row.portId), ids.upstreamSplitPortId,
    ids.downstreamSplitPortId], 'Child ports');
  exactIds(after.nodes.map((row) => row.nodeId), [
    ...before.nodes.map((row) => row.nodeId), ids.splitNodeId], 'Affected nodes');
  exactIds(after.internalEdges.map((row) => row.edgeId),
    [ids.upstreamEdgeId, ids.downstreamEdgeId], 'Child internal edges');
  exactIds(after.committedConnections.map((row) => row.connectionId),
    [ids.splitConnectionId], 'Split connection');
  const parentInvalid = before.components[0].componentId !== input.parentComponentId
    || before.geometryParts[0].geometryPartId !== input.parentGeometryPartId
    || scene.before[0].id !== input.parentGeometryPartId
    || ids.parentComponentId !== input.parentComponentId
    || ids.parentGeometryPartId !== input.parentGeometryPartId;
  if (parentInvalid) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
    'Split parent evidence is inconsistent.');
  exactIds(scene.after.map((row) => row.id),
    [ids.upstreamGeometryPartId, ids.downstreamGeometryPartId], 'Split scene entities');
}
function splitEvidence(input) {
  const before = structuralState(input.before, 'before');
  const after = structuralState(input.after, 'after');
  const scene = { before: rows(input.scene?.before, 'id', 'before scene entities'),
    after: rows(input.scene?.after, 'id', 'after scene entities') };
  assertSplitCardinality(before, after, scene);
  assertSplitIdentities(input, before, after, scene);
  return { before, after, scene };
}

function activeHead(entries, cursor) {
  return sequentialSemanticFingerprint('SSKTOPOLOGYACTIVE', entries.slice(0, cursor));
}
function journalFingerprint(material) {
  return sequentialSemanticFingerprint('SSKTOPOLOGYJOURNAL', material);
}
function entryMaterial(input, journal) {
  if (String(input.type || '').toUpperCase() !== SEQUENTIAL_TOPOLOGY_EDIT_TYPE.SPLIT_PIPE) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
      `Unsupported topology edit type: ${input.type}`, TypeError);
  }
  if (input.location?.schema !== 'SequentialPipeSplitLocation.v1'
    || input.identities?.schema !== 'SequentialPipeSplitIdentities.v1') {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.ENTRY_INVALID,
      'Pipe split entry requires canonical location and identities.', TypeError);
  }
  const evidence = splitEvidence(input);
  const material = {
    schema: SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_SCHEMA,
    sequence: journal.cursor + 1,
    previousActiveHeadFingerprint: journal.activeHeadFingerprint,
    type: SEQUENTIAL_TOPOLOGY_EDIT_TYPE.SPLIT_PIPE,
    operationId: text(input.operationId, 'operationId'),
    targetId: text(input.targetId, 'targetId'),
    parentComponentId: text(input.parentComponentId, 'parentComponentId'),
    parentGeometryPartId: text(input.parentGeometryPartId, 'parentGeometryPartId'),
    location: input.location, identities: input.identities,
    before: evidence.before, after: evidence.after, scene: evidence.scene,
    ancestry: input.ancestry || {}, operator: operatorRecord(input.operator),
  };
  return material;
}
function canonicalEntry(input, journal) {
  const material = entryMaterial(input, journal);
  return immutableJson({ ...material,
    entryId: sequentialSemanticFingerprint('SSKTOPOLOGYENTRY', material) },
  'Sequential topology edit entry');
}
function journalMaterial(input) {
  return { schema: SEQUENTIAL_TOPOLOGY_EDIT_JOURNAL_SCHEMA,
    branchId: text(input.branchId, 'topology journal branchId'),
    baseAuthorityId: text(input.baseAuthorityId, 'baseAuthorityId'),
    baseTopologyFingerprint: text(input.baseTopologyFingerprint, 'baseTopologyFingerprint'),
    baseGeometryJournalFingerprint: String(input.baseGeometryJournalFingerprint || '').trim() || null,
    entries: input.entries || [], cursor: Number(input.cursor || 0) };
}
function finalize(material) {
  if (!Number.isInteger(material.cursor) || material.cursor < 0
    || material.cursor > material.entries.length) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.JOURNAL_INVALID,
      'Topology journal cursor is outside the entry range.');
  }
  const activeHeadFingerprint = activeHead(material.entries, material.cursor);
  return immutableJson({ ...material, activeHeadFingerprint,
    journalFingerprint: journalFingerprint({ ...material, activeHeadFingerprint }) },
  'Sequential topology edit journal');
}
export function sequentialTopologyEditBaseFingerprint(readModel, topology) {
  return sequentialSemanticFingerprint('SSKTOPOLOGYBASE', {
    authorityId: readModel?.authorityId,
    branchId: readModel?.branchId,
    topologyFingerprint: topology?.topologyFingerprint,
    geometryFingerprint: topology?.geometryFingerprint,
    geometryEditJournalFingerprint: readModel?.geometryEditJournalFingerprint || null,
  });
}
export function createSequentialTopologyEditJournal(input = {}) {
  return finalize(journalMaterial({ ...input, entries: [], cursor: 0 }));
}
export function appendSequentialTopologyEdit(journalInput, input = {}) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  if (journal.entries.some((row) => row.operationId === input.operationId)) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.OPERATION_REPLAY,
      `Topology operation has already been recorded: ${input.operationId}`);
  }
  const prefix = journal.entries.slice(0, journal.cursor);
  const working = finalize({ ...journalMaterial(journal), entries: prefix, cursor: prefix.length });
  const entry = canonicalEntry(input, working);
  const entries = [...prefix, entry];
  return Object.freeze({ entry, journal: finalize({ ...journalMaterial(journal),
    entries, cursor: entries.length }) });
}
export function undoSequentialTopologyEdit(journalInput) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  if (journal.cursor === 0) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.HISTORY_LIMIT,
    'No active topology edit is available to undo.');
  return finalize({ ...journalMaterial(journal), cursor: journal.cursor - 1 });
}
export function redoSequentialTopologyEdit(journalInput) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  if (journal.cursor >= journal.entries.length) fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.HISTORY_LIMIT,
    'No topology edit is available to redo.');
  return finalize({ ...journalMaterial(journal), cursor: journal.cursor + 1 });
}
export function activeSequentialTopologyEditEntries(journalInput) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  return journal.entries.slice(0, journal.cursor);
}
export function assertSequentialTopologyEditJournal(value, base = null) {
  if (value?.schema !== SEQUENTIAL_TOPOLOGY_EDIT_JOURNAL_SCHEMA) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.JOURNAL_INVALID,
      `Topology journal must use ${SEQUENTIAL_TOPOLOGY_EDIT_JOURNAL_SCHEMA}.`, TypeError);
  }
  let rebuilt = createSequentialTopologyEditJournal(value);
  value.entries.forEach((entry) => { rebuilt = appendSequentialTopologyEdit(rebuilt, entry).journal; });
  rebuilt = finalize({ ...journalMaterial(rebuilt), cursor: value.cursor });
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.JOURNAL_INVALID,
      'Topology journal differs from canonical regeneration.');
  }
  if (base && (value.branchId !== base.readModel.branchId
    || value.baseAuthorityId !== base.readModel.authorityId
    || value.baseTopologyFingerprint !== base.topology.topologyFingerprint
    || value.baseGeometryJournalFingerprint
      !== (base.readModel.geometryEditJournalFingerprint || null))) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_REJECTION.BASE_STALE,
      'Topology journal base authority is stale.');
  }
  return value;
}
