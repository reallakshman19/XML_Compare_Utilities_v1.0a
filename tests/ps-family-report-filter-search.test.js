import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';
import { filterPsFamilyRows, renderPsFamilyReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';

const audit = {
  summary: { sourceFamily: 'PS-14396', supportGroupCount: 1, supportExceptionCount: 0, clashCount: 2 },
  supportSummaryRows: [
    { no: 1, line: 'ASIM-1836-6"-S8810011-91261M7-HC-01', branchNode: 'ASIM-1836-6"-S8810011-91261M7-HC-01/B6', lineFamily: 'S8810011', psRoot: 'PS-14396', supportGroup: 'S8810011_PS-14396', supportMembers: ['PS-14396.4', 'PS-14396.8'], evidenceClashes: ['Clash4'], status: 'OK' },
  ],
  inputEvidenceRows: [
    { sourceInput: 'Clash within Supports', clashName: 'Clash4', objectAType: 'Support', objectBType: 'Support', lineFamily: 'S8810011', branchNode: '.../B6', supportGroup: 'S8810011_PS-14396', distance: -0.011, parsedEdge: 'PS-14396.4 ↔ PS-14396.8' },
    { sourceInput: 'StructureGroup vs Supports', clashName: 'Clash603', objectAType: 'StructuralGroup', objectBType: 'Support', lineFamily: 'S8810011', branchNode: '.../B6', supportGroup: 'S8810011_PS-14396', distance: 0, parsedEdge: 'GENSEC ↔ PS-14396.9' },
  ],
  structureContactRows: [],
  supportChainRows: [],
  supportMemberRows: [],
  supportExceptionRows: [],
  connectivityMatrixRows: [],
  coverageRows: [],
  clashRows: [
    { clashName: 'Sample Clash 1', distance: -0.01, familyStatus: 'IN_FAMILY', source: { familyRoot: 'PS-90001', objectName: 'PS-90001-BAR-1', path: [] }, against: { memberName: 'PS-90001.1', pipe: { lineFamily: 'D90001', fullBranchNode: 'SAMPLE-100-D90001-31441C4-PP-01/B1' }, path: [] }, elementDetail: { posFamilyId: 'POSF-000001', lineFamily: 'D90001' } },
    { clashName: 'Sample Clash 2', distance: -0.005, familyStatus: 'OUT_OF_FAMILY', source: { familyRoot: 'PS-90001', objectName: 'PS-90001-BAR-1', path: [] }, against: { memberName: 'PS-90002.1', pipe: { lineFamily: 'P90002', fullBranchNode: 'SAMPLE-50-P90002-31441C4-PP-01/B1' }, path: [] }, elementDetail: { posFamilyId: '', lineFamily: '' } },
  ],
  diagnostics: [],
};

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.ok(shell.includes('Search selected report'));
assert.ok(shell.includes('data-psfa="report-search"'));

const summaryByLine = renderPsFamilyReports(audit, 'supportSummary', PS_FAMILY_CLASH_AUDIT_CONFIG, 's8810011');
assert.ok(summaryByLine.includes('Showing 1 of 1 matched rows from 1 total rows.'));
assert.ok(summaryByLine.includes('S8810011_PS-14396'));
assert.ok(summaryByLine.includes('PS-14396.4'));

const evidenceByClash = renderPsFamilyReports(audit, 'inputEvidence', PS_FAMILY_CLASH_AUDIT_CONFIG, 'Clash603');
assert.ok(evidenceByClash.includes('Showing 1 of 1 matched rows from 2 total rows.'));
assert.ok(evidenceByClash.includes('StructureGroup vs Supports'));
assert.ok(!evidenceByClash.includes('Clash4</td>'));

const clashByLine = renderPsFamilyReports(audit, 'clashRows', PS_FAMILY_CLASH_AUDIT_CONFIG, 'D90001');
assert.ok(clashByLine.includes('Showing 1 of 1 matched rows from 2 total rows.'));
assert.ok(clashByLine.includes('PS-90001.1'));
assert.ok(!clashByLine.includes('PS-90002.1'));

const unfilteredSummary = renderPsFamilyReports(audit, 'supportSummary', PS_FAMILY_CLASH_AUDIT_CONFIG, '');
assert.ok(unfilteredSummary.includes('Showing 1 of 1 rows.'));
assert.ok(unfilteredSummary.includes('S8810011_PS-14396'));

const rows = [{ value: 'Alpha' }, { value: 'beta' }];
const headers = [{ label: 'Value', value: (row) => row.value }];
assert.deepEqual(filterPsFamilyRows(headers, rows, 'ALPHA'), [rows[0]]);
assert.equal(filterPsFamilyRows(headers, rows, '').length, 2);

const tabSource = readFileSync('tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js', 'utf8');
assert.match(tabSource, /createPsFamilyAuditExports\(state\.audit\)/);

const exports = createPsFamilyAuditExports(audit);
assert.match(exports.supportSummaryCsv, /S8810011_PS-14396/);
assert.match(exports.inputEvidenceCsv, /Clash603/);
assert.match(exports.clashRowsCsv, /PS-90002\.1/);

console.log('ps-family-report-filter-search tests passed');
