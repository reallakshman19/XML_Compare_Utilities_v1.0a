import assert from 'node:assert/strict';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { createPsFamilyAuditExports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-export.js';
import { buildSupportChangeReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-engine.js';
import { parseSupportChangeXml } from '../tabs/ps-family-clash-audit/ps-family-psclash-xml-parser.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { extractFamilyRoot } from '../tabs/ps-family-clash-audit/ps-family-token-utils.js';
import { renderPsFamilyReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';

assert.equal(extractFamilyRoot('PS-14221.1'), 'PS-14221');
assert.equal(extractFamilyRoot('GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14236'), 'PS-14236');

const structureParsed = parseSupportChangeXml(
  PS_FAMILY_SAMPLE_STRUCTURE_XML,
  { familyPrefixesText: 'PS, SL' },
  'StructureGroup vs Supports',
);
const supportParsed = parseSupportChangeXml(
  PS_FAMILY_SAMPLE_SUPPORT_XML,
  { familyPrefixesText: 'PS, SL' },
  'Clash within Supports',
);
assert.equal(structureParsed.rows.length, 2);
assert.equal(supportParsed.rows.length, 3);
assert.equal(structureParsed.rows[0].edgeType, 'StructuralContact');
assert.equal(supportParsed.rows[0].edgeType, 'SupportChain');
assert.equal(structureParsed.rows[0].supportGroup, 'S8810011_PS-14396');
assert.equal(supportParsed.rows[0].supportGroup, 'S8810011_PS-14396');

const audit = createPsFamilyClashAuditFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: { evidenceMode: 'XML', sourceSide: 'auto', sourceFamily: '', familyPrefixesText: 'PS, SL', posToleranceMm: 25 },
});
assert.equal(audit.summary.supportGroupCount, 1);
assert.equal(audit.summary.supportExceptionCount, 0);
assert.equal(audit.supportSummaryRows[0].supportGroup, 'S8810011_PS-14396');
assert.equal(audit.supportSummaryRows[0].psRoot, 'PS-14396');
assert.deepEqual(audit.supportSummaryRows[0].supportMembers, ['PS-14396.4', 'PS-14396.8', 'PS-14396.9', 'PS-14396.10']);
assert.equal(audit.structureContactRows.length, 2);
assert.equal(audit.supportChainRows.length, 3);
assert.equal(audit.supportMemberRows.find((row) => row.memberType === 'StructuralGroup').support, 'GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14396');
assert.ok(audit.lineSupportTreeRows[0].treeText.includes('SupportGroup: S8810011_PS-14396'));
assert.ok(audit.lineSupportTreeRows[0].treeText.includes('StructuralGroup'));

const directReports = buildSupportChangeReports(structureParsed.rows, supportParsed.rows, []);
assert.deepEqual(directReports.supportSummaryRows, audit.supportSummaryRows);

const baseLine = {
  supportGroup: 'D8810084_PS-100',
  lineFamily: 'D8810084',
  fullLineTag: 'LINE-1',
  branchNode: 'LINE-1/B1',
  psRoot: 'PS-100',
};
const structureContact = {
  ...baseLine,
  edgeType: 'StructuralContact',
  structuralGroup: 'PS-100-BAR-1',
  structuralRoot: 'PS-100',
  support: 'PS-100.1',
  supportRoots: ['PS-100'],
  clashName: 'Structure1',
  sourceInput: 'StructureGroup vs Supports',
};
const supportChain = {
  ...baseLine,
  edgeType: 'SupportChain',
  supportA: 'PS-100.1',
  supportB: 'PS-100.2',
  supportRoots: ['PS-100'],
  clashName: 'Chain1',
  sourceInput: 'Clash within Supports',
};
assert.equal(buildSupportChangeReports([], [supportChain], []).supportExceptionRows[0].exceptionCode, 'SUPPORT_GROUP_WITHOUT_STRUCTURAL_GROUP');
assert.equal(buildSupportChangeReports([structureContact], [{ ...supportChain, supportB: 'PS-101.2', supportRoots: ['PS-100', 'PS-101'] }], []).supportExceptionRows[0].exceptionCode, 'STRANGER_SUPPORT_PS_WITHIN_SUPPORT_CHAIN');
assert.equal(buildSupportChangeReports([{ ...structureContact, supportGroup: '' }], [], []).supportExceptionRows[0].exceptionCode, 'ORPHAN_STRUCTURAL_GROUP');

const supportSummaryHtml = renderPsFamilyReports(audit, 'supportSummary', PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.ok(supportSummaryHtml.includes('SupportGroup Summary'));
assert.ok(supportSummaryHtml.includes('S8810011_PS-14396'));
assert.ok(renderPsFamilyReports(audit, 'supportExceptions', PS_FAMILY_CLASH_AUDIT_CONFIG).includes('Audit Exceptions'));

const exports = createPsFamilyAuditExports(audit);
assert.match(exports.supportSummaryCsv, /S8810011_PS-14396/);
assert.match(exports.lineSupportTreeText, /S8810011_PS-14396/);
assert.match(exports.inputEvidenceCsv, /Clash603/);

const stableTabs = PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs
  .filter((tab) => tab.maturity === 'stable')
  .map((tab) => tab.key);
assert.deepEqual(stableTabs, [
  'supportSummary',
  'structureLineProximity',
  'lineSupportTree',
  'structureTree',
  'inputEvidence',
  'supportExceptions',
  'diagnostics',
]);
assert.ok(PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs.some((tab) => tab.maturity === 'draft'));

console.log('ps-family-supportchange-report tests passed');
