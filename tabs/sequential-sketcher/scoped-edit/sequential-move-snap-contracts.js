/** Immutable contracts and numeric profile for explicit Sequential move snap evidence. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';

export const SEQUENTIAL_MOVE_SNAP_PROFILE_SCHEMA = 'SequentialMoveSnapProfile.v1';
export const SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA = 'SequentialMoveSnapAcquisition.v1';
export const SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA = 'SequentialMoveSnapSelection.v1';

export const SEQUENTIAL_MOVE_SNAP_MODE = Object.freeze({
  ENDPOINT: 'endpoint',
  MIDPOINT: 'midpoint',
  CENTERLINE: 'sequential:centerline',
  AXIS_X: 'sequential:axis-x',
  AXIS_Y: 'sequential:axis-y',
  AXIS_Z: 'sequential:axis-z',
  GRID: 'sequential:grid',
  INTERSECTION: 'intersection',
});

export const SEQUENTIAL_MOVE_SNAP_REJECTION = Object.freeze({
  PROFILE_INVALID: 'SEQUENTIAL_MOVE_SNAP_PROFILE_INVALID',
  ACQUISITION_STALE: 'SEQUENTIAL_MOVE_SNAP_ACQUISITION_STALE',
  CANDIDATE_MISSING: 'SEQUENTIAL_MOVE_SNAP_CANDIDATE_MISSING',
  CANDIDATE_TAMPERED: 'SEQUENTIAL_MOVE_SNAP_CANDIDATE_TAMPERED',
  INTERSECTION_ENVELOPE: 'SEQUENTIAL_MOVE_SNAP_INTERSECTION_ENVELOPE_EXCEEDED',
  SEGMENT_ENVELOPE: 'SEQUENTIAL_MOVE_SNAP_SEGMENT_ENVELOPE_EXCEEDED',
  ZERO_LENGTH_SEGMENT: 'SEQUENTIAL_MOVE_SNAP_ZERO_LENGTH_SEGMENT',
});

const MODES = new Set(Object.values(SEQUENTIAL_MOVE_SNAP_MODE));
const AXES = Object.freeze(['x', 'y', 'z']);

function fail(code, message, Constructor = TypeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}

function finite(value, label, minimum = -Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) {
    fail(SEQUENTIAL_MOVE_SNAP_REJECTION.PROFILE_INVALID,
      `${label} must be finite and at least ${minimum}.`);
  }
  return number;
}

export function sequentialSnapPoint(value, label = 'Snap point') {
  return Object.fromEntries(AXES.map((axis) => [axis, finite(value?.[axis], `${label} ${axis}`)]));
}

function integer(value, label, minimum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    fail(SEQUENTIAL_MOVE_SNAP_REJECTION.PROFILE_INVALID,
      `${label} must be an integer of at least ${minimum}.`);
  }
  return number;
}

function enabledModes(values) {
  if (!Array.isArray(values) || !values.length) {
    fail(SEQUENTIAL_MOVE_SNAP_REJECTION.PROFILE_INVALID,
      'Snap enabledModes must contain at least one explicit mode.');
  }
  const modes = [...new Set(values.map((value) => String(value).trim().toLowerCase()))].sort();
  modes.forEach((mode) => {
    if (!MODES.has(mode)) fail(SEQUENTIAL_MOVE_SNAP_REJECTION.PROFILE_INVALID,
      `Unsupported Sequential move snap mode: ${mode}`);
  });
  return modes;
}

function gridProfile(value = {}) {
  const enabled = value.enabled === true;
  const origin = sequentialSnapPoint(value.origin || { x: 0, y: 0, z: 0 }, 'Grid origin');
  const spacing = enabled ? finite(value.spacing, 'Grid spacing', Number.MIN_VALUE) : null;
  return { enabled, spacing, origin };
}

export function createSequentialMoveSnapProfile(input = {}) {
  const material = {
    enabledModes: enabledModes(input.enabledModes),
    aperturePx: finite(input.aperturePx, 'Snap aperture', Number.MIN_VALUE),
    screenTolerancePx: finite(input.screenTolerancePx ?? 0.25, 'Screen tolerance', 0),
    worldTolerance: finite(input.worldTolerance ?? 1e-9, 'World tolerance', 0),
    precisionDigits: integer(input.precisionDigits ?? 12, 'Snap precision digits', 0),
    maxSegments: integer(input.maxSegments ?? 2000, 'Maximum snap segments', 1),
    maxIntersectionPairs: integer(input.maxIntersectionPairs ?? 50000,
      'Maximum intersection pairs', 1),
    grid: gridProfile(input.grid),
  };
  return immutableJson({
    schema: SEQUENTIAL_MOVE_SNAP_PROFILE_SCHEMA,
    ...material,
    profileFingerprint: sequentialSemanticFingerprint('SSK3MSNAPPROFILE', material),
  }, 'Sequential move snap profile');
}

export function normalizeSequentialSnapNumber(value, profile) {
  const number = finite(value, 'Snap number');
  const digits = createSequentialMoveSnapProfile(profile).precisionDigits;
  const normalized = Number(number.toFixed(digits));
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function normalizeSequentialSnapPoint(value, profile) {
  const point = sequentialSnapPoint(value);
  return Object.fromEntries(AXES.map((axis) => [
    axis, normalizeSequentialSnapNumber(point[axis], profile),
  ]));
}

export function sequentialMoveSnapCandidateId(material) {
  return sequentialSemanticFingerprint('SSK3MSNAPCANDIDATE', material);
}

function assertCandidate(candidate, label = 'Snap candidate') {
  if (candidate?.schema !== 'EngineeringSnapCandidate.v1') {
    throw new TypeError(`${label} must use EngineeringSnapCandidate.v1.`);
  }
  return candidate;
}

export function createSequentialMoveSnapAcquisition(input = {}) {
  const profile = createSequentialMoveSnapProfile(input.profile);
  const candidates = (input.candidates || []).map((row, index) => (
    assertCandidate(row, `candidates[${index}]`)
  ));
  const ids = candidates.map((row) => row.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Snap candidate IDs must be unique.');
  const suggestedCandidateId = input.suggestedCandidateId == null
    ? null : String(input.suggestedCandidateId);
  if (suggestedCandidateId && !ids.includes(suggestedCandidateId)) {
    throw new RangeError('Suggested snap candidate must exist in the ordered candidate list.');
  }
  const material = {
    targetId: String(input.targetId),
    topologyFingerprint: String(input.topologyFingerprint),
    geometryFingerprint: String(input.geometryFingerprint),
    sceneRevision: input.sceneRevision,
    constraint: input.constraint,
    rawWorldPoint: normalizeSequentialSnapPoint(input.rawWorldPoint, profile),
    rawScreenPoint: { x: finite(input.rawScreenPoint?.x, 'Raw screen x'),
      y: finite(input.rawScreenPoint?.y, 'Raw screen y') },
    profile,
    candidates,
    suggestedCandidateId,
    rankingEvidence: input.rankingEvidence,
    derivationEvidence: input.derivationEvidence,
  };
  return immutableJson({
    schema: SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA,
    ...material,
    selectedCandidateId: null,
    acquisitionFingerprint: sequentialSemanticFingerprint('SSK3MSNAPACQUISITION', material),
  }, 'Sequential move snap acquisition');
}

export function createSequentialMoveSnapSelection(input = {}) {
  if (input.acquisition?.schema !== SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA) {
    throw new TypeError(`Snap selection requires ${SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA}.`);
  }
  const candidateId = String(input.candidateId || '').trim();
  const candidate = input.acquisition.candidates.find((row) => row.id === candidateId);
  if (!candidate) fail(SEQUENTIAL_MOVE_SNAP_REJECTION.CANDIDATE_MISSING,
    `Snap candidate was not found: ${candidateId}`, RangeError);
  const material = {
    acquisitionFingerprint: input.acquisition.acquisitionFingerprint,
    candidate,
  };
  return immutableJson({
    schema: SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA,
    ...material,
    selectionFingerprint: sequentialSemanticFingerprint('SSK3MSNAPSELECTION', material),
  }, 'Sequential move snap selection');
}

export function assertSequentialMoveSnapSelection(value) {
  if (value?.schema !== SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA) {
    throw new TypeError(`Snap selection must use ${SEQUENTIAL_MOVE_SNAP_SELECTION_SCHEMA}.`);
  }
  assertCandidate(value.candidate, 'Snap selection candidate');
  const expected = sequentialSemanticFingerprint('SSK3MSNAPSELECTION', {
    acquisitionFingerprint: value.acquisitionFingerprint,
    candidate: value.candidate,
  });
  if (value.selectionFingerprint !== expected) {
    fail(SEQUENTIAL_MOVE_SNAP_REJECTION.CANDIDATE_TAMPERED,
      'Snap selection fingerprint does not match its candidate evidence.', RangeError);
  }
  return value;
}
