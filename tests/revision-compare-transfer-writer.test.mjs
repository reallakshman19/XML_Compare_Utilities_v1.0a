import assert from 'node:assert/strict';
import { createRevisionCompareTransferApplication } from '../tabs/revision-compare/revision-transfer-result.js';
import { writeRevisionComparePatchedTarget } from '../tabs/revision-compare/revision-transfer-writer.js';
import { REVISION_COMPARE_TARGET_STATE as S } from '../tabs/revision-compare/revision-transfer-address.js';
import { REVISION_COMPARE_TRANSFER_OPERATION_TYPE as T } from '../tabs/revision-compare/revision-transfer-contracts.js';
import { createdAt, operationSpec, workspaceFixture } from './revision-compare-transfer-apply-fixtures.mjs';

const replace = await workspaceFixture();
const replaceBefore = structuredClone(replace.slots.candidate.jsonSnapshot.parsedValue);
const replaceApplication = await createRevisionCompareTransferApplication(replace, { createdAt });
const replacePatched = JSON.parse(replaceApplication.result.patchedTargetText);
assert.equal(replacePatched.branches[0].children[0].description, 'New');
assert.equal(replaceApplication.result.status, 'READY');
assert.deepEqual(replace.slots.candidate.jsonSnapshot.parsedValue, replaceBefore);
assert.equal(replaceApplication.result.patchedTargetText.endsWith('\n'), true);
assert.equal(replaceApplication.result.patchedTargetText.endsWith('\n\n'), false);
assert.equal(replaceApplication.proof.invariants.schemaAndEnvelopeUnchanged, true);
assert.deepEqual(replacePatched.metadata, replaceBefore.metadata);
assert.deepEqual(replacePatched.future, replaceBefore.future);
assert.deepEqual(replacePatched.branches[0].children[0].tags, ['A', 'B']);
assert.deepEqual(replacePatched.branches[0].children[0].unknownExtension, { flag: true, order: [2, 1] });
assert.deepEqual(Object.keys(replacePatched.branches[0].children[0]), Object.keys(replaceBefore.branches[0].children[0]));

const presentNull = await workspaceFixture({ descriptionNull: true, specs: [operationSpec({
  operationType: T.REPLACE_EXISTING_PROPERTY, expectedTargetState: S.PRESENT, beforeValue: null,
})] });
const nullApplication = await createRevisionCompareTransferApplication(presentNull, { createdAt });
assert.equal(JSON.parse(nullApplication.result.patchedTargetText).branches[0].children[0].description, 'New');
assert.equal(nullApplication.audit.rows[0].beforeValue, null);

const add = await workspaceFixture({ descriptionAbsent: true, specs: [operationSpec({
  operationType: T.ADD_MISSING_PROPERTY, expectedTargetState: S.ABSENT,
})] });
const addBeforeKeys = Object.keys(add.slots.candidate.jsonSnapshot.parsedValue.branches[0].children[0]);
const addApplication = await createRevisionCompareTransferApplication(add, { createdAt });
const addPatched = JSON.parse(addApplication.result.patchedTargetText);
assert.deepEqual(Object.keys(addPatched.branches[0].children[0]), [...addBeforeKeys, 'description']);
assert.equal(addPatched.branches[0].children[0].description, 'New');
assert.equal(Object.hasOwn(addApplication.audit.rows[0], 'beforeValue'), false);


for (const [beforeValue, afterValue] of [[false, true], [0, 1], ['', 'filled']]) {
  const exact = await workspaceFixture({ description: beforeValue, specs: [operationSpec({
    operationType: T.REPLACE_EXISTING_PROPERTY, expectedTargetState: S.PRESENT,
    beforeValue, afterValue,
  })] });
  const exactApplication = await createRevisionCompareTransferApplication(exact, { createdAt });
  assert.equal(JSON.parse(exactApplication.result.patchedTargetText).branches[0].children[0].description, afterValue);
  assert.equal(exactApplication.audit.rows[0].beforeValue, beforeValue);
}

const orderedAdds = await workspaceFixture({ descriptionAbsent: true, specs: [
  operationSpec({ propertyKey: 'weight', fieldPath: '/weight', operationType: T.ADD_MISSING_PROPERTY,
    expectedTargetState: S.ABSENT, afterValue: 12 }),
  operationSpec({ propertyKey: 'material', fieldPath: '/material', operationType: T.ADD_MISSING_PROPERTY,
    expectedTargetState: S.ABSENT, afterValue: 'CS' }),
] });
const orderedBefore = Object.keys(orderedAdds.slots.candidate.jsonSnapshot.parsedValue.branches[0].children[0]);
const orderedApplication = await createRevisionCompareTransferApplication(orderedAdds, { createdAt });
assert.deepEqual(Object.keys(JSON.parse(orderedApplication.result.patchedTargetText).branches[0].children[0]),
  [...orderedBefore, 'weight', 'material']);

const bare = await workspaceFixture({ rootKind: 'ARRAY' });
const bareApplication = await createRevisionCompareTransferApplication(bare, { createdAt });
assert.equal(Array.isArray(JSON.parse(bareApplication.result.patchedTargetText)), true);
assert.equal(bareApplication.patchedSnapshot.rootKind, 'ARRAY');

async function rejected(options, pattern) {
  const workspace = await workspaceFixture(options);
  const before = structuredClone(workspace.slots.candidate.jsonSnapshot.parsedValue);
  await assert.rejects(() => writeRevisionComparePatchedTarget(workspace), pattern);
  assert.deepEqual(workspace.slots.candidate.jsonSnapshot.parsedValue, before);
}
await rejected({ descriptionAbsent: true, specs: [operationSpec({
  fieldPath: '/attributes/DESCRIPTION', operationType: T.ADD_MISSING_PROPERTY,
  expectedTargetState: S.ABSENT,
})] }, /parent path resolves to zero/);
await rejected({ specs: [operationSpec({ fieldPath: '/tags/2', operationType: T.ADD_MISSING_PROPERTY,
  expectedTargetState: S.ABSENT })] }, /array insertion|array-member write/);
await rejected({ specs: [operationSpec({ fieldPath: '/tags/0', operationType: T.REPLACE_EXISTING_PROPERTY,
  expectedTargetState: S.PRESENT, beforeValue: 'A' })] }, /array insertion|array-member write/);
await rejected({ specs: [operationSpec({ fieldPath: '/id', operationType: T.REPLACE_EXISTING_PROPERTY,
  expectedTargetState: S.PRESENT, beforeValue: 'TARGET-1' })] }, /protected/);
await rejected({ specs: [operationSpec({ operationType: T.REPLACE_EXISTING_PROPERTY,
  expectedTargetState: S.PRESENT, beforeValue: 'Wrong' })] }, /current value|beforeValue/);
await rejected({ specs: [operationSpec({ operationType: T.ADD_MISSING_PROPERTY,
  expectedTargetState: S.ABSENT })] }, /present while ABSENT/);
await rejected({ specs: [operationSpec({ operationType: T.REPLACE_EXISTING_PROPERTY,
  expectedTargetState: S.PRESENT, beforeValue: 'Old', entitySha256: 'f'.repeat(64) })] }, /entity SHA-256/);
await rejected({ specs: [operationSpec({ operationType: T.REPLACE_EXISTING_PROPERTY,
  expectedTargetState: S.PRESENT, beforeValue: 'Old', status: 'BLOCKED', blockers: ['fixture'] })] }, /not READY/);


const tampered = await workspaceFixture();
const tamperedPlan = Object.freeze({ ...tampered.transfer.plan, contentSha256: 'f'.repeat(64) });
const tamperedWorkspace = Object.freeze({ ...tampered, transfer: Object.freeze({ ...tampered.transfer,
  plan: tamperedPlan }) });
await assert.rejects(() => writeRevisionComparePatchedTarget(tamperedWorkspace), /identity or content SHA-256/);

const atomic = await workspaceFixture({ descriptionAbsent: false, specs: [
  operationSpec({ operationType: T.REPLACE_EXISTING_PROPERTY, expectedTargetState: S.PRESENT, beforeValue: 'Old' }),
  operationSpec({ propertyKey: 'weight', fieldPath: '/attributes/WEIGHT',
    operationType: T.ADD_MISSING_PROPERTY, expectedTargetState: S.ABSENT, afterValue: 12 }),
] });
const atomicBefore = structuredClone(atomic.slots.candidate.jsonSnapshot.parsedValue);
await assert.rejects(() => createRevisionCompareTransferApplication(atomic, { createdAt }), /parent path resolves to zero/);
assert.deepEqual(atomic.slots.candidate.jsonSnapshot.parsedValue, atomicBefore);
assert.equal(atomic.transfer.result, null);

console.log('revision-compare-transfer-writer.test.mjs passed');
