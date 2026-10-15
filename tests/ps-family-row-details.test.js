import assert from 'node:assert/strict';
import { createPsFamilyActiveReportExport, createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { renderPsFamilyReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';

const audit = {
  summary: { sourceFamily: 'PS-14396', supportGroupCount: 1, supportExceptionCount: 0, clashCount: 0 },
  supportSummaryRows: [{ no: 1, line: 'ASIM-1836-6"-S8810011-91261M7-HC-01', branchNode: 'ASIM-1836-6"-S8810011-91261M7-HC-01/B6', lineFamily: 'S8810011', psRoot: 'PS-14396', supportGroup: 'S8810011_PS-14396', supportMembers: ['PS-14396.4', 'PS-14396.8', 'PS-14396.9', 'PS-14396.10'], evidenceClashes: ['Clash4', 'Clash202', 'Clash603', 'Clash723', 'Clash1429'], status: 'OK' }],
  lineSupportTreeRows: [{ supportGroup: 'S8810011_PS-14396', treeText: 'Line: ASIM-1836-6"-S8810011-91261M7-HC-01\n└─ Branch: ASIM-1836-6"-S8810011-91261M7-HC-01/B6\n   └─ SupportGroup: S8810011_PS-14396\n      ├─ StructuralGroup\n      │  └─ GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14396\n      └─ Supports\n         ├─ PS-14396.4' }],
  structureContactRows: [{ supportGroup: 'S8810011_PS-14396', structuralGroup: 'GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14396', support: 'PS-14396.9', line: 'ASIM-1836-6"-S8810011-91261M7-HC-01', lineFamily: 'S8810011', branchNode: 'ASIM-1836-6"-S8810011-91261M7-HC-01/B6', contactClash: 'Clash603', distance: 0, point: { x: 1, y: 2, z: 3 } }],
  supportChainRows: [{ supportGroup: 'S8810011_PS-14396', supportA: 'PS-14396.4', supportB: 'PS-14396.8', line: 'ASIM-1836-6"-S8810011-91261M7-HC-01', lineFamily: 'S8810011', branchNode: 'ASIM-1836-6"-S8810011-91261M7-HC-01/B6', supportClash: 'Clash4', distance: -0.011, point: { x: 1, y: 2, z: 3 } }],
  supportMemberRows: [{ supportGroup: 'S8810011_PS-14396', representativeSupport: 'PS-14396.4', support: 'PS-14396.4', memberType: 'Support', connectedTo: ['PS-14396.8'], evidenceClashes: ['Clash4'], coverageRole: 'Representative', remarks: 'Representative support' }],
  supportExceptionRows: [],
  inputEvidenceRows: [{ sourceInput: 'Clash within Supports', clashName: 'Clash4', objectAType: 'Support', objectBType: 'Support', supportGroup: 'S8810011_PS-14396', parsedEdge: 'PS-14396.4 ↔ PS-14396.8' }],
  connectivityMatrixRows: [{ supportGroup: 'S8810011_PS-14396', from: 'PS-14396.4', to: 'PS-14396.8', edgeType: 'SupportChain', clash: 'Clash4', status: 'Connected' }],
  coverageRows: [],
  clashRows: [],
  diagnostics: [],
};

const summary = renderPsFamilyReports(audit, 'supportSummary', PS_FAMILY_CLASH_AUDIT_CONFIG, '');
assert.ok(summary.includes('S8810011_PS-14396'));
assert.ok(summary.includes('PS-14396.4'));
assert.ok(summary.includes('Clash603'));

const tree = renderPsFamilyReports(audit, 'lineSupportTree', PS_FAMILY_CLASH_AUDIT_CONFIG, '');
assert.ok(tree.includes('Line: ASIM-1836-6&quot;-S8810011-91261M7-HC-01'));
assert.ok(tree.includes('StructuralGroup'));
assert.ok(tree.includes('GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14396'));

const contacts = renderPsFamilyReports(audit, 'structureContacts', PS_FAMILY_CLASH_AUDIT_CONFIG, 'Clash603');
assert.ok(contacts.includes('Showing 1 of 1 matched rows from 1 total rows.'));
assert.ok(contacts.includes('PS-14396.9'));
assert.ok(contacts.includes('X 1 / Y 2 / Z 3'));

const chain = renderPsFamilyReports(audit, 'supportChain', PS_FAMILY_CLASH_AUDIT_CONFIG, 'Clash4');
assert.ok(chain.includes('PS-14396.4'));
assert.ok(chain.includes('PS-14396.8'));

const exports = createPsFamilyAuditExports(audit);
assert.equal(createPsFamilyActiveReportExport(audit, 'supportSummary').text, exports.supportSummaryCsv);
assert.equal(createPsFamilyActiveReportExport(audit, 'lineSupportTree').text, exports.lineSupportTreeCsv);
assert.match(exports.lineSupportTreeCsv, /SupportGroup,LineTree/);
assert.match(exports.supportSummaryCsv, /S8810011_PS-14396/);
assert.match(exports.supportChainCsv, /PS-14396\.8/);

console.log('ps-family-row-details tests passed');
