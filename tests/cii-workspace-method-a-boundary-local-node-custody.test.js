import assert from 'node:assert/strict';
import { applyCiiNodeCustodyGates } from '../tabs/cii-workspace/cii-workspace-node-custody.js';
import { ciiIdentityBound, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function boundaryLocalNode(overrides = {}) {
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
      boundaryIdentity: {
        identitySupported: true,
        sourceNodeId: 'S-N',
        targetNodeId: 'T-N',
        supportingSides: ['TO'],
        supportCount: 1,
        reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED',
      },
      multiBaseProvenance: [{
        loopId: 'A-LOCAL',
        method: 'METHOD_A_SPATIAL',
        baseConfidence: 'MEDIUM',
        rowStatus: 'REVIEW',
        rowAuthority: 'ADJACENT_MATCH_BOUNDARY',
      }],
    },
    ...overrides,
  };
}

function candidate(overrides = {}) {
  return {
    status: 'AMBIGUOUS',
    winnerIdentityConfidence: 'MEDIUM',
    winnerTargetElementId: 'T-ALT',
    methodWinners: { m1Spatial: 'T-ALT', m2Network: 'T-ALT', disagree: false },
    reasons: ['WINNER_GAP_NOT_SATISFIED', 'ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
    winnerGap: 0,
    requiredWinnerGap: 8,
    ...overrides,
  };
}

function elementRow({
  id = 'E1',
  targetId = 'T-E1',
  status = 'REVIEW',
  hardFail = false,
  candidates = candidate(),
} = {}) {
  return {
    correspondenceId: `element:${id}:${targetId}`,
    kind: 'ELEMENT',
    sourceElementId: id,
    targetElementIds: [targetId],
    status,
    authority: 'MULTI_BASE_LOOP',
    evidence: candidates ? { hardFail, candidates } : { hardFail },
  };
}

function graph(elementIds = ['E1']) {
  return { adjacency: new Map([['S-N', elementIds.map((elementId) => ({ elementId }))]]) };
}

function correspondence({
  node = boundaryLocalNode(),
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

function resultFor(config = {}, sourceGraph = graph(config.elements?.map((r) => r.sourceElementId) || ['E1'])) {
  const input = correspondence(config);
  const output = applyCiiNodeCustodyGates(input, sourceGraph);
  return { input, output, node: output.nodeRows[0] };
}

function expectGated(config = {}, sourceGraph) {
  const { node } = resultFor(config, sourceGraph);
  assert(node.evidence?.nodeCustodyGate, 'expected node custody gate');
  assert.equal(node.evidence.nodeCustodyGate.blocker, 'ADJACENT_ELEMENT_CANDIDATE_AMBIGUITY');
  assert.equal(ciiIdentityBound(node), false);
  return node;
}

// Boundary-local node identity is independent of whole-element winner selection.
{
  const { input, output, node } = resultFor();
  assert.equal(node.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(node), true);
  assert.equal(ciiIdentityConfidence(node), 'MEDIUM');
  assert.deepEqual(output.elementRows, input.elementRows);
  assert.equal(output.elementRows[0].status, 'REVIEW');
  assert.equal(output.elementRows[0].evidence.candidates.status, 'AMBIGUOUS');
  assert.equal(output.elementRows[0].evidence.candidates.winnerTargetElementId, 'T-ALT');
}

// Multiple REVIEW/AMBIGUOUS incident elements with different whole-element winners remain non-vetoing.
{
  const elements = [
    elementRow({ id: 'E1', targetId: 'T-E1', candidates: candidate({ winnerTargetElementId: 'T-X' }) }),
    elementRow({ id: 'E2', targetId: 'T-E2', candidates: candidate({
      winnerIdentityConfidence: 'HIGH',
      winnerTargetElementId: 'T-Y',
      methodWinners: { m1Spatial: 'T-Y', m2Network: 'T-Z', disagree: true },
      reasons: ['METHOD_A_B_DISAGREE', 'ALIGNMENT_TARGET_NOT_BEST_CANDIDATE'],
    }) }),
  ];
  const { node } = resultFor({ elements }, graph(['E1', 'E2']));
  assert.equal(node.evidence?.nodeCustodyGate, undefined);
  assert.equal(ciiIdentityBound(node), true);
}

// Confidence ceiling is preserved.
{
  const node = boundaryLocalNode();
  node.evidence = {
    ...node.evidence,
    identityConfidence: 'HIGH',
    multiBaseProvenance: [{ ...node.evidence.multiBaseProvenance[0], baseConfidence: 'HIGH' }],
  };
  const { node: output } = resultFor({ node });
  assert.equal(ciiIdentityConfidence(output), 'HIGH');
}

// Missing or invalid local attestation returns to the existing strict custody path.
for (const boundaryIdentity of [
  null,
  { identitySupported: false, sourceNodeId: 'S-N', targetNodeId: 'T-N', supportCount: 1, supportingSides: ['TO'], reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED' },
  { identitySupported: true, sourceNodeId: 'WRONG', targetNodeId: 'T-N', supportCount: 1, supportingSides: ['TO'], reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED' },
  { identitySupported: true, sourceNodeId: 'S-N', targetNodeId: 'WRONG', supportCount: 1, supportingSides: ['TO'], reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED' },
  { identitySupported: true, sourceNodeId: 'S-N', targetNodeId: 'T-N', supportCount: 0, supportingSides: [], reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED' },
  { identitySupported: true, sourceNodeId: 'S-N', targetNodeId: 'T-N', supportCount: 1, supportingSides: ['TO'], reason: 'OTHER' },
]) {
  const node = boundaryLocalNode();
  node.evidence = { ...node.evidence, boundaryIdentity };
  expectGated({ node });
}

// Method-A provenance remains mandatory.
{
  const node = boundaryLocalNode();
  node.evidence = { ...node.evidence, multiBaseProvenance: [] };
  expectGated({ node });
}
{
  const node = boundaryLocalNode({ basisMethod: 'METHOD_B_NETWORK' });
  expectGated({ node });
}
{
  const node = boundaryLocalNode();
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

// REVIEW-confidence projected identity remains unsupported.
{
  const node = boundaryLocalNode();
  node.evidence = { ...node.evidence, identitySupported: false, identityConfidence: 'REVIEW' };
  expectGated({ node });
}

// UNRESOLVED / CONFLICT / hard-fail elements remain blocking.
expectGated({ elements: [elementRow({ status: 'UNRESOLVED' })] });
expectGated({ elements: [elementRow({ status: 'CONFLICT' })] });
expectGated({ elements: [elementRow({ hardFail: true })] });

// A REVIEW element without AMBIGUOUS candidate evidence remains blocking.
expectGated({ elements: [elementRow({ candidates: null })] });
expectGated({ elements: [elementRow({ candidates: candidate({ status: 'SUPPORTED' }) })] });

// Correspondence-level conflicts remain authoritative.
expectGated({ status: 'AMBIGUOUS', conflicts: [{ kind: 'SOURCE_NODE_TO_MULTIPLE_TARGETS' }] });
expectGated({ targetCustodyConflicts: [{ targetElementId: 'T-E1' }] });

// USER_LOCKED remains unchanged.
{
  const manual = boundaryLocalNode({
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

console.log('CII boundary-local Method-A node custody independence checks: PASS');
