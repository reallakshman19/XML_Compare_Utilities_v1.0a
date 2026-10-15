const EPSILON_MM = 1e-6;

function requiredSide(candidate) {
  return Number(candidate?.tangentMm || 0) + Number(candidate?.retainedStraightAllowanceMm || 0);
}

function freezeCandidate(candidate) {
  return Object.freeze({
    ...candidate,
    geometryFits: Boolean(candidate.localGeometryFits && candidate.sharedSegmentFits),
  });
}

export function resolveSharedBendSegmentFeasibility(candidates = []) {
  const resolved = candidates.map((candidate) => ({
    ...candidate,
    sharedSegmentFits: true,
    sharedIncomingRequiredMm: null,
    sharedOutgoingRequiredMm: null,
  }));
  const failures = [];
  for (let index = 0; index < resolved.length - 1; index += 1) {
    const left = resolved[index];
    const right = resolved[index + 1];
    if (left.outgoingElementIndex !== right.incomingElementIndex) continue;
    const availableLengthMm = Number(left.outgoingLengthMm || 0);
    const requiredLengthMm = requiredSide(left) + requiredSide(right);
    const fits = availableLengthMm + EPSILON_MM >= requiredLengthMm;
    left.sharedOutgoingRequiredMm = requiredLengthMm;
    right.sharedIncomingRequiredMm = requiredLengthMm;
    left.sharedSegmentFits = left.sharedSegmentFits && fits;
    right.sharedSegmentFits = right.sharedSegmentFits && fits;
    if (!fits) {
      failures.push(Object.freeze({
        segmentIndex: left.outgoingElementIndex,
        fromNode: left.cornerNode,
        toNode: right.cornerNode,
        availableLengthMm,
        requiredLengthMm,
        leftTangentMm: left.tangentMm,
        rightTangentMm: right.tangentMm,
        leftRetainedStraightMm: left.retainedStraightAllowanceMm,
        rightRetainedStraightMm: right.retainedStraightAllowanceMm,
      }));
    }
  }
  return Object.freeze({
    candidates: Object.freeze(resolved.map(freezeCandidate)),
    failures: Object.freeze(failures),
  });
}
