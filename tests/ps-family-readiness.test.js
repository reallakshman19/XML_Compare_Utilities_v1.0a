import assert from 'node:assert/strict';
import { createPsFamilyInputReadinessFromTextInputs } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-actions.js';
import { renderPsFamilyReadiness } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-view.js';
import { _test } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-tab.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-config.js';
import { PS_FAMILY_SAMPLE_STRUCTURE_XML, PS_FAMILY_SAMPLE_SUPPORT_XML } from '../tabs/ps-family-clash-audit/ps-family-clash-audit-samples.js';

function diagnosticCodes(readiness) { return new Set(readiness.diagnostics.map((item) => item.code)); }
function xmlConfig() { return { evidenceMode: 'XML', sourceSide: 'auto', sourceFamily: '', familyPrefixesText: 'PS, SL', posToleranceMm: 25 }; }

const sampleReadiness = createPsFamilyInputReadinessFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: xmlConfig(),
});
assert.equal(sampleReadiness.blocking, false);
assert.equal(sampleReadiness.summary.evidenceMode, 'XML');
assert.equal(sampleReadiness.summary.sourceFamily, 'PS-14396');
assert.equal(sampleReadiness.summary.structureContactCount, 2);
assert.equal(sampleReadiness.summary.supportChainCount, 3);
assert.equal(sampleReadiness.summary.expectedCount, 0);
assert.equal(sampleReadiness.summary.detailCount, 0);
assert.match(renderPsFamilyReadiness(sampleReadiness), /Input Readiness/);
assert.match(renderPsFamilyReadiness(sampleReadiness), /PS-14396/);
assert.match(renderPsFamilyReadiness(sampleReadiness), /Structure terminals \/ Support chain/);

const emptyReadiness = createPsFamilyInputReadinessFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: '',
  supportXmlText: '',
  config: xmlConfig(),
});
assert.equal(emptyReadiness.blocking, true);
assert.ok(diagnosticCodes(emptyReadiness).has('MISSING_STRUCTUREGROUP_SUPPORTS_XML'));
assert.ok(diagnosticCodes(emptyReadiness).has('MISSING_SUPPORT_CHAIN_XML'));
assert.ok(diagnosticCodes(emptyReadiness).has('UNKNOWN_SOURCE_FAMILY'));

const missingSupport = createPsFamilyInputReadinessFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: '',
  config: xmlConfig(),
});
assert.equal(missingSupport.blocking, true);
assert.ok(diagnosticCodes(missingSupport).has('MISSING_SUPPORT_CHAIN_XML'));
assert.equal(missingSupport.summary.sourceFamily, 'PS-14396');

const missingStructure = createPsFamilyInputReadinessFromTextInputs({
  evidenceMode: 'XML',
  structureXmlText: '',
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  config: xmlConfig(),
});
assert.equal(missingStructure.blocking, true);
assert.ok(diagnosticCodes(missingStructure).has('MISSING_STRUCTUREGROUP_SUPPORTS_XML'));
assert.equal(missingStructure.summary.sourceFamily, 'PS-14396');

const shell = _test.renderInputShell(PS_FAMILY_CLASH_AUDIT_CONFIG);
assert.match(shell, /Check Readiness/);
assert.match(shell, /data-psfa="readiness"/);
assert.match(shell, /Legacy StructureGroup vs Supports XML/);
assert.match(shell, /Legacy Clash within Supports XML/);
assert.match(shell, /Relationship bundle — XML-free production mode/);

console.log('ps-family-readiness tests passed');
