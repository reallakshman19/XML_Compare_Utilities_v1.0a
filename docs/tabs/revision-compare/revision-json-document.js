/** Lossless immutable Staged-JSON document authority for Revision Compare transfer planning. */
import { assertJsonSafe, cleanText, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';

export const REVISION_COMPARE_JSON_DOCUMENT_SCHEMA = 'RevisionCompareJsonDocumentSnapshot.v1';
export const REVISION_COMPARE_JSON_SIDES = Object.freeze(['REV_A', 'REV_B']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ROOT_KEYS = Object.freeze(['objects', 'hierarchy', 'branches']);
const IDENTITY_FIELDS = Object.freeze([
  ['id', 'ID'], ['objectId', 'OBJECT_ID'], ['tag', 'TAG'], ['name', 'NAME'],
  ['attributes.REFNO', 'REFNO'], ['attributes.COMPONENTREFNO', 'COMPONENTREFNO'],
  ['attributes.ID', 'ATTRIBUTE_ID'], ['attributes.GUID', 'GUID'],
  ['attributes.TAG', 'ATTRIBUTE_TAG'], ['attributes.NAME', 'ATTRIBUTE_NAME'],
]);

function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function scalar(value) { return ['string', 'number', 'boolean'].includes(typeof value) && String(value).trim() !== ''; }
function pathValue(value, path) { return path.split('.').reduce((item, key) => record(item)[key], value); }
function pointerToken(value) { return String(value).replace(/~/g, '~0').replace(/\//g, '~1'); }
function appendPointer(parent, token) { return `${parent}/${pointerToken(token)}`; }
function sideCode(side) { return side === 'REV_A' ? 'A' : 'B'; }

function validateJson(value, path = 'parsedValue') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number.`); return; }
  if (Array.isArray(value)) { value.forEach((item, index) => validateJson(item, `${path}[${index}]`)); return; }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${path} must contain plain JSON values.`);
  Object.keys(value).forEach((key) => validateJson(value[key], `${path}.${key}`));
}
function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).map((key) => [key, cloneJsonValue(value[key])]));
  return value;
}
function cloneJson(value) {
  validateJson(value); const copy = cloneJsonValue(value);
  assertJsonSafe(copy, 'parsedValue'); return deepFreeze(copy);
}

function rootDescriptor(value) {
  if (Array.isArray(value)) return { rootKind: 'ARRAY', collection: value, rootKey: null, pointer: '', projectionPath: '$' };
  const root = record(value);
  for (const key of ROOT_KEYS) {
    if (Array.isArray(root[key])) return { rootKind: 'ENVELOPE', collection: root[key], rootKey: key, pointer: `/${pointerToken(key)}`, projectionPath: `$.${key}` };
  }
  throw new TypeError('Unsupported staged JSON root; expected a bare array or an envelope containing objects, hierarchy, or branches.');
}

function exactBranchName(branch) {
  return cleanText(branch?.name) || cleanText(record(branch?.attributes).NAME);
}
function branchIdentity(branch, pointer) {
  const name = exactBranchName(branch);
  return name ? { kind: 'BRANCH_NAME', value: name, entityId: `branch:${name}` }
    : { kind: 'CANONICAL_PATH', value: pointer, entityId: `branch-path:${pointer}` };
}
function strongestIdentity(entity, pointer) {
  for (const [path, kind] of IDENTITY_FIELDS) {
    const value = pathValue(entity, path);
    if (scalar(value)) return { kind, value: String(value) };
  }
  return { kind: 'CANONICAL_PATH', value: pointer };
}
function componentCollection(branch) {
  if (Array.isArray(branch?.children)) return { key: 'children', values: branch.children };
  if (Array.isArray(branch?.components)) return { key: 'components', values: branch.components };
  return { key: null, values: [] };
}

async function entityEntry(input, cryptoRef) {
  const canonical = stableStringify(input.value);
  return deepFreeze({
    entityId: input.entityId, canonicalPath: input.canonicalPath, projectionPath: input.projectionPath,
    parentEntityId: input.parentEntityId, entityKind: input.entityKind, identity: input.identity,
    entitySha256: await sha256Text(canonical, cryptoRef),
  });
}

async function buildEntities(snapshotInput, descriptor, cryptoRef) {
  const output = [];
  for (let branchIndex = 0; branchIndex < descriptor.collection.length; branchIndex += 1) {
    const branch = descriptor.collection[branchIndex];
    if (!branch || typeof branch !== 'object' || Array.isArray(branch)) continue;
    const branchPointer = appendPointer(descriptor.pointer, branchIndex);
    const branchPath = `${descriptor.projectionPath}[${branchIndex}]`;
    const identity = branchIdentity(branch, branchPointer);
    output.push(await entityEntry({
      value: branch, entityId: identity.entityId, canonicalPath: branchPointer, projectionPath: branchPath,
      parentEntityId: null, entityKind: 'BRANCH', identity: { kind: identity.kind, value: identity.value },
    }, cryptoRef));
    const children = componentCollection(branch);
    for (let index = 0; index < children.values.length; index += 1) {
      const value = children.values[index];
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const pointer = appendPointer(appendPointer(branchPointer, children.key), index);
      const projectionPath = `${branchPath}.${children.key}[${index}]`;
      const entityId = `record:${sideCode(snapshotInput.side)}:${snapshotInput.sourceDocumentId}:${projectionPath}`;
      output.push(await entityEntry({ value, entityId, canonicalPath: pointer, projectionPath,
        parentEntityId: identity.entityId, entityKind: 'COMPONENT', identity: strongestIdentity(value, pointer) }, cryptoRef));
    }
  }
  return Object.freeze(output.sort((a, b) => a.canonicalPath.localeCompare(b.canonicalPath) || a.entityId.localeCompare(b.entityId)));
}

function valueType(value) {
  if (value === null) return 'NULL';
  if (Array.isArray(value)) return 'ARRAY';
  return typeof value === 'object' ? 'OBJECT' : (typeof value).toUpperCase();
}
function pathEntries(value, path = '', owner = null, entities = []) {
  const exactOwner = entities.find((entry) => entry.canonicalPath === path)?.entityId ?? owner;
  const output = [{ canonicalPath: path || '/', valueType: valueType(value), entityId: exactOwner }];
  if (Array.isArray(value)) value.forEach((item, index) => output.push(...pathEntries(item, appendPointer(path, index), exactOwner, entities)));
  else if (value && typeof value === 'object') for (const key of Object.keys(value)) output.push(...pathEntries(value[key], appendPointer(path, key), exactOwner, entities));
  return output;
}

function reboundEntityId(entry, side, sourceDocumentId) {
  return entry.entityKind === 'COMPONENT'
    ? `record:${sideCode(side)}:${sourceDocumentId}:${entry.projectionPath}`
    : entry.entityId;
}
function reboundIndexes(snapshot, side, sourceDocumentId) {
  const ids = new Map(snapshot.entityIndex.map((entry) => [entry.entityId, reboundEntityId(entry, side, sourceDocumentId)]));
  const entityIndex = Object.freeze(snapshot.entityIndex.map((entry) => deepFreeze({
    ...entry,
    entityId: ids.get(entry.entityId),
    parentEntityId: entry.parentEntityId ? (ids.get(entry.parentEntityId) ?? entry.parentEntityId) : null,
  })));
  const pathIndex = Object.freeze(snapshot.pathIndex.map((entry) => deepFreeze({
    ...entry,
    entityId: entry.entityId ? (ids.get(entry.entityId) ?? entry.entityId) : null,
  })));
  return { entityIndex, pathIndex };
}

export async function createRevisionCompareJsonDocumentSnapshot(input, cryptoRef) {
  const side = cleanText(input?.side).toUpperCase();
  const sourceDocumentId = cleanText(input?.sourceDocumentId);
  const sourceContentSha256 = cleanText(input?.sourceContentSha256).toLowerCase();
  if (!REVISION_COMPARE_JSON_SIDES.includes(side)) throw new TypeError('Snapshot side must be REV_A or REV_B.');
  if (!sourceDocumentId) throw new TypeError('Snapshot sourceDocumentId is required.');
  if (!HASH_PATTERN.test(sourceContentSha256)) throw new TypeError('Snapshot sourceContentSha256 must be a full lowercase SHA-256.');
  const parsedValue = cloneJson(input?.parsedValue); const descriptor = rootDescriptor(parsedValue);
  const entityIndex = await buildEntities({ side, sourceDocumentId }, descriptor, cryptoRef);
  const snapshot = deepFreeze({
    schema: REVISION_COMPARE_JSON_DOCUMENT_SCHEMA, side, sourceDocumentId, sourceContentSha256,
    fileName: cleanText(input?.fileName) || `${side.toLowerCase()}.json`, rootKind: descriptor.rootKind,
    profile: cleanText(input?.profile) || 'UNKNOWN', parsedValue, entityIndex,
    pathIndex: Object.freeze(pathEntries(parsedValue, '', null, entityIndex)), errors: Object.freeze([]),
  });
  assertJsonSafe(snapshot, REVISION_COMPARE_JSON_DOCUMENT_SCHEMA); return snapshot;
}

export function rebindRevisionCompareJsonDocumentSnapshot(snapshot, sideValue, documentIdValue) {
  if (snapshot?.schema !== REVISION_COMPARE_JSON_DOCUMENT_SCHEMA) throw new TypeError('A lossless revision snapshot is required.');
  const side = cleanText(sideValue).toUpperCase();
  const sourceDocumentId = cleanText(documentIdValue);
  if (!REVISION_COMPARE_JSON_SIDES.includes(side)) throw new TypeError('Snapshot side must be REV_A or REV_B.');
  if (!sourceDocumentId) throw new TypeError('Snapshot sourceDocumentId is required.');
  const indexes = reboundIndexes(snapshot, side, sourceDocumentId);
  const rebound = deepFreeze({ ...snapshot, side, sourceDocumentId, ...indexes });
  assertJsonSafe(rebound, REVISION_COMPARE_JSON_DOCUMENT_SCHEMA);
  return rebound;
}

export function revisionCompareJsonSnapshotMatchesDocument(snapshot, document) {
  return Boolean(snapshot?.schema === REVISION_COMPARE_JSON_DOCUMENT_SCHEMA && document
    && snapshot.sourceDocumentId === document.documentId && snapshot.sourceContentSha256 === document.sourceHash
    && snapshot.fileName === document.fileName && snapshot.errors?.length === 0);
}

export const _test = Object.freeze({ appendPointer, componentCollection, reboundIndexes, rootDescriptor, strongestIdentity });
