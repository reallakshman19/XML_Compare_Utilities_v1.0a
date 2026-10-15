import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const CENSUS_URL = new URL('../docs/cii-writer2-hanger-real-source-census.csv', import.meta.url);
const H1_EXPECTED = Object.freeze([
  'Benchmark/CIICompare/BM_CII_SOURCE.CII',
  'converters/scripts/inputxml_profile_bm_cii_2019.cii',
]);
const PACKED_LABELS = Object.freeze(['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN']);
const FIELD_WIDTH = 13;
const PACKED_PREFIX = '  ';

function normalizedPath(value) { return String(value).replaceAll('\\', '/'); }
function sectionMarker(line) {
  const match = String(line ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function parseCsv(text) {
  const lines = String(text).trim().split(/\r?\n/); const headers = lines.shift().split(',');
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',');
    assert.equal(values.length, headers.length, `Census CSV column count for ${line}`);
    return Object.freeze(Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  });
}
async function walk(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) await walk(absolute, out);
    else out.push(absolute);
  }
}
async function repositoryCiiCandidates() {
  const files = [];
  await walk(join(REPO_ROOT, 'Benchmark'), files);
  await walk(join(REPO_ROOT, 'converters', 'scripts'), files);
  files.push(join(REPO_ROOT, 'output.cii'));
  return files.map((absolute) => Object.freeze({ absolute, path: normalizedPath(relative(REPO_ROOT, absolute)) }))
    .filter(({ path }) => path.toLowerCase().endsWith('.cii') || path === 'Benchmark/Pipeline/CII')
    .sort((a, b) => a.path.localeCompare(b.path));
}
function controlCounts(lines, path) {
  const marker = lines.findIndex((line) => sectionMarker(line) === 'CONTROL');
  assert.notEqual(marker, -1, `CONTROL required: ${path}`);
  const row = lines.slice(marker + 1).find((line) => String(line).trim());
  assert.ok(row, `CONTROL first row required: ${path}`);
  const values = String(row).trim().split(/\s+/).map(Number);
  assert.ok(values.length >= 3 && values.slice(0, 3).every(Number.isSafeInteger), `CONTROL NUMELT/NUMNOZ/NOHGRS required: ${path}`);
  return Object.freeze({ numelt: values[0], numnoz: values[1], nohgrs: values[2] });
}
function sectionRows(lines, name, path) {
  const marker = lines.findIndex((line) => sectionMarker(line) === name);
  assert.notEqual(marker, -1, `${name} required: ${path}`);
  const rows = [];
  for (let index = marker + 1; index < lines.length; index += 1) {
    if (sectionMarker(lines[index]) !== null) break;
    if (String(lines[index]).trim()) rows.push(lines[index]);
  }
  return rows;
}
function assertH1PackedShape(lines, counts, path) {
  assert.equal(counts.nohgrs, 1, `H=1 precondition: ${path}`);
  const rows = sectionRows(lines, 'MISCEL_1', path);
  const prefixRows = Math.ceil(counts.numelt / 6) + counts.numnoz * 4;
  const expectedRows = prefixRows + 16; // prefix + [2 defaults + 5*H + 5*ceil(H/6)] + 4 execution rows for H=1.
  assert.equal(rows.length, expectedRows, `H=1 MISCEL_1 row formula: ${path}`);

  let cursor = prefixRows + 2;
  const packedRows = { IHGRNODE: rows[cursor] }; cursor += 1;
  cursor += 4; // HGRDAT1/HGRDAT2/TAG/GUID for H=1.
  cursor += 1; // IHGRFREE for H=1.
  for (const label of PACKED_LABELS.slice(1)) { packedRows[label] = rows[cursor]; cursor += 1; }

  for (const label of PACKED_LABELS) {
    const row = String(packedRows[label] ?? '');
    assert.equal(row.slice(0, 2), PACKED_PREFIX, `${label} canonical 2X prefix: ${path}`);
    assert.equal(row.length, 2 + FIELD_WIDTH, `${label} active-only H=1 packed shape: ${path}`);
    const rawField = row.slice(2);
    assert.match(rawField.trim(), /^[+-]?\d+$/, `${label} exact integer I13 token: ${path}`);
  }
}

const censusRows = parseCsv(await readFile(CENSUS_URL, 'utf8'));
const expectedByPath = new Map(censusRows.map((row) => [row.path, row]));
assert.equal(expectedByPath.size, censusRows.length, 'Census paths must be unique');
assert.ok(censusRows.every((row) => row.h_gt_1_candidate === 'false'), 'Frozen census must not claim an H>1 real source');

// Detect newly introduced real H>1 evidence before generic census-drift handling.
// That source is a qualification event, not merely an inventory update.
const candidates = await repositoryCiiCandidates();
const observed = [];
for (const candidate of candidates) {
  const raw = await readFile(candidate.absolute, 'utf8');
  const lines = raw.split(/\r\n|\n|\r/); const counts = controlCounts(lines, candidate.path);
  if (counts.nohgrs > 1) {
    throw new Error(`REAL_H_GT_1_HANGER_SOURCE_DISCOVERED_REQUIRES_QUALIFICATION:${candidate.path}:${counts.nohgrs}`);
  }
  observed.push(Object.freeze({ ...candidate, lines: Object.freeze(lines), counts }));
}

const actualPaths = observed.map((item) => item.path);
const expectedPaths = [...expectedByPath.keys()].sort((a, b) => a.localeCompare(b));
assert.deepEqual(actualPaths, expectedPaths,
  'REAL_HANGER_SOURCE_CENSUS_DRIFT: update source custody before accepting added/removed repository CII assets');

const observedH1 = [];
for (const item of observed) {
  const expected = expectedByPath.get(item.path);
  assert.ok(expected, `Frozen census entry required: ${item.path}`);
  assert.equal(item.counts.numelt, Number(expected.numelt), `NUMELT census custody: ${item.path}`);
  assert.equal(item.counts.numnoz, Number(expected.numnoz), `NUMNOZ census custody: ${item.path}`);
  assert.equal(item.counts.nohgrs, Number(expected.nohgrs), `NOHGRS census custody: ${item.path}`);
  if (item.counts.nohgrs === 1) {
    observedH1.push(item.path);
    assert.equal(expected.packed_shape_observed, 'ACTIVE_FIELDS_ONLY_H1', `H=1 source shape ledger: ${item.path}`);
    assertH1PackedShape(item.lines, item.counts, item.path);
  } else {
    assert.equal(expected.packed_shape_observed, 'NOT_APPLICABLE_H0', `H=0 source shape ledger: ${item.path}`);
  }
}

assert.deepEqual(observedH1.sort((a, b) => a.localeCompare(b)), [...H1_EXPECTED].sort((a, b) => a.localeCompare(b)),
  'Real-source H=1 authority set changed');

console.log('Writer2 HANGER real-source census frozen: no repository H>1 CII preimage; H=1 packed rows independently active-only.');
