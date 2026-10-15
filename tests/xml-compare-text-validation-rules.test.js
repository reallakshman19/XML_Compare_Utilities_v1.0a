import assert from 'node:assert/strict';

import {
  compareTextValues,
  compileTextRule,
  createTextValidationRows,
  parseRegexGroupSpec,
} from '../xml-compare/XmlCompareTextValidationRules.js';

// Validates generic text comparison rules: inputs are explicit source/target
// strings plus a rule object, output is a deterministic status/result payload,
// and unknown modes fall back to exact-normalized comparison.

function statusFor(sourceValue, targetValue, rule) {
  return compareTextValues({ sourceValue, targetValue, rule }).status;
}

assert.equal(statusFor('PIPE', 'pipe', { field: 'Name', mode: 'exact-normalized' }), 'OK');
assert.equal(statusFor('A   B', 'a b', { field: 'Name', mode: 'exact-normalized' }), 'OK');
assert.equal(
  statusFor('abc', 'xx abc yy', { field: 'Name', mode: 'contains', direction: 'target-contains-source' }),
  'OK',
);
assert.equal(
  statusFor('xx abc yy', 'abc', { field: 'Name', mode: 'contains', direction: 'source-contains-target' }),
  'OK',
);
assert.equal(
  statusFor('abc', 'abcdef', { field: 'Name', mode: 'starts-with', direction: 'either-starts' }),
  'OK',
);
assert.equal(
  statusFor('def', 'abcdef', { field: 'Name', mode: 'ends-with', direction: 'either-ends' }),
  'OK',
);
assert.equal(statusFor('LINE-1', 'LINE-2', { field: 'Line', mode: 'regex', pattern: '^LINE-\\d$' }), 'OK');
assert.equal(
  statusFor('BAD', 'LINE-2', { field: 'Line', mode: 'regex', pattern: '^LINE-\\d$' }),
  'REGEX_NO_MATCH_SOURCE',
);
assert.equal(
  statusFor('LINE-1', 'BAD', { field: 'Line', mode: 'regex', pattern: '^LINE-\\d$' }),
  'REGEX_NO_MATCH_TARGET',
);
assert.equal(statusFor('LINE-1', 'LINE-2', { field: 'Line', mode: 'regex', pattern: '[' }), 'REGEX_INVALID');

const matchingGroups = compareTextValues({
  sourceValue: 'AREA-10',
  targetValue: 'AREA-10',
  rule: { field: 'Line', mode: 'regex-position', pattern: '^(AREA)-(\\d+)$', groupSpec: 'area:1=1,bore:2=2' },
});
assert.equal(matchingGroups.groups.every((row) => row.status === 'OK'), true);

const mismatchedGroups = compareTextValues({
  sourceValue: 'AREA-10',
  targetValue: 'AREA-11',
  rule: { field: 'Line', mode: 'regex-position', pattern: '^(AREA)-(\\d+)$', groupSpec: 'area:1=1,bore:2=2' },
});
assert.equal(mismatchedGroups.groups.some((row) => row.status === 'REGEX_GROUP_MISMATCH'), true);

assert.deepEqual(
  parseRegexGroupSpec('area:1=1,bore:2=2').map((row) => ({
    name: row.name,
    sourceGroup: row.sourceGroup,
    targetGroup: row.targetGroup,
  })),
  [
    { name: 'area', sourceGroup: 1, targetGroup: 1 },
    { name: 'bore', sourceGroup: 2, targetGroup: 2 },
  ],
);
assert.equal(statusFor('a b c', 'c,b;a', { field: 'Tokens', mode: 'token-set' }), 'OK');

const tokenResult = compareTextValues({
  sourceValue: 'a b c',
  targetValue: 'b c d',
  rule: { field: 'Tokens', mode: 'token-set' },
});
assert.equal(tokenResult.status, 'TOKEN_SET_MISMATCH');
assert.deepEqual(tokenResult.missingInTarget, ['a']);
assert.deepEqual(tokenResult.extraInTarget, ['d']);

assert.equal(statusFor('', 'abc', { field: 'Name', mode: 'exact-normalized' }), 'BLANK');
assert.equal(statusFor('x'.repeat(5001), 'x', { field: 'Name', mode: 'exact-normalized' }), 'TEXT_TOO_LONG');
assert.equal(compileTextRule({ field: 'Name', mode: 'not-real' }).mode, 'exact-normalized');

const rows = createTextValidationRows({
  sourceRecord: { uid: 'source-1', displayName: 'Source 1', MATERIAL_NAME: ' A  B ' },
  targetRecord: { uid: 'target-1', displayName: 'Target 1', MATERIAL_NAME: 'a b' },
  compareFields: ['MATERIAL_NAME'],
  textRules: { MATERIAL_NAME: { field: 'MATERIAL_NAME', mode: 'exact-normalized' } },
});
assert.equal(rows.length, 1);
assert.equal(rows[0].rowType, 'text');
assert.equal(rows[0].status, 'OK');

console.log('XML Compare text validation rules tests passed');
