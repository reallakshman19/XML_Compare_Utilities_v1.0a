import assert from 'node:assert/strict';

import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import {
  createColumnContractFromSource,
  createConfirmedFieldCatalog,
  confirmColumnContract,
  updateColumnContractField,
  validateColumnContract,
} from '../xml-compare/table-categorizer/table-categorized-column-contract.js';

const source = applySourceTransformRules(
  parseTableSource(['PS NO	Rating	Length	Remarks', 'PS-100.1	CL150	1200mm	', 'PS-100.1	CL300	bad	check'].join('\n'), { sourceId: 'S1', delimiterMode: 'tab' }),
  [{ ruleId: 'trim-ps', newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }],
);

const contract = createColumnContractFromSource(source);
assert.equal(contract.schema, 'ColumnContract.v1');
assert.equal(contract.sourceId, 'S1');
assert.ok(contract.columns.some((column) => column.originalHeader === 'PS NO' && column.role === 'key'));
assert.ok(contract.columns.some((column) => column.originalHeader === 'Length' && column.type === 'text'), 'mixed number/text remains text until user overrides');
assert.ok(contract.derivedColumns.some((rule) => rule.fieldName === 'PS_NO_Trimmed'));

const psColumnId = contract.columns.find((column) => column.originalHeader === 'PS NO').columnId;
let renamed = updateColumnContractField(contract, psColumnId, { fieldName: 'psNo', label: 'PS No', role: 'join-key', duplicatePolicy: 'block' });
let diagnostics = validateColumnContract(renamed, source);
assert.ok(diagnostics.some((item) => item.code === 'column_duplicate_key_blocked'), 'duplicate join key blocks when duplicate policy is block');

renamed = updateColumnContractField(renamed, psColumnId, { duplicatePolicy: 'warn' });
diagnostics = validateColumnContract(renamed, source);
assert.ok(diagnostics.some((item) => item.code === 'column_duplicate_key_values' && item.severity === 'WARNING'));
assert.ok(!diagnostics.some((item) => item.code === 'column_duplicate_key_blocked'));

const ratingColumnId = contract.columns.find((column) => column.originalHeader === 'Rating').columnId;
const duplicateName = updateColumnContractField(renamed, ratingColumnId, { fieldName: 'psNo' });
assert.ok(validateColumnContract(duplicateName, source).some((item) => item.code === 'column_field_name_duplicate'));

const badName = updateColumnContractField(renamed, ratingColumnId, { fieldName: 'Bad Name' });
assert.ok(validateColumnContract(badName, source).some((item) => item.code === 'column_field_name_invalid'));

const remarksColumnId = contract.columns.find((column) => column.originalHeader === 'Remarks').columnId;
const disabledRemarks = updateColumnContractField(renamed, remarksColumnId, { enabled: false, role: 'ignore', emitDefault: 'none' });
const confirmed = confirmColumnContract(disabledRemarks, source);
assert.equal(confirmed.confirmed, true, 'warnings do not block confirmation');

const confirmedCatalog = createConfirmedFieldCatalog(source, confirmed);
assert.ok(confirmedCatalog.fields.some((field) => field.fieldId === 'S1.psNo' && field.role === 'join-key'));
assert.equal(confirmedCatalog.fields.some((field) => field.header === 'Remarks'), false, 'disabled fields are not available to recipe builder catalog');
assert.equal(confirmedCatalog.fields.find((field) => field.fieldId === 'S1.psNo').resolver.column, psColumnId, 'renamed field still resolves from original parser column id');

const lengthColumnId = contract.columns.find((column) => column.originalHeader === 'Length').columnId;
const forcedNumber = updateColumnContractField(contract, lengthColumnId, { fieldName: 'length', type: 'number', role: 'measure' });
assert.ok(validateColumnContract(forcedNumber, source).some((item) => item.code === 'column_number_parse_failed'), 'user-forced numeric type validates actual values');

const missingSourceContract = {
  ...contract,
  columns: contract.columns.map((column) => column.originalHeader === 'Rating' ? { ...column, sourceColumnId: 'MissingRating', originalHeader: 'MissingRating' } : column),
};
assert.ok(validateColumnContract(missingSourceContract, source).some((item) => item.code === 'column_source_missing'));

const missingDerivedSource = {
  ...contract,
  derivedColumns: contract.derivedColumns.map((rule) => rule.ruleId === 'trim-ps' ? { ...rule, sourceColumn: 'Missing PS' } : rule),
};
assert.ok(validateColumnContract(missingDerivedSource, source).some((item) => item.code === 'derived_column_source_missing'));

console.log('table-categorized-column-contract.test.js passed');
