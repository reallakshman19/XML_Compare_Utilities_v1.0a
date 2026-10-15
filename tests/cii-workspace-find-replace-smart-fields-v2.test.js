import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseFortranNumber } from '../parser/fixed-field.js';
import { createFindReplaceOperation, FIND_REPLACE_CSV_MODES } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';
import { analyzeFindReplaceEditorRows } from '../tabs/cii-workspace/cii-workspace-find-replace-editor-model.js';
import { buildValidatedFindReplacePostimage } from '../tabs/cii-workspace/cii-workspace-find-replace-executor.js';
import { resolveFindReplaceScope } from '../tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js';
import { validateFindReplacePreimage } from '../tabs/cii-workspace/cii-workspace-find-replace-validator.js';

const target0 = fs.readFileSync(new URL('../Benchmark/T.CII', import.meta.url), 'utf8');

function approved(findText, replaceText) {
  return {
    ...createFindReplaceOperation({ findText, replaceText }, FIND_REPLACE_CSV_MODES.DOCUMENT),
    sequence: 1,
    status: 'APPROVED',
  };
}

function numericIndex() {
  const scope = resolveFindReplaceScope(target0, { scope: 'DOCUMENT' }, {
    fieldAwareMutation: true,
    smartFixedWidth: 'QUALIFIED_FIELDS',
  });
  assert.equal(scope.status, 'PASS', scope.blockers?.join('\n'));
  const numeric = scope.spans.filter((span) => span.smartKind === 'NUMERIC');
  assert.ok(numeric.length > 0, 'retained benchmark must expose qualified numeric fields');
  const groupsByValue = new Map();
  for (const span of numeric) {
    const value = parseFortranNumber(span.semanticValue);
    if (!Number.isFinite(value)) continue;
    const key = String(value);
    const groups = groupsByValue.get(key) || new Set();
    groups.add(span.smartGroup);
    groupsByValue.set(key, groups);
  }
  return { scope, numeric, groupsByValue };
}

test('DOCUMENT smart field index serializes an exact numeric logical value without manual width padding', () => {
  const { numeric, groupsByValue } = numericIndex();
  const span = numeric.find((item) => {
    const value = parseFortranNumber(item.semanticValue);
    return Number.isFinite(value) && groupsByValue.get(String(value))?.size === 1;
  });
  assert.ok(span, 'retained benchmark must contain a numeric value unique to one semantic field class');
  const findText = String(parseFortranNumber(span.semanticValue));
  let replaceText = '1234';
  if (replaceText.length === findText.length) replaceText = '12345';
  if (replaceText === findText) replaceText = '67890';
  assert.notEqual(findText.length, replaceText.length);

  const preimage = validateFindReplacePreimage(target0, [approved(findText, replaceText)]);
  assert.equal(preimage.status, 'PASS', preimage.blockers.join('\n'));
  assert.equal(preimage.operationSummaries[0].semanticMode, 'AUTO_CII_NUMERIC_FIXED_WIDTH');
  assert.ok(preimage.claims.length > 0);
  for (const claim of preimage.claims) {
    assert.equal(claim.before.length, claim.after.length);
    assert.equal(claim.after.trim(), replaceText);
    assert.equal(claim.fieldKind, 'NUMERIC');
  }

  const postimage = buildValidatedFindReplacePostimage(target0, preimage);
  assert.equal(postimage.status, 'QUALIFIED_POSTIMAGE', postimage.blockers.join('\n'));
  assert.equal(postimage.target1.length, target0.length);
  assert.equal((postimage.target1.match(/\r\n/g) || []).length, (target0.match(/\r\n/g) || []).length);
});

test('DOCUMENT smart numeric replacement fails closed when one logical value spans multiple engineering field classes', () => {
  const { groupsByValue } = numericIndex();
  const ambiguous = [...groupsByValue.entries()].find(([, groups]) => groups.size > 1);
  assert.ok(ambiguous, 'retained benchmark must contain at least one ambiguous numeric logical value');
  const [findText] = ambiguous;
  let replaceText = '4321';
  if (replaceText.length === findText.length) replaceText = '54321';
  const preimage = validateFindReplacePreimage(target0, [approved(findText, replaceText)]);
  assert.equal(preimage.status, 'FAIL');
  const summary = preimage.operationSummaries[0];
  assert.ok(summary.blockers.some((value) => value.startsWith('SMART_FIELD_AMBIGUOUS:')));
  assert.equal(preimage.claims.length, 0);
  const diagnostics = analyzeFindReplaceEditorRows([approved(findText, replaceText)], preimage.operationSummaries);
  const item = diagnostics.entries.find((entry) => entry.code.startsWith('SMART_FIELD_AMBIGUOUS:'));
  assert.ok(item);
  assert.match(item.message, /Narrow to Element\/Block scope/);
});

test('existing Node Name smart serialization remains available through the universal smart index', () => {
  const operation = approved('PS02302.1', '/SL-123.7, /unset-, /SL-123.8, /SL-123.9');
  assert.equal(operation.replaceText, 'SL-123.7');
  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'PASS', preimage.blockers.join('\n'));
  assert.equal(preimage.operationSummaries[0].semanticMode, 'AUTO_NODENAME_FIXED_WIDTH');
  assert.ok(preimage.claims.length > 0);
  assert.ok(preimage.claims.every((claim) => claim.before.length === claim.after.length));
});

test('strong fixed-width blocker does not also emit a misleading NO_MATCHES_IN_SCOPE diagnostic', () => {
  const operation = approved('XYZ', 'LONG');
  const preimage = validateFindReplacePreimage(target0, [operation]);
  assert.equal(preimage.status, 'FAIL');
  assert.ok(preimage.operationSummaries[0].blockers.some((value) => value.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:')));
  const diagnostics = analyzeFindReplaceEditorRows([operation], preimage.operationSummaries);
  assert.ok(diagnostics.entries.some((entry) => entry.code.startsWith('FIXED_WIDTH_LENGTH_MISMATCH:')));
  assert.equal(diagnostics.entries.some((entry) => entry.code === 'NO_MATCHES_IN_SCOPE'), false);
});
