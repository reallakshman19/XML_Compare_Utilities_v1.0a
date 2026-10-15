/** Canonical pending-draft recovery evidence. This contract never carries accepted authority. */
import { immutableJson, isIsoTimestamp, requiredContractText } from '../../../contracts/contract-values.js';
import {
  sameSequentialContractValue,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

export const SEQUENTIAL_DRAFT_EDIT_RECOVERY_RECORD_SCHEMA =
  'SequentialDraftEditRecoveryRecord.v1';
export const SEQUENTIAL_DRAFT_EDIT_RECOVERY_KINDS = Object.freeze([
  'MOVE_COMPONENT',
  'STRETCH_NODE',
  'ROTATE_SUBGRAPH',
  'MOVE_SUPPORT_SAME_CARRIER',
]);

const FORBIDDEN_KEYS = new Set([
  'prepared', 'preparedId', 'acceptance', 'publication', 'scene', 'renderer',
  'canvas', 'dom', 'element', 'store', 'draftStore', 'applicationService',
]);
const AUTHORITY_FIELDS = Object.freeze([
  'authorityId', 'sourceFingerprint', 'branchId', 'branchSetFingerprint',
  'journalHeadFingerprint', 'confirmedConstructionFingerprint',
  'supportProjectionFingerprint', 'ownerRevisionFingerprint',
]);

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function text(value, label) {
  return requiredContractText(value, `recovery ${label}`);
}
function kindValue(value) {
  const kind = text(value, 'kind').toUpperCase();
  if (!SEQUENTIAL_DRAFT_EDIT_RECOVERY_KINDS.includes(kind)) {
    fail('DRAFT_EDIT_RECOVERY_KIND_INVALID', `Unsupported pending draft kind: ${kind}`, TypeError);
  }
  return kind;
}
function finite(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) fail('DRAFT_EDIT_RECOVERY_NUMBER_INVALID', `${label} must be finite.`, TypeError);
  return result;
}
function point(value, label) {
  return Object.freeze(Object.fromEntries(['x', 'y', 'z']
    .map((axis) => [axis, finite(value?.[axis], `${label}.${axis}`)])));
}
function exactKeys(value, allowed, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('DRAFT_EDIT_RECOVERY_OBJECT_INVALID', `${label} must be an object.`, TypeError);
  }
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.includes(key));
  if (unknown) fail('DRAFT_EDIT_RECOVERY_FIELD_FORBIDDEN', `${label}.${unknown} is not allowed.`, TypeError);
  const missing = required.find((key) => value[key] === undefined || value[key] === null);
  if (missing) fail('DRAFT_EDIT_RECOVERY_FIELD_REQUIRED', `${label}.${missing} is required.`, TypeError);
}
function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalJsonValue(value[key])]));
}
function safeJson(value, label) {
  const seen = new WeakSet();
  const visit = (row, path) => {
    if (row === null || typeof row === 'string' || typeof row === 'boolean') return;
    if (typeof row === 'number') {
      if (!Number.isFinite(row)) fail('DRAFT_EDIT_RECOVERY_VALUE_INVALID', `${path} must be finite.`, TypeError);
      return;
    }
    if (!row || typeof row !== 'object') {
      fail('DRAFT_EDIT_RECOVERY_VALUE_INVALID', `${path} is not serializable.`, TypeError);
    }
    if (seen.has(row)) fail('DRAFT_EDIT_RECOVERY_VALUE_INVALID', `${path} must not be circular.`, TypeError);
    seen.add(row);
    const prototype = Object.getPrototypeOf(row);
    if (!Array.isArray(row) && prototype !== Object.prototype && prototype !== null) {
      fail('DRAFT_EDIT_RECOVERY_VALUE_INVALID', `${path} must contain plain objects only.`, TypeError);
    }
    if (Array.isArray(row)) row.forEach((item, index) => visit(item, `${path}[${index}]`));
    else for (const [key, item] of Object.entries(row)) {
      if (FORBIDDEN_KEYS.has(key)) {
        fail('DRAFT_EDIT_RECOVERY_AUTHORITY_FORBIDDEN', `${path}.${key} is forbidden.`, TypeError);
      }
      visit(item, `${path}.${key}`);
    }
    seen.delete(row);
  };
  visit(value, label);
  return canonicalJsonValue(JSON.parse(JSON.stringify(value)));
}
function authorityValue(value) {
  exactKeys(value, AUTHORITY_FIELDS, AUTHORITY_FIELDS, 'authority');
  return Object.freeze(Object.fromEntries(AUTHORITY_FIELDS.map((field) => [field, text(value[field], field)])));
}
function selectorValue(kind, value) {
  const fields = kind === 'STRETCH_NODE' ? ['objectId', 'nodeId']
    : kind === 'ROTATE_SUBGRAPH' ? ['objectId', 'scope'] : ['objectId'];
  exactKeys(value, fields, fields, 'selector');
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, text(value[field], `selector.${field}`)])));
}
function moveDelta(value, label) {
  exactKeys(value, ['x', 'y', 'z', 'magnitude'], ['x', 'y', 'z'], label);
  const result = point(value, label);
  const magnitude = Math.hypot(result.x, result.y, result.z);
  if (value.magnitude != null && finite(value.magnitude, `${label}.magnitude`) !== magnitude) {
    fail('DRAFT_EDIT_RECOVERY_DELTA_INVALID', `${label}.magnitude is inconsistent with XYZ.`);
  }
  return Object.freeze({ ...result, magnitude });
}
function moveInput(value) {
  exactKeys(value, ['constraint', 'rawDelta', 'delta', 'interaction', 'snapSelection'],
    ['constraint', 'rawDelta', 'delta', 'interaction'], 'MOVE_COMPONENT input');
  return Object.freeze({
    constraint: safeJson(value.constraint, 'input.constraint'),
    rawDelta: moveDelta(value.rawDelta, 'input.rawDelta'),
    delta: moveDelta(value.delta, 'input.delta'),
    interaction: safeJson(value.interaction, 'input.interaction'),
    snapSelection: value.snapSelection == null ? null : safeJson(value.snapSelection, 'input.snapSelection'),
  });
}
function stretchInput(value) {
  exactKeys(value, ['targetPosition', 'profile'], ['targetPosition', 'profile'], 'STRETCH_NODE input');
  return Object.freeze({ targetPosition: point(value.targetPosition, 'input.targetPosition'),
    profile: safeJson(value.profile, 'input.profile') });
}
function rotationInput(value) {
  exactKeys(value, ['pivot', 'axis', 'angleDegrees', 'profile'],
    ['pivot', 'axis', 'angleDegrees', 'profile'], 'ROTATE_SUBGRAPH input');
  return Object.freeze({ pivot: point(value.pivot, 'input.pivot'), axis: point(value.axis, 'input.axis'),
    angleDegrees: finite(value.angleDegrees, 'input.angleDegrees'),
    profile: safeJson(value.profile, 'input.profile') });
}
function supportInput(value) {
  exactKeys(value, ['position', 'actorId', 'reason', 'evidenceNote'],
    ['position', 'actorId', 'reason', 'evidenceNote'], 'MOVE_SUPPORT_SAME_CARRIER input');
  return Object.freeze({ position: point(value.position, 'input.position'),
    actorId: text(value.actorId, 'input.actorId'), reason: text(value.reason, 'input.reason'),
    evidenceNote: text(value.evidenceNote, 'input.evidenceNote') });
}
function inputValue(kind, value) {
  if (kind === 'MOVE_COMPONENT') return moveInput(value);
  if (kind === 'STRETCH_NODE') return stretchInput(value);
  if (kind === 'ROTATE_SUBGRAPH') return rotationInput(value);
  return supportInput(value);
}
function targetEvidenceValue(value) {
  const safe = safeJson(value, 'targetEvidence');
  if (!safe || typeof safe !== 'object' || Array.isArray(safe)) {
    fail('DRAFT_EDIT_RECOVERY_TARGET_INVALID', 'targetEvidence must be an object.', TypeError);
  }
  for (const field of ['targetId', 'authorityId', 'sceneRevision']) {
    if (safe[field] === undefined || safe[field] === null || safe[field] === '') {
      fail('DRAFT_EDIT_RECOVERY_TARGET_INVALID', `targetEvidence.${field} is required.`, TypeError);
    }
  }
  return safe;
}
function timestamp(value) {
  if (!isIsoTimestamp(value)) fail('DRAFT_EDIT_RECOVERY_TIME_INVALID', 'savedAt must be an exact ISO timestamp.', TypeError);
  return value;
}
function material(input = {}) {
  const kind = kindValue(input.kind);
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_RECOVERY_RECORD_SCHEMA,
    kind,
    authority: authorityValue(input.authority),
    editBaseFingerprint: text(input.editBaseFingerprint, 'editBaseFingerprint'),
    selector: selectorValue(kind, input.selector),
    targetEvidence: targetEvidenceValue(input.targetEvidence),
    input: inputValue(kind, input.input),
    savedAt: timestamp(input.savedAt),
  };
}

export function createSequentialDraftEditRecoveryRecord(input = {}) {
  const value = material(input);
  return immutableJson({ ...value,
    recordFingerprint: sequentialSemanticFingerprint('SSK3DDRAFTRECOVERY', value) },
  'Sequential pending draft recovery record');
}
export function assertSequentialDraftEditRecoveryRecord(value) {
  if (value?.schema !== SEQUENTIAL_DRAFT_EDIT_RECOVERY_RECORD_SCHEMA) {
    fail('DRAFT_EDIT_RECOVERY_SCHEMA_INVALID',
      `Recovery record must use ${SEQUENTIAL_DRAFT_EDIT_RECOVERY_RECORD_SCHEMA}.`, TypeError);
  }
  const rebuilt = createSequentialDraftEditRecoveryRecord(value);
  if (!sameSequentialContractValue(rebuilt, value)) {
    fail('DRAFT_EDIT_RECOVERY_CANONICAL_INVALID',
      'Recovery record differs from canonical fingerprint regeneration.');
  }
  return rebuilt;
}
export function sequentialDraftEditRecoveryRecordKey(value) {
  const record = assertSequentialDraftEditRecoveryRecord(value);
  return `${record.authority.branchId}|${record.kind}`;
}
export function sequentialDraftEditRecoveryContextMatches(value, context = {}) {
  const record = assertSequentialDraftEditRecoveryRecord(value);
  try {
    return sameSequentialContractValue(record.authority, authorityValue(context.authority))
      && record.editBaseFingerprint === text(context.editBaseFingerprint, 'context editBaseFingerprint');
  } catch { return false; }
}
export function sequentialDraftEditRecoveryTargetMatches(value, targetEvidence) {
  const record = assertSequentialDraftEditRecoveryRecord(value);
  try { return sameSequentialContractValue(record.targetEvidence, targetEvidenceValue(targetEvidence)); }
  catch { return false; }
}

export const _test = Object.freeze({ authorityValue, canonicalJsonValue, inputValue, kindValue, material,
  moveDelta, selectorValue, targetEvidenceValue });
