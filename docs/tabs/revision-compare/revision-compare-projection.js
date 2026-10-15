/** Worker-safe projection from approved staged scope to minimal compare records. */
import { assertJsonSafe, cleanText, deepFreeze, frozenStrings } from './revision-contract-utils.js';

export const REVISION_COMPARE_RECORD_SCHEMA = 'RevisionCompareRecord.v1';
export const REVISION_COMPARE_PROJECTION_SCHEMA = 'RevisionCompareProjection.v1';

const IDENTITY_PATHS = Object.freeze([
  ['id', 'record.id'], ['objectId', 'record.objectId'],
  ['attributes.REFNO', 'attributes.REFNO'], ['attributes.COMPONENTREFNO', 'attributes.COMPONENTREFNO'],
  ['attributes.ID', 'attributes.ID'], ['attributes.GUID', 'attributes.GUID'],
  ['tag', 'record.tag'], ['name', 'record.name'], ['attributes.TAG', 'attributes.TAG'], ['attributes.NAME', 'attributes.NAME'],
]);

const PROPERTY_PATHS = Object.freeze({
  nominalSize: ['nominalSize', 'nominalDiameter', 'outsideDiameter', 'diameter', 'size', 'attributes.NOMINALSIZE', 'attributes.NOMINALDIAMETER', 'attributes.OD', 'attributes.DIAMETER', 'attributes.SIZE'],
  wallThickness: ['wallThickness', 'thickness', 'attributes.WALLTHICKNESS', 'attributes.THICKNESS'],
  rating: ['rating', 'attributes.RATING'], specification: ['specification', 'spec', 'attributes.SPECIFICATION', 'attributes.SPEC'],
  material: ['material', 'attributes.MATERIAL'], length: ['length', 'attributes.LENGTH'],
  weight: ['weight', 'attributes.WEIGHT'], supportType: ['supportType', 'attributes.SUPPORTTYPE'],
  description: ['description', 'attributes.DESCRIPTION'],
});

function objectRecord(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function scalar(value) { return ['string', 'number', 'boolean'].includes(typeof value) && cleanText(value) !== ''; }
function normalizeScalar(value) { return typeof value === 'string' ? cleanText(value) : value; }
function normalizeIdentity(value) { return cleanText(value).toUpperCase(); }
function pathValue(record, path) { return path.split('.').reduce((value, key) => objectRecord(value)[key], record); }

function rootBranches(document) {
  if (Array.isArray(document)) return { branches: document, rootPath: '$' };
  const root = objectRecord(document);
  for (const key of ['objects', 'hierarchy', 'branches']) {
    if (Array.isArray(root[key])) return { branches: root[key], rootPath: `$.${key}` };
  }
  throw new TypeError('Unsupported staged JSON root for compare projection.');
}

function branchName(branch) { return cleanText(branch?.name) || cleanText(objectRecord(branch?.attributes).NAME); }
function branchId(branch) {
  const name = branchName(branch);
  if (!name) throw new TypeError('Projected branch requires an exact name.');
  return `branch:${name}`;
}
function components(branch) {
  if (Array.isArray(branch?.children)) return { values: branch.children, key: 'children' };
  if (Array.isArray(branch?.components)) return { values: branch.components, key: 'components' };
  return { values: [], key: 'children' };
}
function componentType(record) {
  const attrs = objectRecord(record?.attributes);
  return cleanText(record?.componentType || record?.type || record?.TYPE || attrs.COMPONENTTYPE || attrs.TYPE || 'UNKNOWN').toUpperCase();
}

function identityEvidence(record, sourcePath) {
  const values = [];
  for (const [path, label] of IDENTITY_PATHS) {
    const value = pathValue(record, path);
    if (!scalar(value)) continue;
    values.push(deepFreeze({ kind: label, value: normalizeIdentity(value), sourcePath: `${sourcePath}.${path}` }));
  }
  return Object.freeze(values.sort((a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value)));
}

function engineeringProperties(record, sourcePath) {
  const output = {};
  for (const [key, paths] of Object.entries(PROPERTY_PATHS)) {
    const path = paths.find((candidate) => scalar(pathValue(record, candidate)));
    if (!path) continue;
    output[key] = deepFreeze({ value: normalizeScalar(pathValue(record, path)), sourcePath: `${sourcePath}.${path}`, normalizationRule: 'trim-preserve-scalar' });
  }
  return deepFreeze(output);
}

function axisValues(value, keys) {
  const source = objectRecord(value);
  if (!keys.every((key) => Object.hasOwn(source, key))) return null;
  const parsed = keys.map((key) => Number(source[key]));
  return parsed.every(Number.isFinite) ? Object.freeze(parsed) : null;
}
function vector(value) {
  const objectValue = axisValues(value, ['x', 'y', 'z']) ?? axisValues(value, ['X', 'Y', 'Z']);
  if (objectValue) return objectValue;
  const parts = Array.isArray(value) ? value : cleanText(value).split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const parsed = parts.slice(0, 3).map(Number);
  return parsed.every(Number.isFinite) ? Object.freeze(parsed) : null;
}
function vectorList(value) {
  if (!Array.isArray(value)) return [];
  const flat = value.length >= 3 && value.slice(0, 3).every((entry) => Number.isFinite(Number(entry)));
  if (flat) return vector(value) ? [vector(value)] : [];
  return value.map(vector).filter(Boolean);
}

function geometryCandidates(record, sourcePath) {
  const attrs = objectRecord(record?.attributes); const direct = objectRecord(record);
  const pairs = [
    [direct.start, direct.end, `${sourcePath}.start`, `${sourcePath}.end`, 'START_END'],
    [attrs.APOS, attrs.LPOS, `${sourcePath}.attributes.APOS`, `${sourcePath}.attributes.LPOS`, 'APOS_LPOS'],
  ];
  for (const [left, right, leftPath, rightPath, family] of pairs) {
    const start = vector(left); const end = vector(right);
    if (start && end) return { family, points: [start, end], evidencePaths: [leftPath, rightPath] };
  }
  const listSources = [[direct.points, `${sourcePath}.points`, 'POINTS'], [direct.coordinates, `${sourcePath}.coordinates`, 'COORDINATES']];
  for (const [value, path, family] of listSources) {
    const points = vectorList(value);
    if (points.length) return { family, points, evidencePaths: [path] };
  }
  const singleSources = [[direct.position, `${sourcePath}.position`, 'POSITION'], [attrs.POS, `${sourcePath}.attributes.POS`, 'POS']];
  for (const [value, path, family] of singleSources) {
    const point = vector(value);
    if (point) return { family, points: [point], evidencePaths: [path] };
  }
  return null;
}
function normalizedGeometry(record, sourcePath) {
  const candidate = geometryCandidates(record, sourcePath);
  if (!candidate) return deepFreeze({ availability: 'UNAVAILABLE', family: null, points: [], evidencePaths: [] });
  return deepFreeze({ availability: 'AVAILABLE', ...candidate });
}
function visualPrimitive(recordId, geometry) {
  if (geometry.availability !== 'AVAILABLE') return null;
  if (geometry.points.length >= 2) return deepFreeze({ kind: 'SEGMENT', objectId: recordId, start: geometry.points[0], end: geometry.points.at(-1) });
  return deepFreeze({ kind: 'MARKER', objectId: recordId, position: geometry.points[0] });
}

function projectedRecord(input) {
  const geometry = normalizedGeometry(input.record, input.sourcePath);
  const recordId = `record:${input.side}:${input.sourceDocumentId}:${input.sourcePath}`;
  return deepFreeze({
    schema: REVISION_COMPARE_RECORD_SCHEMA, recordId, side: input.side,
    sourceDocumentId: input.sourceDocumentId, sourcePath: input.sourcePath,
    branchId: input.branchId, sourceIndex: input.sourceIndex,
    componentType: componentType(input.record), identityEvidence: identityEvidence(input.record, input.sourcePath),
    engineeringProperties: engineeringProperties(input.record, input.sourcePath), geometry,
    visualPrimitive: visualPrimitive(recordId, geometry),
  });
}
function validateProjectionRequest(request) {
  for (const key of ['basisId', 'side', 'sourceDocumentId', 'sourceHash', 'scopedHash']) {
    if (!cleanText(request?.[key])) throw new TypeError(`${key} is required for compare projection.`);
  }
  if (!['A', 'B'].includes(request.side)) throw new TypeError('Projection side must be A or B.');
  if (!request.selectedBranchIds?.length) throw new TypeError('Approved branch scope must not be empty.');
}

export function projectCompareRecords(document, request) {
  validateProjectionRequest(request);
  const selected = new Set(frozenStrings(request.selectedBranchIds));
  const { branches, rootPath } = rootBranches(document);
  const records = []; const foundBranches = new Set();
  branches.forEach((branch, branchIndex) => {
    const id = branchId(branch);
    if (!selected.has(id)) return;
    foundBranches.add(id);
    const collection = components(branch);
    collection.values.forEach((record, sourceIndex) => records.push(projectedRecord({
      record, sourceIndex, branchId: id, side: request.side, sourceDocumentId: request.sourceDocumentId,
      sourcePath: `${rootPath}[${branchIndex}].${collection.key}[${sourceIndex}]`,
    })));
  });
  const missing = [...selected].filter((id) => !foundBranches.has(id));
  if (missing.length) throw new Error(`Approved branch scope is not present in worker source: ${missing.join(', ')}`);
  const projection = deepFreeze({
    schema: REVISION_COMPARE_PROJECTION_SCHEMA, basisId: request.basisId, side: request.side,
    sourceDocumentId: request.sourceDocumentId, sourceHash: request.sourceHash, scopedHash: request.scopedHash,
    selectedBranchIds: frozenStrings(request.selectedBranchIds), records: Object.freeze(records.sort((a, b) => a.recordId.localeCompare(b.recordId))),
  });
  assertJsonSafe(projection, REVISION_COMPARE_PROJECTION_SCHEMA);
  return projection;
}
