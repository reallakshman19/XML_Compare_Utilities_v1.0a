import assert from 'node:assert/strict';
import { _test } from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';
const inspection = { memberInspections: [{ sourceId: 'S1', inspection: { baseAnchorSuggestions: [{ sourceNodeId: '3870', targetNodeId: '870', basisMethod: 'LANDMARK_ONLY', confidence: 'REVIEW', candidateGeneration: { reviewDiscovery: { nodeName: 'SL-097.19', sourceAxisCount: 1, targetAxisCount: 1, sourceLengthMm: 63564, targetLengthMm: 63564, lengthDeltaMm: 0, toleranceMm: 546, oneAxisCompatible: true } }, methodB: { source: { independentAxisRunCount: 1, runs: [{ axisLabel: 'Z' }] }, target: { independentAxisRunCount: 1, runs: [{ axisLabel: 'Z' }] } } }] } }] };
const markup = _test.proposalRationaleMarkup(inspection);
for (const token of ['Anchor proposal rationale', '3870 ↔ 870', 'SL-097.19', 'exact unique existing name', 'Z 63564 mm', 'Δ 0 mm', 'tol 546 mm', 'REVIEW · 1/1 axes; automatic Method B requires at least 2/2']) assert.ok(markup.includes(token), token);
assert.ok(!markup.includes('Structural candidate score'));
console.log('CII Writer2 multi-source concise proposal rationale: PASS');
