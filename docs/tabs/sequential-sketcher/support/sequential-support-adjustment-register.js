/** Immutable branch-local support adjustment authority; source support evidence is never modified. */
import {
  immutableJson,
  isIsoTimestamp,
  requiredContractText,
} from '../../../contracts/contract-values.js';
import { stableToken } from '../sequential-sketcher-contract.js';

export const SEQUENTIAL_SUPPORT_ADJUSTMENT_ENTRY_SCHEMA =
  'SequentialSupportAdjustmentEntry.v1';
export const SEQUENTIAL_SUPPORT_ADJUSTMENT_REGISTER_SCHEMA =
  'SequentialSupportAdjustmentRegister.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}
function fingerprint(prefix, value) {
  return `fnv1a32-canonical-json-v1:${prefix}:${stableToken(canonicalJson(value))}`;
}
function finitePoint(value, label) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) {
    throw new TypeError(`${label} must contain finite X/Y/Z coordinates.`);
  }
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}
function resolvedPosition(value = {}) {
  const centerlinePointGlobal = finitePoint(
    value.centerlinePointGlobal,
    'Support adjustment resolved centerline point',
  );
  return immutableJson({
    supportPosGlobal: finitePoint(
      value.supportPosGlobal || centerlinePointGlobal,
      'Support adjustment requested point',
    ),
    centerlinePointGlobal,
    carrierStationMm: Number.isFinite(value.carrierStationMm) ? value.carrierStationMm : null,
    carrierFraction: Number.isFinite(value.carrierFraction) ? value.carrierFraction : null,
    distanceToCarrierMm: Number.isFinite(value.distanceToCarrierMm)
      ? value.distanceToCarrierMm : null,
    offsetFromCenterline: value.offsetFromCenterline || null,
    positionStatus: requiredContractText(value.positionStatus, 'support adjustment positionStatus'),
    localFrame: value.localFrame || null,
    fittingLocation: value.fittingLocation || null,
  }, 'Sequential support adjustment resolved position');
}
function entryMaterial(input = {}) {
  const appliedAt = String(input.appliedAt || '').trim();
  if (!isIsoTimestamp(appliedAt)) {
    throw new TypeError('Support adjustment appliedAt must be an exact ISO timestamp.');
  }
  return {
    schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_ENTRY_SCHEMA,
    constructionFingerprint: requiredContractText(
      input.constructionFingerprint,
      'support adjustment constructionFingerprint',
    ),
    supportId: requiredContractText(input.supportId, 'support adjustment supportId'),
    familyId: requiredContractText(input.familyId, 'support adjustment familyId'),
    carrierId: requiredContractText(input.carrierId, 'support adjustment carrierId'),
    fromPosition: finitePoint(input.fromPosition, 'Support adjustment fromPosition'),
    toPosition: finitePoint(input.toPosition, 'Support adjustment toPosition'),
    resolvedPosition: resolvedPosition(input.resolvedPosition),
    targetId: requiredContractText(input.targetId, 'support adjustment targetId'),
    operationId: requiredContractText(input.operationId, 'support adjustment operationId'),
    actorId: requiredContractText(input.actorId, 'support adjustment actorId'),
    reason: requiredContractText(input.reason, 'support adjustment reason'),
    evidenceNote: requiredContractText(input.evidenceNote, 'support adjustment evidenceNote'),
    appliedAt,
  };
}
function createEntry(input = {}) {
  const material = entryMaterial(input);
  return immutableJson({
    ...material,
    adjustmentId: fingerprint('SSUPPORTADJUSTMENT', material),
  }, 'Sequential support adjustment entry');
}
function createRegister(input = {}) {
  const constructionFingerprint = requiredContractText(
    input.constructionFingerprint,
    'support adjustment register constructionFingerprint',
  );
  const entries = (input.entries || []).map((entry) => createEntry(entry));
  if (entries.some((entry) => entry.constructionFingerprint !== constructionFingerprint)) {
    throw new RangeError('Support adjustment entries must match the register construction fingerprint.');
  }
  const ids = entries.map((entry) => entry.adjustmentId);
  if (new Set(ids).size !== ids.length) {
    throw new RangeError('Support adjustment register contains duplicate adjustment identities.');
  }
  const material = {
    schema: SEQUENTIAL_SUPPORT_ADJUSTMENT_REGISTER_SCHEMA,
    constructionFingerprint,
    entries,
  };
  return immutableJson({
    ...material,
    headFingerprint: fingerprint('SSUPPORTADJUSTMENTREGISTER', material),
  }, 'Sequential support adjustment register');
}

export function createSequentialSupportAdjustmentRegister(input = {}) {
  return createRegister(input);
}
export function assertSequentialSupportAdjustmentRegister(value, expectedFingerprint = null) {
  if (value?.schema !== SEQUENTIAL_SUPPORT_ADJUSTMENT_REGISTER_SCHEMA) {
    throw new TypeError(`Support adjustment register must use ${SEQUENTIAL_SUPPORT_ADJUSTMENT_REGISTER_SCHEMA}.`);
  }
  const rebuilt = createRegister(value);
  if (canonicalJson(rebuilt) !== canonicalJson(value)) {
    throw new RangeError('Support adjustment register differs from canonical regeneration.');
  }
  if (expectedFingerprint && rebuilt.constructionFingerprint !== expectedFingerprint) {
    throw new RangeError('Support adjustment register construction fingerprint is stale.');
  }
  return rebuilt;
}
export function appendSequentialSupportAdjustment(registerValue, input = {}) {
  const register = assertSequentialSupportAdjustmentRegister(registerValue);
  const entry = createEntry({
    ...input,
    constructionFingerprint: register.constructionFingerprint,
  });
  const latest = [...register.entries].reverse()
    .find((row) => row.supportId === entry.supportId) || null;
  if (latest && canonicalJson(latest.toPosition) !== canonicalJson(entry.fromPosition)) {
    throw new RangeError('Support adjustment fromPosition does not match the current adjusted point.');
  }
  const next = createRegister({
    constructionFingerprint: register.constructionFingerprint,
    entries: [...register.entries, entry],
  });
  return Object.freeze({ register: next, entry: next.entries.at(-1) });
}
export function latestSequentialSupportAdjustment(registerValue, supportIdValue) {
  const register = assertSequentialSupportAdjustmentRegister(registerValue);
  const supportId = requiredContractText(supportIdValue, 'supportId');
  return [...register.entries].reverse().find((entry) => entry.supportId === supportId) || null;
}

export const _test = Object.freeze({ canonicalJson, fingerprint, finitePoint });
