import assert from 'node:assert/strict';
import fs from 'node:fs';
import './xml-compare-linewise-workflow-native.test.js';

import { renderXmlCompareTabView } from '../xml-compare/XmlCompareTabView.js';
import { _test as toolbarGateTest } from '../tabs/xml-compare-linewise-toolbar-gate.js';
import { _test as samplePickerTest } from '../tabs/xml-compare-enriched-sample-pickers.js';
import { installXmlCompareCategorizedConverterRuntime } from '../tabs/xml-compare-categorized-converter-runtime.js';

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
  linewiseWorkflow: {},
  sideload: {},
  enrichmentConfig: {},
};
const side = { records: [], levelView: { fields: [] }, diagnostics: [], logs: [] };
const workspace = { source: side, target: side, navStates: {}, manualConnectors: [], matchMap: null, connectorCandidates: null, compareFields: [], logs: [], diagnostics: [] };
const html = renderXmlCompareTabView({ state, workspace, issues: [] });

assert.equal(html.includes('input type="file" data-xml-compare-load="a"'), true, 'Source A native file input is rendered');
assert.equal(html.includes('input type="file" data-xml-compare-load="b"'), true, 'Target B native file input is rendered');
assert.equal(html.includes('data-xml-compare-categorized-open'), true, 'native Line-wise toolbar button is rendered');
assert.equal(html.includes('Line-wise XML Enrichment / Categorized XML'), true, 'native Line-wise toolbar label is preserved');
assert.equal(html.includes('Enrichment Config'), true, 'Enrichment Config remains visible');
assert.equal(html.includes('Download Input Readiness JSON'), true, 'input readiness button remains visible');
assert.equal(html.includes('Download Readiness Gate JSON'), true, 'readiness gate button remains visible');

const gateSource = fs.readFileSync(new URL('../tabs/xml-compare-linewise-toolbar-gate.js', import.meta.url), 'utf8');
const converterSource = fs.readFileSync(new URL('../tabs/xml-compare-categorized-converter-runtime.js', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../xml-compare/XmlCompareWorkspaceShell.js', import.meta.url), 'utf8');

assert.equal(toolbarGateTest.toolbarStyleCss(), '', 'toolbar gate no longer injects style');
assert.equal(toolbarGateTest.installXmlCompareLinewiseToolbarGate(), false, 'toolbar gate installer is inert');
assert.equal(toolbarGateTest.clickShortcut(), false, 'toolbar gate no longer owns shortcut routing');
assert.equal(toolbarGateTest.getToolbarObserver(), null, 'toolbar gate has no observer');
assert.equal(gateSource.includes('addEventListener'), false, 'toolbar gate has no document listener');
assert.equal(gateSource.includes('MutationObserver'), false, 'toolbar gate has no mutation observer');
assert.equal(gateSource.includes('createElement'), false, 'toolbar gate has no style injection path');
assert.equal(/installXmlCompareLinewiseToolbarGate\(\);/.test(gateSource), false, 'toolbar gate has no auto-install call');

assert.equal(installXmlCompareCategorizedConverterRuntime(), false, 'converter runtime is inert');
assert.equal(converterSource.includes('addEventListener'), false, 'converter no longer owns workflow listeners');
assert.equal(converterSource.includes('insertAdjacentHTML'), false, 'converter no longer injects popup DOM');
assert.equal(converterSource.includes('document.body'), false, 'converter no longer injects into body');
assert.equal(converterSource.includes('DataTransfer'), false, 'converter no longer uses synthetic Source/Target file handoff');
assert.equal(converterSource.includes('MutationObserver'), false, 'converter no longer observes toolbar mutations');
assert.equal(shellSource.includes('xml-compare-categorized-converter-runtime.js'), false, 'workspace shell no longer lazy-loads converter runtime');
assert.equal(shellSource.includes('loadCategorizedConverter'), false, 'workspace shell no longer tracks converter loader');

assert.equal(samplePickerTest.pickerHtml(), '', 'sample picker has no hidden direct-load UI');
assert.equal(samplePickerTest.installXmlCompareEnrichedSamplePickers(), false, 'empty sample picker installs no listeners');
const sampleSource = fs.readFileSync(new URL('../tabs/xml-compare-enriched-sample-pickers.js', import.meta.url), 'utf8');
assert.equal(sampleSource.includes('input[data-xml-compare-load]'), false, 'sample picker must not watch native Source/Target inputs');
assert.equal(sampleSource.includes('stopImmediatePropagation'), false, 'sample picker must not stop native file input propagation');
assert.equal(sampleSource.includes('DataTransfer'), false, 'sample picker must not fake native file input handoff');

console.log('XML Compare native line-wise workflow routing regression tests passed');
