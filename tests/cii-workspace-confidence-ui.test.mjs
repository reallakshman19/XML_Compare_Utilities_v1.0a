import assert from 'node:assert/strict';
import { ciiMultiSourceReviewMarkup } from '../tabs/cii-workspace/cii-workspace-multisource-review-ui.js';
import { _test as anchorUi } from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';

const preview = { compareReview: { rows: [{
  correspondenceId: 'ms1', memberCorrespondenceId: 'm1', sourceId: 'S1', kind: 'ELEMENT', confidence: 'HIGH', workflowStatus: 'HIGH', decision: 'REVIEW',
  identityBound: true, source: 'E1', target: 'E2', changeCount: 0, changeFamilies: [],
  methodA: { available: false, pass: false, registrationStatus: 'UNDERDETERMINED', registrationReason: 'ONE_ANCHOR_CANNOT_ESTABLISH_ROTATION' },
  methodB: { available: true, pass: true, score: 91.4, threshold: 55 },
  od: { available: true, confidence: 'HIGH', percentError: 4.7 },
  nodeName: { available: true, match: true, kind: 'CANONICAL', matchRatio: 1, matchedEndpointCount: 2, availableEndpointCount: 2 },
  corroborationBand: { level: 4, label: 'DEEP_GREEN', score: 2.9, max: 3 }, identityReasons: [],
}] } };
const markup = ciiMultiSourceReviewMarkup(preview, new Map());
assert.match(markup, /Evidence basis/);
assert.match(markup, /DEEP_GREEN/);
assert.match(markup, /NAME CANONICAL 2\/2/);
assert.match(markup, /OD HIGH 4\.7%/);
assert.match(markup, /M1 N\/A UNDERDETERMINED/);
assert.match(markup, /HIGH: M1 registration is underdetermined; M2 \+ OD &lt;10% \+ Node Name corroboration agree\./);

const inspection = { memberInspections: [{ sourceId: 'S1', inspection: { baseAnchorSuggestions: [{
  sourceNodeId: '3870', targetNodeId: '870', confidence: 'REVIEW', basisMethod: 'LANDMARK_ONLY',
  methodA: { status: 'UNAVAILABLE', reason: 'NO_QUALIFIED_NON_COLLINEAR_BASE' },
  methodB: { status: 'UNRESOLVED', source: { independentAxisRunCount: 1, runs: [{ axisLabel: 'Z', totalLengthMm: 63564, terminatorClasses: ['END'] }] }, target: { independentAxisRunCount: 1, runs: [{ axisLabel: 'Z', totalLengthMm: 63564, terminatorClasses: ['END'] }] } },
  nodeNameEvidence: { available: true, match: true, kind: 'CANONICAL', sourceRaw: 'SL097.19', targetRaw: 'SL-097/DATUM', canonicalKey: 'SL-97', matchRatio: 1 },
  odConfidence: { available: true, confidence: 'HIGH', percentError: 0, source: 273, target: 273 },
  corroborationBand: { level: 3, label: 'GREEN', score: 2.4, max: 3 },
  candidateGeneration: { reviewDiscovery: { sourceAxisCount: 1, targetAxisCount: 1, sourceLengthMm: 63564, targetLengthMm: 63564, lengthDeltaMm: 0, toleranceMm: 546, oneAxisCompatible: true, sourceNodeName: 'SL097.19', targetNodeName: 'SL-097/DATUM', canonicalKey: 'SL-97', nodeNameEvidence: { available: true, kind: 'CANONICAL' } } },
}] } }] };
const anchorMarkup = anchorUi.proposalRationaleMarkup(inspection);
assert.match(anchorMarkup, /Evidence band/);
assert.match(anchorMarkup, /CANONICAL/);
assert.match(anchorMarkup, /SL097\.19/);
assert.match(anchorMarkup, /SL-097\/DATUM/);
assert.match(anchorMarkup, /OD band/);
assert.match(anchorMarkup, /automatic Method B requires at least 2\/2/);

console.log('CII confidence evidence UI checks: PASS');
