import assert from 'node:assert/strict';
import { _test as writerTest } from '../tabs/cii-workspace/cii-workspace-writer2-composite.js';
import { _test as validatorTest } from '../tabs/cii-workspace/cii-workspace-writer2-composite-validation.js';

const SOURCE_SHA = 'SRC';
const TARGET_SHA = 'TGT';
function op(id, decision = 'APPLY', action = 'CREATE') {
  return Object.freeze({ operationId: id, action, scopeDecision: decision });
}
function plan({ operations = [op('A'), op('B')], excluded = [], scope = {} } = {}) {
  const appliedIds = operations.filter((item) => item.scopeDecision === 'APPLY' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const excludedIds = excluded.filter((item) => item.scopeDecision === 'EXCLUDE' && item.action !== 'KEEP').map((item) => item.operationId).sort();
  const candidateIds = [...appliedIds, ...excludedIds].sort();
  return Object.freeze({
    sourceDocument: Object.freeze({ contentSha256: SOURCE_SHA }), targetDocument: Object.freeze({ contentSha256: TARGET_SHA }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze(excluded),
    transferScope: Object.freeze({ mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'SCOPE-1',
      sourceSha256: SOURCE_SHA, targetSha256: TARGET_SHA, candidateOperationIds: Object.freeze(candidateIds),
      appliedOperationIds: Object.freeze(appliedIds), excludedOperationIds: Object.freeze(excludedIds), ...scope }),
  });
}
const target = Object.freeze({ contentSha256: TARGET_SHA });

{
  const valid = plan();
  assert.deepEqual(writerTest.assertBoundScopeCustody(valid, target).appliedOperationIds, ['A', 'B']);
  assert.deepEqual(validatorTest.independentBoundScopeCustody(valid, target).errors, []);
}

{
  const duplicatePlan = plan({ operations: [op('A'), op('A')] });
  assert.throws(() => writerTest.assertBoundScopeCustody(duplicatePlan, target), /PLAN_OPERATION_DUPLICATE_ID/);
  assert(validatorTest.independentBoundScopeCustody(duplicatePlan, target).errors.includes('PLAN_OPERATION_DUPLICATE_ID'));
}

{
  const base = plan();
  const duplicateScope = Object.freeze({ ...base, transferScope: Object.freeze({ ...base.transferScope,
    appliedOperationIds: Object.freeze(['A', 'A', 'B']) }) });
  assert.throws(() => writerTest.assertBoundScopeCustody(duplicateScope, target), /SCOPE_APPLY_DUPLICATE_ID/);
  assert(validatorTest.independentBoundScopeCustody(duplicateScope, target).errors.includes('SCOPE_APPLY_DUPLICATE_ID'));
}

{
  const applied = op('A'); const excluded = op('A', 'EXCLUDE');
  const overlap = plan({ operations: [applied], excluded: [excluded], scope: {
    candidateOperationIds: Object.freeze(['A']), appliedOperationIds: Object.freeze(['A']), excludedOperationIds: Object.freeze(['A']),
  } });
  assert.throws(() => writerTest.assertBoundScopeCustody(overlap, target), /PLAN_OPERATION_DUPLICATE_ID|PLAN_APPLY_EXCLUDE_OVERLAP/);
  const errors = validatorTest.independentBoundScopeCustody(overlap, target).errors;
  assert(errors.includes('PLAN_OPERATION_DUPLICATE_ID') || errors.includes('PLAN_APPLY_EXCLUDE_OVERLAP'));
}

{
  const base = plan(); const badTarget = Object.freeze({ contentSha256: 'OTHER' });
  assert.throws(() => writerTest.assertBoundScopeCustody(base, badTarget), /SCOPE_TARGET_HASH_MISMATCH/);
  assert(validatorTest.independentBoundScopeCustody(base, badTarget).errors.includes('SCOPE_TARGET_HASH_MISMATCH'));
}

console.log('Writer 2 composite scope custody rejects duplicate ids, APPLY/EXCLUDE overlap and hash drift independently.');
