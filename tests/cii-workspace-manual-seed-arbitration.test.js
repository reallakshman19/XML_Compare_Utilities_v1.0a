import assert from 'node:assert/strict';
import { arbitrateCiiSeedCorrespondences } from '../tabs/cii-workspace/cii-workspace-correspondence-arbitration.js';
import { _test as multisourcePreviewTest } from '../tabs/cii-workspace/cii-workspace-multisource-preview.js';

function seed(loopId, anchorSource, anchorTarget, elementRows, nodeRows = []) {
  return {
    loop: {
      loopId,
      method: 'USER_LOCKED_SEED',
      status: 'READY',
      confidence: 'USER_LOCKED',
      anchorPairs: [{ sourceNodeId: anchorSource, targetNodeId: anchorTarget }],
    },
    correspondence: {
      status: 'UNRESOLVED',
      blockers: ['SOURCE_COMPONENT_NOT_FULLY_PROPAGATED', 'PROPAGATION_AMBIGUITY_RETAINED'],
      propagation: { sourceComponentEdgeCount: 2 },
      targetCustodyConflicts: [],
      nodeRows: [
        { correspondenceId: `n-${loopId}`, kind: 'NODE', sourceNodeId: anchorSource, targetNodeId: anchorTarget, status: 'LOCKED' },
        ...nodeRows,
      ],
      elementRows,
    },
  };
}

const first = seed('SEED_1', '1', '101', [
  { correspondenceId: 'e1-a', kind: 'ELEMENT', sourceElementId: 'E1', targetElementIds: ['T1'], status: 'HIGH' },
  { correspondenceId: 'e2-u', kind: 'ELEMENT', sourceElementId: 'E2', targetElementIds: [], status: 'UNRESOLVED' },
]);
const second = seed('SEED_2', '2', '102', [
  { correspondenceId: 'e1-u', kind: 'ELEMENT', sourceElementId: 'E1', targetElementIds: [], status: 'UNRESOLVED' },
  { correspondenceId: 'e2-a', kind: 'ELEMENT', sourceElementId: 'E2', targetElementIds: ['T2'], status: 'HIGH' },
]);

const combined = arbitrateCiiSeedCorrespondences([first, second]);
assert.equal(combined.status, 'READY', 'complementary resolved seed claims should satisfy aggregate source coverage');
assert.equal(combined.combination, 'INDEPENDENT_MANUAL_SEEDS_WITH_CONFLICT_VETO');
assert.equal(combined.seedCoverage.expectedSourceElementCount, 2);
assert.equal(combined.seedCoverage.resolvedSourceElementCount, 2);
assert.equal(combined.seedCoverage.complete, true);
assert.equal(combined.elementRows.filter((row) => row.status === 'UNRESOLVED').length, 0, 'an unresolved row superseded by another seed must not remain an aggregate blocker');
assert.deepEqual(new Set(combined.elementRows.map((row) => row.sourceElementId)), new Set(['E1', 'E2']));
assert.equal(combined.conflicts.length, 0);
assert(combined.seedDiagnostics.some((row) => row.includes('SOURCE_COMPONENT_NOT_FULLY_PROPAGATED')), 'per-seed diagnostics remain auditable even when aggregate coverage resolves them');

const conflictSecond = seed('SEED_2_BAD', '2', '102', [
  { correspondenceId: 'e1-bad', kind: 'ELEMENT', sourceElementId: 'E1', targetElementIds: ['T9'], status: 'HIGH' },
  { correspondenceId: 'e2-a', kind: 'ELEMENT', sourceElementId: 'E2', targetElementIds: ['T2'], status: 'HIGH' },
]);
const conflicted = arbitrateCiiSeedCorrespondences([first, conflictSecond]);
assert.equal(conflicted.status, 'AMBIGUOUS');
assert(conflicted.blockers.includes('CROSS_SEED_CORRESPONDENCE_CONFLICT'));
assert(conflicted.conflicts.some((row) => row.kind === 'SOURCE_ELEMENT_TO_MULTIPLE_TARGETS'));

const manualPayload = multisourcePreviewTest.memberInput({
  targetText: 'target',
  anchorPairsBySource: { S1: [{ sourceNodeId: '3910', targetNodeId: '875' }, { sourceNodeId: '3940', targetNodeId: '880' }] },
}, { sourceId: 'S1', fileName: 'S1.CII', text: 'source' }, 'S1', 0);
assert.equal(manualPayload.anchorPairMode, 'INDEPENDENT_SEEDS');
assert.equal(manualPayload.anchorPairs.length, 2);
assert.equal(manualPayload.baseLoops, undefined);

const automaticPayload = multisourcePreviewTest.memberInput({
  targetText: 'target',
  baseLoopsBySource: { S1: [{ method: 'METHOD_A_SPATIAL', baseId: 'A1', anchorPairs: [{ sourceNodeId: '1', targetNodeId: '2' }] }] },
}, { sourceId: 'S1', fileName: 'S1.CII', text: 'source' }, 'S1', 0);
assert.equal(automaticPayload.anchorPairMode, undefined);
assert.equal(automaticPayload.anchorPairs, undefined);
assert.equal(automaticPayload.baseLoops.length, 1);

console.log('CII independent manual seed arbitration checks: PASS');
