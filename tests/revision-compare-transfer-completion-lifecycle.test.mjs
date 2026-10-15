import assert from 'node:assert/strict';
import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import { createRevisionCompareTransferCompletionApplication, createRevisionCompareTransferCompletionController } from '../tabs/revision-compare/revision-transfer-completion-controller.js';
import {
  completeRevisionCompareTransferCompletionState, createRevisionCompareTransferCompletionState,
  failRevisionCompareTransferCompletionState, revisionCompareTransferCompletionStateForReadiness,
  staleRevisionCompareTransferCompletionState,
} from '../tabs/revision-compare/revision-transfer-completion-state.js';
import { completeWorkspaceTransferCompletion, reconcileRevisionCompareTransferCompletionAfterAuthorityChange } from '../tabs/revision-compare/revision-transfer-completion-workspace-state.js';
import { clone, completionFixture, cryptoRef, declaredAt } from './revision-compare-transfer-completion-fixtures.mjs';

const fixture = await completionFixture();
assert.equal(createRevisionCompareTransferCompletionState().schema, 'RevisionCompareTransferCompletionState.v1');
assert.equal(revisionCompareTransferCompletionStateForReadiness(fixture.workspace).status, 'READY');
const application = await createRevisionCompareTransferCompletionApplication(fixture.workspace, fixture.input, declaredAt, { cryptoRef, createEvidencePackage: async () => fixture.evidencePackage });
const createdState = completeRevisionCompareTransferCompletionState(application, fixture.workspace);
assert.equal(createdState.status, 'CREATED'); assert.equal(createdState.report, application.report); assert.equal(createdState.bundle, application.bundle);
assert.equal(createdState.reportArtifact.text, application.reportArtifact.text); assert.equal(createdState.bundleArtifact.text, application.bundleArtifact.text);
const createdWorkspace = deepFreeze({ ...fixture.workspace, transferCompletion: createdState });
const presentation = deepFreeze({ ...createdWorkspace, compare: deepFreeze({ ...createdWorkspace.compare, presentationMode: 'side-by-side', queue: { search: 'filter' } }) });
assert.equal(presentation.transferCompletion.status, 'CREATED');
const reviewChanged = clone(createdWorkspace); reviewChanged.review.session.revision += 1;
const stale = reconcileRevisionCompareTransferCompletionAfterAuthorityChange(createdWorkspace, deepFreeze(reviewChanged));
assert.equal(stale.transferCompletion.status, 'STALE'); assert.equal(stale.transferCompletion.report, createdState.report); assert.equal(Object.isFrozen(stale.transferCompletion.bundle), true);
assert.equal(staleRevisionCompareTransferCompletionState(createdState).report, createdState.report);
const restored = deepFreeze({ ...stale, review: fixture.workspace.review, transfer: fixture.workspace.transfer });
assert.equal(reconcileRevisionCompareTransferCompletionAfterAuthorityChange(stale, restored).transferCompletion.status, 'STALE', 'replacement requires explicit action');
const failed = failRevisionCompareTransferCompletionState(new Error('deterministic failure'));
assert.equal(failed.status, 'FAILED'); assert.equal(failed.report, null); assert.equal(failed.bundle, null); assert.equal(failed.reportArtifact, null); assert.equal(failed.bundleArtifact, null);

const tamperedApplication = clone(application);
tamperedApplication.bundle.payload.transferResult.resultId = 'revision-transfer-result:wrong';
assert.throws(() => completeRevisionCompareTransferCompletionState(deepFreeze(tamperedApplication), fixture.workspace), /exact current authorities/);
const tamperedReportText = clone(application);
tamperedReportText.reportArtifact.text = '{}\n';
assert.throws(() => completeRevisionCompareTransferCompletionState(deepFreeze(tamperedReportText), fixture.workspace), /report text/);

const race = clone(fixture.workspace); race.transfer.result.resultId = 'revision-transfer-result:changed';
const raceResult = completeWorkspaceTransferCompletion(deepFreeze(race), fixture.workspace, application);
assert.equal(raceResult.transferCompletion.status, 'FAILED'); assert.equal(raceResult.transferCompletion.report, null);
const artifactRace = clone(fixture.workspace); artifactRace.transfer.artifacts[0].mimeType = 'text/plain';
assert.equal(completeWorkspaceTransferCompletion(deepFreeze(artifactRace), fixture.workspace, application).transferCompletion.status, 'FAILED', 'artifact metadata changes reject old completion');
const snapshotRace = clone(fixture.workspace); snapshotRace.transfer.patchedSnapshot.sourceDocumentId = 'revision-document:changed';
assert.equal(completeWorkspaceTransferCompletion(deepFreeze(snapshotRace), fixture.workspace, application).transferCompletion.status, 'FAILED', 'patched snapshot identity changes reject old completion');

let workspace = clone(fixture.workspace); let nowCalls = 0; let renderCalls = 0;
const fields = { '[data-revc-transfer-completion-name]': { value: 'Lakshman' }, '[data-revc-transfer-completion-role]': { value: 'Engineer' }, '[data-revc-transfer-completion-organization]': { value: 'Org' }, '[data-revc-transfer-completion-confirm]': { checked: true } };
const root = { querySelector: (selector) => fields[selector] ?? null, querySelectorAll: () => [], ownerDocument: { defaultView: { crypto: cryptoRef } } };
const controller = createRevisionCompareTransferCompletionController({ root, readState: () => workspace, writeState: (next) => { workspace = next; }, render: () => { renderCalls += 1; }, now: () => { nowCalls += 1; return declaredAt; }, cryptoRef, showToast: () => {}, reportFailure: (error) => { throw error; }, dependencies: { preflight: {}, createEvidencePackage: async () => fixture.evidencePackage, captureTransferAuthority: () => fixture.workspace.transfer.authority, planTransferAuthority: () => fixture.workspace.transfer.authority, complete: completeWorkspaceTransferCompletion, fail: (state, error) => deepFreeze({ ...state, transferCompletion: failRevisionCompareTransferCompletionState(error) }) } });
await controller.handleClick({ hasAttribute: (name) => name === 'data-revc-create-transfer-completion' });
assert.equal(nowCalls, 1); assert.equal(workspace.transferCompletion.status, 'CREATED'); assert(renderCalls >= 1); controller.destroy();
console.log('revision-compare-transfer-completion-lifecycle.test.mjs passed');
