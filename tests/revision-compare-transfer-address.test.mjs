import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionCompareJsonDocumentSnapshot } from '../tabs/revision-compare/revision-json-document.js';
import {
  createRevisionCompareTransferAddress,
  findRevisionCompareEntityForEvidencePath,
  resolveRevisionCompareTransferAddress,
  REVISION_COMPARE_TARGET_STATE,
  revisionCompareDollarPathToPointer,
  revisionCompareRelativeFieldPath,
} from '../tabs/revision-compare/revision-transfer-address.js';

const hash = (value) => value.repeat(64);
const snapshot = await createRevisionCompareJsonDocumentSnapshot({
  side: 'REV_B',
  sourceDocumentId: 'candidate:bbbb',
  sourceContentSha256: hash('b'),
  fileName: 'rev-b.json',
  profile: 'inputxml-managed-stage/v1',
  parsedValue: {
    schema: 'stage/v1',
    branches: [{
      name: 'B-1',
      children: [{
        id: 'T-1',
        description: null,
        attributes: { DESCRIPTION: 'Old' },
        tags: ['A'],
      }],
    }],
  },
}, webcrypto);
const entity = snapshot.entityIndex.find((entry) => entry.entityKind === 'COMPONENT');
const base = {
  targetDocumentId: snapshot.sourceDocumentId,
  targetDocumentSha256: snapshot.sourceContentSha256,
  targetEntityId: entity.entityId,
  entityCanonicalPath: entity.canonicalPath,
  expectedEntitySha256: entity.entitySha256,
};

assert.equal(
  revisionCompareDollarPathToPointer('$.branches[0].children[0].attributes.DESCRIPTION'),
  '/branches/0/children/0/attributes/DESCRIPTION',
);
assert.equal(
  findRevisionCompareEntityForEvidencePath(
    snapshot, entity.entityId, '$.branches[0].children[0].attributes.DESCRIPTION',
  ),
  entity,
);
assert.equal(
  revisionCompareRelativeFieldPath(
    entity.canonicalPath, '$.branches[0].children[0].attributes.DESCRIPTION',
  ),
  '/attributes/DESCRIPTION',
);

const present = createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/attributes/DESCRIPTION',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.PRESENT,
  expectedCurrentValue: 'Old',
});
const presentResolution = resolveRevisionCompareTransferAddress(snapshot, present);
assert.equal(presentResolution.status, 'READY');
assert.equal(presentResolution.resolvedTargetState, 'PRESENT');
assert.equal(presentResolution.value, 'Old');

const presentNull = createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/description',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.PRESENT,
  expectedCurrentValue: null,
});
const nullResolution = resolveRevisionCompareTransferAddress(snapshot, presentNull);
assert.equal(nullResolution.status, 'READY');
assert.equal(nullResolution.resolvedTargetState, 'PRESENT');
assert.equal(Object.hasOwn(nullResolution, 'value'), true);
assert.equal(nullResolution.value, null);

const absent = createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/weight',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.ABSENT,
});
const absentResolution = resolveRevisionCompareTransferAddress(snapshot, absent);
assert.equal(absentResolution.status, 'READY');
assert.equal(absentResolution.resolvedTargetState, 'ABSENT');
assert.equal(Object.hasOwn(absentResolution, 'value'), false);
assert.equal(Object.hasOwn(absent, 'expectedCurrentValue'), false);
assert.notDeepEqual(absent, presentNull);

const missingParent = resolveRevisionCompareTransferAddress(snapshot, createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/missing/weight',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.ABSENT,
}));
assert.equal(missingParent.status, 'BLOCKED');
assert(missingParent.blockers.some((item) => /parent path resolves to zero/.test(item)));

const arrayInsertion = resolveRevisionCompareTransferAddress(snapshot, createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/tags/1',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.ABSENT,
}));
assert.equal(arrayInsertion.status, 'BLOCKED');
assert(arrayInsertion.blockers.some((item) => /array insertion/.test(item)));

assert.throws(() => createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/weight',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.ABSENT,
  expectedCurrentValue: null,
}), /must not encode absence as expectedCurrentValue/);
assert.throws(() => createRevisionCompareTransferAddress({
  ...base,
  fieldPath: '/description',
  expectedTargetState: REVISION_COMPARE_TARGET_STATE.PRESENT,
}), /require expectedCurrentValue/);

const zero = resolveRevisionCompareTransferAddress(snapshot, { ...present, targetEntityId: 'record:B:missing' });
assert.equal(zero.status, 'BLOCKED');
assert(zero.blockers.some((item) => /zero entities/.test(item)));
const multipleSnapshot = Object.freeze({
  ...snapshot,
  entityIndex: Object.freeze([...snapshot.entityIndex, entity]),
});
const multiple = resolveRevisionCompareTransferAddress(multipleSnapshot, present);
assert.equal(multiple.status, 'BLOCKED');
assert(multiple.blockers.some((item) => /multiple entities/.test(item)));
assert.throws(() => revisionCompareDollarPathToPointer('$.branches[first]'), /numeric staged array indexes/);

console.log('revision-compare-transfer-address.test.mjs passed');
