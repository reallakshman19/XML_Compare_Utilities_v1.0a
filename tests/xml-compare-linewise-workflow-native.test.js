import assert from 'node:assert/strict';
import fs from 'node:fs';

import { renderXmlCompareTabView } from '../xml-compare/XmlCompareTabView.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';
import { applyLinewiseAction, applyLinewiseSideload, importLinewiseText, linewiseCategorizedCanvasPayload, previewText, regexSandboxResult } from '../xml-compare/XmlCompareLinewiseWorkflowActions.js';
import { createLinewiseWorkflowState } from '../xml-compare/XmlCompareLinewiseWorkflowState.js';
import { renderLinewiseWorkflowPopupHtml } from '../xml-compare/XmlCompareLinewiseWorkflowView.js';
import { installXmlCompareCategorizedConverterRuntime } from '../tabs/xml-compare-categorized-converter-runtime.js';
import { _test as tabTest } from '../tabs/xml-compare-tab.js';

const xml = '<ROOT><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="/PS-UNIT-12345-AA/B1" DELTA_X="100" DELTA_Y="0" DELTA_Z="0"><BEND /></PIPINGELEMENT><RESTRAINT NODE="10" TYPE="GUIDE" STIFFNESS="1" GAP="0" MU="0" CNODE="0" /></ROOT>';
const baseState = { fileA: null, fileB: null, textA: '', textB: '', report: null, filters: { severity: 'ALL', search: '' }, selectedIssueId: '', hiddenComponentIds: new Set(), status: { kind: 'info', message: 'Ready.' }, loadDiagnostics: {}, linewiseWorkflow: createLinewiseWorkflowState(), sideload: {}, enrichmentConfig: {} };
const side = { records: [], levelView: { fields: [] }, diagnostics: [], logs: [] };
const workspace = { source: side, target: side, navStates: {}, manualConnectors: [], matchMap: null, connectorCandidates: null, compareFields: [], logs: [], diagnostics: [] };
const tabHtml = renderXmlCompareTabView({ state: baseState, workspace, issues: [] });
assert.ok(tabHtml.includes('data-xml-compare-categorized-open'), 'native tab view renders Line-wise toolbar button');
assert.equal(tabHtml.includes('data-xml-compare-categorized-popup'), false, 'popup is closed by default');

function sideForConnector(sideName) {
  return {
    fileName: `${sideName}.xml`,
    profile: 'CategorizedInputXML',
    records: [{ uid: `${sideName}-node-10`, displayName: `${sideName} node 10`, nodeNumber: '10', lineNo: 'L1' }],
    summary: { nodeCount: 1, recordCount: 1 },
    levelView: {
      levelId: 'line',
      label: 'Line',
      fields: ['lineNo', 'nodeName'],
      displayField: 'nodeName',
      hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }, { levelId: 'node', label: 'Node', recordCount: 1 }] },
    },
  };
}
function assertHierarchyControls(html, context) {
  assert.ok(html.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'), `${context}: Source hierarchy dropdown remains rendered`);
  assert.ok(html.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'), `${context}: Target hierarchy dropdown remains rendered`);
  assert.ok(html.includes('data-xml-compare-main-connector'), `${context}: main connector selector remains rendered`);
}
const connectorWorkspace = {
  source: sideForConnector('source'),
  target: sideForConnector('target'),
  navStates: { source: { selectedUid: 'source-node-10' }, target: { selectedUid: 'target-node-10' } },
  selectedRecords: { source: { uid: 'source-node-10', displayName: 'source node 10' }, target: { uid: 'target-node-10', displayName: 'target node 10' } },
  anchor: { sourceUid: 'source-node-10', targetUid: 'target-node-10' },
  availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1', sameLevel: false }],
  enabledConnectorFields: ['lineNo'],
  aim: { connectionType: 'numeric', connectorFields: ['lineNo'] },
  compareFields: ['lineNo'],
  manualConnectors: [],
};
assertHierarchyControls(renderXmlCompareWorkspaceShellHtml(connectorWorkspace), 'before topology check');
assertHierarchyControls(renderXmlCompareWorkspaceShellHtml({ ...connectorWorkspace, reportRecordCount: 2, diagnostics: [{ code: 'REPORT-EVIDENCE' }] }), 'after topology evidence');

let wf = createLinewiseWorkflowState();
wf = applyLinewiseAction(wf, { type: 'open-linewise-workflow' });
assert.equal(wf.open, true, 'open action opens native workflow state');
const openPopupHtml = renderLinewiseWorkflowPopupHtml(wf);
assert.ok(openPopupHtml.includes('data-xml-compare-categorized-popup'));
assert.ok(openPopupHtml.includes('xml-compare-categorized-backdrop-close'), 'modal has a backdrop close layer');
assert.ok(openPopupHtml.includes('aria-label="Close Line-wise XML Enrichment dialog"'), 'backdrop close has an accessible label');
assert.ok(openPopupHtml.includes('position:relative;z-index:1'), 'dialog is layered above backdrop close button');
wf = applyLinewiseAction(wf, { type: 'close-linewise-workflow' });
assert.equal(wf.open, false, 'close action closes native workflow state');

wf = importLinewiseText({ fileName: 'input.xml', text: xml });
assert.equal(wf.open, true);
assert.equal(wf.model.lineCount, 1);
assert.equal(wf.model.elementCount, 1);
assert.ok(renderLinewiseWorkflowPopupHtml(wf).includes('Parsed model'), 'import render shows parsed model panel');

wf = applyLinewiseAction(wf, { type: 'set-linewise-tab', tab: 'lineview' });
assert.equal(wf.tab, 'lineview');
wf = applyLinewiseAction(wf, { type: 'set-linewise-line-index', index: 0 });
wf = applyLinewiseAction(wf, { type: 'set-linewise-element-index', index: 0 });
assert.ok(renderLinewiseWorkflowPopupHtml(wf).includes('Selected element'), 'line/element selection renders selected details');

wf = applyLinewiseAction(wf, { type: 'set-linewise-sideload-field', field: 'lineIdText', value: 'FROM_NODE\tTO_NODE\tLINE_ID\n10\t20\t/NEW-LINE-99999/B1' });
assert.ok(wf.sideload.lineIdText.includes('99999'));
wf = applyLinewiseSideload(wf);
assert.ok(wf.lastSideloadReport, 'sideload rebuild records report object');
const regexResult = regexSandboxResult(wf);
assert.notEqual(regexResult.sample, '', 'regex sandbox uses imported line IDs');
assert.notEqual(regexResult.sample, '/AG-FG-10001-A1A/B1', 'regex sandbox does not use a hard-coded sample');

wf = applyLinewiseAction(wf, { type: 'set-linewise-preview-mode', previewMode: 'categorized' });
assert.ok(previewText(wf).length > 0, 'categorized preview is available');
wf = applyLinewiseAction(wf, { type: 'set-linewise-preview-mode', previewMode: 'input' });
assert.ok(previewText(wf).length > 0, 'input preview is available');
wf = applyLinewiseAction(wf, { type: 'set-linewise-preview-mode', previewMode: 'element' });
assert.ok(previewText(wf).length > 0, 'selected element preview is available');

wf = applyLinewiseAction(wf, { type: 'open-linewise-info-rule' });
assert.equal(wf.infoRuleOpen, true);
assert.ok(renderLinewiseWorkflowPopupHtml(wf).includes('Line-wise XML ownership rule'));
wf = applyLinewiseAction(wf, { type: 'close-linewise-info-rule' });
assert.equal(wf.infoRuleOpen, false);

const nativeState = tabTest.createInitialState();
const payloadA = linewiseCategorizedCanvasPayload(importLinewiseText({ fileName: 'native.xml', text: xml }), 'a');
tabTest.storeTextAsLoaded(payloadA.side, payloadA.fileName, payloadA.text, nativeState);
assert.equal(nativeState.fileA.name, 'native_categorized_enriched.xml');
assert.ok(nativeState.textA.length > 0);
assert.equal(nativeState.report, null);
assert.ok(nativeState.workspaceRevision > 0);
const payloadB = linewiseCategorizedCanvasPayload(importLinewiseText({ fileName: 'native.xml', text: xml }), 'b');
tabTest.storeTextAsLoaded(payloadB.side, payloadB.fileName, payloadB.text, nativeState);
assert.equal(nativeState.fileB.name, 'native_categorized_enriched.xml');
assert.ok(nativeState.textB.length > 0);

const runtimeSource = fs.readFileSync(new URL('../tabs/xml-compare-categorized-converter-runtime.js', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../xml-compare/XmlCompareWorkspaceShell.js', import.meta.url), 'utf8');
assert.equal(installXmlCompareCategorizedConverterRuntime(), false, 'old converter runtime is inert');
assert.equal(runtimeSource.includes('addEventListener'), false, 'converter runtime has no document listener');
assert.equal(runtimeSource.includes('insertAdjacentHTML'), false, 'converter runtime has no DOM popup injection');
assert.equal(runtimeSource.includes('document.body'), false, 'converter runtime has no body injection');
assert.equal(runtimeSource.includes('MutationObserver'), false, 'converter runtime has no mutation observer');
assert.equal(runtimeSource.includes('DataTransfer'), false, 'converter runtime has no synthetic file handoff');
assert.equal(/installXmlCompareCategorizedConverterRuntime\(\);/.test(runtimeSource), false, 'converter runtime has no auto-install call');
assert.equal(shellSource.includes('xml-compare-categorized-converter-runtime.js'), false, 'workspace shell no longer lazy-loads converter runtime');
assert.equal(shellSource.includes('loadCategorizedConverter'), false, 'workspace shell no longer tracks converter loader');

console.log('XML Compare native Line-wise workflow tests passed');
