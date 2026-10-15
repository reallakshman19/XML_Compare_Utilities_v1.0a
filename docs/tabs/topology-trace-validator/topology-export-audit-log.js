/** Complete non-blocking topology export audit log construction. */

import { buildUpdateLedgerRows } from './topology-update-ledger-model.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

export const TOPOLOGY_EXPORT_LOG_SCHEMA = 'TopologyExportLog.v1';

function suggestionMap(suggestions) {
  return new Map(asArray(suggestions).map((row) => [cleanText(objectRecord(row).id), objectRecord(row)]));
}

function originSuggestionIds(origin) {
  const value = cleanText(origin);
  return value.startsWith('AUTOFIX:') ? value.slice(8).split(',').map(cleanText).filter(Boolean) : [];
}

function appliedIssueMap(draft, suggestionsById) {
  const result = new Map();
  for (const command of asArray(draft?.commands).map(objectRecord)) {
    if (cleanText(command.type) !== 'TRANSACTION') continue;
    const metadata = objectRecord(objectRecord(command.payload).metadata);
    const suggestionIds = asArray(metadata.suggestionIds).map(cleanText);
    const issueIds = asArray(metadata.issueIds).map(cleanText);
    suggestionIds.forEach((id, index) => result.set(id, issueIds[index] || cleanText(suggestionsById.get(id)?.issueId)));
  }
  return result;
}

function operationEntry(row, suggestionsById, appliedIssues) {
  const detail = objectRecord(row.detail), suggestionIds = originSuggestionIds(row.origin);
  const issueIds = suggestionIds.map((id) => cleanText(appliedIssues.get(id) || suggestionsById.get(id)?.issueId)).filter(Boolean);
  return Object.freeze({
    operationId: cleanText(row.id), status: suggestionIds.length ? 'AUTO_FIX_APPLIED' : 'MANUAL_EDIT_APPLIED',
    kind: cleanText(row.kind), target: cleanText(row.target), before: row.before ?? '', after: row.after ?? '',
    nodeId: cleanText(detail.nodeId), edgeId: cleanText(detail.edgeId),
    fromPosition: detail.fromPosition ?? null, toPosition: detail.position ?? detail.toPosition ?? null,
    suggestionIds: Object.freeze(suggestionIds), issueIds: Object.freeze(issueIds),
    origin: cleanText(row.origin), remark: cleanText(row.remark),
  });
}

function findingStatus(issue, suggestion, state) {
  const review = objectRecord(objectRecord(state).issueStates?.[issue.id]);
  const status = cleanText(review.status) || 'OPEN', reason = cleanText(review.reason);
  const fixability = cleanText(suggestion?.fixability ?? issue.fixability), mode = cleanText(suggestion?.effectiveFixMode);
  if (status === 'SUPPRESSED') return reason.startsWith('AUTO:') ? 'AUTO_SUPPRESSED' : 'USER_SKIPPED';
  if (status === 'RESOLVED') return 'USER_RESOLVED';
  if (mode === 'CONFIRM' || fixability === 'NEEDS_CONFIRMATION') return 'USER_CONFIRMATION_PENDING';
  if (status === 'ACKNOWLEDGED') return 'KNOWN_ISSUE';
  if (mode === 'AUTO' || fixability === 'AUTO_APPROVED') return asArray(suggestion?.operations).length ? 'AUTO_FIX_PENDING' : 'AUTO_FIX_UNAVAILABLE';
  if (!fixability) return 'UNKNOWN_FALLBACK';
  return 'KNOWN_ISSUE';
}

function resolvedFindingEntry(record) {
  const row = objectRecord(record), issue = objectRecord(row.issue), suggestion = objectRecord(row.suggestion);
  return Object.freeze({ issueId: cleanText(issue.id), issueCode: cleanText(issue.code), category: cleanText(issue.category),
    severity: cleanText(issue.severity), fixability: cleanText(suggestion.fixability) || 'AUTO_APPROVED',
    status: 'AUTO_FIX_RESOLVED', reviewStatus: 'RESOLVED', reason: cleanText(row.outcome), message: cleanText(issue.message),
    affectedObjectIds: Object.freeze(asArray(issue.objectIds).map(cleanText).filter(Boolean)), suggestionId: cleanText(suggestion.id),
    proposedOperations: Object.freeze(asArray(suggestion.operations)), exportedAsIs: false,
    autoFixRunId: cleanText(row.runId), transactionId: cleanText(row.transactionId), resolvedAt: cleanText(row.resolvedAt) });
}

function findingEntry(issue, suggestion, reviewState) {
  const review = objectRecord(objectRecord(reviewState).issueStates?.[issue.id]);
  return Object.freeze({
    issueId: cleanText(issue.id), issueCode: cleanText(issue.code), category: cleanText(issue.category),
    severity: cleanText(issue.severity), fixability: cleanText(suggestion?.fixability ?? issue.fixability),
    status: findingStatus(issue, suggestion, reviewState), reviewStatus: cleanText(review.status) || 'OPEN',
    reason: cleanText(review.reason), message: cleanText(issue.message),
    affectedObjectIds: Object.freeze(asArray(issue.objectIds).map(cleanText).filter(Boolean)),
    suggestionId: cleanText(suggestion?.id), proposedOperations: Object.freeze(asArray(suggestion?.operations)),
    exportedAsIs: cleanText(review.status) !== 'RESOLVED',
  });
}

function validationEntry(row) {
  const record = objectRecord(row);
  return Object.freeze({ status: 'INTEGRITY_WARNING', code: cleanText(record.code) || 'VALIDATION_WARNING',
    message: cleanText(record.message), affectedObjectIds: Object.freeze(asArray(record.objectIds).map(cleanText).filter(Boolean)) });
}

function statusCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return Object.freeze(counts);
}

/** Build the log included with every export; findings never become export blockers. */
export function buildTopologyExportAuditLog(input) {
  const checker = objectRecord(input.checkerEvidence), report = objectRecord(checker.report);
  const suggestions = asArray(checker.suggestions), suggestionsById = suggestionMap(suggestions);
  const ledgerRows = buildUpdateLedgerRows({ draft: input.draft, attributeLedger: input.attributeLedger, remarks: input.remarks });
  const appliedIssues = appliedIssueMap(input.draft, suggestionsById);
  const operations = Object.freeze(ledgerRows.map((row) => operationEntry(row, suggestionsById, appliedIssues)));
  const byIssue = new Map(suggestions.map((row) => [cleanText(objectRecord(row).issueId), objectRecord(row)]));
  const findings = Object.freeze([
    ...asArray(report.issues).map((issue) => findingEntry(objectRecord(issue), byIssue.get(issue.id), checker.reviewState)),
    ...asArray(checker.resolvedIssues).map(resolvedFindingEntry),
  ]);
  const validationWarnings = Object.freeze(asArray(objectRecord(input.built.editValidation).findings).map(validationEntry));
  const mode = objectRecord(input.modelMode), scope = objectRecord(input.editScope);
  return Object.freeze({
    schema: TOPOLOGY_EXPORT_LOG_SCHEMA, exportPolicy: 'ALWAYS_ALLOWED', exportedAt: cleanText(input.createdAt),
    canonicalTopologyHash: cleanText(objectRecord(input.built.canonicalTopology).canonicalTopologyHash),
    modelMode: Object.freeze({ kind: cleanText(mode.kind) || 'SMALL_FULL', elementCount: Number(mode.elementCount ?? 0),
      threshold: Number(mode.threshold ?? 0), editScopeBranchIndexes: Object.freeze(asArray(scope.sourceBranchIndexes).map(Number)) }),
    policy: Object.freeze({ schema: cleanText(objectRecord(checker.policy).schema), hash: cleanText(checker.policyHash), snapshot: checker.policy ?? null }),
    autoFixRuns: Object.freeze(asArray(checker.autoFixRuns)),
    summary: Object.freeze({ operations: operations.length, findings: findings.length, resolvedFindings: asArray(checker.resolvedIssues).length,
      autoFixRuns: asArray(checker.autoFixRuns).length, validationWarnings: validationWarnings.length,
      operationStatuses: statusCounts(operations), findingStatuses: statusCounts(findings) }),
    operations, findings, validationWarnings,
  });
}

export function topologyExportAuditStateKey(input) {
  const checker = objectRecord(input.checkerEvidence), scope = objectRecord(input.editScope), mode = objectRecord(input.modelMode);
  return JSON.stringify({ reviewHash: cleanText(objectRecord(checker.reviewState).topologyReviewStateHash), policyHash: cleanText(checker.policyHash),
    reportHash: cleanText(objectRecord(checker.report).topologyCheckReportHash),
    autoFixRuns: asArray(checker.autoFixRuns).map((row) => [cleanText(row.runId), row.active === true]),
    mode: cleanText(mode.kind), threshold: Number(mode.threshold ?? 0), scope: asArray(scope.sourceBranchIndexes).map(Number) });
}

export function topologyExportAuditOutput(stem, input) {
  const log = buildTopologyExportAuditLog(input);
  return Object.freeze({ log, output: Object.freeze({ name: `${stem}.topology-export-log.json`,
    mime: 'application/json', text: `${JSON.stringify(log, null, 2)}\n` }) });
}
