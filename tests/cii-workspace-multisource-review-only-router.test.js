import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { _test as routerTest } from '../tabs/cii-workspace/cii-workspace-multisource-review-only-router.js';

const cryptoRef = globalThis.crypto || webcrypto;
const benchmark = (name) => fileURLToPath(new URL(`../Benchmark/${name}`, import.meta.url));
function fileLike(name, bytes) {
  return Object.freeze({ name, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } });
}

const [s1, s2, s3, target] = await Promise.all([
  readFile(benchmark('S1.CII')), readFile(benchmark('S2.CII')), readFile(benchmark('S3.CII')), readFile(benchmark('T.CII')),
]);

const retained = await routerTest.classifyMultiSourceFiles([
  fileLike('renamed-third.CII', s3), fileLike('renamed-first.CII', s1), fileLike('renamed-second.CII', s2),
], fileLike('renamed-target.CII', target), cryptoRef);
assert.equal(retained.retained, true, 'exact retained bytes must delegate to the existing full Writer2 shell regardless of input order or file name');
assert.equal(retained.sourceBytes.length, 3);
assert.match(retained.targetSha256, /^[0-9a-f]{64}$/);

const wrongTarget = Buffer.from(target); wrongTarget[0] ^= 1;
const reviewOnly = await routerTest.classifyMultiSourceFiles([
  fileLike('S1-any-name.CII', s1), fileLike('S2-any-name.CII', s2), fileLike('S3-any-name.CII', s3),
], fileLike('wrong-target.CII', wrongTarget), cryptoRef);
assert.equal(reviewOnly.retained, false, 'target custody drift must never enter retained Writer2 write mode');

const twoSource = await routerTest.classifyMultiSourceFiles([
  fileLike('alpha.CII', s1), fileLike('beta.CII', s2),
], fileLike('arbitrary-target.CII', target), cryptoRef);
assert.equal(twoSource.retained, false, 'generic 2-source input must route to REVIEW_ONLY');
assert.equal(routerTest.threePermutations(['a', 'b', 'c']).length, 6);
assert.deepEqual(routerTest.genericSources([fileLike('A.CII', s1), fileLike('B.CII', s2)], [s1, s2]).map((row) => row.sourceId), ['S1', 'S2']);

const automaticLoop = Object.freeze([{ baseId: 'AUTO-S1', method: 'METHOD_A_SPATIAL', anchorPairs: Object.freeze([{ sourceNodeId: '10', targetNodeId: '20' }]) }]);
const auto = Object.freeze({
  choices: Object.freeze([
    Object.freeze({ sourceId: 'S1', fileName: 'A.CII', status: 'READY', baseLoops: automaticLoop, sourceNodeId: '10', targetNodeId: '20' }),
    Object.freeze({ sourceId: 'S2', fileName: 'B.CII', status: 'REVIEW', baseLoops: Object.freeze([]), reason: 'AMBIGUOUS' }),
  ]),
  baseLoopsBySource: Object.freeze({ S1: automaticLoop }),
  unresolved: Object.freeze(['S2']),
  ready: false,
});
assert.equal(routerTest.baseAuthorityState(auto, {}).ready, false, 'unresolved Auto Anchor must remain blocked without reviewed fallback');
assert.equal(routerTest.validManualNode('00330'), '330');
assert.equal(routerTest.validManualNode('abc'), null);
const manualBySource = { S2: [{ sourceNodeId: '330', targetNodeId: '440' }] };
const authority = routerTest.baseAuthorityState(auto, manualBySource);
assert.equal(authority.ready, true, 'reviewed manual fallback must complete base authority for an unresolved member');
assert.deepEqual(authority.unresolved, []);
assert.deepEqual(routerTest.manualAnchorPairsBySource(auto, manualBySource), { S2: [{ sourceNodeId: '330', targetNodeId: '440' }] });
assert.equal(routerTest.manualAnchorPairsBySource(auto, { S1: [{ sourceNodeId: '10', targetNodeId: '20' }], S2: manualBySource.S2 }).S1, undefined,
  'manual input must not replace a deterministic automatic base');

const inspectionCustody = {
  sourceSet: {
    sourceSetSha256: 'source-set-sha',
    members: [
      { sourceId: 'S1', fileName: 'A.CII', originalVersion: 14, normalizedVersion: 11, originalSha256: 'a'.repeat(64), normalizedSha256: '1'.repeat(64) },
      { sourceId: 'S2', fileName: 'B.CII', originalVersion: 11, normalizedVersion: 11, originalSha256: 'b'.repeat(64), normalizedSha256: '2'.repeat(64) },
    ],
  },
  versionBridge: { target: { originalSha256: 't'.repeat(64) } },
};
const state = { sources: [{}, {}], inspection: inspectionCustody, auto, manualBySource };
const inspection = routerTest.inspectionMarkup(state);
assert.match(inspection, /Writer 2 multi-source custody/);
assert.match(inspection, /source-set-sha/);
assert.match(inspection, /A\.CII/);
assert.match(inspection, /B\.CII/);
assert.match(inspection, /TARGET original SHA/);
assert.match(inspection, /S2 manual fallback/);
assert.match(inspection, /USER LOCKED/);
assert.match(inspection, /data-ciiw-ms-review-only-manual-add/);
assert.match(inspection, /data-ciiw-ms-review-only-compare/);
assert.doesNotMatch(inspection, /data-ciiw-ms-apply/);
assert.doesNotMatch(inspection, /data-ciiw-ms-bind-expected/);

const waiting = routerTest.waitingMarkup(state);
assert.match(waiting, /READY FOR REVIEW/);
assert.match(waiting, /CII_MS_REVIEW_ONLY_WRITE_AUTHORITY_REQUIRED/);
assert.doesNotMatch(waiting, /data-ciiw-ms-apply/);
assert.doesNotMatch(waiting, /data-ciiw-ms-bind-expected/);

const routerSource = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-router.js', import.meta.url), 'utf8');
assert(routerSource.split('\n').length < 300, 'review-only router must remain below 300 lines');
assert(routerSource.includes('mountCiiWriter2MultiSourceShell'), 'exact retained route must still delegate to existing full Writer2 shell');
assert(routerSource.includes('ciiSourceSetCustodyMarkup(state.inspection)'), 'generic REVIEW_ONLY inspection must expose bound source-set/target custody');
assert(!routerSource.includes('applyCiiWorkspaceTargetWriter2'), 'generic router must not import Writer2 apply');
assert(routerSource.includes('anchorPairsBySource: manualAnchorPairsBySource'), 'manual fallback must bind only as correspondence anchor-pair authority');

console.log('CII Writer2 retained delegation + generic REVIEW_ONLY custody/manual-anchor checks passed.');
