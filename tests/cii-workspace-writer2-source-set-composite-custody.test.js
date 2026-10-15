import assert from 'node:assert/strict';
import { _test as writerTest } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { _test as validatorTest } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-validation.js';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';

const SOURCE_SET_SHA = 'SOURCE-SET';
const SOURCE_SHA = 'SOURCE-DOC';
const ORIGINAL_TARGET_SHA = 'ORIGINAL-V14';
const NORMALIZED_TARGET_SHA = 'NORMALIZED-V11';
function op(id = 'A') { return Object.freeze({ operationId: id, action: 'CREATE', scopeDecision: 'APPLY' }); }
function sourceSetPlan(scope = {}) {
  return Object.freeze({
    sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: SOURCE_SET_SHA,
    targetAuthorityKind: 'ORIGINAL_TARGET', targetAuthority: Object.freeze({ originalSha256: ORIGINAL_TARGET_SHA }),
    targetDocument: Object.freeze({ contentSha256: NORMALIZED_TARGET_SHA }),
    operations: Object.freeze([op()]), excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'SCOPE-SET',
      sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: SOURCE_SET_SHA, sourceSha256: '',
      targetAuthorityKind: 'ORIGINAL_TARGET', targetSha256: ORIGINAL_TARGET_SHA,
      candidateOperationIds: Object.freeze(['A']), appliedOperationIds: Object.freeze(['A']), excludedOperationIds: Object.freeze([]),
      ...scope,
    }),
  });
}
const normalizedTarget = Object.freeze({ contentSha256: NORMALIZED_TARGET_SHA });

{
  const plan = sourceSetPlan();
  const custody = writerTest.assertBoundScopeCustody(plan, normalizedTarget);
  assert.equal(custody.sourceAuthorityKind, 'SOURCE_SET');
  assert.equal(custody.sourceSetSha256, SOURCE_SET_SHA);
  assert.equal(custody.targetAuthorityKind, 'ORIGINAL_TARGET');
  assert.equal(custody.originalTargetSha256, ORIGINAL_TARGET_SHA);
  assert.equal(custody.parentTargetSha256, ORIGINAL_TARGET_SHA);
  assert.equal(custody.targetSha256, NORMALIZED_TARGET_SHA);
  assert.deepEqual(validatorTest.independentBoundScopeCustody(plan, normalizedTarget).errors, []);

  const child = writerTest.projectCanonicalFamilySubscope(plan, () => true, 'WRITER_2_NODENAME', custody);
  assert.equal(child.transferScope.sourceAuthorityKind, 'SOURCE_SET');
  assert.equal(child.transferScope.sourceSetSha256, SOURCE_SET_SHA);
  assert.equal(child.transferScope.targetAuthorityKind, 'DOCUMENT');
  assert.equal(child.transferScope.targetSha256, NORMALIZED_TARGET_SHA);
  assert.equal(child.transferScope.parentTargetAuthorityKind, 'ORIGINAL_TARGET');
  assert.equal(child.transferScope.parentTargetSha256, ORIGINAL_TARGET_SHA);
}

{
  const badSource = sourceSetPlan({ sourceSetSha256: 'WRONG' });
  assert.throws(() => writerTest.assertBoundScopeCustody(badSource, normalizedTarget), /SCOPE_SOURCE_SET_HASH_MISMATCH/);
  assert(validatorTest.independentBoundScopeCustody(badSource, normalizedTarget).errors.includes('SCOPE_SOURCE_SET_HASH_MISMATCH'));
}

{
  const badOriginal = sourceSetPlan({ targetSha256: 'WRONG' });
  assert.throws(() => writerTest.assertBoundScopeCustody(badOriginal, normalizedTarget), /SCOPE_ORIGINAL_TARGET_HASH_MISMATCH/);
  assert(validatorTest.independentBoundScopeCustody(badOriginal, normalizedTarget).errors.includes('SCOPE_ORIGINAL_TARGET_HASH_MISMATCH'));
}

{
  const badNormalizedTarget = Object.freeze({ contentSha256: 'WRONG-NORMALIZED' });
  assert.throws(() => writerTest.assertBoundScopeCustody(sourceSetPlan(), badNormalizedTarget), /NORMALIZED_TARGET_HASH_MISMATCH/);
  assert(validatorTest.independentBoundScopeCustody(sourceSetPlan(), badNormalizedTarget).errors.includes('NORMALIZED_TARGET_HASH_MISMATCH'));
}

// Existing single-document custody remains valid.
{
  const plan = Object.freeze({
    sourceDocument: Object.freeze({ contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ contentSha256: NORMALIZED_TARGET_SHA }),
    operations: Object.freeze([op()]), excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      mode: 'EXPLICIT_APPLY_EXCLUDE', status: 'BOUND', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'SCOPE-DOC',
      sourceAuthorityKind: 'DOCUMENT', sourceSha256: SOURCE_SHA,
      targetAuthorityKind: 'DOCUMENT', targetSha256: NORMALIZED_TARGET_SHA,
      candidateOperationIds: Object.freeze(['A']), appliedOperationIds: Object.freeze(['A']), excludedOperationIds: Object.freeze([]),
    }),
  });
  assert.equal(writerTest.assertBoundScopeCustody(plan, normalizedTarget).sourceSha256, SOURCE_SHA);
  assert.deepEqual(validatorTest.independentBoundScopeCustody(plan, normalizedTarget).errors, []);
}

// NODENAME ELEMENT pointer expectation is lexical I13, never generic G13.6.
{
  const controlRow = ['0', '0', '0', '0', '0', '0']
    .map((value, index) => String(value).padStart(index === 0 ? 15 : 13, ' ')).join('');
  const physicalFile = createCiiPhysicalFile(`#$ CONTROL\r\n${controlRow}\r\n#$ NODENAME\r\n#$ BEND\r\n`);
  const before = Object.freeze({ physicalFile });
  const claims = validatorTest.nodeExpectedClaims(before, Object.freeze({
    controlCountBefore: 0, controlCountAfter: 0, rowCountBefore: 0, finalRows: Object.freeze([]),
    pointerChanges: Object.freeze([Object.freeze({
      parsedElementIndex: 7, newPointer: 1266,
      pointerField: Object.freeze({ byteStart: 0, byteEnd: 13 }),
    })]),
  }));
  const pointer = claims.find((claim) => claim.kind === 'ELEMENT_NODENAME_POINTER');
  assert(pointer);
  assert.equal(pointer.afterField, '         1266');
  assert.equal(pointer.afterField.length, 13);
  assert.doesNotMatch(pointer.afterField, /[.E]/);
}

console.log('Writer 2 source-set composite custody and NODENAME I13 validation passed.');