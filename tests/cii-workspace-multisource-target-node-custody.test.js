import assert from 'node:assert/strict';
import { _test } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';

const node = (sourceNodeId, targetNodeId, correspondenceId, evidence = true, status = 'REVIEW') => ({
  kind: 'NODE', sourceNodeId, targetNodeId, correspondenceId, status,
  evidence: { identitySupported: evidence, identityConfidence: evidence ? 'MEDIUM' : 'REVIEW' },
});
const member = (sourceId, nodeRows, elementRows = []) => ({
  sourceId, memberStatus: 'READY', memberCorrespondenceIdentity: sourceId + '-identity',
  memberBlockers: [], nodeRows, elementRows, componentRows: [],
});
const qualifiedS1 = member('S1', [node('3830', '860', 's1-3830')]);
const qualifiedS2 = member('S2', [node('80', '860', 's2-80')]);
const qualifiedS3 = member('S3', [node('1920', '21920', 's3-1920')]);

const disputed = _test.crossSourceCorrespondenceConflicts([qualifiedS1, qualifiedS2, qualifiedS3]);
assert.equal(disputed.length, 1, 'two SOURCE members claiming one TARGET NODE must conflict');
assert.equal(disputed[0].class, 'TARGET_NODE_CROSS_MEMBER_IDENTITY_CONFLICT');
assert.equal(disputed[0].targetNodeId, '860');
assert.deepEqual(disputed[0].sourceMemberIds, ['S1', 'S2']);
assert.deepEqual(disputed[0].sourceClaims.map(({ sourceId, sourceNodeId }) => [sourceId, sourceNodeId]),
  [['S1', '3830'], ['S2', '80']]);
const blocked = _test.combinedCorrespondence('retained-source-set-sha', [qualifiedS1, qualifiedS2, qualifiedS3]);
assert.equal(blocked.status, 'CONFLICT', 'cross-member TARGET collision must veto entire source-set correspondence');
assert(blocked.blockers.includes('MULTISOURCE_TARGET_CUSTODY_CONFLICT'));
assert.equal(blocked.targetCustodyConflicts[0].targetNodeId, '860');
assert.equal(blocked.conflicts[0].class, 'TARGET_NODE_CROSS_MEMBER_IDENTITY_CONFLICT');
assert.deepEqual(
  _test.crossSourceCorrespondenceConflicts([qualifiedS3, qualifiedS2, qualifiedS1])
    .map(({ targetNodeId, sourceMemberIds }) => [targetNodeId, sourceMemberIds]),
  [['860', ['S1', 'S2']]],
  'target ownership conflict classification cannot depend on SOURCE member ingestion order',
);

// Repeated identical evidence within one member is not a cross-member collision.
assert.deepEqual(_test.crossMemberTargetNodeConflicts([member('S1', [
  node('3830', '860', 'same-1'), node('3830', '860', 'same-2'),
])]), []);
// A REVIEW row without physical identity support is not a target ownership claim.
assert.deepEqual(_test.crossMemberTargetNodeConflicts([
  qualifiedS1, member('S2', [node('80', '860', 'unsupported', false)]),
]), []);
assert.equal(_test.combinedCorrespondence('retained-source-set-sha', [
  qualifiedS1, member('S2', [node('80', '860', 'unsupported', false)]),
]).status, 'READY');
// An explicit, actually locked NODE claim must also be checked even without an evidence object.
assert.equal(_test.crossMemberTargetNodeConflicts([
  qualifiedS1, member('S2', [{ kind: 'NODE', status: 'LOCKED', sourceNodeId: '80',
    targetNodeId: '860', correspondenceId: 'locked' }]),
]).length, 1);
// Distinct TARGET IDs are compatible, whether the SOURCE NODE numeric IDs are equal or not.
assert.deepEqual(_test.crossMemberTargetNodeConflicts([
  member('S1', [node('80', '860', 's1')]),
  member('S2', [node('80', '40050', 's2')]),
]), []);
// Existing SOURCE→two TARGET conflict detection must continue working.
const sourceSplit = _test.crossSourceCorrespondenceConflicts([
  member('S1', [node('3830', '860', 's1'), node('3830', '861', 's1-extra')]),
]);
assert(sourceSplit.some((item) => item.class === 'SOURCE_IDENTITY_TARGET_CONFLICT'));
console.log('CII cross-member target NODE custody, source veto, and negative controls: PASS');
