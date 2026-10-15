import assert from 'node:assert/strict';
import { buildCiiSourceTargetAudit, ciiSourceTargetAuditToCsv, ciiSourceTargetAuditToJson } from '../tabs/cii-workspace/cii-workspace-source-target-audit.js';
import { ciiMultiSourceSourceTargetAuditMarkup } from '../tabs/cii-workspace/cii-workspace-source-target-audit-ui.js';

function document(fileName, nodeCount, elements, nodeNames = {}) {
  return {
    fileName, contentSha256: `${fileName}-sha`, summary: { nodeCount }, nodeNames,
    parsed: { elements, nodes: Object.fromEntries(elements.flatMap((row) => [[String(row.from), {}], [String(row.to), {}]])) },
  };
}
function reviewRow(sourceId, source, target, overrides = {}) {
  return {
    correspondenceId: `ms:${sourceId}:${source}:${target}`,
    memberCorrespondenceId: `node:${source}:${target}`,
    sourceId, kind: 'NODE', source: String(source), target: String(target),
    workflowStatus: 'HIGH', confidence: 'HIGH', identityBound: true,
    identityEvidenceBasis: 'CANDIDATE_EVIDENCE', authority: 'TEST', decision: 'ACCEPTED',
    ...overrides,
  };
}

const s1 = document('S1.CII', 3, [{ from: 1, to: 2 }, { from: 2, to: 3 }], { 1: 'A', 2: 'B', 3: 'C' });
const s2 = document('S2.CII', 2, [{ from: 10, to: 20 }], { 10: 'X', 20: 'Y' });
const target = document('T.CII', 4, [{ from: 101, to: 102 }, { from: 201, to: 202 }], {
  101: 'A-T', 102: 'B-T', 201: 'X-A', 202: 'X-B',
});

const s1Bound = reviewRow('S1', 1, 101);
const s1Unresolved = reviewRow('S1', 2, 102, {
  workflowStatus: 'REVIEW', confidence: 'REVIEW', identityBound: false, decision: 'REVIEW',
  candidateStatus: 'AMBIGUOUS', reasons: ['winner gap too small'],
});
const s2AmbiguousA = reviewRow('S2', 10, 201, { identityBound: false, confidence: 'REVIEW', decision: 'REVIEW' });
const s2AmbiguousB = reviewRow('S2', 10, 202, { identityBound: false, confidence: 'REVIEW', decision: 'REVIEW' });
const s2Bound = reviewRow('S2', 20, 202, { confidence: 'LOCKED', workflowStatus: 'LOCKED', decision: 'LOCKED' });

const preview = {
  sourceSetSha256: 'source-set-sha',
  memberPreviews: [
    { sourceId: 'S1', preview: { sourceDocument: s1 } },
    { sourceId: 'S2', preview: { sourceDocument: s2 } },
  ],
  targetDocument: target,
  compareReview: { rows: [s1Bound, s1Unresolved, s2AmbiguousA, s2AmbiguousB, s2Bound] },
  engineeringDeltas: { rows: [{
    deltaId: 'delta-s1-1', sourceId: 'S1', sourceIdentity: '1', category: 'NODE_NAME', property: 'Node name / to-name', changed: true,
  }] },
  transferPlan: { operations: [{
    operationId: 'op-s1-1', action: 'COPY', status: 'PREVIEW_READY', matchAuthority: { correspondenceId: s1Bound.correspondenceId },
  }] },
};
const audit = buildCiiSourceTargetAudit(preview);

assert.equal(audit.schema, 'CIIWorkspaceSourceTargetAudit.v1');
assert.equal(audit.rows.length, 5, 'every SOURCE node must appear exactly once in the census');
assert.deepEqual({
  BOUND: audit.summary.BOUND,
  UNRESOLVED: audit.summary.UNRESOLVED,
  AMBIGUOUS: audit.summary.AMBIGUOUS,
  UNEMITTED: audit.summary.UNEMITTED,
}, { BOUND: 2, UNRESOLVED: 1, AMBIGUOUS: 1, UNEMITTED: 1 });
assert.equal(audit.summary.qualifiedNodeNameChangeCount, 1);
assert(audit.summary.bySource.every((row) => row.populationStatus === 'MATCH'));

const s1Node1 = audit.rows.find((row) => row.rowKey === 'S1:1');
assert.equal(s1Node1.state, 'BOUND');
assert.equal(s1Node1.targetNodeId, '101');
assert.equal(s1Node1.sourceNodeName, 'A');
assert.equal(s1Node1.targetNodeName, 'A-T');
assert.equal(s1Node1.qualifiedNodeNameChange, true);
assert.deepEqual(s1Node1.writerActions, ['COPY']);

const s1Node2 = audit.rows.find((row) => row.rowKey === 'S1:2');
assert.equal(s1Node2.state, 'UNRESOLVED');
assert(s1Node2.reasons.includes('CANDIDATE_AMBIGUOUS'));

const s1Node3 = audit.rows.find((row) => row.rowKey === 'S1:3');
assert.equal(s1Node3.state, 'UNEMITTED');
assert.equal(s1Node3.targetNodeId, null);
assert.deepEqual(s1Node3.reasons, ['NO_NODE_CORRESPONDENCE_EMITTED']);

const s2Node10 = audit.rows.find((row) => row.rowKey === 'S2:10');
assert.equal(s2Node10.state, 'AMBIGUOUS');
assert.deepEqual(s2Node10.targetNodeIds, ['201', '202']);
assert.deepEqual(s2Node10.reasons, ['MULTIPLE_TARGET_NODE_CLAIMS']);

const csv = ciiSourceTargetAuditToCsv(audit);
assert.equal(csv.split('\n').length, 6, 'CSV must contain one header + one row per source node');
assert.match(csv, /NO_NODE_CORRESPONDENCE_EMITTED/);
assert.match(csv, /MULTIPLE_TARGET_NODE_CLAIMS/);

const json = ciiSourceTargetAuditToJson(audit);
assert.match(json, /CIIWorkspaceSourceTargetAudit\.v1/);
assert.match(json, /"totalSourceNodes":5/);

const markup = ciiMultiSourceSourceTargetAuditMarkup(preview);
assert.match(markup, /Correspondence → Source vs Target/);
assert.match(markup, /Complete SOURCE-node census/);
assert.match(markup, /data-ciiw-source-target-row="S1:3"/);
assert.match(markup, /UNEMITTED/);
assert.match(markup, /Export census CSV/);
assert.match(markup, /Export census JSON/);
assert.match(markup, /data:text\/csv;charset=utf-8/);
assert.match(markup, /data:application\/json;charset=utf-8/);

const pending = new Map([[s1Unresolved.correspondenceId, 'REJECT']]);
const pendingAudit = buildCiiSourceTargetAudit({ ...preview, reviewDecisionOverrides: pending });
assert.deepEqual(pendingAudit.rows.find((row) => row.rowKey === 'S1:2').reviewDecisions, ['REJECT']);
const pendingMarkup = ciiMultiSourceSourceTargetAuditMarkup(preview, pending);
assert.match(pendingMarkup, />REJECT</);

console.log('CII Source vs Target census audit checks: PASS');
