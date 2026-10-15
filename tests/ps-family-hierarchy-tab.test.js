import assert from 'node:assert/strict';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';
import { renderPsFamilyReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';

const audit = createPsFamilyClashAuditFromTextInputs({
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: { sourceSide: 'auto', sourceFamily: '', familyPrefixesText: 'PS, SL', posToleranceMm: 25 },
});

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.ok(PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs.some((tab) => tab.key === 'lineSupportTree'));
assert.ok(PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs.some((tab) => tab.key === 'structureTree'));
assert.ok(shell.includes('Line Tree'));
assert.ok(shell.includes('Structure Tree'));
assert.ok(shell.includes('SupportGroup Summary'));

const lineTree = renderPsFamilyReports(audit, 'lineSupportTree', PS_FAMILY_CLASH_AUDIT_CONFIG, '', 'lineTree');
assert.ok(lineTree.includes('Line Tree'));
assert.ok(lineTree.includes('S8810011_PS-14396'));
assert.ok(lineTree.includes('StructuralGroup'));
assert.ok(lineTree.includes('PS-14396.4'));
assert.ok(lineTree.includes('role="region"'));
assert.ok(lineTree.includes('tabindex="0"'));

const filteredLineTree = renderPsFamilyReports(audit, 'lineSupportTree', PS_FAMILY_CLASH_AUDIT_CONFIG, 'S8810011', 'lineTree');
assert.ok(filteredLineTree.includes('Showing 1 of 1 matched rows from 1 total rows.'));
assert.ok(filteredLineTree.includes('S8810011_PS-14396'));

const structureTree = renderPsFamilyReports(audit, 'structureTree', PS_FAMILY_CLASH_AUDIT_CONFIG, '', 'structureTree');
assert.ok(structureTree.includes('Structure Tree'));
assert.ok(structureTree.includes('Structure Path'));
assert.ok(structureTree.includes('S8810011_PS-14396'));
assert.ok(structureTree.includes('role="region"'));

const evidence = renderPsFamilyReports(audit, 'inputEvidence', PS_FAMILY_CLASH_AUDIT_CONFIG, 'Clash603', 'structureTree');
assert.ok(evidence.includes('Clash603'));
assert.ok(evidence.includes('StructureGroup vs Supports'));
assert.ok(!evidence.includes('Clash4</td>'));

const members = renderPsFamilyReports(audit, 'supportMembers', PS_FAMILY_CLASH_AUDIT_CONFIG, '', 'supportGroup');
assert.ok(members.includes('Representative Support'));
assert.ok(members.includes('PS-14396.4'));
assert.ok(members.includes('Support Members'));

console.log('ps-family-hierarchy-tab tests passed');
