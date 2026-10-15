import assert from 'node:assert/strict';

import { buildFieldCatalog } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { _test } from '../tabs/xml-compare-table-categorized-runtime.js';

const source = parseTableSource(['PS NO,Rating,Amount,Desc', 'PS-100.1,CL150,10,<script>alert(1)</script>', 'PS-101.1,CL300,20,Safe'].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });
const catalog = buildFieldCatalog([source]);
const pivot = _test.createDefaultPivotOutputView(catalog, []);
assert.equal(pivot.schema, 'OutputView.v1');
assert.equal(pivot.type, 'pivot');
assert.equal(pivot.viewId, 'pivotView1');
assert.ok(pivot.pivotSpec.values.length, 'default pivot view has value field');

const updated = _test.updatePivotOutputViews([pivot], 'pivotView1', { rowFieldId: 'S1.Rating' }, catalog);
const updated2 = _test.updatePivotOutputViews(updated, 'pivotView1', { columnFieldId: 'S1.Desc' }, catalog);
const updated3 = _test.updatePivotOutputViews(updated2, 'pivotView1', { valueFieldId: 'S1.Amount' }, catalog);
const updated4 = _test.updatePivotOutputViews(updated3, 'pivotView1', { aggregate: 'average' }, catalog);
assert.deepEqual(updated4[0].pivotSpec.rows, [{ fieldId: 'S1.Rating', label: 'Rating' }]);
assert.deepEqual(updated4[0].pivotSpec.columns, [{ fieldId: 'S1.Desc', label: 'Desc' }]);
assert.equal(updated4[0].pivotSpec.values[0].fieldId, 'S1.Amount');
assert.equal(updated4[0].pivotSpec.values[0].aggregate, 'average');
assert.deepEqual(_test.updatePivotOutputViews([pivot], 'pivotView1', { rowFieldId: 'S1.Rating' }, catalog), updated, 'pivot edits are deterministic');

const graph = {
  schema: 'CategorizedGraph.v1', nodes: [
    { id: 'n1', fields: { Rating: 'CL150', Amount: '10', Desc: '<script>alert(1)</script>' }, sourceRefs: ['S1:R1'] },
    { id: 'n2', fields: { Rating: 'CL300', Amount: '20', Desc: 'Safe' }, sourceRefs: ['S1:R2'] },
  ], edges: [], documentRootNodeIds: ['n1', 'n2'], diagnostics: [],
};
const profile = { ...createBlankUniversalProfile(), outputViews: updated4 };
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, exportResult: { ok: true, xmlText: '<CategorizedXML/>', graphJson: '{}', diagnosticsJson: '[]', auditJson: '{}' }, profile, activePivotViewId: 'pivotView1' });
assert.ok(html.includes('data-table-categorized-pivot-designer'), 'Pivot Designer shell renders');
assert.ok(html.includes('data-table-categorized-action="add-pivot-view"'), 'add-pivot-view action is rendered');
assert.ok(html.includes('data-table-categorized-action="select-pivot-view"'), 'active pivot view selection is rendered');
assert.ok(html.includes('data-pivot-field="displayName"'), 'display name control is rendered');
assert.ok(html.includes('data-pivot-field="enabled"'), 'enabled flag control is rendered');
assert.ok(html.includes('data-pivot-field="rowFieldId"'), 'row selector is rendered');
assert.ok(html.includes('data-pivot-field="columnFieldId"'), 'column selector is rendered');
assert.ok(html.includes('data-pivot-field="valueFieldId"'), 'value selector is rendered');
assert.ok(html.includes('data-pivot-field="aggregate"'), 'aggregate selector is rendered');
assert.ok(html.includes('S1.Rating') && html.includes('S1.Amount'), 'FieldCatalog field IDs populate selectors');
assert.ok(html.includes('data-pivot-preview-schema="PivotViewModel.v1"'), 'preview uses PivotViewModel safe HTML exporter');
assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'preview HTML escapes unsafe pivot text');
assert.equal(html.includes('<script>'), false, 'preview does not render executable script tag');
assert.ok(html.includes('data-pivot-download-controls'), 'Pivot download control area renders');
assert.ok(html.includes('data-table-categorized-action="download-pivot-json"'), 'Pivot JSON download button renders');
assert.ok(html.includes('data-table-categorized-action="download-pivot-csv"'), 'Pivot CSV download button renders');
assert.ok(html.includes('data-table-categorized-action="download-pivot-html"'), 'Pivot HTML download button renders');
assert.ok(html.includes('Active view status'), 'Pivot active view status is visible');

const invalid = { ...profile, outputViews: [{ ...updated4[0], pivotSpec: { ...updated4[0].pivotSpec, values: [] } }] };
const invalidHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, profile: invalid, activePivotViewId: 'pivotView1' });
assert.ok(invalidHtml.includes('Enabled pivot view requires at least one value field'), 'invalid pivot spec shows diagnostics without throwing');
assert.ok(invalidHtml.includes('data-table-categorized-action="download-pivot-json" disabled'), 'invalid pivot spec disables guarded downloads');

const baseProfile = { ...createBlankUniversalProfile(), exportPolicy: { includeDiagnosticsElement: false } };
const pivotOnlyProfile = { ...baseProfile, outputViews: updated4 };
const built = buildCategorizedGraph(baseProfile, [source]);
const beforeXml = exportCategorizedGraphArtifacts({ graph: built, profile: baseProfile, validationResults: [], sources: [source] }).xmlText;
const afterXml = exportCategorizedGraphArtifacts({ graph: built, profile: pivotOnlyProfile, validationResults: [], sources: [source] }).xmlText;
assert.equal(afterXml, beforeXml, 'XML export output remains unchanged by pivot-only outputViews edits');

console.log('table-categorized-pivot-designer-ui.test.js passed');
