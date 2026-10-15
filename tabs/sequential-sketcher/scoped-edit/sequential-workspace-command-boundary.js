/** Workspace-owned read and restoration publication boundary for accepted command candidates. */
import { createSequentialBranchWorkspaceRegistry } from '../sequential-branch-workspace-state.js';
import { sequentialSourceRecordsFingerprint } from '../persistence/sequential-workspace-package.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  sameSequentialContractValue,
  sequentialCommandCodedError,
} from './sequential-command-contracts.js';
import { sequentialCommandJournalHeadFingerprint } from './sequential-command-journal.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';

export const SEQUENTIAL_WORKSPACE_COMMAND_BOUNDARY_SCHEMA = 'SequentialWorkspaceCommandBoundary.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function fail(code, message, Constructor = Error) {
  throw sequentialCommandCodedError(code, message, Constructor);
}
function modelFrom(reader) {
  const model = reader();
  if (!model || typeof model !== 'object') throw new TypeError('Sequential workspace command model is unavailable.');
  return model;
}
function sourceFingerprint(records) {
  return Array.isArray(records) ? sequentialSourceRecordsFingerprint(records) : null;
}
function journalHead(journalState) {
  if (journalState === null || journalState === undefined) return null;
  try { return sequentialCommandJournalHeadFingerprint(journalState); } catch { return null; }
}
function commandOwnerSnapshot(ownerSnapshot, journalState) {
  if (!ownerSnapshot?.revision) return ownerSnapshot || null;
  return Object.freeze({
    ...ownerSnapshot,
    revision: Object.freeze({
      schema: 'SequentialCommandOwnerRevision.v1',
      ownerRevision: ownerSnapshot.revision,
      journalHeadFingerprint: journalHead(journalState),
    }),
  });
}
function injectFailure(factory, stage) {
  if (typeof factory !== 'function') return;
  const result = factory(stage);
  if (result instanceof Error) throw result;
  if (result) throw new Error(String(result));
}
function preparedEntries(model, candidate) {
  if (!Array.isArray(candidate?.branchEntries)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      'Accepted candidate branch entries are unavailable.', TypeError);
  }
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.replace(model.branchRegistry?.ids?.() || [], candidate.branchEntries);
  const active = registry.get(candidate.session?.rootBranchId);
  if (!active || !sameSequentialContractValue(active.session, candidate.session)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.COMPLETE_RESULT_MISMATCH,
      'Accepted candidate does not contain the exact active branch session.', RangeError);
  }
  return registry.entries();
}
function restoration(model, candidate, branchEntries) {
  return Object.freeze({
    schema: 'SequentialWorkspaceRestoration.v2',
    packageSchema: 'SequentialWorkspacePackage.v2',
    packageRevision: 2,
    records: model.records,
    evidence: model.evidence,
    indexes: model.indexes,
    sourceFingerprint: sequentialSourceRecordsFingerprint(model.records),
    branchIds: model.branchRegistry.ids(),
    activeBranchId: candidate.session.rootBranchId,
    workspaces: branchEntries,
    decisionRegister: model.restoredDecisionRegister || null,
    journalState: candidate.journalState,
    applicationReceipts: model.workspaceApplicationReceipts || Object.freeze([]),
  });
}
function publicationEvidence(preparedId, authority, syncFailure) {
  return Object.freeze({
    schema: 'SequentialCommandPublication.v1', committed: true, preparedId,
    expectedAuthorityId: authority.authorityId, synchronizationWarning: syncFailure || null,
  });
}

export function createSequentialWorkspaceCommandBoundary(options = {}) {
  const readModel = requiredFunction(options.readModel, 'readModel');
  const readOwnerSnapshot = requiredFunction(options.readOwnerSnapshot, 'readOwnerSnapshot');
  const readEngineOptions = requiredFunction(options.readEngineOptions, 'readEngineOptions');
  const restorePackage = requiredFunction(options.restorePackage, 'restorePackage');
  const syncAfterCommit = requiredFunction(options.syncAfterCommit, 'syncAfterCommit');
  function readCurrentState() {
    const model = modelFrom(readModel);
    return {
      sourceFingerprint: sourceFingerprint(model.records),
      evidence: model.evidence, indexes: model.indexes, session: model.session,
      confirmedConstruction: model.confirmedConstruction,
      supportProjection: model.supportProjection,
      branchRegistry: model.branchRegistry, journalState: model.journalState,
      ownerSnapshot: commandOwnerSnapshot(readOwnerSnapshot(), model.journalState),
      engineOptions: { ...readEngineOptions() },
    };
  }
  function publishCandidate(input = {}) {
    const before = readCurrentState();
    const authority = deriveSequentialEditAuthority(before);
    if (!sameSequentialContractValue(authority, input.expectedAuthority)) {
      fail(SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE,
        'Sequential workspace authority changed before publication.', RangeError);
    }
    const model = modelFrom(readModel);
    const branchEntries = preparedEntries(model, input.candidate);
    const next = restoration(model, input.candidate, branchEntries);
    injectFailure(options.failureFactory, 'before-commit');
    restorePackage(next, {
      expectedJournalImpact: 'REPLACE',
      applicationReceipts: next.applicationReceipts,
    });
    let syncFailure = null;
    try { syncAfterCommit({ preparedId: input.preparedId, envelope: input.envelope }); }
    catch (error) {
      syncFailure = error?.message || String(error);
      try { options.onSynchronizationFailure?.({ message: syncFailure, preparedId: input.preparedId }); } catch {}
    }
    return publicationEvidence(input.preparedId, authority, syncFailure);
  }
  return Object.freeze({
    schema: SEQUENTIAL_WORKSPACE_COMMAND_BOUNDARY_SCHEMA,
    readCurrentState,
    publishCandidate,
  });
}
