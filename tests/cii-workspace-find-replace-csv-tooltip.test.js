import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseFindReplaceCsv } from '../tabs/cii-workspace/cii-workspace-find-replace-csv.js';

const panel = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace.js', import.meta.url), 'utf8');

const CSV_BENCHMARKS = Object.freeze([
  Object.freeze({ mode: 'DOCUMENT', headings: 'FindText,ReplaceText', sample: 'PS02500.1,/SL-101.6' }),
  Object.freeze({ mode: 'ELEMENT', headings: 'From,To,FindText,ReplaceText', sample: '100,110,OLD_TEXT,NEW_TEXT' }),
  Object.freeze({ mode: 'BLOCK', headings: 'From,To,Block,FindText,ReplaceText', sample: '100,110,NODENAME,PS02500.1,/SL-101.6' }),
]);

test('CSV info icon exposes canonical headings and sample data for every scope', () => {
  assert.match(panel, /aria-label="Expected CSV headings and sample data"/);
  assert.match(panel, />ⓘ<\/span>/);
  assert.match(panel, /Headings are matched case-insensitively/);
  for (const benchmark of CSV_BENCHMARKS) {
    assert.ok(panel.includes(`${benchmark.mode}&#10;${benchmark.headings}&#10;${benchmark.sample}`));
  }
});

test('CSV tooltip benchmark samples are accepted by production intake', () => {
  for (const benchmark of CSV_BENCHMARKS) {
    const parsed = parseFindReplaceCsv(`${benchmark.headings}\n${benchmark.sample}`, benchmark.mode);
    assert.notEqual(parsed.status, 'INVALID', benchmark.mode);
    assert.equal(parsed.operations.length, 1, benchmark.mode);
  }
});

test('benchmark editor table keeps Find and Replace first, followed by contextual scope columns', () => {
  const expected = [
    '<th>Find</th>',
    '<th>Replace</th>',
    '<th data-ciifr-grid-range>From</th>',
    '<th data-ciifr-grid-range>To</th>',
    '<th data-ciifr-grid-block>Block</th>',
  ];
  let previous = -1;
  for (const token of expected) {
    const index = panel.indexOf(token);
    assert.ok(index > previous, token);
    previous = index;
  }
  assert.match(panel, /<th>Source<\/th>/);
  assert.match(panel, /<th>Status \/ effective value<\/th>/);
  assert.match(panel, /<th>Log<\/th>/);
  assert.match(panel, /<th>Decision<\/th>/);
});
