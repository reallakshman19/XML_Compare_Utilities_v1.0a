import assert from 'node:assert/strict';
import {
  applyCiiWriter2HangerPartialDelete,
  _test as writerTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';
import {
  validateCiiWriter2HangerPartialRoundTrip,
  _test as validatorTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-validation.js';

const SOURCE_SHA = 'source-sha';
const TARGET_SHA = 'target-sha';
const OPERATION_ID = 'HANGER-210';
const SECOND_OPERATION_ID = 'HANGER-220';

function mutable(operationId = OPERATION_ID, scopeDecision = 'APPLY') {
  return Object.freeze({
    operationId,
    family: 'HANGER',
    property: 'Hanger presence',
    action: 'DELETE',
    status: 'PREVIEW_READY',
    scopeDecision,
  });
}
function keep(operationId = 'KEEP-1', scopeDecision = 'KEEP') {
  return Object.freeze({ operationId, family: 'ELEMENT', property: 'No change', action: 'KEEP', status: 'PREVIEW_READY', scopeDecision });
}
function boundPlan({
  operations = [mutable()],
  excludedOperations = [],
  scopeApplied = [OPERATION_ID],
  scopeExcluded = [],
  includeOperations = true,
  includeExcludedOperations = true,
} = {}) {
  const sourceDocument = Object.freeze({ contentSha256: SOURCE_SHA });
  const targetDocument = Object.freeze({ contentSha256: TARGET_SHA });
  const candidateOperationIds = [...scopeApplied, ...scopeExcluded]
    .filter((id, index, values) => values.indexOf(id) === index)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const plan = {
    sourceDocument,
    targetDocument,
    transferScope: Object.freeze({
      status: 'BOUND',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: 'partial-hanger-scope-container-custody',
      sourceSha256: SOURCE_SHA,
      targetSha256: TARGET_SHA,
      candidateOperationIds: Object.freeze(candidateOperationIds),
      appliedOperationIds: Object.freeze([...scopeApplied]),
      excludedOperationIds: Object.freeze([...scopeExcluded]),
    }),
  };
  if (includeOperations) plan.operations = Object.freeze([...operations]);
  if (includeExcludedOperations) plan.excludedOperations = Object.freeze([...excludedOperations]);
  return Object.freeze(plan);
}
function assertRejects(plan, writerPattern, validatorPattern = writerPattern) {
  const targetDocument = Object.freeze({ contentSha256: TARGET_SHA });
  assert.throws(
    () => applyCiiWriter2HangerPartialDelete({ targetDocument, transferPlan: plan }),
    writerPattern,
  );
  assert.throws(
    () => validateCiiWriter2HangerPartialRoundTrip(targetDocument, Object.freeze({}), plan, Object.freeze({})),
    validatorPattern,
  );
}

const targetDocument = Object.freeze({ contentSha256: TARGET_SHA });
const canonical = boundPlan({ operations: [mutable(), keep()] });
assert.deepEqual(writerTest.assertCanonicalOperationContainers(canonical), {
  appliedIds: [OPERATION_ID],
  excludedIds: [],
});
assert.deepEqual(writerTest.assertBoundScopeCustody(canonical, targetDocument), {
  scopeId: 'partial-hanger-scope-container-custody',
  sourceSha256: SOURCE_SHA,
  targetSha256: TARGET_SHA,
  appliedOperationIds: [OPERATION_ID],
  excludedOperationIds: [],
  candidateOperationIds: [OPERATION_ID],
});
assert.deepEqual(validatorTest.independentlyValidateOperationContainers(canonical), {
  appliedIds: [OPERATION_ID],
  excludedIds: [],
});
assert.deepEqual(validatorTest.independentlyValidateScope(canonical, targetDocument), {
  scopeId: 'partial-hanger-scope-container-custody',
  appliedIds: [OPERATION_ID],
  excludedIds: [],
  candidates: [OPERATION_ID],
  sourceSha: SOURCE_SHA,
  targetSha: TARGET_SHA,
});

// F31: same mutable operation is physically present in APPLY and EXCLUDE plan containers.
assertRejects(
  boundPlan({ operations: [mutable()], excludedOperations: [mutable(OPERATION_ID, 'EXCLUDE')], scopeExcluded: [OPERATION_ID] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_APPLY_EXCLUDE_OVERLAP:HANGER-210/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_APPLY_EXCLUDE_OVERLAP:HANGER-210/,
);

// F32: plan containers are canonical but bound-scope testimony places one ID in both sets.
assertRejects(
  boundPlan({ scopeExcluded: [OPERATION_ID] }),
  /CII_WRITER_2_HANGER_PARTIAL_SCOPE_APPLY_EXCLUDE_OVERLAP:HANGER-210/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_SCOPE_APPLY_EXCLUDE_OVERLAP:HANGER-210/,
);

// F33: mutable operation is hidden in the operations container with EXCLUDE decision.
assertRejects(
  boundPlan({ operations: [mutable(OPERATION_ID, 'EXCLUDE')] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATION_DECISION_MISMATCH:HANGER-210:EXCLUDE:APPLY/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATION_DECISION_MISMATCH:HANGER-210:EXCLUDE:APPLY/,
);

// F34: mutable operation is placed in excludedOperations but falsely marked APPLY.
assertRejects(
  boundPlan({
    operations: [mutable()],
    excludedOperations: [mutable(SECOND_OPERATION_ID, 'APPLY')],
    scopeExcluded: [SECOND_OPERATION_ID],
  }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_DECISION_MISMATCH:HANGER-220:APPLY:EXCLUDE/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_DECISION_MISMATCH:HANGER-220:APPLY:EXCLUDE/,
);

// F35: KEEP is never a valid excludedOperations row.
assertRejects(
  boundPlan({ operations: [mutable()], excludedOperations: [keep('KEEP-X', 'EXCLUDE')] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_KEEP_FORBIDDEN:KEEP-X/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_KEEP_FORBIDDEN:KEEP-X/,
);

// F36: a KEEP row aliases the same operation ID as a mutable APPLY row.
assertRejects(
  boundPlan({ operations: [mutable(), keep(OPERATION_ID, 'KEEP')] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_ALL_DUPLICATE_ID/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_ALL_INVALID/,
);

// F37: canonical BOUND custody requires an explicit excludedOperations array, even when empty.
assertRejects(
  boundPlan({ includeExcludedOperations: false }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_EXCLUDED_OPERATIONS_ARRAY_REQUIRED/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_EXCLUDED_OPERATIONS_ARRAY_REQUIRED/,
);

// F38: every physical operation row requires a stable nonblank operation ID.
assertRejects(
  boundPlan({ operations: [mutable('   ', 'APPLY')], scopeApplied: [] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_OPERATION_ID_REQUIRED/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_OPERATION_ID_REQUIRED/,
);

// F39: KEEP in operations is canonical only with scopeDecision=KEEP.
assertRejects(
  boundPlan({ operations: [mutable(), keep('KEEP-X', 'APPLY')] }),
  /CII_WRITER_2_HANGER_PARTIAL_PLAN_KEEP_DECISION_MISMATCH:KEEP-X:APPLY:KEEP/,
  /WRITER_2_HANGER_PARTIAL_VALIDATOR_PLAN_KEEP_DECISION_MISMATCH:KEEP-X:APPLY:KEEP/,
);

console.log('Writer2 partial HANGER canonical scope custody rejects F31-F39 operation-set/container contradictions.');
