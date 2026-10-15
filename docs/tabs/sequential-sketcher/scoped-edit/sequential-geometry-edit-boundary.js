/** Branch-keyed geometry history publication boundary layered after support authority. */
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { assertSequentialGeometryEditJournal, createSequentialGeometryEditJournal, sequentialGeometryEditBaseFingerprint } from './sequential-geometry-edit-journal.js';
import { assertSequentialGeometryEditHistory, consumeSequentialGeometryHistoryTransition, createSequentialGeometryEditHistory, recordSequentialGeometryEditHistoryJournal, sequentialGeometryEditHistoryJournal, transitionSequentialGeometryEditHistory } from './sequential-geometry-edit-history.js';
import { SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_CANDIDATE_SCHEMA } from './sequential-geometry-edit-history-service.js';
import { applySequentialGeometryEditJournalToScene, applySequentialGeometryEditJournalToTopology } from './sequential-geometry-edit-projection.js';
import { geometryEditPackageRows, restoreGeometryEditPackageMaps } from '../persistence/sequential-geometry-edit-package-state.js';
import { createSequentialEffectiveGeometryReadModel } from './sequential-effective-geometry-read-model.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { buildSequentialScopedEditEngineeringScene } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_GEOMETRY_EDIT_BOUNDARY_SCHEMA = 'SequentialGeometryEditBoundary.v1';
export const SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA = 'SequentialPreparedGeometryEditCandidate.v1';
export const SEQUENTIAL_PREPARED_GEOMETRY_MOVE_CANDIDATE_SCHEMA = 'SequentialPreparedGeometryMoveCandidate.v1';

const GEOMETRY_PACKAGE_STAGE_SCHEMA = 'SequentialGeometryEditPackageStage.v1';
const GEOMETRY_PACKAGE_COMMIT_SCHEMA = 'SequentialGeometryEditPackageCommit.v1';

function requiredFunction(value, label) { if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`); return value; }
function branchId(view) { return String(view?.readModel?.branchId || '').trim(); }
function wrappedOwner(ownerSnapshot, history) {
  if (!ownerSnapshot?.revision) return ownerSnapshot || null;
  return Object.freeze({ ...ownerSnapshot, revision: Object.freeze({
    schema: 'SequentialGeometryEditOwnerRevision.v1', ownerRevision: ownerSnapshot.revision,
    geometryEditJournalHeadFingerprint: history.activeHeadFingerprint,
    geometryEditHistoryFingerprint: history.historyFingerprint,
    geometryEditHistoryCursor: history.cursor,
  }) });
}
function baseSnapshot(view) {
  if (!view?.readModel || !view?.scene) throw new RangeError(
    'Geometry edit boundary requires a current base read view.');
  return createSequentialEditableTopologySnapshot(view.readModel);
}
function createHistory(snapshot) {
  const journal = createSequentialGeometryEditJournal({
    branchId: snapshot.branch.branchId,
    confirmedConstructionFingerprint: snapshot.authority.confirmedConstructionFingerprint,
    baseFingerprint: sequentialGeometryEditBaseFingerprint(snapshot),
  });
  return createSequentialGeometryEditHistory({ journal });
}
function effectiveView(view, history) {
  const journal = sequentialGeometryEditHistoryJournal(history);
  const readModel = createSequentialEffectiveGeometryReadModel(view.readModel, journal);
  return Object.freeze({ baseReadModel: view.readModel, baseScene: view.scene, readModel,
    scene: buildSequentialScopedEditEngineeringScene(readModel), geometryEditJournal: journal,
    geometryEditHistory: history });
}
function candidateEvidence(view, journal) {
  const snapshot = baseSnapshot(view);
  const readModel = createSequentialEffectiveGeometryReadModel(view.readModel, journal);
  const scene = applySequentialGeometryEditJournalToScene(view.scene, journal, {
    revision: readModel.revision, sceneId: readModel.sceneId,
  });
  const topology = applySequentialGeometryEditJournalToTopology(snapshot, journal);
  return Object.freeze({ readModel, scene, topology,
    sceneFingerprint: sequentialSemanticFingerprint('SSKGEOMETRYSCENE', scene),
    topologyFingerprint: topology.effectiveGeometryFingerprint });
}
function resetHistory(runtime, id, snapshot) {
  const history = createHistory(snapshot); runtime.byBranch.set(id, history); return history;
}
function currentHistory(runtime, view = runtime.readBaseView()) {
  if (runtime.destroyed) throw new Error('Geometry edit boundary is destroyed.');
  const snapshot = baseSnapshot(view); const id = branchId(view);
  if (!id) throw new RangeError('Geometry edit boundary requires a current branch.');
  const stored = runtime.byBranch.get(id);
  if (!stored) return resetHistory(runtime, id, snapshot);
  try { return assertSequentialGeometryEditHistory(stored, { snapshot }); } catch (error) {
    if (stored.entries?.length || stored.cursor || stored.consumedTransitionIds?.length) throw error;
    return resetHistory(runtime, id, snapshot);
  }
}
function currentJournal(runtime, view = runtime.readBaseView()) { return sequentialGeometryEditHistoryJournal(currentHistory(runtime, view)); }
function readView(runtime) {
  const view = runtime.readBaseView(); return effectiveView(view, currentHistory(runtime, view));
}
function readCurrentState(runtime) {
  const base = runtime.readBaseState(); const view = runtime.readBaseView();
  const history = currentHistory(runtime, view);
  return { ...base, geometryEditJournal: sequentialGeometryEditHistoryJournal(history),
    geometryEditHistory: history, ownerSnapshot: wrappedOwner(base.ownerSnapshot, history) };
}
function publicationAuthority(runtime, input) {
  const state = readCurrentState(runtime); const authority = deriveSequentialEditAuthority(state);
  if (!sameSequentialContractValue(authority, input.expectedAuthority)) throw new RangeError(
    'Prepared geometry edit is stale against current edit authority.');
  const view = runtime.readBaseView(); const history = currentHistory(runtime, view);
  return Object.freeze({ state, authority, view, history,
    journal: sequentialGeometryEditHistoryJournal(history) });
}
function candidateSchema(value) {
  return value === SEQUENTIAL_PREPARED_GEOMETRY_EDIT_CANDIDATE_SCHEMA
    || value === SEQUENTIAL_PREPARED_GEOMETRY_MOVE_CANDIDATE_SCHEMA;
}
function validateCandidate(current, candidate) {
  if (!candidateSchema(candidate?.schema)) throw new TypeError(
    'Geometry publication requires a prepared geometry-edit candidate.');
  if (candidate.expectedJournalHeadFingerprint !== current.journal.headFingerprint) {
    throw new RangeError('Prepared geometry journal head is stale.');
  }
  const journal = assertSequentialGeometryEditJournal(candidate.journal, baseSnapshot(current.view));
  const entry = journal.entries.at(-1);
  const appendValid = journal.entries.length === current.journal.entries.length + 1
    && sameSequentialContractValue(journal.entries.slice(0, -1), current.journal.entries);
  if (!appendValid || !entry || !sameSequentialContractValue(entry, candidate.entry)) {
    throw new RangeError('Prepared geometry entry is not one append to the active journal prefix.');
  }
  const evidence = candidateEvidence(current.view, journal);
  if (candidate.effectiveReadAuthorityId !== evidence.readModel.authorityId
    || candidate.effectiveSceneFingerprint !== evidence.sceneFingerprint
    || candidate.effectiveTopologyFingerprint !== evidence.topologyFingerprint) throw new RangeError(
    'Prepared effective geometry differs from deterministic regeneration.');
  return Object.freeze({ journal, entry, evidence,
    history: recordSequentialGeometryEditHistoryJournal(current.history, journal) });
}
function commonPublication(current, preparedId, validated) {
  return { committed: true, preparedId, entryId: validated.entry.entryId,
    operationId: validated.entry.operationId, componentId: validated.entry.componentId,
    expectedAuthorityId: current.authority.authorityId,
    journalHeadFingerprint: validated.journal.headFingerprint,
    historyFingerprint: validated.history.historyFingerprint,
    geometryHistoryCursor: validated.history.cursor,
    effectiveReadAuthorityId: validated.evidence.readModel.authorityId,
    effectiveSceneFingerprint: validated.evidence.sceneFingerprint,
    effectiveTopologyFingerprint: validated.evidence.topologyFingerprint };
}
function publicationRecord(current, preparedId, validated) {
  const entry = validated.entry; const common = commonPublication(current, preparedId, validated);
  if (entry.type === 'STRETCH_NODE') return Object.freeze({
    schema: 'SequentialNodeStretchPublication.v1', ...common,
    type: entry.type, nodeId: entry.nodeId, affectedComponentIds: entry.affectedComponentIds,
  });
  if (entry.type === 'ROTATE_SUBGRAPH') return Object.freeze({
    schema: 'SequentialSubgraphRotationPublication.v1', ...common,
    type: entry.type, seedComponentId: entry.seedComponentId, scope: entry.scope,
    affectedComponentIds: entry.affectedComponentIds, pivot: entry.pivot, axis: entry.axis,
    angleDegrees: entry.angleDegrees,
  });
  return Object.freeze({ schema: 'SequentialGeometryMovePublication.v1', ...common });
}
function publishCandidate(runtime, input = {}) {
  if (runtime.destroyed) throw new Error('Geometry edit boundary is destroyed.');
  const current = publicationAuthority(runtime, input); const id = current.authority.branchId;
  const consumed = runtime.consumedByBranch.get(id) || new Set();
  if (consumed.has(input.preparedId)) throw new RangeError(
    'Prepared geometry edit has already been consumed.');
  const validated = validateCandidate(current, input.candidate);
  runtime.byBranch.set(id, validated.history); consumed.add(input.preparedId);
  runtime.consumedByBranch.set(id, consumed);
  const publication = publicationRecord(current, input.preparedId, validated);
  runtime.onPublished(publication); return publication;
}
function validateHistoryCandidate(current, candidate) {
  if (candidate?.schema !== SEQUENTIAL_PREPARED_GEOMETRY_HISTORY_CANDIDATE_SCHEMA) {
    throw new TypeError('Geometry history publication requires a prepared history candidate.');
  }
  const exact = candidate.expectedBranchId === current.history.branchId
    && candidate.expectedConstructionFingerprint === current.history.confirmedConstructionFingerprint
    && candidate.expectedBaseFingerprint === current.history.baseFingerprint
    && candidate.expectedHistoryFingerprint === current.history.historyFingerprint
    && candidate.expectedCursor === current.history.cursor
    && candidate.expectedActiveHeadFingerprint === current.history.activeHeadFingerprint;
  if (!exact) throw new RangeError('Prepared geometry history candidate is stale.');
  const transition = transitionSequentialGeometryEditHistory(current.history, candidate.action);
  if (!sameSequentialContractValue(transition.history, candidate.history)
    || !sameSequentialContractValue(transition.affectedEntry, candidate.affectedEntry)) {
    throw new RangeError('Prepared geometry history transition is not canonical.');
  }
  return transition;
}
function publishHistoryCandidate(runtime, input = {}) {
  const current = publicationAuthority(runtime, input); const id = current.authority.branchId;
  if (current.history.consumedTransitionIds.includes(input.preparedId)) {
    throw new RangeError('Prepared geometry history transition has already been consumed.');
  }
  const transition = validateHistoryCandidate(current, input.candidate);
  const history = consumeSequentialGeometryHistoryTransition(transition.history, input.preparedId);
  runtime.byBranch.set(id, history);
  const publication = Object.freeze({
    schema: 'SequentialGeometryEditHistoryPublication.v1', committed: true,
    action: transition.action, preparedId: input.preparedId,
    affectedEntry: transition.affectedEntry,
    fromCursor: current.history.cursor, toCursor: history.cursor,
    historyFingerprint: history.historyFingerprint,
    activeHeadFingerprint: history.activeHeadFingerprint,
    expectedAuthorityId: current.authority.authorityId,
  });
  runtime.onPublished(publication); return publication;
}
function exportPackageState(runtime) { if (runtime.destroyed) throw new Error('Geometry edit boundary is destroyed.'); return geometryEditPackageRows(runtime.byBranch, runtime.consumedByBranch); }
function replaceMap(target, source) { target.clear(); source.forEach((value, key) => target.set(key, value)); }
function restorationBase(view) {
  if (!view?.readModel || !view?.scene) return Object.freeze({ branchId: null, fingerprint: null });
  const snapshot = baseSnapshot(view);
  return Object.freeze({ branchId: branchId(view),
    fingerprint: sequentialGeometryEditBaseFingerprint(snapshot), snapshot });
}
function validateRestoredBase(restored, base) {
  if (!base.branchId) return;
  const history = restored.byBranch.get(base.branchId);
  if (history) assertSequentialGeometryEditHistory(history, { snapshot: base.snapshot });
}
function preparePackageState(runtime, value, options = {}) {
  if (runtime.destroyed) throw new Error('Geometry edit boundary is destroyed.');
  const restored = restoreGeometryEditPackageMaps(value);
  const base = restorationBase(options.baseView || runtime.readBaseView());
  validateRestoredBase(restored, base);
  const stage = Object.freeze({ schema: GEOMETRY_PACKAGE_STAGE_SCHEMA, state: restored.state });
  runtime.preparedPackageStages.set(stage, Object.freeze({ restored, base })); return stage;
}
function preparedRecord(runtime, stage) {
  const record = runtime.preparedPackageStages.get(stage);
  if (stage?.schema !== GEOMETRY_PACKAGE_STAGE_SCHEMA || !record) {
    throw new TypeError('Geometry package state must be prepared by this boundary.');
  }
  return record;
}
function commitPackageState(runtime, stage) {
  if (runtime.destroyed) throw new Error('Geometry edit boundary is destroyed.');
  const record = preparedRecord(runtime, stage);
  const currentBase = restorationBase(runtime.readBaseView());
  if (currentBase.branchId !== record.base.branchId
    || currentBase.fingerprint !== record.base.fingerprint) {
    throw new RangeError('Prepared geometry package base changed before commit.');
  }
  validateRestoredBase(record.restored, currentBase);
  const previous = Object.freeze({ byBranch: new Map(runtime.byBranch),
    consumedByBranch: new Map(runtime.consumedByBranch) });
  replaceMap(runtime.byBranch, record.restored.byBranch);
  replaceMap(runtime.consumedByBranch, record.restored.consumedByBranch);
  const commit = Object.freeze({ schema: GEOMETRY_PACKAGE_COMMIT_SCHEMA,
    state: record.restored.state });
  runtime.committedPackageStates.set(commit, previous);
  runtime.preparedPackageStages.delete(stage); return commit;
}
function committedRecord(runtime, commit) {
  const previous = runtime.committedPackageStates.get(commit);
  if (commit?.schema !== GEOMETRY_PACKAGE_COMMIT_SCHEMA || !previous) {
    throw new TypeError('Geometry package commit is not active on this boundary.');
  }
  return previous;
}
function rollbackPackageState(runtime, commit) {
  const previous = committedRecord(runtime, commit);
  replaceMap(runtime.byBranch, previous.byBranch);
  replaceMap(runtime.consumedByBranch, previous.consumedByBranch);
  runtime.committedPackageStates.delete(commit); return commit.state;
}
function finalizePackageState(runtime, commit) {
  committedRecord(runtime, commit); runtime.committedPackageStates.delete(commit); return commit.state;
}
function discardPackageState(runtime, stage) { if (!runtime.preparedPackageStages.has(stage)) return false; runtime.preparedPackageStages.delete(stage); return true; }
function boundaryState(runtime) {
  return Object.freeze({ branchCount: runtime.byBranch.size,
    branches: Object.freeze([...runtime.byBranch.entries()].map(([id, history]) => Object.freeze({
      branchId: id, entryCount: history.entries.length, activeEntryCount: history.cursor,
      redoEntryCount: history.entries.length - history.cursor,
      journalHeadFingerprint: history.activeHeadFingerprint,
      historyFingerprint: history.historyFingerprint,
      consumedPreparedCount: runtime.consumedByBranch.get(id)?.size || 0,
      consumedTransitionCount: history.consumedTransitionIds.length,
    }))), destroyed: runtime.destroyed });
}
function destroyBoundary(runtime) { if (runtime.destroyed) return false; runtime.destroyed = true; runtime.byBranch.clear(); runtime.consumedByBranch.clear(); return true; }

export function createSequentialGeometryEditBoundary(options = {}) {
  const runtime = { readBaseState: requiredFunction(options.readBaseState, 'readBaseState'),
    readBaseView: requiredFunction(options.readBaseView, 'readBaseView'),
    onPublished: requiredFunction(options.onPublished, 'onPublished'),
    byBranch: new Map(), consumedByBranch: new Map(), destroyed: false,
    preparedPackageStages: new WeakMap(), committedPackageStates: new WeakMap() };
  return Object.freeze({
    schema: SEQUENTIAL_GEOMETRY_EDIT_BOUNDARY_SCHEMA,
    readCurrentState: () => readCurrentState(runtime),
    readHistory: () => currentHistory(runtime, runtime.readBaseView()),
    readJournal: () => currentJournal(runtime, runtime.readBaseView()),
    readView: () => readView(runtime), publishCandidate: (input) => publishCandidate(runtime, input),
    publishHistoryCandidate: (input) => publishHistoryCandidate(runtime, input),
    exportPackageState: () => exportPackageState(runtime),
    preparePackageState: (value, options) => preparePackageState(runtime, value, options),
    commitPackageState: (stage) => commitPackageState(runtime, stage),
    rollbackPackageState: (commit) => rollbackPackageState(runtime, commit),
    finalizePackageState: (commit) => finalizePackageState(runtime, commit),
    discardPackageState: (stage) => discardPackageState(runtime, stage),
    getState: () => boundaryState(runtime), destroy: () => destroyBoundary(runtime),
  });
}

export const _test = Object.freeze({ candidateEvidence, effectiveView, validateCandidate,
  validateHistoryCandidate });