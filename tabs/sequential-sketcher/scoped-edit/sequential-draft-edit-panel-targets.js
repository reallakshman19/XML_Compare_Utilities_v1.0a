/** Exact target and request authority for the Draft Edit panel; no gateway access. */
import { isIsoTimestamp } from '../../../contracts/contract-values.js';
import { projectSequentialReversalCandidates } from '../sequential-engineering-svg-reversal-scene.js';

export const SEQUENTIAL_DRAFT_EDIT_CANDIDATE_COMMANDS = new Set([
  'CONNECT_CANDIDATE', 'MANUAL_CONNECT', 'REJECT_CANDIDATE',
]);
export const SEQUENTIAL_DRAFT_EDIT_BOUNDARY_COMMANDS = new Set([
  'MARK_TERMINAL', 'MARK_EXTERNAL_BOUNDARY',
]);
export const SEQUENTIAL_DRAFT_EDIT_REVERSAL_COMMANDS = new Set(['REVERSE_COMPONENT']);

const EVIDENCE_POLICY = Object.freeze({
  CONNECT_CANDIDATE: Object.freeze({ reason: true, evidence: true }),
  MANUAL_CONNECT: Object.freeze({ reason: true, evidence: true }),
  REJECT_CANDIDATE: Object.freeze({ reason: true, evidence: true }),
  MARK_TERMINAL: Object.freeze({ reason: true, evidence: true }),
  MARK_EXTERNAL_BOUNDARY: Object.freeze({ reason: true, evidence: true }),
  REVERSE_COMPONENT: Object.freeze({ reason: true, evidence: true }),
  DEFER_DECISION: Object.freeze({ reason: true, evidence: true }),
  RESUME_DECISION: Object.freeze({ reason: true, evidence: false }),
  UNDO_LAST_TRANSACTION: Object.freeze({ reason: true, evidence: true }),
  REDO_LAST_TRANSACTION: Object.freeze({ reason: true, evidence: true }),
});

function text(value) { return String(value ?? '').trim(); }
function exactIssuedAt(now) {
  const value = now();
  if (!isIsoTimestamp(value)) {
    throw new TypeError('Draft Edit command issuedAt provider must return an exact ISO timestamp.');
  }
  return value;
}
function evidenceValues(state) {
  return Object.freeze({
    actorId: text(state.elements.actor.value),
    reason: text(state.elements.reason.value),
    evidenceNote: text(state.elements.evidence.value),
  });
}
function validateEvidence(commandType, values) {
  if (!values.actorId) throw new TypeError('Operator actor ID is required.');
  const policy = EVIDENCE_POLICY[commandType] || {};
  if (policy.reason && !values.reason) throw new TypeError(`${commandType} requires an operator reason.`);
  if (policy.evidence && !values.evidenceNote) throw new TypeError(`${commandType} requires an evidence note.`);
  return values;
}

export function exactSequentialDraftEditCandidateTarget(state) {
  const target = state.candidateTarget;
  const request = state.current?.session?.currentDecisionRequest;
  if (!target || !request || state.current.session.state !== 'USER_DECISION_REQUIRED'
    || request.state === 'DEFERRED' || target.authorityId !== state.currentAuthorityId
    || target.branchId !== state.current.session.rootBranchId
    || target.decisionId !== request.decisionId
    || !(request.candidates || []).some((row) => row.candidateId === target.candidateId)) return null;
  return target;
}
export function currentSequentialDraftEditCandidate(state) {
  const target = exactSequentialDraftEditCandidateTarget(state);
  return target ? (state.current.session.currentDecisionRequest.candidates || [])
    .find((row) => row.candidateId === target.candidateId) || null : null;
}
function candidatePort(candidate, key, fallback) { return text(candidate?.[key] || candidate?.[fallback]); }
export function exactSequentialDraftEditManualPorts(state) {
  const candidate = currentSequentialDraftEditCandidate(state);
  const fromPortId = candidatePort(candidate, 'fromPortId', 'targetPortId');
  const toPortId = candidatePort(candidate, 'toPortId', 'connectedPortId');
  const ports = state.current?.indexes?.ports;
  if (!fromPortId || !toPortId || fromPortId === toPortId || !(ports instanceof Map)
    || !ports.has(fromPortId) || !ports.has(toPortId)) return null;
  return Object.freeze({ fromPortId, toPortId });
}
export function exactSequentialDraftEditDecisionTarget(state) {
  const target = state.decisionTarget;
  const request = state.current?.session?.currentDecisionRequest;
  if (!target || !request || state.current.session.state !== 'USER_DECISION_REQUIRED'
    || target.authorityId !== state.currentAuthorityId
    || target.branchId !== state.current.session.rootBranchId
    || target.decisionId !== request.decisionId || target.reason !== request.reason
    || request.state === 'DEFERRED' || (request.candidates || []).length) return null;
  return target;
}
export function exactSequentialDraftEditReversalTarget(state) {
  const target = state.reversalTarget;
  const request = state.current?.session?.currentDecisionRequest;
  const indexes = state.current?.indexes;
  if (!target || !request || state.current.session.state !== 'USER_DECISION_REQUIRED'
    || request.state === 'DEFERRED' || target.authorityId !== state.currentAuthorityId
    || target.branchId !== state.current.session.rootBranchId
    || target.decisionId !== request.decisionId
    || !(indexes?.components instanceof Map) || !(indexes?.ports instanceof Map)) return null;
  const candidate = projectSequentialReversalCandidates(state.current.session, indexes)
    .find((row) => row.candidateId === target.candidateId);
  if (!candidate || candidate.componentId !== target.componentId
    || candidate.entryPortId !== target.entryPortId
    || indexes.ports.get(target.entryPortId)?.componentId !== target.componentId) return null;
  return target;
}
export function sequentialDraftEditTargetFor(state, commandType) {
  if (SEQUENTIAL_DRAFT_EDIT_CANDIDATE_COMMANDS.has(commandType)) {
    return exactSequentialDraftEditCandidateTarget(state);
  }
  if (SEQUENTIAL_DRAFT_EDIT_BOUNDARY_COMMANDS.has(commandType)) {
    return exactSequentialDraftEditDecisionTarget(state);
  }
  if (SEQUENTIAL_DRAFT_EDIT_REVERSAL_COMMANDS.has(commandType)) {
    return exactSequentialDraftEditReversalTarget(state);
  }
  return null;
}
export function sequentialDraftEditCommandRequiresTarget(commandType) {
  return SEQUENTIAL_DRAFT_EDIT_CANDIDATE_COMMANDS.has(commandType)
    || SEQUENTIAL_DRAFT_EDIT_BOUNDARY_COMMANDS.has(commandType)
    || SEQUENTIAL_DRAFT_EDIT_REVERSAL_COMMANDS.has(commandType);
}
export function isSequentialDraftEditCommandMeaningful(state, commandType) {
  const session = state.current?.session;
  if (!session) return false;
  const request = session.currentDecisionRequest;
  if (commandType === 'MANUAL_CONNECT') {
    return Boolean(exactSequentialDraftEditManualPorts(state) && request?.state !== 'DEFERRED');
  }
  if (sequentialDraftEditCommandRequiresTarget(commandType)) {
    return Boolean(sequentialDraftEditTargetFor(state, commandType));
  }
  if (commandType === 'DEFER_DECISION') {
    return Boolean(session.state === 'USER_DECISION_REQUIRED' && request && request.state !== 'DEFERRED');
  }
  if (commandType === 'RESUME_DECISION') {
    return session.state === 'USER_DECISION_REQUIRED' && request?.state === 'DEFERRED';
  }
  if (commandType === 'UNDO_LAST_TRANSACTION') return Boolean(session.undoStack?.length);
  if (commandType === 'REDO_LAST_TRANSACTION') return Boolean(session.redoStack?.length);
  return !['USER_DECISION_REQUIRED', 'ROUTE_COMPLETE', 'FAILED'].includes(session.state);
}

export function createSequentialDraftEditCommandRequest(state, commandType) {
  const values = validateEvidence(commandType, evidenceValues(state));
  const branchId = text(state.gatewayState?.branchId);
  if (!branchId) throw new RangeError('Draft Edit command branch authority is unavailable.');
  const target = sequentialDraftEditTargetFor(state, commandType);
  if (sequentialDraftEditCommandRequiresTarget(commandType) && !target) {
    throw new RangeError(`${commandType} requires one exact current target.`);
  }
  const manualPorts = commandType === 'MANUAL_CONNECT'
    ? exactSequentialDraftEditManualPorts(state) : null;
  if (commandType === 'MANUAL_CONNECT' && !manualPorts) {
    throw new RangeError('MANUAL_CONNECT requires one exact current indexed candidate port pair.');
  }
  return Object.freeze({
    command: Object.freeze({
      commandType, branchId, decisionId: target?.decisionId || null,
      candidateId: target?.candidateId || null, componentId: target?.componentId || null,
      entryPortId: target?.entryPortId || null, fromPortId: manualPorts?.fromPortId || null,
      toPortId: manualPorts?.toPortId || null,
      payload: Object.freeze({
        reason: values.reason, evidenceNote: values.evidenceNote,
        targetEntityId: target?.entityId || null,
        targetSelectionId: target?.targetSelectionId || null,
        decisionTargetId: target?.decisionTargetId || null,
        reversalTargetId: target?.reversalTargetId || null,
        targetDecisionReason: target?.reason || null,
        targetDecisionScope: target?.decisionScope || null,
        targetActivePortId: target?.activePortId || null,
        targetJunctionId: target?.junctionId || null,
        targetReference: target?.referenceTarget || null,
      }),
    }),
    origin: Object.freeze({ kind: 'USER', actorId: values.actorId, issuedAt: exactIssuedAt(state.now) }),
  });
}