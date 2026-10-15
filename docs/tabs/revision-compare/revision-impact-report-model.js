/**
 * This component enables the Revision Impact Report by connecting the current audit,
 * review projection, and decision ledger to one deterministic report contract.
 */
import { assertJsonSafe, deepFreeze, deterministicId } from './revision-contract-utils.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';
import { reviewSessionMatchesAudit } from './revision-review-session.js';
import { reviewPriorityProjection } from './revision-review-projection.js';

export const REVISION_IMPACT_REPORT_SCHEMA = 'RevisionImpactReport.v1';
export const REVISION_IMPACT_REPORT_SCOPES = Object.freeze(['FULL', 'VISIBLE']);
const UNRESOLVED_DECISIONS = Object.freeze(['UNDECIDED', 'DEFERRED', 'REVOKED']);
const UNRESOLVED_REVIEW = Object.freeze(['UNREVIEWED', 'NEEDS_CLARIFICATION', 'UNRESOLVED']);

function clean(value, fallback = 'UNAVAILABLE') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function sortedStrings(values) {
  return Object.freeze([...(values ?? [])].map((value) => String(value)).sort());
}

function normalizeScope(scope) {
  const value = String(scope ?? '').toUpperCase();
  if (!REVISION_IMPACT_REPORT_SCOPES.includes(value)) throw new RangeError(`Unknown impact report scope ${scope}.`);
  return value;
}

function addCount(map, value, increment = 1) {
  const key = clean(value);
  map.set(key, (map.get(key) ?? 0) + increment);
}

function countSeries(values) {
  const counts = new Map();
  for (const value of values) addCount(counts, value);
  return Object.freeze([...counts.entries()]
    .map(([key, count]) => deepFreeze({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)));
}

function candidateIndex(audit) {
  return new Map((audit?.candidateEvidence ?? []).map((entry) => [entry.candidateEvidenceId, entry]));
}

function effectiveCategory(entry) {
  const state = entry.decisionItem?.decisionState;
  if (state === 'ACCEPTED_CANDIDATE') return 'MANUAL_CORRESPONDENCE';
  if (state === 'CONFIRMED_NO_MATCH') return 'REMOVED';
  if (entry.consumedByDifferenceId) return 'MANUALLY_MATCHED_TARGET';
  return entry.row.differenceCategory;
}

function decisionState(entry) {
  return entry.decisionItem?.decisionState ?? entry.derivedDecisionState ?? 'NOT_APPLICABLE';
}

function candidateSummary(index, row) {
  const evidence = index.get(row.candidateEvidenceId);
  return deepFreeze({
    candidateCount: evidence?.candidateCount ?? 0,
    candidateLimit: evidence?.candidateLimit ?? 0,
    reachedCandidateLimit: Boolean(evidence?.reachedCandidateLimit),
    decisionBasis: evidence?.scoreGapOrDecisionBasis ?? null,
  });
}

function impactRow(entry, candidatesById, priorityIndex) {
  const { row, item } = entry;
  const decision = entry.decisionItem;
  const candidates = candidateSummary(candidatesById, row);
  return deepFreeze({
    differenceId: row.differenceId,
    priorityRank: priorityIndex + 1,
    branchId: clean(row.context?.branchId),
    componentType: clean(row.context?.componentType),
    differenceCategory: row.differenceCategory,
    effectiveDifferenceCategory: effectiveCategory(entry),
    matchCertainty: row.matchCertainty,
    reviewState: item.reviewState,
    decisionState: decisionState(entry),
    changeReasons: sortedStrings(row.changeReasons),
    changedPropertyKeys: sortedStrings(row.changedProperties?.map((change) => change.propertyKey)),
    changedPropertyCount: row.changedProperties?.length ?? 0,
    geometryStatus: row.geometryDelta?.status ?? 'UNAVAILABLE',
    maximumPointDelta: row.geometryDelta?.maximumPointDelta ?? null,
    revAIdentity: row.context?.revAIdentity ?? null,
    revBIdentity: row.context?.revBIdentity ?? null,
    sourceRecordId: row.sourceRecordId ?? null,
    targetRecordId: row.targetRecordId ?? null,
    acceptedTargetRecordId: decision?.acceptedTargetRecordId ?? null,
    consumedByDifferenceId: entry.consumedByDifferenceId ?? null,
    reviewNote: item.note ?? '',
    decisionRationale: decision?.rationale ?? '',
    evidenceSummary: row.evidenceSummary?.primary ?? null,
    visualRefs: row.visualRefs,
    candidateEvidence: candidates,
  });
}

function filterSnapshot(state) {
  return deepFreeze({
    reviewSearch: String(state.review.filters.search ?? ''),
    reviewStates: sortedStrings(state.review.filters.reviewStates),
    differenceCategories: sortedStrings(state.compare.queue.categories),
    matchCertainties: sortedStrings(state.review.filters.certainties),
    changeReasons: sortedStrings(state.compare.queue.changedReasons),
    originalNeedsDecisionOnly: Boolean(state.compare.queue.needsDecisionOnly),
    decisionStates: sortedStrings(state.decision.filters.decisionStates),
    unresolvedAmbiguityOnly: Boolean(state.decision.filters.unresolvedOnly),
  });
}

function authoritySnapshot(state) {
  const audit = state.compare.audit;
  const session = state.review.session;
  const ledger = state.decision.ledger;
  return deepFreeze({
    sessionId: state.session.sessionId,
    basisId: audit.basisId,
    auditId: audit.auditId,
    reviewSessionId: session.reviewSessionId,
    reviewRevision: session.revision,
    reviewUpdatedAt: session.updatedAt,
    decisionLedgerId: ledger.ledgerId,
    decisionRevision: ledger.revision,
    decisionUpdatedAt: ledger.updatedAt,
    revADocumentId: audit.revADocumentId,
    revBDocumentId: audit.revBDocumentId,
    revAFileName: state.slots.baseline.fileName,
    revBFileName: state.slots.candidate.fileName,
  });
}

function summaryFor(rows) {
  const propertyKeys = rows.flatMap((row) => row.changedPropertyKeys);
  const reasons = rows.flatMap((row) => row.changeReasons);
  return deepFreeze({
    differenceCategories: countSeries(rows.map((row) => row.differenceCategory)),
    effectiveCategories: countSeries(rows.map((row) => row.effectiveDifferenceCategory)),
    matchCertainties: countSeries(rows.map((row) => row.matchCertainty)),
    reviewStates: countSeries(rows.map((row) => row.reviewState)),
    decisionStates: countSeries(rows.map((row) => row.decisionState)),
    changeReasons: countSeries(reasons),
    branches: countSeries(rows.map((row) => row.branchId)),
    componentTypes: countSeries(rows.map((row) => row.componentType)),
    changedProperties: countSeries(propertyKeys),
    geometryChanged: rows.filter((row) => row.changeReasons.includes('GEOMETRY')).length,
    propertyChanged: rows.filter((row) => row.changeReasons.includes('PROPERTIES')).length,
    ambiguous: rows.filter((row) => row.matchCertainty === 'AMBIGUOUS').length,
    unresolvedDecision: rows.filter((row) => UNRESOLVED_DECISIONS.includes(row.decisionState)).length,
    unresolvedReview: rows.filter((row) => UNRESOLVED_REVIEW.includes(row.reviewState)).length,
    notesPresent: rows.filter((row) => Boolean(row.reviewNote.trim())).length,
    rationalesPresent: rows.filter((row) => Boolean(row.decisionRationale.trim())).length,
  });
}

function highlights(summary) {
  return deepFreeze({
    topBranches: Object.freeze(summary.branches.slice(0, 8)),
    topComponentTypes: Object.freeze(summary.componentTypes.slice(0, 8)),
    topChangedProperties: Object.freeze(summary.changedProperties.slice(0, 8)),
    topChangeReasons: Object.freeze(summary.changeReasons.slice(0, 8)),
  });
}

export function revisionImpactReportReadiness(state) {
  const audit = state?.compare?.audit;
  const session = state?.review?.session;
  const ledger = state?.decision?.ledger;
  const blockers = [];
  if (!audit || audit.validation?.status !== 'READY') blockers.push('A current valid comparison audit is required.');
  if (audit && !reviewSessionMatchesAudit(session, audit)) blockers.push('The review session does not match the current audit.');
  if (session && (session.status !== 'CURRENT' || session.validation?.status !== 'READY')) blockers.push('The review session is not current and ready.');
  if (audit && !decisionLedgerMatchesAudit(ledger, audit)) blockers.push('The decision ledger does not match the current audit.');
  if (ledger && (ledger.status !== 'CURRENT' || ledger.validation?.status !== 'READY')) blockers.push('The decision ledger is not current and ready.');
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers) });
}

function reportCoreFromProjection(state, scope, projection) {
  const normalizedScope = normalizeScope(scope);
  const entries = normalizedScope === 'VISIBLE' ? projection.visible : projection.all;
  const candidatesById = candidateIndex(state.compare.audit);
  const rows = Object.freeze(entries.map((entry, index) => impactRow(entry, candidatesById, index)));
  const summary = summaryFor(rows);
  return deepFreeze({
    schema: REVISION_IMPACT_REPORT_SCHEMA,
    scope: normalizedScope,
    authority: authoritySnapshot(state),
    filters: normalizedScope === 'VISIBLE' ? filterSnapshot(state) : null,
    coverage: deepFreeze({
      fullRowCount: projection.all.length,
      visibleRowCount: projection.visible.length,
      hiddenRowCount: projection.hiddenCount,
      exportedRowCount: rows.length,
    }),
    summary,
    highlights: highlights(summary),
    rows,
  });
}

function reportCore(state, scope) {
  const readiness = revisionImpactReportReadiness(state);
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  return reportCoreFromProjection(state, scope, reviewPriorityProjection(state));
}

export function revisionImpactDashboardModel(state) {
  const readiness = revisionImpactReportReadiness(state);
  if (readiness.status !== 'READY') return deepFreeze({ readiness, full: null, visible: null });
  const projection = reviewPriorityProjection(state);
  const full = reportCoreFromProjection(state, 'FULL', projection);
  const visible = reportCoreFromProjection(state, 'VISIBLE', projection);
  return deepFreeze({ readiness, full, visible });
}

export async function createRevisionImpactReport(state, scope, cryptoRef) {
  const core = reportCore(state, scope);
  const reportId = await deterministicId('revision-impact-report', core, cryptoRef);
  const report = deepFreeze({ ...core, reportId, validation: deepFreeze({ status: 'READY', errors: Object.freeze([]) }) });
  assertJsonSafe(report, REVISION_IMPACT_REPORT_SCHEMA);
  return report;
}

export const _test = Object.freeze({ countSeries, decisionState, effectiveCategory, normalizeScope, reportCore, reportCoreFromProjection, summaryFor });
