import assert from 'node:assert/strict';

import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import { createColumnContractFromSource, updateColumnContractField } from '../xml-compare/table-categorizer/table-categorized-column-contract.js';
import { renderColumnContractBuilderHtml, selectedColumnForContract } from '../xml-compare/table-categorizer/table-categorized-column-contract-ui.js';

const source = applySourceTransformRules(
  parseTableSource(['PS NO	Rating	Length	Remarks', 'PS-100.1	CL150	1200mm	', 'PS-100.2	CL150	850mm	ok'].join('\n'), { sourceId: 'S1', delimiterMode: 'tab' }),
  [{ ruleId: 'trim-ps', newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }],
);

let contract = createColumnContractFromSource(source);
const psColumnId = contract.columns.find((column) => column.originalHeader === 'PS NO').columnId;
contract = updateColumnContractField(contract, psColumnId, { fieldName: 'psNo', label: 'PS No', role: 'join-key', duplicatePolicy: 'warn' });

const html = renderColumnContractBuilderHtml({ source, contract, selectedColumnId: psColumnId });

for (const marker of [
  'Column Contract Builder',
  'Review detected columns, rename fields, set roles/types',
  'data-table-categorized-column-contract="ColumnContract.v1"',
  'data-table-categorized-column-contract-ui="ColumnContractUi.v1"',
  'data-column-contract-grid="true"',
  'data-column-contract-selected-panel',
  'data-column-contract-diagnostics',
  'data-column-contract-field="enabled"',
  'data-column-contract-field="fieldName"',
  'data-column-contract-field="label"',
  'data-column-contract-field="type"',
  'data-column-contract-field="role"',
  'data-column-contract-field="unit"',
  'data-column-contract-field="blankPolicy"',
  'data-column-contract-field="duplicatePolicy"',
  'data-column-contract-field="emitDefault"',
  'data-table-categorized-action="select-column-contract-column"',
  'data-table-categorized-action="confirm-column-contract"',
  'Confirm Column Contract',
  'Derived Columns',
  'PS_NO_Trimmed',
  'PS No',
  'psNo',
  'join-key',
  'PS-100.1',
]) {
  assert.ok(html.includes(marker), `missing ${marker}`);
}

assert.equal(selectedColumnForContract(contract, psColumnId).fieldName, 'psNo');
assert.equal(selectedColumnForContract(contract, 'missing').columnId, contract.columns[0].columnId, 'missing selection falls back to first contract column');

const lengthColumnId = contract.columns.find((column) => column.originalHeader === 'Length').columnId;
const lengthHtml = renderColumnContractBuilderHtml({ source, contract, selectedColumnId: lengthColumnId });
assert.ok(lengthHtml.includes('1200mm'), 'selected Length column shows length sample values');

const ratingColumnId = contract.columns.find((column) => column.originalHeader === 'Rating').columnId;
const duplicate = updateColumnContractField(contract, ratingColumnId, { fieldName: 'psNo' });
const duplicateHtml = renderColumnContractBuilderHtml({ source, contract: duplicate, selectedColumnId: ratingColumnId });
assert.ok(duplicateHtml.includes('column_field_name_duplicate'));
assert.ok(duplicateHtml.includes('blocker(s) must be fixed before confirming'));
assert.ok(duplicateHtml.includes('disabled') && duplicateHtml.includes('Confirm Column Contract'));

const confirmedHtml = renderColumnContractBuilderHtml({ source, contract, selectedColumnId: psColumnId, columnsConfirmed: true });
assert.ok(confirmedHtml.includes('Column contract confirmed.'));

console.log('table-categorized-column-contract-ui.test.js passed');
