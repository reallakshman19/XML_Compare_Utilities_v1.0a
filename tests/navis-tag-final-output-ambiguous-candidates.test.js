import assert from 'node:assert/strict';
import {
  ALTERNATE_MATCH_COLUMN,
  buildFinalOutputRows,
  UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE,
} from '../tabs/navis-tag-isonote/navis-tag-final-output.js';

const supportPosition = { x: 175057.718, y: 700947.6, z: 1144.64 };
const tag164Position = { ...supportPosition };
const tag1Position = { x: 175057.718, y: 700950.48, z: 1144.64 };

const decision = {
  tableRowId: 'ROW-72', tableRowIndex: 72, canonicalIdentity: 'PS-11171.5',
  groupedIdentities: ['/PS-11171.5', '/PS-11171.3'],
  tableIdentityRaw: '/PS-11171.5|/PS-11171.3',
  resolvedPipe: '/ASIM-1835-4"-P8810203-31441C4-PP', supportPosition,
  status: 'AMBIGUOUS', ambiguity: 'CONFLICTING_NEARBY_COMMENTS',
  decisionReason: 'CONFLICTING_NEARBY_COMMENTS', confidence: 'AMBIGUOUS',
  selectedTagId: '', selectedCandidate: null, supportIsonote: '',
  topCandidateTagId: '164', topCandidateScore: 100,
  runnerUpTagId: '1', runnerUpScore: 98.271633,
  scoreGap: 1.728367, requiredScoreGap: 15,
};

function candidate({ tagId, commentBody, rank, score, position }) {
  return {
    ledgerId: `ROW-72:C${rank}`, ledgerKind: 'ACCEPTED_CANDIDATE',
    tableRowId: 'ROW-72', tableRowIndex: 72, canonicalIdentity: 'PS-11171.5',
    groupedIdentities: ['/PS-11171.5', '/PS-11171.3'],
    tableIdentityRaw: '/PS-11171.5|/PS-11171.3',
    inputPipe: '/ASIM-1835-4"-P8810203-31441C4-PP',
    resolvedPipe: '/ASIM-1835-4"-P8810203-31441C4-PP',
    supportPosition, supportPositionSource: 'STAGED_JSON', supportPositionPath: 'attributes.POSI',
    evidenceId: `VIEW:${tagId}`, viewGuid: `view-${tagId}`, viewName: `Tag View ${tagId}`,
    tagId, commentId: tagId, commentBody, tagPosition: position, positionSource: 'RLTAG_POS3D',
    withinTolerance: true, accepted: false, candidateRank: rank, score,
    normalizedGeometryRms: rank === 1 ? 0 : 0.03, spatialDistanceMm: rank === 1 ? 0 : 2.88,
    decisionStatus: 'AMBIGUOUS', decisionReason: 'CONFLICTING_NEARBY_COMMENTS',
    topCandidateTagId: '164', topCandidateScore: 100,
    runnerUpTagId: '1', runnerUpScore: 98.271633,
    scoreGap: 1.728367, requiredScoreGap: 15,
  };
}

const candidate164 = candidate({ tagId: '164', commentBody: 'A1', rank: 1, score: 100, position: tag164Position });
const candidate1 = candidate({ tagId: '1', commentBody: 'R', rank: 2, score: 98.271633, position: tag1Position });
const unmatchedTag = {
  evidenceId: 'VIEW:9', viewGuid: 'view-9', viewName: 'Tag View 9',
  tagId: '9', commentId: '9', commentBody: 'R', position: { x: 200000, y: 800000, z: 1200 },
};

const audit = {
  config: {}, decisions: [decision], candidateLedger: [candidate164, candidate1],
  propagationLedger: [],
};
const navisParse = {
  tags: [
    { evidenceId: 'VIEW:164', viewGuid: 'view-164', tagId: '164', commentId: '164', commentBody: 'A1', position: tag164Position },
    { evidenceId: 'VIEW:1', viewGuid: 'view-1', tagId: '1', commentId: '1', commentBody: 'R', position: tag1Position },
    unmatchedTag,
  ],
};

const rows = buildFinalOutputRows(audit, {}, navisParse);
assert.equal(rows.length, 2, 'one ambiguous support row plus one genuinely unmatched Tag');

const supportRow = rows.find((row) => row['Name of the element'] === '/PS-11171.5');
assert.ok(supportRow, 'highest-ranked ambiguous candidate must remain visible');
assert.equal(supportRow['Navis Tag ID'], '164');
assert.equal(supportRow.Tag, 'A1');
assert.equal(supportRow['Support ISONOTE'], '');
assert.equal(supportRow.confidence, 'AMBIGUOUS');
assert.match(supportRow.Basis, /IN_TOLERANCE_AMBIGUOUS/);
assert.match(supportRow.Basis, /CANDIDATE_RANK=1/);
assert.match(supportRow.Basis, /SCORE=100/);
assert.match(supportRow[ALTERNATE_MATCH_COLUMN], /AMBIGUOUS/);
assert.match(supportRow[ALTERNATE_MATCH_COLUMN], /Tag 1: R/);
assert.match(supportRow[ALTERNATE_MATCH_COLUMN], /score 98\.271633/);
assert.ok(!rows.some((row) => row['Navis Tag ID'] === '1' && row['Name of the element'] === '/PS-11171.5'), 'runner-up must not become a second final row');
assert.ok(!rows.some((row) => row.confidence === 'NOT_SELECTED'));

const unmatched = rows.find((row) => row['Navis Tag ID'] === '9');
assert.equal(unmatched['Name of the element'], UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE);
assert.match(unmatched.Basis, /NO_PS_MATCH/);
assert.ok(!rows.some((row) => ['164', '1'].includes(row['Navis Tag ID']) && row['Name of the element'] === UNMATCHED_NAVIS_TAG_LOCATION_MESSAGE));

console.log('navis-tag one-row ambiguous final-output tests passed');
