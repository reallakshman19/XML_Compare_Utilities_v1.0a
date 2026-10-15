import assert from 'node:assert/strict';
import { createPsFamilyClashAuditFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { describeBrowserFile, readBrowserTextFile } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-file-io.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG, readPsFamilyUiSettings, resolvePsFamilyClashAuditConfig } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { renderPsFamilyReports } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';

const config = resolvePsFamilyClashAuditConfig({ posToleranceMm: 35, inputRows: 3 });
assert.equal(config.posToleranceMm, 35);
assert.equal(config.inputRows, 3);
assert.equal(config.launcher.label, 'PS / SL Family Evidence Audit');
assert.equal(config.defaultEvidenceMode, 'RELATIONSHIP_BUNDLE');
assert.equal(config.evidenceModes.length, 2);
assert.equal(config.familyPrefixesText, 'PS, SL');
assert.match(config.structuralZonesText, /CU-SU/);
assert.match(config.supportZonesText, /PS-/);
assert.equal(config.sourceSideOptions.length, 3);
assert.equal(config.inputFiles.length, 3);
assert.deepEqual(config.inputFiles.map((item) => item.key), ['bundle', 'structure', 'support']);
assert.equal(config.reportTabs.length, 12);
assert.equal(config.reportGroups.length, 6);
assert.deepEqual(config.reportGroups.map((group) => group.label), [
  'Support Group',
  'Structure Group Basis',
  'Line Tree',
  'Structure Tree',
  'Evidence Summary',
  'Audit Outcome',
]);
assert.deepEqual(config.reportGroups.find((group) => group.key === 'supportGroup').reportKeys, ['supportSummary', 'supportChain', 'supportMembers']);
assert.deepEqual(config.reportGroups.find((group) => group.key === 'structureBasis').reportKeys, ['structureLineProximity', 'structureContacts']);
assert.deepEqual(config.reportGroups.find((group) => group.key === 'evidenceSummary').reportKeys, ['supportSummary', 'connectivityMatrix', 'clashRows']);
assert.ok(config.reportTabs.some((tab) => tab.key === 'supportSummary' && tab.label === 'SupportGroup Summary' && tab.maturity === 'stable'));
assert.ok(config.reportTabs.some((tab) => tab.key === 'supportChain' && tab.label === 'Support Chain Report'));
assert.ok(config.reportTabs.some((tab) => tab.key === 'structureLineProximity' && tab.label === 'StructureGroup Line Support Basis'));
assert.ok(config.reportTabs.some((tab) => tab.key === 'structureTree' && tab.label === 'Structure Tree' && tab.maturity === 'stable'));
assert.ok(config.reportTabs.some((tab) => tab.key === 'structureContacts' && tab.label === 'Structure Terminals'));
assert.equal(config.outputButtons.length, 7);
assert.ok(config.outputButtons.some((item) => item.key === 'json-trace-support-members' && item.exportKey === 'jsonTraceSupportMembersCsv'));
assert.ok(config.info.some((item) => item.includes('XML-free production workflow')));
assert.ok(config.info.some((item) => item.includes('LineFamily_PSRoot')));
assert.ok(config.info.some((item) => item.includes('six task-oriented groups')));
assert.ok(config.info.some((item) => item.includes('analytical support-member geometry')));
assert.ok(config.info.some((item) => item.includes('Support Detail Report headers')));

const launcher = _test.renderLauncher(config);
assert.match(launcher, /XML-free relationship evidence graph/);
assert.match(launcher, /data-psfa-open="1"/);

const html = _test.renderInputShell(config);
assert.match(html, /Support \/ Steel Relationship Bundle/);
assert.match(html, /Relationship bundle — XML-free production mode/);
assert.match(html, /Legacy StructureGroup vs Supports XML/);
assert.match(html, /Legacy Clash within Supports XML/);
assert.match(html, /data-psfa-file="bundle"/);
assert.match(html, /data-psfa-file="structure"/);
assert.match(html, /data-psfa-file="support"/);
assert.match(html, /data-psfa="bundle"/);
assert.match(html, /data-psfa="evidence-mode"/);
assert.doesNotMatch(html, /PSClash XML/);
assert.doesNotMatch(html, /Expected PS\/SL CSV/);
for (const group of config.reportGroups) assert.match(html, new RegExp(`data-psfa-report-group="${group.key}"`));
assert.match(html, /data-psfa-tab="supportSummary"/);
assert.match(html, /data-psfa-tab="structureTree"/);
assert.match(html, /data-psfa-tab="supportExceptions"/);
assert.match(html, /Support Group Summary CSV/);
assert.match(html, /JSON Trace Support Members CSV/);
assert.match(html, /Structure Group Basis CSV/);
assert.match(html, /Line Tree TXT/);
assert.match(html, /Audit Outcome CSV/);
assert.match(html, /Valid family prefixes/);
assert.match(html, /Structural zones/);
assert.match(html, /Support zones/);
assert.doesNotMatch(html, /StructureGroup Contacts CSV/);
assert.doesNotMatch(html, /Clash Rows CSV/);

const fakeGet = (name) => ({ value: ({ 'evidence-mode': 'XML', tolerance: '12.5', 'source-family': 'sl-12005', 'family-prefixes': 'ps, sl, sup', 'source-side': 'right', 'structural-zones': 'CU-SU\nPIPE-RACK', 'support-zones': 'PS-, SL-' }[name] || '') });
const settings = readPsFamilyUiSettings(fakeGet, PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.equal(settings.evidenceMode, 'XML');
assert.equal(settings.posToleranceMm, 12.5);
assert.equal(settings.sourceSide, 'right');
assert.equal(settings.sourceFamily, 'SL-12005');
assert.deepEqual(settings.familyPrefixes, ['PS', 'SL', 'SUP']);
assert.deepEqual(settings.structuralZones, ['CU-SU', 'PIPE-RACK']);
assert.deepEqual(settings.supportZones, ['PS-', 'SL-']);

const textFile = { name: 'sample.xml', size: 10, text: () => Promise.resolve('abc') };
assert.equal(describeBrowserFile(textFile), 'sample.xml (10 bytes)');
assert.equal(await readBrowserTextFile(textFile), 'abc');

const audit = createPsFamilyClashAuditFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: { evidenceMode: 'XML', sourceSide: 'auto', familyPrefixesText: 'PS, SL', structuralZonesText: 'STRUCTURE, FRMWORK, GENSEC, CU-SU', supportZonesText: 'PS-, SL-', posToleranceMm: 25 },
});
assert.equal(audit.summary.supportGroupCount, 1);
assert.match(renderPsFamilyReports(audit, 'supportSummary', config, '', 'supportGroup'), /S8810011_PS-14396/);
assert.match(renderPsFamilyReports(audit, 'lineSupportTree', config, '', 'lineTree'), /StructuralGroup/);
assert.match(renderPsFamilyReports(audit, 'structureLineProximity', config, '', 'structureBasis'), /Total Support Count/);
assert.match(renderPsFamilyReports(audit, 'structureTree', config, '', 'structureTree'), /Structure Path/);

console.log('ps-family-clash-audit-config tests passed');
