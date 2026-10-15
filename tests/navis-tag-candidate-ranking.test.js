import assert from 'node:assert/strict';
import { normalizeConfig } from '../tabs/navis-tag-isonote/navis-tag-isonote-contracts.js';
import {
  NAVIS_CANDIDATE_SCORE_MODEL,
  _test as proximityTest,
  resolveNavisTagIsonotes,
} from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';
import {
  _test as evidenceUiTest,
  renderNavisTagIsonoteEvidencePane,
} from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-evidence.js';

const config = normalizeConfig({
  supportCoordinateSource: 'json-only',
  eastingToleranceMm: 100,
  northingToleranceMm: 100,
  elevationToleranceMm: 100,
  ambiguityScoreGap: 15,
  useOdHalfAlternatives: false,
});
const trace = { odMm: null, odSource: 'NONE', boreNominalMm: null };
const supportPosition = { x: 175057.718, y: 700947.6, z: 1144.64 };
function tag(tagId, commentBody, dx = 0, dy = 0, dz = 0) {
  return {
    evidenceId: `VIEW:${tagId}`,
    viewName: `Tag View ${tagId}`,
    viewGuid: `view-${tagId}`,
    tagId: String(tagId),
    commentId: String(tagId),
    commentBody,
    commentUser: 'reviewer',
    commentStatus: 'new',
    commentDate: '',
    positionSource: 'RLTAG_POS3D',
    position: { x: supportPosition.x + dx, y: supportPosition.y + dy, z: supportPosition.z + dz },
    diagnostics: [],
  };
}

const exact = proximityTest.candidateFromTag(trace, supportPosition, tag(164, 'A1'), config);
const farther = proximityTest.candidateFromTag(trace, supportPosition, tag(165, 'B1', 50), config);
assert.equal(exact.withinTolerance, true);
assert.equal(farther.withinTolerance, true);
assert.equal(exact.scoringModel, NAVIS_CANDIDATE_SCORE_MODEL);
assert.equal(exact.score, 100);
assert.equal(exact.normalizedGeometryRms, 0);
assert.ok(farther.score < exact.score);
assert.ok(exact.score - farther.score >= config.ambiguityScoreGap);

const ranked = proximityTest.evaluateCandidates(trace, supportPosition, [farther, exact].map((candidate) => ({
  evidenceId: candidate.evidenceId,
  viewName: candidate.viewName,
  viewGuid: candidate.viewGuid,
  tagId: candidate.tagId,
  commentId: candidate.commentId,
  commentBody: candidate.commentBody,
  commentUser: candidate.commentUser,
  commentStatus: candidate.commentStatus,
  commentDate: candidate.commentDate,
  positionSource: candidate.positionSource,
  position: candidate.tagPosition,
  diagnostics: candidate.diagnostics,
})), config);
assert.equal(ranked.candidates[0].tagId, '164');
assert.equal(ranked.candidates[0].score, 100);

const resolvedDecision = proximityTest.decision(ranked.candidates, config);
assert.equal(resolvedDecision.status, 'RESOLVED');
assert.equal(resolvedDecision.selected.tagId, '164');
assert.equal(resolvedDecision.decisionReason, 'RUNNER_UP_REJECTED_BY_SCORE_GAP');
assert.equal(resolvedDecision.topCandidateScore, 100);
assert.ok(resolvedDecision.scoreGap >= 15);
assert.equal(resolvedDecision.requiredScoreGap, 15);
assert.equal(resolvedDecision.distinctCommentCount, 2);

const tied = proximityTest.evaluateCandidates(trace, supportPosition, [tag(164, 'A1'), tag(166, 'B1')], config);
const tiedDecision = proximityTest.decision(tied.candidates, config);
assert.equal(tiedDecision.status, 'AMBIGUOUS');
assert.equal(tiedDecision.selected, null);
assert.equal(tiedDecision.decisionReason, 'CONFLICTING_NEARBY_COMMENTS');
assert.equal(tiedDecision.scoreGap, 0);
assert.equal(tiedDecision.distinctCommentCount, 2);

const sameText = proximityTest.evaluateCandidates(trace, supportPosition, [tag(164, 'A1'), tag(167, '  a1  ', 50)], config);
const deduplicated = proximityTest.decision(sameText.candidates, config);
assert.equal(deduplicated.status, 'RESOLVED');
assert.equal(deduplicated.selected.tagId, '164');
assert.equal(deduplicated.decisionReason, 'DUPLICATE_SAME_TEXT');

const tableBuild = {
  config,
  diagnostics: [],
  records: [{
    rowId: 'ROW-72', rowIndex: 72, identity: 'PS-11171.5', identityRaw: '/PS-11171.5|/PS-11171.3',
    groupedIdentities: ['/PS-11171.5', '/PS-11171.3'], groupMemberCount: 2,
    supportRoot: 'PS-11171', inputPipe: '/ASIM-1835-4"-P8810203-31441C4-PP',
    position: null, positionColumn: '', rawRow: { 'Name of the element': '/PS-11171.5|/PS-11171.3' },
  }],
};
const identityTrace = {
  config,
  diagnostics: [],
  summary: { resolvedCount: 1 },
  rows: [{
    tableRowId: 'ROW-72', tableRowIndex: 72, tableIdentityRaw: '/PS-11171.5|/PS-11171.3',
    canonicalIdentity: 'PS-11171.5', supportRoot: 'PS-11171', traceId: 'TRACE-72', status: 'RESOLVED_EXACT_PIPE',
    position: supportPosition, positionSourcePath: 'attributes.POSI', selectedNodeId: 'SJ-3374',
    selectedSourceFile: 'ATTRIBUTE-AML_ASIM-1835_managed_stage.json', selectedJsonPath: '$[38].children[28]',
    selectedAncestorIds: [], selectedIdentityPath: 'attributes.NAME', resolvedBranch: '/ASIM-1835-4"-P8810203-31441C4-PP/B1',
    resolvedPipe: '/ASIM-1835-4"-P8810203-31441C4-PP', resolvedZone: '', odMm: null,
    odPath: '', odSource: 'NONE', odLookupName: '', boreNominalMm: null, borePath: '', boreUnits: 'mm',
  }],
};
const navisParse = { tags: [tag(164, 'A1'), tag(165, 'B1', 50)], diagnostics: [], summary: { tagCount: 2 } };
const audit = resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, config);
assert.equal(audit.summary.scoringModel, NAVIS_CANDIDATE_SCORE_MODEL);
assert.equal(audit.summary.resolvedCount, 1);
assert.equal(audit.decisions[0].selectedTagId, '164');
assert.equal(audit.decisions[0].decisionReason, 'RUNNER_UP_REJECTED_BY_SCORE_GAP');
assert.equal(audit.decisions[0].scoreGap, resolvedDecision.scoreGap);
assert.equal(audit.candidateLedger[0].candidateRank, 1);
assert.equal(audit.candidateLedger[0].accepted, true);
assert.equal(audit.candidateLedger[0].decisionStatus, 'RESOLVED');
assert.equal(audit.candidateLedger[1].accepted, false);

const uiRows = evidenceUiTest.candidateRows({ audit });
assert.equal(uiRows[0].comparisonOutcome, 'SELECTED_MATCH');
assert.equal(uiRows[1].comparisonOutcome, 'IN_TOLERANCE_RUNNER_UP');
assert.equal(uiRows[1].decisionReason, 'RUNNER_UP_REJECTED_BY_SCORE_GAP');
assert.equal(uiRows[1].topCandidateTagId, '164');
assert.equal(uiRows[1].runnerUpTagId, '165');

const evidenceHtml = renderNavisTagIsonoteEvidencePane({ activeTab: 'candidates', audit, identityTrace, config });
assert.match(evidenceHtml, /Candidate score is not a percentage/);
assert.match(evidenceHtml, /Candidate rank/);
assert.match(evidenceHtml, /Required score gap/);
assert.match(evidenceHtml, /IN_TOLERANCE_RUNNER_UP/);
assert.match(evidenceHtml, /RUNNER_UP_REJECTED_BY_SCORE_GAP/);

console.log('navis-tag-candidate-ranking tests passed');
