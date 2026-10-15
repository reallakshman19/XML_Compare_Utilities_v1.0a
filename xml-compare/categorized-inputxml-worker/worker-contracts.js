export const CATEGORIZED_INPUTXML_WORKER_PROTOCOL = 'categorized-inputxml-worker/v1';
export const CATEGORIZED_INPUTXML_WORKER_VERSION = '1.1.0';
export const CATEGORIZED_INPUTXML_WORKER_REQUEST_SCHEMA = 'CategorizedInputXmlWorkerRequest.v1';
export const CATEGORIZED_INPUTXML_WORKER_CANCEL_SCHEMA = 'CategorizedInputXmlWorkerCancel.v1';
export const CATEGORIZED_INPUTXML_WORKER_RESPONSE_SCHEMA = 'CategorizedInputXmlWorkerResponse.v1';
export const CATEGORIZED_INPUTXML_WORKER_CAPABILITIES_SCHEMA = 'CategorizedInputXmlWorkerCapabilities.v1';

export const CATEGORIZED_INPUTXML_WORKER_OPERATIONS = Object.freeze([
  'producer.categorizeInputXml',
  'categorized.capabilities',
  'categorized.validate',
  'categorized.inspect',
  'categorized.serialize',
  'categorized.exportSourceInputXml',
  'changeset.capabilities',
  'changeset.derive',
  'changeset.validate',
  'changeset.apply',
]);

const OPERATION_SET = new Set(CATEGORIZED_INPUTXML_WORKER_OPERATIONS);
const clean = (value) => String(value ?? '').trim();

export function createWorkerRequest({ requestId = '', operation = '', payload = null } = {}) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_WORKER_REQUEST_SCHEMA,
    protocol: CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
    kind: 'request',
    requestId: clean(requestId),
    operation: clean(operation),
    payload,
  });
}

export function createWorkerCancel({ requestId = '', reason = 'client-cancelled' } = {}) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_WORKER_CANCEL_SCHEMA,
    protocol: CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
    kind: 'cancel',
    requestId: clean(requestId),
    reason: clean(reason) || 'client-cancelled',
  });
}

export function normalizeWorkerError(error, context = {}) {
  const source = error && typeof error === 'object' ? error : {};
  return Object.freeze({
    code: clean(context.code || source.code || 'OPERATION_FAILED'),
    message: clean(source.message || error || 'Worker operation failed.'),
    operation: clean(context.operation || source.operation),
    retryable: Boolean(context.retryable ?? source.retryable),
    causeName: clean(source.name || 'Error'),
  });
}

export function createWorkerResponse({ requestId = '', operation = '', result = null } = {}) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_WORKER_RESPONSE_SCHEMA,
    protocol: CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
    kind: 'response',
    requestId: clean(requestId),
    operation: clean(operation),
    ok: true,
    result,
    error: null,
  });
}

export function createWorkerFailure({ requestId = '', operation = '', error = null } = {}) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_WORKER_RESPONSE_SCHEMA,
    protocol: CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
    kind: 'response',
    requestId: clean(requestId),
    operation: clean(operation),
    ok: false,
    result: null,
    error: normalizeWorkerError(error, { operation }),
  });
}

function validationResult(valid, code = '', message = '') {
  return Object.freeze({ valid, code, message });
}

function commonEnvelopeIssue(message = {}) {
  if (!message || typeof message !== 'object') return validationResult(false, 'MESSAGE_INVALID', 'Worker message must be an object.');
  if (message.protocol !== CATEGORIZED_INPUTXML_WORKER_PROTOCOL) return validationResult(false, 'PROTOCOL_UNSUPPORTED', 'Worker protocol is unsupported.');
  if (!clean(message.requestId)) return validationResult(false, 'REQUEST_ID_MISSING', 'Worker message requires requestId.');
  return null;
}

export function validateWorkerInbound(message = {}) {
  const common = commonEnvelopeIssue(message);
  if (common) return common;
  if (message.kind === 'request') {
    if (message.schema !== CATEGORIZED_INPUTXML_WORKER_REQUEST_SCHEMA) return validationResult(false, 'REQUEST_SCHEMA_INVALID', 'Request schema is invalid.');
    if (!OPERATION_SET.has(clean(message.operation))) return validationResult(false, 'OPERATION_UNKNOWN', 'Worker operation is not supported.');
    return validationResult(true);
  }
  if (message.kind === 'cancel') {
    if (message.schema !== CATEGORIZED_INPUTXML_WORKER_CANCEL_SCHEMA) return validationResult(false, 'CANCEL_SCHEMA_INVALID', 'Cancel schema is invalid.');
    return validationResult(true);
  }
  return validationResult(false, 'MESSAGE_KIND_INVALID', 'Worker message kind must be request or cancel.');
}

export function validateWorkerResponse(message = {}) {
  const common = commonEnvelopeIssue(message);
  if (common) return common;
  if (message.kind !== 'response') return validationResult(false, 'RESPONSE_KIND_INVALID', 'Worker response kind is invalid.');
  if (message.schema !== CATEGORIZED_INPUTXML_WORKER_RESPONSE_SCHEMA) return validationResult(false, 'RESPONSE_SCHEMA_INVALID', 'Worker response schema is invalid.');
  if (typeof message.ok !== 'boolean') return validationResult(false, 'RESPONSE_STATUS_INVALID', 'Worker response requires boolean ok.');
  return validationResult(true);
}

export function createWorkerCapabilities() {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_WORKER_CAPABILITIES_SCHEMA,
    protocol: CATEGORIZED_INPUTXML_WORKER_PROTOCOL,
    version: CATEGORIZED_INPUTXML_WORKER_VERSION,
    operations: CATEGORIZED_INPUTXML_WORKER_OPERATIONS,
    payloadTransport: 'structured-clone',
    artifactTransport: 'inline-text',
    cancellation: 'cooperative',
    streaming: false,
    transferableArtifacts: false,
  });
}

export function isWorkerOperation(operation = '') {
  return OPERATION_SET.has(clean(operation));
}

export const _test = Object.freeze({ clean, commonEnvelopeIssue, validationResult });
