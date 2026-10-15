import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  CII_SIX_FIELD_WIDTHS,
  decodeCiiNumericRow,
  decodeFixedFields,
  parseFortranNumber,
} from '../parser/fixed-field.js';
import { parse } from '../parser/caesar-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const benchmarkDir = path.join(repoRoot, 'Benchmark', 'CIICompare');

function approx(actual, expected, tolerance = 1e-12) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function parseFixture(fileName) {
  const rawText = fs.readFileSync(path.join(benchmarkDir, fileName), 'utf8');
  const parserAlias = fileName.replace(/\.cii$/i, '.accdb');
  return parse(rawText, parserAlias);
}

function findElement(result, from, to) {
  const element = result.elements.find((candidate) => candidate.from === from && candidate.to === to);
  assert(element, `expected element ${from}→${to} to be parsed`);
  return element;
}

function assertNoOdZeroError(result, from, to) {
  const prefix = `Element ${from}→${to}: OD = 0`;
  assert(
    !result.errors.some((entry) => String(entry?.msg ?? entry).startsWith(prefix)),
    `unexpected OD=0 parser failure for ${from}→${to}`,
  );
}

// Canonical writer widths: 15 + 5*13 = 80 columns.
assert.deepStrictEqual(CII_SIX_FIELD_WIDTHS, [15, 13, 13, 13, 13, 13]);

const sourceProblemRow = '    255.000      260.000         0.000000-0.488281E-03 -271.602         60.30000';
assert.strictEqual(sourceProblemRow.length, 80, 'benchmark element row must remain an 80-column fixed record');

const rawFields = decodeFixedFields(sourceProblemRow);
assert.deepStrictEqual(rawFields.map((field) => field.trim()), [
  '255.000',
  '260.000',
  '0.000000',
  '-0.488281E-03',
  '-271.602',
  '60.30000',
]);

assert.deepStrictEqual(decodeCiiNumericRow(sourceProblemRow), [
  255,
  260,
  0,
  -0.000488281,
  -271.602,
  60.3,
]);

// Fortran D exponents are also valid engineering numeric fields.
approx(parseFortranNumber(' 1.250000D+02 '), 125);

// SOURCE regression: this was the reported CII_WORKSPACE_PARSE_BLOCKED row.
const source = parseFixture('BM_CII_SOURCE.CII');
const sourceElement = findElement(source, 255, 260);
assert.strictEqual(sourceElement.dx, 0);
approx(sourceElement.dy, -0.000488281);
approx(sourceElement.dz, -271.602);
approx(sourceElement.od, 60.3);
assertNoOdZeroError(source, 255, 260);

// TARGET1 uses the same adjacent-field pattern with a revised OD/wall family.
const target1 = parseFixture('BM_CII_TARGET1.CII');
const target1Element = findElement(target1, 20255, 20260);
assert.strictEqual(target1Element.dx, 0);
approx(target1Element.dy, -0.000488281);
approx(target1Element.dz, -271.602);
approx(target1Element.od, 114.3);
assertNoOdZeroError(target1, 20255, 20260);

// TARGET2 is the blind/generalisation case: internal geometry changes, but the
// same fixed-field adjacency must still decode without column drift.
const target2 = parseFixture('BM_CII_TARGET2.CII');
const target2Element = findElement(target2, 10255, 10260);
assert.strictEqual(target2Element.dx, 0);
approx(target2Element.dy, -0.000488281);
approx(target2Element.dz, -471.602);
approx(target2Element.od, 88.9);
assertNoOdZeroError(target2, 10255, 10260);

console.log('CII fixed-field parser benchmark regression checks passed.');
