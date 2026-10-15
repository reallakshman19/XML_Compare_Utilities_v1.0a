import assert from 'node:assert/strict';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';
import { createPsFamilyActiveReportExport, createPsFamilyAuditExports, PS_FAMILY_ACTIVE_EXPORTS } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';

const audit = createPsFamilyClashAuditFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: { evidenceMode: 'XML', sourceSide: 'auto', sourceFamily: '', familyPrefixesText: 'PS, SL', posToleranceMm: 25 },
});
const allExports = createPsFamilyAuditExports(audit);
assert.equal(audit.summary.sourceFamily, 'PS-14396');

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.ok(shell.includes('Export current report CSV'));
assert.ok(shell.includes('data-psfa="export-report-csv"'));
assert.ok(shell.includes('Support Group Summary CSV'));
assert.ok(shell.includes('Line Tree TXT'));
assert.ok(shell.includes('Structure Group Basis CSV'));
assert.ok(shell.includes('Audit Outcome CSV'));
assert.ok(shell.includes('Input Evidence CSV'));
assert.ok(shell.includes('Audit JSON'));
assert.ok(!shell.includes('StructureGroup Contacts CSV'));
assert.ok(!shell.includes('Support Chain CSV'));
assert.ok(!shell.includes('Connectivity Matrix CSV'));
assert.ok(!shell.includes('Clash Rows CSV'));

for (const tab of PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs) {
  const active = createPsFamilyActiveReportExport(audit, tab.key);
  const mapping = PS_FAMILY_ACTIVE_EXPORTS[tab.key];
  assert.ok(mapping, `${tab.key} must be exportable from the structured report workspace`);
  assert.equal(active.activeTab, tab.key);
  assert.equal(active.exportKey, mapping.exportKey);
  assert.equal(active.text, allExports[mapping.exportKey]);
  assert.equal(active.mime, 'text/csv', `${tab.key} report export must be CSV`);
}

const summary = createPsFamilyActiveReportExport(audit, 'supportSummary');
assert.equal(summary.suffix, 'supportgroup-summary');
assert.match(summary.text, /S8810011_PS-14396/);

const lineTree = createPsFamilyActiveReportExport(audit, 'lineSupportTree');
assert.equal(lineTree.suffix, 'line-tree');
assert.match(lineTree.text, /SupportGroup,LineTree/);
assert.match(lineTree.text, /S8810011_PS-14396/);

const structureTree = createPsFamilyActiveReportExport(audit, 'structureTree');
assert.equal(structureTree.suffix, 'structure-tree');
assert.match(structureTree.text, /StructureGroup,StructureMembers,Line,BranchNode,SupportGroup/);
assert.match(structureTree.text, /RepresentativeSupport/);
assert.match(structureTree.text, /StructurePath/);

const proximity = createPsFamilyActiveReportExport(audit, 'structureLineProximity');
assert.equal(proximity.suffix, 'structure-line-proximity');
assert.match(proximity.text, /TotalSupportCount/);

const evidence = createPsFamilyActiveReportExport(audit, 'inputEvidence');
assert.match(evidence.text, /Clash603/);
assert.match(evidence.text, /Clash1429/);

const filename = _test.activeReportFilename(summary, audit);
assert.equal(filename, 'ps-family-supportgroup-summary-PS-14396.csv');

const unknown = createPsFamilyActiveReportExport(audit, 'unknown-tab');
assert.equal(unknown, null);

console.log('ps-family-active-report-export tests passed');
