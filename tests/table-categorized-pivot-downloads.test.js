import assert from 'node:assert/strict';

import { buildFieldCatalog } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { exportPivotViewModelArtifacts } from '../xml-compare/table-categorizer/table-categorized-pivot-exporters.js';
import { buildPivotViewModel } from '../xml-compare/table-categorizer/table-categorized-pivot-view-model.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { _test } from '../tabs/xml-compare-table-categorized-runtime.js';

const source = parseTableSource(['PS NO,Rating,Amount', 'PS-100.1,CL150,10', 'PS-101.1,CL150,20'].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });
const fieldCatalog = buildFieldCatalog([source]);
const outputView = {
  schema: 'OutputView.v1', viewId: 'pivot/View 1', type: 'pivot', displayName: 'Pivot View 1', enabled: true,
  pivotSpec: { schema: 'PivotSpec.v1', filters: [], rows: [{ fieldId: 'S1.Rating', label: 'Rating' }], columns: [], values: [{ fieldId: 'S1.Amount', aggregate: 'sum', label: 'Amount sum' }] },
};
const graph = {
  schema: 'CategorizedGraph.v1', nodes: [
    { id: 'n1', fields: { Rating: 'CL150', Amount: '10' }, sourceRefs: ['S1:R1'] },
    { id: 'n2', fields: { Rating: 'CL150', Amount: '20' }, sourceRefs: ['S1:R2'] },
  ], edges: [], documentRootNodeIds: ['n1', 'n2'], diagnostics: [],
};
const beforeView = JSON.stringify(outputView);
const beforeGraph = JSON.stringify(graph);
const vm = buildPivotViewModel({ graph, pivotSpec: outputView.pivotSpec, fieldCatalog });
const expected = exportPivotViewModelArtifacts(vm);

assert.equal(_test.safePivotFileStem('pivot/View 1'), 'pivot_View_1', 'download filename stem is deterministic and safe');
for (const [kind, ext, type] of [['json', 'json', 'application/json'], ['csv', 'csv', 'text/csv'], ['html', 'html', 'text/html']]) {
  const artifact = _test.createPivotDownloadArtifact({ graph, outputView, fieldCatalog, kind });
  assert.equal(artifact.ok, true, `${kind} pivot artifact is downloadable`);
  assert.equal(artifact.name, `pivot_View_1.pivot.${ext}`, `${kind} filename is deterministic from viewId`);
  assert.ok(artifact.type.startsWith(type), `${kind} mime type is correct`);
  assert.equal(artifact.text, expected[kind].text, `${kind} download text uses existing exporter output`);
}
assert.equal(JSON.stringify(outputView), beforeView, 'pivot downloads do not mutate outputView');
assert.equal(JSON.stringify(graph), beforeGraph, 'pivot downloads do not mutate graph');

const missingGraph = _test.createPivotDownloadArtifact({ graph: null, outputView, fieldCatalog, kind: 'json' });
assert.equal(missingGraph.ok, false);
assert.ok(missingGraph.diagnostics.some((item) => item.code === 'pivot_graph_missing'), 'missing graph is guarded');
const missingView = _test.createPivotDownloadArtifact({ graph, outputView: null, fieldCatalog, kind: 'csv' });
assert.equal(missingView.ok, false);
assert.ok(missingView.diagnostics.some((item) => item.code === 'pivot_view_missing'), 'missing active view is guarded');
const invalid = _test.createPivotDownloadArtifact({ graph, outputView: { ...outputView, pivotSpec: { ...outputView.pivotSpec, values: [] } }, fieldCatalog, kind: 'html' });
assert.equal(invalid.ok, false);
assert.ok(invalid.diagnostics.some((item) => item.code === 'pivot_values_missing'), 'invalid pivot spec is guarded');

const profile = { ...createBlankUniversalProfile(), outputViews: [outputView] };
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, exportResult: { ok: true, xmlText: '<CategorizedXML/>', graphJson: '{}', diagnosticsJson: '[]', auditJson: '{}' }, profile, activePivotViewId: outputView.viewId });
assert.ok(html.includes('data-table-categorized-action="download-pivot-json"'), 'pivot JSON download button renders');
assert.ok(html.includes('data-table-categorized-action="download-pivot-csv"'), 'pivot CSV download button renders');
assert.ok(html.includes('data-table-categorized-action="download-pivot-html"'), 'pivot HTML download button renders');

const noGraphHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, profile, activePivotViewId: outputView.viewId });
assert.ok(noGraphHtml.includes('data-table-categorized-action="download-pivot-json" disabled'), 'pivot buttons are disabled when graph is missing');

const baseProfile = { ...createBlankUniversalProfile(), exportPolicy: { includeDiagnosticsElement: false } };
const built = buildCategorizedGraph(baseProfile, [source]);
const beforeXml = exportCategorizedGraphArtifacts({ graph: built, profile: baseProfile, validationResults: [], sources: [source] }).xmlText;
_test.createPivotDownloadArtifact({ graph: built, outputView, fieldCatalog, kind: 'json' });
const afterXml = exportCategorizedGraphArtifacts({ graph: built, profile: baseProfile, validationResults: [], sources: [source] }).xmlText;
assert.equal(afterXml, beforeXml, 'pivot downloads do not alter XML export output');

console.log('table-categorized-pivot-downloads.test.js passed');
