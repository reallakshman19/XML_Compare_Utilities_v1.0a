import test from 'node:test';
import assert from 'node:assert/strict';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { convertSupportRevisionPair } from '../tabs/csv-rev-compare/support-revision-pipeline.js';

const HEADERS = [
  'PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE',
  'PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST','NORTH/SOUTH','BOP ELEVATION','REVISION',
];

function row(overrides = {}) {
  const values = {
    'PREV NAME': 'PS-1',
    SCOPE: 'PL',
    CIVILSECONDARYSUPPORT: 'SL-1',
    PIPE: 'ASIM-1885-PL-4"-M8810130-01',
    SIZE: '4',
    'PIPING PRIMARY SUPPORT': '/SL-1.1',
    'SUPPORT TYPE': 'REST-50',
    'PIPING PRIMARY SUPPORT REFERENCE': '=REF/1',
    'EAST/WEST': 'E 100',
    'NORTH/SOUTH': 'N 200',
    'BOP ELEVATION': 'U 300',
    REVISION: '1',
    ...overrides,
  };
  return HEADERS.map((header) => values[header] ?? '');
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

test('explicit earlier/later inputs with overlapping categorized area/scope pass pair validation', () => {
  const pair = convertSupportRevisionPair(
    csv([row({ REVISION: '7' })]),
    csv([row({ REVISION: '8', CIVILSECONDARYSUPPORT: 'SL-2' })]),
  );
  assert.equal(pair.pairValidation.orderingBasis, 'explicit-input-role');
  assert.equal(pair.pairValidation.ok, true);
  assert.equal(pair.ok, true);
  assert.deepEqual(pair.pairValidation.source.areas, ['ASIM-1885']);
  assert.deepEqual(pair.pairValidation.target.areas, ['ASIM-1885']);
});

test('disjoint categorized PIPE areas fail closed before lineage comparison', () => {
  const source = csv([row({ REVISION: '1' })]);
  const target = csv([row({ REVISION: '2', PIPE: 'BETA-9999-PL-4"-M8810130-01' })]);
  const pair = convertSupportRevisionPair(source, target);
  assert.equal(pair.ok, false);
  assert.equal(pair.pairValidation.ok, false);
  assert.ok(pair.diagnostics.some((item) => item.code === 'support_revision_area_incompatible' && item.severity === 'BLOCKER'));
  const result = runSupportRevisionCompare(source, target);
  assert.equal(result.stage, 'CONVERSION_BLOCKED');
  assert.equal(result.exportReady, false);
  assert.ok(result.diagnostics.some((item) => item.code === 'support_revision_area_incompatible'));
});

test('disjoint categorized support scopes fail closed even when area matches', () => {
  const pair = convertSupportRevisionPair(
    csv([row({ REVISION: '1', SCOPE: 'PL' })]),
    csv([row({ REVISION: '2', SCOPE: 'CIVIL', PIPE: 'ASIM-1885-CIVIL-4"-M8810130-01' })]),
  );
  assert.equal(pair.ok, false);
  assert.ok(pair.diagnostics.some((item) => item.code === 'support_revision_scope_incompatible'));
});

test('when explicit ordering is disabled, numeric REVISION values must prove earlier-to-later order', () => {
  const valid = convertSupportRevisionPair(
    csv([row({ REVISION: '3' })]),
    csv([row({ REVISION: '4' })]),
    { revisionOrderExplicit: false },
  );
  assert.equal(valid.pairValidation.ok, true);
  assert.ok(valid.diagnostics.some((item) => item.code === 'support_revision_order_inferred'));

  const reversed = convertSupportRevisionPair(
    csv([row({ REVISION: '4' })]),
    csv([row({ REVISION: '3' })]),
    { revisionOrderExplicit: false },
  );
  assert.equal(reversed.ok, false);
  assert.ok(reversed.diagnostics.some((item) => item.code === 'support_revision_order_unproven'));
});

test('same-area gate is derived from categorized graph fields rather than CSV row ordinal', () => {
  const source = [
    row({ 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', REVISION: '1' }),
    row({ 'PREV NAME': 'PS-B', CIVILSECONDARYSUPPORT: 'SL-B', REVISION: '1', PIPE: 'ASIM-1885-PL-6"-M8810131-01' }),
  ];
  const target = [
    row({ 'PREV NAME': 'PS-B', CIVILSECONDARYSUPPORT: 'SL-B', REVISION: '2', PIPE: 'ASIM-1885-PL-6"-M8810131-01' }),
    row({ 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', REVISION: '2' }),
  ];
  const pair = convertSupportRevisionPair(csv(source), csv(target));
  assert.equal(pair.ok, true);
  assert.deepEqual(pair.pairValidation.source.areas, pair.pairValidation.target.areas);
  assert.deepEqual(pair.pairValidation.source.scopes, pair.pairValidation.target.scopes);
});
