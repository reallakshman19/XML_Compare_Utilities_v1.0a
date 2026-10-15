import { CATEGORIZED_INPUTXML_DIAGNOSTIC_SCHEMA } from './categorized-inputxml-api-contracts.js';

const clean = (value) => String(value ?? '').trim();
const GLOBAL_FIELDS = Object.freeze([
  'FROM_GLOBAL_X', 'FROM_GLOBAL_Y', 'FROM_GLOBAL_Z',
  'TO_GLOBAL_X', 'TO_GLOBAL_Y', 'TO_GLOBAL_Z',
]);

export function createDiagnostic({
  severity = 'information',
  code = 'UNSPECIFIED',
  message = '',
  location = {},
  sourceValue = null,
  normalizedValue = null,
  action = 'review',
} = {}) {
  return Object.freeze({
    schema: CATEGORIZED_INPUTXML_DIAGNOSTIC_SCHEMA,
    severity,
    code,
    message,
    location: Object.freeze({ ...location }),
    sourceValue,
    normalizedValue,
    action,
  });
}

function add(rows, input) {
  rows.push(createDiagnostic(input));
}

function location(line = {}, element = {}, node = null) {
  const base = { lineId: line.lineId || '', elementKey: element.elementKey || '' };
  if (!node) return base;
  return { ...base, nodeNumber: node.nodeNumber || '', role: node.role || '' };
}

function sameValue(left, right) {
  const a = clean(left), b = clean(right);
  if (a === b) return true;
  const an = Number(a), bn = Number(b);
  return Number.isFinite(an) && Number.isFinite(bn) && Math.abs(an - bn) < 1e-9;
}

function rootDiagnostics(model = {}, options = {}, rows = []) {
  if (model.rootName !== 'CategorizedInputXML') add(rows, {
    severity: 'error', code: 'ROOT_INVALID',
    message: 'Root element must be CategorizedInputXML.',
    normalizedValue: model.rootName, action: 'reject',
  });
  const missing = !model.documentSchema;
  const wrong = model.documentSchema && model.documentSchema !== 'categorized-inputxml/v3';
  if (missing || wrong) add(rows, {
    severity: options.schemaPolicy === 'require-v3' ? 'error' : 'warning',
    code: missing ? 'SCHEMA_MISSING' : 'SCHEMA_COMPATIBLE_NON_V3',
    message: missing ? 'CategorizedInputXML schema attribute is missing.' : 'Document does not declare categorized-inputxml/v3.',
    normalizedValue: model.documentSchema || null,
    action: options.schemaPolicy === 'require-v3' ? 'reject' : 'review',
  });
}

function duplicateDiagnostics(values = [], code = '', label = '', rows = []) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  for (const [value, count] of counts) if (count > 1) add(rows, {
    severity: 'error', code,
    message: `${label} must be unique within its scope.`,
    normalizedValue: value, action: 'reject',
  });
}

function evidenceDiagnostics(line, element, rows) {
  const at = location(line, element);
  if (element.original.count === 0) add(rows, {
    severity: 'warning', code: 'ORIGINAL_ELEMENT_MISSING',
    message: 'Element has no OriginalElement source evidence.',
    location: at, action: 'block-source-export',
  });
  if (element.original.count > 1) add(rows, {
    severity: 'error', code: 'ORIGINAL_ELEMENT_DUPLICATE',
    message: 'Element has more than one OriginalElement block.',
    location: at, normalizedValue: element.original.count, action: 'reject',
  });
  if (element.original.count === 1 && !element.original.usable) add(rows, {
    severity: 'error', code: 'ORIGINAL_ELEMENT_INVALID',
    message: 'OriginalElement does not contain a PIPINGELEMENT.',
    location: at, action: 'reject',
  });
}

function identityDiagnostics(line, element, rows) {
  const at = location(line, element), attrs = element.original.attrs || {};
  const checks = [
    ['LINE_ID', line.lineId, attrs.LINE_ID],
    ['FROM_NODE', element.fromNode, attrs.FROM_NODE],
    ['TO_NODE', element.toNode, attrs.TO_NODE],
  ];
  for (const [field, normalized, source] of checks) {
    if (!clean(normalized)) add(rows, {
      severity: 'error', code: `${field}_MISSING`,
      message: `${field} identity is missing from the categorized hierarchy.`,
      location: at, action: 'reject',
    });
    if (clean(source) && clean(normalized) && !sameValue(source, normalized)) add(rows, {
      severity: 'warning', code: 'IDENTITY_DIVERGENCE',
      message: `${field} differs between categorized hierarchy and OriginalElement.`,
      location: at, sourceValue: source, normalizedValue: normalized, action: 'reconcile',
    });
  }
}

function fieldDiagnostics(line, element, rows) {
  const at = location(line, element), source = element.original.attrs || {};
  for (const [field, normalized] of Object.entries(element.normalizedFields || {})) {
    const original = source[field];
    if (clean(original) && !sameValue(original, normalized)) add(rows, {
      severity: 'warning', code: 'NORMALIZED_SOURCE_DIVERGENCE',
      message: `${field} differs between normalized block and OriginalElement.`,
      location: { ...at, field }, sourceValue: original, normalizedValue: normalized, action: 'reconcile',
    });
    if (!clean(original)) add(rows, {
      severity: 'information', code: 'NORMALIZED_FIELD_NOT_IN_SOURCE',
      message: `${field} exists only in the normalized categorized representation.`,
      location: { ...at, field }, normalizedValue: normalized, action: 'review-provenance',
    });
  }
}

function coordinateDiagnostics(line, element, rows) {
  if (!element.derivedCoordinates) return;
  const source = element.original.attrs || {};
  if (GLOBAL_FIELDS.some((field) => clean(source[field]))) return;
  add(rows, {
    severity: 'information', code: 'DERIVED_COORDINATE_NOT_IN_SOURCE',
    message: 'Categorized nodes contain derived coordinates not present in OriginalElement.',
    location: location(line, element), action: 'treat-as-derived',
  });
}

function extensionDiagnostics(line, element, rows) {
  const addNames = (names, scope, node = null) => {
    for (const name of names) add(rows, {
      severity: 'information', code: 'EXTENSION_BLOCK',
      message: `${name} is an extension block outside the generated v3 taxonomy.`,
      location: { ...location(line, element, node), scope, blockName: name },
      normalizedValue: name, action: 'preserve-and-review',
    });
  };
  addNames(element.extensionBlocks || [], 'element');
  for (const node of element.nodes || []) addNames(node.extensionBlocks || [], 'node', node);
}

function nodeDiagnostics(line, element, rows) {
  duplicateDiagnostics((element.nodes || []).map((node) => `${node.nodeNumber}|${node.role}`), 'NODE_ID_DUPLICATE', 'Node identity', rows);
  for (const node of element.nodes || []) if (!node.nodeNumber) add(rows, {
    severity: 'warning', code: 'NODE_NUMBER_MISSING',
    message: 'Categorized Node has no node number.',
    location: location(line, element, node), action: 'review',
  });
}

function lineDiagnostics(line, rows) {
  if (!line.lineId) add(rows, {
    severity: 'error', code: 'LINE_ID_MISSING',
    message: 'Line has no stable identity.', action: 'reject',
  });
  for (const name of [...(line.extensionBlocks || []), ...(line.lineBlockExtensions || [])]) add(rows, {
    severity: 'information', code: 'EXTENSION_BLOCK',
    message: `${name} is an extension block outside the generated v3 taxonomy.`,
    location: { lineId: line.lineId || '', scope: 'line', blockName: name },
    normalizedValue: name, action: 'preserve-and-review',
  });
  duplicateDiagnostics((line.elements || []).map((element) => element.elementKey), 'ELEMENT_KEY_DUPLICATE', 'Element key', rows);
  for (const element of line.elements || []) elementDiagnostics(line, element, rows);
}

function elementDiagnostics(line, element, rows) {
  evidenceDiagnostics(line, element, rows);
  identityDiagnostics(line, element, rows);
  fieldDiagnostics(line, element, rows);
  coordinateDiagnostics(line, element, rows);
  extensionDiagnostics(line, element, rows);
  nodeDiagnostics(line, element, rows);
}

export function buildCategorizedInputXmlDiagnostics(model = {}, options = {}) {
  const rows = [];
  rootDiagnostics(model, options, rows);
  duplicateDiagnostics((model.lines || []).map((line) => line.lineId), 'LINE_ID_DUPLICATE', 'Line identity', rows);
  for (const line of model.lines || []) lineDiagnostics(line, rows);
  if (!(model.lines || []).length) add(rows, {
    severity: 'warning', code: 'NO_LINES',
    message: 'CategorizedInputXML contains no Line records.', action: 'review',
  });
  return Object.freeze(rows);
}

export function summarizeCategorizedInputXml(model = {}, diagnostics = []) {
  const elements = (model.lines || []).flatMap((line) => line.elements || []);
  const nodes = elements.flatMap((element) => element.nodes || []);
  return Object.freeze({
    lines: (model.lines || []).length,
    elements: elements.length,
    nodes: nodes.length,
    sourceEvidenceElements: elements.filter((element) => element.original?.usable).length,
    extensionBlocks: diagnostics.filter((item) => item.code === 'EXTENSION_BLOCK').length,
    divergences: diagnostics.filter((item) => item.code.includes('DIVERGENCE')).length,
    derivedCoordinates: elements.filter((element) => element.derivedCoordinates).length,
  });
}

export function sourceExportReady(model = {}) {
  const elements = (model.lines || []).flatMap((line) => line.elements || []);
  return model.rootName === 'CategorizedInputXML'
    && elements.length > 0
    && elements.every((element) => element.original?.usable && element.original.count === 1);
}

export const _test = Object.freeze({ sameValue, location, duplicateDiagnostics });
