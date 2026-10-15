import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  assertCiiWriter2V14ShadowIdentity,
  createCiiWriter2V14LosslessShadow,
} from '../tabs/cii-workspace/cii-workspace-v14-writer2-shadow.js';

const EXPECTED_T_SHA256 = 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060';
const EXPECTED_SHADOW_SHA256 = '5dd691b5ecd6c9ae875f9b78666bb73b812158870e07cb1a000e1c54295558a9';

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function bytes(name) { return new Uint8Array(await readFile(new URL(`../Benchmark/${name}.CII`, import.meta.url))); }

const [s1, s2, s3, target] = await Promise.all([bytes('S1'), bytes('S2'), bytes('S3'), bytes('T')]);
assert.equal(sha256(target), EXPECTED_T_SHA256);

for (const [name, source] of [['S1', s1], ['S2', s2], ['S3', s3]]) {
  const shadow = createCiiWriter2V14LosslessShadow(source);
  assert.equal(shadow.audit.status, 'PASS');
  assert.equal(shadow.audit.maskedFieldCount, 0, `${name} has no unsupported non-zero V14 SIF shadow fields`);
  assert.equal(sha256(shadow.outputBytes), sha256(source), `${name} shadow is byte-identical`);
}

const first = createCiiWriter2V14LosslessShadow(target);
assert.equal(first.audit.status, 'PASS');
assert.equal(first.audit.policy, 'MASK_ONLY_V14_SIF_FIELDS_WITHOUT_QUALIFIED_V11_SEMANTIC_SLOT_IN_CONVERSION_SHADOW');
assert.equal(first.audit.recordCount, 51);
assert.equal(first.audit.maskedFieldCount, 26);
assert.equal(first.audit.ledger.length, 26);
assert.equal(first.audit.ledger[0].record, 1);
assert.equal(first.audit.ledger[0].tee, 1);
assert.equal(first.audit.ledger[0].item, 27);
assert.equal(first.audit.ledger[0].originalField.trim(), '3.210000E+02');
assert.ok(first.audit.ledger.every((row) => row.item === 27));
assert.equal(sha256(first.outputBytes), EXPECTED_SHADOW_SHA256);
assert.equal(sha256(target), EXPECTED_T_SHA256, 'shadow construction never mutates original T bytes');

const second = createCiiWriter2V14LosslessShadow(target);
assert.deepEqual(assertCiiWriter2V14ShadowIdentity(first.audit, second.audit), {
  status: 'PASS', maskedFieldCount: 26, maskIdentity: first.audit.maskIdentity,
});
assert.equal(sha256(second.outputBytes), EXPECTED_SHADOW_SHA256, 'shadow is deterministic');

const shiftedText = new TextDecoder('utf-8').decode(target).replace('#$ SIF&TEES', '\r\n#$ SIF&TEES');
const shifted = createCiiWriter2V14LosslessShadow(new TextEncoder().encode(shiftedText));
assert.notEqual(shifted.audit.ledger[0].byteStart, first.audit.ledger[0].byteStart, 'fixture shifts physical SIF offsets');
assert.equal(assertCiiWriter2V14ShadowIdentity(first.audit, shifted.audit).status, 'PASS', 'shadow identity is semantic, not offset-based');

const changedProtected = new Uint8Array(target);
const firstProtectedSpan = first.audit.ledger[0];
changedProtected[firstProtectedSpan.byteStart + 1] = '4'.charCodeAt(0);
const changedShadow = createCiiWriter2V14LosslessShadow(changedProtected);
assert.throws(
  () => assertCiiWriter2V14ShadowIdentity(first.audit, changedShadow.audit),
  /CII_WRITER2_V14_SHADOW_PROTECTED_DATA_CHANGED/,
);

console.log('CII Writer2 retained-real V14 target conversion shadow: PASS');
