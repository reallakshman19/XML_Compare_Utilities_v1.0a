import assert from 'node:assert/strict';

import {
  INPUTXML_PRODUCER_RESULT_SCHEMA,
  categorizeProducerInputXml,
  createInputXmlProducerService,
  validateInputXmlProducerRequest,
} from '../xml-compare/inputxml-producer-api/index.js';

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-100" FROM_NAME="N10" TO_NAME="N20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25">
  <BEND RADIUS="300" />
</PIPINGELEMENT>
<RESTRAINT NODE="10" TYPE="14" STIFFNESS="1" GAP="0" MU="0" CNODE="0" />
</PIPINGMODEL>
</CAESARII>`;

const request = {
  requestId: 'producer-api-test',
  producer: {
    id: 'xml-builder',
    repository: 'reallaksh19/3D_Converters',
    module: 'tabs/xml-builder-tab.js',
    operation: 'buildXmlCiiCustomInputXml',
    version: 'test',
    artifactRole: 'generated-inputxml',
  },
  source: {
    filename: 'model.input.xml',
    content: inputXml,
  },
};

const service = createInputXmlProducerService();
assert.equal(typeof service.getCapabilities, 'function');
assert.equal(typeof service.categorizeInputXml, 'function');
assert.equal(Object.isFrozen(service), true);

const capabilities = service.getCapabilities();
assert.equal(capabilities.operation, 'categorizeInputXml');
assert.equal(capabilities.input.root, 'CAESARII');
assert.equal(capabilities.input.xmlType, 'Input');
assert.equal(capabilities.output.schema, 'categorized-inputxml/v3');
assert.equal(capabilities.mutation, false);

const checked = validateInputXmlProducerRequest(request);
assert.equal(checked.diagnostics.length, 0);
assert.equal(checked.normalized.producer.id, 'xml-builder');
assert.equal(checked.normalized.source.filename, 'model.input.xml');
assert.match(checked.normalized.source.fingerprint, /^fnv1a32:/);

const result = categorizeProducerInputXml(request);
assert.equal(result.schema, INPUTXML_PRODUCER_RESULT_SCHEMA);
assert.equal(result.success, true);
assert.equal(result.requestId, 'producer-api-test');
assert.equal(result.producer.id, 'xml-builder');
assert.equal(result.producer.repository, 'reallaksh19/3D_Converters');
assert.equal(result.source.filename, 'model.input.xml');
assert.match(result.source.fingerprint, /^fnv1a32:/);
assert.equal(result.summary.inputElements, 1);
assert.equal(result.summary.categorizedLines, 1);
assert.equal(result.summary.categorizedElements, 1);
assert.equal(result.categorizedValidation.success, true);
assert.equal(result.categorizedValidation.sourceExportReady, true);
assert.equal(result.artifact.role, 'categorized-review-document');
assert.equal(result.artifact.filename, 'model.input_categorized_enriched.xml');
assert.equal(result.artifact.mediaType, 'application/xml');
assert.equal(result.artifact.sourceFingerprint, result.source.fingerprint);
assert.match(result.artifact.fingerprint, /^fnv1a32:/);
assert.notEqual(result.artifact.fingerprint, result.source.fingerprint);
assert.ok(result.artifact.text.includes('<CategorizedInputXML schema="categorized-inputxml/v3"'));
assert.ok(result.artifact.text.includes('sourceName="model.input.xml"'));
assert.ok(result.artifact.text.includes('<OriginalElement><![CDATA['));
assert.ok(result.artifact.text.includes('<BEND RADIUS="300" />'));
assert.ok(result.artifact.text.includes('<RESTRAINT NODE="10"'));
assert.equal(inputXml.includes('<CategorizedInputXML'), false, 'source InputXML is not mutated');

const repeated = service.categorizeInputXml(request);
assert.equal(repeated.artifact.text, result.artifact.text);
assert.equal(repeated.artifact.fingerprint, result.artifact.fingerprint);

const missingProducer = categorizeProducerInputXml({
  source: { filename: 'model.input.xml', content: inputXml },
});
assert.equal(missingProducer.success, false);
assert.equal(missingProducer.artifact, null);
assert.ok(missingProducer.diagnostics.some((item) => item.code === 'PRODUCER_ID_MISSING'));

const empty = categorizeProducerInputXml({
  producer: { id: 'test' },
  source: { filename: 'empty.xml', content: '' },
});
assert.equal(empty.success, false);
assert.ok(empty.diagnostics.some((item) => item.code === 'INPUTXML_EMPTY'));

const invalidRoot = categorizeProducerInputXml({
  producer: { id: 'test' },
  source: { filename: 'invalid.xml', content: '<ROOT />' },
});
assert.equal(invalidRoot.success, false);
assert.ok(invalidRoot.diagnostics.some((item) => item.code === 'INPUTXML_ROOT_INVALID'));
assert.ok(invalidRoot.diagnostics.some((item) => item.code === 'PIPINGMODEL_MISSING'));

const invalidType = categorizeProducerInputXml({
  producer: { id: 'test' },
  source: {
    filename: 'output.xml',
    content: '<CAESARII XML_TYPE="Output"><PIPINGMODEL><PIPINGELEMENT FROM_NODE="1" TO_NODE="2" /></PIPINGMODEL></CAESARII>',
  },
});
assert.equal(invalidType.success, false);
assert.ok(invalidType.diagnostics.some((item) => item.code === 'INPUTXML_TYPE_INVALID'));

const noElements = categorizeProducerInputXml({
  producer: { id: 'test' },
  source: {
    filename: 'no-elements.xml',
    content: '<CAESARII XML_TYPE="Input"><PIPINGMODEL /></CAESARII>',
  },
});
assert.equal(noElements.success, false);
assert.ok(noElements.diagnostics.some((item) => item.code === 'PIPINGELEMENT_MISSING'));

console.log('InputXML producer adapter tests passed');
