export const INPUTXML_WORKSPACE_DIAGNOSTICS_SCHEMA = 'inputxml-workspace-diagnostics/v1';

const clean = (value) => String(value ?? '').trim();
const freezeObject = (value = {}) => Object.freeze({ ...value });

function normalizeSeverity(value) {
  const severity = clean(value).toUpperCase();
  return ['ERROR', 'WARNING', 'INFO', 'OK'].includes(severity) ? severity : 'INFO';
}

export function createInputXmlWorkspaceDiagnostic(input = {}) {
  return Object.freeze({
    severity: normalizeSeverity(input.severity),
    code: clean(input.code || 'WORKSPACE_EVENT'),
    message: clean(input.message || input.code || 'Workspace event.'),
    module: 'inputxml-workspace',
    stage: clean(input.stage || 'orchestration'),
    action: clean(input.action),
    sourceField: clean(input.sourceField),
    outputField: clean(input.outputField),
    sourceKind: clean(input.sourceKind),
    outputKind: clean(input.outputKind),
    count: Number(input.count || 0),
    context: freezeObject(input.context),
  });
}

function normalizeRecord(record) {
  return record?.module === 'inputxml-workspace'
    ? Object.freeze({ ...record, context: freezeObject(record.context) })
    : createInputXmlWorkspaceDiagnostic(record);
}

export function summarizeInputXmlWorkspaceDiagnostics(records = []) {
  const summary = { total: records.length, error: 0, warning: 0, info: 0, ok: 0 };
  for (const record of records) {
    const key = normalizeSeverity(record.severity).toLowerCase();
    summary[key] += 1;
  }
  return Object.freeze(summary);
}

export function createInputXmlWorkspaceDiagnostics(input = {}) {
  const records = Object.freeze((input.records || []).map(normalizeRecord));
  return Object.freeze({
    schema: INPUTXML_WORKSPACE_DIAGNOSTICS_SCHEMA,
    generatedAt: clean(input.generatedAt),
    records,
    summary: summarizeInputXmlWorkspaceDiagnostics(records),
  });
}

export function appendInputXmlWorkspaceDiagnostics(document = {}, additions = []) {
  const current = Array.isArray(document.records) ? document.records : [];
  const next = [...current, ...additions].slice(-500);
  return createInputXmlWorkspaceDiagnostics({ records: next });
}

export function serializeInputXmlWorkspaceDiagnostics(document = {}) {
  const normalized = createInputXmlWorkspaceDiagnostics(document);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export const _test = Object.freeze({ clean, normalizeSeverity, normalizeRecord });
