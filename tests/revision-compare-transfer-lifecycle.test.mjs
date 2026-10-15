import assert from 'node:assert/strict';
import {
  captureRevisionCompareTransferAuthority,
  completeRevisionCompareTransferPlanRequest,
  invalidateRevisionCompareTransferRequest,
  reconcileRevisionCompareTransferAuthority,
  REVISION_COMPARE_TRANSFER_STATE_STATUS,
  setRevisionCompareTransferPolicyVersion,
  setRevisionCompareTransferSelection,
  startRevisionCompareTransferPlanRequest,
} from '../tabs/revision-compare/revision-transfer-contracts.js';
import { createRevisionCompareTransferPlan } from '../tabs/revision-compare/revision-transfer-plan.js';
import {
  cryptoRef, propertyFor, selectionFor, snapshots, stateFor,
  withDecisionRevision, withReviewRevision,
} from './revision-compare-transfer-fixtures.mjs';

const data = await snapshots('VALUE');
const property = propertyFor({ targetMode: 'VALUE' });
const state = stateFor(data.revA, data.revB, property);
const selection = selectionFor(property);
const plan = await createRevisionCompareTransferPlan(state, selection, { cryptoRef });
const authority = captureRevisionCompareTransferAuthority(state);

let request = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
const firstGeneration = request.requestGeneration;
const revisedSelection = selectionFor(property, '/description', 2);
const selectionChanged = setRevisionCompareTransferSelection(request, revisedSelection);
assert(selectionChanged.requestGeneration > firstGeneration);
assert.equal(selectionChanged.request, null);
assert.equal(
  completeRevisionCompareTransferPlanRequest(selectionChanged, firstGeneration, plan),
  selectionChanged,
);

request = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
const policyGeneration = request.requestGeneration;
const policyChanged = setRevisionCompareTransferPolicyVersion(
  request, 'revision-transfer-field-policy.v2',
);
assert(policyChanged.requestGeneration > policyGeneration);
assert.equal(completeRevisionCompareTransferPlanRequest(
  policyChanged, policyGeneration, plan,
), policyChanged);

let planned = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
planned = completeRevisionCompareTransferPlanRequest(planned, planned.requestGeneration, plan);
assert.equal(planned.status, REVISION_COMPARE_TRANSFER_STATE_STATUS.PLANNED);
const historical = planned.plan;

function assertHistoricalRace(changedWorkspace) {
  let pending = startRevisionCompareTransferPlanRequest(planned, selection, authority);
  const generation = pending.requestGeneration;
  pending = reconcileRevisionCompareTransferAuthority(pending, changedWorkspace);
  assert.equal(pending.status, 'STALE');
  assert.equal(pending.plan, historical);
  assert.equal(pending.request, null);
  assert.equal(completeRevisionCompareTransferPlanRequest(pending, generation, plan), pending);
}
assertHistoricalRace(Object.freeze({
  ...state,
  slots: Object.freeze({
    ...state.slots,
    baseline: Object.freeze({ ...state.slots.baseline, jsonSnapshot: null }),
  }),
}));
assertHistoricalRace(withReviewRevision(state, 2));
assertHistoricalRace(withDecisionRevision(state, 1));
assertHistoricalRace(Object.freeze({
  ...state,
  review: Object.freeze({ ...state.review, importError: 'review import failed' }),
}));
assertHistoricalRace(Object.freeze({
  ...state,
  decision: Object.freeze({ ...state.decision, importError: 'decision import failed' }),
}));

let packagePending = startRevisionCompareTransferPlanRequest(planned, selection, authority);
const packageGeneration = packagePending.requestGeneration;
const packageOnlyWorkspace = Object.freeze({
  ...state,
  evidencePackageImport: Object.freeze({
    status: 'VERIFIED', packageId: 'package:1', contentSha256: 'e'.repeat(64),
  }),
});
const packagePreserved = reconcileRevisionCompareTransferAuthority(
  packagePending, packageOnlyWorkspace,
);
assert.equal(packagePreserved, packagePending);
packagePending = completeRevisionCompareTransferPlanRequest(
  packagePreserved, packageGeneration, plan,
);
assert.equal(packagePending.status, 'PLANNED');

let forced = startRevisionCompareTransferPlanRequest(planned, selection, authority);
const forcedGeneration = forced.requestGeneration;
forced = invalidateRevisionCompareTransferRequest(forced);
assert.equal(forced.status, 'STALE');
assert.equal(forced.plan, historical);
assert.equal(forced.request, null);
assert(forced.requestGeneration > forcedGeneration);

const mismatchedSelectionPlan = Object.freeze({ ...plan, selection: revisedSelection });
request = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
const selectionRejected = completeRevisionCompareTransferPlanRequest(
  request, request.requestGeneration, mismatchedSelectionPlan,
);
assert.notEqual(selectionRejected.status, 'PLANNED');
assert.match(selectionRejected.error, /selection/);

for (const mismatched of [
  Object.freeze({ ...plan, sourceDocument: Object.freeze({ ...plan.sourceDocument, documentId: 'doc:other' }) }),
  Object.freeze({ ...plan, comparisonBasis: Object.freeze({ ...plan.comparisonBasis, basisId: 'basis:other' }) }),
  Object.freeze({ ...plan, audit: Object.freeze({ ...plan.audit, auditId: 'audit:other' }) }),
  Object.freeze({ ...plan, reviewSession: Object.freeze({ ...plan.reviewSession, revision: 99 }) }),
  Object.freeze({ ...plan, decisionLedger: Object.freeze({ ...plan.decisionLedger, revision: 99 }) }),
]) {
  request = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
  const rejected = completeRevisionCompareTransferPlanRequest(
    request, request.requestGeneration, mismatched,
  );
  assert.notEqual(rejected.status, 'PLANNED');
  assert.match(rejected.error, /authority/);
}

request = startRevisionCompareTransferPlanRequest(state.transfer, selection, authority);
const presentationWorkspace = Object.freeze({
  ...state,
  compare: Object.freeze({ ...state.compare, presentationMode: 'side-by-side' }),
});
const preserved = reconcileRevisionCompareTransferAuthority(request, presentationWorkspace);
assert.equal(preserved, request);
const completed = completeRevisionCompareTransferPlanRequest(
  preserved, preserved.requestGeneration, plan,
);
assert.equal(completed.status, 'PLANNED');
const nextRequest = startRevisionCompareTransferPlanRequest(completed, selection, authority);
assert(nextRequest.requestGeneration > completed.requestGeneration);
console.log('revision-compare-transfer-lifecycle.test.mjs passed');
