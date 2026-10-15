import assert from 'node:assert/strict';
import { validateRawMutationIdentity } from './cii-workspace-multisource-partial-texpected-oracle.js';

function field(value) { return String(value ?? '').padStart(13, ' '); }
function six(values = []) { return `  ${Array.from({ length: 6 }, (_, i) => field(values[i] ?? 0)).join('')}`; }
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => six());
  rows[0] = six([from, to, 0, 0, 0, 0]);
  rows[13] = six([0, 0, 0, 0, 0, pointer]);
  return rows;
}
function nodeNameRow(fromName = '', toName = '') {
  return `  ${fromName.padEnd(26, ' ')}${toName.padEnd(25, ' ')}`;
}
function ciiTwoNames(firstName, secondName = '') {
  const nameRows = [nodeNameRow(firstName), ...(secondName ? [nodeNameRow(secondName)] : [])];
  const secondPointer = secondName ? 2 : 0;
  return [
    '#$ CONTROL ', six([2, 0, 0, nameRows.length, 0, 0]), six(), six(), field(0),
    '#$ ELEMENTS',
    ...elementBlock(20, 21, 1),
    ...elementBlock(30, 31, secondPointer),
    '#$ NODENAME',
    ...nameRows,
    '#$ END',
  ].join('\r\n');
}
function copy({ id = 'op', sourceValue = 'SL-106.3', target = '20', before = 'PS02494.1' } = {}) {
  return {
    operationId: id,
    sourceId: 'S1',
    action: 'COPY',
    sourceEvidence: { value: sourceValue },
    targetEvidence: { identity: target, value: before },
    before,
    proposed: sourceValue,
  };
}
function create({ id = 'create', sourceValue = 'SL-106.3', target = '20', before = '' } = {}) {
  return {
    operationId: id,
    sourceId: 'S1',
    action: 'CREATE',
    sourceEvidence: { value: sourceValue },
    targetEvidence: { identity: target, value: before },
    before,
    proposed: sourceValue,
  };
}
function del({ id = 'delete', target = '20', before = 'PS02494.1' } = {}) {
  return {
    operationId: id,
    sourceId: 'S1',
    action: 'DELETE',
    targetEvidence: { identity: target, value: before },
    before,
    proposed: '',
  };
}

const source = ciiTwoNames('SL-106.3');
const bmExact = [{ rowNumber: 1, sourceNames: ['/SL-106.3'], targetName: 'PS02494.1' }];

// Live BM target selected exactly => PASS.
{
  const target = ciiTwoNames('PS02494.1');
  const result = validateRawMutationIdentity([copy()], { S1: source }, target, bmExact);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.nonApplicableBmAliasOperationIds, []);
}

// Live BM target exists elsewhere => wrong selected target remains BLOCKED.
{
  const target = ciiTwoNames('PS02494.1', 'PS09999.1');
  const result = validateRawMutationIdentity([
    copy({ id: 'wrong-live-target', target: '30', before: 'PS09999.1' }),
  ], { S1: source }, target, bmExact);
  assert.equal(result.status, 'BLOCKED');
  assert(result.errors.some((row) => row.code === 'COPY_VALUE_NOT_EXACT_BM_ALIAS_FOR_TARGET'));
}

// Multiple BM rows: only live target rows are applicable.
{
  const target = ciiTwoNames('PS02494.1');
  const rows = [
    ...bmExact,
    { rowNumber: 2, sourceNames: ['/SL-106.3'], targetName: 'PS08888.1' },
  ];
  const result = validateRawMutationIdentity([copy({ id: 'one-live' })], { S1: source }, target, rows);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.nonApplicableBmAliasOperationIds, []);
}

// Frozen BM alias whose target preimage is absent from exact target => no BM veto,
// but the non-applicability is explicit in diagnostics.
{
  const target = ciiTwoNames('PS09999.1');
  const result = validateRawMutationIdentity([
    copy({ id: 'stale-bm-target', before: 'PS09999.1' }),
  ], { S1: source }, target, bmExact);
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.nonApplicableBmAliasOperationIds, ['stale-bm-target']);
  assert.equal(result.errors.length, 0);
}

// Exact source identity remains mandatory even when BM target is non-applicable.
{
  const target = ciiTwoNames('PS09999.1');
  const result = validateRawMutationIdentity([
    copy({ id: 'missing-source', sourceValue: 'SL-999.9', before: 'PS09999.1' }),
  ], { S1: source }, target, [{ rowNumber: 1, sourceNames: ['/SL-999.9'], targetName: 'PS00001.1' }]);
  assert.equal(result.status, 'BLOCKED');
  assert(result.errors.some((row) => row.code === 'COPY_VALUE_NOT_EXACT_SOURCE_NAME'));
}

// COPY exact current target preimage remains mandatory.
{
  const target = ciiTwoNames('PS09999.1');
  const result = validateRawMutationIdentity([
    copy({ id: 'stale-copy-before', before: 'PS09998.1' }),
  ], { S1: source }, target, bmExact);
  assert.equal(result.status, 'BLOCKED');
  assert(result.errors.some((row) => row.code === 'COPY_VALUE_NOT_EXACT_TARGET_PREIMAGE'));
}

// CREATE still requires a blank exact target preimage.
{
  const target = ciiTwoNames('PS09999.1');
  const result = validateRawMutationIdentity([
    create({ id: 'create-nonblank', before: '' }),
  ], { S1: source }, target, bmExact);
  assert.equal(result.status, 'BLOCKED');
  assert(result.errors.some((row) => row.code === 'CREATE_TARGET_PREIMAGE_NOT_BLANK'));
}

// DELETE remains exact-preimage checked independently of BM applicability.
{
  const target = ciiTwoNames('PS09999.1');
  const result = validateRawMutationIdentity([
    del({ id: 'delete-wrong', before: 'PS00000.1' }),
  ], { S1: source }, target, bmExact);
  assert.equal(result.status, 'BLOCKED');
  assert(result.errors.some((row) => row.code === 'DELETE_VALUE_NOT_EXACT_TARGET_PREIMAGE'));
}

console.log('CII BM-001 live-target preimage applicability checks: PASS');
