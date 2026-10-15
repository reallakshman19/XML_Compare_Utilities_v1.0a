import { isIsoTimestamp } from '../../../contracts/contract-values.js';
import { stableToken } from '../sequential-sketcher-contract.js';
import { SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY } from '../policy/sequential-external-boundary-policy.js';
import { SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY } from '../policy/sequential-construction-tolerance-policy.js';
import {
  CONSTRUCTION_STATES,
  freezeConstructionSession,
} from './sequential-construction-contract.js';
import { sequentialSessionFingerprint } from './sequential-session-fingerprint.js';

export const SEQUENTIAL_CONSTRUCTION_TRANSACTION_SCHEMA = 'SequentialConstructionTransaction.v1';

function requiredOperationTime(value, label) {
  if (!isIsoTimestamp(value)) throw new TypeError(`${label} must be an exact ISO timestamp.`);
  return value;
}
function nextTransactionId(session, action, beforeFingerprint, afterFingerprint) {
  const sequence = (session?.transactionLedger?.length || 0) + 1;
  const token = stableToken(`${sequence}|${action}|${beforeFingerprint}|${afterFingerprint}`);
  return `TXN-${String(sequence).padStart(5, '0')}-${token}`;
}
function withoutHistory(session) {
  const { transactionLedger, undoStack, redoStack, ...snapshot } = session || {};
  return Object.freeze(snapshot);
}
function addedValues(beforeRows = [], afterRows = [], identity) {
  const before = new Set(beforeRows.map(identity));
  return Object.freeze(afterRows.filter((row) => !before.has(identity(row))).map(identity));
}
function affectedEvidence(previousSession, nextSession, payload = {}) {
  const addedConnections = addedValues(
    previousSession?.committedConnections,
    nextSession?.committedConnections,
    (row) => row.connectionId,
  );
  const addedComponents = addedValues(
    previousSession?.confirmedComponentIds,
    nextSession?.confirmedComponentIds,
    (row) => row,
  );
  const ports = new Set([payload.fromPortId, payload.toPortId, payload.entryPortId].filter(Boolean));
  for (const connection of nextSession?.committedConnections || []) {
    if (!addedConnections.includes(connection.connectionId)) continue;
    if (connection.fromPortId) ports.add(connection.fromPortId);
    if (connection.toPortId) ports.add(connection.toPortId);
  }
  return Object.freeze({
    componentIds: addedComponents,
    connectionIds: addedConnections,
    portIds: Object.freeze([...ports]),
  });
}
function transactionRecord(previousSession, nextSession, context = {}) {
  const beforeFingerprint = sequentialSessionFingerprint(previousSession);
  const afterFingerprint = sequentialSessionFingerprint(nextSession);
  const action = String(context.action || 'UNKNOWN_TRANSACTION');
  return Object.freeze({
    schema: SEQUENTIAL_CONSTRUCTION_TRANSACTION_SCHEMA,
    transactionId: nextTransactionId(previousSession, action, beforeFingerprint, afterFingerprint),
    status: 'COMMITTED',
    action,
    outcome: String(context.outcome || 'NO_OUTCOME'),
    actorProvenance: String(context.actorProvenance || 'USER_COMMAND'),
    reason: String(context.reason || '').trim(),
    evidenceNote: String(context.evidenceNote || '').trim(),
    decisionId: context.decisionId
      || previousSession?.currentDecisionRequest?.decisionId
      || nextSession?.decisionLedger?.at(-1)?.decisionId
      || null,
    affected: affectedEvidence(previousSession, nextSession, context.payload || {}),
    beforeState: previousSession?.state || null,
    afterState: nextSession?.state || null,
    beforeFingerprint,
    afterFingerprint,
    externalBoundaryPolicyFingerprint: SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint,
    tolerancePolicyFingerprint: SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint,
    createdAt: requiredOperationTime(context.createdAt, 'Sequential transaction createdAt'),
  });
}

export function recordSequentialConstructionTransaction(previousSession, result, context = {}) {
  const nextSession = result?.session || previousSession;
  const beforeFingerprint = sequentialSessionFingerprint(previousSession);
  const afterFingerprint = sequentialSessionFingerprint(nextSession);
  if (beforeFingerprint === afterFingerprint && !context.recordNoChange) return result;
  const record = transactionRecord(previousSession, nextSession, {
    ...context,
    outcome: context.outcome || result?.outcome,
  });
  const undoEntry = Object.freeze({
    schema: 'SequentialConstructionUndoEntry.v1',
    transactionId: record.transactionId,
    action: record.action,
    beforeFingerprint: record.beforeFingerprint,
    afterFingerprint: record.afterFingerprint,
    beforeSnapshot: withoutHistory(previousSession),
    afterSnapshot: withoutHistory(nextSession),
  });
  return Object.freeze({
    ...result,
    session: freezeConstructionSession({
      ...nextSession,
      transactionLedger: [...(previousSession?.transactionLedger || []), record],
      undoStack: context.undoable === false
        ? [...(previousSession?.undoStack || [])]
        : [...(previousSession?.undoStack || []), undoEntry],
      redoStack: [],
    }),
  });
}

export function deferSequentialConstructionDecision(session, payload = {}) {
  const request = session?.currentDecisionRequest;
  if (session?.state !== CONSTRUCTION_STATES.USER_DECISION_REQUIRED || !request) {
    return Object.freeze({ session, outcome: 'NO_OPEN_DECISION' });
  }
  if (request.state === 'DEFERRED') return Object.freeze({ session, outcome: 'DECISION_ALREADY_DEFERRED' });
  const reason = String(payload.reason || '').trim();
  const evidenceNote = String(payload.evidenceNote || '').trim();
  const deferred = Object.freeze({
    ...request,
    state: 'DEFERRED',
    deferral: Object.freeze({
      provenance: 'USER_MANUAL',
      reason,
      evidenceNote,
      deferredAt: requiredOperationTime(payload.issuedAt, 'Sequential decision deferredAt'),
    }),
  });
  return Object.freeze({
    session: freezeConstructionSession({
      ...session,
      currentDecisionRequest: deferred,
      deferredDecisionIds: [...new Set([...(session.deferredDecisionIds || []), request.decisionId])],
    }),
    outcome: 'DECISION_DEFERRED',
  });
}

export function resumeSequentialConstructionDecision(session, payload = {}) {
  const request = session?.currentDecisionRequest;
  if (session?.state !== CONSTRUCTION_STATES.USER_DECISION_REQUIRED || !request) {
    return Object.freeze({ session, outcome: 'NO_OPEN_DECISION' });
  }
  if (request.state !== 'DEFERRED') return Object.freeze({ session, outcome: 'DECISION_NOT_DEFERRED' });
  return Object.freeze({
    session: freezeConstructionSession({
      ...session,
      currentDecisionRequest: Object.freeze({
        ...request,
        state: 'OPEN',
        resumedAt: requiredOperationTime(payload.issuedAt, 'Sequential decision resumedAt'),
      }),
      deferredDecisionIds: (session.deferredDecisionIds || []).filter((id) => id !== request.decisionId),
    }),
    outcome: 'DECISION_RESUMED',
  });
}

export function undoLastSequentialConstructionTransaction(session, payload = {}) {
  const undoStack = [...(session?.undoStack || [])];
  const undone = undoStack.pop();
  if (!undone) return Object.freeze({ session, outcome: 'NOTHING_TO_UNDO' });
  const restoredSnapshot = undone.beforeSnapshot;
  const beforeFingerprint = sequentialSessionFingerprint(session);
  const afterFingerprint = sequentialSessionFingerprint(restoredSnapshot);
  const action = 'UNDO_LAST_TRANSACTION';
  const record = Object.freeze({
    schema: SEQUENTIAL_CONSTRUCTION_TRANSACTION_SCHEMA,
    transactionId: nextTransactionId(session, action, beforeFingerprint, afterFingerprint),
    status: 'COMMITTED',
    action,
    outcome: 'TRANSACTION_UNDONE',
    actorProvenance: 'USER_MANUAL',
    reason: String(payload.reason || '').trim(),
    evidenceNote: String(payload.evidenceNote || '').trim(),
    decisionId: restoredSnapshot?.currentDecisionRequest?.decisionId || null,
    affected: Object.freeze({ componentIds: Object.freeze([]), connectionIds: Object.freeze([]), portIds: Object.freeze([]) }),
    beforeState: session?.state || null,
    afterState: restoredSnapshot?.state || null,
    beforeFingerprint,
    afterFingerprint,
    undoneTransactionId: undone.transactionId,
    externalBoundaryPolicyFingerprint: SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint,
    tolerancePolicyFingerprint: SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint,
    createdAt: requiredOperationTime(payload.issuedAt, 'Sequential undo createdAt'),
  });
  return Object.freeze({
    session: freezeConstructionSession({
      ...restoredSnapshot,
      transactionLedger: [...(session.transactionLedger || []), record],
      undoStack,
      redoStack: [...(session.redoStack || []), undone],
    }),
    outcome: 'TRANSACTION_UNDONE',
  });
}

export function redoLastSequentialConstructionTransaction(session, payload = {}) {
  const redoStack = [...(session?.redoStack || [])];
  const redone = redoStack.pop();
  if (!redone) return Object.freeze({ session, outcome: 'NOTHING_TO_REDO' });
  const currentFingerprint = sequentialSessionFingerprint(session);
  if (currentFingerprint !== redone.beforeFingerprint) {
    return Object.freeze({ session, outcome: 'REDO_STATE_MISMATCH' });
  }
  const restoredSnapshot = redone.afterSnapshot;
  const afterFingerprint = sequentialSessionFingerprint(restoredSnapshot);
  if (afterFingerprint !== redone.afterFingerprint) {
    return Object.freeze({ session, outcome: 'REDO_SNAPSHOT_MISMATCH' });
  }
  const action = 'REDO_LAST_TRANSACTION';
  const record = Object.freeze({
    schema: SEQUENTIAL_CONSTRUCTION_TRANSACTION_SCHEMA,
    transactionId: nextTransactionId(session, action, currentFingerprint, afterFingerprint),
    status: 'COMMITTED',
    action,
    outcome: 'TRANSACTION_REDONE',
    actorProvenance: 'USER_MANUAL',
    reason: String(payload.reason || '').trim(),
    evidenceNote: String(payload.evidenceNote || '').trim(),
    decisionId: restoredSnapshot?.currentDecisionRequest?.decisionId || null,
    affected: Object.freeze({ componentIds: Object.freeze([]), connectionIds: Object.freeze([]), portIds: Object.freeze([]) }),
    beforeState: session?.state || null,
    afterState: restoredSnapshot?.state || null,
    beforeFingerprint: currentFingerprint,
    afterFingerprint,
    redoneTransactionId: redone.transactionId,
    externalBoundaryPolicyFingerprint: SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint,
    tolerancePolicyFingerprint: SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint,
    createdAt: requiredOperationTime(payload.issuedAt, 'Sequential redo createdAt'),
  });
  return Object.freeze({
    session: freezeConstructionSession({
      ...restoredSnapshot,
      transactionLedger: [...(session.transactionLedger || []), record],
      undoStack: [...(session.undoStack || []), redone],
      redoStack,
    }),
    outcome: 'TRANSACTION_REDONE',
  });
}
