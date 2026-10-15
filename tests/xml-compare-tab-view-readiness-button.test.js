import assert from 'node:assert/strict';
import './xml-compare-load-diagnostics-panel.test.js';
import './xml-compare-linewise-info-rule-native.test.js';

import { renderXmlCompareTabView } from '../xml-compare/XmlCompareTabView.js';
import { _test as toolbarGateTest } from '../tabs/xml-compare-linewise-toolbar-gate.js';

const state = {
  fileA: null,
  fileB: null,
  textA: '',
  textB: '',
  report: null,
  filters: { severity: 'ALL', search: '' },
  selectedIssueId: '',
  hiddenComponentIds: new Set(),
  status: { kind: 'info', message: 'Ready.' },
  loadDiagnostics: {},
  sideload: {},
  enrichmentConfig: {},
};
const side = { records: [], levelView: { fields: [] }, diagnostics: [], logs: [] };
const workspace = {
  source: side,
  target: side,
  navStates: {},
  manualConnectors: [],
  matchMap: null,
  connectorCandidates: null,
  compareFields: [],
  logs: [],
  diagnostics: [],
};

const html = renderXmlCompareTabView({ state, workspace, issues: [] });
const css = toolbarGateTest.toolbarStyleCss();
const readinessMatches = html.match(/data-xml-compare-action="download-input-readiness-json"/g) || [];
const gateMatches = html.match(/data-xml-compare-action="download-readiness-gate-json"/g) || [];

assert.equal(readinessMatches.length, 1);
assert.equal(gateMatches.length, 1);
assert.equal(html.includes('Download Input Readiness JSON'), true);
assert.equal(html.includes('Download Readiness Gate JSON'), true);
assert.equal(html.includes('data-xml-compare-action="compare"'), true);
assert.equal(html.includes('data-xml-compare-action="export-filtered-csv"'), true);
assert.equal(html.includes('Load Diagnostics'), true, 'native Load Diagnostics panel is rendered');
assert.equal(html.includes('data-xml-compare-action="clear-load-diagnostics"'), true, 'clear diagnostics action is rendered');
assert.equal(html.includes('data-xml-compare-categorized-open'), true, 'native Line-wise workflow button is rendered');
assert.equal(html.includes('Line-wise XML Enrichment / Categorized XML'), true, 'native Line-wise workflow label is rendered');

assert.equal(html.includes('input type="file" data-xml-compare-load="a"'), true, 'Source A native file input is rendered');
assert.equal(html.includes('input type="file" data-xml-compare-load="b"'), true, 'Target B native file input is rendered');
assert.equal(html.includes('Sideload Source A'), true, 'Sideload Source A remains visible');
assert.equal(html.includes('Sideload Target B'), true, 'Sideload Target B remains visible');
assert.equal(html.includes('Enrichment Config'), true, 'Enrichment Config remains visible');
assert.equal(html.includes('Topology check'), true, 'Topology Check remains visible');
assert.equal(html.includes('clip-path:inset'), false, 'rendered tab does not include hidden-control CSS');
assert.equal(css.includes('xml-compare-file-btn'), false, 'toolbar gate CSS does not target native file labels');
assert.equal(css.includes('button:not'), false, 'toolbar gate CSS does not hide native toolbar buttons');
assert.equal(css.includes('pointer-events:none'), false, 'toolbar gate CSS does not disable native controls');

console.log('XML compare tab view readiness, diagnostics, linewise info, native linewise toolbar, and toolbar visibility tests passed');
