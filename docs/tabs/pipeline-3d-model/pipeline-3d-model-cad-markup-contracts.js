export const PIPELINE_CAD_MARKUP_DOCUMENT_SCHEMA = 'PipelineCadMarkupDocument.v1';
export const PIPELINE_CAD_DIMENSION_SCHEMA = 'PipelineCadDimension.v1';
export const PIPELINE_CAD_ANNOTATION_SCHEMA = 'PipelineCadAnnotation.v1';
export const PIPELINE_CAD_MARKUP_ANCHOR_SCHEMA = 'PipelineCadMarkupAnchor.v1';
export const PIPELINE_CAD_MARKUP_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', ORPHANED: 'ORPHANED' });
export const PIPELINE_CAD_DIMENSION_TYPES = Object.freeze(['LINEAR_HORIZONTAL', 'LINEAR_VERTICAL', 'LINEAR_ALIGNED']);
export const PIPELINE_CAD_MEASUREMENT_AUTHORITIES = Object.freeze(['ENGINEERING_PROFILE', 'REVIEW_EVIDENCE', 'PRESENTATION_ONLY']);
export const PIPELINE_CAD_ANNOTATION_MAX_LENGTH = 240;

const GRAPHS = Object.freeze(['table2x', 'table3x']);
const ENTITY_TYPES = Object.freeze({ table2x: ['elevation-node'], table3x: ['depth-node', 'marker'] });
const ALIGNMENTS = Object.freeze(['LEFT', 'CENTER', 'RIGHT']);
const LABEL_MODES = Object.freeze(['MEASURED', 'CUSTOM']);

function fail(message) { throw new TypeError(message); }
function text(value, name) {
  const result = String(value ?? '').trim();
  if (!result) fail(`${name} is required.`);
  return result;
}
function integer(value, name, minimum = 0) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum) fail(`${name} must be an integer >= ${minimum}.`);
  return result;
}
function finite(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result)) fail(`${name} must be finite.`);
  return result;
}
function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) fail(`${name} is invalid.`);
  return value;
}
function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  });
}
function safeText(value, name, maximum, optional = false) {
  const result = String(value ?? '').trim();
  if (!result && optional) return '';
  if (!result) fail(`${name} is required.`);
  if (result.length > maximum) fail(`${name} exceeds ${maximum} characters.`);
  if (hasControlCharacters(result)) fail(`${name} contains control characters.`);
  if (/[<>]/.test(result) || /(?:javascript:|data:text\/html|on\w+\s*=)/i.test(result)) fail(`${name} contains scriptable content.`);
  return result;
}
function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(`${name} must be a plain object.`);
  return value;
}
function assertJsonSafe(value, path = 'value') {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(`${path} must be finite.`); return; }
  if (Array.isArray(value)) { value.forEach((entry, index) => assertJsonSafe(entry, `${path}[${index}]`)); return; }
  plainObject(value, path);
  for (const [key, entry] of Object.entries(value)) assertJsonSafe(entry, `${path}.${key}`);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze); return Object.freeze(value);
}
function graph(value) { return oneOf(value, GRAPHS, 'graph'); }

export function createPipelineCadMarkupAnchor(input) {
  plainObject(input, 'anchor');
  const anchorGraph = graph(input.graph);
  if (input.kind === 'GRAPH_POINT') return deepFreeze({
    schema: PIPELINE_CAD_MARKUP_ANCHOR_SCHEMA, kind: 'GRAPH_POINT', graph: anchorGraph,
    x: finite(input.x, 'anchor.x'), y: finite(input.y, 'anchor.y'),
  });
  if (input.kind !== 'ENTITY') fail('anchor.kind is invalid.');
  const entityType = oneOf(input.entityType, ENTITY_TYPES[anchorGraph], 'anchor.entityType');
  return deepFreeze({
    schema: PIPELINE_CAD_MARKUP_ANCHOR_SCHEMA, kind: 'ENTITY', graph: anchorGraph,
    entityId: text(input.entityId, 'anchor.entityId'), entityType,
    pointRole: text(input.pointRole || 'CENTER', 'anchor.pointRole'),
  });
}

export function classifyPipelineCadMeasurementAuthority(graphName, firstAnchor, secondAnchor) {
  if (firstAnchor.kind === 'GRAPH_POINT' || secondAnchor.kind === 'GRAPH_POINT') return 'PRESENTATION_ONLY';
  return graphName === 'table2x' ? 'ENGINEERING_PROFILE' : 'REVIEW_EVIDENCE';
}

function sequenceId(prefix, sequence) { return `${prefix}-${String(sequence).padStart(6, '0')}`; }
function normalizeDimension(input) {
  if ('measuredValue' in input || 'value' in input || 'displayCache' in input) fail('Persisted measured values are not authorized.');
  const dimensionGraph = graph(input.graph);
  const firstAnchor = createPipelineCadMarkupAnchor(input.firstAnchor);
  const secondAnchor = createPipelineCadMarkupAnchor(input.secondAnchor);
  if (firstAnchor.graph !== dimensionGraph || secondAnchor.graph !== dimensionGraph) fail('Dimension anchors must match graph.');
  const measurementAuthority = classifyPipelineCadMeasurementAuthority(dimensionGraph, firstAnchor, secondAnchor);
  if (input.measurementAuthority && input.measurementAuthority !== measurementAuthority) fail('measurementAuthority conflicts with anchor authority.');
  const labelMode = oneOf(input.labelMode || 'MEASURED', LABEL_MODES, 'labelMode');
  const customLabel = safeText(input.customLabel, 'customLabel', 120, labelMode !== 'CUSTOM');
  if (labelMode === 'CUSTOM' && !customLabel) fail('customLabel is required for CUSTOM label mode.');
  return {
    schema: PIPELINE_CAD_DIMENSION_SCHEMA, dimensionId: text(input.dimensionId, 'dimensionId'), graph: dimensionGraph,
    dimensionType: oneOf(input.dimensionType, PIPELINE_CAD_DIMENSION_TYPES, 'dimensionType'), firstAnchor, secondAnchor,
    offset: finite(input.offset ?? 0, 'offset'), labelMode, customLabel, measurementAuthority,
    status: oneOf(input.status || 'ACTIVE', Object.values(PIPELINE_CAD_MARKUP_STATUS), 'status'),
    createdSequence: integer(input.createdSequence, 'createdSequence', 1), revision: integer(input.revision ?? 1, 'revision', 1),
  };
}
export function createPipelineCadDimension(input) { return deepFreeze(normalizeDimension(plainObject(input, 'dimension'))); }

function normalizeLeader(input = {}) {
  plainObject(input, 'leader');
  return deepFreeze({ enabled: input.enabled === true, dx: finite(input.dx ?? 0, 'leader.dx'), dy: finite(input.dy ?? 0, 'leader.dy') });
}
function normalizeAnnotation(input) {
  const annotationGraph = graph(input.graph); const anchor = createPipelineCadMarkupAnchor(input.anchor);
  if (anchor.graph !== annotationGraph) fail('Annotation anchor must match graph.');
  return {
    schema: PIPELINE_CAD_ANNOTATION_SCHEMA, annotationId: text(input.annotationId, 'annotationId'), graph: annotationGraph, anchor,
    text: safeText(input.text, 'annotation.text', PIPELINE_CAD_ANNOTATION_MAX_LENGTH),
    alignment: oneOf(input.alignment || 'LEFT', ALIGNMENTS, 'alignment'), leader: normalizeLeader(input.leader || {}),
    status: oneOf(input.status || 'ACTIVE', Object.values(PIPELINE_CAD_MARKUP_STATUS), 'status'),
    createdSequence: integer(input.createdSequence, 'createdSequence', 1), revision: integer(input.revision ?? 1, 'revision', 1),
  };
}
export function createPipelineCadAnnotation(input) { return deepFreeze(normalizeAnnotation(plainObject(input, 'annotation'))); }

function validateIdentity(records, nextSequence) {
  const ids = new Set(); const sequences = new Set(); let maximum = 0;
  for (const record of records) {
    const dimension = record.schema === PIPELINE_CAD_DIMENSION_SCHEMA;
    const prefix = dimension ? 'pcad-dim' : 'pcad-note'; const id = dimension ? record.dimensionId : record.annotationId;
    if (id !== sequenceId(prefix, record.createdSequence)) fail('Record ID does not own createdSequence.');
    if (ids.has(id)) fail(`Duplicate markup ID: ${id}`); ids.add(id);
    if (sequences.has(record.createdSequence)) fail(`Duplicate createdSequence: ${record.createdSequence}`); sequences.add(record.createdSequence);
    maximum = Math.max(maximum, record.createdSequence);
  }
  if (nextSequence <= maximum) fail('nextSequence must exceed every createdSequence.');
}
function canonicalDocument(input) {
  plainObject(input, 'document'); assertJsonSafe(input, 'document');
  if (input.schema !== PIPELINE_CAD_MARKUP_DOCUMENT_SCHEMA) fail('document.schema is invalid.');
  const dimensions = (input.dimensions || []).map(createPipelineCadDimension).sort((a, b) => a.dimensionId.localeCompare(b.dimensionId));
  const annotations = (input.annotations || []).map(createPipelineCadAnnotation).sort((a, b) => a.annotationId.localeCompare(b.annotationId));
  const nextSequence = integer(input.nextSequence, 'nextSequence', 1); validateIdentity([...dimensions, ...annotations], nextSequence);
  return {
    schema: PIPELINE_CAD_MARKUP_DOCUMENT_SCHEMA, documentId: text(input.documentId, 'documentId'),
    sourceFingerprint: text(input.sourceFingerprint, 'sourceFingerprint'), revision: integer(input.revision ?? 0, 'revision', 0),
    nextSequence, dimensions, annotations,
  };
}
export function validatePipelineCadMarkupDocument(input) { return deepFreeze(canonicalDocument(input)); }
export function createPipelineCadMarkupDocument(input = {}) {
  const fingerprint = text(input.sourceFingerprint, 'sourceFingerprint');
  return validatePipelineCadMarkupDocument({
    schema: PIPELINE_CAD_MARKUP_DOCUMENT_SCHEMA, documentId: input.documentId || `pcad-markup-${fingerprint}`,
    sourceFingerprint: fingerprint, revision: input.revision ?? 0, nextSequence: input.nextSequence ?? 1,
    dimensions: input.dimensions || [], annotations: input.annotations || [],
  });
}
export function serializePipelineCadMarkupDocument(input) { return `${JSON.stringify(validatePipelineCadMarkupDocument(input), null, 2)}\n`; }
export function parsePipelineCadMarkupDocument(textValue) {
  let parsed; try { parsed = JSON.parse(String(textValue)); } catch (error) { throw new SyntaxError(`Invalid Pipeline CAD markup JSON: ${error.message}`); }
  return validatePipelineCadMarkupDocument(parsed);
}
export const _markupContractTest = Object.freeze({ deepFreeze, sequenceId, assertJsonSafe, hasControlCharacters });
