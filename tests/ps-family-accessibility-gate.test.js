import assert from 'node:assert/strict';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';

const launcher = _test.renderLauncher(PS_FAMILY_CLASH_AUDIT_CONFIG);
const popup = _test.renderPopup(PS_FAMILY_CLASH_AUDIT_CONFIG);
const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);

function assertVisibleLabel(text) { assert.ok(`${launcher}${popup}${shell}`.includes(text), `Missing visible label: ${text}`); }

assertVisibleLabel('PS / SL Family Evidence Audit');
assertVisibleLabel('Audit support families directly from the XML-free relationship evidence graph.');
assertVisibleLabel('Relationship bundle — XML-free production mode');
assertVisibleLabel('Legacy clash XML — validation mode');
assertVisibleLabel('Close');
assert.ok(launcher.includes('data-psfa-open="1"'));
assert.ok(popup.includes('data-psfa-close="1"'));

for (const input of PS_FAMILY_CLASH_AUDIT_CONFIG.inputFiles) {
  assertVisibleLabel(`${input.label} file`);
  assert.ok(shell.includes(`data-psfa-file="${input.key}"`));
}

for (const option of PS_FAMILY_CLASH_AUDIT_CONFIG.evidenceModes) assertVisibleLabel(option.label);
for (const option of PS_FAMILY_CLASH_AUDIT_CONFIG.sourceSideOptions) assertVisibleLabel(option.label);
for (const tab of PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs) {
  assertVisibleLabel(tab.label);
  assert.ok(shell.includes(`data-psfa-tab="${tab.key}"`));
}
for (const button of PS_FAMILY_CLASH_AUDIT_CONFIG.outputButtons) {
  assertVisibleLabel(button.label);
  assert.ok(shell.includes(`data-psfa="${button.key}"`));
  assert.ok(shell.includes(`data-psfa-export-preview="${button.key}"`));
}

assertVisibleLabel('Source family');
assertVisibleLabel('Valid family prefixes');
assertVisibleLabel('POS tolerance mm');
assertVisibleLabel('Run Audit');
assertVisibleLabel('Download Selected');
assert.ok(!PS_FAMILY_CLASH_AUDIT_CONFIG.reportTabs.some((tab) => !tab.label.trim()));
assert.ok(!PS_FAMILY_CLASH_AUDIT_CONFIG.outputButtons.some((button) => !button.label.trim()));

console.log('ps-family-accessibility-gate tests passed');
