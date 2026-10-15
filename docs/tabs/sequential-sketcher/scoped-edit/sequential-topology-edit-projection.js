/** Deterministic structural topology and scene projection from active topology journal entries. */
import { createEngineeringScene, validateEngineeringScene } from '../../../core/engineering-scene/index.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { activeSequentialTopologyEditEntries, assertSequentialTopologyEditJournal,
  SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_SCHEMA } from './sequential-topology-edit-journal.js';

export const SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION = Object.freeze({
  ENTRY_STALE: 'SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_STALE',
  IDENTITY_COLLISION: 'SEQUENTIAL_TOPOLOGY_EDIT_IDENTITY_COLLISION',
  ENTRY_INVALID: 'SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_INVALID',
});
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function keyConfig() {
  return {
    components: 'componentId', geometryParts: 'geometryPartId', ports: 'portId', nodes: 'nodeId',
    internalEdges: 'edgeId', committedConnections: 'connectionId',
    componentBoundaryCuts: 'boundaryCutId', selectionGroups: 'selectionGroupId',
    selectionCandidates: 'selectionCandidateId', eligibility: 'eligibilityId',
    supportCarriers: 'carrierId',
  };
}
function assertEntry(entry) {
  if (entry?.schema !== SEQUENTIAL_TOPOLOGY_EDIT_ENTRY_SCHEMA || entry.type !== 'SPLIT_PIPE') {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_INVALID,
      'Topology projection requires one canonical SPLIT_PIPE entry.', TypeError);
  }
  return entry;
}
function byId(rows, key) { return new Map(rows.map((row) => [row[key], row])); }
function assertBefore(currentRows, beforeRows, key, label) {
  const current = byId(currentRows, key);
  beforeRows.forEach((row) => {
    if (!sameSequentialContractValue(current.get(row[key]), row)) {
      fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_STALE,
        `${label} is stale for ${row[key]}.`);
    }
  });
}
function collisionCheck(currentRows, beforeRows, afterRows, key, label) {
  const removed = new Set(beforeRows.map((row) => row[key]));
  const current = new Set(currentRows.map((row) => row[key]));
  const afterIds = afterRows.map((row) => row[key]);
  if (new Set(afterIds).size !== afterIds.length) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.IDENTITY_COLLISION,
      `${label} after evidence contains duplicate identities.`);
  }
  const collision = afterIds.find((id) => current.has(id) && !removed.has(id));
  if (collision) fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.IDENTITY_COLLISION,
    `${label} identity collides with current authority: ${collision}`);
}
function replaceRows(currentRows, beforeRows, afterRows, key, label) {
  assertBefore(currentRows, beforeRows, key, label);
  collisionCheck(currentRows, beforeRows, afterRows, key, label);
  const removed = new Set(beforeRows.map((row) => row[key]));
  const afterById = byId(afterRows, key);
  const created = afterRows.filter((row) => !removed.has(row[key]));
  let inserted = false; const result = [];
  currentRows.forEach((row) => {
    if (!removed.has(row[key])) { result.push(row); return; }
    if (!inserted) { result.push(...created); inserted = true; }
    const replacement = afterById.get(row[key]); if (replacement) result.push(replacement);
  });
  if (!inserted) result.push(...created);
  return result;
}
function validateEntry(snapshot, entry) {
  const keys = keyConfig();
  Object.entries(keys).forEach(([name, key]) => {
    const before = entry.before?.[name] || []; const after = entry.after?.[name] || [];
    if (!Array.isArray(before) || !Array.isArray(after)) {
      fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_INVALID,
        `Split entry ${name} evidence must be arrays.`, TypeError);
    }
    assertBefore(snapshot[name] || [], before, key, name);
    collisionCheck(snapshot[name] || [], before, after, key, name);
  });
  if (entry.before.components.length < 1 || entry.before.geometryParts.length !== 1
    || entry.after.components.length !== entry.before.components.length + 1
    || entry.after.geometryParts.length !== 2) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_INVALID,
      'Split entry must replace one parent part and add exactly one component.');
  }
}
function projectEntry(snapshot, entryInput) {
  const entry = assertEntry(entryInput); validateEntry(snapshot, entry);
  const result = { ...snapshot };
  Object.entries(keyConfig()).forEach(([name, key]) => {
    result[name] = replaceRows(snapshot[name] || [], entry.before[name] || [],
      entry.after[name] || [], key, name);
  });
  result.topologySupersededComponents = [
    ...(snapshot.topologySupersededComponents || []),
    { componentId: entry.parentComponentId, geometryPartId: entry.parentGeometryPartId,
      entryId: entry.entryId, operationId: entry.operationId },
  ];
  return result;
}
export function applySequentialTopologyEditJournalToTopology(snapshotInput, journalInput) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  let snapshot = snapshotInput;
  for (const entry of activeSequentialTopologyEditEntries(journal)) snapshot = projectEntry(snapshot, entry);
  return Object.freeze({ ...snapshot,
    topologyEditJournalFingerprint: journal.activeHeadFingerprint,
    effectiveStructuralFingerprint: sequentialSemanticFingerprint('SSKEFFECTIVETOPOLOGY', {
      components: snapshot.components, geometryParts: snapshot.geometryParts,
      ports: snapshot.ports, nodes: snapshot.nodes, internalEdges: snapshot.internalEdges,
      committedConnections: snapshot.committedConnections,
      componentBoundaryCuts: snapshot.componentBoundaryCuts,
      activeHeadFingerprint: journal.activeHeadFingerprint,
    }) });
}
function projectSceneEntry(scene, entryInput) {
  const entry = assertEntry(entryInput); const key = 'id';
  const before = entry.scene?.before || []; const after = entry.scene?.after || [];
  if (before.length !== 1 || after.length !== 2) {
    fail(SEQUENTIAL_TOPOLOGY_EDIT_PROJECTION_REJECTION.ENTRY_INVALID,
      'Split scene evidence must replace one entity with two.', TypeError);
  }
  return createEngineeringScene({ ...scene,
    entities: replaceRows(scene.entities, before, after, key, 'scene entity') });
}
export function applySequentialTopologyEditJournalToScene(sceneInput, journalInput, options = {}) {
  const journal = assertSequentialTopologyEditJournal(journalInput);
  let scene = validateEngineeringScene(sceneInput);
  for (const entry of activeSequentialTopologyEditEntries(journal)) scene = projectSceneEntry(scene, entry);
  return createEngineeringScene({ ...scene,
    sceneId: String(options.sceneId || scene.sceneId), revision: options.revision || scene.revision,
    metadata: { ...scene.metadata, sequentialTopologyEdit: {
      journalFingerprint: journal.journalFingerprint,
      activeHeadFingerprint: journal.activeHeadFingerprint,
      cursor: journal.cursor, entryCount: journal.entries.length,
    } } });
}
export const _test = Object.freeze({ replaceRows, projectEntry, projectSceneEntry });
