import { stableToken } from '../sequential-sketcher-contract.js';
import {
  compileComponentStrokes,
  resolveComponentTraversal,
  reversibleComponentEntryPorts,
} from '../stroke/sequential-component-stroke-compiler.js';
import {
  CONNECTION_STATUSES,
  CONSTRUCTION_STATES,
  DECISION_ACTIONS,
  freezeConstructionSession,
} from './sequential-construction-contract.js';
import { sequentialSessionFingerprint } from './sequential-session-fingerprint.js';

function clonePoint(point) { return point ? Object.freeze({ ...point }) : null; }

function candidatePorts(candidate) {
  return Object.freeze({
    fromPortId: candidate?.fromPortId || candidate?.targetPortId || null,
    toPortId: candidate?.toPortId || candidate?.connectedPortId || null,
  });
}

function selectedCandidate(request, payload) {
  const candidates = request?.candidates || [];
  if (payload.candidateId) {
    const byId = candidates.find((row) => row.candidateId === payload.candidateId);
    if (byId) return byId;
  }
  return candidates.find((row) => {
    const ports = candidatePorts(row);
    return ports.fromPortId === payload.fromPortId && ports.toPortId === payload.toPortId;
  }) || null;
}

function resolvedDecision(request, action, payload, candidate = null, fingerprints = {}) {
  const ports = candidatePorts(candidate);
  return Object.freeze({
    ...request,
    state: 'RESOLVED',
    resolution: Object.freeze({
      action,
      selectedCandidateId: candidate?.candidateId || payload.candidateId || null,
      selectedFromPortId: payload.fromPortId || ports.fromPortId,
      selectedToPortId: payload.toPortId || ports.toPortId,
      confirmedBy: 'USER',
      provenance: 'USER_MANUAL',
      reason: String(payload.reason || '').trim(),
      evidenceNote: String(payload.evidenceNote || '').trim(),
      confirmedAt: new Date().toISOString(),
      previousConstructionFingerprint: fingerprints.previousConstructionFingerprint || null,
      resultingConstructionFingerprint: fingerprints.resultingConstructionFingerprint || null,
    }),
  });
}

function updateManualEvidence(previousSession, nextSession, request, payload, candidate) {
  const decisionIndex = (nextSession.decisionLedger || []).findLastIndex((row) => row.decisionId === request.decisionId);
  const previousConnections = previousSession.committedConnections?.length || 0;
  const connections = nextSession.committedConnections.map((connection, index) => (
    index < previousConnections
      ? connection
      : Object.freeze({
        ...connection,
        status: CONNECTION_STATUSES.USER_CONFIRMED,
        approvalProvenance: 'USER_MANUAL',
        approvalReason: String(payload.reason || '').trim(),
        approvalEvidenceNote: String(payload.evidenceNote || '').trim(),
        basis: Object.freeze([...new Set([...(connection.basis || []), 'USER_MANUAL'])]),
      })
  ));
  const previousConstructionFingerprint = sequentialSessionFingerprint(previousSession);
  const provisionalDecisions = [...(nextSession.decisionLedger || [])];
  if (decisionIndex >= 0) {
    provisionalDecisions[decisionIndex] = resolvedDecision(
      provisionalDecisions[decisionIndex],
      DECISION_ACTIONS.MANUAL_CONNECT,
      payload,
      candidate,
      { previousConstructionFingerprint },
    );
  }
  const provisional = freezeConstructionSession({
    ...nextSession,
    decisionLedger: provisionalDecisions,
    committedConnections: connections,
  });
  const resultingConstructionFingerprint = sequentialSessionFingerprint(provisional);
  const finalDecisions = [...provisionalDecisions];
  if (decisionIndex >= 0) {
    finalDecisions[decisionIndex] = resolvedDecision(
      provisionalDecisions[decisionIndex],
      DECISION_ACTIONS.MANUAL_CONNECT,
      payload,
      candidate,
      { previousConstructionFingerprint, resultingConstructionFingerprint },
    );
  }
  return freezeConstructionSession({
    ...provisional,
    decisionLedger: finalDecisions,
  });
}

export function applyManualConnectionDecision(
  session,
  evidenceModel,
  indexes,
  payload,
  options,
  delegateDecision,
) {
  const request = session?.currentDecisionRequest;
  if (session?.state !== CONSTRUCTION_STATES.USER_DECISION_REQUIRED || !request) {
    return Object.freeze({ session, outcome: 'NO_OPEN_DECISION' });
  }
  const reason = String(payload.reason || '').trim();
  const evidenceNote = String(payload.evidenceNote || '').trim();
  if (!reason || !evidenceNote) return Object.freeze({ session, outcome: 'MANUAL_EVIDENCE_REQUIRED' });
  const candidate = selectedCandidate(request, payload);
  if (!candidate) return Object.freeze({ session, outcome: 'MANUAL_PORT_PAIR_NOT_CANDIDATE' });
  const ports = candidatePorts(candidate);
  if (payload.fromPortId && payload.fromPortId !== ports.fromPortId) return Object.freeze({ session, outcome: 'MANUAL_PORT_PAIR_MISMATCH' });
  if (payload.toPortId && payload.toPortId !== ports.toPortId) return Object.freeze({ session, outcome: 'MANUAL_PORT_PAIR_MISMATCH' });
  const delegated = delegateDecision(
    session,
    evidenceModel,
    indexes,
    DECISION_ACTIONS.CONNECT,
    { candidateId: candidate.candidateId, reason },
    options,
  );
  if (delegated.session === session || ['CANDIDATE_NOT_FOUND', 'UNSUPPORTED_DECISION'].includes(delegated.outcome)) return delegated;
  return Object.freeze({
    ...delegated,
    session: updateManualEvidence(session, delegated.session, request, {
      ...payload,
      fromPortId: ports.fromPortId,
      toPortId: ports.toPortId,
    }, candidate),
    outcome: delegated.outcome === 'HEAD_BOUNDARY_USER_CONFIRMED'
      ? 'HEAD_BOUNDARY_USER_MANUAL_CONFIRMED'
      : 'USER_MANUAL_CONNECTION_COMMITTED',
  });
}

function requestComponent(session, indexes, request) {
  const componentId = request?.componentId || request?.startComponentId;
  if (componentId) return indexes.components.get(componentId) || null;
  const branch = indexes.branches.get(session.rootBranchId);
  return branch?.components?.[0] || null;
}

export function buildSequentialReversalCandidates(session, indexes) {
  const request = session?.currentDecisionRequest;
  if (!request || !['AMBIGUOUS_BRANCH_START', 'TEE_ENTERED_FROM_BRANCH', 'ENTRY_PORT_NOT_FOUND', 'EXIT_PORT_NOT_FOUND'].includes(request.reason)) {
    return Object.freeze([]);
  }
  const component = requestComponent(session, indexes, request);
  if (!component || session.confirmedComponentIds.includes(component.componentId)) return Object.freeze([]);
  return Object.freeze(reversibleComponentEntryPorts(component).map((port) => Object.freeze({
    candidateId: `REVERSE-${stableToken(`${component.componentId}|${port.portId}`)}`,
    componentId: component.componentId,
    sourceComponentId: component.sourceComponentId,
    branchId: component.branchId,
    entryPortId: port.portId,
    portRole: port.role,
    sourcePosition: clonePoint(port.sourcePosition),
  })));
}

function pendingJunction(component, traversal, session) {
  const port = traversal.pendingBranchPort;
  if (!port) return null;
  const expectedReference = port.referenceTarget || component.cref || '';
  return Object.freeze({
    junctionId: `JUNCTION-${stableToken(`${component.componentId}|${port.portId}`)}`,
    parentBranchId: component.branchId,
    parentComponentId: component.componentId,
    branchPortId: port.portId,
    branchPosition: clonePoint(port.sourcePosition) || clonePoint(component.geometry?.centre),
    expectedReference,
    expectedTargetBranchId: expectedReference,
    encounterOrder: session.pendingBranchJunctions.length + 1,
    status: expectedReference ? 'CONFIRMED_REFERENCE' : 'PENDING_USER_RESOLUTION',
  });
}

function traversalOverride(session, request, component, entryPortId, payload) {
  return Object.freeze({
    schema: 'SequentialComponentTraversalOverride.v1',
    overrideId: `TRAVERSAL-${stableToken(`${request.decisionId}|${component.componentId}|${entryPortId}`)}`,
    decisionId: request.decisionId,
    componentId: component.componentId,
    sourceComponentId: component.sourceComponentId,
    previousEntryPortId: request.entryPortId || session.startEntryPortId || null,
    entryPortId,
    provenance: 'USER_MANUAL',
    reason: String(payload.reason || '').trim(),
    evidenceNote: String(payload.evidenceNote || '').trim(),
    confirmedAt: new Date().toISOString(),
  });
}

function commitReversedComponent(session, indexes, request, component, entryPortId, payload) {
  const traversal = resolveComponentTraversal(component, entryPortId);
  if (!['RESOLVED', 'TERMINAL_COMPONENT'].includes(traversal.status)) {
    return Object.freeze({ session, outcome: 'REVERSAL_TRAVERSAL_UNRESOLVED' });
  }
  const branch = indexes.branches.get(session.rootBranchId);
  if (request.decisionScope === 'HEAD_BOUNDARY' && branch?.href) {
    return Object.freeze({ session, outcome: 'REVERSAL_REFERENCED_HEAD_REQUIRES_REVIEW' });
  }
  const override = traversalOverride(session, request, component, entryPortId, payload);
  const decision = resolvedDecision(request, DECISION_ACTIONS.REVERSE_COMPONENT, {
    ...payload,
    fromPortId: request.entryPortId || session.startEntryPortId || null,
    toPortId: entryPortId,
  }, null, {
    previousConstructionFingerprint: sequentialSessionFingerprint(session),
  });
  const junction = pendingJunction(component, traversal, session);
  const provisional = freezeConstructionSession({
    ...session,
    state: traversal.exit ? CONSTRUCTION_STATES.BUILDING : session.state,
    headBoundaryValidated: request.decisionScope === 'HEAD_BOUNDARY' ? true : session.headBoundaryValidated,
    startComponentId: request.decisionScope === 'HEAD_BOUNDARY' ? component.componentId : session.startComponentId,
    startEntryPortId: request.decisionScope === 'HEAD_BOUNDARY' ? entryPortId : session.startEntryPortId,
    activeBranchId: component.branchId,
    activeComponentId: component.componentId,
    activeEntryPortId: traversal.entry?.portId || null,
    activeExitPortId: traversal.exit?.portId || traversal.entry?.portId || null,
    activeSourceIndex: component.sourceIndex,
    confirmedComponentIds: [...session.confirmedComponentIds, component.componentId],
    pendingBranchJunctions: junction ? [...session.pendingBranchJunctions, junction] : session.pendingBranchJunctions,
    strokeLedger: [...session.strokeLedger, ...compileComponentStrokes(component, traversal)],
    decisionLedger: [...session.decisionLedger, decision],
    currentDecisionRequest: null,
    transitionContext: null,
    componentTraversalOverrides: [...session.componentTraversalOverrides, override],
    lastCommitBasis: 'USER_TRAVERSAL_OVERRIDE',
  });
  const resultingConstructionFingerprint = sequentialSessionFingerprint(provisional);
  const decisions = [...provisional.decisionLedger];
  decisions[decisions.length - 1] = resolvedDecision(
    request,
    DECISION_ACTIONS.REVERSE_COMPONENT,
    {
      ...payload,
      fromPortId: request.entryPortId || session.startEntryPortId || null,
      toPortId: entryPortId,
    },
    null,
    {
      previousConstructionFingerprint: sequentialSessionFingerprint(session),
      resultingConstructionFingerprint,
    },
  );
  return Object.freeze({
    session: freezeConstructionSession({ ...provisional, decisionLedger: decisions }),
    outcome: 'COMPONENT_TRAVERSAL_REVERSED',
  });
}

export function applyReverseComponentDecision(session, indexes, payload = {}) {
  const request = session?.currentDecisionRequest;
  if (session?.state !== CONSTRUCTION_STATES.USER_DECISION_REQUIRED || !request) {
    return Object.freeze({ session, outcome: 'NO_OPEN_DECISION' });
  }
  const reason = String(payload.reason || '').trim();
  if (!reason) return Object.freeze({ session, outcome: 'REVERSAL_REASON_REQUIRED' });
  const candidates = buildSequentialReversalCandidates(session, indexes);
  const selected = candidates.find((row) => (
    row.candidateId === payload.candidateId
    || (row.componentId === payload.componentId && row.entryPortId === payload.entryPortId)
  ));
  if (!selected) return Object.freeze({ session, outcome: 'REVERSAL_ENTRY_PORT_INVALID' });
  const component = indexes.components.get(selected.componentId);
  if (!component) return Object.freeze({ session, outcome: 'REVERSAL_COMPONENT_MISSING' });
  return commitReversedComponent(session, indexes, request, component, selected.entryPortId, payload);
}
