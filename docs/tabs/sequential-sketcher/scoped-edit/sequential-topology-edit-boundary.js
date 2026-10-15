/** Branch-keyed structural edit boundary layered after current geometry authority. */
import { sameSequentialContractValue, sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { createSequentialEffectiveTopologyReadModel } from './sequential-effective-topology-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from './sequential-scoped-edit-scene-adapter.js';
import { applySequentialTopologyEditJournalToTopology } from './sequential-topology-edit-projection.js';
import { assertSequentialTopologyEditJournal, createSequentialTopologyEditJournal,
  redoSequentialTopologyEdit, sequentialTopologyEditBaseFingerprint,
  undoSequentialTopologyEdit } from './sequential-topology-edit-journal.js';

export const SEQUENTIAL_TOPOLOGY_EDIT_BOUNDARY_SCHEMA = 'SequentialTopologyEditBoundary.v1';
export const SEQUENTIAL_PREPARED_TOPOLOGY_EDIT_CANDIDATE_SCHEMA =
  'SequentialPreparedTopologyEditCandidate.v1';
function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function branchId(view) { return String(view?.readModel?.branchId || '').trim(); }
function baseAuthority(runtime, view = runtime.readBaseView()) {
  if (!view?.readModel || !view?.scene) throw new RangeError(
    'Topology edit boundary requires a current geometry read view.');
  return { view, readModel: view.readModel,
    topology: createSequentialEditableTopologySnapshot(view.readModel) };
}
function createJournal(base) {
  return createSequentialTopologyEditJournal({ branchId: base.readModel.branchId,
    baseAuthorityId: base.readModel.authorityId,
    baseTopologyFingerprint: base.topology.topologyFingerprint,
    baseGeometryJournalFingerprint: base.readModel.geometryEditJournalFingerprint || null });
}
function resetJournal(runtime, id, base) {
  const journal = createJournal(base); runtime.byBranch.set(id, journal);
  runtime.consumedByBranch.set(id, new Set()); return journal;
}
function currentJournal(runtime, view = runtime.readBaseView()) {
  if (runtime.destroyed) throw new Error('Topology edit boundary is destroyed.');
  const base = baseAuthority(runtime, view); const id = branchId(view);
  if (!id) throw new RangeError('Topology edit boundary requires a current branch.');
  const stored = runtime.byBranch.get(id);
  if (!stored) return resetJournal(runtime, id, base);
  try { return assertSequentialTopologyEditJournal(stored, base); } catch (error) {
    if (stored.cursor > 0) throw error;
    return resetJournal(runtime, id, base);
  }
}
function effectiveView(runtime) {
  const view = runtime.readBaseView(); const journal = currentJournal(runtime, view);
  if (journal.cursor === 0) return Object.freeze({ baseReadModel: view.readModel,
    baseScene: view.scene, readModel: view.readModel, scene: view.scene,
    topologyEditJournal: journal });
  const readModel = createSequentialEffectiveTopologyReadModel(view.readModel, journal);
  return Object.freeze({ baseReadModel: view.readModel, baseScene: view.scene,
    readModel, scene: buildSequentialScopedEditEngineeringScene(readModel),
    topologyEditJournal: journal });
}
function wrappedOwner(ownerSnapshot, journal) {
  if (!ownerSnapshot?.revision) return ownerSnapshot || null;
  return Object.freeze({ ...ownerSnapshot, revision: Object.freeze({
    schema: 'SequentialTopologyEditOwnerRevision.v1', ownerRevision: ownerSnapshot.revision,
    topologyEditActiveHeadFingerprint: journal.activeHeadFingerprint,
    topologyEditCursor: journal.cursor }) });
}
function currentState(runtime) {
  const base = runtime.readBaseState(); const view = runtime.readBaseView();
  const journal = currentJournal(runtime, view);
  return { ...base, topologyEditJournal: journal,
    ownerSnapshot: wrappedOwner(base.ownerSnapshot, journal) };
}
function publicationAuthority(runtime, input) {
  const state = currentState(runtime); const authority = deriveSequentialEditAuthority(state);
  if (!sameSequentialContractValue(authority, input.expectedAuthority)) {
    throw new RangeError('Prepared topology edit is stale against current edit authority.');
  }
  const view = runtime.readBaseView();
  return { state, authority, view, journal: currentJournal(runtime, view) };
}
function candidateEvidence(current, journal) {
  const readModel = createSequentialEffectiveTopologyReadModel(current.view.readModel, journal);
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const topology = createSequentialEditableTopologySnapshot(readModel);
  return { readModel, scene, topology,
    sceneFingerprint: sequentialSemanticFingerprint('SSKTOPOLOGYSCENE', scene),
    topologyFingerprint: topology.topologyFingerprint };
}
function validateCandidate(current, candidate) {
  if (candidate?.schema !== SEQUENTIAL_PREPARED_TOPOLOGY_EDIT_CANDIDATE_SCHEMA) {
    throw new TypeError('Topology publication requires a prepared topology-edit candidate.');
  }
  if (candidate.expectedJournalFingerprint !== current.journal.journalFingerprint) {
    throw new RangeError('Prepared topology journal is stale.');
  }
  const base = baseAuthority(null, current.view);
  const journal = assertSequentialTopologyEditJournal(candidate.journal, base);
  const entry = journal.entries[journal.cursor - 1];
  if (!entry || !sameSequentialContractValue(entry, candidate.entry)) {
    throw new RangeError('Prepared topology entry is not the canonical active tail.');
  }
  const evidence = candidateEvidence(current, journal);
  if (candidate.effectiveReadAuthorityId !== evidence.readModel.authorityId
    || candidate.effectiveSceneFingerprint !== evidence.sceneFingerprint
    || candidate.effectiveTopologyFingerprint !== evidence.topologyFingerprint) {
    throw new RangeError('Prepared structural authority differs from deterministic regeneration.');
  }
  return { journal, entry, evidence };
}
function publicationRecord(current, preparedId, validated) {
  return Object.freeze({ schema: 'SequentialPipeSplitPublication.v1', committed: true,
    preparedId, entryId: validated.entry.entryId,
    operationId: validated.entry.operationId,
    parentComponentId: validated.entry.parentComponentId,
    childComponentIds: [validated.entry.identities.upstreamComponentId,
      validated.entry.identities.downstreamComponentId],
    splitNodeId: validated.entry.identities.splitNodeId,
    splitConnectionId: validated.entry.identities.splitConnectionId,
    expectedAuthorityId: current.authority.authorityId,
    topologyJournalFingerprint: validated.journal.journalFingerprint,
    topologyActiveHeadFingerprint: validated.journal.activeHeadFingerprint,
    effectiveReadAuthorityId: validated.evidence.readModel.authorityId,
    effectiveSceneFingerprint: validated.evidence.sceneFingerprint,
    effectiveTopologyFingerprint: validated.evidence.topologyFingerprint });
}
function publish(runtime, input = {}) {
  const current = publicationAuthority(runtime, input); const id = current.authority.branchId;
  const consumed = runtime.consumedByBranch.get(id) || new Set();
  if (consumed.has(input.preparedId)) throw new RangeError(
    'Prepared topology edit has already been consumed.');
  const validated = validateCandidate(current, input.candidate);
  runtime.byBranch.set(id, validated.journal); consumed.add(input.preparedId);
  runtime.consumedByBranch.set(id, consumed);
  const record = publicationRecord(current, input.preparedId, validated);
  runtime.onPublished(record); return record;
}
function history(runtime, action) {
  const view = runtime.readBaseView(); const id = branchId(view);
  const before = currentJournal(runtime, view);
  const journal = action === 'UNDO' ? undoSequentialTopologyEdit(before)
    : redoSequentialTopologyEdit(before);
  runtime.byBranch.set(id, journal);
  const record = Object.freeze({ schema: 'SequentialTopologyHistoryTransition.v1',
    action, branchId: id, previousCursor: before.cursor, cursor: journal.cursor,
    journalFingerprint: journal.journalFingerprint,
    activeHeadFingerprint: journal.activeHeadFingerprint });
  runtime.onPublished(record); return record;
}
function state(runtime) {
  return Object.freeze({ branchCount: runtime.byBranch.size,
    branches: Object.freeze([...runtime.byBranch.entries()].map(([id, journal]) => ({
      branchId: id, cursor: journal.cursor, entryCount: journal.entries.length,
      journalFingerprint: journal.journalFingerprint,
      activeHeadFingerprint: journal.activeHeadFingerprint,
      consumedPreparedCount: runtime.consumedByBranch.get(id)?.size || 0 }))),
    destroyed: runtime.destroyed });
}
export function createSequentialTopologyEditBoundary(options = {}) {
  const runtime = { readBaseState: requiredFunction(options.readBaseState, 'readBaseState'),
    readBaseView: requiredFunction(options.readBaseView, 'readBaseView'),
    onPublished: requiredFunction(options.onPublished, 'onPublished'),
    byBranch: new Map(), consumedByBranch: new Map(), destroyed: false };
  return Object.freeze({ schema: SEQUENTIAL_TOPOLOGY_EDIT_BOUNDARY_SCHEMA,
    readCurrentState: () => currentState(runtime), readView: () => effectiveView(runtime),
    readJournal: () => currentJournal(runtime), publishCandidate: (input) => publish(runtime, input),
    undo: () => history(runtime, 'UNDO'), redo: () => history(runtime, 'REDO'),
    getState: () => state(runtime), destroy() { if (runtime.destroyed) return false;
      runtime.destroyed = true; runtime.byBranch.clear(); runtime.consumedByBranch.clear(); return true; } });
}
export const _test = Object.freeze({ candidateEvidence, validateCandidate });
