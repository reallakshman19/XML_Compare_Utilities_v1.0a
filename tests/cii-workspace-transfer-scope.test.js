import assert from 'assert';
import { ciiWriter1BReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer-1b.js';
import { ciiDeltaTransferOutcome } from '../tabs/cii-workspace/cii-workspace-review-presentation.js';
import {
  applyCiiTransferScope, createCiiTransferScopeSelection, ciiTransferScopeCandidateOperations,
} from '../tabs/cii-workspace/cii-workspace-transfer-scope.js';

function operation(id, family, property, status = 'PREVIEW_READY', blockers = []) {
  return Object.freeze({
    operationId: id, engineeringDeltaId: `delta:${id}`, action: 'COPY', family, property, custody: 'ELEMENT',
    sourceEvidence: Object.freeze({ identity: 'S1', value: 10 }), targetEvidence: Object.freeze({ identity: 'T1', value: 20 }),
    before: 20, proposed: 10, status, blockers: Object.freeze(blockers),
    matchAuthority: Object.freeze({ correspondenceId: 'c1', status: 'REVIEWED', candidateStatus: 'HIGH' }),
  });
}
function plan(operations) {
  return Object.freeze({
    schema: 'CIIWorkspaceTransferPlan.v1', direction: 'SOURCE_TO_TARGET', inputAuthority: 'ENGINEERING_DELTA_SET',
    mutationAuthority: 'WRITER_1B_CONDITIONAL', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'SOURCE.CII', contentSha256: 'SRC_SHA' }),
    targetDocument: Object.freeze({ fileName: 'TARGET.CII', contentSha256: 'TGT_SHA' }),
    operations: Object.freeze(operations), summary: Object.freeze({ operationCount: operations.length }),
  });
}
const valid = operation('op:p1', 'PROCESS', 'P1');
const unsupported = operation('op:sif', 'SIF_TEE', 'SIF', 'BLOCKED', ['SIF_TEE_MUTATION_BLOCKED']);
const raw = plan([valid, unsupported]);

assert.deepStrictEqual(ciiTransferScopeCandidateOperations(raw).map((item) => item.operationId), ['op:p1', 'op:sif']);

const unbound = applyCiiTransferScope(raw, null);
assert.strictEqual(unbound.status, 'BLOCKED');
assert.strictEqual(unbound.transferScope.status, 'UNBOUND');
assert(unbound.blockers.includes('TRANSFER_SCOPE_EXPLICIT_SELECTION_REQUIRED'));
assert.strictEqual(ciiWriter1BReadiness(unbound).ready, false, 'product path must not be Writer-ready before explicit scope binding');

const excludeUnsupported = createCiiTransferScopeSelection(raw, { 'op:p1': 'APPLY', 'op:sif': 'EXCLUDE' });
const scoped = applyCiiTransferScope(raw, excludeUnsupported);
assert.strictEqual(scoped.transferScope.status, 'BOUND');
assert.deepStrictEqual(scoped.transferScope.appliedOperationIds, ['op:p1']);
assert.deepStrictEqual(scoped.transferScope.excludedOperationIds, ['op:sif']);
assert.deepStrictEqual(scoped.operations.filter((item) => item.action !== 'KEEP').map((item) => item.operationId), ['op:p1']);
assert.deepStrictEqual(scoped.excludedOperations.map((item) => item.operationId), ['op:sif']);
assert.strictEqual(scoped.excludedOperations[0].scopeDecision, 'EXCLUDE');
assert.strictEqual(ciiWriter1BReadiness(scoped).ready, true, 'excluded unsupported operation must not poison selected Writer mutation set');

const excludedDelta = Object.freeze({ deltaId: 'delta:op:sif', correspondenceId: 'c1', sourceValue: 10, targetValue: 20 });
const excludedOutcome = ciiDeltaTransferOutcome(Object.freeze({
  transferPlan: scoped,
  review: Object.freeze({ reviewedCorrespondenceIds: Object.freeze(['c1']), lockedCorrespondenceIds: Object.freeze([]) }),
  writerReadiness: Object.freeze({ ready: true }),
}), excludedDelta, 'APPROVED');
assert.strictEqual(excludedOutcome.state, 'EXCLUDED');
assert.strictEqual(excludedOutcome.effective, 20, 'EXCLUDE must preserve current TARGET in engineering delta presentation');
assert.strictEqual(excludedOutcome.proposed, 10, 'excluded SOURCE proposal remains visible for audit/review');

const selectUnsupported = createCiiTransferScopeSelection(raw, { 'op:p1': 'APPLY', 'op:sif': 'APPLY' });
const badSelection = applyCiiTransferScope(raw, selectUnsupported);
assert.strictEqual(badSelection.transferScope.status, 'BOUND');
assert.strictEqual(ciiWriter1BReadiness(badSelection).ready, false, 'selected unsupported operation must remain fail-closed');
assert(ciiWriter1BReadiness(badSelection).blockers.some((item) => item.includes('SIF_TEE:SIF')));

const allExcluded = applyCiiTransferScope(raw, createCiiTransferScopeSelection(raw, { 'op:p1': 'EXCLUDE', 'op:sif': 'EXCLUDE' }));
assert.strictEqual(allExcluded.status, 'BLOCKED');
assert(allExcluded.blockers.includes('TRANSFER_SCOPE_NO_APPLY_OPERATIONS'));
assert.strictEqual(allExcluded.transferScope.appliedOperationCount, 0);
assert.strictEqual(ciiWriter1BReadiness(allExcluded).ready, false);

const stale = applyCiiTransferScope(plan([valid, unsupported, operation('op:t1', 'PROCESS', 'T1')]), excludeUnsupported);
assert.strictEqual(stale.transferScope.status, 'INVALID');
assert(stale.blockers.includes('TRANSFER_SCOPE_OPERATION_SET_MISMATCH'), 'new operation after binding must invalidate stale scope');

const missing = Object.freeze({ ...excludeUnsupported, decisions: Object.freeze(excludeUnsupported.decisions.filter((row) => row.operationId !== 'op:sif')) });
const incomplete = applyCiiTransferScope(raw, missing);
assert.strictEqual(incomplete.transferScope.status, 'INVALID');
assert(incomplete.blockers.includes('TRANSFER_SCOPE_OPERATION_SET_MISMATCH'));

const hashMismatch = Object.freeze({ ...excludeUnsupported, targetSha256: 'OTHER_TARGET' });
const staleTarget = applyCiiTransferScope(raw, hashMismatch);
assert.strictEqual(staleTarget.transferScope.status, 'INVALID');
assert(staleTarget.blockers.includes('TRANSFER_SCOPE_TARGET_HASH_MISMATCH'));

const duplicate = Object.freeze({ ...excludeUnsupported, decisions: Object.freeze([...excludeUnsupported.decisions, excludeUnsupported.decisions[0]]) });
const duplicated = applyCiiTransferScope(raw, duplicate);
assert.strictEqual(duplicated.transferScope.status, 'INVALID');
assert(duplicated.blockers.some((item) => item.startsWith('TRANSFER_SCOPE_DUPLICATE_OPERATION:')));

console.log('CII explicit APPLY / EXCLUDE transfer-scope checks passed.');
