import assert from 'node:assert/strict';
import { _test as methodAProjection } from '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js';
import { arbitrateCiiLoopCorrespondences } from '../tabs/cii-workspace/cii-workspace-correspondence-arbitration.js';
import { ciiIdentityBound, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';
import { buildCiiCompareReviewModel } from '../tabs/cii-workspace/cii-workspace-compare-review.js';
import { buildCiiSourceTargetAudit } from '../tabs/cii-workspace/cii-workspace-source-target-audit.js';

// The canonical multi-base row, NOT a pre-arbitration ADJACENT_MATCH_BOUNDARY
// row, is the actual Compare Review consumer in retained Method A. This tests
// both grade capping and fail-closed custody without fixture-specific node IDs.
// Full S1/S2/S3/T qualification and browser runs are separate required oracles.
function documents() {
  return {
    source: {
      fileName: 'synthetic-source.CII',
      parsed: { nodes: [{ id: '1' }, { id: '2' }], elements: [] },
      nodeNames: { '1': 'PS1', '2': 'PS2' },
    },
    target: {
      fileName: 'synthetic-target.CII',
      parsed: { nodes: [{ id: '10' }], elements: [] },
      nodeNames: { '10': 'SL10' },
    },
  };
}
function loop(confidence = 'MEDIUM', id = 'A1') {
  return {
    status: 'READY', loopId: id, baseId: id, method: 'METHOD_A_SPATIAL',
    confidence, weight: {
      total: 79, residualQuality: 30, conditioning: 20,
      spatialExtent: 15, redundancy: 4, basisConsensus: 10,
      confidenceThresholds: { high: 85, medium: 70 },
    },
  };
}
function boundaryRow(leftConfidence, rightConfidence, targetNodeId = '10') {
  return {
    kind: 'NODE', status: 'REVIEW', authority: 'ADJACENT_MATCH_BOUNDARY',
    correspondenceId: `raw:1=>${targetNodeId}`,
    sourceNodeId: '1', targetNodeId,
    evidence: {
      leftElement: { identitySupported: true, identityConfidence: leftConfidence },
      rightElement: { identitySupported: true, identityConfidence: rightConfidence },
      boundaryIdentity: {
        identitySupported: true, reason: 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED',
        sourceNodeId: '1', targetNodeId,
        supportCount: 1, supportingSides: ['LEFT'],
      },
    },
  };
}
function canonicalReview(left, right, { withCustodyVeto = false } = {}) {
  const selectedLoop = loop();
  const projected = methodAProjection.projectMethodABoundaryRow(boundaryRow(left, right), selectedLoop);
  assert.equal(projected.evidence.identitySupported, true);
  assert.equal(projected.evidence.identityConfidence, 'MEDIUM');
  const arbitration = arbitrateCiiLoopCorrespondences([{
    loop: selectedLoop,
    correspondence: { status: 'READY', nodeRows: [projected], elementRows: [] },
  }]);
  assert.equal(arbitration.status, 'READY');
  assert.equal(arbitration.conflicts.length, 0);
  assert.equal(arbitration.nodeRows.length, 1);
  // The actual canonicalization rewrites this authority: no raw two-HIGH-edge
  // branch may independently manufacture HIGH or discard qualified local M2/OD.
  const upstream = arbitration.nodeRows[0];
  assert.equal(upstream.authority, 'MULTI_BASE_LOOP');
  assert.equal(upstream.evidence.identityEvidenceBasis, 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY');
  const node = withCustodyVeto
    ? { ...upstream, evidence: {
      ...upstream.evidence, nodeCustodyGate: { blocker: 'ADJACENT_ELEMENT_CANDIDATE_AMBIGUITY' },
    } }
    : upstream;
  const canonical = { ...arbitration, nodeRows: [node] };
  const doc = documents();
  const review = buildCiiCompareReviewModel(doc.source, doc.target, canonical, {}, { rows: [] });
  assert.equal(review.rows.length, 1);
  const row = review.rows[0];
  const withMembers = {
    ...review, rows: review.rows.map((item) => ({ ...item, sourceId: 'S1' })),
  };
  const audit = buildCiiSourceTargetAudit({
    memberPreviews: [{ sourceId: 'S1', preview: {
      sourceDocument: doc.source, targetDocument: doc.target,
    } }],
    targetDocument: doc.target, compareReview: withMembers,
    engineeringDeltas: { rows: [] }, transferPlan: { operations: [] },
    sourceSetSha256: 'a'.repeat(64),
  });
  const source1 = audit.rows.find((item) => item.sourceId === 'S1' && item.sourceNodeId === '1');
  const source2 = audit.rows.find((item) => item.sourceId === 'S1' && item.sourceNodeId === '2');
  assert(source1);
  assert(source2);
  assert.equal(source2.state, 'UNEMITTED', 'source-only unmatched NODE must remain visible');
  assert.equal(audit.rows.length, 2);
  return { node, row, source1, source2 };
}

{
  // One HIGH adjacent edge + a local endpoint M2/OD qualification is still
  // bound at the canonical consumer, capped by its MEDIUM Method A base.
  const { node, row, source1 } = canonicalReview('HIGH', 'MEDIUM');
  assert.equal(ciiIdentityBound(node), true);
  assert.equal(ciiIdentityConfidence(node), 'MEDIUM');
  assert.equal(row.identityBound, true);
  assert.equal(row.confidence, 'MEDIUM');
  assert.equal(row.adjacentBoundary, null);
  assert.equal(source1.state, 'BOUND');
  assert.equal(source1.confidence, 'MEDIUM');
}
{
  // Even when both adjacent edges are HIGH, a MEDIUM-qualified Method A base
  // must not be independently promoted by the downstream Compare Review.
  const { node, row, source1 } = canonicalReview('HIGH', 'HIGH');
  assert.equal(ciiIdentityConfidence(node), 'MEDIUM');
  assert.equal(row.identityBound, true);
  assert.equal(row.confidence, 'MEDIUM');
  assert.equal(source1.state, 'BOUND');
}
{
  // An explicit custody gate is not an invitation for a confidence-setting
  // override. The final Compare Review and complete SOURCE census must agree.
  const { node, row, source1 } = canonicalReview('HIGH', 'HIGH', { withCustodyVeto: true });
  assert.equal(ciiIdentityBound(node), false);
  assert.equal(row.identityBound, false);
  assert.equal(row.confidence, 'REVIEW');
  assert.equal(source1.state, 'UNRESOLVED');
}
{
  // Cross-loop same-SOURCE/different-TARGET is not a valid physical bind.
  const left = loop('MEDIUM', 'A1'); const right = loop('HIGH', 'A2');
  const conflict = arbitrateCiiLoopCorrespondences([
    { loop: left, correspondence: {
      status: 'READY',
      nodeRows: [methodAProjection.projectMethodABoundaryRow(boundaryRow('HIGH', 'MEDIUM', '10'), left)],
      elementRows: [],
    } },
    { loop: right, correspondence: {
      status: 'READY',
      nodeRows: [methodAProjection.projectMethodABoundaryRow(boundaryRow('HIGH', 'HIGH', '11'), right)],
      elementRows: [],
    } },
  ]);
  assert.equal(conflict.status, 'AMBIGUOUS');
  assert(conflict.blockers.includes('CROSS_LOOP_CORRESPONDENCE_CONFLICT'));
  assert(conflict.conflicts.some((row) => row.kind === 'SOURCE_NODE_TO_MULTIPLE_TARGETS'));
}
console.log('CII Method A canonical Review/census authority parity (synthetic): PASS');
