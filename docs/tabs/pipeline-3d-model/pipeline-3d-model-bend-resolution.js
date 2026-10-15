import { resolveSharedBendSegmentFeasibility } from './pipeline-3d-model-bend-feasibility.js';
import { bendDiagnostic } from './pipeline-3d-model-bend-screening.js?v=20260721-bend-policy-v3-1';
import { assignBendCurvatureNodes } from './pipeline-3d-model-bend-resolution-nodes.js?v=20260721-bend-policy-v3-1';
import {
  bendCandidateDiagnostic,
  bendCandidateStatus,
} from './pipeline-3d-model-bend-resolution-status.js?v=20260721-bend-policy-v3-1';

function collectDiagnostics(candidates, shared, screening) {
  const warnings = [...screening.warnings];
  const errors = [];
  const { settings } = screening;
  if (settings.enabled && settings.emitToInputXml) {
    errors.push(...shared.failures.map((failure) => bendDiagnostic(
      'BLOCKING',
      'BEND_SHARED_SEGMENT_INFEASIBLE',
      `The straight from node ${failure.fromNode} to ${failure.toNode} is too short for adjacent bends.`,
      failure,
    )));
    if (settings.designBasis === 'gre' && !candidates.length) {
      errors.push(bendDiagnostic('BLOCKING', 'GRE_BEND_POLICY_NOT_IMPLEMENTED', 'GRE bend policy is not implemented; InputXML emission is blocked.'));
    }
  }
  for (const candidate of candidates) {
    const item = bendCandidateDiagnostic(candidate, settings);
    if (item?.severity === 'BLOCKING') errors.push(item);
    else if (item) warnings.push(item);
    if (settings.enabled && candidate.geometryFits && !candidate.preferredStraightFits) {
      warnings.push(bendDiagnostic('WARNING', 'bend_preferred_tangent_not_met', `Node ${candidate.cornerNode} fits mandatory geometry but not the preferred tangent.`, candidate));
    }
  }
  return { warnings, errors };
}

export function resolveBendCandidateSet(rawCandidates, rows, screening) {
  const shared = resolveSharedBendSegmentFeasibility(rawCandidates);
  const statusCandidates = shared.candidates.map((candidate) => ({
    ...candidate,
    status: bendCandidateStatus(candidate, screening.settings),
    curvatureNodes: [],
  }));
  const candidates = assignBendCurvatureNodes(statusCandidates, rows, screening.settings);
  const emitted = candidates.filter((candidate) => candidate.status === 'EMITTED');
  const messages = collectDiagnostics(candidates, shared, screening);
  if (emitted.length) {
    messages.warnings.push(bendDiagnostic(
      'WARNING',
      'bend_screening_only',
      `${emitted.length} bend(s) resolved; combined-load review remains external.`,
      { emittedCount: emitted.length },
    ));
  }
  const ignored = new Set(candidates.flatMap((candidate) => candidate.ignoredSegmentIndexes));
  return Object.freeze({
    candidates: Object.freeze(candidates),
    emitted: Object.freeze(emitted),
    shared,
    warnings: Object.freeze(messages.warnings),
    errors: Object.freeze(messages.errors),
    ignoredShortSegmentCount: ignored.size,
  });
}
