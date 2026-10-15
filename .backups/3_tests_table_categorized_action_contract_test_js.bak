import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { createTableCategorizedStepStatus, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { createMultiSourceState, parseSourceDraft, updateSourceDraft, updateSourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-manager.js';

const runtimeSource = fs.readFileSync(new URL('../tabs/xml-compare-table-categorized-runtime.js', import.meta.url), 'utf8');
const controllerSource = fs.readFileSync(new URL('../xml-compare/table-categorizer/table-categorized-xml-controller.js', import.meta.url), 'utf8');

const handledActions = new Set([
  'add-source', 'remove-source', 'clear', 'load-sample', 'load-field-comparison-sample', 'load-coordinate-sample', 'load-two-source-template', 'parse',
  'confirm-columns', 'add-derived-column', 'preview-derived-column', 'remove-derived-column',
  'select-level', 'add-child-level', 'remove-level', 'load-suggested-profile', 'build-graph',
  'assign-field-key', 'assign-field-display', 'add-field-resolver', 'create-child-from-field',
  'add-pivot-view', 'select-pivot-view', 'remove-pivot-view',
  'add-pivot-row-field', 'remove-pivot-row-field', 'add-pivot-column-field', 'remove-pivot-column-field',
  'add-pivot-value-field', 'remove-pivot-value-field', 'add-pivot-filter', 'remove-pivot-filter',
  'download-pivot-json', 'download-pivot-csv', 'download-pivot-html',
  'use-current-graph-source-canvas', 'use-imported-graph-target-canvas', 'run-graph-compare-canvas',
  'build-graph-connectors', 'download-graph-connectors-json', 'clear-compare-canvas-preview',
  'send-source', 'send-target', 'confirm-canvas-handoff', 'cancel-canvas-handoff',
]);
const handledDownloads = new Set(['xml', 'graph', 'profile', 'diagnostics', 'audit']);
const dynamicPivotActions = new Set(['download-pivot-json', 'download-pivot-csv', 'download-pivot-html']);

function buttonTags(html, attr) {
  const pattern = new RegExp(`<button\\b[^>]*${attr}="([^"]+)"[^>]*>`, 'g');
  return [...html.matchAll(pattern)].map((match) => ({ value: match[1], tag: match[0], disabled: /\sdisabled\b/.test(match[0]) || /aria-disabled="true"/.test(match[0]) }));
}
function activeValues(rows) { return [...new Set(rows.filter((row) => !row.disabled).map((row) => row.value))].sort(); }
function sourceRow(rawByHeader, index = 1) { return { rowId: `S1:R${index}`, rawCells: Object.values(rawByHeader), rawByHeader, rawByColumnId: { ...rawByHeader } }; }
function parsedSource(transformRules = []) {
  return {
    sourceId: 'S1', sourceName: 'PS sample', sourceType: 'pasteText', delimiterMode: 'tab', customDelimiter: '',
    headers: ['PS NO', 'Bore', 'Mandatory'], columnIds: ['PS NO', 'Bore', 'Mandatory'],
    rows: [sourceRow({ 'PS NO': 'PS-100.1', Bore: '100', Mandatory: 'yes' })],
    diagnostics: [], transformRules,
  };
}
function pivotProfile() {
  return { ...PS_MAPPING_TABLE_2_SHADOW_PROFILE, outputViews: [{ schema: 'OutputView.v1', viewId: 'pivotView1', type: 'pivot', displayName: 'Pivot View 1', enabled: true, pivotSpec: { schema: 'PivotSpec.v1', filters: [{ fieldId: 'S1.Mandatory', equals: 'yes' }], rows: [{ fieldId: 'S1.PS_NO', label: 'PS NO' }], columns: [], values: [{ fieldId: 'S1.Bore', aggregate: 'sum', label: 'Bore sum' }] } }] };
}
function readyState(activeStep = 'columns', patch = {}) {
  return { activeStep, activeTab: stepToTab(activeStep), sources: [parsedSource(patch.transformRules || [])], activeSourceId: 'S1', columnsConfirmed: true, profile: PS_MAPPING_TABLE_2_SHADOW_PROFILE, profileValidation: [], graph: null, validationResults: [], exportResult: null, exportStatus: '', compareCanvas: {}, ...patch };
}
function stepToTab(step) { return { table: 'source', columns: 'levels', structure: 'graph', preview: 'validation', export: 'export' }[step] || 'source'; }
function representativeStates() {
  const transformRules = [{ ruleId: 'trim-ps', newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }];
  const graph = { nodes: [{ id: 'n1', fields: { 'PS NO': 'PS-100.1', Bore: '100', Mandatory: 'yes' }, sourceRefs: ['S1:R1'] }], edges: [], documentRootNodeIds: ['n1'] };
  const exportResult = { ok: true, xmlText: '<CategorizedXML/>', graphJson: '{}', diagnosticsJson: '[]', auditJson: '{}' };
  const pendingHandoff = { summary: { targetCanvas: 'source', xmlRoot: 'CategorizedXML', byteCount: 18, lineCount: 1, origin: 'Table Categorized', warning: 'Review before sending.' } };
  return [
    readyState('table', { columnsConfirmed: false }),
    readyState('columns', { columnsConfirmed: false, transformRules }),
    readyState('structure'),
    readyState('preview', { graph, validationResults: [] }),
    readyState('export', { graph, exportResult, pendingHandoff, profile: pivotProfile(), activePivotViewId: 'pivotView1' }),
  ];
}

const renderedHtml = representativeStates().map(renderTableCategorizedXmlShellHtml).join('\n');
const activeActions = activeValues(buttonTags(renderedHtml, 'data-table-categorized-action'));
const activeDownloads = activeValues(buttonTags(renderedHtml, 'data-table-categorized-download'));

assert.ok(activeActions.length > 0, 'representative shell states render active actions');
for (const action of activeActions) assert.ok(handledActions.has(action), `rendered action must be handled or intentionally disabled: ${action}`);
for (const action of handledActions) {
  if (dynamicPivotActions.has(action)) assert.ok(runtimeSource.includes('download-pivot-'), `runtime source must contain dynamic pivot download handler evidence for ${action}`);
  else assert.ok(runtimeSource.includes(action), `runtime source must contain handler evidence for ${action}`);
}
for (const kind of activeDownloads) assert.ok(handledDownloads.has(kind), `rendered download must be handled: ${kind}`);
for (const kind of handledDownloads) assert.ok(runtimeSource.includes(`kind==='${kind}'`) || runtimeSource.includes(`kind === '${kind}'`), `runtime source must contain download evidence for ${kind}`);

assert.ok(activeActions.includes('confirm-columns'), 'confirm-columns is rendered active after rows exist');
assert.ok(activeActions.includes('add-derived-column'), 'add-derived-column is rendered active');
assert.ok(activeActions.includes('remove-derived-column'), 'remove-derived-column is rendered active when a rule exists');
assert.ok(activeActions.includes('load-field-comparison-sample'), 'field-comparison sample loader is rendered and handled');
assert.ok(activeActions.includes('load-suggested-profile'), 'load-suggested-profile is rendered active with headers');
assert.ok(activeActions.includes('select-level'), 'recipe tree level selection action is rendered and handled');
assert.ok(activeActions.includes('assign-field-key'), 'guided key assignment action is rendered and handled');
assert.ok(activeActions.includes('assign-field-display'), 'guided display assignment action is rendered and handled');
assert.ok(activeActions.includes('add-field-resolver'), 'guided XML field resolver action is rendered and handled');
assert.ok(activeActions.includes('create-child-from-field'), 'guided child-level creation action is rendered and handled');
assert.ok(activeActions.includes('add-pivot-view'), 'add-pivot-view is rendered and handled');
assert.ok(activeActions.includes('select-pivot-view'), 'select-pivot-view is rendered and handled');
assert.ok(activeActions.includes('remove-pivot-view'), 'remove-pivot-view is rendered and handled');
assert.ok(activeActions.includes('add-pivot-row-field'), 'add row field action is rendered and handled');
assert.ok(activeActions.includes('add-pivot-column-field'), 'add column field action is rendered and handled');
assert.ok(activeActions.includes('add-pivot-value-field'), 'add value field action is rendered and handled');
assert.ok(activeActions.includes('add-pivot-filter'), 'add filter action is rendered and handled');
assert.ok(activeActions.includes('remove-pivot-filter'), 'remove filter action is rendered and handled');
assert.ok(activeActions.includes('download-pivot-json'), 'download-pivot-json is rendered and handled');
assert.ok(activeActions.includes('download-pivot-csv'), 'download-pivot-csv is rendered and handled');
assert.ok(activeActions.includes('download-pivot-html'), 'download-pivot-html is rendered and handled');
assert.ok(activeActions.includes('send-source') && activeActions.includes('send-target'), 'canvas handoff send actions are active only when export is ready');
assert.equal(activeActions.includes('check-output'), false, 'Check Output is a step transition, not an unhandled action');
assert.equal(activeActions.includes('toggle-fullscreen'), false, 'Fullscreen is not rendered as an unhandled runtime action');

assert.equal(createTableCategorizedStepStatus({ sources: [parsedSource()], columnsConfirmed: false }).structure, 'locked');
assert.equal(createTableCategorizedStepStatus({ sources: [parsedSource()], columnsConfirmed: true }).structure, 'ready');
assert.equal(createTableCategorizedStepStatus({ sources: [], columnsConfirmed: true }).structure, 'locked');

let state = createMultiSourceState();
state = updateSourceDraft(state, 'S1', { sourceText: 'PS NO\tBore\nPS-100.1\t100', delimiterMode: 'tab' });
state = updateSourceTransformRules(state, 'S1', [{ newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }]);
state = parseSourceDraft(state, 'S1');
assert.ok(state.sources[0].headers.includes('PS_NO_Trimmed'), 'source manager applies derived-column transform while parsing');
assert.equal(state.sources[0].rows[0].rawByHeader.PS_NO_Trimmed, 'PS-100');

assert.ok(runtimeSource.includes('parseSourceDraft'), 'active runtime imports/uses source manager parseSourceDraft');
assert.equal(runtimeSource.includes('parseTableSource'), false, 'active runtime does not use direct parseTableSource path');
assert.equal(runtimeSource.includes('table-categorized-xml-controller'), false, 'active runtime does not import legacy controller');
assert.ok(controllerSource.includes('parseTableSource'), 'legacy controller direct parser remains isolated from active runtime path');

console.log('table-categorized-action-contract.test.js passed');
