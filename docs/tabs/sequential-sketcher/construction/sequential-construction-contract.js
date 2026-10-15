export const CONSTRUCTION_STATES = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  BUILDING: 'BUILDING',
  USER_DECISION_REQUIRED: 'USER_DECISION_REQUIRED',
  BRANCH_TRANSITION_PENDING: 'BRANCH_TRANSITION_PENDING',
  RETURNING_TO_JUNCTION: 'RETURNING_TO_JUNCTION',
  ROUTE_COMPLETE: 'ROUTE_COMPLETE',
  FAILED: 'FAILED',
});

export const CONNECTION_STATUSES = Object.freeze({
  CONFIRMED_EXPLICIT: 'CONFIRMED_EXPLICIT',
  CONFIRMED_REFERENCE: 'CONFIRMED_REFERENCE',
  CONFIRMED_EXACT: 'CONFIRMED_EXACT',
  AUTO_REPAIRED_SMALL_GAP: 'AUTO_REPAIRED_SMALL_GAP',
  USER_CONFIRMED: 'USER_CONFIRMED',
  INTENTIONAL_TERMINAL: 'INTENTIONAL_TERMINAL',
  EXTERNAL_BOUNDARY: 'EXTERNAL_BOUNDARY',
});

export const DECISION_ACTIONS = Object.freeze({
  CONNECT: 'CONNECT',
  MANUAL_CONNECT: 'MANUAL_CONNECT',
  REJECT_CANDIDATE: 'REJECT_CANDIDATE',
  MARK_TERMINAL: 'MARK_TERMINAL',
  MARK_EXTERNAL_BOUNDARY: 'MARK_EXTERNAL_BOUNDARY',
  REVERSE_COMPONENT: 'REVERSE_COMPONENT',
  DEFER_DECISION: 'DEFER_DECISION',
  RESUME_DECISION: 'RESUME_DECISION',
  UNDO_LAST_TRANSACTION: 'UNDO_LAST_TRANSACTION',
  REDO_LAST_TRANSACTION: 'REDO_LAST_TRANSACTION',
});

export function freezeConstructionSession(session) {
  return Object.freeze({
    ...session,
    confirmedComponentIds: Object.freeze([...(session.confirmedComponentIds || [])]),
    committedConnections: Object.freeze([...(session.committedConnections || [])]),
    pendingBranchJunctions: Object.freeze([...(session.pendingBranchJunctions || [])]),
    completedBranchIds: Object.freeze([...(session.completedBranchIds || [])]),
    repairLedger: Object.freeze([...(session.repairLedger || [])]),
    decisionLedger: Object.freeze([...(session.decisionLedger || [])]),
    boundaryClassifications: Object.freeze([...(session.boundaryClassifications || [])]),
    rejectedCandidateIds: Object.freeze([...(session.rejectedCandidateIds || [])]),
    strokeLedger: Object.freeze([...(session.strokeLedger || [])]),
    diagnostics: Object.freeze([...(session.diagnostics || [])]),
    transactionLedger: Object.freeze([...(session.transactionLedger || [])]),
    undoStack: Object.freeze([...(session.undoStack || [])]),
    redoStack: Object.freeze([...(session.redoStack || [])]),
    deferredDecisionIds: Object.freeze([...(session.deferredDecisionIds || [])]),
    componentTraversalOverrides: Object.freeze([...(session.componentTraversalOverrides || [])]),
  });
}

export function createEmptyConstructionSession(rootBranchId) {
  return freezeConstructionSession({
    schema: 'SequentialConstructionSession.v1',
    state: CONSTRUCTION_STATES.NOT_STARTED,
    rootBranchId: String(rootBranchId || '').trim(),
    activeBranchId: String(rootBranchId || '').trim(),
    activeComponentId: null,
    activeEntryPortId: null,
    activeExitPortId: null,
    activeComponentOrderIndex: -1,
    headBoundaryValidated: false,
    headBoundaryConnectionId: null,
    startComponentId: null,
    startEntryPortId: null,
    confirmedComponentIds: [],
    committedConnections: [],
    pendingBranchJunctions: [],
    completedBranchIds: [],
    repairLedger: [],
    decisionLedger: [],
    boundaryClassifications: [],
    rejectedCandidateIds: [],
    strokeLedger: [],
    currentDecisionRequest: null,
    diagnostics: [],
    transactionLedger: [],
    undoStack: [],
    redoStack: [],
    deferredDecisionIds: [],
    componentTraversalOverrides: [],
  });
}
