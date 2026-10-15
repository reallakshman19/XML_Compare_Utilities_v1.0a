export const XML_COMPARE_SIDELOAD_DIAGNOSTICS_SCHEMA = 'xml-compare-sideload-diagnostics/v1';

const clean = (value) => String(value ?? '').trim();
const SEVERITIES = new Set(['INFO', 'WARNING', 'ERROR']);

export function normalizeSideloadSeverity(value) {
  const normalized = clean(value).toUpperCase();
  return SEVERITIES.has(normalized) ? normalized : 'INFO';
}

export function createSideloadDiagnostic(input = {}) {
  return Object.freeze({
    severity: normalizeSideloadSeverity(input.severity),
    code: clean(input.code) || 'SIDELOAD_UNSPECIFIED',
    message: clean(input.message) || 'Sideload diagnostic.',
    module: clean(input.module) || 'XmlCompareSideloadEnricher',
    stage: clean(input.stage),
    sourceField: clean(input.sourceField),
    outputField: clean(input.outputField),
    sourceRow: Number.isFinite(Number(input.sourceRow)) ? Number(input.sourceRow) : null,
    element: clean(input.element),
    action: clean(input.action),
    context: Object.freeze({ ...(input.context || {}) }),
  });
}

export function normalizeSideloadDiagnostic(input = {}) {
  if (input?.module === 'XmlCompareSideloadEnricher') return createSideloadDiagnostic(input);
  return createSideloadDiagnostic({
    severity: input.severity,
    code: clean(input.code).toUpperCase() || 'SIDELOAD_EXTERNAL_DIAGNOSTIC',
    message: input.message,
    stage: input.stage || 'coordinate-solve',
    sourceRow: input.sourceRow ?? input.details?.sourceRow,
    action: input.action || 'observed',
    context: input.context || input.details || {},
  });
}

export function summarizeSideloadDiagnostics(records = []) {
  const summary = { total: 0, info: 0, warning: 0, error: 0 };
  for (const record of records) {
    const severity = normalizeSideloadSeverity(record?.severity).toLowerCase();
    summary.total += 1;
    summary[severity] += 1;
  }
  return Object.freeze(summary);
}

export function createXmlCompareSideloadDiagnostics(report = {}, metadata = {}) {
  const records = Object.freeze(
    (Array.isArray(report?.diagnostics) ? report.diagnostics : [])
      .map(normalizeSideloadDiagnostic),
  );
  return Object.freeze({
    schema: XML_COMPARE_SIDELOAD_DIAGNOSTICS_SCHEMA,
    module: 'XmlCompareSideloadEnricher',
    sourceName: clean(metadata.sourceName),
    sourceSide: clean(metadata.sourceSide),
    summary: summarizeSideloadDiagnostics(records),
    records,
  });
}

export function serializeXmlCompareSideloadDiagnostics(reportOrDocument = {}) {
  const document = reportOrDocument?.schema === XML_COMPARE_SIDELOAD_DIAGNOSTICS_SCHEMA
    ? reportOrDocument
    : createXmlCompareSideloadDiagnostics(reportOrDocument);
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function xmlCompareSideloadDiagnosticsFileName() {
  return 'xml_compare_sideload_diagnostics.json';
}

export const _test = Object.freeze({ clean, SEVERITIES });
