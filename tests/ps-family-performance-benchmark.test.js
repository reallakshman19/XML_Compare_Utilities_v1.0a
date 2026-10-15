import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';

const BENCHMARK_CONFIG = Object.freeze({ rowCount: 200, posToleranceMm: 25, maxDurationMs: 5000 });

function makeExpectedCsv(count) {
  const rows = ['Item Name'];
  for (let index = 1; index <= count; index += 1) rows.push(`/PS-70000.${index}`);
  return `${rows.join('\n')}\n`;
}

function makeDetailCsv(count) {
  const rows = ['Name of the element,p1bore,pipe,Position'];
  for (let index = 1; index <= count; index += 1) rows.push(`PS-70000.${index},25,ASIM-1835-1IN-D8810311-31441C4-PP-01,E ${index * 100}mm S 0mm U 0mm`);
  return `${rows.join('\n')}\n`;
}

const start = performance.now();
const audit = createPsFamilyClashAuditFromTextInputs({
  expectedCsvText: makeExpectedCsv(BENCHMARK_CONFIG.rowCount),
  detailCsvText: makeDetailCsv(BENCHMARK_CONFIG.rowCount),
  config: { sourceSide: 'auto', sourceFamily: '', posToleranceMm: BENCHMARK_CONFIG.posToleranceMm },
});
const exports = createPsFamilyAuditExports(audit);
const durationMs = performance.now() - start;

assert.equal(audit.summary.expectedCount, BENCHMARK_CONFIG.rowCount);
assert.equal(audit.summary.missingCount, BENCHMARK_CONFIG.rowCount);
assert.equal(audit.summary.posFamilyCount, BENCHMARK_CONFIG.rowCount);
assert.ok(exports.coverageCsv.includes('PS-70000.200'));
assert.ok(exports.auditJson.includes('ps-family-clash-audit/v1'));
assert.ok(durationMs < BENCHMARK_CONFIG.maxDurationMs, `PS family benchmark took ${durationMs.toFixed(2)} ms`);

console.log(`ps-family-performance-benchmark tests passed in ${durationMs.toFixed(2)} ms`);
