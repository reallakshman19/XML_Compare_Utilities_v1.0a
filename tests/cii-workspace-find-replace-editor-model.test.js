import assert from 'node:assert/strict';
import test from 'node:test';
import { createFindReplaceOperation } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';
import {
  analyzeFindReplaceEditorRows,
  editorFieldsForMode,
  findReplaceRowsToTsv,
  normalizeFindReplaceReplacement,
  parseFindReplaceSpreadsheetPaste,
} from '../tabs/cii-workspace/cii-workspace-find-replace-editor-model.js';

test('slash-list replacement uses only the first text token', () => {
  assert.deepEqual(normalizeFindReplaceReplacement('/SL-101.6'), {
    raw: '/SL-101.6', effective: 'SL-101.6', normalized: true, rule: 'FIRST_SLASH_TOKEN', valid: true,
  });
  assert.equal(normalizeFindReplaceReplacement('/SL-104.8, /X6').effective, 'SL-104.8');
  assert.equal(normalizeFindReplaceReplacement('/SL-121.5, /SL-121.2, /SL-121.11').effective, 'SL-121.5');
  assert.equal(normalizeFindReplaceReplacement('/SL-123.7, /unset-, /SL-123.8').effective, 'SL-123.7');
  assert.equal(normalizeFindReplaceReplacement('SL-101.6').effective, 'SL-101.6');
  assert.equal(normalizeFindReplaceReplacement('/').valid, false);
});

test('Excel paste and copy use TSV rows with Find and raw Replace first', () => {
  assert.deepEqual(parseFindReplaceSpreadsheetPaste('PS1\t/SL-1\r\nPS2\t/SL-2\r\n'), [
    ['PS1', '/SL-1'], ['PS2', '/SL-2'],
  ]);
  assert.equal(findReplaceRowsToTsv([
    { findText: 'PS1', rawReplaceText: '/SL-1', replaceText: 'SL-1' },
    { findText: 'PS2', rawReplaceText: '/SL-2, /X1', replaceText: 'SL-2' },
  ]), 'PS1\t/SL-1\nPS2\t/SL-2, /X1');
  assert.deepEqual(editorFieldsForMode('BLOCK'), ['findText', 'replaceText', 'from', 'to', 'block']);
});

test('diagnostics block duplicate and conflicting active mappings', () => {
  const duplicates = analyzeFindReplaceEditorRows([
    { sequence: 1, status: 'PROPOSED', findText: 'PS1', rawReplaceText: '/SL-1', replaceText: 'SL-1', blockers: [] },
    { sequence: 2, status: 'PROPOSED', findText: 'PS1', rawReplaceText: '/SL-1, /X1', replaceText: 'SL-1', blockers: [] },
  ]);
  assert.equal(duplicates.hasErrors, true);
  assert.ok(duplicates.entries.some((entry) => entry.code === 'DUPLICATE_FIND_REPLACE'));
  assert.deepEqual(duplicates.blockedSequences, [1, 2]);

  const conflicts = analyzeFindReplaceEditorRows([
    { sequence: 1, status: 'PROPOSED', findText: 'PS1', replaceText: 'SL-1', blockers: [] },
    { sequence: 2, status: 'PROPOSED', findText: 'PS1', replaceText: 'SL-2', blockers: [] },
  ]);
  assert.ok(conflicts.entries.some((entry) => entry.code === 'CONFLICTING_REPLACEMENTS'));
  assert.deepEqual(conflicts.blockedSequences, [1, 2]);
});

test('rejecting one duplicate removes the duplicate gate while normalization remains logged', () => {
  const diagnostics = analyzeFindReplaceEditorRows([
    { sequence: 1, status: 'PROPOSED', findText: 'PS1', rawReplaceText: '/SL-1', replaceText: 'SL-1', blockers: [] },
    { sequence: 2, status: 'REJECTED', findText: 'PS1', rawReplaceText: '/SL-1', replaceText: 'SL-1', blockers: [] },
  ]);
  assert.equal(diagnostics.entries.some((entry) => entry.code === 'DUPLICATE_FIND_REPLACE'), false);
  assert.equal(diagnostics.entries.some((entry) => entry.code === 'REPLACEMENT_NORMALIZED'), true);
});

test('validation summaries add missing-find and structural blocker log entries', () => {
  const diagnostics = analyzeFindReplaceEditorRows([
    { sequence: 1, status: 'APPROVED', findText: 'PS1', replaceText: 'SL-1', blockers: [] },
  ], [{ sequence: 1, matchCount: 0, blockers: ['NO_MATCHES_IN_SCOPE', 'AUX_POINTER_SHARED'] }]);
  assert.ok(diagnostics.entries.some((entry) => entry.code === 'NO_MATCHES_IN_SCOPE'));
  assert.ok(diagnostics.entries.some((entry) => entry.code === 'AUX_POINTER_SHARED'));
  assert.deepEqual(diagnostics.blockedSequences, [1]);
});


test('operation intake preserves raw replacement while validator sees the normalized first token', () => {
  const operation = createFindReplaceOperation({ findText: 'PS02497.1', replaceText: '/SL-104.8, /X6' });
  assert.equal(operation.rawReplaceText, '/SL-104.8, /X6');
  assert.equal(operation.replaceText, 'SL-104.8');
  assert.equal(operation.after, 'SL-104.8');
  assert.equal(operation.replacementNormalization, 'FIRST_SLASH_TOKEN');
  assert.equal(operation.status, 'PROPOSED');

  const blocked = createFindReplaceOperation({ findText: 'PS1', replaceText: '/' });
  assert.equal(blocked.status, 'BLOCKED');
  assert.ok(blocked.blockers.includes('REPLACE_NORMALIZATION_EMPTY'));
});
