/** Canonical unique entity and field addressing for staged-JSON transfer plans. */
import { assertJsonSafe, cleanText, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { REVISION_COMPARE_JSON_DOCUMENT_SCHEMA } from './revision-json-document.js';

export const REVISION_COMPARE_TRANSFER_ADDRESS_SCHEMA = 'RevisionCompareTransferAddress.v1';
export const REVISION_COMPARE_TARGET_STATE = Object.freeze({ PRESENT: 'PRESENT', ABSENT: 'ABSENT' });
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function decodePointerToken(value) { return String(value).replace(/~1/g, '/').replace(/~0/g, '~'); }
function encodePointerToken(value) { return String(value).replace(/~/g, '~0').replace(/\//g, '~1'); }
function pointerParts(path) {
  const value = String(path ?? '');
  if (value === '' || value === '/') return [];
  if (!value.startsWith('/')) throw new TypeError('Canonical paths must use JSON Pointer syntax.');
  return value.slice(1).split('/').map(decodePointerToken);
}
function pointerFromParts(parts) { return parts.length ? `/${parts.map(encodePointerToken).join('/')}` : '/'; }
function own(container, key) {
  return container !== null && typeof container === 'object'
    && Object.prototype.hasOwnProperty.call(container, key);
}
function pathLookup(root, path) {
  let current = root;
  for (const part of pointerParts(path)) {
    if (!own(current, part)) return { found: false, value: undefined };
    current = current[part];
  }
  return { found: true, value: current };
}
function joinPointer(base, relative) {
  if (!relative || relative === '/') return base || '/';
  return `${base === '/' ? '' : base}${relative}` || '/';
}
function canonicalEqual(left, right) { return stableStringify(left) === stableStringify(right); }
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function revisionCompareDollarPathToPointer(path) {
  const text = cleanText(path);
  if (text === '$') return '/';
  if (!text.startsWith('$')) throw new TypeError('Evidence path must start with $.');
  const tokens = [];
  let index = 1;
  while (index < text.length) {
    if (text[index] === '.') {
      index += 1;
      const start = index;
      while (index < text.length && !'.['.includes(text[index])) index += 1;
      if (start === index) throw new TypeError(`Invalid evidence path ${text}.`);
      tokens.push(text.slice(start, index));
      continue;
    }
    if (text[index] === '[') {
      const end = text.indexOf(']', index);
      if (end < 0) throw new TypeError(`Invalid evidence path ${text}.`);
      const token = text.slice(index + 1, end);
      if (!/^\d+$/.test(token)) throw new TypeError('Only numeric staged array indexes are supported.');
      tokens.push(token);
      index = end + 1;
      continue;
    }
    throw new TypeError(`Invalid evidence path ${text}.`);
  }
  return `/${tokens.map(encodePointerToken).join('/')}`;
}

export function findRevisionCompareEntity(snapshot, entityId) {
  const matches = (snapshot?.entityIndex ?? []).filter((entry) => entry.entityId === entityId);
  if (!matches.length) throw new Error(`Entity ${entityId} resolves to zero canonical entities.`);
  if (matches.length > 1) throw new Error(`Entity ${entityId} resolves to multiple canonical entities.`);
  return matches[0];
}

export function findRevisionCompareEntityForEvidencePath(snapshot, entityId, evidencePath) {
  const pointer = revisionCompareDollarPathToPointer(evidencePath);
  const matches = (snapshot?.entityIndex ?? []).filter((entry) => entry.entityId === entityId
    && (pointer === entry.canonicalPath || pointer.startsWith(`${entry.canonicalPath}/`)));
  matches.sort((a, b) => b.canonicalPath.length - a.canonicalPath.length);
  if (!matches.length) throw new Error(`Entity ${entityId} does not own evidence path ${evidencePath}.`);
  if (matches.length > 1 && matches[0].canonicalPath.length === matches[1].canonicalPath.length) {
    throw new Error(`Entity ${entityId} resolves to multiple canonical paths.`);
  }
  return matches[0];
}

export function revisionCompareRelativeFieldPath(entityPath, evidencePath) {
  const pointer = revisionCompareDollarPathToPointer(evidencePath);
  if (pointer === entityPath) return '/';
  if (!pointer.startsWith(`${entityPath}/`)) throw new Error('Evidence path is outside the selected entity.');
  return pointer.slice(entityPath.length);
}

function addressBlockers(snapshot, address) {
  const blockers = [];
  if (snapshot?.schema !== REVISION_COMPARE_JSON_DOCUMENT_SCHEMA || snapshot.errors?.length) {
    blockers.push('A valid lossless target snapshot is required.');
  }
  if (address?.schema !== REVISION_COMPARE_TRANSFER_ADDRESS_SCHEMA) {
    blockers.push(`Address schema must be ${REVISION_COMPARE_TRANSFER_ADDRESS_SCHEMA}.`);
  }
  if (address?.targetDocumentId !== snapshot?.sourceDocumentId) blockers.push('Target document identity does not match the snapshot.');
  if (address?.targetDocumentSha256 !== snapshot?.sourceContentSha256) blockers.push('Target document SHA-256 does not match the snapshot.');
  if (!HASH_PATTERN.test(address?.expectedEntitySha256 ?? '')) blockers.push('Expected entity SHA-256 is invalid.');
  if (!Object.values(REVISION_COMPARE_TARGET_STATE).includes(address?.expectedTargetState)) blockers.push('Expected target state is invalid.');
  try {
    if (!pointerParts(address?.fieldPath).length) blockers.push('Target field path must identify one property below the entity root.');
  } catch (error) { blockers.push(error.message); }
  return blockers;
}

function fieldLocation(entityValue, fieldPath) {
  const parts = pointerParts(fieldPath);
  if (!parts.length) return { parentFound: false, found: false, reason: 'ENTITY_ROOT' };
  const parentParts = parts.slice(0, -1);
  const parentPath = pointerFromParts(parentParts);
  const parent = pathLookup(entityValue, parentPath);
  if (!parent.found) return { parentFound: false, found: false, parentPath, key: parts.at(-1) };
  if (Array.isArray(parent.value)) return { parentFound: true, arrayParent: true, found: own(parent.value, parts.at(-1)), parentPath, parent: parent.value, key: parts.at(-1) };
  if (!plainObject(parent.value)) return { parentFound: true, objectParent: false, found: false, parentPath, parent: parent.value, key: parts.at(-1) };
  const key = parts.at(-1);
  return { parentFound: true, objectParent: true, found: own(parent.value, key), value: parent.value[key], parentPath, parent: parent.value, key };
}

function targetStateBlockers(location, address) {
  const blockers = [];
  if (!location.parentFound) blockers.push('Target field parent path resolves to zero objects.');
  else if (location.arrayParent) blockers.push('Target field path would require an array insertion or array-member write.');
  else if (!location.objectParent) blockers.push('Target field parent path does not resolve to an object.');
  if (address.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT) {
    if (!location.found) blockers.push('Target field path resolves to zero fields while PRESENT was required.');
    else if (!canonicalEqual(location.value, address.expectedCurrentValue)) blockers.push('Target field current value does not match the expected value.');
  } else if (address.expectedTargetState === REVISION_COMPARE_TARGET_STATE.ABSENT && location.found) {
    blockers.push('Target field is present while ABSENT was required.');
  }
  return blockers;
}

export function resolveRevisionCompareTransferAddress(snapshot, address) {
  const blockers = addressBlockers(snapshot, address);
  const matches = (snapshot?.entityIndex ?? []).filter((entry) => entry.entityId === address?.targetEntityId
    && entry.canonicalPath === address?.entityCanonicalPath);
  if (!matches.length) blockers.push('Target entity address resolves to zero entities.');
  if (matches.length > 1) blockers.push('Target entity address resolves to multiple entities.');
  const entity = matches.length === 1 ? matches[0] : null;
  if (entity && entity.entitySha256 !== address.expectedEntitySha256) blockers.push('Target entity SHA-256 no longer matches the expected entity.');
  const entityLookup = entity ? pathLookup(snapshot.parsedValue, entity.canonicalPath) : { found: false };
  if (entity && !entityLookup.found) blockers.push('Target entity canonical path is absent from the lossless snapshot.');
  let location = { parentFound: false, found: false, parentPath: null };
  if (entityLookup.found) {
    try { location = fieldLocation(entityLookup.value, address.fieldPath); }
    catch (error) { blockers.push(error.message); }
    blockers.push(...targetStateBlockers(location, address));
  }
  const result = {
    schema: 'RevisionCompareTransferAddressResolution.v1',
    status: blockers.length ? 'BLOCKED' : 'READY',
    address, entity,
    absoluteFieldPath: entity ? joinPointer(entity.canonicalPath, address.fieldPath) : null,
    parentCanonicalPath: entity && location.parentPath ? joinPointer(entity.canonicalPath, location.parentPath) : null,
    resolvedTargetState: location.found ? REVISION_COMPARE_TARGET_STATE.PRESENT : REVISION_COMPARE_TARGET_STATE.ABSENT,
    blockers: Object.freeze(blockers),
  };
  if (location.found) result.value = location.value;
  const frozen = deepFreeze(result);
  assertJsonSafe(frozen, frozen.schema);
  return frozen;
}

export function createRevisionCompareTransferAddress(input) {
  const expectedTargetState = cleanText(input?.expectedTargetState).toUpperCase();
  if (!Object.values(REVISION_COMPARE_TARGET_STATE).includes(expectedTargetState)) {
    throw new TypeError('Transfer address expectedTargetState must be PRESENT or ABSENT.');
  }
  const hasExpectedValue = Object.prototype.hasOwnProperty.call(input ?? {}, 'expectedCurrentValue');
  if (expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT && !hasExpectedValue) {
    throw new TypeError('PRESENT transfer addresses require expectedCurrentValue, including explicit null.');
  }
  if (expectedTargetState === REVISION_COMPARE_TARGET_STATE.ABSENT && hasExpectedValue) {
    throw new TypeError('ABSENT transfer addresses must not encode absence as expectedCurrentValue.');
  }
  const address = {
    schema: REVISION_COMPARE_TRANSFER_ADDRESS_SCHEMA,
    targetDocumentId: cleanText(input?.targetDocumentId),
    targetDocumentSha256: cleanText(input?.targetDocumentSha256).toLowerCase(),
    targetEntityId: cleanText(input?.targetEntityId),
    entityCanonicalPath: cleanText(input?.entityCanonicalPath),
    fieldPath: cleanText(input?.fieldPath),
    expectedTargetState,
    expectedEntitySha256: cleanText(input?.expectedEntitySha256).toLowerCase(),
  };
  if (hasExpectedValue) address.expectedCurrentValue = input.expectedCurrentValue;
  const frozen = deepFreeze(address);
  assertJsonSafe(frozen, REVISION_COMPARE_TRANSFER_ADDRESS_SCHEMA);
  return frozen;
}

export function readRevisionCompareSnapshotField(snapshot, entity, fieldPath) {
  const entityValue = pathLookup(snapshot?.parsedValue, entity?.canonicalPath);
  if (!entityValue.found) return { found: false, value: undefined };
  return pathLookup(entityValue.value, fieldPath);
}

export const _test = Object.freeze({ canonicalEqual, fieldLocation, joinPointer, pathLookup, pointerParts });
