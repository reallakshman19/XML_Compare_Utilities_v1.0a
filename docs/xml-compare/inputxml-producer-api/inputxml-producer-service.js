import {
  categorizedFileName,
  inputXmlToCategorizedInputXml,
} from '../CategorizedInputXmlConverter.js';
import {
  contentFingerprint,
  validateCategorizedInputXml,
} from '../categorized-inputxml-api/index.js';
import {
  INPUTXML_PRODUCER_RESULT_SCHEMA,
  createInputXmlProducerCapabilities,
  createProducerDiagnostic,
  normalizeProducerRequest,
  producerDiagnosticCounts,
  producerSucceeded,
} from './inputxml-producer-contracts.js';

const clean = (value) => String(value ?? '').trim();

function attrsOf(tag = '') {
  const attrs = {};
  String(tag).replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (_all, key, _quoted, dq, sq) => {
    attrs[key] = dq ?? sq ?? '';
    return _all;
  });
  return Object.freeze(attrs);
}

function openTag(text = '', name = '') {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).match(new RegExp(`<${escaped}\\b[^>]*>`, 'i'))?.[0] || '';
}

export function pipingElementCount(text = '') {
  return (String(text).match(/<PIPINGELEMENT\b/gi) || []).length;
}

function add(rows, input) {
  rows.push(createProducerDiagnostic(input));
}

function producerDiagnostics(request, rows) {
  if (request.producer.id) return;
  add(rows, {
    severity: 'error',
    code: 'PRODUCER_ID_MISSING',
    message: 'Producer identity is required for traceable categorization.',
    location: { field: 'producer.id' },
    action: 'reject',
  });
}

function rootDiagnostics(request, rows) {
  const content = request.source.content;
  if (!clean(content)) {
    add(rows, {
      severity: 'error', code: 'INPUTXML_EMPTY',
      message: 'InputXML content is empty.', action: 'reject',
    });
    return;
  }
  const root = openTag(content, 'CAESARII');
  if (!root) add(rows, {
    severity: 'error', code: 'INPUTXML_ROOT_INVALID',
    message: 'InputXML root must be CAESARII.', action: 'reject',
  });
  const xmlType = attrsOf(root).XML_TYPE;
  if (root && clean(xmlType).toLowerCase() !== 'input') add(rows, {
    severity: 'error', code: 'INPUTXML_TYPE_INVALID',
    message: 'CAESARII XML_TYPE must be Input.',
    location: { field: 'CAESARII@XML_TYPE' }, value: xmlType || null, action: 'reject',
  });
}

function modelDiagnostics(request, rows) {
  const content = request.source.content;
  if (!/<PIPINGMODEL\b/i.test(content)) add(rows, {
    severity: 'error', code: 'PIPINGMODEL_MISSING',
    message: 'InputXML requires a PIPINGMODEL element.', action: 'reject',
  });
  const count = pipingElementCount(content);
  if (!count) add(rows, {
    severity: 'error', code: 'PIPINGELEMENT_MISSING',
    message: 'InputXML requires at least one PIPINGELEMENT.', action: 'reject',
  });
}

export function validateInputXmlProducerRequest(request = {}) {
  const normalized = normalizeProducerRequest(request);
  const diagnostics = [];
  producerDiagnostics(normalized, diagnostics);
  rootDiagnostics(normalized, diagnostics);
  if (clean(normalized.source.content)) modelDiagnostics(normalized, diagnostics);
  return Object.freeze({ normalized, diagnostics: Object.freeze(diagnostics) });
}

function buildArtifact(request, text) {
  return Object.freeze({
    id: 'categorized-inputxml',
    role: 'categorized-review-document',
    filename: categorizedFileName(request.source.filename),
    mediaType: 'application/xml',
    text,
    fingerprint: contentFingerprint(text),
    sourceFingerprint: request.source.fingerprint,
  });
}

function categorizedValidation(request, artifact) {
  return validateCategorizedInputXml({
    requestId: `${request.requestId}-categorized-validation`,
    source: { filename: artifact.filename, content: artifact.text },
    options: { schemaPolicy: 'require-v3', diagnosticsLevel: 'full' },
  });
}

function resultSummary(request, validation = null) {
  return Object.freeze({
    inputElements: pipingElementCount(request.source.content),
    categorizedLines: validation?.summary?.lines || 0,
    categorizedElements: validation?.summary?.elements || 0,
    categorizedNodes: validation?.summary?.nodes || 0,
  });
}

function failureResult(request, diagnostics, validation = null) {
  return Object.freeze({
    schema: INPUTXML_PRODUCER_RESULT_SCHEMA,
    requestId: request.requestId,
    success: false,
    producer: request.producer,
    source: Object.freeze({ filename: request.source.filename, fingerprint: request.source.fingerprint }),
    summary: resultSummary(request, validation),
    diagnosticCounts: producerDiagnosticCounts(diagnostics),
    diagnostics: Object.freeze(diagnostics),
    categorizedValidation: validation,
    artifact: null,
  });
}

function successResult(request, diagnostics, validation, artifact) {
  return Object.freeze({
    schema: INPUTXML_PRODUCER_RESULT_SCHEMA,
    requestId: request.requestId,
    success: true,
    producer: request.producer,
    source: Object.freeze({ filename: request.source.filename, fingerprint: request.source.fingerprint }),
    summary: resultSummary(request, validation),
    diagnosticCounts: producerDiagnosticCounts(diagnostics),
    diagnostics: Object.freeze(diagnostics),
    categorizedValidation: validation,
    artifact,
  });
}

function conversionFailure(request, diagnostics, error) {
  const item = createProducerDiagnostic({
    severity: 'error', code: 'CATEGORIZATION_FAILED',
    message: clean(error?.message || error || 'InputXML categorization failed.'),
    action: 'reject',
  });
  return failureResult(request, [...diagnostics, item]);
}

export function categorizeProducerInputXml(request = {}) {
  const checked = validateInputXmlProducerRequest(request);
  const normalized = checked.normalized;
  if (!producerSucceeded(checked.diagnostics)) return failureResult(normalized, checked.diagnostics);
  try {
    const text = inputXmlToCategorizedInputXml(normalized.source.content, {
      sourceName: normalized.source.filename,
    });
    const artifact = buildArtifact(normalized, text);
    const validation = categorizedValidation(normalized, artifact);
    if (!validation.success) {
      const invalid = createProducerDiagnostic({
        severity: 'error', code: 'CATEGORIZED_OUTPUT_INVALID',
        message: 'Generated CategorizedInputXML failed service validation.', action: 'reject',
      });
      return failureResult(normalized, [...checked.diagnostics, invalid], validation);
    }
    return successResult(normalized, checked.diagnostics, validation, artifact);
  } catch (error) {
    return conversionFailure(normalized, checked.diagnostics, error);
  }
}

export function createInputXmlProducerService() {
  return Object.freeze({
    getCapabilities: createInputXmlProducerCapabilities,
    categorizeInputXml: categorizeProducerInputXml,
  });
}

export const _test = Object.freeze({
  clean,
  attrsOf,
  openTag,
  producerDiagnostics,
  rootDiagnostics,
  modelDiagnostics,
  buildArtifact,
  categorizedValidation,
  resultSummary,
  failureResult,
  successResult,
  conversionFailure,
});
