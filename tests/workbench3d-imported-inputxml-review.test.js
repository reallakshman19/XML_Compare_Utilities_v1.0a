import assert from 'node:assert/strict';
import { createInputXmlProducerService } from '../xml-compare/inputxml-producer-api/index.js';
import {
  _test, closeImportedInputXmlReviewRuntime, createImportedInputXmlReviewCollection,
  createImportedInputXmlReviewRequest,
  finishImportedInputXmlReview,
  importedInputXmlReviewIsCurrent,
  importedInputXmlReviewReceipt,
  importedInputXmlReviewText,
  runImportedInputXmlReview,
  startImportedInputXmlReview,
} from '../workbench3d/ui/imported-inputxml-review.js';

const INPUT_XML = '<?xml version="1.0"?><CAESARII XML_TYPE="Input"><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="1000" DELTA_Y="0" DELTA_Z="0" /></PIPINGMODEL></CAESARII>';
const NODESET_XML = '<?xml version="1.0"?><NodeSet schema="nodeset/v1" purpose="comparison-only"><Node id="N1" x="0" y="0" z="0" /></NodeSet>';
const CATEGORIZED_XML = '<CategorizedInputXML schemaVersion="3"><Line id="L1" /></CategorizedInputXML>';
const PIPINGELEMENT_ONLY_XML = '<Root><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></Root>';

const sourceStarted = startImportedInputXmlReview({ side: 'source', text: INPUT_XML, filename: 'source.input.xml' });
assert.equal(sourceStarted.review.status, 'RUNNING');
assert.equal(sourceStarted.review.sourceSchema, 'input-xml');
assert.equal(sourceStarted.request.schema, 'InputXmlProducerCategorizeRequest.v1');
assert.equal(sourceStarted.request.producer.id, 'workbench3d-imported-inputxml-review');
assert.equal(sourceStarted.request.producer.operation, 'review-imported-source-inputxml');

const service = createInputXmlProducerService();
const serviceResult = service.categorizeInputXml(sourceStarted.request);
assert.equal(serviceResult.success, true);
const sourcePassed = finishImportedInputXmlReview(sourceStarted.review, serviceResult);
assert.equal(sourcePassed.status, 'PASS');
assert.equal(importedInputXmlReviewIsCurrent({ side: 'source', text: INPUT_XML, filename: 'source.input.xml' }, sourcePassed), true);
assert.match(importedInputXmlReviewText({ side: 'source', text: INPUT_XML, filename: 'source.input.xml' }, sourcePassed), /<CategorizedInputXML\b/);
assert.equal(importedInputXmlReviewText({ side: 'source', text: `${INPUT_XML}\n`, filename: 'source.input.xml' }, sourcePassed), '');

const receipt = importedInputXmlReviewReceipt({ side: 'source', text: INPUT_XML, filename: 'source.input.xml' }, sourcePassed);
assert.equal(receipt.schema, 'WorkbenchImportedInputXmlReviewReceipt.v1');
assert.equal(receipt.status, 'PASS');
assert.equal(receipt.source.current, true);
assert.equal(receipt.result.requestId, sourceStarted.request.requestId);

const wrongRequest = finishImportedInputXmlReview(sourceStarted.review, { ...serviceResult, requestId: 'wrong-request' });
assert.equal(wrongRequest.status, 'FAILED');
assert.equal(wrongRequest.diagnostic.code, 'WORKBENCH_REVIEW_REQUEST_MISMATCH');

const nodeSet = startImportedInputXmlReview({ side: 'target', text: NODESET_XML, filename: 'generated.nodeset.xml' });
assert.equal(nodeSet.request, null);
assert.equal(nodeSet.review.status, 'NOT_APPLICABLE');
assert.equal(nodeSet.review.sourceSchema, 'nodeset-xml');
assert.equal(nodeSet.review.diagnostic.code, 'WORKBENCH_NODESET_REVIEW_EXCLUDED');

const alreadyCategorized = startImportedInputXmlReview({ side: 'target', text: CATEGORIZED_XML, filename: 'categorized.xml' });
assert.equal(alreadyCategorized.request, null);
assert.equal(alreadyCategorized.review.status, 'NOT_APPLICABLE');
assert.equal(alreadyCategorized.review.diagnostic.code, 'WORKBENCH_ALREADY_CATEGORIZED');

const empty = startImportedInputXmlReview({ side: 'target', text: '', filename: '' });
assert.equal(empty.request, null);
assert.equal(empty.review.status, 'IDLE');

const container = {};
const state = { importedInputXmlReview: createImportedInputXmlReviewCollection() };
const nodeSetRuntimeResult = await runImportedInputXmlReview({
  container,
  state,
  side: 'source',
  text: NODESET_XML,
  filename: 'table-nodeset.xml',
});
assert.equal(nodeSetRuntimeResult.status, 'NOT_APPLICABLE');
assert.equal(container.__workbench3dImportedInputXmlReviewRuntime.client, null, 'NodeSet review must not create a worker client.');


const markerOnly = startImportedInputXmlReview({ side: 'source', text: PIPINGELEMENT_ONLY_XML, filename: 'marker-only.xml' });
assert.equal(markerOnly.request, null);
assert.equal(markerOnly.review.status, 'NOT_APPLICABLE');
assert.equal(markerOnly.review.diagnostic.code, 'WORKBENCH_CAESAR_INPUTXML_ROOT_REQUIRED');
const markerContainer = {};
const markerState = { importedInputXmlReview: createImportedInputXmlReviewCollection() };
await runImportedInputXmlReview({ container: markerContainer, state: markerState, side: 'source', text: PIPINGELEMENT_ONLY_XML, filename: 'marker-only.xml' });
assert.equal(markerContainer.__workbench3dImportedInputXmlReviewRuntime.client, null, 'Non-CAESAR marker XML must not create a worker client.');

const lifecycleContainer = {};
const firstRuntime = _test.ensureRuntime(lifecycleContainer);
closeImportedInputXmlReviewRuntime(lifecycleContainer);
const remountedRuntime = _test.ensureRuntime(lifecycleContainer);
assert.notEqual(remountedRuntime, firstRuntime, 'Remount must allocate a fresh imported-review runtime.');
assert.equal(remountedRuntime.closed, false);

const targetRequest = createImportedInputXmlReviewRequest({ side: 'target', text: INPUT_XML, filename: 'target.input.xml' });
assert.notEqual(targetRequest.requestId, sourceStarted.request.requestId, 'Source and target request identities must remain distinct.');

console.log('Workbench3D imported InputXML review authority passed.');
