import assert from 'node:assert/strict';

import {
  NAVIS_ANCHOR_DIAGNOSTICS_SCHEMA,
  buildAnchorConsistencyDiagnostics,
} from '../tabs/navis-tag-isonote/navis-tag-anchor-diagnostics.js';
import { resolveNavisTagIsonotes } from '../tabs/navis-tag-isonote/navis-tag-proximity-engine.js';

function anchor(anchorId, tagId, deltaE, deltaN, deltaEl) {
  return {
    valid: true,
    anchorId,
    resolvedTagId: tagId,
    resolvedSupportIdentity: 'PS-1',
    deltaEMm: deltaE,
    deltaNMm: deltaN,
    deltaElMm: deltaEl,
  };
}

const first = anchor('TAG:1|SUPPORT:PS-1', '1', 100, 200, 300);
const second = anchor('TAG:2|SUPPORT:PS-1', '2', 103, 204, 300);
const third = anchor('TAG:3|SUPPORT:PS-1', '3', 100, 200, 300);
const ledger = [
  {
    ledgerKind: 'ACCEPTED_CANDIDATE', anchorBasisId: first.anchorId, accepted: true,
    withinTolerance: true, equivalentAnchorCount: 2,
    anchorEvaluations: [
      { anchorId: first.anchorId, withinTolerance: true },
      { anchorId: second.anchorId, withinTolerance: false },
      { anchorId: third.anchorId, withinTolerance: true },
    ],
  },
  {
    ledgerKind: 'ACCEPTED_CANDIDATE', anchorBasisId: second.anchorId, accepted: false,
    withinTolerance: true, equivalentAnchorCount: 1,
    anchorEvaluations: [
      { anchorId: first.anchorId, withinTolerance: false },
      { anchorId: second.anchorId, withinTolerance: true },
      { anchorId: third.anchorId, withinTolerance: false },
    ],
  },
];
const source = { policy: 'EQUAL_AUTHORITY', hypotheses: [first, second, third] };
const sourceSnapshot = JSON.stringify({ source, ledger });
const diagnostics = buildAnchorConsistencyDiagnostics(source, ledger);

assert.equal(diagnostics.schema, NAVIS_ANCHOR_DIAGNOSTICS_SCHEMA);
assert.equal(diagnostics.authorityEffect, 'NONE');
assert.equal(diagnostics.summary.validAnchorCount, 3);
assert.equal(diagnostics.summary.distinctTransformCount, 2);
assert.equal(diagnostics.summary.usedAsBestBasisCount, 2);
assert.equal(diagnostics.summary.unusedAsBestBasisCount, 1);
assert.equal(diagnostics.summary.candidateWinnerCount, 2);
assert.equal(diagnostics.summary.selectedDecisionCount, 1);
assert.equal(diagnostics.summary.equivalentBestCandidateCount, 1);
assert.equal(diagnostics.summary.maxPairwiseSeparationMm, 5);
assert.deepEqual(diagnostics.transformSpread.e, { min: 100, max: 103, span: 3 });
assert.deepEqual(diagnostics.transformSpread.n, { min: 200, max: 204, span: 4 });
assert.deepEqual(diagnostics.transformSpread.el, { min: 300, max: 300, span: 0 });
assert.ok(diagnostics.diagnosticCodes.includes('DISTINCT_ANCHOR_TRANSLATIONS'));
assert.ok(diagnostics.diagnosticCodes.includes('VALID_ANCHOR_UNUSED_AS_BEST_BASIS'));
assert.ok(diagnostics.diagnosticCodes.includes('EQUIVALENT_BEST_ANCHOR_TIES_PRESENT'));
assert.ok(diagnostics.diagnosticCodes.includes('BEST_BASIS_DISTRIBUTED_ACROSS_ANCHORS'));
assert.equal(JSON.stringify({ source, ledger }), sourceSnapshot, 'diagnostic construction must not mutate authority evidence');

const reversed = buildAnchorConsistencyDiagnostics(
  { ...source, hypotheses: [...source.hypotheses].reverse() },
  [...ledger].reverse(),
);
assert.deepEqual(reversed, diagnostics, 'diagnostics must be invariant to anchor and ledger ordering');

const config = {
  navisUnits: 'mm', jsonUnits: 'mm', tableUnits: 'mm',
  supportCoordinateSource: 'prefer-json-fallback-table',
  navisAnchorTagId: '1', navisAnchorSupportIdentity: '/PS-1',
  navisAnchorTagId2: '2', navisAnchorSupportIdentity2: '/PS-1',
  eastingToleranceMm: 1, northingToleranceMm: 1, elevationToleranceMm: 1,
  ambiguityScoreGap: 15, useOdHalfAlternatives: false,
};
const record = {
  rowId: 'ROW-1', rowIndex: 1, identity: 'PS-1', identityRaw: '/PS-1',
  groupedIdentities: ['PS-1'], groupMemberCount: 1, supportRoot: 'PS-1', inputPipe: '',
  rawRow: { 'Name of the element': '/PS-1' },
};
const tableBuild = { config, records: [record], diagnostics: [] };
const trace = {
  traceId: 'TRACE-1', tableRowId: 'ROW-1', tableRowIndex: 1,
  canonicalIdentity: 'PS-1', tableIdentityRaw: '/PS-1', groupedIdentities: ['PS-1'],
  tableRecord: record, selectedNodeId: 'NODE-1', selectedSourceFile: 'managed.json',
  selectedJsonPath: '$[0]', selectedIdentityPath: 'attributes.NAME',
  position: { x: 100, y: 100, z: 100 }, positionSourcePath: 'attributes.POSI',
  status: 'RESOLVED_EXACT_IDENTITY', resolvedBranch: '', resolvedPipe: '', resolvedZone: '',
};
const identityTrace = { config, rows: [trace], diagnostics: [], summary: { resolvedCount: 1 } };
const tag = (tagId, x, commentBody) => ({
  evidenceId: `VIEW-${tagId}:RL-${tagId}:C-${tagId}`,
  viewIndex: Number(tagId), viewName: `Tag ${tagId}`, viewGuid: `VIEW-${tagId}`,
  tagId, commentId: tagId, commentBody, commentUser: '', commentStatus: '', commentDate: '',
  rawPosition: { x, y: 0, z: 0 }, position: { x, y: 0, z: 0 },
  positionSource: 'RLTAG_POS3D', units: 'mm', diagnostics: [],
});
const navisParse = {
  tags: [tag('1', 0, 'A1'), tag('2', 10, 'A2')],
  diagnostics: [], summary: { tagCount: 2, validTagCount: 2 },
};
const audit = resolveNavisTagIsonotes(tableBuild, identityTrace, navisParse, config);
assert.equal(audit.anchorDiagnostics.authorityEffect, 'NONE');
assert.equal(audit.anchorDiagnostics.summary.validAnchorCount, 2);
assert.equal(audit.anchorDiagnostics.summary.usedAsBestBasisCount, 2);
assert.equal(audit.anchorDiagnostics.summary.maxPairwiseSeparationMm, 10);
assert.equal(audit.summary.anchorUsedAsBestBasisCount, 2);
assert.equal(audit.summary.maxAnchorTranslationSeparationMm, 10);
assert.equal(audit.decisions[0].status, 'AMBIGUOUS', 'diagnostics must not bypass existing comment ambiguity');
assert.ok(audit.diagnostics.some((row) => row.code === 'ANCHOR_CONSISTENCY_SUMMARY' && row.authorityEffect === 'NONE'));

console.log('navis-tag anchor consistency diagnostics tests passed');
