import assert from 'node:assert/strict';

import {
  createCategorizedInputXmlWorkerClient,
  installCategorizedInputXmlWorkerRuntime,
} from '../xml-compare/categorized-inputxml-worker/index.js';

function createEndpoint() {
  const listeners = new Map();
  return {
    peer: null,
    terminated: false,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    postMessage(message) {
      if (this.terminated) throw new Error('Endpoint terminated.');
      const data = structuredClone(message);
      queueMicrotask(() => this.peer?.emit('message', { data }));
    },
    emit(type, event) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    terminate() {
      this.terminated = true;
      listeners.clear();
    },
  };
}

function createLinkedWorkerPair() {
  const client = createEndpoint();
  const worker = createEndpoint();
  client.peer = worker;
  worker.peer = client;
  return { client, worker };
}

function artifact(result = {}, id = '') {
  return result.artifacts?.find((item) => item.id === id) || null;
}

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-100" FROM_NAME="N10" TO_NAME="N20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18" INSUL_THICK="25">
  <BEND RADIUS="300" />
</PIPINGELEMENT>
<RESTRAINT NODE="10" TYPE="14" STIFFNESS="1" GAP="0" MU="0" CNODE="0" />
</PIPINGMODEL>
</CAESARII>`;

const pair = createLinkedWorkerPair();
const runtime = installCategorizedInputXmlWorkerRuntime({ scope: pair.worker });
const client = createCategorizedInputXmlWorkerClient({
  worker: pair.client,
  clientId: 'integration',
});

const producerResult = await client.producer.categorizeInputXml({
  requestId: 'producer-worker-request',
  producer: {
    id: 'xml-builder',
    repository: 'reallaksh19/3D_Converters',
    module: 'tabs/xml-builder-tab.js',
    operation: 'buildXmlCiiCustomInputXml',
    version: 'integration-test',
    artifactRole: 'generated-inputxml',
  },
  source: {
    filename: 'worker.input.xml',
    content: inputXml,
  },
});
assert.equal(producerResult.success, true);
assert.equal(producerResult.producer.id, 'xml-builder');
assert.equal(producerResult.summary.inputElements, 1);
assert.equal(producerResult.summary.categorizedElements, 1);
assert.equal(producerResult.categorizedValidation.success, true);
assert.equal(producerResult.artifact.role, 'categorized-review-document');
assert.equal(producerResult.artifact.filename, 'worker.input_categorized_enriched.xml');
assert.match(producerResult.source.fingerprint, /^fnv1a32:/);
assert.match(producerResult.artifact.fingerprint, /^fnv1a32:/);
assert.notEqual(producerResult.source.fingerprint, producerResult.artifact.fingerprint);

const invalidProducer = await client.producer.categorizeInputXml({
  source: { filename: 'worker.input.xml', content: inputXml },
});
assert.equal(invalidProducer.success, false);
assert.equal(invalidProducer.artifact, null);
assert.ok(invalidProducer.diagnostics.some((item) => item.code === 'PRODUCER_ID_MISSING'));

const categorized = producerResult.artifact.text.replace(
  '<DELTA_X>100</DELTA_X>',
  '<DELTA_X>150</DELTA_X>',
);
const serviceRequest = {
  requestId: 'worker-service-request',
  source: {
    filename: producerResult.artifact.filename,
    content: categorized,
  },
};

const categorizedCapabilities = await client.categorized.getCapabilities();
assert.equal(categorizedCapabilities.documentRoot, 'CategorizedInputXML');
assert.equal(categorizedCapabilities.writeCapabilities.normalizedReconciliation, false);

const validation = await client.categorized.validate(serviceRequest);
assert.equal(validation.success, true);
assert.equal(validation.sourceExportReady, true);
assert.equal(validation.summary.elements, 1);

const inspection = await client.categorized.inspect(serviceRequest);
assert.equal(inspection.document.lines[0].elements[0].normalizedFields.DELTA_X, '150');
assert.ok(inspection.diagnostics.some((item) => item.code === 'NORMALIZED_SOURCE_DIVERGENCE'));

const serialization = await client.categorized.serialize(serviceRequest);
assert.equal(serialization.success, true);
assert.ok(serialization.text.includes('<DELTA_X>150</DELTA_X>'));
assert.ok(serialization.text.includes('DELTA_X="100"'));

const sourceExport = await client.categorized.exportSourceInputXml(serviceRequest);
assert.equal(sourceExport.success, true);
assert.equal(sourceExport.artifact.role, 'source-evidence-reconstruction');
assert.match(sourceExport.artifact.text, /DELTA_X="100"/);

const changeSetCapabilities = await client.changeSet.getCapabilities();
assert.ok(changeSetCapabilities.supportedFields.includes('DELTA_X'));
assert.equal(changeSetCapabilities.approval.explicitIdsRequired, true);

const derived = await client.changeSet.derive(serviceRequest);
assert.equal(derived.success, true);
assert.equal(derived.changeSet.summary.proposed, 1);
assert.equal(derived.changeSet.changes[0].field, 'DELTA_X');
assert.equal(derived.changeSet.changes[0].beforeValue, '100');
assert.equal(derived.changeSet.changes[0].afterValue, '150');

const changeSetValidation = await client.changeSet.validate(derived.changeSet);
assert.equal(changeSetValidation.success, true);

const applied = await client.changeSet.apply({
  ...serviceRequest,
  changeSet: derived.changeSet,
  approvedChangeIds: [derived.changeSet.changes[0].changeId],
});
assert.equal(applied.success, true);
assert.equal(applied.receipt.applied, 1);
assert.equal(applied.outputValidation.success, true);
assert.match(artifact(applied, 'reconciled-inputxml').text, /DELTA_X="150"/);
assert.ok(artifact(applied, 'reconciled-inputxml').text.includes('<BEND RADIUS="300" />'));
assert.ok(artifact(applied, 'reconciled-inputxml').text.includes('<RESTRAINT NODE="10"'));
assert.ok(artifact(applied, 'application-receipt').text.includes('InputXmlChangeSetApplicationReceipt.v1'));

assert.equal(client.pendingCount(), 0);
assert.equal(runtime.pendingCount(), 0);
client.close();
runtime.dispose();
assert.equal(client.isClosed(), true);
assert.equal(pair.client.terminated, true);
assert.equal(runtime.isDisposed(), true);

console.log('CategorizedInputXML worker end-to-end integration tests passed');
