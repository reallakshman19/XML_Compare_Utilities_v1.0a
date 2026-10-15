import assert from 'node:assert/strict';
import { projectCanonicalV14WriterDelta } from '../tabs/cii-workspace/cii-workspace-v14-change-projection.js';

function documentBytes(rows) {
  return new TextEncoder().encode(`#$ NODENAME\r\n${rows.join('\r\n')}\r\n`);
}
function outputRows(result) {
  return new TextDecoder().decode(result.outputBytes).split('\r\n').slice(1, -1);
}
function nodeNameRow(fromName = '', toName = '') {
  return `  ${fromName.padEnd(26, ' ')}${toName.padEnd(25, ' ')}`;
}

// Existing duplicate NODENAME payloads are legitimate retained multiplicity.
// A unique Writer2 append must not make that baseline unprojectable.
{
  const original = ['native-A-1', 'native-A-2', 'native-B'];
  const baseline = ['A', 'A', 'B'];
  const modified = ['A', 'A', 'B', 'C'];
  const result = projectCanonicalV14WriterDelta(documentBytes(original), documentBytes(baseline), documentBytes(modified));
  assert.deepEqual(outputRows(result), [...original, 'C']);
  assert.deepEqual(result.ledger.map((item) => item.operation), ['INSERT_UNITS']);
}

// Duplicates need not be adjacent. Occurrence identity must remain stable across
// unrelated unique deletion while preserving native V14 rows for both copies.
{
  const original = ['native-A-1', 'native-X', 'native-A-2', 'native-B'];
  const baseline = ['A', 'X', 'A', 'B'];
  const modified = ['A', 'A', 'B'];
  const result = projectCanonicalV14WriterDelta(documentBytes(original), documentBytes(baseline), documentBytes(modified));
  assert.deepEqual(outputRows(result), ['native-A-1', 'native-A-2', 'native-B']);
  assert.deepEqual(result.ledger.map((item) => item.operation), ['DELETE_UNITS']);
}

// Changing multiplicity inside a duplicate-equivalence class remains ambiguous:
// the canonical bytes cannot prove which physical native occurrence was removed.
{
  assert.throws(
    () => projectCanonicalV14WriterDelta(
      documentBytes(['native-A-1', 'native-A-2']),
      documentBytes(['A', 'A']),
      documentBytes(['A']),
    ),
    /CII_V14_PROJECTION_AMBIGUOUS_DUPLICATE_UNIT_CARDINALITY:NODENAME/,
  );
}
{
  assert.throws(
    () => projectCanonicalV14WriterDelta(
      documentBytes(['native-A']),
      documentBytes(['A']),
      documentBytes(['A', 'A']),
    ),
    /CII_V14_PROJECTION_AMBIGUOUS_DUPLICATE_UNIT_CARDINALITY:NODENAME/,
  );
}

// A Writer2 cardinality CREATE may also fill a redundant blank field in an
// existing NODENAME row. Project that blank transition while retaining the
// independently inserted physical row.
{
  const baseline = [nodeNameRow('', 'PS02315.1'), nodeNameRow('PS02711.1', '')];
  const modified = [nodeNameRow('SL-115A.4', 'PS02315.1'), nodeNameRow('PS02711.1', ''), nodeNameRow('SL-115A.4', '')];
  const result = projectCanonicalV14WriterDelta(documentBytes(baseline), documentBytes(baseline), documentBytes(modified));
  assert.deepEqual(outputRows(result), modified);
  assert.deepEqual(result.ledger.map((item) => item.operation), ['MERGE_NODENAME_BLANK_TRANSITION', 'INSERT_UNITS']);
  assert.deepEqual(result.ledger[0].changedFields, ['FROM']);
}

// Cardinality change must not become a back door for Writer1C-style replacement
// of one nonblank NODENAME payload with another.
{
  const baseline = [nodeNameRow('SL-115A.4', 'PS02315.1'), nodeNameRow('PS02711.1', '')];
  const modified = [nodeNameRow('SL-999.9', 'PS02315.1'), nodeNameRow('PS02711.1', ''), nodeNameRow('SL-999.9', '')];
  assert.throws(
    () => projectCanonicalV14WriterDelta(documentBytes(baseline), documentBytes(baseline), documentBytes(modified)),
    /CII_V14_PROJECTION_NODENAME_NONBLANK_REPLACEMENT_NOT_AUTHORIZED/,
  );
}

// Occurrence qualification is not reorder authority.
{
  assert.throws(
    () => projectCanonicalV14WriterDelta(
      documentBytes(['native-A-1', 'native-A-2', 'native-B']),
      documentBytes(['A', 'A', 'B']),
      documentBytes(['A', 'B', 'A']),
    ),
    /CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED:NODENAME/,
  );
}

console.log('CII Workspace V14 duplicate NODENAME projection: PASS');
