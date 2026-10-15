import assert from 'node:assert/strict';
import { buildSequentialEvidenceModel } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createEmptyConstructionSession } from '../tabs/sequential-sketcher/construction/sequential-construction-contract.js';
import { SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY } from '../tabs/sequential-sketcher/policy/sequential-external-boundary-policy.js';
import { SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY } from '../tabs/sequential-sketcher/policy/sequential-construction-tolerance-policy.js';
import {
  createSequentialWorkspaceApplicationReceipt,
  sequentialWorkspaceApplicationReceiptFingerprint,
  validateSequentialWorkspaceApplicationApproval,
  validateSequentialWorkspaceApplicationReceipt,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-application-receipt.js';
import {
  createSequentialWorkspacePackageWithReceipts,
  restoreSequentialWorkspacePackageWithReceipts,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package-receipts.js';
import {
  sequentialSourceRecordsFingerprint,
  sequentialWorkspacePackageFingerprint,
} from '../tabs/sequential-sketcher/persistence/sequential-workspace-package.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { sequentialCommandJournalHeadFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-journal.js';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function preview(destructive = true, journalImpact = destructive ? 'REMOVE' : 'UNCHANGED') {
  return Object.freeze({
    schema: 'SequentialWorkspaceImportPreview.v1',
    packageFingerprint: 'source-package-001',
    packageSchema: 'SequentialWorkspacePackage.v2',
    packageRevision: 2,
    packageSourceFingerprint: 'source-records-001',
    currentStateFingerprint: 'workspace-before-001',
    sourceRelation: destructive ? 'DIFFERENT' : 'MATCH',
    sourceReplacementRequired: destructive,
    addedBranchIds: ['/RECEIPT/B'],
    removedBranchIds: destructive ? ['/RECEIPT/OLD'] : [],
    newWorkspaceBranchIds: ['/RECEIPT/B'],
    overwrittenWorkspaceBranchIds: destructive ? ['/RECEIPT/A'] : [],
    unchangedWorkspaceBranchIds: destructive ? [] : ['/RECEIPT/A'],
    removedWorkspaceBranchIds: destructive ? ['/RECEIPT/OLD'] : [],
    activeBranchBefore: '/RECEIPT/OLD',
    activeBranchAfter: '/RECEIPT/A',
    packageTotals: Object.freeze({ transactionCount: 4, undoEntryCount: 2, redoEntryCount: 1, deferredDecisionCount: 1 }),
    decisionRegisterSummary: Object.freeze({ unresolvedCount: 2, manualResolutionCount: 1 }),
    journalImpact,
    hasDestructiveChanges: destructive,
  });
}
function createReceipt(overrides = {}) {
  return createSequentialWorkspaceApplicationReceipt({
    preview: preview(),
    restoration: {
      packageFingerprint: 'source-package-001',
      sourceFingerprint: 'source-records-001',
      packageSchema: 'SequentialWorkspacePackage.v2',
      packageRevision: 2,
    },
    beforeFingerprint: 'workspace-before-001',
    afterFingerprint: 'workspace-after-001',
    reason: 'Apply the reviewed package after branch reconciliation.',
    evidenceNote: 'Impact preview confirms source, workspace, and journal removal.',
    sequence: 3,
    ...overrides,
  });
}
function refreshPackageFingerprint(value) {
  value.packageFingerprint = sequentialWorkspacePackageFingerprint(value);
  return value;
}

assert.throws(
  () => validateSequentialWorkspaceApplicationApproval(preview(), {}),
  /WORKSPACE_APPLY_REASON_REQUIRED/,
);
assert.throws(
  () => validateSequentialWorkspaceApplicationApproval(preview(), { reason: 'Use reviewed package' }),
  /WORKSPACE_APPLY_EVIDENCE_REQUIRED/,
);
assert.deepEqual(
  validateSequentialWorkspaceApplicationApproval(preview(false), { reason: 'Restore matching review state' }),
  { reason: 'Restore matching review state', evidenceNote: '' },
);

const receipt = createReceipt();
assert.equal(receipt.schema, 'SequentialWorkspaceApplicationReceipt.v1');
assert.equal(receipt.status, 'APPLIED');
assert.equal(receipt.actorProvenance, 'USER_MANUAL');
assert.equal(receipt.sequence, 3);
assert.match(receipt.receiptId, /^WS-APPLY-00003-/u);
assert.equal(receipt.packageFingerprint, 'source-package-001');
assert.equal(receipt.packageSchema, 'SequentialWorkspacePackage.v2');
assert.equal(receipt.packageRevision, 2);
assert.equal(receipt.beforeWorkspaceFingerprint, 'workspace-before-001');
assert.equal(receipt.afterWorkspaceFingerprint, 'workspace-after-001');
assert.equal(receipt.impact.journalImpact, 'REMOVE');
assert.equal(receipt.impact.hasDestructiveChanges, true);
assert.equal(receipt.externalBoundaryPolicyFingerprint, SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint);
assert.equal(receipt.tolerancePolicyFingerprint, SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint);
assert.ok(receipt.receiptFingerprint);
assert.equal(validateSequentialWorkspaceApplicationReceipt(receipt).receiptId, receipt.receiptId);

{
  const tampered = clone(receipt);
  tampered.reason = 'Tampered reason';
  assert.throws(
    () => validateSequentialWorkspaceApplicationReceipt(tampered),
    /WORKSPACE_APPLY_RECEIPT_FINGERPRINT_MISMATCH/,
  );
}
{
  const tampered = clone(receipt);
  tampered.evidenceNote = '';
  assert.throws(
    () => validateSequentialWorkspaceApplicationReceipt(tampered),
    /WORKSPACE_APPLY_RECEIPT_DESTRUCTIVE_EVIDENCE_MISSING/,
  );
}
{
  const tampered = clone(receipt);
  tampered.impact.journalImpact = 'HIDDEN_FALLBACK';
  tampered.receiptFingerprint = sequentialWorkspaceApplicationReceiptFingerprint(tampered);
  assert.throws(
    () => validateSequentialWorkspaceApplicationReceipt(tampered),
    /WORKSPACE_APPLY_RECEIPT_JOURNAL_IMPACT_INVALID/,
  );
}
{
  const tampered = clone(receipt);
  tampered.packageRevision = 1;
  tampered.receiptFingerprint = sequentialWorkspaceApplicationReceiptFingerprint(tampered);
  assert.throws(
    () => validateSequentialWorkspaceApplicationReceipt(tampered),
    /WORKSPACE_APPLY_RECEIPT_PACKAGE_IDENTITY_INVALID/,
  );
}
assert.throws(
  () => createReceipt({
    restoration: {
      packageFingerprint: 'source-package-001',
      sourceFingerprint: 'source-records-001',
      packageSchema: 'SequentialWorkspacePackage.v1',
      packageRevision: 2,
    },
  }),
  /WORKSPACE_APPLY_PACKAGE_IDENTITY_REQUIRED/,
);
assert.throws(
  () => createReceipt({
    restoration: {
      packageFingerprint: 'source-package-001',
      sourceFingerprint: 'source-records-001',
      packageSchema: 'SequentialWorkspacePackage.v2',
      packageRevision: 0,
    },
  }),
  /WORKSPACE_APPLY_PACKAGE_IDENTITY_REQUIRED/,
  'an explicitly invalid restoration revision must not fall back to preview identity',
);
assert.throws(
  () => createReceipt({
    restoration: {
      packageFingerprint: 'source-package-001',
      sourceFingerprint: 'source-records-001',
      packageSchema: 'SequentialWorkspacePackage.v1',
      packageRevision: 1,
    },
    preview: preview(),
  }),
  /WORKSPACE_APPLY_PACKAGE_IDENTITY_MISMATCH/,
  'valid restoration and preview identities must agree exactly',
);

const legacyReceipt = clone(receipt);
delete legacyReceipt.packageSchema;
delete legacyReceipt.packageRevision;
delete legacyReceipt.impact.journalImpact;
legacyReceipt.receiptFingerprint = sequentialWorkspaceApplicationReceiptFingerprint(legacyReceipt);
assert.equal(validateSequentialWorkspaceApplicationReceipt(legacyReceipt).receiptId, receipt.receiptId);

const branchId = '/RECEIPT/A';
const records = [{ type: 'BRANCH', name: branchId, attributes: { NAME: branchId }, children: [] }];
const evidence = buildSequentialEvidenceModel(records);
const registry = createSequentialBranchWorkspaceRegistry();
registry.reset([branchId]);
registry.save(branchId, { session: createEmptyConstructionSession(branchId) });
const packageWithReceipt = createSequentialWorkspacePackageWithReceipts({
  records,
  evidence,
  branchRegistry: registry,
  activeBranchId: branchId,
  applicationReceipts: [receipt],
});
assert.equal(packageWithReceipt.schema, 'SequentialWorkspacePackage.v1');
assert.equal(packageWithReceipt.applicationReceipts.length, 1);
const packageInput = clone(packageWithReceipt);
const packageInputBefore = clone(packageInput);
const restoration = restoreSequentialWorkspacePackageWithReceipts(packageInput);
assert.deepEqual(packageInput, packageInputBefore, 'receipt-aware parser must not mutate caller package input');
assert.equal(restoration.packageSchema, 'SequentialWorkspacePackage.v1');
assert.equal(restoration.packageRevision, 1);
assert.equal(restoration.applicationReceipts.length, 1);
assert.equal(restoration.applicationReceipts[0].receiptId, receipt.receiptId);
assert.equal(restoration.journalState, undefined, 'v1 fallback must not fabricate journal authority');

const legacyPackage = createSequentialWorkspacePackageWithReceipts({
  records,
  evidence,
  branchRegistry: registry,
  activeBranchId: branchId,
  applicationReceipts: [legacyReceipt],
});
assert.equal(
  restoreSequentialWorkspacePackageWithReceipts(legacyPackage).applicationReceipts[0].receiptId,
  legacyReceipt.receiptId,
  'authenticated pre-2B receipts must remain preservable',
);

const journalState = createSequentialJournalAdoption({
  documentId: 'receipt-document',
  sessionId: 'receipt-session',
  sourceFingerprint: sequentialSourceRecordsFingerprint(records),
  branchRegistry: registry,
  adoptedAt: '2026-07-27T09:00:00.000Z',
});
const journalBefore = clone(journalState);
const receiptBefore = clone(receipt);
const adoptedOptions = {
  records,
  evidence,
  branchRegistry: registry,
  activeBranchId: branchId,
  applicationReceipts: [receipt],
  journalState,
  createdAt: '2026-07-27T09:01:00.000Z',
};
const adoptedPackage = createSequentialWorkspacePackageWithReceipts(adoptedOptions);
const adoptedAgain = createSequentialWorkspacePackageWithReceipts({
  ...adoptedOptions,
  records: clone(records),
  journalState: clone(journalState),
  applicationReceipts: clone(adoptedOptions.applicationReceipts),
});
assert.equal(adoptedPackage.schema, 'SequentialWorkspacePackage.v2');
assert.equal(adoptedPackage.revision, 2);
assert.deepEqual(adoptedAgain, adoptedPackage, 'equal adopted inputs must dispatch deterministically');
assert.deepEqual(journalState, journalBefore, 'package creation must not mutate caller journal state');
assert.deepEqual(receipt, receiptBefore, 'package creation must not mutate caller receipt');
const adoptedInput = clone(adoptedPackage);
const adoptedInputBefore = clone(adoptedInput);
const adoptedRestoration = restoreSequentialWorkspacePackageWithReceipts(adoptedInput);
assert.deepEqual(adoptedInput, adoptedInputBefore, 'v2 parsing must not mutate caller package input');
assert.equal(adoptedRestoration.packageSchema, 'SequentialWorkspacePackage.v2');
assert.equal(adoptedRestoration.packageRevision, 2);
assert.deepEqual(adoptedRestoration.journalState, journalState);
assert.equal(
  sequentialCommandJournalHeadFingerprint(adoptedRestoration.journalState),
  sequentialCommandJournalHeadFingerprint(journalState),
);
assert.equal(adoptedRestoration.applicationReceipts[0].receiptId, receipt.receiptId);

assert.throws(
  () => createSequentialWorkspacePackageWithReceipts({ ...adoptedOptions, journalState: { schema: 'Wrong' } }),
  /WORKSPACE_COMMAND_JOURNAL_INVALID/,
);
assert.throws(
  () => restoreSequentialWorkspacePackageWithReceipts({ schema: 'SequentialWorkspacePackage.v99' }),
  /WORKSPACE_PACKAGE_SCHEMA_UNSUPPORTED/,
);
assert.throws(
  () => restoreSequentialWorkspacePackageWithReceipts('{broken'),
  /WORKSPACE_PACKAGE_RECEIPTS_JSON_INVALID/,
);
{
  const future = clone(adoptedPackage);
  future.minimumReaderRevision = 3;
  refreshPackageFingerprint(future);
  assert.throws(
    () => restoreSequentialWorkspacePackageWithReceipts(future),
    /WORKSPACE_PACKAGE_V2_READER_UNSUPPORTED/,
  );
}
{
  const future = clone(adoptedPackage);
  future.commandAuthority.minimumReaderRevision = 3;
  refreshPackageFingerprint(future);
  assert.throws(
    () => restoreSequentialWorkspacePackageWithReceipts(future),
    /WORKSPACE_COMMAND_AUTHORITY_READER_UNSUPPORTED/,
  );
}
{
  const tampered = clone(packageWithReceipt);
  tampered.applicationReceipts[0].reason = 'Tampered but package re-fingerprinted';
  refreshPackageFingerprint(tampered);
  assert.throws(
    () => restoreSequentialWorkspacePackageWithReceipts(tampered),
    /WORKSPACE_APPLY_RECEIPT_FINGERPRINT_MISMATCH/,
  );
}

console.log('sequential workspace application receipt tests passed');
