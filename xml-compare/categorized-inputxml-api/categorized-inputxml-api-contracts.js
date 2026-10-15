export const CATEGORIZED_INPUTXML_SERVICE_VERSION = '1.0.0';
export const CATEGORIZED_INPUTXML_REQUEST_SCHEMA = 'CategorizedInputXmlServiceRequest.v1';
export const CATEGORIZED_INPUTXML_DIAGNOSTIC_SCHEMA = 'CategorizedInputXmlDiagnostic.v1';
export const CATEGORIZED_INPUTXML_READ_MODEL_SCHEMA = 'CategorizedInputXmlReadModel.v1';
export const CATEGORIZED_INPUTXML_INSPECTION_SCHEMA = 'CategorizedInputXmlInspectionResult.v1';
export const CATEGORIZED_INPUTXML_SERIALIZATION_SCHEMA = 'CategorizedInputXmlSerializationResult.v1';
export const CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA = 'CategorizedInputXmlSourceExportResult.v1';
export const CATEGORIZED_INPUTXML_CAPABILITIES_SCHEMA = 'CategorizedInputXmlCapabilities.v1';

const clean = (value) => String(value ?? '').trim();

export function contentFingerprint(text = '') {
  let hash = 0x811c9dc5;
  for (const char of String(text ?? '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function normalizeServiceOptions(options = {}) {
  const schemaPolicy = options.schemaPolicy === 'require-v3' ? 'require-v3' : 'allow-compatible';
  const diagnosticsLevel = options.diagnosticsLevel === 'errors-only' ? 'errors-only' : 'full';
  return Object.freeze({ schemaPolicy, diagnosticsLevel });
}

export function normalizeServiceRequest(request = {}) {
  const source = request.source || {};
  const content = String(source.content ?? request.content ?? '');
  const filename = clean(source.filename || request.filename || 'categorized.xml');
  const fingerprint = contentFingerprint(content);
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_REQUEST_SCHEMA,
    requestId: clean(request.requestId) || `cix-${fingerprint.slice(-8)}`,
    source: Object.freeze({ filename, content, fingerprint }),
    options: normalizeServiceOptions(request.options),
  });
}

export function diagnosticCounts(diagnostics = []) {
  const counts = { error: 0, warning: 0, information: 0 };
  for (const item of diagnostics) {
    if (item?.severity === 'error') counts.error += 1;
    else if (item?.severity === 'warning') counts.warning += 1;
    else counts.information += 1;
  }
  return Object.freeze(counts);
}

export function sourceDescriptor(request = {}) {
  return Object.freeze({
    filename: request.source?.filename || 'categorized.xml',
    fingerprint: request.source?.fingerprint || contentFingerprint(request.source?.content || ''),
  });
}

export function successful(diagnostics = []) {
  return !diagnostics.some((item) => item?.severity === 'error');
}

export function filteredDiagnostics(diagnostics = [], level = 'full') {
  const rows = level === 'errors-only'
    ? diagnostics.filter((item) => item.severity === 'error')
    : diagnostics;
  return Object.freeze(rows.map((item) => Object.freeze({ ...item })));
}

export function createCapabilities() {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_CAPABILITIES_SCHEMA,
    serviceVersion: CATEGORIZED_INPUTXML_SERVICE_VERSION,
    documentRoot: 'CategorizedInputXML',
    generatedSchema: 'categorized-inputxml/v3',
    operations: Object.freeze(['validate', 'inspect', 'serialize', 'exportSourceInputXml']),
    policies: Object.freeze({
      schema: Object.freeze(['allow-compatible', 'require-v3']),
      diagnostics: Object.freeze(['full', 'errors-only']),
    }),
    writeCapabilities: Object.freeze({
      normalizedReconciliation: false,
      inputXmlMutation: false,
      ciiConversion: false,
      sourceEvidenceExport: true,
    }),
  });
}
