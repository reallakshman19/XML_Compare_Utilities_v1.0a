import assert from 'node:assert/strict';
import {
  assertBoundScopeCustody,
  isRestraintDelete,
  projectCanonicalSubscope,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-support.js';
import {
  independentCanonicalSubscope,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation-support.js';

const H = (ch) => ch.repeat(64);
const SCOPE = 'USER_EXPLICIT_OPERATION_SCOPE';
const MODE = 'EXPLICIT_APPLY_EXCLUDE';
const FAMILY = 'WRITER_2_RESTRAINT_BLOCK_DELETE';

function operation(id = 'R1') {
  return Object.freeze({
    operationId: id,
    family: 'RESTRAINT',
    property: 'Qualified restraint slot mutation',
    action: 'DELETE',
    scopeDecision: 'APPLY',
  });
}

function planDocument() {
  const op = operation();
  return Object.freeze({
    sourceDocument: Object.freeze({ contentSha256: H('a') }),
    targetDocument: Object.freeze({ contentSha256: H('b') }),
    operations: Object.freeze([op]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      status: 'BOUND', mode: MODE, authority: SCOPE, scopeId: 'DOC',
      sourceSha256: H('a'), targetSha256: H('b'),
      candidateOperationIds: Object.freeze([op.operationId]),
      appliedOperationIds: Object.freeze([op.operationId]),
      excludedOperationIds: Object.freeze([]),
    }),
  });
}

function planSourceSet() {
  const op = operation();
  return Object.freeze({
    sourceAuthorityKind: 'SOURCE_SET',
    sourceSetSha256: H('c'),
    targetAuthorityKind: 'ORIGINAL_TARGET',
    targetAuthority: Object.freeze({ originalSha256: H('e') }),
    targetDocument: Object.freeze({ contentSha256: H('d') }),
    operations: Object.freeze([op]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      status: 'BOUND', mode: MODE, authority: SCOPE, scopeId: 'SET',
      sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: H('c'),
      targetAuthorityKind: 'ORIGINAL_TARGET', targetSha256: H('e'),
      candidateOperationIds: Object.freeze([op.operationId]),
      appliedOperationIds: Object.freeze([op.operationId]),
      excludedOperationIds: Object.freeze([]),
    }),
  });
}

{
  const plan = planDocument();
  const custody = assertBoundScopeCustody(plan, { contentSha256: H('b') });
  assert.deepEqual(custody, {
    parentScopeId: 'DOC',
    sourceAuthorityKind: 'DOCUMENT', sourceSha256: H('a'), sourceSetSha256: '',
    targetAuthorityKind: 'DOCUMENT', targetSha256: H('b'), originalTargetSha256: '', parentTargetSha256: H('b'),
    candidateOperationIds: ['R1'], appliedOperationIds: ['R1'], excludedOperationIds: [],
  });
}

{
  const plan = planSourceSet();
  const custody = assertBoundScopeCustody(plan, { contentSha256: H('d') });
  assert.deepEqual(custody, {
    parentScopeId: 'SET',
    sourceAuthorityKind: 'SOURCE_SET', sourceSha256: '', sourceSetSha256: H('c'),
    targetAuthorityKind: 'ORIGINAL_TARGET', targetSha256: H('d'), originalTargetSha256: H('e'), parentTargetSha256: H('e'),
    candidateOperationIds: ['R1'], appliedOperationIds: ['R1'], excludedOperationIds: [],
  });
  const child = projectCanonicalSubscope(plan, isRestraintDelete, FAMILY, custody);
  const independent = independentCanonicalSubscope(plan, isRestraintDelete, FAMILY, custody);
  assert.deepEqual(child.transferScope, independent.transferScope);
  assert.deepEqual(child.transferScope, {
    status: 'BOUND', mode: MODE, authority: SCOPE, scopeId: `SET::${FAMILY}`,
    sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: H('c'), sourceSha256: '',
    targetAuthorityKind: 'DOCUMENT', targetSha256: H('d'),
    parentTargetAuthorityKind: 'ORIGINAL_TARGET', parentTargetSha256: H('e'),
    candidateOperationIds: ['R1'], appliedOperationIds: ['R1'], excludedOperationIds: [],
  });
}

{
  const base = planSourceSet();
  const bad = { ...base, transferScope: { ...base.transferScope, sourceSetSha256: H('f') } };
  assert.throws(() => assertBoundScopeCustody(bad, { contentSha256: H('d') }), /SCOPE_SOURCE_SET_HASH_MISMATCH/);
}
{
  const base = planSourceSet();
  const bad = { ...base, targetAuthority: { originalSha256: H('f') } };
  assert.throws(() => assertBoundScopeCustody(bad, { contentSha256: H('d') }), /SCOPE_ORIGINAL_TARGET_HASH_MISMATCH/);
}
{
  const base = planSourceSet();
  const bad = { ...base, targetDocument: { contentSha256: H('f') } };
  assert.throws(() => assertBoundScopeCustody(bad, { contentSha256: H('d') }), /NORMALIZED_TARGET_HASH_MISMATCH/);
}

console.log('Writer2 restraint composite source-set/original-target custody checks passed.');
