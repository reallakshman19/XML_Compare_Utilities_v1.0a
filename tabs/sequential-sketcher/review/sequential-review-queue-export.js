export const SEQUENTIAL_DECISION_REGISTER_SCHEMA = 'SequentialDecisionRegister.v1';

function text(value) { return String(value ?? '').trim(); }
function scalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function csvCell(value) {
  const string = scalar(value);
  return /[",\r\n]/u.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}
function csv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\n');
}
function snapshotMap(queue) {
  return new Map((queue?.snapshots || []).map((row) => [row.branchId, row.session]));
}
function candidateIds(request) {
  return (request?.candidates || []).map((candidate) => candidate.candidateId).filter(Boolean).join('|');
}
function candidatePortPairs(request) {
  return (request?.candidates || []).map((candidate) => {
    const from = candidate.fromPortId || candidate.targetPortId || '';
    const to = candidate.toPortId || candidate.connectedPortId || '';
    return `${from}->${to}`;
  }).join('|');
}

export function buildSequentialDecisionRegister(queue) {
  const sessions = snapshotMap(queue);
  const unresolvedRows = [];
  const manualRows = [];
  for (const row of queue?.rows || []) {
    const session = sessions.get(row.branchId);
    const request = session?.currentDecisionRequest;
    if (request && ['OPEN', 'DEFERRED'].includes(request.state)) {
      unresolvedRows.push(Object.freeze({
        branchId: row.branchId,
        lineKey: row.lineKey,
        reviewStatus: row.reviewStatus,
        state: row.state,
        decisionId: request.decisionId || '',
        decisionState: request.state || '',
        reason: request.reason || '',
        decisionScope: request.decisionScope || '',
        expectedContinuationCategory: row.expectedContinuationCategory,
        missingEvidenceClass: row.missingEvidenceClass,
        activeComponentId: row.activeEndpoint?.sourceComponentId || '',
        activePortId: row.activeEndpoint?.portId || '',
        candidateCount: request.candidates?.length || 0,
        candidateIds: candidateIds(request),
        candidatePortPairs: candidatePortPairs(request),
        deferredReason: request.deferral?.reason || '',
        deferredEvidenceNote: request.deferral?.evidenceNote || '',
        constructionFingerprint: row.constructionFingerprint || '',
      }));
    }
    for (const decision of session?.decisionLedger || []) {
      const resolution = decision?.resolution;
      if (!resolution || resolution.provenance !== 'USER_MANUAL') continue;
      manualRows.push(Object.freeze({
        branchId: row.branchId,
        lineKey: row.lineKey,
        finalReviewStatus: row.reviewStatus,
        decisionId: decision.decisionId || '',
        originalReason: decision.reason || '',
        action: resolution.action || '',
        selectedCandidateId: resolution.selectedCandidateId || '',
        selectedFromPortId: resolution.selectedFromPortId || '',
        selectedToPortId: resolution.selectedToPortId || '',
        reason: resolution.reason || '',
        evidenceNote: resolution.evidenceNote || '',
        confirmedBy: resolution.confirmedBy || '',
        confirmedAt: resolution.confirmedAt || '',
        previousConstructionFingerprint: resolution.previousConstructionFingerprint || '',
        resultingConstructionFingerprint: resolution.resultingConstructionFingerprint || '',
      }));
    }
  }
  return Object.freeze({
    schema: SEQUENTIAL_DECISION_REGISTER_SCHEMA,
    generatedAt: new Date().toISOString(),
    queueGeneratedAt: queue?.generatedAt || null,
    summary: Object.freeze({
      unresolvedCount: unresolvedRows.length,
      manualResolutionCount: manualRows.length,
    }),
    unresolvedRows: Object.freeze(unresolvedRows),
    manualRows: Object.freeze(manualRows),
  });
}

const UNRESOLVED_COLUMNS = Object.freeze([
  'branchId', 'lineKey', 'reviewStatus', 'state', 'decisionId', 'decisionState',
  'reason', 'decisionScope', 'expectedContinuationCategory', 'missingEvidenceClass',
  'activeComponentId', 'activePortId', 'candidateCount', 'candidateIds',
  'candidatePortPairs', 'deferredReason', 'deferredEvidenceNote', 'constructionFingerprint',
]);
const MANUAL_COLUMNS = Object.freeze([
  'branchId', 'lineKey', 'finalReviewStatus', 'decisionId', 'originalReason',
  'action', 'selectedCandidateId', 'selectedFromPortId', 'selectedToPortId',
  'reason', 'evidenceNote', 'confirmedBy', 'confirmedAt',
  'previousConstructionFingerprint', 'resultingConstructionFingerprint',
]);

export function createSequentialDecisionRegisterExports(queue) {
  const register = buildSequentialDecisionRegister(queue);
  return Object.freeze({
    register,
    unresolvedCsv: csv(register.unresolvedRows, UNRESOLVED_COLUMNS),
    manualCsv: csv(register.manualRows, MANUAL_COLUMNS),
    registerJson: JSON.stringify(register, null, 2),
  });
}
