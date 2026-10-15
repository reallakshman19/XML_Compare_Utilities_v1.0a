import assert from 'node:assert/strict';
import { projectCanonicalV14WriterDelta } from '../tabs/cii-workspace/cii-workspace-v14-change-projection.js';

function documentBytes(sections) {
  const lines = [];
  for (const [name, rows] of sections) {
    lines.push(`#$ ${name}`);
    lines.push(...rows);
  }
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}

function text(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function fixedRow(values) {
  return values.map((value, index) => String(value).padStart(index === 0 ? 15 : 13, ' ')).join('');
}

function fixedBlock(seed, rows) {
  return Array.from({ length: rows }, (_, index) => fixedRow([seed + index, 0, 0, 0, 0, 0]));
}

function block(prefix, rows = 24) {
  return Array.from({ length: rows }, (_, index) => `${prefix}-${String(index).padStart(2, '0')}`);
}

// Native V14 contains one more significant digit than the V11-normalized/canonical
// form. Writer2 changes only the second fixed field. The projection must preserve
// the first original V14 field rather than leaking converter canonicalization.
{
  const native = '   2.044599E+02' + '            4';
  const baseline = '   2.044600E+02' + '            4';
  const modified = '   2.044600E+02' + '            3';
  const original = documentBytes([
    ['RIGID', ['   2.044599E+02 0.000000E+00']],
    ['CONTROL', [native]],
  ]);
  const canonicalBaseline = documentBytes([
    ['RIGID', ['   2.044600E+02 0.000000E+00']],
    ['CONTROL', [baseline]],
  ]);
  const canonicalModified = documentBytes([
    ['RIGID', ['   2.044600E+02 0.000000E+00']],
    ['CONTROL', [modified]],
  ]);
  const result = projectCanonicalV14WriterDelta(original, canonicalBaseline, canonicalModified);
  const output = text(result.outputBytes);
  assert.match(output, /2\.044599E\+02 0\.000000E\+00/, 'unchanged RIGID section must remain native V14 bytes');
  assert.match(output, /2\.044599E\+02\s+3/, 'unchanged first field in changed row must remain original V14 while changed field projects');
  assert.deepEqual(result.changedSections, ['CONTROL']);
  assert.equal(result.ledger.filter((item) => item.operation === 'MERGE_FIXED_ROW').length, 1);
}

// A changed section outside the qualified Writer2 physical family surface cannot
// be projected even when it looks like a harmless fixed-width numeric mutation.
{
  const original = documentBytes([['RIGID', ['   2.044599E+02 0.000000E+00']]]);
  const baseline = documentBytes([['RIGID', ['   2.044600E+02 0.000000E+00']]]);
  const modified = documentBytes([['RIGID', ['   2.044600E+02 1.000000E+00']]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED:RIGID/,
  );
}

// RESTRAINT cardinality is projected by qualified 24-row auxiliary blocks, not
// by ambiguous individual zero-like rows. Retained physical blocks come from the
// original native V14 coordinates.
{
  const originalA = block('native-A');
  const originalB = block('native-B');
  const originalC = block('native-C');
  const baselineA = block('canonical-A');
  const baselineB = block('canonical-B');
  const baselineC = block('canonical-C');
  const original = documentBytes([['RESTRANT', [...originalA, ...originalB, ...originalC]]]);
  const baseline = documentBytes([['RESTRANT', [...baselineA, ...baselineB, ...baselineC]]]);
  const modified = documentBytes([['RESTRANT', [...baselineA, ...baselineC]]]);
  const result = projectCanonicalV14WriterDelta(original, baseline, modified);
  assert.equal(text(result.outputBytes), `#$ RESTRANT\r\n${[...originalA, ...originalC].join('\r\n')}\r\n`);
  assert.deepEqual(result.ledger.map((item) => item.operation), ['DELETE_UNITS']);
  assert.equal(result.ledger[0].unitRows, 24);
}

// Duplicate block identities are not safe physical ownership anchors.
{
  const duplicate = block('same');
  const original = documentBytes([['RESTRANT', [...duplicate, ...duplicate]]]);
  const baseline = documentBytes([['RESTRANT', [...duplicate, ...duplicate]]]);
  const modified = documentBytes([['RESTRANT', [...duplicate]]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_AMBIGUOUS_DUPLICATE_UNIT/,
  );
}

// A retained unit may not move. LCS delete+insert decomposition is not authority
// for a physical block reorder because Writer2 compaction preserves retained order.
{
  const originalA = block('native-A');
  const originalB = block('native-B');
  const baselineA = block('canonical-A');
  const baselineB = block('canonical-B');
  const original = documentBytes([['RESTRANT', [...originalA, ...originalB]]]);
  const baseline = documentBytes([['RESTRANT', [...baselineA, ...baselineB]]]);
  const modified = documentBytes([['RESTRANT', [...baselineB, ...baselineA]]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED:RESTRANT/,
  );
}

// This PR qualifies V14 Writer2 cardinality only for NODENAME/SIF/RESTRAINT.
// Equal-cardinality fixed-field edits in these sections belong to Writer1B/1C
// and remain blocked until a separate field-identity projection authority exists.
{
  const original = documentBytes([['NODENAME', [fixedRow([100, 1, 0, 0, 0, 0])]]]);
  const baseline = documentBytes([['NODENAME', [fixedRow([100, 1, 0, 0, 0, 0])]]]);
  const modified = documentBytes([['NODENAME', [fixedRow([100, 2, 0, 0, 0, 0])]]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED:NODENAME/,
  );
}
{
  const originalRows = fixedBlock(1000, 24);
  const baselineRows = fixedBlock(1000, 24);
  const modifiedRows = [...baselineRows];
  modifiedRows[0] = fixedRow([1000, 9, 0, 0, 0, 0]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(
      documentBytes([['RESTRANT', originalRows]]),
      documentBytes([['RESTRANT', baselineRows]]),
      documentBytes([['RESTRANT', modifiedRows]]),
    ),
    /CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED:RESTRANT/,
  );
}
{
  const originalRows = fixedBlock(2000, 14);
  const baselineRows = fixedBlock(2000, 14);
  const modifiedRows = [...baselineRows];
  modifiedRows[2] = fixedRow([2002, 7, 0, 0, 0, 0]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(
      documentBytes([['SIF&TEES', originalRows]]),
      documentBytes([['SIF&TEES', baselineRows]]),
      documentBytes([['SIF&TEES', modifiedRows]]),
    ),
    /CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED:SIF&TEES/,
  );
}

// Non-isolated NODENAME cardinality rewrite has no safe original-coordinate projection.
{
  const original = documentBytes([['NODENAME', ['A', 'B', 'C']]]);
  const baseline = documentBytes([['NODENAME', ['A', 'B', 'C']]]);
  const modified = documentBytes([['NODENAME', ['X', 'Y']]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_NON_ISOLATED_CARDINALITY_RUN/,
  );
}

// HANGER/MISCEL has no qualified V14 projection authority at all.
{
  const original = documentBytes([['MISCEL_1', ['A', 'B']]]);
  const baseline = documentBytes([['MISCEL_1', ['A', 'B']]]);
  const modified = documentBytes([['MISCEL_1', ['A']]]);
  assert.throws(
    () => projectCanonicalV14WriterDelta(original, baseline, modified),
    /CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED:MISCEL_1/,
  );
}

// Section-order drift and LF-only material are not projectable V14 custody.
{
  const original = documentBytes([['CONTROL', [fixedRow([1, 2, 3, 4, 5, 6])]]]);
  const reversed = documentBytes([['RIGID', ['x']], ['CONTROL', [fixedRow([1, 2, 3, 4, 5, 6])]]]);
  assert.throws(() => projectCanonicalV14WriterDelta(original, original, reversed), /SECTION_ORDER_MISMATCH/);
  assert.throws(
    () => projectCanonicalV14WriterDelta('#$ CONTROL\nrow\n', '#$ CONTROL\nrow\n', '#$ CONTROL\nrow\n'),
    /FINAL_CRLF_REQUIRED/,
  );
}

console.log('CII Workspace V14 canonical-delta projection: PASS');
