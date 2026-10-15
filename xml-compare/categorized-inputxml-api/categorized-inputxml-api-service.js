import {
  CATEGORIZED_INPUTXML_INSPECTION_SCHEMA,
  CATEGORIZED_INPUTXML_SERIALIZATION_SCHEMA,
  CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA,
  createCapabilities,
  diagnosticCounts,
  filteredDiagnostics,
  normalizeServiceRequest,
  sourceDescriptor,
  successful,
} from './categorized-inputxml-api-contracts.js';
import {
  buildCategorizedInputXmlDiagnostics,
  createDiagnostic,
  sourceExportReady,
  summarizeCategorizedInputXml,
} from './categorized-inputxml-api-diagnostics.js';
import { parseCategorizedInputXmlModel } from './categorized-inputxml-api-model.js';
import { buildSourceEvidenceArtifact } from './categorized-inputxml-api-source-export.js';

function inspectRequest(request = {}) {
  const normalized = normalizeServiceRequest(request);
  const document = parseCategorizedInputXmlModel(normalized.source.content);
  const allDiagnostics = buildCategorizedInputXmlDiagnostics(document, normalized.options);
  const diagnostics = filteredDiagnostics(allDiagnostics, normalized.options.diagnosticsLevel);
  return Object.freeze({ normalized, document, allDiagnostics, diagnostics });
}

function inspectionPayload(bundle = {}) {
  const { normalized, document, allDiagnostics, diagnostics } = bundle;
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_INSPECTION_SCHEMA,
    requestId: normalized.requestId,
    success: successful(allDiagnostics),
    source: sourceDescriptor(normalized),
    summary: summarizeCategorizedInputXml(document, allDiagnostics),
    diagnosticCounts: diagnosticCounts(allDiagnostics),
    diagnostics,
    sourceExportReady: sourceExportReady(document),
    document,
  });
}

export function inspectCategorizedInputXml(request = {}) {
  return inspectionPayload(inspectRequest(request));
}

export function validateCategorizedInputXml(request = {}) {
  const result = inspectCategorizedInputXml(request);
  const { document: _document, ...validation } = result;
  return Object.freeze(validation);
}

export function serializeCategorizedInputXml(request = {}) {
  const bundle = inspectRequest(request);
  const valid = successful(bundle.allDiagnostics);
  const text = valid ? `<?xml version="1.0" encoding="UTF-8"?>\n${bundle.document.serialized}\n` : '';
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_SERIALIZATION_SCHEMA,
    requestId: bundle.normalized.requestId,
    success: valid,
    source: sourceDescriptor(bundle.normalized),
    summary: summarizeCategorizedInputXml(bundle.document, bundle.allDiagnostics),
    diagnosticCounts: diagnosticCounts(bundle.allDiagnostics),
    diagnostics: bundle.diagnostics,
    text,
  });
}

function exportReadinessDiagnostic() {
  return createDiagnostic({
    severity: 'error',
    code: 'SOURCE_EXPORT_NOT_READY',
    message: 'Source export requires exactly one usable OriginalElement for every element.',
    action: 'reject-export',
  });
}

function exportCountDiagnostic(expected = 0, actual = 0) {
  return createDiagnostic({
    severity: 'error',
    code: 'SOURCE_EXPORT_ELEMENT_COUNT_MISMATCH',
    message: 'Source-evidence InputXML element count does not match the categorized document.',
    sourceValue: expected,
    normalizedValue: actual,
    action: 'reject-export',
  });
}

export function exportCategorizedSourceInputXml(request = {}) {
  const bundle = inspectRequest(request);
  const summary = summarizeCategorizedInputXml(bundle.document, bundle.allDiagnostics);
  if (!sourceExportReady(bundle.document)) return sourceExportFailure(bundle, summary, exportReadinessDiagnostic());
  const artifact = buildSourceEvidenceArtifact({
    content: bundle.normalized.source.content,
    filename: bundle.normalized.source.filename,
  });
  if (artifact.pipingElementCount !== summary.elements) {
    return sourceExportFailure(bundle, summary, exportCountDiagnostic(summary.elements, artifact.pipingElementCount));
  }
  return sourceExportSuccess(bundle, summary, artifact);
}

function sourceExportFailure(bundle, summary, diagnostic) {
  const all = Object.freeze([...bundle.allDiagnostics, diagnostic]);
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA,
    requestId: bundle.normalized.requestId,
    success: false,
    source: sourceDescriptor(bundle.normalized),
    summary,
    diagnosticCounts: diagnosticCounts(all),
    diagnostics: filteredDiagnostics(all, bundle.normalized.options.diagnosticsLevel),
    artifact: null,
  });
}

function sourceExportSuccess(bundle, summary, artifact) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_SOURCE_EXPORT_SCHEMA,
    requestId: bundle.normalized.requestId,
    success: true,
    source: sourceDescriptor(bundle.normalized),
    summary,
    diagnosticCounts: diagnosticCounts(bundle.allDiagnostics),
    diagnostics: bundle.diagnostics,
    artifact,
  });
}

export function getCategorizedInputXmlCapabilities() {
  return createCapabilities();
}

export function createCategorizedInputXmlService() {
  return Object.freeze({
    getCapabilities: getCategorizedInputXmlCapabilities,
    validate: validateCategorizedInputXml,
    inspect: inspectCategorizedInputXml,
    serialize: serializeCategorizedInputXml,
    exportSourceInputXml: exportCategorizedSourceInputXml,
  });
}

export const _test = Object.freeze({
  inspectRequest,
  inspectionPayload,
  exportReadinessDiagnostic,
  exportCountDiagnostic,
  sourceExportFailure,
  sourceExportSuccess,
});
