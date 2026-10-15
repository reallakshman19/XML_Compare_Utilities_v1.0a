import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { extractRevisionCompareTransferArchiveBundle, renderRevisionCompareTransferArchiveHtml } from '../tabs/revision-compare/revision-transfer-archive-html.js';
import { clone, cryptoRef, transferArchiveFixture } from './revision-compare-transfer-archive-fixtures.mjs';

const COUNTS = Object.freeze({ differences: 180_000, reviews: 95_000, decisions: 40_000, operations: 120_000, auditRows: 120_000 });
const encoder = new TextEncoder();
function id(prefix, index) { return `${prefix}${String(index).padStart(6, '0')}`; }
function elapsed(start) { return Number((performance.now() - start).toFixed(1)); }
function heapMiB() { return Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)); }
function rows(count, build) { return Array.from({ length: count }, (_, index) => build(index)); }
function tableBounds(html, caption) {
  const marker = `<caption>${caption}</caption>`; const captionAt = html.indexOf(marker);
  assert.notEqual(captionAt, -1, `${caption} is missing.`);
  const start = html.indexOf('<tbody>', captionAt) + 7; const end = html.indexOf('</tbody>', start);
  assert.ok(start >= 7 && end > start, `${caption} tbody is missing.`); return { start, end };
}
function countRows(html, bounds) {
  let count = 0; let cursor = bounds.start;
  while (true) { cursor = html.indexOf('<tr>', cursor); if (cursor < 0 || cursor >= bounds.end) return count; count += 1; cursor += 4; }
}
function assertRegister(html, caption, expected, first, last) {
  const bounds = tableBounds(html, caption); assert.equal(countRows(html, bounds), expected);
  assert.ok(html.indexOf(first, bounds.start) < bounds.end, `${caption} first identity is missing.`);
  assert.ok(html.indexOf(last, bounds.start) < bounds.end, `${caption} last identity is missing.`);
}
function populate(bundle) {
  const evidence = bundle.payload.evidencePackage.payload;
  evidence.audit.differenceRows = rows(COUNTS.differences, (index) => ({ differenceId: id('D', index), differenceCategory: 'MODIFIED', changeReason: 'C', sourceRecordId: id('A', index), targetRecordId: id('B', index), changedProperties: ['p'] }));
  evidence.reviewSession.items = rows(COUNTS.reviews, (index) => ({ differenceId: id('D', index), reviewState: 'REVIEWED', note: 'N', updatedAt: '2026-07-25T00:00:00.000Z' }));
  evidence.decisionLedger.decisions = rows(COUNTS.decisions, (index) => ({ differenceId: id('D', index), decisionState: 'ACCEPTED_CANDIDATE', acceptedTargetDifferenceId: id('T', index), rationale: 'R', updatedAt: '2026-07-25T00:00:00.000Z' }));
  bundle.payload.transferPlan.operations = rows(COUNTS.operations, (index) => ({ operationId: id('OP', index), operationType: 'REPLACE_FIELD', sourceEntityId: id('A', index), targetEntityId: id('B', index), targetCanonicalPath: '/', fieldPath: '/p', beforeValue: 0, afterValue: 1, status: 'READY' }));
  bundle.payload.transferAudit.rows = rows(COUNTS.auditRows, (index) => ({ operationId: id('OP', index), status: 'APPLIED', sourceEntityId: id('A', index), targetEntityId: id('B', index), fieldPath: '/p', reason: '' }));
  return bundle;
}

const fixture = await transferArchiveFixture(); const bundleStart = performance.now();
const bundle = populate(clone(fixture.workspace.transferCompletion.bundle));
const bundleDurationMs = elapsed(bundleStart); const heapAfterBundleMiB = heapMiB();
let sourceText = JSON.stringify(bundle); const sourceBundleBytes = encoder.encode(sourceText).byteLength; sourceText = null; globalThis.gc?.();
const renderStart = performance.now(); let html = renderRevisionCompareTransferArchiveHtml(bundle);
const renderDurationMs = elapsed(renderStart); const heapAfterRenderMiB = heapMiB(); const htmlBytes = encoder.encode(html).byteLength;
assertRegister(html, 'Complete difference register', COUNTS.differences, id('D', 0), id('D', COUNTS.differences - 1));
assertRegister(html, 'Complete review register', COUNTS.reviews, id('D', 0), id('D', COUNTS.reviews - 1));
assertRegister(html, 'Complete ambiguity-decision register', COUNTS.decisions, id('D', 0), id('D', COUNTS.decisions - 1));
assertRegister(html, 'Transfer operations', COUNTS.operations, id('OP', 0), id('OP', COUNTS.operations - 1));
assertRegister(html, 'Applied transfer audit', COUNTS.auditRows, id('OP', 0), id('OP', COUNTS.auditRows - 1));
const parseStart = performance.now(); let extracted = extractRevisionCompareTransferArchiveBundle(html);
const reparseDurationMs = elapsed(parseStart); assert.equal(extracted.payload.evidencePackage.payload.audit.differenceRows.length, COUNTS.differences);
assert.equal(extracted.payload.evidencePackage.payload.reviewSession.items.length, COUNTS.reviews);
assert.equal(extracted.payload.evidencePackage.payload.decisionLedger.decisions.length, COUNTS.decisions);
assert.equal(extracted.payload.transferPlan.operations.length, COUNTS.operations); assert.equal(extracted.payload.transferAudit.rows.length, COUNTS.auditRows);
extracted = null; const digestStart = performance.now(); const firstHash = await sha256Text(html, cryptoRef); const digestDurationMs = elapsed(digestStart);
html = null; globalThis.gc?.(); const repeatStart = performance.now(); const repeated = renderRevisionCompareTransferArchiveHtml(bundle);
const repeatRenderDurationMs = elapsed(repeatStart); const repeatedHash = await sha256Text(repeated, cryptoRef);
assert.equal(repeatedHash, firstHash); assert.equal(encoder.encode(repeated).byteLength, htmlBytes);
const measurements = { counts: COUNTS, sourceBundleBytes, htmlBytes, bundleDurationMs, renderDurationMs, reparseDurationMs, digestDurationMs, repeatRenderDurationMs, heapAfterBundleMiB, heapAfterRenderMiB, finalHeapMiB: heapMiB(), contentSha256: firstHash };
console.log(JSON.stringify(measurements, null, 2));
console.log('revision-compare-transfer-archive-scale.test.mjs passed');
