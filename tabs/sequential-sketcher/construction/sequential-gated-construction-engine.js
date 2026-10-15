import {
  advanceConstruction as advanceCoreConstruction,
  applyConstructionDecision as applyCoreConstructionDecision,
  createSequentialConstructionSession,
} from './sequential-construction-engine.js';
import {
  CONNECTION_STATUSES,
  CONSTRUCTION_STATES,
  DECISION_ACTIONS,
  freezeConstructionSession,
} from './sequential-construction-contract.js';
import { resolveBoundaryReference } from './sequential-boundary-resolver.js';
import { REFERENCE_TARGET_KINDS } from '../source/sequential-reference-resolver.js';
import { resolveSequentialConstructionTolerances } from '../policy/sequential-construction-tolerance-policy.js';

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function nextDecisionId(session) { return `DECISION-${String(session.decisionLedger.length + 1).padStart(5, '0')}`; }
function nextConnectionId(session) { return `CONNECTION-${String(session.committedConnections.length + 1).padStart(5, '0')}`; }
function nextRepairId(session) { return `REPAIR-${String(session.repairLedger.length + 1).padStart(5, '0')}`; }
function chooseStartEvidence(branch, options = {}) {
  const component = branch?.components?.[0];
  if (!component) return { status: 'FAILED', reason: 'BRANCH_HAS_NO_ROUTE_COMPONENTS' };
  const ports = component.ports.filter((port) => port.sourcePosition);
  if (!ports.length) return { status: 'FAILED', reason: 'FIRST_COMPONENT_HAS_NO_POSITIONED_PORT' };
  if (!branch.headPosition) return { status: 'RESOLVED', component, entryPort: ports[0] };
  const tolerances = resolveSequentialConstructionTolerances(options);
  const ranked = ports
    .map((port) => ({ port, gapMm: distance(branch.headPosition, port.sourcePosition) }))
    .sort((left, right) => left.gapMm - right.gapMm || left.port.portId.localeCompare(right.port.portId));
  if (ranked.length > 1 && Math.abs(ranked[0].gapMm - ranked[1].gapMm) <= tolerances.transformNoiseMm) {
    return {
      status: 'AMBIGUOUS',
      reason: 'AMBIGUOUS_BRANCH_START',
      candidates: ranked,
      transformNoiseMm: tolerances.transformNoiseMm,
      tolerancePolicyFingerprint: tolerances.policyFingerprint,
    };
  }
  return {
    status: 'RESOLVED',
    component,
    entryPort: ranked[0].port,
    gapMm: ranked[0].gapMm,
    transformNoiseMm: tolerances.transformNoiseMm,
    tolerancePolicyFingerprint: tolerances.policyFingerprint,
  };
}
function decisionRequest(session, reason, candidates, extra = {}) {
  return Object.freeze({
    schema: 'SequentialConnectionDecision.v1',
    decisionId: nextDecisionId(session),
    state: 'OPEN',
    reason,
    activePortId: null,
    candidates: Object.freeze([...(candidates || [])]),
    resolution: null,
    decisionScope: 'HEAD_BOUNDARY',
    ...extra,
  });
}
function blockHeadBoundary(session, reason, candidates, extra = {}) {
  return freezeConstructionSession({
    ...session,
    state: CONSTRUCTION_STATES.USER_DECISION_REQUIRED,
    currentDecisionRequest: decisionRequest(session, reason, candidates, extra),
  });
}
function connectionType(candidate) {
  if (candidate.referenceKind === REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT) return 'HEAD_BOUNDARY_TO_JUNCTION';
  if (candidate.referenceKind === REFERENCE_TARGET_KINDS.BRANCH) return 'HEAD_BRANCH_REFERENCE';
  return 'HEAD_BOUNDARY_TO_COMPONENT';
}
function commitHeadBoundary(session, branch, start, candidate, status, options = {}) {
  const tolerances = resolveSequentialConstructionTolerances(options);
  const connection = Object.freeze({
    connectionId: nextConnectionId(session),
    connectionType: connectionType(candidate),
    boundaryRole: 'HEAD',
    referenceTarget: candidate.referenceTarget,
    referenceKind: candidate.referenceKind,
    fromPortId: candidate.targetPortId,
    toPortId: candidate.connectedPortId,
    fromBranchId: candidate.targetBranchId,
    toBranchId: branch.branchId,
    targetComponentId: candidate.targetComponentId,
    targetSourceComponentId: candidate.targetSourceComponentId,
    targetPortRole: candidate.targetPortRole,
    fromPosition: candidate.targetPosition,
    toPosition: candidate.connectedPosition,
    fromSourcePosition: candidate.targetSourcePosition,
    toSourcePosition: candidate.connectedSourcePosition,
    fromPositionBasis: candidate.targetPositionBasis,
    toPositionBasis: candidate.connectedPositionBasis,
    branchBoundaryPosition: candidate.boundaryPosition,
    gapMm: candidate.totalGapMm,
    targetToBoundaryGapMm: candidate.targetToBoundaryGapMm,
    boundaryToFirstComponentGapMm: candidate.boundaryToConnectedGapMm,
    referenceBoundaryToleranceMm: tolerances.referenceBoundaryMm,
    branchEndpointToleranceMm: tolerances.branchEndpointMm,
    tolerancePolicyId: tolerances.policyId,
    tolerancePolicyRevision: tolerances.policyRevision,
    tolerancePolicyFingerprint: tolerances.policyFingerprint,
    derivedBranchLegLengthMm: candidate.derivedBranchLegLengthMm,
    status,
    basis: Object.freeze([
      'HEAD_REFERENCE',
      candidate.targetPositionBasis,
      candidate.connectedPositionBasis,
      'REFERENCE_BOUNDARY_EQUIVALENCE',
      'BRANCH_ENDPOINT_EQUIVALENCE',
    ]),
    approvedBy: status === CONNECTION_STATUSES.USER_CONFIRMED ? 'USER' : 'SYSTEM',
  });
  const strokeOp = candidate.referenceKind === REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT
    ? 'CONFIRM_HEAD_JUNCTION_BOUNDARY'
    : 'CONFIRM_HEAD_REFERENCE';
  let next = freezeConstructionSession({
    ...session,
    state: CONSTRUCTION_STATES.NOT_STARTED,
    headBoundaryValidated: true,
    headBoundaryConnectionId: connection.connectionId,
    startComponentId: start.component.componentId,
    startEntryPortId: start.entryPort.portId,
    committedConnections: [...session.committedConnections, connection],
    currentDecisionRequest: null,
    strokeLedger: [...session.strokeLedger, Object.freeze({
      op: strokeOp,
      connectionId: connection.connectionId,
      branchId: branch.branchId,
      referenceTarget: branch.href,
      targetBranchId: candidate.targetBranchId,
      targetComponentId: candidate.targetComponentId,
      targetPortRole: candidate.targetPortRole,
      tolerancePolicyFingerprint: tolerances.policyFingerprint,
    })],
  });
  const needsRepair = status === CONNECTION_STATUSES.AUTO_REPAIRED_SMALL_GAP || (
    status === CONNECTION_STATUSES.USER_CONFIRMED
    && (
      candidate.targetToBoundaryGapMm > tolerances.referenceBoundaryMm
      || candidate.boundaryToConnectedGapMm > tolerances.branchEndpointMm
    )
  );
  if (needsRepair) {
    const repair = Object.freeze({
      repairId: nextRepairId(session),
      connectionId: connection.connectionId,
      type: 'VIRTUAL_GAP_CLOSURE',
      boundaryRole: 'HEAD',
      fromPortId: connection.fromPortId,
      toPortId: connection.toPortId,
      sourceFromPosition: connection.fromSourcePosition,
      sourceToPosition: connection.toSourcePosition,
      resolvedFromPosition: connection.fromPosition,
      resolvedToPosition: connection.toPosition,
      gapMm: connection.gapMm,
      thresholdMm: tolerances.automaticRepairMm,
      repairPolicy: 'VIRTUAL_CONNECTOR',
      tolerancePolicyId: tolerances.policyId,
      tolerancePolicyRevision: tolerances.policyRevision,
      tolerancePolicyFingerprint: tolerances.policyFingerprint,
      approvedBy: connection.approvedBy,
    });
    next = freezeConstructionSession({
      ...next,
      repairLedger: [...next.repairLedger, repair],
      strokeLedger: [...next.strokeLedger, Object.freeze({
        op: 'DRAW_VIRTUAL_REPAIR',
        connectionId: connection.connectionId,
        fromPortId: connection.fromPortId,
        toPortId: connection.toPortId,
        fromPosition: connection.fromPosition,
        toPosition: connection.toPosition,
        gapMm: connection.gapMm,
        repairPolicy: repair.repairPolicy,
        tolerancePolicyFingerprint: tolerances.policyFingerprint,
      })],
    });
  }
  return next;
}
function validateHeadBoundary(session, indexes, options) {
  const branch = indexes.branches.get(session.rootBranchId);
  if (!branch) return { session: freezeConstructionSession({ ...session, state: CONSTRUCTION_STATES.FAILED, diagnostics: [...session.diagnostics, { severity: 'ERROR', code: 'ROOT_BRANCH_NOT_FOUND', branchId: session.rootBranchId }] }), outcome: 'FAILED' };
  const start = chooseStartEvidence(branch, options);
  if (start.status === 'FAILED') return { session: freezeConstructionSession({ ...session, state: CONSTRUCTION_STATES.FAILED, diagnostics: [...session.diagnostics, { severity: 'ERROR', code: start.reason, branchId: branch.branchId }] }), outcome: 'FAILED' };
  if (start.status === 'AMBIGUOUS') return { session: blockHeadBoundary(session, start.reason, [], { branchId: branch.branchId, transformNoiseMm: start.transformNoiseMm, tolerancePolicyFingerprint: start.tolerancePolicyFingerprint }), outcome: 'DECISION_REQUIRED' };
  if (!branch.href) {
    return {
      session: freezeConstructionSession({
        ...session,
        headBoundaryValidated: true,
        startComponentId: start.component.componentId,
        startEntryPortId: start.entryPort.portId,
      }),
      outcome: 'HEAD_BOUNDARY_NOT_REFERENCED',
    };
  }
  const resolution = resolveBoundaryReference({
    boundaryRole: 'HEAD',
    boundaryPosition: branch.headPosition || start.entryPort.sourcePosition,
    referenceValue: branch.href,
    connectedPort: start.entryPort,
    indexes,
    exactToleranceMm: options.exactToleranceMm,
    externalBoundaryExactToleranceMm: options.externalBoundaryExactToleranceMm,
    referenceBoundaryEquivalenceMm: options.referenceBoundaryEquivalenceMm,
    branchEndpointEquivalenceMm: options.branchEndpointEquivalenceMm,
    autoRepairToleranceMm: options.autoRepairToleranceMm,
  });
  if (resolution.status === 'CONFIRMED_REFERENCE') {
    return { session: commitHeadBoundary(session, branch, start, resolution.selected, CONNECTION_STATUSES.CONFIRMED_REFERENCE, options), outcome: 'HEAD_BOUNDARY_COMMITTED' };
  }
  if (resolution.status === 'AUTO_REPAIRED_SMALL_GAP') {
    return { session: commitHeadBoundary(session, branch, start, resolution.selected, CONNECTION_STATUSES.AUTO_REPAIRED_SMALL_GAP, options), outcome: 'HEAD_BOUNDARY_REPAIRED' };
  }
  return {
    session: blockHeadBoundary(session, resolution.reason, resolution.candidates, {
      branchId: branch.branchId,
      referenceTarget: branch.href,
      startComponentId: start.component.componentId,
      startEntryPortId: start.entryPort.portId,
      referenceBoundaryToleranceMm: resolution.referenceBoundaryToleranceMm,
      branchEndpointToleranceMm: resolution.branchEndpointToleranceMm,
      tolerancePolicyFingerprint: resolution.tolerancePolicyFingerprint,
    }),
    outcome: 'DECISION_REQUIRED',
  };
}

export { createSequentialConstructionSession };

export function advanceConstruction(session, evidenceModel, indexes, options = {}) {
  if (session.state === CONSTRUCTION_STATES.NOT_STARTED && !session.headBoundaryValidated) {
    return Object.freeze(validateHeadBoundary(session, indexes, options));
  }
  return advanceCoreConstruction(session, evidenceModel, indexes, options);
}

export function applyConstructionDecision(session, evidenceModel, indexes, action, payload = {}, options = {}) {
  const request = session.currentDecisionRequest;
  if (request?.decisionScope !== 'HEAD_BOUNDARY') {
    return applyCoreConstructionDecision(session, evidenceModel, indexes, action, payload, options);
  }
  const resolution = Object.freeze({
    action,
    selectedCandidateId: payload.candidateId || null,
    confirmedBy: 'USER',
    reason: String(payload.reason || '').trim(),
    confirmedAt: new Date().toISOString(),
  });
  const ledgerEntry = Object.freeze({ ...request, state: 'RESOLVED', resolution });
  const base = freezeConstructionSession({
    ...session,
    decisionLedger: [...session.decisionLedger, ledgerEntry],
    currentDecisionRequest: null,
  });
  const branch = indexes.branches.get(session.rootBranchId);
  const start = chooseStartEvidence(branch, options);
  if (action === DECISION_ACTIONS.CONNECT) {
    const candidate = request.candidates.find((row) => row.candidateId === payload.candidateId);
    if (!candidate || start.status !== 'RESOLVED') {
      return Object.freeze({ session: freezeConstructionSession({ ...session, currentDecisionRequest: request }), outcome: 'CANDIDATE_NOT_FOUND' });
    }
    return Object.freeze({
      session: commitHeadBoundary(base, branch, start, candidate, CONNECTION_STATUSES.USER_CONFIRMED, options),
      outcome: 'HEAD_BOUNDARY_USER_CONFIRMED',
    });
  }
  if (action === DECISION_ACTIONS.MARK_EXTERNAL_BOUNDARY || action === DECISION_ACTIONS.MARK_TERMINAL) {
    if (start.status !== 'RESOLVED') return Object.freeze({ session, outcome: 'START_EVIDENCE_UNRESOLVED' });
    return Object.freeze({
      session: freezeConstructionSession({
        ...base,
        state: CONSTRUCTION_STATES.NOT_STARTED,
        headBoundaryValidated: true,
        startComponentId: start.component.componentId,
        startEntryPortId: start.entryPort.portId,
        strokeLedger: [...base.strokeLedger, Object.freeze({
          op: 'CONFIRM_HEAD_EXTERNAL_BOUNDARY',
          branchId: branch.branchId,
          referenceTarget: branch.href,
          approvedBy: 'USER',
        })],
      }),
      outcome: 'HEAD_BOUNDARY_USER_CLASSIFIED',
    });
  }
  if (action === DECISION_ACTIONS.REJECT_CANDIDATE) {
    const remaining = request.candidates.filter((row) => row.candidateId !== payload.candidateId);
    return Object.freeze({
      session: freezeConstructionSession({
        ...session,
        decisionLedger: [...session.decisionLedger, ledgerEntry],
        currentDecisionRequest: decisionRequest(session, remaining.length ? request.reason : 'HEAD_REFERENCE_CANDIDATES_REJECTED', remaining, {
          branchId: request.branchId,
          referenceTarget: request.referenceTarget,
          startComponentId: request.startComponentId,
          startEntryPortId: request.startEntryPortId,
        }),
      }),
      outcome: 'CANDIDATE_REJECTED',
    });
  }
  return Object.freeze({ session, outcome: 'UNSUPPORTED_DECISION' });
}

export function runConstructionUntilBlocked(session, evidenceModel, indexes, options = {}, maxSteps = 10000) {
  let current = session;
  const outcomes = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const result = advanceConstruction(current, evidenceModel, indexes, options);
    current = result.session;
    outcomes.push(result.outcome);
    if (['DECISION_REQUIRED', 'ROUTE_COMPLETE', 'FAILED'].includes(result.outcome)
      || current.state === CONSTRUCTION_STATES.USER_DECISION_REQUIRED
      || current.state === CONSTRUCTION_STATES.ROUTE_COMPLETE
      || current.state === CONSTRUCTION_STATES.FAILED) break;
  }
  return Object.freeze({ session: current, outcomes: Object.freeze(outcomes) });
}
