import assert from 'node:assert/strict';

import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

// Verifies the shell exposes dynamic node search, label-field selection, connector mode, and popup review controls.

const html = renderXmlCompareWorkspaceShellHtml({
  source: { records: [], levelView: { fields: ['MATERIAL_NAME'] } },
  target: { records: [], levelView: { fields: ['MATERIAL_NAME'] } },
  compareFields: ['MATERIAL_NAME'],
  matchMap: {
    request: {
      sourceUid: 'source-node-1',
      targetUid: 'target-node-1',
      compareFields: ['MATERIAL_NAME'],
      textRules: { MATERIAL_NAME: { field: 'MATERIAL_NAME', mode: 'contains', direction: 'either-contains' } },
    },
  },
});

assert.match(html, /Find record/);
assert.match(html, /Label by/);
assert.match(html, /data-xml-compare-side-field-picker="source"/);
assert.match(html, /data-xml-compare-action="add-side-compare-field"/);
assert.match(html, /Connection type/);
assert.match(html, /Candidate pairs/);

const stringPopupHtml = renderXmlCompareWorkspaceShellHtml({
  source: { records: [], levelView: { fields: ['materialName'] } },
  target: { records: [], levelView: { fields: ['materialName'] } },
  anchor: { sourceUid: 's0', targetUid: 't0' },
  aim: { connectionType: 'string', basis: 'coordinate', connectorFields: ['materialName'], transferBlocks: ['RestraintsBlock'] },
  availableConnectors: [{ field: 'materialName', label: 'Material name', sourceValue: 'CS', targetValue: 'SS', sameLevel: false }],
  enabledConnectorFields: ['materialName'],
  availableTransferBlocks: ['RestraintsBlock', 'TemperatureBlock'],
  approvedMatchSet: {
    approvedMatches: [{ sourceUid: 's1', targetUid: 't1', matchType: 'candidate-accepted', basis: ['candidate'] }],
    rejectedMatches: [],
    ambiguousMatches: [],
    summary: { approvedCount: 1, rejectedCount: 0, ambiguousCount: 0, blockerCount: 0 },
  },
  candidatePairs: {
    mode: 'text',
    textField: 'materialName',
    textMatchThreshold: 0.6,
    pairs: [{ sourceUid: 's1', targetUid: 't1', sourceLabel: 'S1', targetLabel: 'T1', textField: 'materialName', textSourceValue: 'CS', textTargetValue: 'SS', matchPct: 0.9, status: 'valid' }],
    summary: { pairCount: 1, validCount: 1, reviewCount: 0, conflictCount: 0 },
  },
  compareFields: ['materialName'],
  transferModal: { open: true, activeTab: 'transfer-compare' },
});

assert.match(stringPopupHtml, /Candidate review/);
assert.match(stringPopupHtml, /String field/);
assert.match(stringPopupHtml, /Material name: CS &lt;-&gt; SS/);
assert.match(stringPopupHtml, /APPROVED/);
assert.match(stringPopupHtml, /Candidate pairs<\/b><span>1/);
assert.match(stringPopupHtml, /Transfer summary/);
assert.match(stringPopupHtml, /Output target XML/);
assert.match(stringPopupHtml, /Export patched target XML/);
assert.match(stringPopupHtml, /Transfer workflow/);
assert.equal(stringPopupHtml.includes('xml-compare-graph-connector-canvas'), false, 'connector lane renders counts instead of approved curves');
assert.equal(stringPopupHtml.includes('Coordinate (nearest within tolerance)'), false, 'string popup must not render numeric coordinate controls');
assert.equal(stringPopupHtml.includes('Validation candidates'), false, 'legacy validation panel is not rendered in the popup');

console.log('XML Compare workspace shell tests passed');
