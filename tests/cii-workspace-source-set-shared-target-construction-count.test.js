import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { inspectCiiWorkspaceSourceSetWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-source-set.js';
import { inspectCiiWorkspaceModelsWithVersionBridge } from '../tabs/cii-workspace/cii-workspace-writer-version-bridge.js';

// Real (small) neutral-CII fixture, already used as the intake oracle by
// cii-workspace-intake.test.js. It is V11, so this test never depends on the
// browser-only V11<->V14 Worker conversion path.
const cryptoRef = globalThis.crypto || webcrypto;
const targetText = await readFile(new URL('../Benchmark/Pipeline/CII', import.meta.url), 'utf8');
const TARGET_FILE_NAME = 'TARGET.CII';

function createConstructionCounters() {
  const counts = Object.create(null);
  return { record(event) { counts[event] = (counts[event] || 0) + 1; }, counts };
}

const sources = ['S1', 'S2', 'S3'].map((sourceId) => (
  Object.freeze({ sourceId, fileName: `${sourceId}.CII`, text: targetText })
));

const instrumentation = createConstructionCounters();
const result = await inspectCiiWorkspaceSourceSetWithVersionBridge({
  sources, targetText, targetFileName: TARGET_FILE_NAME,
}, { cryptoRef, instrumentation });

// --- Issue #1232 required runtime construction counts for one retained session ---
assert.equal(instrumentation.counts.TARGET_NORMALIZE, 1, 'TARGET normalization must run exactly once per source-set session');
assert.equal(instrumentation.counts.TARGET_INTAKE, 1, 'TARGET intake/parse must run exactly once per source-set session');
assert.equal(instrumentation.counts.TARGET_TOPOLOGY, 1, 'TARGET topology build must run exactly once per source-set session');
assert.equal(instrumentation.counts.SOURCE_NORMALIZE, sources.length, 'each SOURCE must still be normalized independently');
assert.equal(instrumentation.counts.SOURCE_INTAKE, sources.length, 'each SOURCE must still be intaken independently');
assert.equal(instrumentation.counts.SOURCE_TOPOLOGY, sources.length, 'each SOURCE topology graph must still be built independently');
assert.equal(result.memberInspections.length, sources.length, 'member inspections must equal the number of sources');

// --- All members must observe the identical prepared/shared TARGET ---
const targetHashes = result.memberInspections.map((member) => member.inspection.target.contentSha256);
assert.equal(new Set(targetHashes).size, 1, 'every member inspection must reference the identical prepared TARGET content hash');

// --- Prepared-model vs legacy single-pair API parity (issue #1232 required outcome) ---
// The pre-existing pair-oriented API is left completely unchanged by this revision,
// so it is the independent oracle: identical bytes through the old restart-from-bytes
// path and the new shared-TARGET path must produce equivalent evidence.
for (let index = 0; index < sources.length; index += 1) {
  const source = sources[index];
  const legacy = await inspectCiiWorkspaceModelsWithVersionBridge({
    sourceText: source.text, sourceFileName: source.fileName,
    targetText, targetFileName: TARGET_FILE_NAME,
  }, { cryptoRef, writerVersion: '2' });
  const prepared = result.memberInspections[index].inspection;

  assert.deepEqual(prepared.source, legacy.source, `${source.sourceId}: prepared SOURCE inspection must match legacy single-pair SOURCE inspection`);
  assert.deepEqual(prepared.target, legacy.target, `${source.sourceId}: prepared TARGET inspection must match legacy single-pair TARGET inspection`);
  assert.deepEqual(prepared.baseAnchorSuggestions, legacy.baseAnchorSuggestions, `${source.sourceId}: base anchor suggestions must match`);
  assert.deepEqual(prepared.versionBridge.target, legacy.versionBridge.target, `${source.sourceId}: TARGET version-bridge evidence must match`);
  assert.deepEqual(prepared.versionBridge.source, legacy.versionBridge.source, `${source.sourceId}: SOURCE version-bridge evidence must match`);
}

console.log('PASS cii-workspace source-set shared-TARGET construction-count + prepared/legacy parity');
