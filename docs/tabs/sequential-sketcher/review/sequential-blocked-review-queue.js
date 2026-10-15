import { stableToken } from '../sequential-sketcher-contract.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../construction/sequential-construction-runtime.js';
import { sequentialSessionFingerprint } from '../construction/sequential-session-fingerprint.js';

export const SEQUENTIAL_BLOCKED_REVIEW_QUEUE_SCHEMA = 'SequentialBlockedBranchReviewQueue.v1';

const USER_MANUAL_ACTIONS = new Set([
  'MANUAL_CONNECT',
  'REVERSE_COMPONENT',
  'MARK_TERMINAL',
  'MARK_EXTERNAL_BOUNDARY',
]);

function text(value) { return String(value ?? '').trim(); }
function point(value) { return value ? Object.freeze({ x: value.x, y: value.y, z: value.z }) : null; }
function lineKey(branchId) {
  const token = text(branchId).split('/').find((part) => /^S[0-9A-Z]+$/u.test(part));
  return token || null;
}
function expectedContinuationCategory(reason) {
  if (['AMBIGUOUS_BRANCH_START', 'MULTIPLE_BOUNDARY_REFERENCE_PORTS'].includes(reason)) return 'HEAD_BOUNDARY';
  if (reason === 'REFERENCE_TARGET_MISSING') return 'REFERENCE_TARGET';
  if (reason === 'REFERENCE_TARGET_PORT_UNRESOLVED') return 'REFERENCE_TARGET_PORT';
  if (reason === 'UNEXPLAINED_TERMINAL') return 'TERMINAL_EVIDENCE';
  if (reason === 'MULTIPLE_EXACT_CANDIDATES') return 'EXACT_PORT_SELECTION';
  if (reason === 'MULTIPLE_REPAIR_CANDIDATES') return 'SMALL_GAP_PORT_SELECTION';
  if (reason === 'CONTINUITY_NOT_PROVEN') return 'SOURCE_SEQUENCE_OR_GAP';
  if (reason?.startsWith('EXTERNAL_BOUNDARY_') || reason === 'EXTERNAL_REFERENCE_CLASSIFIED') return 'EXTERNAL_BOUNDARY_EVIDENCE';
  return 'NONE';
}
function missingEvidenceClass(reason) {
  if (reason === 'REFERENCE_TARGET_MISSING') return 'REFERENCE_NORMALIZATION_OR_EXTERNAL_SCOPE';
  if (reason === 'REFERENCE_TARGET_PORT_UNRESOLVED') return 'FITTING_PORT_DERIVATION';
  if (['AMBIGUOUS_BRANCH_START', 'MULTIPLE_BOUNDARY_REFERENCE_PORTS'].includes(reason)) return 'SOURCE_BOUNDARY_AMBIGUITY';
  if (reason === 'MULTIPLE_EXACT_CANDIDATES') return 'COMPOSITE_OR_PORT_AMBIGUITY';
  if (reason === 'UNEXPLAINED_TERMINAL') return 'TERMINAL_DIALECT_OR_MISSING_ENGINEERING_DATA';
  if (reason === 'CONTINUITY_NOT_PROVEN') return 'SOURCE_GAP_OR_SEQUENCE';
  if (reason?.startsWith('EXTERNAL_BOUNDARY_')) return 'EXTERNAL_BOUNDARY_POSITION_EVIDENCE';
  if (reason === 'EXTERNAL_REFERENCE_CLASSIFIED') return 'EXTERNAL_PHYSICAL_ROLE_EVIDENCE';
  return 'NONE';
}
function candidateRow(candidate) {
  const gap = Number(candidate?.gapMm ?? candidate?.totalGapMm ?? candidate?.targetToBoundaryGapMm);
  return Object.freeze({
    candidateId: candidate?.candidateId || null,
    fromPortId: candidate?.fromPortId || candidate?.targetPortId || null,
    toPortId: candidate?.toPortId || candidate?.connectedPortId || null,
    targetBranchId: candidate?.targetBranchId || null,
    targetComponentId: candidate?.targetComponentId || null,
    targetSourceComponentId: candidate?.targetSourceComponentId || null,
    targetComponentType: candidate?.targetComponentType || null,
    targetPortRole: candidate?.targetPortRole || null,
    gapMm: Number.isFinite(gap) ? gap : null,
    referenceMatch: Boolean(candidate?.referenceMatch || candidate?.referenceKind),
    sourceAdjacent: Boolean(candidate?.sourceAdjacent),
    directionCompatible: candidate?.directionCompatible ?? null,
    boreCompatibility: candidate?.boreCompatibility || null,
    fromPosition: point(candidate?.fromPosition || candidate?.targetPosition),
    toPosition: point(candidate?.toPosition || candidate?.connectedPosition),
    fromPositionBasis: candidate?.fromPositionBasis || candidate?.targetPositionBasis || null,
    toPositionBasis: candidate?.toPositionBasis || candidate?.connectedPositionBasis || null,
  });
}
function manualDecisionRows(session) {
  return (session?.decisionLedger || []).filter((decision) => (
    decision?.resolution?.provenance === 'USER_MANUAL'
    || USER_MANUAL_ACTIONS.has(decision?.resolution?.action)
  ));
}
function reviewStatus(session) {
  if (!session) return 'NOT_ANALYZED';
  if (session.currentDecisionRequest?.state === 'DEFERRED') return 'DEFERRED';
  if (session.state === 'USER_DECISION_REQUIRED') return 'UNRESOLVED';
  if (manualDecisionRows(session).length) return 'MANUALLY_RESOLVED';
  if (session.state === 'ROUTE_COMPLETE') return 'COMPLETE';
  if (session.state === 'FAILED') return 'FAILED';
  return 'IN_PROGRESS';
}
function activeEndpoint(session, indexes) {
  const port = indexes?.ports?.get(session?.activeExitPortId);
  const component = indexes?.components?.get(session?.activeComponentId);
  return session ? Object.freeze({
    branchId: session.activeBranchId || null,
    componentId: session.activeComponentId || null,
    sourceComponentId: component?.sourceComponentId || null,
    componentType: component?.canonicalType || null,
    portId: port?.portId || session.activeExitPortId || null,
    portRole: port?.role || null,
    sourcePosition: point(port?.sourcePosition),
    boreMm: port?.boreMm ?? null,
  }) : null;
}

export function createSequentialReviewRow(branch, session, indexes) {
  const request = session?.currentDecisionRequest || null;
  const reason = request?.reason || null;
  const manualDecisions = manualDecisionRows(session);
  return Object.freeze({
    schema: 'SequentialBlockedBranchReviewRow.v1',
    reviewId: `REVIEW-${stableToken(`${branch.branchId}|${request?.decisionId || session?.state || 'UNKNOWN'}`)}`,
    branchId: branch.branchId,
    lineKey: lineKey(branch.branchId),
    sourceBranchIndex: branch.sourceBranchIndex,
    state: session?.state || 'UNKNOWN',
    reviewStatus: reviewStatus(session),
    blockedReason: reason,
    decisionId: request?.decisionId || null,
    decisionState: request?.state || null,
    decisionScope: request?.decisionScope || null,
    expectedContinuationCategory: expectedContinuationCategory(reason),
    missingEvidenceClass: missingEvidenceClass(reason),
    activeEndpoint: activeEndpoint(session, indexes),
    candidates: Object.freeze((request?.candidates || []).map(candidateRow)),
    candidateCount: request?.candidates?.length || 0,
    confirmedComponentCount: session?.confirmedComponentIds?.length || 0,
    committedConnectionCount: session?.committedConnections?.length || 0,
    repairCount: session?.repairLedger?.length || 0,
    transactionCount: session?.transactionLedger?.length || 0,
    manualDecisionCount: manualDecisions.length,
    deferredReason: request?.deferral?.reason || null,
    deferredEvidenceNote: request?.deferral?.evidenceNote || null,
    constructionFingerprint: session ? sequentialSessionFingerprint(session) : null,
  });
}

function queueSummary(rows) {
  const statuses = {};
  for (const row of rows) statuses[row.reviewStatus] = (statuses[row.reviewStatus] || 0) + 1;
  return Object.freeze({
    branchCount: rows.length,
    unresolvedCount: statuses.UNRESOLVED || 0,
    deferredCount: statuses.DEFERRED || 0,
    manuallyResolvedCount: statuses.MANUALLY_RESOLVED || 0,
    completeCount: statuses.COMPLETE || 0,
    failedCount: statuses.FAILED || 0,
    statuses: Object.freeze(statuses),
  });
}
function groupCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!['UNRESOLVED', 'DEFERRED'].includes(row.reviewStatus)) continue;
    const reason = row.blockedReason || 'UNKNOWN';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return Object.freeze([...counts.entries()]
    .map(([reason, count]) => Object.freeze({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)));
}
function freezeQueue(rows, snapshots, generatedAt = new Date().toISOString()) {
  const frozenRows = Object.freeze([...rows]);
  return Object.freeze({
    schema: SEQUENTIAL_BLOCKED_REVIEW_QUEUE_SCHEMA,
    generatedAt,
    rows: frozenRows,
    snapshots: Object.freeze([...snapshots]),
    summary: queueSummary(frozenRows),
    groups: groupCounts(frozenRows),
  });
}

export function buildSequentialBlockedReviewQueue(evidence, indexes, options = {}) {
  const rows = [];
  const snapshots = [];
  const maxSteps = Number.isInteger(options.maxSteps) ? options.maxSteps : 10000;
  const engineOptions = options.engineOptions || options;
  for (const branch of evidence?.branches || []) {
    let session;
    try {
      session = runConstructionUntilBlocked(
        createSequentialConstructionSession(branch.branchId),
        evidence,
        indexes,
        engineOptions,
        maxSteps,
      ).session;
    } catch (error) {
      session = Object.freeze({
        state: 'FAILED',
        rootBranchId: branch.branchId,
        activeBranchId: branch.branchId,
        confirmedComponentIds: Object.freeze([]),
        committedConnections: Object.freeze([]),
        repairLedger: Object.freeze([]),
        transactionLedger: Object.freeze([]),
        decisionLedger: Object.freeze([]),
        diagnostics: Object.freeze([{ severity: 'ERROR', code: 'REVIEW_QUEUE_RUNTIME_ERROR', message: error.message }]),
      });
    }
    rows.push(createSequentialReviewRow(branch, session, indexes));
    snapshots.push(Object.freeze({ branchId: branch.branchId, session }));
  }
  return freezeQueue(rows, snapshots);
}

export function refreshSequentialBlockedReviewQueue(queue, branchRegistry, evidence, indexes) {
  const byBranch = new Map((queue?.rows || []).map((row) => [row.branchId, row]));
  const snapshotByBranch = new Map((queue?.snapshots || []).map((row) => [row.branchId, row]));
  for (const branch of evidence?.branches || []) {
    const saved = branchRegistry?.get?.(branch.branchId);
    if (!saved?.session) continue;
    byBranch.set(branch.branchId, createSequentialReviewRow(branch, saved.session, indexes));
    snapshotByBranch.set(branch.branchId, Object.freeze({ branchId: branch.branchId, session: saved.session }));
  }
  const rows = (evidence?.branches || []).map((branch) => byBranch.get(branch.branchId)).filter(Boolean);
  const snapshots = (evidence?.branches || []).map((branch) => snapshotByBranch.get(branch.branchId)).filter(Boolean);
  return freezeQueue(rows, snapshots, queue?.generatedAt);
}

export function filterSequentialBlockedReviewQueue(queue, filters = {}) {
  const status = text(filters.status || 'UNRESOLVED');
  const reason = text(filters.reason);
  const search = text(filters.search).toLowerCase();
  return Object.freeze((queue?.rows || []).filter((row) => {
    if (status && status !== 'ALL' && row.reviewStatus !== status) return false;
    if (reason && reason !== 'ALL' && row.blockedReason !== reason) return false;
    if (search && ![
      row.branchId,
      row.lineKey,
      row.blockedReason,
      row.missingEvidenceClass,
      row.expectedContinuationCategory,
      row.activeEndpoint?.sourceComponentId,
    ].some((value) => text(value).toLowerCase().includes(search))) return false;
    return true;
  }));
}

export function adjacentSequentialReviewRow(rows, reviewId, delta) {
  if (!rows?.length) return null;
  const currentIndex = Math.max(0, rows.findIndex((row) => row.reviewId === reviewId));
  const nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + Math.sign(Number(delta) || 0)));
  return rows[nextIndex] || null;
}
