import assert from 'node:assert/strict';

import { readFieldValue, extractNumeric, extractToken, normalizeText, textMatchPercent, applyCaptureRegex } from '../xml-compare/XmlCompareFieldExtractor.js';

// --- readFieldValue: checks nested bags + case/normalized-key variants ---
assert.equal(readFieldValue({ globalX: '10' }, 'globalX'), '10');
assert.equal(readFieldValue({ sourceAttributes: { FROM_GLOBAL_X: '23227.580' } }, 'FROM_GLOBAL_X'), '23227.580');
assert.equal(readFieldValue({ transferFields: { T1: '350' } }, 'T1'), '350');
assert.equal(readFieldValue({ raw: { attributes: { DIAMETER: '114.3' } } }, 'DIAMETER'), '114.3');
assert.equal(readFieldValue({ attributes: { global_x: '5' } }, 'GLOBALX'), '5', 'normalized-key fallback matches across punctuation/case');
assert.equal(readFieldValue({ a: 1 }, 'missing'), undefined);

// --- extractNumeric (2.2.1): regex capture -> number; sentinel -> null ---
assert.equal(extractNumeric({ globalZ: '-19800.000' }, 'globalZ'), -19800);
assert.equal(extractNumeric({ DELTA_X: '-1.010100' }, 'DELTA_X'), null, 'CAESAR sentinel -> null');
assert.equal(extractNumeric({ tag: 'ASIM-1835-4' }, 'tag', { regex: '([0-9]{4,5})', group: 1 }), 1835, 'regex capture then parse');
assert.equal(extractNumeric({ x: 'not-a-number' }, 'x'), null);

// --- applyCaptureRegex + token extraction (promoted from converter sandbox) ---
assert.equal(applyCaptureRegex('/ASIM-1835-4"-P8810212-31441C4-PP/B1', { regex: '([0-9]{5})', group: 1 }), '88102');
assert.equal(extractToken('/ASIM-1835-4"-P8810212-31441C4-PP/B1', { delimiter: '-', position: 4 }), 'P8810212');
assert.equal(extractToken('/ASIM-1835-4"-P8810212-31441C4-PP/B1', { delimiter: '-', position: 5 }), '31441C4');

// --- text normalization + match percent (2.2.2) ---
assert.equal(normalizeText('  A106   B ', {}), 'a106 b');
assert.equal(textMatchPercent('A106 B', 'a106 b'), 1, 'case/space-insensitive exact');
assert.equal(textMatchPercent('', ''), 1);
assert.equal(textMatchPercent('abc', ''), 0);
const partial = textMatchPercent('10->20', '1000->1010');
assert.ok(partial > 0 && partial < 1, `partial similarity in (0,1), got ${partial}`);
// regex-normalized: compare only the numeric-pattern shape
assert.equal(textMatchPercent('10->20', '1000->1010', { regex: '(->)' , group: 1 }), 1, 'regex focuses comparison on captured token');

console.log('XML Compare field extractor tests passed');
