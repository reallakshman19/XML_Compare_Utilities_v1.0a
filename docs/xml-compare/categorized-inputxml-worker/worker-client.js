import {
  createWorkerCancel,
  createWorkerRequest,
  isWorkerOperation,
  validateWorkerResponse,
} from './worker-contracts.js';

export class CategorizedInputXmlWorkerClientError extends Error {
  constructor(message, context = {}) {
    super(String(message || 'CategorizedInputXML worker client failed.'));
    this.name = 'CategorizedInputXmlWorkerClientError';
    this.code = context.code || 'CLIENT_ERROR';
    this.operation = context.operation || '';
    this.requestId = context.requestId || '';
    this.retryable = Boolean(context.retryable);
  }
}

function clientError(code, message, context = {}) {
  return new CategorizedInputXmlWorkerClientError(message, { ...context, code });
}

export function createWorkerRequestIdFactory(prefix = 'cixw') {
  let sequence = 0;
  return () => `${String(prefix || 'cixw')}-${++sequence}`;
}

export function createCategorizedInputXmlBrowserWorker(options = {}) {
  const WorkerCtor = options.WorkerCtor || globalThis.Worker;
  if (typeof WorkerCtor !== 'function') throw clientError('WORKER_UNAVAILABLE', 'Browser Worker constructor is unavailable.');
  const url = options.url || new URL('./categorized-inputxml.worker.js', import.meta.url);
  return new WorkerCtor(url, {
    type: 'module',
    name: options.name || 'categorized-inputxml-api',
  });
}

function requireWorker(worker = {}) {
  for (const name of ['addEventListener', 'removeEventListener', 'postMessage']) {
    if (typeof worker[name] !== 'function') throw new TypeError(`Worker client requires ${name}().`);
  }
  return worker;
}

function responseError(message = {}) {
  const error = message.error || {};
  return clientError(error.code || 'WORKER_OPERATION_FAILED', error.message || 'Worker operation failed.', {
    operation: message.operation,
    requestId: message.requestId,
    retryable: error.retryable,
  });
}

function cleanupEntry(entry = {}) {
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  if (entry.signal && entry.abortListener) entry.signal.removeEventListener('abort', entry.abortListener);
}

function requestTimeout(options = {}) {
  const value = Number(options.timeoutMs || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

class WorkerClientController {
  constructor(options = {}) {
    this.worker = requireWorker(options.worker || createCategorizedInputXmlBrowserWorker(options));
    this.nextRequestId = options.requestIdFactory || createWorkerRequestIdFactory(options.clientId || 'cixw');
    this.pending = new Map();
    this.closed = false;
    this.onMessage = this.onMessage.bind(this);
    this.onWorkerError = this.onWorkerError.bind(this);
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onWorkerError);
  }

  finish(requestId, callback) {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    this.pending.delete(requestId);
    cleanupEntry(entry);
    callback(entry);
    return true;
  }

  postCancel(requestId, reason) {
    try {
      this.worker.postMessage(createWorkerCancel({ requestId, reason }));
    } catch {
      // Local rejection remains authoritative when a terminating worker cannot receive cancellation.
    }
  }

  rejectPending(requestId, code, message, reason = code) {
    return this.finish(requestId, (entry) => {
      this.postCancel(requestId, reason);
      entry.reject(clientError(code, message, {
        operation: entry.operation,
        requestId,
      }));
    });
  }

  onMessage(event = {}) {
    const message = event.data;
    const validation = validateWorkerResponse(message);
    if (!validation.valid) return this.rejectInvalidResponse(message, validation);
    this.finish(message.requestId, (entry) => {
      if (message.ok) entry.resolve(message.result);
      else entry.reject(responseError(message));
    });
  }

  rejectInvalidResponse(message = {}, validation = {}) {
    const requestId = message?.requestId || '';
    this.finish(requestId, (entry) => entry.reject(clientError(
      'WORKER_RESPONSE_INVALID', validation.message, { operation: entry.operation, requestId },
    )));
  }

  rejectAll(code, message) {
    for (const requestId of [...this.pending.keys()]) {
      this.finish(requestId, (entry) => entry.reject(clientError(code, message, {
        operation: entry.operation,
        requestId,
      })));
    }
  }

  onWorkerError(event = {}) {
    this.rejectAll('WORKER_RUNTIME_ERROR', event.message || 'Browser worker raised an error.');
  }

  configureAbort(entry, signal) {
    if (!signal) return;
    entry.signal = signal;
    entry.abortListener = () => this.rejectPending(
      entry.requestId, 'REQUEST_ABORTED', 'Worker request was aborted.', signal.reason || 'abort-signal',
    );
    signal.addEventListener('abort', entry.abortListener, { once: true });
  }

  configureTimeout(entry, timeoutMs) {
    if (!timeoutMs) return;
    entry.timeoutId = setTimeout(() => this.rejectPending(
      entry.requestId, 'REQUEST_TIMEOUT', `Worker request timed out after ${timeoutMs} ms.`, 'timeout',
    ), timeoutMs);
  }

  validateRequest(operation, requestOptions = {}) {
    if (this.closed) return clientError('CLIENT_CLOSED', 'Worker client is closed.', { operation });
    if (!isWorkerOperation(operation)) return clientError('OPERATION_UNKNOWN', `Unsupported worker operation: ${operation}`, { operation });
    if (requestOptions.signal?.aborted) return clientError('REQUEST_ABORTED', 'Worker request was aborted before dispatch.', { operation });
    return null;
  }

  request(operation, payload = null, requestOptions = {}) {
    const invalid = this.validateRequest(operation, requestOptions);
    if (invalid) return Promise.reject(invalid);
    const requestId = requestOptions.requestId || this.nextRequestId();
    if (this.pending.has(requestId)) return Promise.reject(clientError(
      'REQUEST_DUPLICATE', 'Request ID is already pending.', { operation, requestId },
    ));
    return new Promise((resolve, reject) => this.dispatchRequest(
      { requestId, operation, payload, requestOptions, resolve, reject },
    ));
  }

  dispatchRequest(input) {
    const entry = {
      requestId: input.requestId,
      operation: input.operation,
      resolve: input.resolve,
      reject: input.reject,
      signal: null,
      abortListener: null,
      timeoutId: null,
    };
    this.pending.set(input.requestId, entry);
    this.configureAbort(entry, input.requestOptions.signal);
    this.configureTimeout(entry, requestTimeout(input.requestOptions));
    try {
      this.worker.postMessage(createWorkerRequest(input));
    } catch (error) {
      this.finish(input.requestId, () => input.reject(clientError(
        'WORKER_POST_FAILED', error.message, input,
      )));
    }
  }

  close(options = {}) {
    if (this.closed) return;
    this.closed = true;
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onWorkerError);
    this.rejectAll('CLIENT_CLOSED', 'Worker client was closed.');
    if (options.terminate !== false && typeof this.worker.terminate === 'function') this.worker.terminate();
  }

  publicApi() {
    const request = this.request.bind(this);
    return Object.freeze({
      request,
      producer: producerApi(request),
      categorized: categorizedApi(request),
      changeSet: changeSetApi(request),
      close: this.close.bind(this),
      pendingCount: () => this.pending.size,
      isClosed: () => this.closed,
    });
  }
}

function producerApi(request) {
  return Object.freeze({
    categorizeInputXml: (value, options) => request('producer.categorizeInputXml', value, options),
  });
}

function categorizedApi(request) {
  return Object.freeze({
    getCapabilities: (options) => request('categorized.capabilities', null, options),
    validate: (value, options) => request('categorized.validate', value, options),
    inspect: (value, options) => request('categorized.inspect', value, options),
    serialize: (value, options) => request('categorized.serialize', value, options),
    exportSourceInputXml: (value, options) => request('categorized.exportSourceInputXml', value, options),
  });
}

function changeSetApi(request) {
  return Object.freeze({
    getCapabilities: (options) => request('changeset.capabilities', null, options),
    derive: (value, options) => request('changeset.derive', value, options),
    validate: (value, options) => request('changeset.validate', { changeSet: value }, options),
    apply: (value, options) => request('changeset.apply', value, options),
  });
}

export function createCategorizedInputXmlWorkerClient(options = {}) {
  return new WorkerClientController(options).publicApi();
}

export const _test = Object.freeze({
  clientError,
  requireWorker,
  responseError,
  cleanupEntry,
  requestTimeout,
  WorkerClientController,
  producerApi,
  categorizedApi,
  changeSetApi,
});
