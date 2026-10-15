import assert from 'node:assert/strict';
import {
  REVISION_COMPARE_TRANSFER_POLICY, REVISION_COMPARE_TRANSFER_POLICY_VERSION,
  classifyRevisionCompareTransferField,
} from '../tabs/revision-compare/revision-transfer-policy.js';

assert.equal(REVISION_COMPARE_TRANSFER_POLICY.policyVersion, REVISION_COMPARE_TRANSFER_POLICY_VERSION);
assert.equal(REVISION_COMPARE_TRANSFER_POLICY.direction, 'REV_A_TO_REV_B');
for (const [propertyKey, fieldPath] of [
  ['description', '/description'], ['description', '/attributes/DESCRIPTION'],
  ['material', '/attributes/MATERIAL'], ['specification', '/spec'],
  ['nominalSize', '/attributes/OD'], ['wallThickness', '/thickness'],
  ['length', '/attributes/LENGTH'], ['weight', '/weight'],
]) {
  const result = classifyRevisionCompareTransferField({ propertyKey, fieldPath });
  assert.equal(result.classification, 'ALLOWED'); assert.equal(result.writable, true);
}
for (const [propertyKey, fieldPath] of [
  ['supportType', '/attributes/SUPPORTTYPE'], ['position', '/position'],
  ['geometry', '/start'], ['geometry', '/attributes/APOS'],
]) {
  const result = classifyRevisionCompareTransferField({ propertyKey, fieldPath });
  assert.equal(result.classification, 'CONTROLLED'); assert.equal(result.writable, false);
}
for (const [propertyKey, fieldPath] of [
  ['schema', '/schema'], ['identity', '/id'], ['identity', '/attributes/REFNO'],
  ['structure', '/children'], ['topology', '/connectivity'], ['evidence', '/audit'],
  ['unknownScalar', '/extension/arbitrary'],
]) {
  const result = classifyRevisionCompareTransferField({ propertyKey, fieldPath });
  assert.equal(result.writable, false); assert(result.blockers.length > 0);
}
const stale = classifyRevisionCompareTransferField({ propertyKey: 'description', fieldPath: '/description' }, { ...REVISION_COMPARE_TRANSFER_POLICY, policyVersion: 'v2' });
assert.equal(stale.writable, false); assert(stale.blockers.some((item) => /unsupported or stale/.test(item)));
assert.equal(Object.isFrozen(REVISION_COMPARE_TRANSFER_POLICY), true);
console.log('revision-compare-transfer-policy.test.mjs passed');
