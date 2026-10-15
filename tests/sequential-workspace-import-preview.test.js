import assert from 'node:assert/strict';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import {
  createEmptyConstructionSession,
  freezeConstructionSession,
} from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import {
  buildSequentialWorkspaceImportPreview,
  formatSequentialWorkspaceImportPreview,
  sequentialWorkspaceCurrentStateFingerprint,
  sequentialWorkspaceRestorationStateFingerprint,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js';
import { sequentialSourceRecordsFingerprint } from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { appendSequentialCommandJournal } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';

function records(branchIds) {
  return branchIds.map((branchId) => ({
    type: 'BRANCH',
    name: branchId,
    attributes: { NAME: branchId },
    children: [],
  }));
}
function session(branchId, state, extra = {}) {
  return freezeConstructionSession({
    ...createEmptyConstructionSession(branchId),
    state,
    ...extra,
  });
}
function model(sourceRecords, branchIds, entries, activeBranchId = null, journalState = null) {
  const registry = createSequentialBranchWorkspaceRegistry();
  registry.reset(branchIds);
  for (const entry of entries) registry.save(entry.branchId, entry.snapshot);
  return {
    records: sourceRecords,
    evidence: { branches: branchIds.map((branchId) => ({ branchId })) },
    branchRegistry: registry,
    session: activeBranchId ? registry.get(activeBranchId)?.session || null : null,
    journalState,
  };
}
function restoration(sourceRecords, branchIds, workspaces, activeBranchId, journalState = null) {
  return Object.freeze({
    schema: journalState ? 'SequentialWorkspaceRestoration.v2' : 'SequentialWorkspaceRestoration.v1',
    packageSchema: journalState ? 'SequentialWorkspacePackage.v2' : 'SequentialWorkspacePackage.v1',
    packageRevision: journalState ? 2 : 1,
    packageFingerprint: journalState ? 'pkg-preview-v2' : 'pkg-preview-001',
    sourceFingerprint: sequentialSourceRecordsFingerprint(sourceRecords),
    records: sourceRecords,
    evidence: { branches: branchIds.map((branchId) => ({ branchId })) },
    branchIds,
    activeBranchId,
    workspaces: Object.freeze(workspaces.map((row) => Object.freeze(row))),
    decisionRegister: Object.freeze({
      schema: 'SequentialDecisionRegister.v1',
      summary: Object.freeze({ unresolvedCount: 2, manualResolutionCount: 1 }),
    }),
    journalState,
  });
}
function journalCommand(issuedAt) {
  return {
    commandType: 'TEST',
    payload: {},
    basis: { documentHash: 'preview-document-hash', revision: 'preview-revision-1' },
    origin: { kind: 'USER', actorId: 'PREVIEW_TEST', issuedAt },
    transactionId: null,
    inverse: null,
  };
}

const currentRecords = records(['/PREVIEW/A', '/PREVIEW/B']);
const packageRecords = records(['/PREVIEW/B', '/PREVIEW/C']);
const currentA = session('/PREVIEW/A', 'ROUTE_COMPLETE', {
  transactionLedger: [{ transactionId: 'TX-A', schema: 'SequentialConstructionTransaction.v1' }],
  undoStack: [{ transactionId: 'TX-A' }],
});
const currentB = session('/PREVIEW/B', 'USER_DECISION_REQUIRED', {
  deferredDecisionIds: ['DEC-B'],
});
const packageB = session('/PREVIEW/B', 'ROUTE_COMPLETE', {
  transactionLedger: [
    { transactionId: 'TX-B1', schema: 'SequentialConstructionTransaction.v1' },
    { transactionId: 'TX-B2', schema: 'SequentialConstructionTransaction.v1' },
  ],
  undoStack: [{ transactionId: 'TX-B1' }],
});
const packageC = session('/PREVIEW/C', 'USER_DECISION_REQUIRED', {
  transactionLedger: [{ transactionId: 'TX-C', schema: 'SequentialConstructionTransaction.v1' }],
  redoStack: [{ transactionId: 'TX-C' }],
  deferredDecisionIds: ['DEC-C1', 'DEC-C2'],
});
const currentEntries = [
  { branchId: '/PREVIEW/A', snapshot: { session: currentA, selectedCandidateId: 'CAND-A' } },
  { branchId: '/PREVIEW/B', snapshot: { session: currentB } },
];
const packageEntries = [
  { branchId: '/PREVIEW/B', snapshot: { session: packageB, selectedCandidateId: '' } },
  { branchId: '/PREVIEW/C', snapshot: { session: packageC, selectedCandidateId: 'CAND-C' } },
];
const currentModel = model(currentRecords, ['/PREVIEW/A', '/PREVIEW/B'], currentEntries, '/PREVIEW/A');
const v1Restoration = restoration(packageRecords, ['/PREVIEW/B', '/PREVIEW/C'], packageEntries, '/PREVIEW/C');

const preview = buildSequentialWorkspaceImportPreview(v1Restoration, currentModel);
assert.equal(preview.schema, 'SequentialWorkspaceImportPreview.v1');
assert.equal(preview.packageSchema, 'SequentialWorkspacePackage.v1');
assert.equal(preview.packageRevision, 1);
assert.equal(preview.journalImpact, 'ABSENT');
assert.equal(preview.currentJournalAuthorityPresent, false);
assert.equal(preview.packageJournalAuthorityPresent, false);
assert.equal(preview.sourceRelation, 'DIFFERENT');
assert.equal(preview.sourceReplacementRequired, true);
assert.deepEqual(preview.addedBranchIds, ['/PREVIEW/C']);
assert.deepEqual(preview.removedBranchIds, ['/PREVIEW/A']);
assert.deepEqual(preview.commonBranchIds, ['/PREVIEW/B']);
assert.deepEqual(preview.newWorkspaceBranchIds, ['/PREVIEW/C']);
assert.deepEqual(preview.overwrittenWorkspaceBranchIds, ['/PREVIEW/B']);
assert.deepEqual(preview.unchangedWorkspaceBranchIds, []);
assert.deepEqual(preview.removedWorkspaceBranchIds, ['/PREVIEW/A']);
assert.equal(preview.activeBranchBefore, '/PREVIEW/A');
assert.equal(preview.activeBranchAfter, '/PREVIEW/C');
assert.equal(preview.packageTotals.transactionCount, 3);
assert.equal(preview.packageTotals.undoEntryCount, 1);
assert.equal(preview.packageTotals.redoEntryCount, 1);
assert.equal(preview.packageTotals.deferredDecisionCount, 2);
assert.equal(preview.packageTotals.completeWorkspaceCount, 1);
assert.equal(preview.packageTotals.blockedWorkspaceCount, 1);
assert.equal(preview.hasDestructiveChanges, true);
assert.equal(preview.requiresExplicitApply, true);
assert.equal(preview.decisionRegisterSummary.unresolvedCount, 2);
const previewText = formatSequentialWorkspaceImportPreview(preview);
assert.match(previewText, /will replace the current source evidence/);
assert.match(previewText, /Nothing has been applied/);
assert.match(previewText, /3 transactions/);
assert.match(previewText, /journal impact ABSENT/);
assert.equal(
  sequentialWorkspaceRestorationStateFingerprint(v1Restoration),
  sequentialWorkspaceRestorationStateFingerprint(JSON.parse(JSON.stringify(v1Restoration))),
);

const matchingModel = model(packageRecords, ['/PREVIEW/B', '/PREVIEW/C'], [
  { branchId: '/PREVIEW/B', snapshot: { session: packageB } },
  { branchId: '/PREVIEW/C', snapshot: { session: packageC, selectedCandidateId: 'CAND-C' } },
], '/PREVIEW/C');
const matchingPreview = buildSequentialWorkspaceImportPreview(v1Restoration, matchingModel);
assert.equal(matchingPreview.sourceRelation, 'MATCH');
assert.equal(matchingPreview.sourceReplacementRequired, false);
assert.deepEqual(matchingPreview.overwrittenWorkspaceBranchIds, []);
assert.deepEqual(matchingPreview.unchangedWorkspaceBranchIds, ['/PREVIEW/B', '/PREVIEW/C']);
assert.equal(matchingPreview.hasDestructiveChanges, false);
assert.equal(matchingPreview.journalImpact, 'ABSENT');

const emptyPreview = buildSequentialWorkspaceImportPreview(v1Restoration, {});
assert.equal(emptyPreview.sourceRelation, 'EMPTY');
assert.equal(emptyPreview.currentBranchCount, 0);
assert.deepEqual(emptyPreview.addedBranchIds, ['/PREVIEW/B', '/PREVIEW/C']);
assert.equal(emptyPreview.packageSavedWorkspaceCount, 2);
assert.equal(emptyPreview.journalImpact, 'ABSENT');

const initialFingerprint = sequentialWorkspaceCurrentStateFingerprint(currentModel);
currentModel.session = currentB;
assert.notEqual(sequentialWorkspaceCurrentStateFingerprint(currentModel), initialFingerprint,
  'active branch changes must invalidate an existing preview');
currentModel.session = currentA;
currentModel.branchRegistry.save('/PREVIEW/B', { session: packageB });
assert.notEqual(sequentialWorkspaceCurrentStateFingerprint(currentModel), initialFingerprint,
  'workspace changes must invalidate an existing preview');
const sourceChanged = { ...currentModel, records: records(['/PREVIEW/A', '/PREVIEW/B', '/PREVIEW/X']) };
assert.notEqual(sequentialWorkspaceCurrentStateFingerprint(sourceChanged), sequentialWorkspaceCurrentStateFingerprint(currentModel),
  'source changes must invalidate an existing preview');
const noJournalEquivalent = model(currentRecords, ['/PREVIEW/A', '/PREVIEW/B'], currentEntries, '/PREVIEW/A', null);
assert.equal(
  sequentialWorkspaceCurrentStateFingerprint(noJournalEquivalent),
  sequentialWorkspaceCurrentStateFingerprint(model(currentRecords, ['/PREVIEW/A', '/PREVIEW/B'], currentEntries, '/PREVIEW/A')),
  'absent journal authority must not change v1 current-state identity',
);

const adoptedRecords = records(['/PREVIEW/J']);
const adoptedEntries = [{ branchId: '/PREVIEW/J', snapshot: { session: createEmptyConstructionSession('/PREVIEW/J') } }];
const adoptedModel = model(adoptedRecords, ['/PREVIEW/J'], adoptedEntries, '/PREVIEW/J');
const adoptedSourceFingerprint = sequentialSourceRecordsFingerprint(adoptedRecords);
const journal = createSequentialJournalAdoption({
  documentId: 'preview-document',
  sessionId: 'preview-session',
  sourceFingerprint: adoptedSourceFingerprint,
  branchRegistry: adoptedModel.branchRegistry,
  adoptedAt: '2026-07-27T09:10:00.000Z',
});
const adoptedRestoration = restoration(adoptedRecords, ['/PREVIEW/J'], adoptedEntries, '/PREVIEW/J', journal);
const install = buildSequentialWorkspaceImportPreview(adoptedRestoration, adoptedModel);
assert.equal(install.journalImpact, 'INSTALL');
assert.equal(install.currentJournalAuthorityPresent, false);
assert.equal(install.packageJournalAuthorityPresent, true);
assert.equal(install.packageJournalStateSchema, journal.schema);
assert.equal(install.packageJournalCheckpointId, journal.adoptionCheckpoint.checkpointId);
assert.ok(install.packageJournalHeadFingerprint);
assert.equal(install.hasDestructiveChanges, false);

const currentAdopted = model(adoptedRecords, ['/PREVIEW/J'], adoptedEntries, '/PREVIEW/J', journal);
const unchanged = buildSequentialWorkspaceImportPreview(adoptedRestoration, currentAdopted);
assert.equal(unchanged.journalImpact, 'UNCHANGED');
assert.equal(unchanged.currentJournalStateSchema, journal.schema);
assert.equal(unchanged.currentJournalCheckpointId, journal.adoptionCheckpoint.checkpointId);
assert.equal(unchanged.currentJournalHeadFingerprint, unchanged.packageJournalHeadFingerprint);
assert.equal(unchanged.hasDestructiveChanges, false);

const replacementJournal = createSequentialJournalAdoption({
  documentId: 'preview-document-2',
  sessionId: 'preview-session-2',
  sourceFingerprint: adoptedSourceFingerprint,
  branchRegistry: adoptedModel.branchRegistry,
  adoptedAt: '2026-07-27T09:11:00.000Z',
});
const replacement = buildSequentialWorkspaceImportPreview(
  restoration(adoptedRecords, ['/PREVIEW/J'], adoptedEntries, '/PREVIEW/J', replacementJournal),
  currentAdopted,
);
assert.equal(replacement.journalImpact, 'REPLACE');
assert.equal(replacement.hasDestructiveChanges, true);
const removal = buildSequentialWorkspaceImportPreview(
  restoration(adoptedRecords, ['/PREVIEW/J'], adoptedEntries, '/PREVIEW/J'),
  currentAdopted,
);
assert.equal(removal.journalImpact, 'REMOVE');
assert.equal(removal.hasDestructiveChanges, true);

const journalFingerprint = sequentialWorkspaceCurrentStateFingerprint(currentAdopted);
const changedHead = appendSequentialCommandJournal(
  journal,
  journalCommand('2026-07-27T09:12:00.000Z'),
  '2026-07-27T09:12:00.000Z',
);
assert.notEqual(
  sequentialWorkspaceCurrentStateFingerprint({ ...currentAdopted, journalState: changedHead }),
  journalFingerprint,
  'journal-head-only change must invalidate an existing preview',
);
const independent = model(
  adoptedRecords,
  ['/PREVIEW/J'],
  adoptedEntries,
  '/PREVIEW/J',
  JSON.parse(JSON.stringify(journal)),
);
assert.equal(sequentialWorkspaceCurrentStateFingerprint(independent), journalFingerprint);
assert.throws(
  () => sequentialWorkspaceCurrentStateFingerprint({ ...currentAdopted, journalState: { schema: 'Wrong' } }),
  /WORKSPACE_IMPORT_JOURNAL_STATE_INVALID/,
);
assert.throws(
  () => buildSequentialWorkspaceImportPreview({ ...adoptedRestoration, journalState: { schema: 'Wrong' } }, currentAdopted),
  /WORKSPACE_IMPORT_PACKAGE_JOURNAL_INVALID/,
);
for (const invalidJournalState of [false, 0, '']) {
  assert.throws(
    () => sequentialWorkspaceCurrentStateFingerprint({ ...currentAdopted, journalState: invalidJournalState }),
    /WORKSPACE_IMPORT_JOURNAL_STATE_INVALID/,
    'falsey-but-present current authority must fail closed',
  );
  assert.throws(
    () => buildSequentialWorkspaceImportPreview({ ...v1Restoration, journalState: invalidJournalState }, currentModel),
    /WORKSPACE_IMPORT_PACKAGE_JOURNAL_INVALID/,
    'falsey-but-present package authority must fail closed',
  );
  assert.throws(
    () => sequentialWorkspaceRestorationStateFingerprint({ ...v1Restoration, journalState: invalidJournalState }),
    /WORKSPACE_IMPORT_JOURNAL_STATE_INVALID/,
    'falsey-but-present restoration authority must not collapse to absent',
  );
}
assert.throws(
  () => buildSequentialWorkspaceImportPreview({ schema: 'WrongSchema' }, currentModel),
  /WORKSPACE_IMPORT_PREVIEW_RESTORATION_INVALID/,
);
assert.throws(() => formatSequentialWorkspaceImportPreview({}), /WORKSPACE_IMPORT_PREVIEW_INVALID/);

console.log('sequential workspace import preview tests passed');
