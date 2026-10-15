import {
  BLOCKING_ROW_STATUSES,
  DEFAULT_NUMERIC_TOLERANCE_POLICY,
  DEFAULT_TRANSFORM_POLICY,
  VALIDATION_AUDIT_V2_SCHEMA,
  VALIDATION_MODEL_V2_SCHEMA,
  clean,
  cloneArray,
  diagnostic,
  finite,
  pairKey,
  stableHash,
} from './shared.js';
import { alignedFieldValue, applyAnchorOffset, offsetFromPoints } from '../../XmlCompareAnchorTransform.js';
import { readFieldValue } from '../../XmlCompareFieldExtractor.js';

function point(record = {}) {
  const src = record.position || record.coordinate || record.coOrds || record.points?.[0] || record;
  const x = finite(src?.x, null);
  const y = finite(src?.y, null);
  const z = finite(src?.z, null);
  return [x, y, z].every((value) => value != null) ? Object.freeze({ x, y, z }) : null;
}

function distanceMm(a = null, b = null) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function readField(record = {}, field = '') {
  return readFieldValue(record, field);
}

function toleranceForField(field = '', policy = DEFAULT_NUMERIC_TOLERANCE_POLICY) {
  const name = clean(field).toLowerCase();
  if (/press|^p[0-9]/.test(name)) return policy.pressure || DEFAULT_NUMERIC_TOLERANCE_POLICY.pressure;
  if (/temp|^t[0-9]/.test(name)) return policy.temperature || DEFAULT_NUMERIC_TOLERANCE_POLICY.temperature;
  if (/coord|global|x$|y$|z$/.test(name)) return policy.coordinate || DEFAULT_NUMERIC_TOLERANCE_POLICY.coordinate;
  if (/wall|thick/.test(name)) return policy.wallThickness || DEFAULT_NUMERIC_TOLERANCE_POLICY.wallThickness;
  if (/length|delta/.test(name)) return policy.length || DEFAULT_NUMERIC_TOLERANCE_POLICY.length;
  return policy.default || DEFAULT_NUMERIC_TOLERANCE_POLICY.default;
}

function fieldValidationRows(sourceRecord = {}, targetRecord = {}, fields = [], policy = DEFAULT_NUMERIC_TOLERANCE_POLICY, anchorOffset = null) {
  return (fields || []).map((field) => fieldValidationRow(sourceRecord, targetRecord, field, policy, anchorOffset));
}

function fieldValidationRow(sourceRecord, targetRecord, field, policy, anchorOffset = null) {
  const sourceValue = readField(sourceRecord, field);
  const targetValue = alignedFieldValue(field, readField(targetRecord, field), anchorOffset);
  const sn = finite(sourceValue, null);
  const tn = finite(targetValue, null);
  if (sn == null || tn == null) return textFieldRow(field, sourceValue, targetValue);
  const tolerance = toleranceForField(field, policy);
  const delta = tn - sn;
  return Object.freeze({
    field: clean(field),
    sourceValue,
    targetValue,
    delta,
    tolerance,
    status: Math.abs(delta) <= finite(tolerance.abs, 0) ? 'OK' : 'MISMATCH',
    mode: 'numeric-tolerance',
  });
}

function textFieldRow(field, sourceValue, targetValue) {
  return Object.freeze({
    field: clean(field),
    sourceValue: sourceValue ?? '',
    targetValue: targetValue ?? '',
    status: clean(sourceValue) === clean(targetValue) ? 'OK' : 'MISMATCH',
    mode: 'text',
  });
}

function coordinateFrameComparable(record = {}) {
  const status = record.coordinateFrameStatus || record.raw?.coordinateFrameStatus;
  if (!status) return true;
  return status.comparableForDelta !== false;
}

export function createValidationModelV2({ sourceRecords = [], targetRecords = [], approvedMatchSet = null, compareFields = [], numericTolerancePolicy = DEFAULT_NUMERIC_TOLERANCE_POLICY, identityConfidenceThreshold = 0.75, anchor = null } = {}) {
  const context = validationContext(sourceRecords, targetRecords, approvedMatchSet, numericTolerancePolicy, identityConfidenceThreshold, anchor);
  const diagnostics = approvedMatchSet?.approvedMatches?.length ? [] : [diagnostic('BLOCKER', 'APPROVED_MATCH_SET_EMPTY', 'Validation requires at least one approved match.')];
  const rows = (approvedMatchSet?.approvedMatches || []).map((match) => validationRow(match, compareFields, context));
  const blockerCount = rows.filter((row) => BLOCKING_ROW_STATUSES.has(row.status)).length + diagnostics.filter((item) => item.severity === 'BLOCKER').length;
  return Object.freeze({
    schema: VALIDATION_MODEL_V2_SCHEMA,
    mode: compareFields.length ? 'approved-match-field-coordinate-validation' : 'approved-match-coordinate-validation',
    transformUsed: Object.freeze({ ...(approvedMatchSet?.transformPolicy || DEFAULT_TRANSFORM_POLICY) }),
    coordinateFramePolicy: 'block-non-comparable-coordinate-frames',
    numericTolerancePolicy: Object.freeze({ ...numericTolerancePolicy }),
    rows: Object.freeze(rows),
    diagnostics: Object.freeze([...diagnostics, ...rows.flatMap((row) => row.diagnostics || [])]),
    blockers: Object.freeze(rows.filter((row) => BLOCKING_ROW_STATUSES.has(row.status))),
    summary: summarizeRows(rows, blockerCount),
  });
}

function validationContext(sourceRecords, targetRecords, approvedMatchSet, numericTolerancePolicy, identityConfidenceThreshold, anchor) {
  const sourceByUid = new Map((sourceRecords || []).map((record) => [clean(record.uid), record]));
  const targetByUid = new Map((targetRecords || []).map((record) => [clean(record.uid), record]));
  const targetClaims = new Map();
  for (const match of approvedMatchSet?.approvedMatches || []) {
    const targetUid = clean(match.targetUid);
    targetClaims.set(targetUid, (targetClaims.get(targetUid) || 0) + 1);
  }
  const anchorOffset = anchorOffsetFor(anchor, sourceByUid, targetByUid);
  return { sourceByUid, targetByUid, targetClaims, numericTolerancePolicy, identityConfidenceThreshold, approvedMatchSet, anchorOffset };
}

// Manual base anchor -> single translation offset (source - target) applied to every target coordinate.
function anchorOffsetFor(anchor, sourceByUid, targetByUid) {
  if (!anchor) return null;
  const source = sourceByUid.get(clean(anchor.sourceUid));
  const target = targetByUid.get(clean(anchor.targetUid));
  return offsetFromPoints(point(source || {}), point(target || {}));
}

function validationRow(match, compareFields, context) {
  const source = context.sourceByUid.get(clean(match.sourceUid));
  const target = context.targetByUid.get(clean(match.targetUid));
  const fieldRows = fieldValidationRows(source || {}, target || {}, compareFields, context.numericTolerancePolicy, context.anchorOffset);
  const coordinateDeltaMm = Number.isFinite(match.coordinateDeltaMm) ? match.coordinateDeltaMm : distanceMm(point(source), applyAnchorOffset(point(target), context.anchorOffset));
  const rowState = classifyRow(match, source, target, fieldRows, context);
  return Object.freeze({
    sourceUid: clean(match.sourceUid),
    targetUid: clean(match.targetUid),
    sourceStableKey: clean(match.sourceStableKey),
    targetStableKey: clean(match.targetStableKey),
    status: rowState.status,
    coordinateDeltaMm,
    identityConfidence: finite(match.identityConfidence, 0),
    transformBasis: clean(match.transformBasis),
    fieldRows: Object.freeze(fieldRows),
    diagnostics: Object.freeze(rowState.diagnostics),
  });
}

function classifyRow(match, source, target, fieldRows, context) {
  const diagnostics = [];
  const status = rowStatus(match, source, target, fieldRows, context, diagnostics);
  return { status, diagnostics };
}

function rowStatus(match, source, target, fieldRows, context, diagnostics) {
  if (!source || !target) return pushStatus(diagnostics, 'ANCHOR_MISSING', 'Approved match record is missing in source or target records.', match);
  if (context.targetClaims.get(clean(match.targetUid)) > 1) return pushStatus(diagnostics, 'DUPLICATE_TARGET_CLAIM', 'Multiple source records claim the same target record.', match);
  if (!coordinateFrameComparable(source) || !coordinateFrameComparable(target)) return pushStatus(diagnostics, 'COORDINATE_FRAME_NOT_COMPARABLE', 'Coordinate frame is not comparable for engineering delta.', match);
  if (context.approvedMatchSet.transformPolicy?.blockFreeAxisPermutation && match.transformBasis === 'free-axis-permutation' && !context.approvedMatchSet.transformPolicy?.approved) return pushStatus(diagnostics, 'TRANSFORM_NOT_APPROVED', 'Free axis/sign transform requires explicit approval before validation/transfer.', match);
  if (finite(match.identityConfidence, 0) < context.identityConfidenceThreshold) return pushStatus(diagnostics, 'IDENTITY_LOW_CONFIDENCE', 'Stable identity confidence is below policy.', match);
  return fieldRows.some((row) => row.status !== 'OK') ? 'MISMATCH' : 'OK';
}

function pushStatus(diagnostics, status, message, match) {
  diagnostics.push(diagnostic('BLOCKER', status, message, { sourceUid: match.sourceUid, targetUid: match.targetUid }));
  return status;
}

function summarizeRows(rows, blockerCount) {
  return Object.freeze({
    rowCount: rows.length,
    okCount: rows.filter((row) => row.status === 'OK').length,
    mismatchCount: rows.filter((row) => row.status !== 'OK').length,
    duplicateTargetClaimCount: rows.filter((row) => row.status === 'DUPLICATE_TARGET_CLAIM').length,
    blockerCount,
  });
}

export function createValidationAuditV2({ validationModel = null, approvedMatchSet = null } = {}) {
  return Object.freeze({
    schema: VALIDATION_AUDIT_V2_SCHEMA,
    approvedMatchSetHash: stableHash(approvedMatchSet || {}),
    validationModelHash: stableHash(validationModel || {}),
    mode: clean(validationModel?.mode),
    transformUsed: Object.freeze({ ...(validationModel?.transformUsed || {}) }),
    numericTolerancePolicy: Object.freeze({ ...(validationModel?.numericTolerancePolicy || {}) }),
    rows: cloneArray(validationModel?.rows || []),
    diagnostics: cloneArray(validationModel?.diagnostics || []),
    summary: Object.freeze({ ...(validationModel?.summary || {}) }),
  });
}

export const _testValidationModels = Object.freeze({
  fieldValidationRows,
  coordinateFrameComparable,
  toleranceForField,
});
