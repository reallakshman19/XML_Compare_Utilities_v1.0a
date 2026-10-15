import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_PROFESSIONAL_UI_SCHEMA, psFamilyProfessionalCss } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-professional-ui.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';

assert.equal(PS_FAMILY_PROFESSIONAL_UI_SCHEMA, 'ps-family-clash-audit-professional-ui/v1');

const css = psFamilyProfessionalCss();
for (const token of ['.psfa-status-strip', '.psfa-step-tabs', '.psfa-file-grid', '.psfa-input-wide', '.psfa-action-center', '.psfa-export-package', '.psfa-report-table']) {
  assert.ok(css.includes(token), `missing professional CSS token ${token}`);
}
assert.ok(css.includes('@media(max-width:1050px)'));

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
const popup = _test.renderPopup(PS_FAMILY_CLASH_AUDIT_CONFIG);
const status = _test.renderStatusStrip();

assert.ok(popup.includes('Professional Audit Workspace'));
assert.ok(popup.includes('class="psfa-title-badge"'));
assert.ok(shell.includes('class="psfa-shell"'));
assert.ok(shell.includes('class="psfa-status-strip"'));
assert.ok(status.includes('class="psfa-status-card"'));
assert.ok(shell.includes('class="psfa-step-tabs"'));
assert.ok(shell.includes('<em>1</em><span>Input</span>'));
assert.ok(shell.includes('<em>4</em><span>Run &amp; Export</span>'));
assert.ok(shell.includes('class="psfa-file-grid"'));
assert.ok(shell.includes('class="psfa-input-wide"'));
assert.ok(shell.includes('class="psfa-config-grid"'));
assert.ok(shell.includes('class="psfa-action-center"'));
assert.ok(shell.includes('class="psfa-export-grid"'));
assert.ok(shell.includes('class="psfa-report-head"'));

const source = readFileSync('tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js', 'utf8');
assert.match(source, /psFamilyProfessionalCss/);
assert.match(source, /wireRunButton\(popup, get, state, config\)/);

console.log('ps-family-professional-workspace-ui tests passed');
