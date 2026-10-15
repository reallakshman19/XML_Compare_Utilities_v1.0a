import { createCategorizedInputXmlWorkerDispatcher } from './worker-dispatcher.js';
import {
  createWorkerFailure,
  createWorkerResponse,
  validateWorkerInbound,
} from './worker-contracts.js';

function defaultSchedule(task) {
  return setTimeout(task, 0);
}

function requireWorkerScope(scope = {}) {
  for (const name of ['addEventListener', 'removeEventListener', 'postMessage']) {
    if (typeof scope[name] !== 'function') throw new TypeError(`Worker scope requires ${name}().`);
  }
  return scope;
}

function transportError(code, message, operation = '') {
  return Object.freeze({ code, message, operation, retryable: false, name: 'WorkerTransportError' });
}

function requestFailure(message, code, text) {
  return createWorkerFailure({
    requestId: message?.requestId || 'unassigned',
    operation: message?.operation || '',
    error: transportError(code, text, message?.operation || ''),
  });
}

function cancelledFailure(entry = {}) {
  return createWorkerFailure({
    requestId: entry.request?.requestId || 'unassigned',
    operation: entry.request?.operation || '',
    error: transportError('REQUEST_CANCELLED', entry.cancelReason || 'Request was cancelled.', entry.request?.operation || ''),
  });
}

class WorkerRuntimeController {
  constructor(options = {}) {
    this.scope = requireWorkerScope(options.scope || globalThis);
    this.dispatcher = options.dispatcher || createCategorizedInputXmlWorkerDispatcher();
    this.schedule = options.schedule || defaultSchedule;
    this.pending = new Map();
    this.disposed = false;
    this.handleMessage = this.handleMessage.bind(this);
    this.scope.addEventListener('message', this.handleMessage);
  }

  post(message) {
    this.scope.postMessage(message);
  }

  async execute(requestId) {
    const entry = this.pending.get(requestId);
    if (!entry || this.disposed) return;
    if (entry.cancelled) return this.completeCancelled(entry);
    try {
      const result = await this.dispatcher.dispatch(entry.request.operation, entry.request.payload);
      this.completeSuccess(requestId, result);
    } catch (error) {
      this.completeFailure(requestId, entry, error);
    } finally {
      this.pending.delete(requestId);
    }
  }

  completeSuccess(requestId, result) {
    const current = this.pending.get(requestId);
    if (!current || this.disposed) return;
    if (current.cancelled) return this.completeCancelled(current);
    this.post(createWorkerResponse({
      requestId,
      operation: current.request.operation,
      result,
    }));
  }

  completeFailure(requestId, fallback, error) {
    const current = this.pending.get(requestId) || fallback;
    if (this.disposed) return;
    this.post(createWorkerFailure({
      requestId,
      operation: current.request.operation,
      error,
    }));
  }

  completeCancelled(entry) {
    this.pending.delete(entry.request.requestId);
    if (!this.disposed) this.post(cancelledFailure(entry));
  }

  queueRequest(message) {
    if (this.pending.has(message.requestId)) {
      this.post(requestFailure(message, 'REQUEST_DUPLICATE', 'Request ID is already pending.'));
      return;
    }
    this.pending.set(message.requestId, {
      request: message,
      cancelled: false,
      cancelReason: '',
    });
    this.schedule(() => void this.execute(message.requestId));
  }

  cancelRequest(message) {
    const entry = this.pending.get(message.requestId);
    if (!entry) {
      this.post(requestFailure(message, 'REQUEST_NOT_PENDING', 'Request is not pending.'));
      return;
    }
    entry.cancelled = true;
    entry.cancelReason = message.reason || 'Request was cancelled.';
  }

  handleMessage(event = {}) {
    if (this.disposed) return;
    const message = event.data;
    const validation = validateWorkerInbound(message);
    if (!validation.valid) {
      this.post(requestFailure(message, validation.code, validation.message));
      return;
    }
    if (message.kind === 'cancel') this.cancelRequest(message);
    else this.queueRequest(message);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pending.clear();
    this.scope.removeEventListener('message', this.handleMessage);
  }

  publicApi() {
    return Object.freeze({
      dispose: this.dispose.bind(this),
      pendingCount: () => this.pending.size,
      isDisposed: () => this.disposed,
      getCapabilities: () => this.dispatcher.getCapabilities(),
    });
  }
}

export function installCategorizedInputXmlWorkerRuntime(options = {}) {
  return new WorkerRuntimeController(options).publicApi();
}

export const _test = Object.freeze({
  defaultSchedule,
  requireWorkerScope,
  transportError,
  requestFailure,
  cancelledFailure,
  WorkerRuntimeController,
});
