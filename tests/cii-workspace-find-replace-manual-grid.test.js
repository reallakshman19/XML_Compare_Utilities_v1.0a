import assert from 'node:assert/strict';
import test from 'node:test';

import { _test } from '../tabs/cii-workspace/cii-workspace-find-replace-ui.js';

const {
  isManualGridRowEmpty,
  normalizeGridBlock,
  parseSpreadsheetPaste,
  visibleGridFields,
} = _test;

test('Excel clipboard tab/newline matrix is preserved for rectangular paste', () => {
  assert.deepEqual(parseSpreadsheetPaste('10\t20\tNODE NAME\tOLD\tNEW\t1\r\n30\t40\tDISPLACEMENT\tA\tB\t2\r\n'), [
    ['10', '20', 'NODE NAME', 'OLD', 'NEW', '1'],
    ['30', '40', 'DISPLACEMENT', 'A', 'B', '2'],
  ]);
});

test('spreadsheet visible columns follow Find & Replace scope without changing contract order', () => {
  assert.deepEqual(visibleGridFields('DOCUMENT'), ['findText', 'replaceText', 'expectedMatches']);
  assert.deepEqual(visibleGridFields('ELEMENT'), ['from', 'to', 'findText', 'replaceText', 'expectedMatches']);
  assert.deepEqual(visibleGridFields('BLOCK'), ['from', 'to', 'block', 'findText', 'replaceText', 'expectedMatches']);
});

test('spreadsheet block aliases normalize while FORCE remains a visible blocked value', () => {
  assert.equal(normalizeGridBlock('Node Name'), 'NODENAME');
  assert.equal(normalizeGridBlock('node_name'), 'NODENAME');
  assert.equal(normalizeGridBlock('DISPLMNT'), 'DISPLACEMENT');
  assert.equal(normalizeGridBlock('FORCMNT'), 'FORCE');
});

test('default block selector alone does not make a blank spreadsheet row operational', () => {
  assert.equal(isManualGridRowEmpty({ block: 'NODENAME' }, 'BLOCK'), true);
  assert.equal(isManualGridRowEmpty({ block: 'NODENAME', findText: 'A' }, 'BLOCK'), false);
});
