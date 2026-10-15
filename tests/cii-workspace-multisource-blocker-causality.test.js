import assert from 'node:assert/strict';
import { ciiMultiSourceBlockerCausality } from '../tabs/cii-workspace/cii-workspace-multisource-blocker-causality.js';
import { _test as readinessTest } from '../tabs/cii-workspace/cii-workspace-multisource-writer2-readiness.js';
import {
  CII_MS_SOURCE_SET_SHA256,
  CII_MS_TARGET_SHA256,
} from '../tabs/cii-workspace/cii-workspace-multisource-nodename-authority.js';

const targetDocument = { contentSha256: 'normalized-target' };
const unboundPlan = {
  status: 'PREVIEW_READY',
  sourceAuthorityKind: 'SOURCE_SET',
  sourceSetSha256: CII_MS_SOURCE_SET_SHA256,
  targetAuthority: {
    originalSha256: CII_MS_TARGET_SHA256,
    normalizedSha256: targetDocument.contentSha256,
  },
  operations: [{ operationId: 'op-1', action: 'COPY' }],
  excludedOperations: [],
};

const unbound = readinessTest.custodyBlockers(unboundPlan, targetDocument);
assert.deepEqual(unbound, ['CII_MS_WRITER2_BOUND_SCOPE_REQUIRED']);
assert.equal(unbound.some((code) => code.includes('SCOPE_SOURCE_SET_HASH_MISMATCH')), false, 'no scope must not fabricate a scope source hash mismatch');
assert.equal(unbound.some((code) => code.includes('SCOPE_TARGET_HASH_MISMATCH')), false, 'no scope must not fabricate a scope target hash mismatch');
assert.equal(unbound.some((code) => code.includes('SCOPE_CANDIDATE_SET_MISMATCH')), false, 'no scope must not fabricate a scope operation-set mismatch');

const boundWrongScope = {
  ...unboundPlan,
  operations: [{ operationId: 'op-1', action: 'COPY', scopeDecision: 'APPLY' }],
  transferScope: {
    status: 'BOUND',
    mode: 'EXPLICIT_APPLY_EXCLUDE',
    authority: 'USER_EXPLICIT_OPERATION_SCOPE',
    sourceAuthorityKind: 'SOURCE_SET',
    sourceSetSha256: 'wrong-source-set',
    targetSha256: 'wrong-target',
    candidateOperationIds: ['op-1'],
    appliedOperationIds: ['op-1'],
    excludedOperationIds: [],
  },
};
const wrong = readinessTest.custodyBlockers(boundWrongScope, targetDocument);
assert.ok(wrong.includes('CII_MS_WRITER2_SCOPE_SOURCE_SET_HASH_MISMATCH'), 'a genuinely bound wrong scope must retain precise source custody failure');
assert.ok(wrong.includes('CII_MS_WRITER2_SCOPE_TARGET_HASH_MISMATCH'), 'a genuinely bound wrong scope must retain precise target custody failure');
assert.equal(wrong.includes('CII_MS_WRITER2_BOUND_SCOPE_REQUIRED'), false, 'a structurally bound scope must not be mislabeled as absent');

const cascadePlan = {
  status: 'BLOCKED',
  blockers: [
    'S1:CORRESPONDENCE_NOT_READY',
    'MULTISOURCE_CORRESPONDENCE_NOT_READY',
  ],
};
const cascade = ciiMultiSourceBlockerCausality(cascadePlan, [
  'S1:CORRESPONDENCE_NOT_READY',
  'MULTISOURCE_CORRESPONDENCE_NOT_READY',
  'CII_MS_WRITER2_BOUND_SCOPE_REQUIRED',
  'CII_MS_WRITER2_TRANSFER_PLAN_NOT_PREVIEW_READY',
]);
assert.equal(cascade.status, 'BLOCKED');
assert.deepEqual(cascade.primary.map((row) => row.code), ['S1:CORRESPONDENCE_NOT_READY']);
assert.deepEqual(cascade.derived.map((row) => row.code), [
  'MULTISOURCE_CORRESPONDENCE_NOT_READY',
  'CII_MS_CAUSAL_TRANSFER_UNAVAILABLE',
  'CII_MS_CAUSAL_SCOPE_NOT_BINDABLE',
  'CII_MS_CAUSAL_WRITER_UNAVAILABLE',
]);
assert.equal(cascade.primary.some((row) => row.code === 'CII_MS_WRITER2_BOUND_SCOPE_REQUIRED'), false, 'scope absence is downstream noise while correspondence is the root cause');

const scopeOnly = ciiMultiSourceBlockerCausality(unboundPlan, ['CII_MS_WRITER2_BOUND_SCOPE_REQUIRED']);
assert.deepEqual(scopeOnly.primary.map((row) => row.code), ['CII_MS_WRITER2_BOUND_SCOPE_REQUIRED']);
assert.deepEqual(scopeOnly.derived.map((row) => row.code), ['CII_MS_CAUSAL_WRITER_UNAVAILABLE']);

const mutationConflict = ciiMultiSourceBlockerCausality({
  status: 'BLOCKED',
  blockers: ['MULTISOURCE_TARGET_MUTATION_CONFLICT'],
}, ['MULTISOURCE_TARGET_MUTATION_CONFLICT', 'CII_MS_WRITER2_TRANSFER_PLAN_NOT_PREVIEW_READY']);
assert.deepEqual(mutationConflict.primary.map((row) => row.code), ['MULTISOURCE_TARGET_MUTATION_CONFLICT']);
assert.ok(mutationConflict.derived.some((row) => row.code === 'CII_MS_CAUSAL_WRITER_UNAVAILABLE'));

console.log('CII Writer2 multi-source blocker causality checks: PASS');
