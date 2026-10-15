/** Pure support-adjustment overlay for a derived confirmed-support projection. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { stableToken } from '../sequential-sketcher-contract.js';
import {
  assertSequentialSupportAdjustmentRegister,
} from './sequential-support-adjustment-register.js';

export const SEQUENTIAL_ADJUSTED_SUPPORT_PROJECTION_SCHEMA =
  'SequentialAdjustedSupportProjection.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function point(value, label) {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) {
    throw new TypeError(`${label} must contain finite X/Y/Z coordinates.`);
  }
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}
function projectionFingerprint(value) {
  return `fnv1a32-canonical-json-v1:SSUPPORTPROJECTION:${stableToken(canonicalJson(value))}`;
}
function requiredBase(value) {
  if (value?.schema !== 'SequentialConfirmedSupportProjection.v1') {
    throw new TypeError('Adjusted support authority requires SequentialConfirmedSupportProjection.v1.');
  }
  return value;
}
function currentFamily(projection, familyId) {
  const rows = (projection.branchBundles || []).flatMap((bundle) => (
    bundle.resolvedSupportFamilies || []
  ));
  return rows.find((family) => family.familyId === familyId) || null;
}
function validateEntry(projection, entry) {
  const glyph = (projection.supportGlyphs || []).find((row) => row.glyphId === entry.supportId);
  const family = currentFamily(projection, entry.familyId);
  if (!glyph || !family || glyph.familyId !== entry.familyId
    || glyph.carrierId !== entry.carrierId
    || family.carrierBinding?.carrierId !== entry.carrierId) {
    throw new RangeError(`Support adjustment ${entry.adjustmentId} does not match current support identity.`);
  }
  if (!same(point(glyph.centerlinePointGlobal, 'Current support point'), entry.fromPosition)) {
    throw new RangeError(`Support adjustment ${entry.adjustmentId} starts from a stale support point.`);
  }
  if (!same(entry.toPosition, entry.resolvedPosition.centerlinePointGlobal)) {
    throw new RangeError(`Support adjustment ${entry.adjustmentId} would silently substitute coordinates.`);
  }
}
function adjustedPosition(position, entry) {
  const resolved = entry.resolvedPosition;
  return {
    ...position,
    supportPosGlobal: entry.toPosition,
    centerlinePointGlobal: entry.toPosition,
    carrierStationMm: resolved.carrierStationMm,
    carrierFraction: resolved.carrierFraction,
    distanceToCarrierMm: resolved.distanceToCarrierMm,
    offsetFromCenterline: resolved.offsetFromCenterline,
    positionStatus: resolved.positionStatus,
    localFrame: resolved.localFrame,
    fittingLocation: resolved.fittingLocation,
    supportAdjustment: {
      adjustmentId: entry.adjustmentId,
      operationId: entry.operationId,
      appliedAt: entry.appliedAt,
    },
  };
}
function adjustedFamily(family, entry) {
  return family.familyId === entry.familyId
    ? { ...family, position: adjustedPosition(family.position, entry) }
    : family;
}
function adjustedCarrier(carrier, entry) {
  if (carrier.carrierId !== entry.carrierId) return carrier;
  return {
    ...carrier,
    supportFamilies: (carrier.supportFamilies || []).map((family) => adjustedFamily(family, entry)),
  };
}
function adjustedGlyph(glyph, entry) {
  if (glyph.glyphId !== entry.supportId) return glyph;
  const resolved = entry.resolvedPosition;
  return {
    ...glyph,
    carrierStationMm: resolved.carrierStationMm,
    centerlinePointGlobal: entry.toPosition,
    localFrame: resolved.localFrame,
    fittingLocation: resolved.fittingLocation,
    supportAdjustmentId: entry.adjustmentId,
  };
}
function applyEntry(projection, entry) {
  validateEntry(projection, entry);
  const branchBundles = (projection.branchBundles || []).map((bundle) => ({
    ...bundle,
    carriers: (bundle.carriers || []).map((carrier) => adjustedCarrier(carrier, entry)),
    resolvedSupportFamilies: (bundle.resolvedSupportFamilies || [])
      .map((family) => adjustedFamily(family, entry)),
    supportGlyphs: (bundle.supportGlyphs || []).map((glyph) => adjustedGlyph(glyph, entry)),
  }));
  return {
    ...projection,
    branchBundles,
    supportGlyphs: (projection.supportGlyphs || []).map((glyph) => adjustedGlyph(glyph, entry)),
  };
}

export function applySequentialSupportAdjustmentRegister(baseValue, registerValue) {
  const base = requiredBase(baseValue);
  const register = assertSequentialSupportAdjustmentRegister(
    registerValue,
    base.constructionFingerprint,
  );
  const baseProjectionFingerprint = projectionFingerprint(base);
  const applied = register.entries.reduce(applyEntry, base);
  return immutableJson({
    ...applied,
    adjustmentAuthority: {
      schema: SEQUENTIAL_ADJUSTED_SUPPORT_PROJECTION_SCHEMA,
      baseProjectionFingerprint,
      registerHeadFingerprint: register.headFingerprint,
      adjustmentCount: register.entries.length,
    },
    audit: {
      ...(applied.audit || {}),
      supportAdjustmentCount: register.entries.length,
      baseProjectionMutated: false,
    },
  }, 'Sequential adjusted support projection');
}
export function assertSequentialAdjustedSupportProjection(base, register, effective) {
  const expected = applySequentialSupportAdjustmentRegister(base, register);
  if (!same(expected, effective)) {
    throw new RangeError('Effective support projection differs from independent adjustment regeneration.');
  }
  return expected;
}
export function sequentialSupportProjectionFingerprint(value) {
  return projectionFingerprint(value);
}

export const _test = Object.freeze({ canonicalJson, same, adjustedPosition, projectionFingerprint });
