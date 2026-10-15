import assert from 'node:assert/strict';
import { createPsFamilyInputReadinessFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { loadSampleTextIntoTextarea, loadTextFileIntoTextarea } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-file-io.js';
import {
  PS_FAMILY_SAMPLE_INPUTS,
  PS_FAMILY_SAMPLE_STRUCTURE_XML,
  PS_FAMILY_SAMPLE_SUPPORT_XML,
  listPsFamilySampleInputs,
} from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';

assert.equal(listPsFamilySampleInputs().length, 2);
assert.ok(PS_FAMILY_SAMPLE_INPUTS.structure.text.includes('Clash603'));
assert.ok(PS_FAMILY_SAMPLE_INPUTS.structure.text.includes('GENSEC 2 of FRMWORK 1 of STRUCTURE /PS-14396'));
assert.ok(PS_FAMILY_SAMPLE_INPUTS.support.text.includes('Clash1429'));
assert.ok(PS_FAMILY_SAMPLE_INPUTS.support.text.includes('PS-14396.10'));

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.ok(shell.includes('Load sample StructureGroup vs Supports XML'));
assert.ok(shell.includes('Load sample Clash within Supports XML'));
assert.ok(shell.includes('data-psfa="structure"'));
assert.ok(shell.includes('data-psfa="support"'));
assert.ok(!shell.includes('PSClash XML'));
assert.ok(!shell.includes('Expected PS/SL CSV'));

const textarea = { value: 'manual value' };
const statusNode = { textContent: 'No file selected' };
loadSampleTextIntoTextarea(PS_FAMILY_SAMPLE_INPUTS.structure, textarea, statusNode);
assert.equal(textarea.value, PS_FAMILY_SAMPLE_STRUCTURE_XML);
assert.equal(statusNode.textContent, 'Official sample StructureGroup vs Supports XML loaded');
loadSampleTextIntoTextarea(PS_FAMILY_SAMPLE_INPUTS.support, textarea, statusNode);
assert.equal(textarea.value, PS_FAMILY_SAMPLE_SUPPORT_XML);
assert.equal(statusNode.textContent, 'Official sample Clash within Supports XML loaded');

await loadTextFileIntoTextarea({ name: 'manual.xml', size: 6, text: async () => 'manual' }, textarea, statusNode);
assert.equal(textarea.value, 'manual');
assert.equal(statusNode.textContent, 'manual.xml (6 bytes)');

const readiness = createPsFamilyInputReadinessFromTextInputs({
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: { sourceSide: 'auto', sourceFamily: '', familyPrefixesText: 'PS, SL', posToleranceMm: 25 },
});
assert.equal(readiness.blocking, false);
assert.equal(readiness.summary.sourceFamily, 'PS-14396');
assert.equal(readiness.summary.structureContactCount, 2);
assert.equal(readiness.summary.supportChainCount, 3);
assert.equal(readiness.summary.errorCount, 0);

console.log('ps-family-sample-buttons tests passed');
