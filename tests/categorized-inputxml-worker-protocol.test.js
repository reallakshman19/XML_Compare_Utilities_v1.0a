import assert from 'node:assert/strict';

import {
  CATEGORIZED_INPUTXML_WORKER_OPERATIONS,
  CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
  CATEGORIZED_INPUTXML_WORKER_VERSION,
  createWorkerCancel,
  createWorkerCapabilities,
  createWorkerFailure,
  createWorkerRequest,
  createWorkerResponse,
  normalizeWorkerError,
  validateWorkerInbound,
  validateWorkerResponse,
} from '../xml-compare/categorized-inputxml-worker/index.js';
import { createCategorizedInputXmlWorkerDispatcher } from '../xml-compare/categorized-inputxml-worker/worker-dispatcher.js';

const request = createWorkerRequest({
  requestId: 'req-1',
  operation: 'categorized.inspect',
  payload: { value: 1 },
});
assert.equal(request.protocol, CATEGORIZED_INPUTXML_WORKER_PROTOCOL);
assert.equal(request.kind, 'request');
assert.equal(Object.isFrozen(request), true);
assert.equal(validateWorkerInbound(request).valid, true);

const producerRequest = createWorkerRequest({
  requestId: 'producer-1',
  operation: 'producer.categorizeInputXml',
  payload: { producer: { id: 'test' } },
});
assert.equal(validateWorkerInbound(producerRequest).valid, true);

const cancel = createWorkerCancel({ requestId: 'req-1', reason: 'user' });
assert.equal(cancel.kind, 'cancel');
assert.equal(cancel.reason, 'user');
assert.equal(validateWorkerInbound(cancel).valid, true);

const response = createWorkerResponse({
  requestId: 'req-1',
  operation: 'categorized.inspect',
  result: { ok: true },
});
assert.equal(response.ok, true);
assert.equal(validateWorkerResponse(response).valid, true);

const failure = createWorkerFailure({
  requestId: 'req-1',
  operation: 'categorized.inspect',
  error: Object.assign(new Error('boom'), { code: 'BOOM' }),
});
assert.equal(failure.ok, false);
assert.equal(failure.error.code, 'BOOM');
assert.equal(failure.error.message, 'boom');
assert.equal('stack' in failure.error, false);
assert.equal(validateWorkerResponse(failure).valid, true);

assert.equal(validateWorkerInbound({ ...request, protocol: 'wrong' }).code, 'PROTOCOL_UNSUPPORTED');
assert.equal(validateWorkerInbound({ ...request, requestId: '' }).code, 'REQUEST_ID_MISSING');
assert.equal(validateWorkerInbound({ ...request, operation: 'unknown' }).code, 'OPERATION_UNKNOWN');
assert.equal(validateWorkerInbound({ ...request, kind: 'other' }).code, 'MESSAGE_KIND_INVALID');
assert.equal(validateWorkerResponse({ ...response, ok: 'yes' }).code, 'RESPONSE_STATUS_INVALID');

const normalized = normalizeWorkerError('plain failure', { operation: 'changeset.apply' });
assert.equal(normalized.code, 'OPERATION_FAILED');
assert.equal(normalized.message, 'plain failure');
assert.equal(normalized.operation, 'changeset.apply');

const capabilities = createWorkerCapabilities();
assert.deepEqual(capabilities.operations, CATEGORIZED_INPUTXML_WORKER_OPERATIONS);
assert.equal(capabilities.version, CATEGORIZED_INPUTXML_WORKER_VERSION);
assert.equal(capabilities.version, '1.1.0');
assert.ok(capabilities.operations.includes('producer.categorizeInputXml'));
assert.equal(capabilities.payloadTransport, 'structured-clone');
assert.equal(capabilities.artifactTransport, 'inline-text');
assert.equal(capabilities.cancellation, 'cooperative');
assert.equal(capabilities.streaming, false);

const calls = [];
const producerService = Object.freeze({
  categorizeInputXml: (payload) => (calls.push(['producer.categorize', payload]), { service: 'producer-categorize' }),
});
const categorizedService = Object.freeze({
  getCapabilities: () => ({ service: 'categorized-capabilities' }),
  validate: (payload) => (calls.push(['categorized.validate', payload]), { service: 'categorized-validate' }),
  inspect: (payload) => (calls.push(['categorized.inspect', payload]), { service: 'categorized-inspect' }),
  serialize: (payload) => (calls.push(['categorized.serialize', payload]), { service: 'categorized-serialize' }),
  exportSourceInputXml: (payload) => (calls.push(['categorized.export', payload]), { service: 'categorized-export' }),
});
const changeSetService = Object.freeze({
  getCapabilities: () => ({ service: 'changeset-capabilities' }),
  derive: (payload) => (calls.push(['changeset.derive', payload]), { service: 'changeset-derive' }),
  validateChangeSet: (payload) => (calls.push(['changeset.validate', payload]), { service: 'changeset-validate' }),
  apply: (payload) => (calls.push(['changeset.apply', payload]), { service: 'changeset-apply' }),
});
const dispatcher = createCategorizedInputXmlWorkerDispatcher({
  producerService,
  categorizedService,
  changeSetService,
});
assert.deepEqual(dispatcher.listOperations(), CATEGORIZED_INPUTXML_WORKER_OPERATIONS);
assert.equal(dispatcher.getCapabilities().protocol, CATEGORIZED_INPUTXML_WORKER_PROTOCOL);

assert.equal(dispatcher.dispatch('producer.categorizeInputXml', { id: 0 }).service, 'producer-categorize');
assert.equal(dispatcher.dispatch('categorized.capabilities').service, 'categorized-capabilities');
assert.equal(dispatcher.dispatch('categorized.validate', { id: 1 }).service, 'categorized-validate');
assert.equal(dispatcher.dispatch('categorized.inspect', { id: 2 }).service, 'categorized-inspect');
assert.equal(dispatcher.dispatch('categorized.serialize', { id: 3 }).service, 'categorized-serialize');
assert.equal(dispatcher.dispatch('categorized.exportSourceInputXml', { id: 4 }).service, 'categorized-export');
assert.equal(dispatcher.dispatch('changeset.capabilities').service, 'changeset-capabilities');
assert.equal(dispatcher.dispatch('changeset.derive', { id: 5 }).service, 'changeset-derive');
assert.equal(dispatcher.dispatch('changeset.validate', { changeSet: { id: 6 } }).service, 'changeset-validate');
assert.equal(dispatcher.dispatch('changeset.apply', { id: 7 }).service, 'changeset-apply');
assert.deepEqual(calls[0], ['producer.categorize', { id: 0 }]);
assert.deepEqual(calls.at(-2), ['changeset.validate', { id: 6 }]);
assert.throws(() => dispatcher.dispatch('not-supported'), (error) => error.code === 'OPERATION_UNKNOWN');

console.log('CategorizedInputXML worker protocol and dispatcher tests passed');
