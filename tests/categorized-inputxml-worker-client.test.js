import assert from 'node:assert/strict';

import {
  CategorizedInputXmlWorkerClientError,
  createCategorizedInputXmlBrowserWorker,
  createCategorizedInputXmlWorkerClient,
  createWorkerResponse,
} from '../xml-compare/categorized-inputxml-worker/index.js';

function createManualWorker() {
  const listeners = new Map();
  return {
    posted: [],
    terminated: false,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    postMessage(message) {
      this.posted.push(structuredClone(message));
    },
    emit(type, event) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    terminate() {
      this.terminated = true;
    },
  };
}

async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CategorizedInputXmlWorkerClientError);
    assert.equal(error.code, code);
    return true;
  });
}

class CapturingWorker {
  constructor(url, options) {
    this.url = url;
    this.options = options;
  }
}

const createdWorker = createCategorizedInputXmlBrowserWorker({
  WorkerCtor: CapturingWorker,
  url: 'worker-entry.js',
  name: 'worker-test',
});
assert.equal(createdWorker.url, 'worker-entry.js');
assert.deepEqual(createdWorker.options, { type: 'module', name: 'worker-test' });

const worker = createManualWorker();
const client = createCategorizedInputXmlWorkerClient({ worker, clientId: 'client-test' });
const first = client.request('categorized.capabilities', null, { requestId: 'client-success' });
assert.equal(client.pendingCount(), 1);
worker.emit('message', { data: createWorkerResponse({
  requestId: 'client-success',
  operation: 'categorized.capabilities',
  result: { ok: true },
}) });
assert.deepEqual(await first, { ok: true });
assert.equal(client.pendingCount(), 0);

const duplicateFirst = client.request('categorized.inspect', {}, { requestId: 'client-duplicate' });
await rejectsWithCode(
  client.request('categorized.validate', {}, { requestId: 'client-duplicate' }),
  'REQUEST_DUPLICATE',
);
worker.emit('message', { data: createWorkerResponse({
  requestId: 'client-duplicate',
  operation: 'categorized.inspect',
  result: { inspected: true },
}) });
assert.deepEqual(await duplicateFirst, { inspected: true });

await rejectsWithCode(client.request('unknown.operation'), 'OPERATION_UNKNOWN');

const invalidResponse = client.request('categorized.serialize', {}, { requestId: 'client-invalid-response' });
worker.emit('message', { data: {
  requestId: 'client-invalid-response',
  protocol: 'wrong',
  schema: 'wrong',
  kind: 'response',
  ok: true,
} });
await rejectsWithCode(invalidResponse, 'WORKER_RESPONSE_INVALID');

const abortController = new AbortController();
const aborted = client.request('categorized.inspect', {}, {
  requestId: 'client-abort',
  signal: abortController.signal,
});
abortController.abort('user-abort');
await rejectsWithCode(aborted, 'REQUEST_ABORTED');
assert.ok(worker.posted.some((item) => item.kind === 'cancel' && item.requestId === 'client-abort'));
worker.emit('message', { data: createWorkerResponse({
  requestId: 'client-abort',
  operation: 'categorized.inspect',
  result: { late: true },
}) });
assert.equal(client.pendingCount(), 0, 'late responses are ignored after abort');

const alreadyAborted = new AbortController();
alreadyAborted.abort();
await rejectsWithCode(client.request('categorized.inspect', {}, {
  signal: alreadyAborted.signal,
}), 'REQUEST_ABORTED');

const timedOut = client.request('changeset.derive', {}, {
  requestId: 'client-timeout',
  timeoutMs: 5,
});
await rejectsWithCode(timedOut, 'REQUEST_TIMEOUT');
assert.ok(worker.posted.some((item) => item.kind === 'cancel' && item.requestId === 'client-timeout'));

const runtimeError = client.request('changeset.apply', {}, { requestId: 'client-runtime-error' });
worker.emit('error', { message: 'worker crashed' });
await rejectsWithCode(runtimeError, 'WORKER_RUNTIME_ERROR');
assert.equal(client.pendingCount(), 0);

const closePending = client.request('categorized.validate', {}, { requestId: 'client-close' });
client.close({ terminate: false });
await rejectsWithCode(closePending, 'CLIENT_CLOSED');
assert.equal(client.isClosed(), true);
assert.equal(worker.terminated, false);
await rejectsWithCode(client.request('categorized.capabilities'), 'CLIENT_CLOSED');

const terminatingWorker = createManualWorker();
const terminatingClient = createCategorizedInputXmlWorkerClient({ worker: terminatingWorker });
terminatingClient.close();
assert.equal(terminatingWorker.terminated, true);

console.log('CategorizedInputXML worker client lifecycle tests passed');
