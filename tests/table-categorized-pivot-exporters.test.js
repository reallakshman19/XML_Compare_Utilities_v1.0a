import assert from 'node:assert/strict';

import { exportPivotViewModelArtifacts, exportPivotViewModelCsv, exportPivotViewModelHtmlPreview, exportPivotViewModelJson, validatePivotViewModel } from '../xml-compare/table-categorizer/table-categorized-pivot-exporters.js';

const viewModel = Object.freeze({
  schema: 'PivotViewModel.v1',
  rowFields: Object.freeze([{ fieldId: 'S1.Rating', label: 'Rating' }]),
  columnFields: Object.freeze([{ fieldId: 'S1.Desc', label: 'Description' }]),
  valueFields: Object.freeze([
    { valueId: 'S1.Amount:sum', fieldId: 'S1.Amount', aggregate: 'sum', label: 'Amount <Sum>' },
    { valueId: 'S1.Line:countDistinct', fieldId: 'S1.Line', aggregate: 'countDistinct', label: 'Line Count' },
  ]),
  columns: Object.freeze([
    { columnKey: 'A', label: 'A <script>alert(1)</script>', values: Object.freeze(['A']) },
    { columnKey: 'B', label: 'B "quoted"', values: Object.freeze(['B']) },
  ]),
  rows: Object.freeze([
    row('CL150', 'CL150', [['S1:R1'], [10, 1], ['S1:R2'], [20, 1]]),
    row('CL300', 'CL300', [['S1:R3'], [5, 1], [], [0, 0]]),
  ]),
  totals: Object.freeze({
    grand: Object.freeze([value('S1.Amount:sum', 35), value('S1.Line:countDistinct', 3)]),
    rows: Object.freeze([
      { rowKey: 'CL150', values: Object.freeze([value('S1.Amount:sum', 30), value('S1.Line:countDistinct', 2)]) },
      { rowKey: 'CL300', values: Object.freeze([value('S1.Amount:sum', 5), value('S1.Line:countDistinct', 1)]) },
    ]),
    columns: Object.freeze([
      { columnKey: 'A', values: Object.freeze([value('S1.Amount:sum', 15), value('S1.Line:countDistinct', 2)]) },
      { columnKey: 'B', values: Object.freeze([value('S1.Amount:sum', 20), value('S1.Line:countDistinct', 1)]) },
    ]),
  }),
  diagnostics: Object.freeze([]),
});
const before = JSON.stringify(viewModel);

const json = exportPivotViewModelJson(viewModel);
assert.equal(json.ok, true);
assert.equal(json.text, exportPivotViewModelJson(viewModel).text, 'JSON export is deterministic');
assert.ok(json.text.indexOf('"schema"') < json.text.indexOf('"rowFields"'), 'JSON key order is stable');
const parsed = JSON.parse(json.text);
assert.deepEqual(parsed.rows[0].cells[0].sourceRefs, ['S1:R1'], 'sourceRefs are preserved in JSON');
assert.equal(parsed.totals.grand[0].value, 35, 'grand totals are represented in JSON');

const csv = exportPivotViewModelCsv(viewModel);
assert.equal(csv.ok, true);
const lines = csv.text.trimEnd().split('\n');
assert.equal(lines[0], 'Row,A <script>alert(1)</script> | Amount <Sum>,A <script>alert(1)</script> | Line Count,"B ""quoted"" | Amount <Sum>","B ""quoted"" | Line Count",A <script>alert(1)</script> | SourceRefs,"B ""quoted"" | SourceRefs",Row Total | Amount <Sum>,Row Total | Line Count');
assert.equal(lines[1], 'CL150,10,1,20,1,S1:R1,S1:R2,30,2');
assert.equal(lines.find((line) => line.startsWith('Column Total | A')), 'Column Total | A <script>alert(1)</script>,15,2,,,,,,');
assert.equal(lines.find((line) => line.startsWith('Grand Total')), 'Grand Total,,,,,,,35,3');
assert.equal(csv.text, exportPivotViewModelCsv(viewModel).text, 'CSV export is deterministic');

const html = exportPivotViewModelHtmlPreview(viewModel);
assert.equal(html.ok, true);
assert.ok(html.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'HTML preview escapes unsafe text');
assert.equal(html.text.includes('<script>'), false, 'HTML preview does not emit executable script tags');
assert.equal(/\son[a-z]+=/i.test(html.text), false, 'HTML preview does not emit event handler attributes');
assert.ok(html.text.includes('Row Total | Amount &lt;Sum&gt;'), 'row total headers are represented in HTML');
assert.ok(html.text.includes('Grand Total'), 'grand totals are represented in HTML');

const artifacts = exportPivotViewModelArtifacts(viewModel);
assert.equal(artifacts.json.text, json.text);
assert.equal(artifacts.csv.text, csv.text);
assert.equal(artifacts.html.text, html.text);
assert.equal(JSON.stringify(viewModel), before, 'exporting does not mutate PivotViewModel');

const missing = exportPivotViewModelJson(null);
assert.equal(missing.ok, false);
assert.ok(missing.diagnostics.some((item) => item.code === 'pivot_view_model_missing'));
const invalid = validatePivotViewModel({ schema: 'Bad', rows: {}, columns: [], valueFields: [] });
assert.ok(invalid.some((item) => item.code === 'pivot_view_model_schema_invalid'));
assert.ok(invalid.some((item) => item.code === 'pivot_view_model_shape_invalid'));

function row(rowKey, label, pairs) {
  return Object.freeze({ rowKey, label, values: Object.freeze([label]), cells: Object.freeze([cell('A', pairs[0], pairs[1]), cell('B', pairs[2], pairs[3])]) });
}
function cell(columnKey, sourceRefs, values) {
  return Object.freeze({ columnKey, sourceRefs: Object.freeze(sourceRefs), values: Object.freeze([value('S1.Amount:sum', values[0]), value('S1.Line:countDistinct', values[1])]) });
}
function value(valueId, raw) {
  return Object.freeze({ valueId, fieldId: valueId.split(':')[0], aggregate: valueId.split(':')[1], value: raw, diagnostics: Object.freeze([]) });
}

console.log('table-categorized-pivot-exporters.test.js passed');
