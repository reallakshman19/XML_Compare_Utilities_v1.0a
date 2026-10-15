import assert from 'node:assert/strict';
import { applyCiiNodeCustodyGates } from '../tabs/cii-workspace/cii-workspace-node-custody.js';
import { ciiIdentityBound, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function methodABoundaryNode(overrides = {}) {
  const left = { identitySupported: true, identityConfidence: 'HIGH' };
  const right = { identitySupported: true, identityConfidence: 'HIGH' };
  return {
    correspondenceId: 'node:S-N:T-N',
    kind: 'NODE',
    sourceNodeId: 'S-N',
    targetNodeId: 'T-N',
    status: 'REVIEW',
    authority: 'MULTI_BASE_LOOP',
    basisMethod: 'METHOD_A_SPATIAL',
    evidence: {
      identitySupported: true,
      identityConfidence: 'MEDIUM',
      identityEvidenceBasis: 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY',
      leftElement: left,
      rightElement: right,
      multiBaseProvenance: [{
        loopId: 'A-GENERIC',
        method: 'METHOD_A_SPATIAL',
        baseConfidence: 'MEDIUM',
        rowStatus: 'REVIEW',
        rowAuthority: 'ADJACENT_MATCH_BOUNDARY',
      }],
    },
    ...overrides,
  };
}

function winnerGapCandidate(overrides = {}) {
  return {
    status: 'AMBIGUOUS',
    winnerIdentityConfidence: 'HIGH',
    winnerTargetElementId: 'T-E1',
    methodWinners: { m1Spatial: 'T-E1', m2Network: 'T-E1', disagree: false },
    reasons: ['WINNER_GAP_NOT_SATISFIED'],
    winnerGap: 4,
    requiredWinnerGap: 8,
    ...overrides,
  };
}

function elementRow({
  id = 'E1',
  targetId = 'T-E1',
  status = 'REVIEW',
  candidates = winnerGapCandidate({ winnerTargetElementId: targetId }),
} = {}) {
  return {
    correspondenceId: `element:${id}:${targetId}`,
    kind: 'ELEMENT',
    sourceElementId: id,
    targetElementIds: [targetId],
    status,
    authority: 'MULTI_BASE_LOOP',
    evidence: candidates ? { candidates } : {},
  };
}

function sourceGraph(elementIds = ['E1']) {
  return {
    adjacency: new Map([
      ['S-N', elementIds.map((elementId) => ({ elementId }))],
    ]),
  };
}

function correspondence({
  node = methodABoundaryNode(),
  elements = [elementRow()],
  status = 'READY',
  conflicts = [],
  targetCustodyConflicts = [],
} = {}) {
  return {
    schema: 'CIIWorkspaceCorrespondence.v1',
    status,
    conflicts,
    targetCustodyConflicts,
    nodeRows: [node],
    elementRows: elements,
  };
}

function resultFor(config = {}, graph = sourceGraph(config.elements?.map((row) => row.sourceElementId) || ['E1'])) {
  const input = correspondence(config);
  const output = applyCiiNodeCustodyGates(input, graph);
  return { input, output, node: output.nodeRows[0] };
}

function expectGated(config = {}, graph) {
  const { node } = resultFor(config, graph);
  assert(node.evidence?.nodeCustodyGate, 'expected blocking nodeCustodyGate');
  assert.equal(node.evidence.nodeCustodyGate.status, 'REVIEW_REQUIRED');
  assert.equal(node.evidence.nodeCustodyGate.blocker, 'ADJACENT_ELEMENT_CANDIDATE_AMBIGUITY');
  assert.equal(ciiIdentityBound(node), false);
  return node;
}

// Positive: the local element remains REVIEW/AMBIGUOUS, but its selected target is
// the common HIGH winner and winner-gap-only ambiguity must not erase the separately
// qualified Method-A adjacent-boundary node identity.
{
  const elements = [
    elementRow({ id: 'E1', targetId: 'T-E1' }),
    elementRow({ id: 'E2', targetId: 'T-E2',
      candidates: winnerGapCandidate({
        winnerTargetElementId: 'T-E2',
        methodWinners: { m1Spatial: 'T-E2', m2Network: 'T-E2', disagree: false },
      }) }),
  ];
  const { input, output, node } = resultFor(
    { node: methodABoundaryNode({ basisMethod: 'METHOD_A_AND_B' }), elements },
    sourceGraph(['E1', 'E2']),
  );
  assert.equal(node.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(node), true);
  assert.equal(ciiIdentityConfidence(node), 'MEDIUM', 'custody reconciliation must not promote confidence');
  assert.deepEqual(output.elementRows, input.elementRows, 'element ambiguity evidence must remain unchanged');
  assert(output.elementRows.every((row) => row.status === 'REVIEW'));
  assert(output.elementRows.every((row) => row.evidence.candidates.status === 'AMBIGUOUS'));
}

// Existing manual authority remains untouched.
{
  const manual = methodABoundaryNode({
    status: 'LOCKED',
    authority: 'USER_LOCKED_ANCHOR',
    basisMethod: 'USER_LOCKED_LEGACY',
    evidence: {},
  });
  const { node } = resultFor({ node: manual });
  assert.equal(node.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(node), true);
  assert.equal(ciiIdentityConfidence(node), 'LOCKED');
}

// UNRESOLVED and CONFLICT element evidence remain blocking.
expectGated({ elements: [elementRow({ status: 'UNRESOLVED' })] });
expectGated({ elements: [elementRow({ status: 'CONFLICT' })] });

// Method disagreement is not a winner-gap-only ambiguity.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({
    methodWinners: { m1Spatial: 'T-E1', m2Network: 'T-E2', disagree: true },
    reasons: ['METHOD_A_B_DISAGREE', 'WINNER_GAP_NOT_SATISFIED'],
  }),
})] });

// Alignment-selected target must itself be the winner.
expectGated({ elements: [elementRow({
  targetId: 'T-E1',
  candidates: winnerGapCandidate({
    winnerTargetElementId: 'T-E2',
    reasons: ['ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
  }),
})] });

// Additional ambiguity reasons fail closed even when the selected target is still the winner.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({
    reasons: ['WINNER_GAP_NOT_SATISFIED', 'ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
  }),
})] });

// Weak winner or non-ambiguous REVIEW candidate evidence does not qualify for the exception.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({ winnerIdentityConfidence: 'MEDIUM' }),
})] });
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({ status: 'SUPPORTED', reasons: [] }),
})] });
expectGated({ elements: [elementRow({ candidates: null })] });

// Boundary evidence itself must remain strongly attested on both sides.
{
  const node = methodABoundaryNode();
  node.evidence = { ...node.evidence, leftElement: { identitySupported: true, identityConfidence: 'MEDIUM' } };
  expectGated({ node });
}
{
  const node = methodABoundaryNode();
  node.evidence = { ...node.evidence, rightElement: { identitySupported: false, identityConfidence: 'HIGH' } };
  expectGated({ node });
}

// Method-A provenance must be qualified, not merely asserted by an evidence-basis string.
{
  const node = methodABoundaryNode();
  node.evidence = {
    ...node.evidence,
    multiBaseProvenance: [{
      method: 'METHOD_A_SPATIAL',
      baseConfidence: 'REVIEW',
      rowStatus: 'REVIEW',
      rowAuthority: 'ADJACENT_MATCH_BOUNDARY',
    }],
  };
  expectGated({ node });
}
{
  const node = methodABoundaryNode({ basisMethod: 'METHOD_B_NETWORK' });
  expectGated({ node });
}
{
  const node = methodABoundaryNode();
  node.evidence = {
    ...node.evidence,
    multiBaseProvenance: [{
      method: 'METHOD_B_NETWORK',
      baseConfidence: 'HIGH',
      rowStatus: 'REVIEW',
      rowAuthority: 'ADJACENT_MATCH_BOUNDARY',
    }],
  };
  expectGated({ node });
}

// REVIEW-confidence or unsupported projected node identity remains fail-closed.
{
  const node = methodABoundaryNode();
  node.evidence = { ...node.evidence, identityConfidence: 'REVIEW', identitySupported: false };
  expectGated({ node });
}

// Correspondence-wide ambiguity/custody conflict disables the exception.
expectGated({ status: 'AMBIGUOUS', conflicts: [{ kind: 'SOURCE_NODE_TO_MULTIPLE_TARGETS' }] });
expectGated({ targetCustodyConflicts: [{ targetElementId: 'T-E1' }] });

console.log('CII Method-A adjacent-boundary node custody reconciliation checks: PASS');
