import { stableToken } from '../sequential-sketcher-contract.js';
import { resolveSequentialConstructionTolerances } from '../policy/sequential-construction-tolerance-policy.js';
import {
  advanceConstruction as advanceBaseConstruction,
  applyConstructionDecision as applyBaseConstructionDecision,
  createSequentialConstructionSession,
} from './sequential-gated-construction-engine.js';
import {
  BOUNDARY_REFERENCE_CLASSIFICATIONS,
  classifySequentialBoundaryReference,
} from './sequential-boundary-reference-classifier.js';
import { DECISION_ACTIONS, freezeConstructionSession } from './sequential-construction-contract.js';
import { sequentialSessionFingerprint } from './sequential-session-fingerprint.js';

function clonePoint(value) { return value ? Object.freeze({ x: value.x, y: value.y, z: value.z }) : null; }
function distance(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function sourceBoundaryRequest(session, indexes) {
  const request = session?.currentDecisionRequest;
  if (session?.state !== 'USER_DECISION_REQUIRED' || request?.reason !== 'REFERENCE_TARGET_MISSING') return null;
  const headBoundary = request.decisionScope === 'HEAD_BOUNDARY';
  if (!headBoundary && request.junctionId) return null;
  const branch = indexes.branches.get(headBoundary ? session.rootBranchId : session.activeBranchId);
  if (!branch) return null;
  const rawReference = headBoundary ? branch.href : branch.tref;
  if (!rawReference || rawReference !== request.referenceTarget) return null;
  const boundaryRole = headBoundary ? 'HEAD' : 'TAIL';
  const classification = classifySequentialBoundaryReference(rawReference, boundaryRole);
  if (classification.status === BOUNDARY_REFERENCE_CLASSIFICATIONS.UNCLASSIFIED) return null;
  return { request, branch, boundaryRole, classification };
}

function positionEvidence(session, source, indexes, options) {
  const activePortId = source.boundaryRole === 'HEAD'
    ? source.request.startEntryPortId || null
    : session.activeExitPortId || null;
  const activePort = indexes.ports.get(activePortId);
  const activePosition = clonePoint(activePort?.sourcePosition);
  const boundaryPosition = clonePoint(source.boundaryRole === 'HEAD'
    ? source.branch.headPosition
    : source.branch.tailPosition);
  const tolerances = resolveSequentialConstructionTolerances(options);
  const toleranceMm = tolerances.referenceBoundaryMm;
  const gapMm = distance(activePosition, boundaryPosition);
  let status = 'POSITION_CONFIRMED';
  let reason = null;
  if (!activePort || !activePosition) {
    status = 'ACTIVE_ENDPOINT_MISSING';
    reason = 'EXTERNAL_BOUNDARY_ACTIVE_ENDPOINT_MISSING';
  } else if (!boundaryPosition) {
    status = 'BOUNDARY_POSITION_MISSING';
    reason = 'EXTERNAL_BOUNDARY_POSITION_MISSING';
  } else if (gapMm > toleranceMm) {
    status = 'POSITION_MISMATCH';
    reason = 'EXTERNAL_BOUNDARY_POSITION_MISMATCH';
  }
  return Object.freeze({
    activePortId,
    activePosition,
    boundaryPosition,
    toleranceMm,
    toleranceEvidenceType: 'REFERENCE_BOUNDARY_EQUIVALENCE',
    tolerances,
    gapMm: Number.isFinite(gapMm) ? gapMm : null,
    status,
    reason,
  });
}

function retainBlockedClassification(session, source, position, reason) {
  const evidence = Object.freeze({
    ...source.classification,
    activePortId: position.activePortId,
    activePosition: position.activePosition,
    boundaryPosition: position.boundaryPosition,
    positionGapMm: position.gapMm,
    exactBoundaryToleranceMm: position.toleranceMm,
    toleranceEvidenceType: position.toleranceEvidenceType,
    tolerancePolicySchema: position.tolerances.policySchema,
    tolerancePolicyId: position.tolerances.policyId,
    tolerancePolicyRevision: position.tolerances.policyRevision,
    tolerancePolicyFingerprint: position.tolerances.policyFingerprint,
    positionStatus: position.status,
  });
  const request = Object.freeze({
    ...source.request,
    reason,
    externalReferenceClassification: evidence,
  });
  const diagnostic = Object.freeze({
    severity: 'WARNING',
    code: reason,
    branchId: source.branch.branchId,
    boundaryRole: source.boundaryRole,
    rawReference: source.classification.rawReference,
    classificationStatus: source.classification.status,
    patternId: source.classification.patternId,
    policyId: source.classification.policyId,
    policyRevision: source.classification.policyRevision,
    policyFingerprint: source.classification.policyFingerprint,
    toleranceEvidenceType: position.toleranceEvidenceType,
    tolerancePolicyId: position.tolerances.policyId,
    tolerancePolicyRevision: position.tolerances.policyRevision,
    tolerancePolicyFingerprint: position.tolerances.policyFingerprint,
    positionGapMm: position.gapMm,
    exactBoundaryToleranceMm: position.toleranceMm,
  });
  return Object.freeze({
    session: freezeConstructionSession({
      ...session,
      currentDecisionRequest: request,
      diagnostics: [...session.diagnostics, diagnostic],
    }),
    outcome: 'DECISION_REQUIRED',
  });
}

function classificationRecord(session, acceptedSession, source, position) {
  const previousConstructionFingerprint = sequentialSessionFingerprint(session);
  const stable = {
    schema: 'SequentialBoundaryClassification.v2',
    classificationId: `BOUNDARY-${stableToken(`${source.branch.branchId}|${source.boundaryRole}|${source.classification.normalizedReference}`)}`,
    boundaryRole: source.boundaryRole,
    branchId: source.branch.branchId,
    activePortId: position.activePortId,
    rawReference: source.classification.rawReference,
    normalizedReference: source.classification.normalizedReference,
    normalizationOperations: source.classification.normalizationOperations,
    classification: source.classification.status,
    dialect: source.classification.dialect,
    patternId: source.classification.patternId,
    policySchema: source.classification.policySchema,
    policyId: source.classification.policyId,
    policyRevision: source.classification.policyRevision,
    policyDialect: source.classification.policyDialect,
    policyFingerprint: source.classification.policyFingerprint,
    basis: source.classification.basis,
    confidence: source.classification.confidence,
    sourcePosition: position.activePosition,
    boundaryPosition: position.boundaryPosition,
    resolvedPosition: position.activePosition,
    positionGapMm: position.gapMm,
    exactBoundaryToleranceMm: position.toleranceMm,
    toleranceEvidenceType: position.toleranceEvidenceType,
    tolerancePolicySchema: position.tolerances.policySchema,
    tolerancePolicyId: position.tolerances.policyId,
    tolerancePolicyRevision: position.tolerances.policyRevision,
    tolerancePolicyFingerprint: position.tolerances.policyFingerprint,
    positionStatus: position.status,
    approvalSource: 'SOURCE_PHYSICAL_BOUNDARY_EVIDENCE',
    previousConstructionFingerprint,
  };
  const provisional = freezeConstructionSession({
    ...acceptedSession,
    boundaryClassifications: [...(acceptedSession.boundaryClassifications || []), Object.freeze(stable)],
  });
  return Object.freeze({
    ...stable,
    resultingConstructionFingerprint: sequentialSessionFingerprint(provisional),
  });
}

function acceptSourceBoundary(session, evidenceModel, indexes, options, source, position) {
  const accepted = applyBaseConstructionDecision(
    session,
    evidenceModel,
    indexes,
    DECISION_ACTIONS.MARK_EXTERNAL_BOUNDARY,
    { reason: `Confirmed physical boundary: ${source.classification.dialect}` },
    options,
  );
  if (accepted.session === session) return accepted;
  const retainedDecisions = accepted.session.decisionLedger.slice(0, session.decisionLedger.length);
  const base = freezeConstructionSession({ ...accepted.session, decisionLedger: retainedDecisions });
  const record = classificationRecord(session, base, source, position);
  const next = freezeConstructionSession({
    ...base,
    boundaryClassifications: [...(base.boundaryClassifications || []), record],
    strokeLedger: [...base.strokeLedger, Object.freeze({
      op: 'CONFIRM_SOURCE_EXTERNAL_BOUNDARY',
      classificationId: record.classificationId,
      branchId: record.branchId,
      boundaryRole: record.boundaryRole,
      referenceTarget: record.rawReference,
      dialect: record.dialect,
      patternId: record.patternId,
      policyId: record.policyId,
      policyRevision: record.policyRevision,
      policyFingerprint: record.policyFingerprint,
      toleranceEvidenceType: record.toleranceEvidenceType,
      tolerancePolicyId: record.tolerancePolicyId,
      tolerancePolicyRevision: record.tolerancePolicyRevision,
      tolerancePolicyFingerprint: record.tolerancePolicyFingerprint,
      positionGapMm: record.positionGapMm,
      exactBoundaryToleranceMm: record.exactBoundaryToleranceMm,
      approvedBy: record.approvalSource,
    })],
  });
  return Object.freeze({ session: next, outcome: 'SOURCE_EXTERNAL_BOUNDARY_CONFIRMED' });
}

function selectedCandidate(request, payload) {
  return (request?.candidates || []).find((candidate) => candidate.candidateId === payload?.candidateId) || null;
}

function enhanceUserDecision(previousSession, result, action, payload) {
  if ((result.session?.decisionLedger?.length || 0) <= (previousSession?.decisionLedger?.length || 0)) return result;
  const index = result.session.decisionLedger.length - 1;
  const decision = result.session.decisionLedger[index];
  const candidate = selectedCandidate(previousSession.currentDecisionRequest, payload);
  const previousConstructionFingerprint = sequentialSessionFingerprint(previousSession);
  const resultingConstructionFingerprint = sequentialSessionFingerprint(result.session);
  const enhanced = Object.freeze({
    ...decision,
    activePortId: decision.activePortId || previousSession.activeExitPortId || null,
    candidatePortIds: Object.freeze((decision.candidates || []).map((row) => (
      row.toPortId || row.targetPortId || row.connectedPortId || null
    )).filter(Boolean)),
    sourceEvidence: Object.freeze({
      reason: decision.reason,
      referenceTarget: decision.referenceTarget || previousSession.transitionContext?.referenceTarget || null,
      activeBranchId: previousSession.activeBranchId || null,
      activeComponentId: previousSession.activeComponentId || null,
    }),
    resolvedCoordinates: candidate ? Object.freeze({
      fromPosition: clonePoint(candidate.fromPosition || candidate.targetPosition),
      toPosition: clonePoint(candidate.toPosition || candidate.connectedPosition),
    }) : null,
    resolution: Object.freeze({
      ...decision.resolution,
      action,
      provenance: 'USER_MANUAL',
      previousConstructionFingerprint,
      resultingConstructionFingerprint,
    }),
  });
  const decisions = [...result.session.decisionLedger];
  decisions[index] = enhanced;
  return Object.freeze({
    ...result,
    session: freezeConstructionSession({ ...result.session, decisionLedger: decisions }),
  });
}

export { createSequentialConstructionSession };

export function advanceConstruction(session, evidenceModel, indexes, options = {}) {
  const result = advanceBaseConstruction(session, evidenceModel, indexes, options);
  const source = sourceBoundaryRequest(result.session, indexes);
  if (!source) return result;
  const position = positionEvidence(result.session, source, indexes, options);
  if (source.classification.status !== BOUNDARY_REFERENCE_CLASSIFICATIONS.EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED) {
    return retainBlockedClassification(result.session, source, position, 'EXTERNAL_REFERENCE_CLASSIFIED');
  }
  if (position.status !== 'POSITION_CONFIRMED') {
    return retainBlockedClassification(result.session, source, position, position.reason);
  }
  return acceptSourceBoundary(result.session, evidenceModel, indexes, options, source, position);
}

export function applyConstructionDecision(session, evidenceModel, indexes, action, payload = {}, options = {}) {
  const result = applyBaseConstructionDecision(session, evidenceModel, indexes, action, payload, options);
  return enhanceUserDecision(session, result, action, payload);
}
