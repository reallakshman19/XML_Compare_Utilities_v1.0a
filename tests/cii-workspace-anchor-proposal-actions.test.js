import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ciiAnchorProposalActionCommand,
  ciiAnchorProposalKey,
} from '../tabs/cii-workspace/cii-workspace-anchor-proposal-actions.js';
import { _test as ledgerTest } from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';

const pair = { sourceId: 'S1', sourceNodeId: '3910', targetNodeId: '875' };
assert.equal(ciiAnchorProposalKey('S1', '3910', '875'), 'S1|3910=>875');
assert.deepEqual(ciiAnchorProposalActionCommand('inspect', pair), {
  action: 'INSPECT', proposalKey: 'S1|3910=>875', prefill: true, addReviewedAnchor: false, reject: false,
});
assert.deepEqual(ciiAnchorProposalActionCommand('approve', pair, { approved: false, rejected: true }), {
  action: 'APPROVE', proposalKey: 'S1|3910=>875', prefill: true, addReviewedAnchor: true, reject: false, clearRejection: true,
});
assert.equal(ciiAnchorProposalActionCommand('approve', pair, { approved: true }).addReviewedAnchor, false, 'duplicate approval must not add a second manual authority row');
assert.equal(ciiAnchorProposalActionCommand('reject', pair, { approved: false }).reject, true);
assert.equal(ciiAnchorProposalActionCommand('reject', pair, { approved: true }).reject, false, 'Reject must not silently remove an already USER LOCKED authority row');

const oneAxisSuggestion = {
  sourceNodeId: 3910,
  targetNodeId: 875,
  basisMethod: 'LANDMARK_ONLY',
  confidence: 'REVIEW',
  corroborationBand: { level: 2, label: 'GREEN', score: 2.5, max: 3 },
  candidateGeneration: {
    reviewDiscovery: {
      oneAxisCompatible: true,
      sourceAxisCount: 1,
      targetAxisCount: 1,
      sourceLengthMm: 100,
      targetLengthMm: 100,
      lengthDeltaMm: 0,
      toleranceMm: 2,
      sourceNodeName: 'SL-098.7',
      targetNodeName: 'SL-098.7',
      canonicalKey: 'SL-98',
      nodeNameEvidence: { available: true, kind: 'EXACT', sourceRaw: 'SL-098.7', targetRaw: 'SL-098.7' },
      odConfidence: { available: true, confidence: 'HIGH', percentError: 0, source: 100, target: 100 },
    },
  },
  methodB: {
    status: 'READY',
    source: { independentAxisRunCount: 1, runs: [{ axisLabel: 'X' }] },
    target: { independentAxisRunCount: 1, runs: [{ axisLabel: 'X' }] },
  },
};
const inspection = {
  sourceSet: { sourceSetSha256: 'source-set-sha' },
  memberInspections: [{ sourceId: 'S1', fileName: 'S1.CII', inspection: { baseAnchorSuggestions: [oneAxisSuggestion] } }],
};
const pendingRows = ledgerTest.proposalRationaleRows(inspection, new Map());
assert.equal(pendingRows.length, 1);
assert.equal(pendingRows[0].approved, false);
assert.match(pendingRows[0].authority, /automatic Method B requires at least 2\/2/);

const manualBySource = new Map([['S1', [{ sourceNodeId: '3910', targetNodeId: '875' }]]]);
const approvedRows = ledgerTest.proposalRationaleRows(inspection, manualBySource);
assert.equal(approvedRows[0].approved, true);
const markup = ledgerTest.proposalRationaleMarkup(inspection, manualBySource);
assert.match(markup, /Approve anchor/);
assert.match(markup, />Inspect</);
assert.match(markup, />Reject</);
assert.match(markup, /APPROVED · USER LOCKED/);
assert.match(markup, /automatic Method B requires at least 2\/2/);
assert.match(markup, /data-ciiw-ms-proposal-key="S1\|3910=&gt;875"|data-ciiw-ms-proposal-key="S1\|3910=>875"/);

const counts = ledgerTest.summary({ memberInspections: [{ sourceId: 'S1' }] }, [
  { sourceId: 'S1', authority: 'USER LOCKED' },
  { sourceId: 'S1', authority: 'METHOD A', selectionKey: 'base-1', sourceNodeId: '1', targetNodeId: '10' },
  { sourceId: 'S1', authority: 'METHOD A', selectionKey: 'base-1', sourceNodeId: '2', targetNodeId: '20' },
]);
assert.equal(counts.manualCount, 1);
assert.equal(counts.automaticBaseCount, 1, 'selected base count must not equal expanded anchor-pair count');
assert.equal(counts.automaticPairCount, 2);

// Static integration falsifier: proposal approval must route through the already-governed
// manual-add control rather than introducing another authority store.
const runtimeSource = readFileSync(new URL('../tabs/cii-workspace/cii-workspace-anchor-proposal-actions.js', import.meta.url), 'utf8');
const writerUiSource = readFileSync(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url), 'utf8');
assert.match(runtimeSource, /querySelector\('\[data-ciiw-ms-manual-add\]'\)\?\.click\(\)/);
assert.match(writerUiSource, /data-ciiw-ms-manual-add/);
assert.match(writerUiSource, /manualBySource\.set\(id, pairs\)/);
assert.match(writerUiSource, /selectedBySource\.set\(id, new Set\(\)\)/);

console.log('CII anchor proposal action contract checks: PASS');
