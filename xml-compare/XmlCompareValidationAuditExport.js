export const XML_COMPARE_VALIDATION_AUDIT_SCHEMA = 'xml-compare-validation-audit/v1';

const CSV_HEADERS = Object.freeze([
  'Source Item',
  'Nearest Target Item',
  'Source X',
  'Source Y',
  'Source Z',
  'Expected Target X',
  'Expected Target Y',
  'Expected Target Z',
  'Actual Target X',
  'Actual Target Y',
  'Actual Target Z',
  'Delta X',
  'Delta Y',
  'Delta Z',
  'SRSS',
  'Status',
]);

function clean(value) {
  return String(value ?? '');
}

function coord(value = null, axis = '') {
  return value && value[axis] != null ? value[axis] : '';
}

function rowForAudit(row = {}) {
  return Object.freeze({
    sourceUid: clean(row.sourceUid),
    sourceLabel: clean(row.sourceLabel),
    targetUid: clean(row.targetUid),
    targetLabel: clean(row.targetLabel),
    sourceCoordinate: row.sourceCoordinate || null,
    expectedTargetCoordinate: row.expectedTargetCoordinate || null,
    actualTargetCoordinate: row.actualTargetCoordinate || null,
    deltaX: row.deltaX ?? '',
    deltaY: row.deltaY ?? '',
    deltaZ: row.deltaZ ?? '',
    srss: row.srss ?? '',
    status: clean(row.status),
  });
}

export function createValidationAudit({
  sourceName = '',
  targetName = '',
  validationModel = null,
  compareFields = [],
  validationLayer = '',
  toleranceMm = 1,
} = {}) {
  const model = validationModel || {};
  return Object.freeze({
    schema: XML_COMPARE_VALIDATION_AUDIT_SCHEMA,
    sourceName: clean(sourceName),
    targetName: clean(targetName),
    generatedAt: new Date().toISOString(),
    validationLayer: clean(validationLayer || model.validationLayer),
    compareFields: Object.freeze([...(compareFields || model.compareFields || [])]),
    toleranceMm: Number(toleranceMm ?? model.toleranceMm ?? 1),
    mode: clean(model.mode),
    anchor: Object.freeze({ ...(model.anchor || {}) }),
    summary: Object.freeze({ ...(model.summary || {}) }),
    rows: Object.freeze((model.rows || []).map(rowForAudit)),
    diagnostics: Object.freeze([...(model.diagnostics || [])]),
  });
}

export function validationAuditToCsv(audit = {}) {
  const rows = [CSV_HEADERS];
  for (const row of audit.rows || []) {
    rows.push([
      row.sourceLabel,
      row.targetLabel,
      coord(row.sourceCoordinate, 'x'),
      coord(row.sourceCoordinate, 'y'),
      coord(row.sourceCoordinate, 'z'),
      coord(row.expectedTargetCoordinate, 'x'),
      coord(row.expectedTargetCoordinate, 'y'),
      coord(row.expectedTargetCoordinate, 'z'),
      coord(row.actualTargetCoordinate, 'x'),
      coord(row.actualTargetCoordinate, 'y'),
      coord(row.actualTargetCoordinate, 'z'),
      row.deltaX,
      row.deltaY,
      row.deltaZ,
      row.srss,
      row.status,
    ]);
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function downloadValidationAuditJson(audit) {
  downloadText('xml-compare-validation-audit.json', `${JSON.stringify(audit, null, 2)}\n`, 'application/json;charset=utf-8');
}

export function downloadValidationAuditCsv(audit) {
  downloadText('xml-compare-validation-audit.csv', validationAuditToCsv(audit), 'text/csv;charset=utf-8');
}

function csvCell(value) {
  const text = clean(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
