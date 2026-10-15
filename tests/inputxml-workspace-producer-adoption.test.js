import assert from 'node:assert/strict';
import {
  createWorkspaceProducerAdoptionState,
  createWorkspaceProducerRequest,
  finishWorkspaceProducerRun,
  isWorkspaceGeneratedInputXml,
  runWorkspaceProducerAdoption,
  startWorkspaceProducerRun,
  workspaceProducerCategorizedText,
  workspaceProducerOwnsSource,
  workspaceProducerReceipt,
} from '../tabs/inputxml-workspace/inputxml-workspace-producer-adoption.js';
import { contentFingerprint } from '../xml-compare/categorized-inputxml-api/index.js';
import { createInputXmlProducerService } from '../xml-compare/inputxml-producer-api/index.js';

const INPUT_XML = '<?xml version="1.0"?><CAESARII XML_TYPE="Input"><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></PIPINGMODEL></CAESARII>';
const CATEGORIZED_XML = '<CategorizedInputXML schemaVersion="3"><Line id="L1" /></CategorizedInputXML>';

function resultFor(request, text = CATEGORIZED_XML) {
  return Object.freeze({
    schema: 'InputXmlProducerCategorizeResult.v1',
    requestId: request.requestId,
    success: true,
    producer: request.producer,
    source: Object.freeze({ filename: request.source.filename, fingerprint: contentFingerprint(request.source.content) }),
    summary: Object.freeze({ inputElements: 1, categorizedLines: 1, categorizedElements: 1, categorizedNodes: 2 }),
    diagnosticCounts: Object.freeze({ error: 0, warning: 0, information: 0 }),
    diagnostics: Object.freeze([]),
    categorizedValidation: Object.freeze({ success: true }),
    artifact: Object.freeze({
      id: 'categorized-inputxml', role: 'categorized-review-document', filename: 'workspace_categorized.xml',
      mediaType: 'application/xml', text, fingerprint: contentFingerprint(text),
      sourceFingerprint: contentFingerprint(request.source.content),
    }),
  });
}

assert.equal(isWorkspaceGeneratedInputXml('5c'), true);
assert.equal(isWorkspaceGeneratedInputXml('enriched'), true);
assert.equal(isWorkspaceGeneratedInputXml('upload'), false);

const source = { text: INPUT_XML, sourceKind: '5c', filename: 'workspace-5c.input.xml' };
const started = startWorkspaceProducerRun(source);
assert.equal(started.adoption.status, 'running');
assert.equal(started.request.schema, 'InputXmlProducerCategorizeRequest.v1');
assert.equal(started.request.producer.id, 'inputxml-workspace');
assert.equal(started.request.producer.operation, 'xml-to-inputxml-5c');
assert.equal(started.request.source.content, INPUT_XML);

const finished = finishWorkspaceProducerRun(started.adoption, resultFor(started.request));
assert.equal(finished.status, 'success');
assert.equal(workspaceProducerOwnsSource(source, finished), true);
assert.equal(workspaceProducerCategorizedText(source, finished), CATEGORIZED_XML);
assert.equal(workspaceProducerCategorizedText({ ...source, text: `${INPUT_XML}\n` }, finished), '');

const receipt = workspaceProducerReceipt(source, finished);
assert.equal(receipt.schema, 'InputXmlWorkspaceProducerReceipt.v1');
assert.equal(receipt.status, 'success');
assert.equal(receipt.source.current, true);
assert.equal(receipt.result.artifact.text, CATEGORIZED_XML);

const staleResult = resultFor(started.request);
const mismatched = finishWorkspaceProducerRun(
  createWorkspaceProducerAdoptionState({ ...started.adoption, sourceFingerprint: 'stale-fingerprint' }),
  staleResult,
);
assert.equal(mismatched.status, 'failed');
assert.equal(mismatched.error.code, 'WORKSPACE_RECEIPT_SOURCE_MISMATCH');

let calls = 0;
const client = {
  producer: {
    categorizeInputXml: async (request) => {
      calls += 1;
      return resultFor(request);
    },
  },
};
const adopted = await runWorkspaceProducerAdoption({ ...source, sourceKind: 'enriched' }, client);
assert.equal(calls, 1);
assert.equal(adopted.adoption.status, 'success');
assert.equal(adopted.adoption.result.artifact.text, CATEGORIZED_XML);

const realService = createInputXmlProducerService();
const realAdoption = await runWorkspaceProducerAdoption(source, {
  producer: { categorizeInputXml: async (request) => realService.categorizeInputXml(request) },
});
assert.equal(realAdoption.adoption.status, 'success');
assert.equal(realAdoption.adoption.result.schema, 'InputXmlProducerCategorizeResult.v1');
assert.equal(realAdoption.adoption.result.requestId, createWorkspaceProducerRequest(source).requestId);
assert.equal(realAdoption.adoption.result.categorizedValidation.success, true);
assert.equal(realAdoption.adoption.result.artifact.sourceFingerprint, contentFingerprint(INPUT_XML));
assert.equal(workspaceProducerCategorizedText(source, realAdoption.adoption), realAdoption.adoption.result.artifact.text);
assert.match(realAdoption.adoption.result.artifact.text, /<CategorizedInputXML\b/);

const failed = await runWorkspaceProducerAdoption(source, {
  producer: { categorizeInputXml: async () => { throw Object.assign(new Error('worker unavailable'), { code: 'WORKER_UNAVAILABLE' }); } },
});
assert.equal(failed.adoption.status, 'failed');
assert.equal(failed.adoption.error.code, 'WORKER_UNAVAILABLE');
assert.equal(workspaceProducerCategorizedText(source, failed.adoption), '');

const manual = startWorkspaceProducerRun({ text: INPUT_XML, sourceKind: 'upload', filename: 'manual.xml' });
assert.equal(manual.request, null);
assert.equal(manual.adoption.status, 'failed');
assert.equal(manual.adoption.error.code, 'WORKSPACE_SOURCE_NOT_PRODUCER_GENERATED');

console.log('InputXML Workspace producer adoption contract passed.');
