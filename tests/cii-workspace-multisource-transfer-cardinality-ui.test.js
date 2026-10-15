import assert from 'node:assert/strict';
import { _test as uiTest } from '../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';

function createOp(id, sourceId, target, proposed) {
  return {
    operationId: id,
    sourceId,
    family: 'NODE_NAME',
    property: 'Node name / to-name',
    action: 'CREATE',
    status: 'PREVIEW_READY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    matchAuthority: { status: 'REVIEWED' },
    sourceEvidence: { value: proposed },
    targetEvidence: { identity: target, value: '' },
    before: '',
    proposed,
  };
}

const raw = {
  sourceSetSha256: 'source-set',
  targetAuthority: { originalSha256: 'target' },
  transferPlan: {
    status: 'PREVIEW_READY',
    operations: [
      createOp('S1-A', 'S1', '9040', 'SL-106.3'),
      createOp('S2-A', 'S2', '9040', 'SL-106.3'),
      createOp('S3-B', 'S3', '9050', 'SL-106.4'),
    ],
    excludedOperations: [],
  },
};
const scoped = {
  transferPlan: {
    transferScope: { status: 'BOUND', appliedOperationCount: 2, scopeId: 'scope-1' },
    excludedOperations: [createOp('S2-A', 'S2', '9040', 'SL-106.3')],
  },
  writerReadiness: {
    ready: true,
    blockers: [],
    bm001CorrespondenceCoverage: { matchedRowCount: 329, expectedRowCount: 329 },
  },
};

const summary = uiTest.transferMutationSummary(raw, scoped);
assert.equal(summary.physicalCandidateCount, 2, 'identical S1/S2 physical writes must display as one canonical mutation');
assert.equal(summary.duplicateCorroborationCount, 1);
assert.equal(summary.applyCount, 2);
assert.equal(summary.correspondence.matchedRowCount, 329);

const markup = uiTest.transferMarkup(raw, scoped, false);
assert.match(markup, /BM-001 correspondence:<\/b> 329\/329 rows/);
assert.match(markup, /physical Writer2 candidates:<\/b> 2/);
assert.match(markup, /duplicate corroborations:<\/b> 1/);
assert.match(markup, /APPLY:<\/b> 2/);
assert.match(markup, /BM-001 proves reviewed source↔target correspondence/);
assert.doesNotMatch(markup, /Only BM-001-bound NODENAME CREATE\/DELETE can become APPLY/);

console.log('CII multi-source Transfer physical cardinality UI checks passed.');
