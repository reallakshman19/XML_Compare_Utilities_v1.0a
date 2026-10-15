import assert from 'node:assert/strict';

import { renderXmlCompareGraphConnectorLaneHtml, _test } from '../xml-compare/XmlCompareGraphConnectorLane.js';

const manualState = {
  connectors: [{ id: 'approved-1', status: 'approved', sourceUid: 'S1', targetUid: 'T1' }],
  pendingConnectorPreview: { sourceUid: 'S2', targetUid: 'T2', basis: ['selection'], confidence: 0.8 },
  approvedMatchSet: { summary: { approvedCount: 1 } },
};
const matchMap = { request: { scope: 'node' }, matches: [{ id: 'auto-1', type: 'EXACT', sourceUid: 'S3', targetUid: 'T3' }] };
const connectorCandidates = { summary: { enabled: true }, candidates: [{ id: 'candidate-1', sourceUid: 'S4', targetUid: 'T4', sourceLabel: 'S4', targetLabel: 'T4' }] };
const html = renderXmlCompareGraphConnectorLaneHtml({ manualState, matchMap, connectorCandidates });

assert.equal(html.includes('auto-map-node'), false, 'Auto Map node action must not render');
assert.equal(html.includes('auto-map-line'), false, 'Auto Map line action must not render');
assert.equal(html.includes('clear-auto-map'), false, 'Clear Auto action must not render');
assert.equal(html.includes('Auto Map'), false, 'Auto Map label must not render');
assert.equal(html.includes('No preview candidates at the selected levels/fields.'), false, 'old candidate-empty text must not render');
assert.equal(html.includes('data-xml-compare-candidate-row'), false, 'automatic candidate rows must not render');
assert.equal(html.includes('auto-1'), false, 'auto connector line must not render');
assert.equal(html.includes('candidate-1'), false, 'candidate connector line must not render');
assert.equal(html.includes('approved-1'), false, 'approved connector curves must not render');
assert.equal(html.includes('xml-compare-graph-connector-canvas'), false, 'connector canvas must not render');
assert.equal(html.includes('Total approved'), true, 'approval count summary renders');
assert.equal(html.includes('<span>1</span>'), true, 'approved manual count renders');
assert.equal(html.includes('Approve Link'), true, 'manual approval action remains available');
assert.equal(html.includes('Selection previews a connector only. Use Approve Link to create MatchDecision.v1 / ApprovedMatchSet.v1.'), false);
assert.equal(_test.allConnectors([{ id: 'm1' }], [{ id: 'a1' }], [{ id: 'c1' }]).length, 1, 'connector aggregation remains manual-only');

console.log('XML Compare manual-only connector lane tests passed');
