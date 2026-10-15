import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts, proofXmlWellFormed } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';
import { normalizeExportPolicy, validateExportPolicy, validateProfileXmlNames } from '../xml-compare/table-categorizer/table-categorized-xml-export-policy.js';

const source = parseTableSource('ID,Rating,Comment\n1,CL150,ok', { sourceId: 'S1', delimiterMode: 'comma' });

function profile(patch = {}) {
  return {
    profileId: 'xml-contract-test',
    duplicateKeyPolicy: 'warn',
    multiValuePolicy: 'first',
    coordinateCluster: { unit: 'mm', tolerance: 1 },
    exportPolicy: patch.replaceExportPolicy ? (patch.exportPolicy || {}) : {
      documentRootTag: 'ExportRoot',
      includeXmlDeclaration: true,
      includeDiagnosticsElement: false,
      attributeFields: ['Rating'],
      childElementFields: ['Comment'],
      ...(patch.exportPolicy || {}),
    },
    levelDefinitions: [{
      levelId: 'DocumentRoot', xmlTag: 'DocumentRoot', levelType: 'container', creationMode: 'static', key: 'ROOT', documentRoot: true,
      children: [{
        levelId: 'LineItem', xmlTag: patch.childXmlTag || 'LineItem', levelType: 'occurrence', creationMode: 'one-per-key',
        keyResolver: { op: 'trim', column: 'ID' },
        fieldResolvers: { Rating: { op: 'trim', column: 'Rating' }, Comment: { op: 'trim', column: 'Comment' } },
      }],
    }],
  };
}

function exportFor(prof, validationResults = null) {
  const graph = buildCategorizedGraph(prof, [source]);
  const validation = validationResults || runCategorizerValidation({ profile: prof, sources: [source], graph });
  return { graph, validation, result: exportCategorizedGraphArtifacts({ graph, profile: prof, validationResults: validation, sources: [source] }) };
}

const valid = profile();
const validValidation = runCategorizerValidation({ profile: valid, sources: [source], graph: buildCategorizedGraph(valid, [source]) });
assert.equal(validValidation.find((item) => item.gate === 'xml_tag_valid').status, 'PASS');
assert.equal(validValidation.find((item) => item.gate === 'xml_attribute_valid').status, 'PASS');
assert.equal(validValidation.find((item) => item.gate === 'export_xml_well_formed').status, 'PASS');
assert.notEqual(validValidation.find((item) => item.gate === 'export_xml_well_formed').status, 'FUTURE_PHASE');

const validExport = exportFor(valid);
assert.equal(validExport.result.ok, true, 'valid XML profile exports');
assert.ok(validExport.result.xmlText.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<ExportRoot'), 'documentRootTag and XML declaration are honored');
assert.ok(validExport.result.xmlText.includes('Rating="CL150"'), 'attributeFields control XML attributes');
assert.ok(validExport.result.xmlText.includes('<Comment>ok</Comment>'), 'childElementFields control child XML elements');
assert.equal(validExport.result.xmlText.includes('<Diagnostics'), false, 'diagnostics XML can be excluded by policy');
assert.equal(proofXmlWellFormed(validExport.result.xmlText).ok, true, 'serialized XML passes deterministic well-formed proof');
assert.ok(validExport.result.diagnostics.some((item) => item.code === 'export_xml_well_formed' && item.status === 'PASS'));

const compatPolicy = normalizeExportPolicy({ exportPolicy: {} });
assert.equal(compatPolicy.includeDiagnosticsElement, true, 'diagnostics element remains enabled by default for compatibility');
const compat = exportFor(profile({ replaceExportPolicy: true, exportPolicy: {} }));
assert.equal(compat.result.ok, true);
assert.ok(compat.result.xmlText.includes('<Diagnostics'), 'default compatibility keeps diagnostics element embedded');

const invalidLevel = profile({ childXmlTag: 'Line No' });
assert.equal(validateProfileXmlNames(invalidLevel)[0].severity, 'BLOCKER');
assert.equal(runCategorizerValidation({ profile: invalidLevel, sources: [source], graph: buildCategorizedGraph(invalidLevel, [source]) }).find((item) => item.gate === 'xml_tag_valid').status, 'FAIL');
assert.equal(exportFor(invalidLevel, []).result.ok, false, 'invalid level xmlTag is blocked before safeTag fallback can sanitize it');

for (const exportPolicy of [
  { documentRootTag: 'Root Tag' },
  { rootPartitionTag: '1Partition' },
  { attributeFields: ['Bad Field'] },
  { childElementFields: ['Bad Child'] },
]) {
  const bad = profile({ exportPolicy });
  assert.equal(validateExportPolicy(bad)[0].severity, 'BLOCKER');
  assert.equal(exportFor(bad, []).result.ok, false, `invalid export policy is blocked: ${JSON.stringify(exportPolicy)}`);
}

assert.equal(proofXmlWellFormed('<A><B /></A>').ok, true);
assert.equal(proofXmlWellFormed('<A><B></A>').ok, false);

console.log('table-categorized-xml-contract-hardening.test.js passed');
