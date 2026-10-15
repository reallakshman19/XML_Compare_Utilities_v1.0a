import assert from 'node:assert/strict';

import { buildFieldCatalog, fieldIdFor, inferFieldType, resolverForField } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const source = parseTableSource([
  'Line ID,Rating,Length,Mandatory,Remarks,Blankish',
  'L-001,CL150,1200mm,yes,ok,',
  'L-002,CL150,999.5mm,no,review,',
  'L-003,CL300,-10mm,yes,hold,x',
].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });

const transformed = applySourceTransformRules(source, [{
  ruleId: 'derive-rating-copy',
  newColumn: 'Rating_Copy',
  sourceColumn: 'Rating',
  operation: 'copy',
}]);

const catalog = buildFieldCatalog([transformed]);
assert.equal(catalog.schema, 'FieldCatalog.v1');
assert.deepEqual(catalog.sourceIds, ['S1']);
assert.equal(catalog.fields.length, transformed.headers.length);

const secondCatalog = buildFieldCatalog([transformed]);
assert.deepEqual(catalog.fields.map((field) => field.fieldId), secondCatalog.fields.map((field) => field.fieldId));
assert.equal(fieldIdFor('S1', 'Line_ID'), 'S1.Line_ID');

const line = catalog.fields.find((field) => field.header === 'Line ID');
assert.equal(line.fieldId, 'S1.Line_ID');
assert.equal(line.type, 'text');
assert.equal(line.role, 'key');
assert.deepEqual(line.resolver, { op: 'trim', sourceId: 'S1', column: 'Line_ID' });
assert.deepEqual(line.sampleValues, ['L-001', 'L-002', 'L-003']);
assert.equal(line.uniqueCount, 3);
assert.equal(line.blankCount, 0);
assert.equal(line.rowCount, 3);

const length = catalog.fields.find((field) => field.header === 'Length');
assert.equal(length.type, 'number');
assert.equal(length.role, 'measure');
assert.equal(length.unit, 'mm');
assert.deepEqual(length.resolver, { op: 'numberParser', sourceId: 'S1', column: 'Length' });

const mandatory = catalog.fields.find((field) => field.header === 'Mandatory');
assert.equal(mandatory.type, 'boolean');
assert.equal(mandatory.role, 'attribute');
assert.deepEqual(mandatory.resolver, { op: 'booleanParser', sourceId: 'S1', column: 'Mandatory' });

const rating = catalog.fields.find((field) => field.header === 'Rating');
assert.equal(rating.type, 'text');
assert.equal(rating.role, 'group');
assert.equal(rating.uniqueCount, 2);

const derived = catalog.fields.find((field) => field.header === 'Rating_Copy');
assert.equal(derived.kind, 'derived');
assert.equal(derived.sourceColumn, 'Rating');
assert.equal(derived.transformRuleId, 'derive-rating-copy');
assert.deepEqual(derived.resolver, { op: 'trim', sourceId: 'S1', column: 'Rating_Copy' });

const blankish = catalog.fields.find((field) => field.header === 'Blankish');
assert.equal(blankish.blankCount, 2);
assert.ok(blankish.diagnostics.some((item) => item.code === 'field_blank_heavy'));

const mixed = inferFieldType(['12', 'abc', '13']);
assert.equal(mixed.type, 'text');
assert.ok(mixed.diagnostics.some((item) => item.code === 'field_mixed_numeric_text'));
assert.equal(inferFieldType(['yes', 'no', 'Y']).type, 'boolean');
assert.equal(inferFieldType(['100', '200.5']).type, 'number');
assert.deepEqual(resolverForField({ type: 'number', sourceId: 'S1', columnId: 'Length' }), { op: 'numberParser', sourceId: 'S1', column: 'Length' });

const html = renderTableCategorizedXmlShellHtml({ activeStep: 'columns', activeTab: 'levels', sources: [transformed], activeSourceId: 'S1', columnsConfirmed: false });
assert.ok(html.includes('Column Catalog'));
assert.ok(html.includes('data-table-categorized-field-catalog="FieldCatalog.v1"'));
assert.ok(html.includes('S1.Line_ID'));
assert.ok(html.includes('number'));
assert.ok(html.includes('measure'));
assert.ok(html.includes('Rating Copy'));
assert.ok(html.includes('CL150'));
assert.ok(html.includes('<th>Unique</th>'));
assert.ok(html.includes('<th>Blank</th>'));
assert.ok(html.includes('data-table-categorized-action="confirm-columns"'));

console.log('table-categorized-field-catalog.test.js passed');
