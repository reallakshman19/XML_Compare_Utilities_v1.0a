import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import {
  completeRevisionCompareTransferApplyRequest,
  captureRevisionCompareTransferApplyAuthority,
  executeRevisionCompareTransferApply,
  failRevisionCompareTransferApplyRequest,
  reconcileRevisionCompareTransferApplyAuthority,
  startRevisionCompareTransferApplyRequest,
} from '../tabs/revision-compare/revision-transfer-apply-state.js';
import {
  captureRevisionCompareTransferAuthority,
  invalidateRevisionCompareTransferRequest,
  setRevisionCompareTransferPolicyVersion,
  setRevisionCompareTransferSelection,
} from '../tabs/revision-compare/revision-transfer-contracts.js';
import { createRevisionCompareTransferApplication } from '../tabs/revision-compare/revision-transfer-result.js';
import { createdAt, workspaceFixture } from './revision-compare-transfer-apply-fixtures.mjs';

function withTransfer(workspace, transfer) { return deepFreeze({ ...workspace, transfer }); }
function currentTransfer(workspace) {
  return deepFreeze({ ...workspace.transfer, authority: captureRevisionCompareTransferAuthority(workspace) });
}

const base = await workspaceFixture();
const planned = currentTransfer(base);
const plannedWorkspace = withTransfer(base, planned);
const authority = captureRevisionCompareTransferApplyAuthority(plannedWorkspace);

assert.throws(() => startRevisionCompareTransferApplyRequest(planned,
  deepFreeze({ ...authority, plan: deepFreeze({ ...authority.plan, planId: 'revision-transfer-plan:other' }) }),
  createdAt), /authority does not match/);

const applying = startRevisionCompareTransferApplyRequest(planned, authority, createdAt);
assert.equal(applying.status, 'APPLYING');
assert.equal(applying.applyRequest.schema, 'RevisionCompareTransferApplyRequest.v1');
assert(applying.applyGeneration > planned.applyGeneration);
const applyingWorkspace = withTransfer(plannedWorkspace, applying);

await assert.rejects(() => createRevisionCompareTransferApplication(applyingWorkspace, {
  createdAt: '2026-07-24T13:45:01.000Z',
}), /createdAt must match/);

const application = await createRevisionCompareTransferApplication(applyingWorkspace, { createdAt });

const incompleteApplication = deepFreeze({ ...application, artifacts: Object.freeze([]) });
const incomplete = completeRevisionCompareTransferApplyRequest(applying, applying.applyGeneration, incompleteApplication);
assert.equal(incomplete.status, 'FAILED');
assert.equal(incomplete.result, null);
assert.match(incomplete.error, /artifact descriptors/);

const wrongAudit = deepFreeze({ ...application,
  audit: deepFreeze({ ...application.audit, planId: 'revision-transfer-plan:other' }) });
const auditRejected = completeRevisionCompareTransferApplyRequest(applying, applying.applyGeneration, wrongAudit);
assert.equal(auditRejected.status, 'FAILED');
assert.match(auditRejected.error, /audit does not match/);

const wrongArtifact = deepFreeze({ ...application,
  artifacts: Object.freeze(application.artifacts.map((artifact, index) => index === 1
    ? deepFreeze({ ...artifact, text: '{}\n' }) : artifact)) });
const artifactRejected = completeRevisionCompareTransferApplyRequest(
  applying, applying.applyGeneration, wrongArtifact,
);
assert.equal(artifactRejected.status, 'FAILED');
assert.match(artifactRejected.error, /audit artifact text/);

const wrongManifestReference = deepFreeze({ ...application,
  manifest: deepFreeze({ ...application.manifest,
    artifacts: Object.freeze(application.manifest.artifacts.map((reference, index) => index === 0
      ? deepFreeze({ ...reference, filename: 'wrong.json' }) : reference)) }) });
const manifestRejected = completeRevisionCompareTransferApplyRequest(
  applying, applying.applyGeneration, wrongManifestReference,
);
assert.equal(manifestRejected.status, 'FAILED');
assert.match(manifestRejected.error, /artifact references/);

const applied = completeRevisionCompareTransferApplyRequest(applying, applying.applyGeneration, application);
assert.equal(applied.status, 'APPLIED');
assert.equal(applied.result, application.result);
assert.equal(applied.audit, application.audit);
assert.equal(applied.proof, application.proof);
assert.equal(applied.manifest, application.manifest);
assert.equal(applied.applyRequest, null);
assert.equal(startRevisionCompareTransferApplyRequest(applied,
  captureRevisionCompareTransferApplyAuthority(withTransfer(base, applied)), createdAt), applied,
'accepted current plan must not silently reapply');

const executed = await executeRevisionCompareTransferApply(plannedWorkspace, createdAt);
assert.equal(executed.transfer.status, 'APPLIED');
assert.equal(executed.transfer.result.status, 'READY');
const executionAgain = await executeRevisionCompareTransferApply(executed, createdAt);
assert.equal(executionAgain, executed);

const conflictBase = await workspaceFixture({ specs: [{
  propertyKey: 'description', fieldPath: '/description', operationType: 'REPLACE_EXISTING_PROPERTY',
  expectedTargetState: 'PRESENT', beforeValue: 'Wrong', afterValue: 'New',
}] });
const conflictWorkspace = withTransfer(conflictBase, currentTransfer(conflictBase));
const failedExecution = await executeRevisionCompareTransferApply(conflictWorkspace, createdAt);
assert.equal(failedExecution.transfer.status, 'FAILED');
assert.equal(failedExecution.transfer.result, null);
assert.equal(failedExecution.transfer.audit, null);
assert.equal(failedExecution.transfer.proof, null);
assert.equal(failedExecution.transfer.manifest, null);
assert.deepEqual(failedExecution.transfer.artifacts, []);
assert.equal(failedExecution.transfer.patchedSnapshot, null);
assert.deepEqual(failedExecution.slots.candidate.jsonSnapshot.parsedValue,
  conflictWorkspace.slots.candidate.jsonSnapshot.parsedValue);

const appliedWorkspace = withTransfer(base, applied);
const changedReview = deepFreeze({ ...appliedWorkspace,
  review: deepFreeze({ ...appliedWorkspace.review,
    session: deepFreeze({ ...appliedWorkspace.review.session, revision: 2 }) }) });
const staleHistorical = reconcileRevisionCompareTransferApplyAuthority(applied, changedReview);
assert.equal(staleHistorical.status, 'STALE');
assert.equal(staleHistorical.result, applied.result);
assert.equal(staleHistorical.audit, applied.audit);
assert.equal(staleHistorical.proof, applied.proof);
assert.equal(staleHistorical.manifest, applied.manifest);

const race = startRevisionCompareTransferApplyRequest(planned, authority, createdAt);
const sourceChanged = deepFreeze({ ...withTransfer(base, race),
  slots: deepFreeze({ ...base.slots, candidate: deepFreeze({ ...base.slots.candidate, jsonSnapshot: null }) }) });
const invalidated = reconcileRevisionCompareTransferApplyAuthority(race, sourceChanged);
assert.equal(invalidated.status, 'STALE');
assert.equal(invalidated.applyRequest, null);
assert(invalidated.applyGeneration > race.applyGeneration);
assert.equal(completeRevisionCompareTransferApplyRequest(race, race.applyGeneration + 1, application), race);
assert.equal(completeRevisionCompareTransferApplyRequest(invalidated, race.applyGeneration, application), invalidated);

const packageChanged = deepFreeze({ ...withTransfer(base, race),
  evidencePackageImport: deepFreeze({ status: 'FAILED', packageId: 'package:other', contentSha256: 'f'.repeat(64) }) });
assert.equal(reconcileRevisionCompareTransferApplyAuthority(race, packageChanged), race,
  'package-import-only state must not affect apply authority');
const presentationChanged = deepFreeze({ ...withTransfer(base, race),
  compare: deepFreeze({ ...base.compare, presentationMode: 'side-by-side' }) });
assert.equal(reconcileRevisionCompareTransferApplyAuthority(race, presentationChanged), race);

const policyInvalidated = setRevisionCompareTransferPolicyVersion(race, 'revision-transfer-field-policy.v2');
assert.equal(policyInvalidated.status, 'STALE');
assert.equal(policyInvalidated.applyRequest, null);
const selectionInvalidated = setRevisionCompareTransferSelection(race,
  deepFreeze({ ...race.selection, selectionRevision: race.selection.selectionRevision + 1 }));
assert.equal(selectionInvalidated.status, 'STALE');
assert.equal(selectionInvalidated.applyRequest, null);
const directInvalidation = invalidateRevisionCompareTransferRequest(race);
assert.equal(directInvalidation.status, 'STALE');
assert.equal(directInvalidation.applyRequest, null);

const failed = failRevisionCompareTransferApplyRequest(race, race.applyGeneration, new Error('deterministic failure'));
assert.equal(failed.status, 'FAILED');
assert.equal(failed.result, null);
assert.equal(failed.audit, null);
assert.equal(failed.proof, null);
assert.equal(failed.manifest, null);
assert.deepEqual(failed.artifacts, []);
assert.equal(failed.patchedSnapshot, null);
assert.equal(failed.error, 'deterministic failure');

const workspaceSource = await readFile('tabs/revision-compare/revision-workspace-state.js', 'utf8');
assert.match(workspaceSource, /RevisionCompareWorkspaceState\.v12/);
assert.match(workspaceSource, /startWorkspaceTransferApply/);
assert.match(workspaceSource, /completeWorkspaceTransferApply/);
assert.match(workspaceSource, /failWorkspaceTransferApply/);

console.log('revision-compare-transfer-apply-lifecycle.test.mjs passed');
