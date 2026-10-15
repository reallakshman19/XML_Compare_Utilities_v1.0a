import assert from 'node:assert/strict';
import fs from 'node:fs';

import { inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';
import {
  CATEGORIZED_INPUTXML_INSPECTION_SCHEMA,
  CATEGORIZED_INPUTXML_SERVICE_VERSION,
  CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA,
  createCategorizedInputXmlService,
  exportCategorizedSourceInputXml,
  getCategorizedInputXmlCapabilities,
  inspectCategorizedInputXml,
  serializeCategorizedInputXml,
  validateCategorizedInputXml,
} from '../xml-compare/categorized-inputxml-api/index.js';

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-100" FROM_NAME="N10" TO_NAME="N20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25">
  <BEND RADIUS="300" />
</PIPINGELEMENT>
<RESTRAINT NODE="10" TYPE="14" STIFFNESS="1" GAP="0" MU="0" CNODE="0" />
</PIPINGMODEL>
</CAESARII>`;

const categorized = inputXmlToCategorizedInputXml(inputXml, { sourceName: 'api-test.input.xml' });
const request = {
  requestId: 'api-test-1',
  source: { filename: 'api-test_categorized_enriched.xml', content: categorized },
  options: { schemaPolicy: 'require-v3', diagnosticsLevel: 'full' },
};

const capabilities = getCategorizedInputXmlCapabilities();
assert.equal(capabilities.serviceVersion, CATEGORIZED_INPUTXML_SERVICE_VERSION);
assert.equal(capabilities.writeCapabilities.normalizedReconciliation, false);
assert.equal(capabilities.writeCapabilities.sourceEvidenceExport, true);
assert.deepEqual(capabilities.operations, ['validate', 'inspect', 'serialize', 'exportSourceInputXml']);

const service = createCategorizedInputXmlService();
assert.equal(typeof service.validate, 'function');
assert.equal(typeof service.inspect, 'function');
assert.equal(typeof service.serialize, 'function');
assert.equal(typeof service.exportSourceInputXml, 'function');
assert.equal(Object.isFrozen(service), true);

const validation = validateCategorizedInputXml(request);
assert.equal(validation.success, true);
assert.equal(validation.sourceExportReady, true);
assert.equal(validation.summary.lines, 1);
assert.equal(validation.summary.elements, 1);
assert.equal(validation.summary.sourceEvidenceElements, 1);
assert.equal(validation.diagnosticCounts.error, 0);
assert.equal('document' in validation, false);

const inspection = inspectCategorizedInputXml(request);
assert.equal(inspection.schema, CATEGORIZED_INPUTXML_INSPECTION_SCHEMA);
assert.equal(inspection.document.rootName, 'CategorizedInputXML');
assert.equal(inspection.document.documentSchema, 'categorized-inputxml/v3');
assert.equal(inspection.document.lines[0].lineId, 'L-100');
assert.equal(inspection.document.lines[0].elements[0].elementKey, '10->20');
assert.ok(inspection.diagnostics.some((item) => item.code === 'DERIVED_COORDINATE_NOT_IN_SOURCE'));
assert.ok(inspection.diagnostics.some((item) => item.code === 'NORMALIZED_FIELD_NOT_IN_SOURCE' && item.location.field === 'NAME'));

const serializedA = serializeCategorizedInputXml(request);
const serializedB = serializeCategorizedInputXml(request);
assert.equal(serializedA.success, true);
assert.equal(serializedA.text, serializedB.text);
assert.ok(serializedA.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
assert.ok(serializedA.text.includes('<OriginalElement><![CDATA['));

const exported = exportCategorizedSourceInputXml(request);
assert.equal(exported.schema, CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA);
assert.equal(exported.success, true);
assert.equal(exported.artifact.role, 'source-evidence-reconstruction');
assert.equal(exported.artifact.pipingElementCount, 1);
assert.equal(exported.artifact.filename, 'api-test_categorized_enriched_source_evidence.input.xml');
assert.ok(exported.artifact.text.includes('<PIPINGELEMENT'));
assert.ok(exported.artifact.text.includes('<RESTRAINT'));

const deltaDiverged = categorized.replace('<DELTA_X>100</DELTA_X>', '<DELTA_X>250</DELTA_X>');
const deltaInspection = inspectCategorizedInputXml({
  source: { filename: 'delta-diverged.xml', content: deltaDiverged },
});
const deltaFinding = deltaInspection.diagnostics.find((item) => item.code === 'NORMALIZED_SOURCE_DIVERGENCE' && item.location.field === 'DELTA_X');
assert.ok(deltaFinding, 'normalized/source DELTA_X divergence is reported');
assert.equal(deltaFinding.sourceValue, '100');
assert.equal(deltaFinding.normalizedValue, '250');
assert.equal(deltaInspection.sourceExportReady, true, 'source export remains evidence-based despite normalized divergence');

const identityDiverged = categorized.replace('<Line id="L-100">', '<Line id="L-999">');
const identityInspection = inspectCategorizedInputXml({
  source: { filename: 'identity-diverged.xml', content: identityDiverged },
});
assert.ok(identityInspection.diagnostics.some((item) => item.code === 'IDENTITY_DIVERGENCE' && item.location.lineId === 'L-999'));

const missingEvidence = categorized.replace(/\s*<OriginalElement>[\s\S]*?<\/OriginalElement>/, '');
const missingInspection = inspectCategorizedInputXml({
  source: { filename: 'missing-evidence.xml', content: missingEvidence },
});
assert.equal(missingInspection.success, true, 'missing source evidence is reviewable for comparison');
assert.equal(missingInspection.sourceExportReady, false);
assert.ok(missingInspection.diagnostics.some((item) => item.code === 'ORIGINAL_ELEMENT_MISSING'));
const blockedExport = exportCategorizedSourceInputXml({
  source: { filename: 'missing-evidence.xml', content: missingEvidence },
});
assert.equal(blockedExport.success, false);
assert.equal(blockedExport.artifact, null);
assert.ok(blockedExport.diagnostics.some((item) => item.code === 'SOURCE_EXPORT_NOT_READY'));

const extensionSample = fs.readFileSync(new URL('../samples/xml-compare/transfer-proof/source-categorized.xml', import.meta.url), 'utf8');
const extensionInspection = inspectCategorizedInputXml({
  source: { filename: 'source-categorized.xml', content: extensionSample },
  options: { schemaPolicy: 'allow-compatible' },
});
assert.equal(extensionInspection.success, true);
assert.ok(extensionInspection.summary.extensionBlocks >= 4);
assert.ok(extensionInspection.diagnostics.some((item) => item.code === 'SCHEMA_MISSING'));
assert.ok(extensionInspection.diagnostics.some((item) => item.code === 'EXTENSION_BLOCK' && item.location.blockName === 'ElementOnlyBlock'));
assert.ok(extensionInspection.diagnostics.some((item) => item.code === 'EXTENSION_BLOCK' && item.location.blockName === 'SupportBlock'));
assert.equal(extensionInspection.sourceExportReady, false);

const strictUnversioned = validateCategorizedInputXml({
  source: { filename: 'unversioned.xml', content: extensionSample },
  options: { schemaPolicy: 'require-v3' },
});
assert.equal(strictUnversioned.success, false);
assert.ok(strictUnversioned.diagnostics.some((item) => item.code === 'SCHEMA_MISSING' && item.severity === 'error'));

const invalidRoot = validateCategorizedInputXml({
  source: { filename: 'invalid.xml', content: '<ROOT><Line id="L1" /></ROOT>' },
});
assert.equal(invalidRoot.success, false);
assert.ok(invalidRoot.diagnostics.some((item) => item.code === 'ROOT_INVALID'));

const errorsOnly = inspectCategorizedInputXml({
  source: { filename: 'invalid.xml', content: '<ROOT />' },
  options: { diagnosticsLevel: 'errors-only' },
});
assert.ok(errorsOnly.diagnostics.length > 0);
assert.ok(errorsOnly.diagnostics.every((item) => item.severity === 'error'));
assert.ok(errorsOnly.diagnosticCounts.warning > 0, 'counts retain filtered warning evidence');

console.log('CategorizedInputXML API service tests passed');
