import assert from 'node:assert/strict';

import { normalizeConfig } from '../tabs/navis-tag-isonote/navis-tag-isonote-contracts.js';
import {
  NAVIS_ANCHOR_LOOP_POLICY,
  decisionAcrossAnchorLoops,
  evaluateCandidatesAcrossAnchors,
} from '../tabs/navis-tag-isonote/navis-tag-multi-anchor-ranking.js';

const config = normalizeConfig({
  navisUnits: 'mm', jsonUnits: 'mm', tableUnits: 'mm',
  eastingToleranceMm: 100, northingToleranceMm: 100, elevationToleranceMm: 100,
  ambiguityScoreGap: 15, useOdHalfAlternatives: false,
});

function tag(tagId, rawPosition, commentBody) {
  return {
    evidenceId: `VIEW-${tagId}:RL-${tagId}:C-${tagId}`,
    viewName: `Tag ${tagId}`, viewGuid: `VIEW-${tagId}`,
    tagId, commentId: tagId, commentBody, commentUser: '', commentStatus: '', commentDate: '',
    rawPosition, positionSource: 'RLTAG_POS3D', units: 'mm', diagnostics: [],
  };
}
function anchor(tagId, supportIdentity, deltaEMm, deltaNMm, deltaElMm) {
  return {
    valid: true,
    anchorId: `TAG:${tagId}|SUPPORT:${supportIdentity}`,
    resolvedTagId: tagId,
    resolvedSupportIdentity: supportIdentity,
    deltaEMm, deltaNMm, deltaElMm,
  };
}

const anchors = [
  anchor('165', 'PS-11366/DATUM', -55999.978, 1821993.749, -100003.983),
  anchor('164', 'PS-11171.5', -54937.72, 1822004.064, -100172.454),
  anchor('23', 'PS-11181/DATUM', -55955.122, 1822013.126, -100114.237),
];
const tags = [
  tag('1', { x: 229991.78, y: -1121059.233, z: 101315.133 }, 'R'),
  tag('23', { x: 220685.122, y: -1096070.826, z: 101658.877 }, 'R+G+LS'),
  tag('40', { x: 231015.544, y: -1121061.993, z: 101243.294 }, 'Remove Guide'),
  tag('163', { x: 244530.041, y: -1092841.494, z: 101057.904 }, 'A'),
  tag('164', { x: 229995.438, y: -1121056.464, z: 101317.094 }, 'A1'),
  tag('165', { x: 244529.978, y: -1092843.749, z: 101070.534 }, 'A2'),
];

const support11171 = { x: 175057.718, y: 700947.6, z: 1144.64 };
const evaluation11171 = evaluateCandidatesAcrossAnchors({}, support11171, tags, anchors, config);
assert.equal(evaluation11171.mode, 'ANCHOR_LOOPS');
assert.equal(evaluation11171.policy, NAVIS_ANCHOR_LOOP_POLICY);
assert.equal(evaluation11171.anchorLoops.length, 3);
assert.deepEqual(evaluation11171.candidates.map((candidate) => [candidate.tagId, candidate.anchorBasisTagId, candidate.crossLoopRank]), [
  ['164', '164', 1],
  ['40', '23', 2],
  ['40', '165', 3],
]);
const anchor164Rows = evaluation11171.anchorLoopLedger.filter((row) => row.anchorBasisTagId === '164');
assert.deepEqual(anchor164Rows.map((row) => [row.tagId, row.anchorLoopRank, row.anchorLoopWinner]), [
  ['164', 1, true],
  ['1', 2, false],
]);
const result11171 = decisionAcrossAnchorLoops(evaluation11171.candidates, config, evaluation11171.nearestRejected);
assert.equal(result11171.status, 'RESOLVED');
assert.equal(result11171.selected.tagId, '164');
assert.equal(result11171.selected.anchorBasisTagId, '164');
assert.equal(result11171.decisionReason, 'CROSS_LOOP_CLOSEST_CANDIDATE');
assert.equal(result11171.crossLoopWinnerCount, 3);
assert.ok(result11171.crossLoopGeometryGapMm > 0);

const support11366 = { x: 188530, y: 729150, z: 1066.551 };
const evaluation11366 = evaluateCandidatesAcrossAnchors({}, support11366, tags, anchors, config);
assert.deepEqual(evaluation11366.candidates.map((candidate) => [candidate.tagId, candidate.anchorBasisTagId]), [
  ['165', '165'],
]);
const anchor165Rows = evaluation11366.anchorLoopLedger.filter((row) => row.anchorBasisTagId === '165');
assert.deepEqual(anchor165Rows.map((row) => [row.tagId, row.anchorLoopRank, row.anchorLoopWinner]), [
  ['165', 1, true],
  ['163', 2, false],
]);
const result11366 = decisionAcrossAnchorLoops(evaluation11366.candidates, config, evaluation11366.nearestRejected);
assert.equal(result11366.status, 'RESOLVED');
assert.equal(result11366.selected.tagId, '165');
assert.equal(result11366.decisionReason, 'SINGLE_ANCHOR_LOOP_WINNER');

const reversed = evaluateCandidatesAcrossAnchors({}, support11171, tags, [...anchors].reverse(), config);
assert.deepEqual(
  reversed.candidates.map((candidate) => [candidate.tagId, candidate.anchorBasisId, candidate.crossLoopRank]),
  evaluation11171.candidates.map((candidate) => [candidate.tagId, candidate.anchorBasisId, candidate.crossLoopRank]),
  'anchor entry order must not change loop winners or cross-loop ranking',
);

console.log('navis-tag independent anchor-loop selection tests passed');
