import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';

const clashXmlText = readFileSync('samples/ps-family-clash-audit/sample-clash.xml', 'utf8');
const expectedCsvText = readFileSync('samples/ps-family-clash-audit/sample-expected.csv', 'utf8');
const detailCsvText = readFileSync('samples/ps-family-clash-audit/sample-element-detail.csv', 'utf8');

const audit = createPsFamilyClashAuditFromTextInputs({
  clashXmlText,
  expectedCsvText,
  detailCsvText,
  config: { sourceSide: 'auto', sourceFamily: '', posToleranceMm: 25 },
});

assert.equal(audit.summary.sourceFamily, 'PS-90001');
assert.equal(audit.summary.expectedCount, 3);
assert.equal(audit.summary.clashCount, 2);
assert.equal(audit.summary.foundExactCount, 1);
assert.equal(audit.summary.missingCount, 2);
assert.equal(audit.summary.outOfFamilyCount, 1);
assert.equal(audit.coverageRows.find((row) => row.expectedMember === 'Copy-(2)-of-PS-90001.3').status, 'MISSING');
assert.equal(audit.outOfFamilyRows[0].against.memberName, 'PS-90002.1');
assert.ok(audit.sourceVsPosFamilyRows.find((row) => row.source === 'PS-90001'));

const exports = createPsFamilyAuditExports(audit);
assert.match(exports.coverageCsv, /Copy-\(2\)-of-PS-90001\.3/);
assert.match(exports.clashRowsCsv, /PS-90002\.1/);
assert.match(exports.posFamiliesCsv, /POSF-/);
assert.match(exports.auditJson, /"sourceFamily": "PS-90001"/);

console.log('ps-family-sample-fixtures tests passed');
