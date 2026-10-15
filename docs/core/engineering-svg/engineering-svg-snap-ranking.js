import {
  ENGINEERING_SNAP_CANDIDATE_SCHEMA,
  createEngineeringGeometryConstraint,
  createEngineeringSnapEvidence,
} from '../engineering-scene/index.js';

function finiteNonNegative(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new TypeError(`${label} must be non-negative and finite.`);
  return result;
}

function compareCandidates(left, right) {
  return left.priority - right.priority
    || left.screenDistance - right.screenDistance
    || left.mode.localeCompare(right.mode)
    || left.providerId.localeCompare(right.providerId)
    || left.id.localeCompare(right.id);
}

function candidateExcluded(candidate, excluded) {
  return candidate.sourceEntityIds.some((id) => excluded.has(id));
}

function constraintCompatible(candidate, constraint) {
  if (constraint.kind === 'axis') {
    return ['X', 'Y', 'Z'].every((axis) => (
      !candidate.lockedAxes[axis.toLowerCase()] || axis === constraint.axis
    ));
  }
  if (constraint.kind === 'plane') {
    return ['X', 'Y', 'Z'].every((axis) => (
      !candidate.lockedAxes[axis.toLowerCase()] || constraint.axes.includes(axis)
    ));
  }
  if (!candidate.compatibleConstraintKinds.includes(constraint.kind)) return false;
  return candidate.compatibleReferenceIds.length === 0
    || candidate.compatibleReferenceIds.includes(constraint.referenceId);
}

function pointsNear(left, right, screenTolerance, worldTolerance) {
  return Math.abs(left.screenPoint.x - right.screenPoint.x) <= screenTolerance
    && Math.abs(left.screenPoint.y - right.screenPoint.y) <= screenTolerance
    && Math.abs(left.worldPoint.x - right.worldPoint.x) <= worldTolerance
    && Math.abs(left.worldPoint.y - right.worldPoint.y) <= worldTolerance
    && Math.abs(left.worldPoint.z - right.worldPoint.z) <= worldTolerance;
}

function sameLocks(left, right) {
  return left.lockedAxes.x === right.lockedAxes.x
    && left.lockedAxes.y === right.lockedAxes.y
    && left.lockedAxes.z === right.lockedAxes.z;
}

function deduplicate(candidates, screenTolerance, worldTolerance) {
  const unique = [];
  for (const candidate of candidates) {
    const duplicate = unique.some((existing) => (
      sameLocks(existing, candidate)
      && pointsNear(existing, candidate, screenTolerance, worldTolerance)
    ));
    if (!duplicate) unique.push(candidate);
  }
  return unique;
}

function providerCounts(candidates) {
  return Object.fromEntries([...new Set(candidates.map((candidate) => candidate.providerId))]
    .sort()
    .map((providerId) => [providerId, candidates.filter((candidate) => candidate.providerId === providerId).length]));
}

function assertCandidates(candidates) {
  candidates.forEach((candidate, index) => {
    if (candidate?.schema !== ENGINEERING_SNAP_CANDIDATE_SCHEMA) {
      throw new TypeError(`candidates[${index}] must use EngineeringSnapCandidate.v1.`);
    }
  });
  const ids = candidates.map((candidate) => candidate.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Snap candidate IDs must be globally unique.');
}

export function rankEngineeringSvgSnapCandidates(candidates = [], options = {}) {
  if (!Array.isArray(candidates)) throw new TypeError('Snap candidates must be an array.');
  assertCandidates(candidates);
  const aperture = finiteNonNegative(options.aperture, 'Snap aperture');
  if (!aperture) throw new TypeError('Snap aperture must be positive.');
  const screenTolerance = finiteNonNegative(options.screenTolerance ?? 0, 'Screen tolerance');
  const worldTolerance = finiteNonNegative(options.worldTolerance ?? 0, 'World tolerance');
  const enabledModes = new Set(options.enabledModes || candidates.map((candidate) => candidate.mode));
  const excluded = new Set((options.excludeSourceEntityIds || []).map(String));
  const constraint = createEngineeringGeometryConstraint(options.constraint);
  const compatible = candidates.filter((candidate) => (
    enabledModes.has(candidate.mode)
    && !candidateExcluded(candidate, excluded)
    && constraintCompatible(candidate, constraint)
  ));
  const inAperture = compatible
    .filter((candidate) => candidate.screenDistance <= aperture)
    .sort(compareCandidates);
  const unique = deduplicate(inAperture, screenTolerance, worldTolerance);
  const candidate = unique[0] || null;
  return Object.freeze({
    candidate,
    candidates: Object.freeze(unique),
    evidence: createEngineeringSnapEvidence({
      considered: candidates.length,
      compatible: compatible.length,
      inAperture: inAperture.length,
      deduplicated: inAperture.length - unique.length,
      winnerId: candidate?.id || null,
      orderedIds: unique.map((value) => value.id),
      providerCounts: options.providerCounts || providerCounts(candidates),
      providerErrors: options.providerErrors || [],
    }),
  });
}
