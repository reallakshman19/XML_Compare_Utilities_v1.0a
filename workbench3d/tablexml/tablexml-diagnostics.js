export const TABLEXML_DIAGNOSTICS_SCHEMA = 'workbench3d-tablexml-diagnostics/v1';

const VALID_SEVERITIES = new Set(['ERROR', 'WARNING', 'INFO', 'OK']);

function text(value) {
  return String(value ?? '').trim();
}

export function createTableXmlDiagnostics({ sourceName = '', buildName = '', side = '' } = {}) {
  return {
    schema: TABLEXML_DIAGNOSTICS_SCHEMA,
    generatedAt: new Date().toISOString(),
    module: 'workbench3d-table-to-nodeset',
    sourceName: text(sourceName),
    buildName: text(buildName),
    side: text(side),
    purpose: 'comparison-only',
    outputReady: false,
    outputName: '',
    summary: { total: 0, error: 0, warning: 0, info: 0, ok: 0 },
    metadata: {},
    records: [],
  };
}

export function addTableXmlDiagnostic(document, {
  severity = 'INFO', code = 'TABLEXML_DIAGNOSTIC', message = '', stage = '', action = '',
  sourceRowId = '', sourceColumnId = '', outputField = '', nodeId = '', count = null,
  context = null,
} = {}) {
  if (!document || !Array.isArray(document.records)) return null;
  const normalizedSeverity = VALID_SEVERITIES.has(text(severity).toUpperCase())
    ? text(severity).toUpperCase()
    : 'INFO';
  const record = {
    severity: normalizedSeverity,
    code: text(code) || 'TABLEXML_DIAGNOSTIC',
    message: text(message),
    module: 'workbench3d-table-to-nodeset',
    stage: text(stage),
    action: text(action),
    sourceName: text(document.sourceName),
    sourceRowId: text(sourceRowId),
    sourceColumnId: text(sourceColumnId),
    outputField: text(outputField),
    nodeId: text(nodeId),
    count: Number.isInteger(count) ? count : null,
    context: context && typeof context === 'object' && !Array.isArray(context) ? { ...context } : null,
  };
  document.records.push(record);
  return record;
}

export function finalizeTableXmlDiagnostics(document, {
  outputReady = false,
  outputName = '',
  sourceRowCount = 0,
  workingRowCount = 0,
  emittedNodeCount = 0,
  coordinateMode = 'source',
  ignoredColumnCount = 0,
} = {}) {
  if (!document || !Array.isArray(document.records)) return document;
  const counts = { error: 0, warning: 0, info: 0, ok: 0 };
  for (const record of document.records) {
    const key = String(record.severity ?? '').toLowerCase();
    if (Object.hasOwn(counts, key)) counts[key] += 1;
  }
  document.outputReady = Boolean(outputReady);
  document.outputName = text(outputName);
  document.summary = { total: document.records.length, ...counts };
  document.metadata = {
    ...document.metadata,
    sourceRowCount: Number(sourceRowCount) || 0,
    workingRowCount: Number(workingRowCount) || 0,
    emittedNodeCount: Number(emittedNodeCount) || 0,
    coordinateMode: text(coordinateMode) || 'source',
    ignoredColumnCount: Number(ignoredColumnCount) || 0,
  };
  return document;
}

export function serializeTableXmlDiagnostics(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function tableXmlDiagnosticsFilename(side = 'table') {
  const prefix = text(side).replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'table';
  return `${prefix}_workbench3d_table_to_xml_diagnostics.json`;
}
