import assert from 'node:assert/strict';
import { applyCiiNodeCustodyGates } from '../tabs/cii-workspace/cii-workspace-node-custody.js';
import { ciiIdentityBound, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function baseAnchorNode(overrides = {}) {
  return {
    correspondenceId: 'node:S-N:T-N',
    kind: 'NODE',
    sourceNodeId: 'S-N',
    targetNodeId: 'T-N',
    status: 'REVIEW',
    authority: 'MULTI_BASE_CORROBORATED',
    basisMethod: 'METHOD_A_SPATIAL',
    evidence: {
      identitySupported: true,
      identityConfidence: 'MEDIUM',
      identityEvidenceBasis: 'METHOD_A_QUALIFIED_BASE_ANCHOR',
      multiBaseProvenance: [{
        loopId: 'A-GENERIC',
        method: 'METHOD_A_SPATIAL',
        baseConfidence: 'MEDIUM',
        rowStatus: 'REVIEW',
        rowAuthority: 'METHOD_A_QUALIFIED_ANCHOR',
      }],
    },
    ...overrides,
  };
}

function adjacentBoundaryNode(overrides = {}) {
  return {
    correspondenceId: 'node:S-B:T-B',
    kind: 'NODE',
    sourceNodeId: 'S-B',
    targetNodeId: 'T-B',
    status: 'REVIEW',
    authority: 'MULTI_BASE_LOOP',
    basisMethod: 'METHOD_A_SPATIAL',
    evidence: {
      identitySupported: true,
      identityConfidence: 'MEDIUM',
      identityEvidenceBasis: 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY',
      leftElement: { identitySupported: true, identityConfidence: 'HIGH' },
      rightElement: { identitySupported: true, identityConfidence: 'HIGH' },
      multiBaseProvenance: [{
        loopId: 'A-BOUNDARY',
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
    winnerGap: 7.4,
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

function sourceGraph(nodeId = 'S-N', elementIds = ['E1']) {
  return {
    adjacency: new Map([
      [String(nodeId), elementIds.map((elementId) => ({ elementId }))],
    ]),
  };
}

function correspondence({
  node = baseAnchorNode(),
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

function resultFor(config = {}, graph = sourceGraph(
  config.node?.sourceNodeId || 'S-N',
  config.elements?.map((row) => row.sourceElementId) || ['E1'],
)) {
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

// Qualified Method-A base anchor survives winner-gap-only element custody.
{
  const { input, output, node } = resultFor();
  assert.equal(node.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(node), true);
  assert.equal(ciiIdentityConfidence(node), 'MEDIUM');
  assert.deepEqual(output.elementRows, input.elementRows, 'element ambiguity must remain unchanged');
  assert.equal(output.elementRows[0].status, 'REVIEW');
  assert.equal(output.elementRows[0].evidence.candidates.status, 'AMBIGUOUS');
}

// METHOD_A_AND_B basis is valid only because provenance attests the Method-A anchor.
{
  const node = baseAnchorNode({ basisMethod: 'METHOD_A_AND_B' });
  const { node: output } = resultFor({ node });
  assert.equal(output.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(output), true);
  assert.equal(ciiIdentityConfidence(output), 'MEDIUM');
}

// Existing D5.3 adjacent-boundary behavior remains unchanged.
{
  const node = adjacentBoundaryNode();
  const { node: output } = resultFor(
    { node },
    sourceGraph('S-B', ['E1']),
  );
  assert.equal(output.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(output), true);
  assert.equal(ciiIdentityConfidence(output), 'MEDIUM');
}

// Confidence is preserved, never promoted.
{
  const node = baseAnchorNode();
  node.evidence = {
    ...node.evidence,
    identityConfidence: 'HIGH',
    multiBaseProvenance: [{ ...node.evidence.multiBaseProvenance[0], baseConfidence: 'HIGH' }],
  };
  const { node: output } = resultFor({ node });
  assert.equal(ciiIdentityConfidence(output), 'HIGH');
}

// Base confidence REVIEW fails closed.
{
  const node = baseAnchorNode();
  node.evidence = {
    ...node.evidence,
    multiBaseProvenance: [{ ...node.evidence.multiBaseProvenance[0], baseConfidence: 'REVIEW' }],
  };
  expectGated({ node });
}

// Missing or copied provenance is insufficient.
{
  const node = baseAnchorNode();
  node.evidence = { ...node.evidence, multiBaseProvenance: [] };
  expectGated({ node });
}
{
  const node = baseAnchorNode();
  node.evidence = {
    ...node.evidence,
    multiBaseProvenance: [{
      method: 'METHOD_B_NETWORK',
      baseConfidence: 'HIGH',
      rowStatus: 'REVIEW',
      rowAuthority: 'METHOD_A_QUALIFIED_ANCHOR',
    }],
  };
  expectGated({ node });
}

// Method-B-only basis does not inherit Method-A custody parity.
expectGated({ node: baseAnchorNode({ basisMethod: 'METHOD_B_NETWORK' }) });

// A copied evidence-basis string without the exact Method-A anchor row authority stays gated.
{
  const node = baseAnchorNode();
  node.evidence = {
    ...node.evidence,
    multiBaseProvenance: [{
      method: 'METHOD_A_SPATIAL',
      baseConfidence: 'HIGH',
      rowStatus: 'REVIEW',
      rowAuthority: 'ADJACENT_MATCH_BOUNDARY',
    }],
  };
  expectGated({ node });
}

// UNRESOLVED / CONFLICT element evidence remains blocking.
expectGated({ elements: [elementRow({ status: 'UNRESOLVED' })] });
expectGated({ elements: [elementRow({ status: 'CONFLICT' })] });

// Method disagreement remains blocking.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({
    methodWinners: { m1Spatial: 'T-E1', m2Network: 'T-E2', disagree: true },
    reasons: ['METHOD_A_B_DISAGREE', 'WINNER_GAP_NOT_SATISFIED'],
  }),
})] });

// Selected target must be the local winner.
expectGated({ elements: [elementRow({
  targetId: 'T-E1',
  candidates: winnerGapCandidate({
    winnerTargetElementId: 'T-E2',
    reasons: ['ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
  }),
})] });

// Winner must remain HIGH.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({ winnerIdentityConfidence: 'MEDIUM' }),
})] });

// Winner-gap must be the sole ambiguity reason.
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({
    reasons: ['WINNER_GAP_NOT_SATISFIED', 'ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
  }),
})] });

// Missing/non-AMBIGUOUS candidate evidence remains blocking.
expectGated({ elements: [elementRow({ candidates: null })] });
expectGated({ elements: [elementRow({
  candidates: winnerGapCandidate({ status: 'SUPPORTED', reasons: [] }),
})] });

// Correspondence-wide conflict and target custody conflict disable parity.
expectGated({ status: 'AMBIGUOUS', conflicts: [{ kind: 'SOURCE_NODE_TO_MULTIPLE_TARGETS' }] });
expectGated({ targetCustodyConflicts: [{ targetElementId: 'T-E1' }] });

// USER_LOCKED semantics remain untouched.
{
  const node = baseAnchorNode({
    status: 'LOCKED',
    authority: 'USER_LOCKED_ANCHOR',
    basisMethod: 'USER_LOCKED_LEGACY',
    evidence: {},
  });
  const { node: output } = resultFor({ node });
  assert.equal(output.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(output), true);
  assert.equal(ciiIdentityConfidence(output), 'LOCKED');
}

console.log('CII Method-A base-anchor custody parity checks: PASS');
