import { decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { deepFreeze } from './cii-workspace-contracts.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { buildCiiWriter2RestraintPointerCustody } from './cii-workspace-writer2-restraint-delete-custody.js';

export const CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY =
  'CII_WRITER_2_RESTRAINT_BLOCK_DELETE_COMPACTION_PLAN';
export const CII_WRITER_2_RESTRAINT_CREATE_BLOCKER =
  'WRITER_2_RESTRAINT_BLOCK_CREATE_ALLOCATION_NOT_QUALIFIED';

const SLOT_PROPERTY = 'Qualified restraint slot mutation';
const SLOT_POLICY = 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT';
const SLOT_SCHEMA = 'CIIWorkspaceRestraintSlotMutation.v1';
const SLOT_CLEAR_AUTHORITY = 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const BLOCK_ROWS = 24;
const SLOT_ROWS = 4;
const SLOTS = 6;
const APPROVED = new Set(['REVIEWED', 'LOCKED']);

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sorted(values) { return [...values].sort((a, b) => a - b); }
function sortedStrings(values) { return [...values].map(text).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function sameStrings(left, right) {
  const a = sortedStrings(left); const b = sortedStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function prefixedText(row) {
  const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return null;
  const length = Number(match[1]);
  return String(match[2] || '').slice(0, length);
}
function sectionRows(raw, name) {
  const lines = String(raw ?? '').split(/\r?\n/);
  const marker = new RegExp(`^\\s*#\\$\\s*${name}\\s*$`, 'i');
  const start = lines.findIndex((line) => marker.test(line));
  if (start < 0) return [];
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*#\$/.test(lines[index])) break;
    if (lines[index].trim()) rows.push(lines[index]);
  }
  return rows;
}
function versionMajor(raw) {
  const rows = sectionRows(raw, 'VERSION');
  const values = decodeCiiNumericRow(rows[0] || '');
  return Array.isArray(values) && values.length >= 2 && Number.isFinite(Number(values[1]))
    ? Number(values[1]) : null;
}
function controlRestraintCount(raw) {
  const rows = sectionRows(raw, 'CONTROL');
  const values = decodeCiiNumericRow(rows[1] || '');
  const count = Number(values?.[3]);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
function slotState(restraintRows, pointer, slot) {
  const base = (pointer - 1) * BLOCK_ROWS + (slot - 1) * SLOT_ROWS;
  if (base < 0 || base + 3 >= restraintRows.length) return null;
  const first = decodeCiiNumericRow(restraintRows[base]);
  const second = decodeCiiNumericRow(restraintRows[base + 1]);
  if (!Array.isArray(first) || first.length < 6 || !Array.isArray(second) || second.length < 3) return null;
  const line1 = first.slice(0, 6).map(Number); const line2 = second.slice(0, 3).map(Number);
  if (![...first.slice(0, 6).map(Number), ...second.slice(0, 3).map(Number)].every(Number.isFinite)) return null;
  const tag = prefixedText(restraintRows[base + 2]); const guid = prefixedText(restraintRows[base + 3]);
  if (tag == null || guid == null) return null;
  const occupied = !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12);
  return Object.freeze({ pointer, slot, line1: Object.freeze(line1), line2: Object.freeze(line2), tag, guid, occupied });
}
function sameNumbers(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length
    && left.every((value, index) => Number(value) === Number(right[index]));
}
function sameSlotPreimage(expected, actual) {
  return expected && actual
    && Number(expected.pointer) === Number(actual.pointer)
    && Number(expected.slot) === Number(actual.slot)
    && expected.occupied === actual.occupied
    && text(expected.tag) === text(actual.tag)
    && text(expected.guid) === text(actual.guid)
    && sameNumbers(expected.line1, actual.line1)
    && sameNumbers(expected.line2, actual.line2);
}
function pointerMapping(blockCount, deleted) {
  const mapping = {}; let next = 1;
  for (let oldPointer = 1; oldPointer <= blockCount; oldPointer += 1) {
    if (deleted.has(oldPointer)) mapping[oldPointer] = 0;
    else { mapping[oldPointer] = next; next += 1; }
  }
  return Object.freeze(mapping);
}
function canonicalScopeBlockers(transferPlan, targetDocument) {
  const blockers = []; const scope = transferPlan?.transferScope;
  if (!Array.isArray(transferPlan?.operations)) blockers.push('WRITER_2_RESTRAINT_OPERATIONS_ARRAY_REQUIRED');
  if (!Array.isArray(transferPlan?.excludedOperations)) blockers.push('WRITER_2_RESTRAINT_EXCLUDED_OPERATIONS_ARRAY_REQUIRED');
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    blockers.push('WRITER_2_RESTRAINT_CANONICAL_BOUND_TRANSFER_SCOPE_REQUIRED');
  }
  const all = [...(transferPlan?.operations || []), ...(transferPlan?.excludedOperations || [])];
  const ids = all.map(operationId);
  if (ids.some((id) => !id)) blockers.push('WRITER_2_RESTRAINT_SCOPE_OPERATION_ID_REQUIRED');
  if (new Set(ids).size !== ids.length) blockers.push('WRITER_2_RESTRAINT_SCOPE_DUPLICATE_OPERATION_ID');
  const operations = transferPlan?.operations || []; const excludedOperations = transferPlan?.excludedOperations || [];
  for (const operation of operations) {
    const id = operationId(operation) || 'unknown';
    if (operation?.action === 'KEEP') {
      if (operation?.scopeDecision !== 'KEEP') blockers.push(`WRITER_2_RESTRAINT_SCOPE_KEEP_DECISION_REQUIRED:${id}`);
    } else if (operation?.scopeDecision !== 'APPLY') blockers.push(`WRITER_2_RESTRAINT_SCOPE_APPLY_DECISION_REQUIRED:${id}`);
  }
  for (const operation of excludedOperations) {
    const id = operationId(operation) || 'unknown';
    if (operation?.action === 'KEEP') blockers.push(`WRITER_2_RESTRAINT_SCOPE_KEEP_IN_EXCLUDED_FORBIDDEN:${id}`);
    if (operation?.scopeDecision !== 'EXCLUDE') blockers.push(`WRITER_2_RESTRAINT_SCOPE_EXCLUDE_DECISION_REQUIRED:${id}`);
  }
  const applied = operations.filter((item) => item?.scopeDecision === 'APPLY' && item?.action !== 'KEEP').map(operationId);
  const excluded = excludedOperations.filter((item) => item?.scopeDecision === 'EXCLUDE' && item?.action !== 'KEEP').map(operationId);
  if (!sameStrings(applied, scope?.appliedOperationIds || [])) blockers.push('WRITER_2_RESTRAINT_SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excluded, scope?.excludedOperationIds || [])) blockers.push('WRITER_2_RESTRAINT_SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings([...applied, ...excluded], scope?.candidateOperationIds || [])) blockers.push('WRITER_2_RESTRAINT_SCOPE_CANDIDATE_SET_MISMATCH');
  const sourcePlanHash = text(transferPlan?.sourceDocument?.contentSha256);
  const sourceScopeHash = text(scope?.sourceSha256);
  if (!isCiiSha256Hex(sourcePlanHash) || sourcePlanHash !== sourceScopeHash) blockers.push('WRITER_2_RESTRAINT_SCOPE_SOURCE_HASH_MISMATCH');

  const declared = text(targetDocument?.contentSha256);
  const planHash = text(transferPlan?.targetDocument?.contentSha256);
  const scopeHash = text(scope?.targetSha256);
  const raw = targetDocument?.physicalFile?.originalByteString;
  if (!isCiiSha256Hex(declared) || typeof raw !== 'string' || !raw.length) {
    blockers.push('WRITER_2_RESTRAINT_TARGET0_BYTE_CUSTODY_REQUIRED');
  } else {
    const actual = sha256CiiByteString(raw);
    if (actual !== declared || planHash !== declared || scopeHash !== declared) blockers.push('WRITER_2_RESTRAINT_TARGET0_SHA256_MISMATCH');
    if (targetDocument?.physicalFile?.byteLength != null && Number(targetDocument.physicalFile.byteLength) !== raw.length) {
      blockers.push('WRITER_2_RESTRAINT_TARGET0_BYTE_LENGTH_MISMATCH');
    }
  }
  return blockers;
}
function clearPlanFrom(operation) { return operation?.sourceEvidence?.value || operation?.proposed || null; }
function selectedClears(transferPlan, blockers) {
  const clears = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision !== 'APPLY') continue;
    const id = operationId(operation) || 'unknown';
    if (operation?.family === 'RESTRAINT' && operation?.property === SLOT_PROPERTY && operation?.action === 'CREATE') {
      blockers.push(CII_WRITER_2_RESTRAINT_CREATE_BLOCKER);
      blockers.push(`WRITER_2_RESTRAINT_DELETE_UNSUPPORTED_APPLY:${id}`); continue;
    }
    if (operation?.family !== 'RESTRAINT' || operation?.property !== SLOT_PROPERTY || operation?.action !== 'DELETE') {
      blockers.push(`WRITER_2_RESTRAINT_DELETE_UNSUPPORTED_APPLY:${id}`); continue;
    }
    const plan = clearPlanFrom(operation);
    if (operation?.status !== 'PREVIEW_READY' || operation?.policyAuthority !== SLOT_POLICY || !APPROVED.has(operation?.matchAuthority?.status)) {
      blockers.push(`WRITER_2_RESTRAINT_DELETE_OPERATION_NOT_READY:${id}`); continue;
    }
    if (plan?.schema !== SLOT_SCHEMA || plan?.status !== 'QUALIFIED' || plan?.mode !== 'CLEAR' || plan?.authority !== SLOT_CLEAR_AUTHORITY) {
      blockers.push(`WRITER_2_RESTRAINT_DELETE_CLEAR_PLAN_REQUIRED:${id}`); continue;
    }
    const pointer = Number(plan.pointer); const slot = Number(plan.slot);
    if (!Number.isSafeInteger(pointer) || pointer < 1 || !Number.isSafeInteger(slot) || slot < 1 || slot > SLOTS) {
      blockers.push(`WRITER_2_RESTRAINT_DELETE_POINTER_SLOT_REQUIRED:${id}`); continue;
    }
    clears.push(Object.freeze({ operationId: id, pointer, slot, targetNode: String(plan.targetNode), beforeSlot: plan.beforeSlot }));
  }
  if (!clears.length) blockers.push('WRITER_2_RESTRAINT_DELETE_NO_MUTATIONS');
  return clears;
}
function exactOwners(targetDocument, blockers) {
  const custody = buildCiiWriter2RestraintPointerCustody(targetDocument);
  blockers.push(...(custody?.blockers || []));
  const owners = new Map();
  for (const [pointer, rows] of Object.entries(custody?.ownersByPointer || {})) owners.set(Number(pointer), [...rows]);
  return { custody, owners };
}

export function buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument, transferPlan }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_2_RESTRAINT_TRANSFER_PLAN_NOT_PREVIEW_READY');
  blockers.push(...canonicalScopeBlockers(transferPlan, targetDocument));
  const raw = targetDocument?.physicalFile?.originalByteString || '';
  const restraintRows = sectionRows(raw, 'RESTRANT');
  if (versionMajor(raw) !== 11) blockers.push('WRITER_2_RESTRAINT_V11_LAYOUT_REQUIRED');
  if (restraintRows.length % BLOCK_ROWS !== 0) blockers.push('WRITER_2_RESTRAINT_SECTION_ROW_COUNT_NOT_MULTIPLE_OF_24');
  const blockCount = restraintRows.length / BLOCK_ROWS;
  const controlCount = controlRestraintCount(raw);
  if (!Number.isSafeInteger(blockCount) || controlCount !== blockCount) blockers.push('WRITER_2_RESTRAINT_CONTROL_BLOCK_COUNT_MISMATCH');
  const evidence = targetDocument?.auxiliaryEvidence?.restraints;
  if (evidence?.authority !== 'PROTECTED_WRITER_RESTRANT_BLOCK_INDEX_24_ROWS'
    || Number(evidence?.blockRows) !== BLOCK_ROWS || Number(evidence?.sectionRowCount) !== restraintRows.length) {
    blockers.push('WRITER_2_RESTRAINT_24_ROW_PHYSICAL_CUSTODY_REQUIRED');
  }

  const { custody: pointerCustody, owners } = exactOwners(targetDocument, blockers);
  for (const [pointer, list] of owners.entries()) {
    if (pointer > blockCount) blockers.push(`WRITER_2_RESTRAINT_POINTER_OUT_OF_RANGE:${pointer}`);
    if (list.length > 1) blockers.push(`WRITER_2_RESTRAINT_SHARED_POINTER_ALIAS_UNQUALIFIED:${pointer}:${list.map((item) => item.parsedElementIndex).join(',')}`);
  }

  const clears = selectedClears(transferPlan, blockers);
  const claims = new Set(); const invalidDeletePointers = new Set();
  for (const clear of clears) {
    const key = `${clear.pointer}:${clear.slot}`;
    if (claims.has(key)) {
      blockers.push(`WRITER_2_RESTRAINT_DUPLICATE_SLOT_DELETE_CLAIM:${key}`);
      invalidDeletePointers.add(clear.pointer);
    }
    claims.add(key);
    const actual = slotState(restraintRows, clear.pointer, clear.slot);
    if (!sameSlotPreimage(clear.beforeSlot, actual)) {
      blockers.push(`WRITER_2_RESTRAINT_SLOT_PREIMAGE_MISMATCH:${key}`);
      invalidDeletePointers.add(clear.pointer);
    }
  }

  const byPointer = new Map();
  for (const clear of clears) {
    if (!byPointer.has(clear.pointer)) byPointer.set(clear.pointer, []);
    byPointer.get(clear.pointer).push(clear);
  }
  const deleted = new Set();
  for (const [pointer, pointerClears] of [...byPointer.entries()].sort(([a], [b]) => a - b)) {
    if (pointer > blockCount) { blockers.push(`WRITER_2_RESTRAINT_DELETE_POINTER_OUT_OF_RANGE:${pointer}`); continue; }
    const pointerOwners = owners.get(pointer) || [];
    if (pointerOwners.length !== 1) { blockers.push(`WRITER_2_RESTRAINT_DELETE_UNIQUE_OWNER_REQUIRED:${pointer}:${pointerOwners.length}`); continue; }
    const owner = pointerOwners[0];
    let removable = !invalidDeletePointers.has(pointer);
    for (const clear of pointerClears) {
      if (clear.targetNode !== owner.from && clear.targetNode !== owner.to) {
        blockers.push(`WRITER_2_RESTRAINT_DELETE_OWNER_NODE_CUSTODY_REQUIRED:${pointer}:${clear.targetNode}`);
        removable = false;
      }
    }
    const selectedSlots = new Set(pointerClears.map((item) => item.slot));
    for (let slot = 1; slot <= SLOTS; slot += 1) {
      const state = slotState(restraintRows, pointer, slot);
      if (!state) { blockers.push(`WRITER_2_RESTRAINT_SLOT_SHAPE_REQUIRED:${pointer}:${slot}`); removable = false; continue; }
      if (state.tag || state.guid) { blockers.push(`WRITER_2_RESTRAINT_BLOCK_METADATA_RESIDUE:${pointer}:${slot}`); removable = false; }
      if (state.occupied && !selectedSlots.has(slot)) { blockers.push(`WRITER_2_RESTRAINT_BLOCK_STILL_OCCUPIED:${pointer}:${slot}`); removable = false; }
    }
    if (removable) deleted.add(pointer);
  }

  const oldToNewPointer = Number.isSafeInteger(blockCount) ? pointerMapping(blockCount, deleted) : Object.freeze({});
  const pointerChanges = [];
  for (const [pointer, list] of owners.entries()) {
    for (const owner of list) {
      const newPointer = pointer > 0 && Object.prototype.hasOwnProperty.call(oldToNewPointer, pointer)
        ? Number(oldToNewPointer[pointer]) : pointer;
      if (newPointer !== pointer) pointerChanges.push(Object.freeze({ ...owner, oldPointer: pointer, newPointer }));
    }
  }
  pointerChanges.sort((a, b) => a.parsedElementIndex - b.parsedElementIndex);
  const deletedPointers = Object.freeze(sorted(deleted));
  const retainedPointers = Object.freeze(Array.from({ length: Number.isSafeInteger(blockCount) ? blockCount : 0 }, (_, index) => index + 1)
    .filter((pointer) => !deleted.has(pointer)));
  const deletedRowRanges = Object.freeze(deletedPointers.map((pointer) => Object.freeze({
    pointer, sectionRowStart: (pointer - 1) * BLOCK_ROWS, sectionRowEndExclusive: pointer * BLOCK_ROWS,
  })));
  const ready = blockers.length === 0 && deletedPointers.length > 0;
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2RestraintDeleteCompactionPlan.v1', status: ready ? 'READY' : 'BLOCKED', ready,
    authority: CII_WRITER_2_RESTRAINT_DELETE_COMPACTION_POLICY,
    blockCountBefore: Number.isSafeInteger(blockCount) ? blockCount : null,
    blockCountAfter: Number.isSafeInteger(blockCount) ? blockCount - deleted.size : null,
    controlCountBefore: controlCount, controlCountAfter: Number.isSafeInteger(controlCount) ? controlCount - deleted.size : null,
    pointerCustody,
    deletedPointers, retainedPointers, oldToNewPointer, pointerChanges: Object.freeze(pointerChanges),
    deletedRowRanges, deletionClaims: Object.freeze(clears), operationCount: clears.length,
    blockers: Object.freeze([...new Set(blockers)]),
    createAuthority: Object.freeze({ ready: false, blocker: CII_WRITER_2_RESTRAINT_CREATE_BLOCKER,
      reason: 'W2.9 did not qualify new-block allocation, GUID generation, or generic restraint CREATE defaults.' }),
  });
}

export const _test = Object.freeze({
  text, sectionRows, versionMajor, controlRestraintCount, slotState, sameSlotPreimage,
  pointerMapping, canonicalScopeBlockers, selectedClears, exactOwners,
});