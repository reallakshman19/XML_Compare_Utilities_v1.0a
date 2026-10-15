import { stableToken } from '../sequential-sketcher-contract.js';

function pointEvidence(point) {
  return point ? [point.x, point.y, point.z] : null;
}

function decisionEvidence(decision) {
  return [
    decision.decisionId,
    decision.reason,
    decision.state,
    decision.resolution?.action || null,
    decision.resolution?.selectedCandidateId || null,
    decision.resolution?.selectedFromPortId || null,
    decision.resolution?.selectedToPortId || null,
    decision.resolution?.evidenceNote || null,
  ];
}

function openDecisionEvidence(decision) {
  if (!decision) return null;
  return [
    decision.decisionId,
    decision.reason,
    decision.state,
    decision.activePortId || null,
    (decision.candidates || []).map((row) => [
      row.candidateId || null,
      row.fromPortId || row.connectedPortId || null,
      row.toPortId || row.targetPortId || row.entryPortId || null,
    ]),
    decision.deferral?.reason || null,
    decision.deferral?.evidenceNote || null,
  ];
}

function transitionEvidence(transition) {
  if (!transition) return null;
  return [
    transition.referenceTarget || null,
    transition.targetKind || null,
    transition.targetBranchId || null,
    transition.targetComponentId || null,
    transition.targetSourceComponentId || null,
    [...(transition.targetPortRoles || [])],
    transition.targetBoundaryRole || null,
    pointEvidence(transition.boundaryPosition),
    transition.boundaryPositionBasis || null,
    transition.junctionId || null,
    transition.origin || null,
  ];
}

function junctionEvidence(junction) {
  return [
    junction.junctionId,
    junction.parentBranchId,
    junction.parentComponentId,
    junction.branchPortId,
    pointEvidence(junction.branchPosition),
    junction.expectedReference || null,
    junction.expectedTargetBranchId || null,
    junction.encounterOrder ?? null,
    junction.status || null,
  ];
}

function strokeEvidence(stroke) {
  return [
    stroke.op,
    stroke.componentId || null,
    stroke.sourceComponentId || null,
    stroke.connectionId || null,
    stroke.branchId || null,
    stroke.fromPortId || null,
    stroke.toPortId || null,
    stroke.entryPortId || null,
    stroke.exitPortId || null,
    stroke.branchPortId || null,
    pointEvidence(stroke.fromPosition),
    pointEvidence(stroke.toPosition),
    pointEvidence(stroke.entryPosition),
    pointEvidence(stroke.exitPosition),
    pointEvidence(stroke.branchPosition),
    stroke.gapMm ?? null,
    stroke.repairPolicy || null,
  ];
}

function boundaryEvidence(classification) {
  return [
    classification.classificationId,
    classification.boundaryRole,
    classification.branchId,
    classification.rawReference,
    classification.normalizedReference,
    classification.classification,
    classification.dialect,
    classification.patternId,
    classification.policySchema,
    classification.policyId,
    classification.policyRevision,
    classification.policyDialect,
    classification.policyFingerprint,
    classification.confidence,
    [...(classification.basis || [])],
    classification.activePortId,
    classification.positionStatus,
    classification.positionGapMm,
    classification.exactBoundaryToleranceMm,
    classification.toleranceEvidenceType,
    classification.tolerancePolicySchema,
    classification.tolerancePolicyId,
    classification.tolerancePolicyRevision,
    classification.tolerancePolicyFingerprint,
  ];
}

export function sequentialSessionFingerprint(session) {
  const evidence = {
    rootBranchId: session?.rootBranchId || null,
    state: session?.state || null,
    headBoundaryValidated: Boolean(session?.headBoundaryValidated),
    headBoundaryConnectionId: session?.headBoundaryConnectionId || null,
    activeBranchId: session?.activeBranchId || null,
    activeComponentId: session?.activeComponentId || null,
    activeEntryPortId: session?.activeEntryPortId || null,
    activePortId: session?.activeExitPortId || null,
    activeComponentOrderIndex: session?.activeComponentOrderIndex ?? null,
    activeSourceIndex: session?.activeSourceIndex ?? null,
    startComponentId: session?.startComponentId || null,
    startEntryPortId: session?.startEntryPortId || null,
    transitionContext: transitionEvidence(session?.transitionContext),
    lastCommitBasis: session?.lastCommitBasis || null,
    confirmedComponentIds: [...(session?.confirmedComponentIds || [])],
    connections: (session?.committedConnections || []).map((connection) => [
      connection.connectionId,
      connection.fromPortId,
      connection.toPortId,
      connection.status,
      connection.approvalProvenance || null,
      connection.approvalReason || null,
      connection.approvalEvidenceNote || null,
    ]),
    repairs: (session?.repairLedger || []).map((repair) => [
      repair.repairId,
      repair.connectionId,
      repair.gapMm,
      repair.approvedBy,
    ]),
    decisions: (session?.decisionLedger || []).map(decisionEvidence),
    openDecision: openDecisionEvidence(session?.currentDecisionRequest),
    deferredDecisionIds: [...(session?.deferredDecisionIds || [])],
    componentTraversalOverrides: (session?.componentTraversalOverrides || []).map((row) => [
      row.overrideId,
      row.componentId,
      row.previousEntryPortId || null,
      row.entryPortId,
      row.decisionId || null,
      row.provenance || null,
    ]),
    pendingBranchJunctions: (session?.pendingBranchJunctions || []).map(junctionEvidence),
    rejectedCandidateIds: [...(session?.rejectedCandidateIds || [])],
    strokes: (session?.strokeLedger || []).map(strokeEvidence),
    boundaryClassifications: (session?.boundaryClassifications || []).map(boundaryEvidence),
    completedBranchIds: [...(session?.completedBranchIds || [])],
  };
  return stableToken(JSON.stringify(evidence));
}
