import assert from 'node:assert/strict';

import {
  createWorkerCancel,
  createWorkerRequest,
  installCategorizedInputXmlWorkerRuntime,
} from '../xml-compare/categorized-inputxml-worker/index.js';

function createWorkerScopeHarness() {
  const listeners = new Map([['message', new Set()]]);
  const posted = [];
  return {
    posted,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    postMessage(message) {
      posted.push(structuredClone(message));
    },
    emit(message) {
      for (const listener of listeners.get('message') || []) listener({ data: structuredClone(message) });
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

async function drain(queue) {
  while (queue.length) {
    queue.shift()();
    await Promise.resolve();
    await Promise.resolve();
  }
}

function dispatcher(handler) {
  return Object.freeze({
    dispatch: handler,
    getCapabilities: () => ({ protocol: 'test-worker/v1' }),
  });
}

const scope = createWorkerScopeHarness();
const scheduled = [];
const runtime = installCategorizedInputXmlWorkerRuntime({
  scope,
  schedule: (task) => scheduled.push(task),
  dispatcher: dispatcher((operation, payload) => ({ operation, payload })),
});
assert.equal(scope.listenerCount('message'), 1);
assert.equal(runtime.pendingCount(), 0);
assert.equal(runtime.getCapabilities().protocol, 'test-worker/v1');

const first = createWorkerRequest({
  requestId: 'runtime-1',
  operation: 'categorized.inspect',
  payload: { id: 1 },
});
scope.emit(first);
assert.equal(runtime.pendingCount(), 1);
assert.equal(scheduled.length, 1);
await drain(scheduled);
assert.equal(runtime.pendingCount(), 0);
assert.equal(scope.posted.at(-1).ok, true);
assert.deepEqual(scope.posted.at(-1).result, {
  operation: 'categorized.inspect',
  payload: { id: 1 },
});

const duplicate = createWorkerRequest({
  requestId: 'runtime-duplicate',
  operation: 'categorized.validate',
  payload: {},
});
scope.emit(duplicate);
scope.emit(duplicate);
assert.equal(runtime.pendingCount(), 1);
assert.ok(scope.posted.some((item) => item.requestId === 'runtime-duplicate' && item.error?.code === 'REQUEST_DUPLICATE'));
await drain(scheduled);
assert.ok(scope.posted.some((item) => item.requestId === 'runtime-duplicate' && item.ok === true));

const cancelled = createWorkerRequest({
  requestId: 'runtime-cancelled',
  operation: 'categorized.serialize',
  payload: {},
});
scope.emit(cancelled);
scope.emit(createWorkerCancel({ requestId: 'runtime-cancelled', reason: 'user-stopped' }));
await drain(scheduled);
const cancelledResponse = scope.posted.find((item) => item.requestId === 'runtime-cancelled');
assert.equal(cancelledResponse.ok, false);
assert.equal(cancelledResponse.error.code, 'REQUEST_CANCELLED');
assert.equal(cancelledResponse.error.message, 'user-stopped');

scope.emit(createWorkerCancel({ requestId: 'not-pending' }));
assert.equal(scope.posted.at(-1).error.code, 'REQUEST_NOT_PENDING');

scope.emit(createWorkerRequest({ requestId: 'bad-operation', operation: 'unknown.operation' }));
assert.equal(scope.posted.at(-1).error.code, 'OPERATION_UNKNOWN');
assert.equal(runtime.pendingCount(), 0);

const failingScope = createWorkerScopeHarness();
const failingTasks = [];
const failingRuntime = installCategorizedInputXmlWorkerRuntime({
  scope: failingScope,
  schedule: (task) => failingTasks.push(task),
  dispatcher: dispatcher(() => {
    const error = new Error('dispatcher failed');
    error.code = 'DISPATCH_FAILED';
    throw error;
  }),
});
failingScope.emit(createWorkerRequest({
  requestId: 'runtime-failure',
  operation: 'changeset.apply',
  payload: {},
}));
await drain(failingTasks);
assert.equal(failingScope.posted[0].ok, false);
assert.equal(failingScope.posted[0].error.code, 'DISPATCH_FAILED');
assert.equal(failingScope.posted[0].error.message, 'dispatcher failed');
assert.equal('stack' in failingScope.posted[0].error, false);

let resolveDeferred;
const deferred = new Promise((resolve) => { resolveDeferred = resolve; });
const asyncScope = createWorkerScopeHarness();
const asyncTasks = [];
const asyncRuntime = installCategorizedInputXmlWorkerRuntime({
  scope: asyncScope,
  schedule: (task) => asyncTasks.push(task),
  dispatcher: dispatcher(() => deferred),
});
asyncScope.emit(createWorkerRequest({
  requestId: 'runtime-async-cancel',
  operation: 'changeset.derive',
  payload: {},
}));
asyncTasks.shift()();
await Promise.resolve();
asyncScope.emit(createWorkerCancel({ requestId: 'runtime-async-cancel', reason: 'cancel-during-await' }));
resolveDeferred({ ignored: true });
await Promise.resolve();
await Promise.resolve();
assert.equal(asyncScope.posted.at(-1).error.code, 'REQUEST_CANCELLED');
assert.equal(asyncScope.posted.at(-1).error.message, 'cancel-during-await');

runtime.dispose();
assert.equal(runtime.isDisposed(), true);
assert.equal(scope.listenerCount('message'), 0);
scope.emit(first);
assert.equal(runtime.pendingCount(), 0);
failingRuntime.dispose();
asyncRuntime.dispose();

console.log('CategorizedInputXML worker runtime tests passed');
