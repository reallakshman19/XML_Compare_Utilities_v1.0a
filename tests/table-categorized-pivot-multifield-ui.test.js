import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildFieldCatalog } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { _test } from '../tabs/xml-compare-table-categorized-runtime.js';

const source = parseTableSource(['PS NO,Rating,Amount,Qty,Desc', 'PS-100.1,CL150,10,2,A', 'PS-101.1,CL150,20,4,B'].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });
const catalog = buildFieldCatalog([source]);
const base = _test.createDefaultPivotOutputView(catalog, []);
let views = [base];
views = _test.updatePivotOutputViews(views, base.viewId, { action: 'add-row' }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { rowFieldId: 'S1.Desc', index: 1 }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { action: 'add-column' }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { columnFieldId: 'S1.Rating', index: 1 }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { action: 'add-value' }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { valueFieldId: 'S1.Qty', index: 1 }, catalog);
views = _test.updatePivotOutputViews(views, base.viewId, { aggregate: 'average', index: 1 }, catalog);

const pivot = views[0];
assert.equal(pivot.pivotSpec.rows.length, 2, 'multiple row fields are preserved');
assert.equal(pivot.pivotSpec.columns.length, 2, 'multiple column fields are preserved');
assert.equal(pivot.pivotSpec.values.length, 2, 'multiple value fields are preserved');
assert.equal(pivot.pivotSpec.values[1].fieldId, 'S1.Qty');
assert.equal(pivot.pivotSpec.values[1].aggregate, 'average', 'aggregate choice is per value field');
assert.equal(_test.updatePivotOutputViews(views, base.viewId, { action: 'remove-row', index: 1 }, catalog)[0].pivotSpec.rows.length, 1, 'row field can be removed');
assert.equal(_test.updatePivotOutputViews(views, base.viewId, { action: 'remove-column', index: 1 }, catalog)[0].pivotSpec.columns.length, 1, 'column field can be removed');
assert.equal(_test.updatePivotOutputViews(views, base.viewId, { action: 'remove-value', index: 1 }, catalog)[0].pivotSpec.values.length, 1, 'value field can be removed');
assert.equal(_test.removePivotOutputView([base, { ...base, viewId: 'pivotView2' }], base.viewId).activePivotViewId, 'pivotView2', 'removing active view selects deterministic remaining view');
assert.equal(_test.removePivotOutputView([base], base.viewId).activePivotViewId, '', 'removing last view clears active view');

const graph = {
  schema: 'CategorizedGraph.v1', nodes: [
    { id: 'n1', fields: { 'PS NO': 'PS-100.1', Rating: 'CL150', Amount: '10', Qty: '2', Desc: 'A' }, sourceRefs: ['S1:R1'] },
    { id: 'n2', fields: { 'PS NO': 'PS-101.1', Rating: 'CL150', Amount: '20', Qty: '4', Desc: 'B' }, sourceRefs: ['S1:R2'] },
  ], edges: [], documentRootNodeIds: ['n1', 'n2'], diagnostics: [],
};
const profile = { ...createBlankUniversalProfile(), outputViews: views };
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, exportResult: { ok: true, xmlText: '<CategorizedXML/>', graphJson: '{}', diagnosticsJson: '[]', auditJson: '{}' }, profile, activePivotViewId: base.viewId });
for (const action of ['add-pivot-row-field', 'remove-pivot-row-field', 'add-pivot-column-field', 'remove-pivot-column-field', 'add-pivot-value-field', 'remove-pivot-value-field', 'remove-pivot-view']) assert.ok(html.includes(`data-table-categorized-action="${action}"`), `${action} renders`);
assert.ok(html.includes('data-pivot-zone="rows"'), 'row zone renders');
assert.ok(html.includes('data-pivot-zone="columns"'), 'column zone renders');
assert.ok(html.includes('data-pivot-zone="values"'), 'value zone renders');
assert.ok(html.includes('data-pivot-preview-schema="PivotViewModel.v1"'), 'preview still uses PivotViewModel exporter');
assert.ok(_test.createPivotDownloadArtifact({ graph, outputView: pivot, fieldCatalog: catalog, kind: 'json' }).ok, 'JSON download still works after multi-field edits');
assert.ok(_test.createPivotDownloadArtifact({ graph, outputView: pivot, fieldCatalog: catalog, kind: 'csv' }).ok, 'CSV download still works after multi-field edits');

const invalidHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'export', activeTab: 'export', sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, profile: { ...profile, outputViews: [{ ...pivot, pivotSpec: { ...pivot.pivotSpec, values: [] } }] }, activePivotViewId: base.viewId });
assert.ok(invalidHtml.includes('data-table-categorized-action="download-pivot-json" disabled'), 'invalid specs still disable downloads');

const baseProfile = { ...createBlankUniversalProfile(), exportPolicy: { includeDiagnosticsElement: false } };
const built = buildCategorizedGraph(baseProfile, [source]);
const beforeXml = exportCategorizedGraphArtifacts({ graph: built, profile: baseProfile, validationResults: [], sources: [source] }).xmlText;
const afterXml = exportCategorizedGraphArtifacts({ graph: built, profile: { ...baseProfile, outputViews: views }, validationResults: [], sources: [source] }).xmlText;
assert.equal(afterXml, beforeXml, 'XML export output remains unchanged by multi-field pivot-only edits');

const decision = fs.readFileSync(new URL('../docs/table-categorized-pivot-xlsx-decision.md', import.meta.url), 'utf8');
assert.ok(decision.includes('No XLSX dependency') && decision.includes('owner approval'), 'XLSX decision gate is documented');

console.log('table-categorized-pivot-multifield-ui.test.js passed');