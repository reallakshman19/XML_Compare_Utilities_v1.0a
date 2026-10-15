import assert from 'node:assert/strict';
import { deriveCiiNodeNameBenchmarkDelta } from '../tabs/cii-workspace/cii-workspace-benchmark-overlay.js';
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

const source = document('S1.CII', 3, [{ from: 1, to: 2 }, { from: 2, to: 3 }], { 1: 'A2', 2: 'C', 3: 'EXTRA' });
const target = document('T.CII', 3, [{ from: 101, to: 103 }, { from: 103, to: 999 }], { 101: 'A', 999: 'OLD' });
const expected = document('TEXPECTED.CII', 3, [{ from: 101, to: 103 }, { from: 103, to: 999 }], { 101: 'A2', 103: 'C', 999: 'OLD' });
const row101 = reviewRow('S1', 1, 101);
const row103 = reviewRow('S1', 2, 103);
const row999 = reviewRow('S1', 3, 999);
const preview = {
  sourceSetSha256: 'source-set-sha',
  memberPreviews: [{ sourceId: 'S1', preview: { sourceDocument: source } }],
  targetDocument: target,
  compareReview: { rows: [row101, row103, row999] },
  engineeringDeltas: { rows: [
    { deltaId: 'd101', sourceId: 'S1', sourceIdentity: '1', category: 'NODE_NAME', property: 'Node name / to-name', changed: true },
    { deltaId: 'd103', sourceId: 'S1', sourceIdentity: '2', category: 'NODE_NAME', property: 'Node name / to-name', changed: false },
    { deltaId: 'd999', sourceId: 'S1', sourceIdentity: '3', category: 'NODE_NAME', property: 'Node name / to-name', changed: true },
  ] },
  transferPlan: { operations: [
    { operationId: 'o101', action: 'COPY', status: 'PREVIEW_READY', matchAuthority: { correspondenceId: row101.correspondenceId } },
    { operationId: 'o999', action: 'COPY', status: 'PREVIEW_READY', matchAuthority: { correspondenceId: row999.correspondenceId } },
  ] },
};
const benchmark = deriveCiiNodeNameBenchmarkDelta(target, expected);
const markup = ciiMultiSourceSourceTargetAuditMarkup(preview, null, benchmark);

assert.match(markup, /Known-positive benchmark overlay/);
assert.match(markup, /LOWER BOUND/);
assert.match(markup, /RECOVERED/);
assert.match(markup, /BOUND_NO_MUTATION/);
assert.match(markup, /ADDITIONAL QUALIFIED/);
assert.match(markup, /not automatically invalid/);
assert.match(markup, /Export benchmark CSV/);
assert.match(markup, /Export benchmark JSON/);
assert.match(markup, /<th>Benchmark<\/th>/);
assert.match(markup, /REPLACE @ 101/);

console.log('CII benchmark overlay UI checks: PASS');
