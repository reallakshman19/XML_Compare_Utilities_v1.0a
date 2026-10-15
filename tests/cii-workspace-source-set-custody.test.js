import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ciiSha256, detectCiiNeutralVersion } from '../tabs/cii-workspace/cii-workspace-v11-v14-converter.js';
import {
  canonicalCiiSourceSetPreimage,
  ciiSourceSetSha256,
  intakeCiiWorkspaceSourceSet,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';

const cryptoRef = globalThis.crypto || webcrypto;
const EXPECTED = Object.freeze({
  S1: '9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b',
  S2: '7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd',
  S3: 'c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa',
  T: 'abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060',
});
const SOURCE_SET_SHA = '5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3';
const ORDER_DRIFT_SHA = '120ab89f1980d709cdaf41f37e105e16be35cfbc53cbefaee9fa8968dad15677';

async function bytes(name) {
  return new Uint8Array(await readFile(new URL(`../Benchmark/${name}.CII`, import.meta.url)));
}

function source(sourceId, value) {
  return Object.freeze({ sourceId, fileName: `${sourceId}.CII`, bytes: value });
}

const [s1, s2, s3, targetBytes] = await Promise.all([bytes('S1'), bytes('S2'), bytes('S3'), bytes('T')]);
const set = await intakeCiiWorkspaceSourceSet([
  source('S1', s1), source('S2', s2), source('S3', s3),
], { cryptoRef });

assert.equal(set.schema, 'CIIWorkspaceSourceSet.v1');
assert.equal(set.status, 'CUSTODY_READY');
assert.equal(set.authority, 'INDEPENDENT_SOURCE_MEMBERS');
assert.equal(set.mode, 'RAW_MEMBER_CUSTODY');
assert.equal(set.memberCount, 3);
assert.deepEqual(set.members.map((member) => member.sourceId), ['S1', 'S2', 'S3']);
assert.deepEqual(set.members.map((member) => member.originalSha256), [EXPECTED.S1, EXPECTED.S2, EXPECTED.S3]);
assert.deepEqual(set.members.map((member) => member.originalVersion), [14, 14, 14]);
assert.deepEqual(set.members.map((member) => member.normalizedSha256), [null, null, null]);
assert.deepEqual(set.members.map((member) => member.normalizedVersion), [null, null, null]);
assert.deepEqual(set.members.map((member) => member.normalizationStatus), ['NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
assert.equal(set.sourceSetSha256, SOURCE_SET_SHA);
assert.equal(await ciiSha256(targetBytes, cryptoRef), EXPECTED.T);
assert.equal(detectCiiNeutralVersion(targetBytes), 14);

const expectedPreimage = `S1:${EXPECTED.S1}\nS2:${EXPECTED.S2}\nS3:${EXPECTED.S3}\n`;
assert.equal(canonicalCiiSourceSetPreimage(set.members), expectedPreimage);
assert.equal(await ciiSourceSetSha256(set.members, cryptoRef), SOURCE_SET_SHA);

const reordered = await intakeCiiWorkspaceSourceSet([
  source('S1', s1), source('S3', s3), source('S2', s2),
], { cryptoRef });
assert.equal(reordered.sourceSetSha256, ORDER_DRIFT_SHA);
assert.notEqual(reordered.sourceSetSha256, set.sourceSetSha256, 'source member order is custody authority');

await assert.rejects(
  intakeCiiWorkspaceSourceSet([source('S1', s1), source('S1', s2)], { cryptoRef }),
  /CII_SOURCE_SET_DUPLICATE_SOURCE_ID/,
);
await assert.rejects(
  intakeCiiWorkspaceSourceSet([source('S1', s1)], { cryptoRef }),
  /CII_SOURCE_SET_TWO_OR_MORE_SOURCES_REQUIRED/,
);

console.log('CII Writer2 retained-real virtual source-set + target custody: PASS');
