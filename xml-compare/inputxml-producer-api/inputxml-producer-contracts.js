import { contentFingerprint } from '../categorized-inputxml-api/index.js';

export const INPUTXML_PRODUCER_SERVICE_VERSION = '1.0.0';
export const INPUTXML_PRODUCER_REQUEST_SCHEMA = 'InputXmlProducerCategorizeRequest.v1';
export const INPUTXML_PRODUCER_RESULT_SCHEMA = 'InputXmlProducerCategorizeResult.v1';
export const INPUTXML_PRODUCER_DIAGNOSTIC_SCHEMA = 'InputXmlProducerDiagnostic.v1';
export const INPUTXML_PRODUCER_CAPABILITIES_SCHEMA = 'InputXmlProducerCapabilities.v1';

const clean = (value) => String(value ?? '').trim();

export function normalizeProducerDescriptor(value = {}) {
  return Object.freeze({
    id: clean(value.id),
    repository: clean(value.repository),
    module: clean(value.module),
    operation: clean(value.operation),
    version: clean(value.version),
    artifactRole: clean(value.artifactRole || 'generated-inputxml'),
  });
}

export function normalizeProducerSource(value = {}) {
  const content = String(value.content ?? '');
  return Object.freeze({
    filename: clean(value.filename || 'input.xml'),
    content,
    fingerprint: contentFingerprint(content),
  });
}

export function normalizeProducerRequest(request = {}) {
  const source = normalizeProducerSource(request.source || {});
  return Object.freeze({
    schema: INPUTXML_PRODUCER_REQUEST_SCHEMA,
    requestId: clean(request.requestId) || `producer-${source.fingerprint.slice(-8)}`,
    producer: normalizeProducerDescriptor(request.producer || {}),
    source,
  });
}

export function createProducerDiagnostic({
  severity = 'information',
  code = 'UNSPECIFIED',
  message = '',
  location = {},
  action = 'review',
  value = null,
} = {}) {
  return Object.freeze({
    schema: INPUTXML_PRODUCER_DIAGNOSTIC_SCHEMA,
    severity,
    code,
    message,
    location: Object.freeze({ ...location }),
    action,
    value,
  });
}

export function producerDiagnosticCounts(diagnostics = []) {
  const counts = { error: 0, warning: 0, information: 0 };
  for (const item of diagnostics) {
    if (item?.severity === 'error') counts.error += 1;
    else if (item?.severity === 'warning') counts.warning += 1;
    else counts.information += 1;
  }
  return Object.freeze(counts);
}

export function producerSucceeded(diagnostics = []) {
  return !diagnostics.some((item) => item?.severity === 'error');
}

export function createInputXmlProducerCapabilities() {
  return Object.freeze({
    schema: INPUTXML_PRODUCER_CAPABILITIES_SCHEMA,
    serviceVersion: INPUTXML_PRODUCER_SERVICE_VERSION,
    operation: 'categorizeInputXml',
    input: Object.freeze({ root: 'CAESARII', xmlType: 'Input', model: 'PIPINGMODEL' }),
    output: Object.freeze({ root: 'CategorizedInputXML', schema: 'categorized-inputxml/v3' }),
    artifactRole: 'categorized-review-document',
    mutation: false,
    reconciliation: false,
    ciiConversion: false,
  });
}

export const _test = Object.freeze({ clean });
