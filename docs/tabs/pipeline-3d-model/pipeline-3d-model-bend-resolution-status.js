import { bendDiagnostic } from './pipeline-3d-model-bend-screening.js?v=20260721-bend-policy-v3-1';

export function bendCandidateStatus(candidate, settings) {
  if (!settings.enabled) return 'DISABLED';
  if (candidate.turnAngleDeg > settings.maximumTurnAngleDeg) return 'ANGLE_EXCLUDED';
  if (candidate.bendClass === 'gre-placeholder') return 'GRE_POLICY_PLACEHOLDER';
  if (!candidate.ownershipResolved) return 'SHORT_ELEMENT_OWNERSHIP_REVIEW';
  if (!candidate.radiusMm) return 'UNRESOLVED';
  if (!candidate.policyReady) return 'CODE_DATA_REVIEW';
  if (settings.diameterSource === 'branch-diameter' && !settings.diameterBasisConfirmed) return 'DIAMETER_REVIEW';
  if (candidate.qualificationRequired) return 'QUALIFICATION_REVIEW';
  if (!candidate.geometryFits) return 'INFEASIBLE';
  if (settings.emitToInputXml && !settings.screeningOnlyAcknowledged) return 'REVIEW_REQUIRED';
  return settings.emitToInputXml ? 'EMITTED' : 'READY_NOT_EMITTED';
}

export function bendCandidateDiagnostic(candidate, settings) {
  if (!settings.enabled || !settings.emitToInputXml) return null;
  if (candidate.status === 'GRE_POLICY_PLACEHOLDER') {
    return bendDiagnostic('BLOCKING', 'GRE_BEND_POLICY_NOT_IMPLEMENTED', 'GRE bend policy is not implemented; InputXML bend emission is blocked.', candidate);
  }
  if (candidate.status === 'SHORT_ELEMENT_OWNERSHIP_REVIEW') {
    return bendDiagnostic('BLOCKING', 'SHORT_ELEMENT_BEND_OWNERSHIP_UNRESOLVED', 'Short-element filtering found a turn but could not prove one authoritative bend-owning node.', candidate);
  }
  if (candidate.status === 'INFEASIBLE' && !candidate.localGeometryFits) {
    return bendDiagnostic('BLOCKING', 'BEND_GEOMETRY_INFEASIBLE', `Node ${candidate.cornerNode} cannot fit the resolved radius plus retained-straight allowance.`, candidate);
  }
  if (candidate.status === 'QUALIFICATION_REVIEW') {
    return bendDiagnostic('BLOCKING', 'COLD_FIELD_BEND_QUALIFICATION_REQUIRED', `Node ${candidate.cornerNode} requests a qualified radius without eligible evidence.`, candidate);
  }
  if (candidate.status === 'ANGLE_EXCLUDED') {
    return bendDiagnostic('WARNING', 'bend_angle_excluded', `Node ${candidate.cornerNode} exceeds the configured turn-angle limit; BEND output was omitted.`, candidate);
  }
  if (['UNRESOLVED', 'CODE_DATA_REVIEW', 'DIAMETER_REVIEW', 'REVIEW_REQUIRED'].includes(candidate.status)) {
    return bendDiagnostic('WARNING', 'bend_inputxml_omitted', `Node ${candidate.cornerNode} status ${candidate.status}; BEND output was omitted.`, candidate);
  }
  return null;
}
