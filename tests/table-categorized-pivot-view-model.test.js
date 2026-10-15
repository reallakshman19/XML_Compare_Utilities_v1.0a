import assert from 'node:assert/strict';

import { buildFieldCatalog } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { buildPivotViewModel } from '../xml-compare/table-categorizer/table-categorized-pivot-view-model.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const fields = [
  field('S1.Line', 'Line', 'text', 'key'),
  field('S1.Rating', 'Rating', 'text', 'group'),
  field('S1.Active', 'Active', 'boolean', 'attribute'),
  field('S1.Amount', 'Amount', 'number', 'measure'),
  field('S1.Qty', 'Qty', 'number', 'measure'),
  field('S1.Desc', 'Desc', 'text', 'attribute'),
];
const fieldCatalog = Object.freeze({ schema: 'FieldCatalog.v1', sourceIds: Object.freeze(['S1']), fields: Object.freeze(fields), diagnostics: Object.freeze([]) });
const graph = Object.freeze({
  schema: 'CategorizedGraph.v1', profileId: 'pivot-test', sourceIds: Object.freeze(['S1']), edges: Object.freeze([]), documentRootNodeIds: Object.freeze([]), diagnostics: Object.freeze([]),
  nodes: Object.freeze([
    node('n1', { Line: 'L-001', Rating: 'CL150', Active: 'yes', Amount: '10', Qty: '2', Desc: 'A' }, ['S1:R1']),
    node('n2', { Line: 'L-002', Rating: 'CL150', Active: 'yes', Amount: '20', Qty: '3', Desc: 'B' }, ['S1:R2']),
    node('n3', { Line: 'L-003', Rating: 'CL300', Active: 'no', Amount: '5', Qty: '', Desc: 'A' }, ['S1:R3']),
    node('n4', { Line: 'L-004', Rating: 'CL300', Active: 'yes', Amount: 'oops', Qty: '4', Desc: 'A' }, ['S1:R4']),
  ]),
});

const pivotSpec = {
  filters: [{ fieldId: 'S1.Active', equals: 'yes' }],
  rows: [{ fieldId: 'S1.Rating', label: 'Rating' }],
  columns: [{ fieldId: 'S1.Desc', label: 'Description' }],
  values: [
    { fieldId: 'S1.Amount', aggregate: 'sum', label: 'Amount Sum' },
    { fieldId: 'S1.Qty', aggregate: 'average', label: 'Qty Average' },
    { fieldId: 'S1.Line', aggregate: 'countDistinct', label: 'Line Count' },
  ],
};

const model = buildPivotViewModel({ graph, pivotSpec, fieldCatalog });
assert.equal(model.schema, 'PivotViewModel.v1');
assert.equal(model.rowFields[0].fieldId, 'S1.Rating');
assert.equal(model.columnFields[0].fieldId, 'S1.Desc');
assert.equal(model.valueFields.length, 3, 'multiple value fields are supported');
assert.deepEqual(model.columns.map((item) => item.label), ['A', 'B'], 'columns keep first-seen filtered order');
assert.deepEqual(model.rows.map((item) => item.label), ['CL150', 'CL300'], 'rows keep first-seen filtered order');
assert.deepEqual(model.rows[0].cells[0].sourceRefs, ['S1:R1'], 'cell sourceRefs are preserved');
assert.equal(valueAt(model, 'CL150', 'A', 'S1.Amount:sum'), 10);
assert.equal(valueAt(model, 'CL150', 'B', 'S1.Amount:sum'), 20);
assert.equal(valueAt(model, 'CL300', 'A', 'S1.Amount:sum'), 0, 'numeric aggregation ignores non-numeric values');
assert.equal(valueAt(model, 'CL150', 'A', 'S1.Qty:average'), 2);
assert.equal(valueAt(model, 'CL150', 'B', 'S1.Line:countDistinct'), 1);
assert.ok(model.rows[1].cells[0].values[0].diagnostics.some((item) => item.code === 'pivot_numeric_value_invalid'), 'non-numeric numeric aggregate reports diagnostics');
assert.deepEqual(buildPivotViewModel({ graph, pivotSpec, fieldCatalog }), model, 'same input produces identical output');

const aggregateSpec = {
  rows: [], columns: [],
  values: [
    { fieldId: 'S1.Line', aggregate: 'count', label: 'count' },
    { fieldId: 'S1.Line', aggregate: 'countDistinct', label: 'countDistinct' },
    { fieldId: 'S1.Amount', aggregate: 'sum', label: 'sum' },
    { fieldId: 'S1.Amount', aggregate: 'average', label: 'average' },
    { fieldId: 'S1.Amount', aggregate: 'min', label: 'min' },
    { fieldId: 'S1.Amount', aggregate: 'max', label: 'max' },
    { fieldId: 'S1.Desc', aggregate: 'first', label: 'first' },
    { fieldId: 'S1.Desc', aggregate: 'last', label: 'last' },
    { fieldId: 'S1.Desc', aggregate: 'list', label: 'list' },
    { fieldId: 'S1.Desc', aggregate: 'listDistinct', label: 'listDistinct' },
  ],
};
const aggregateModel = buildPivotViewModel({ graph, pivotSpec: aggregateSpec, fieldCatalog });
assert.deepEqual(aggregateModel.totals.grand.map((item) => item.value), [4, 4, 35, 35 / 3, 5, 20, 'A', 'A', ['A', 'B', 'A', 'A'], ['A', 'B']]);

const filtered = buildPivotViewModel({ graph, pivotSpec: { ...aggregateSpec, filters: [{ fieldId: 'S1.Rating', values: ['CL150'] }] }, fieldCatalog });
assert.equal(filtered.totals.grand[0].value, 2, 'filters affect included records deterministically');

const invalid = buildPivotViewModel({ graph: null, pivotSpec: null, fieldCatalog: null });
assert.ok(invalid.diagnostics.some((item) => item.code === 'pivot_graph_missing'));
assert.ok(invalid.diagnostics.some((item) => item.code === 'pivot_spec_missing'));
assert.ok(invalid.diagnostics.some((item) => item.code === 'pivot_field_catalog_missing'));

const source = parseTableSource(['Line ID,Rating,Length', 'L-001,CL150,1200', 'L-002,CL150,700'].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });
const catalog = buildFieldCatalog([source]);
const profile = { ...createBlankUniversalProfile(), exportPolicy: { includeDiagnosticsElement: false } };
const beforeGraph = buildCategorizedGraph(profile, [source]);
const beforeXml = exportCategorizedGraphArtifacts({ graph: beforeGraph, profile, validationResults: [], sources: [source] }).xmlText;
const graphSnapshot = JSON.stringify(beforeGraph);
const xmlSnapshot = beforeXml;
buildPivotViewModel({ graph: beforeGraph, pivotSpec: { values: [{ fieldId: catalog.fields[0].fieldId, aggregate: 'count', label: 'Count' }] }, fieldCatalog: catalog });
assert.equal(JSON.stringify(beforeGraph), graphSnapshot, 'pivot builder does not mutate graph output');
assert.equal(exportCategorizedGraphArtifacts({ graph: beforeGraph, profile, validationResults: [], sources: [source] }).xmlText, xmlSnapshot, 'pivot builder does not change XML output');

function field(fieldId, header, type, role) { return Object.freeze({ fieldId, sourceId: 'S1', columnId: header, header, label: header, type, role, unit: '', sampleValues: Object.freeze([]), uniqueCount: 0, blankCount: 0, rowCount: 4, resolver: Object.freeze({ op: 'trim', sourceId: 'S1', column: header }), diagnostics: Object.freeze([]) }); }
function node(id, raw, sourceRefs) { return Object.freeze({ id, key: raw.Line, displayName: raw.Line, fields: Object.freeze({ ...raw }), evidence: Object.freeze([{ rawByHeader: Object.freeze({ ...raw }), rawByColumnId: Object.freeze({ ...raw }) }]), sourceRefs: Object.freeze(sourceRefs) }); }
function valueAt(vm, rowLabel, columnLabel, valueId) { return vm.rows.find((row) => row.label === rowLabel).cells.find((cell) => vm.columns.find((col) => col.columnKey === cell.columnKey).label === columnLabel).values.find((item) => item.valueId === valueId).value; }

console.log('table-categorized-pivot-view-model.test.js passed');
