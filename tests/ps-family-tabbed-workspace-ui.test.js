import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_PROFESSIONAL_UI_SCHEMA } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-professional-ui.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
const popup = _test.renderPopup(PS_FAMILY_CLASH_AUDIT_CONFIG);
const launcher = _test.renderLauncher(PS_FAMILY_CLASH_AUDIT_CONFIG);
const source = readFileSync('tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js', 'utf8');
const professionalCss = readFileSync('tabs/ps-family-clash-audit/ps-family-clash-audit-professional-ui.js', 'utf8');

for (const tab of ['Input', 'Preview', 'Config', 'Run Audit', 'Reports', 'Export Package']) assert.ok(shell.includes(`>${tab}</button>`), `missing primary workspace tab ${tab}`);
assert.doesNotMatch(shell, />Run &amp; Export<\/button>/);
assert.ok(shell.includes('class="psmap-tabs psfa-tabs"'));
assert.ok(shell.includes('class="psmap-tab psfa-tab active"'));
assert.ok(shell.includes('class="psmap-tab psfa-tab config"'));
assert.ok(launcher.includes('class="psmap-card psmap-tile ps-family-clash-audit-launcher"'));
assert.ok(launcher.includes('XML-free relationship evidence graph'));

assert.equal(PS_FAMILY_PROFESSIONAL_UI_SCHEMA, 'ps-family-clash-audit-professional-ui/v10-report-hub');
assert.match(professionalCss, /PS_FAMILY_PROFESSIONAL_UI_SCHEMA = 'ps-family-clash-audit-professional-ui\/v10-report-hub'/);
assert.match(professionalCss, /grid-template-rows:auto auto auto minmax\(0,1fr\)/);
assert.match(professionalCss, /\.psfa-tabs\{[^}]*min-height:42px/);
assert.match(professionalCss, /\.psfa-tab\{[^}]*height:30px/);
assert.match(professionalCss, /\.psfa-shell>\[data-psfa-panel\]\{min-height:0;overflow:auto\}/);
assert.match(professionalCss, /\.psfa-report-layout/);
assert.match(professionalCss, /\.psfa-report-group-card/);
assert.match(professionalCss, /\.psfa-report-groups,\.psfa-report-catalog\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:repeat\(2/);
assert.match(professionalCss, /\.psfa-report-subtabs\{[^}]*flex-wrap:wrap/);
assert.match(professionalCss, /\.psfa-report-table\{[^}]*overflow-x:auto;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable both-edges/);
assert.match(professionalCss, /\.psfa-report-table \.psmap-table-wrap\{[^}]*overflow-x:auto/);
assert.match(professionalCss, /\.psfa-report-table \.psmap-table\{[^}]*width:max-content;[^}]*min-width:100%/);

assert.match(shell, /data-psfa-panel="input"[^>]*>/);
for (const key of ['preview', 'config', 'run', 'reports', 'export']) assert.match(shell, new RegExp(`data-psfa-panel="${key}" hidden`));

assert.ok(shell.includes('Legacy validation samples'));
assert.ok(shell.includes('Load sample StructureGroup vs Supports XML'));
assert.ok(shell.includes('Load sample Clash within Supports XML'));
assert.ok(shell.includes('data-psfa-file="bundle"'));
assert.ok(shell.includes('data-psfa-file="structure"'));
assert.ok(shell.includes('data-psfa-file="support"'));
assert.ok(shell.includes('data-psfa="evidence-mode"'));
assert.ok(shell.includes('Relationship bundle — XML-free production mode'));
assert.ok(!shell.includes('data-psfa="expected"'));
assert.ok(!shell.includes('data-psfa="details"'));

assert.ok(shell.includes('Legacy XML source side'));
assert.ok(shell.includes('Source family override'));
assert.ok(shell.includes('Valid family prefixes'));
assert.ok(shell.includes('POS tolerance mm'));
assert.ok(shell.includes('Structural zones'));
assert.ok(shell.includes('Support zones'));

assert.ok(shell.includes('Audit Controls'));
assert.ok(shell.includes('Readiness / Run Summary'));
assert.ok(shell.includes('Check Readiness'));
assert.ok(shell.includes('Run Audit'));
assert.ok(shell.includes('Export current report CSV'));
assert.ok(shell.includes('Stable Deliverable Package'));
for (const label of ['Support Group Summary CSV', 'Line Tree TXT', 'Structure Group Basis CSV', 'Audit Outcome CSV', 'Input Evidence CSV', 'Audit JSON']) assert.ok(shell.includes(label));
assert.ok(shell.includes('Download All ZIP'));
assert.ok(shell.includes('data-psfa="copy-export-preview"'));

assert.ok(shell.includes('Search selected report'));
assert.ok(shell.includes('Report and export workspace'));
for (const group of PS_FAMILY_CLASH_AUDIT_CONFIG.reportGroups) {
  assert.ok(shell.includes(`data-psfa-report-group="${group.key}"`));
  assert.ok(shell.includes(`data-psfa-report-card="${group.key}"`));
  assert.ok(shell.includes(`data-psfa-report-subtabs="${group.key}"`));
}
assert.equal((shell.match(/data-psfa-report-card=/g) || []).length, 6);
for (const label of ['Support Group', 'Structure Group Basis', 'Line Tree', 'Structure Tree', 'Evidence Summary', 'Audit Outcome']) assert.ok(shell.includes(`>${label}</span>`), `missing clean report group ${label}`);
for (const label of ['SupportGroup Summary', 'Support Chain Report', 'Support Members', 'StructureGroup Line Support Basis', 'Structure Terminals', 'Line Tree', 'Structure Tree', 'Input Evidence', 'Connectivity Matrix', 'Evidence Detail Rows', 'Audit Exceptions', 'Diagnostics']) assert.ok(shell.includes(label), `missing clean report label ${label}`);
for (const tab of PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs) assert.ok(shell.includes(`data-psfa-tab="${tab.key}"`));
assert.equal((shell.match(/>Review<\/span>/g) || []).length, 5);
assert.ok(shell.includes('data-psfa-report-maturity="draft"'));
assert.ok(shell.includes('data-psfa-report-maturity="stable"'));
assert.ok(shell.includes('class="psfa-report-table psmap-table-wrap"'));

assert.ok(popup.includes('PS / SL Family Evidence Audit'));
assert.ok(popup.includes('Evidence Graph Workspace'));
assert.ok(popup.includes('data-psfa-fullscreen="1"'));
assert.ok(popup.includes('data-psfa-close="1"'));
assert.match(source, /showWorkspacePanel/);
assert.match(source, /updateReportNavigation/);
assert.match(source, /activeReportGroup/);
assert.match(source, /saveZipTextFiles/);
assert.match(source, /setFullscreen/);
assert.match(source, /event\.key !== 'Escape'/);
assert.match(source, /exportActiveReportCsv/);
assert.match(source, /wireEvidenceModes/);
assert.match(source, /createPsFamilyAuditFromTextInputs/);

const prefixNode = { kind: 'prefix-detector' };
const exportTitleNode = { kind: 'export-title' };
const fullscreenNode = { kind: 'fullscreen' };
const fakeRoot = {
  querySelector(selector) {
    if (selector === '[data-psfa-prefix-detector]') return prefixNode;
    if (selector === '[data-psfa-export-title]') return exportTitleNode;
    if (selector === '[data-psfa-fullscreen]') return fullscreenNode;
    return null;
  },
};
const get = _test.createGetter(fakeRoot);
assert.equal(get('root'), fakeRoot);
assert.equal(get('prefix-detector'), prefixNode);
assert.equal(get('export-title'), exportTitleNode);
assert.equal(get('fullscreen'), fullscreenNode);
assert.equal(get('unknown-control'), null);
assert.equal(_test.firstReportKey(PS_FAMILY_CLASH_AUDIT_CONFIG, 'auditOutcome'), 'supportExceptions');

console.log('ps-family-tabbed-workspace-ui tests passed');
