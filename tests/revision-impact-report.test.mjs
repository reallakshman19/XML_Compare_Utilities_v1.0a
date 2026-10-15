import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { routeRevisionCompareActionClick } from '../tabs/revision-compare/revision-compare-event-routing.js';
import { createRevisionImpactReportDownloadActions } from '../tabs/revision-compare/revision-impact-report-download.js';
import { serializeRevisionImpactReportCsv, _test as csvTest } from '../tabs/revision-compare/revision-impact-report-csv.js';
import {
  createRevisionImpactReport,
  revisionImpactDashboardModel,
  revisionImpactReportReadiness,
} from '../tabs/revision-compare/revision-impact-report-model.js';
import { revisionImpactReportMarkup } from '../tabs/revision-compare/revision-impact-report-view.js';

const NOW = '2026-07-30T03:50:00.000Z';

function row(input) {
  return Object.freeze({
    schema: 'RevisionDifferenceRow.v1',
    differenceId: input.id,
    differenceCategory: input.category,
    matchCertainty: input.certainty,
    sourceRecordId: input.source ?? null,
    targetRecordId: input.target ?? null,
    changeReasons: Object.freeze(input.reasons ?? []),
    changedProperties: Object.freeze(input.properties ?? []),
    geometryDelta: Object.freeze(input.geometry ?? { status: 'AVAILABLE', changed: false, maximumPointDelta: null }),
    evidenceSummary: Object.freeze({ primary: input.evidence ?? 'Evidence', revAIdentity: input.revA ?? null, revBIdentity: input.revB ?? null }),
    candidateEvidenceId: input.candidateEvidenceId ?? null,
    visualRefs: Object.freeze({ sourceObjectId: input.source ?? null, targetObjectId: input.target ?? null }),
    context: Object.freeze({
      branchId: input.branch,
      componentType: input.type,
      revAIdentity: input.revA ?? null,
      revBIdentity: input.revB ?? null,
    }),
  });
}

function reviewItem(differenceId, reviewState, note = '') {
  return Object.freeze({
    differenceId,
    reviewState,
    note,
    eventIds: Object.freeze([]),
  });
}

function decisionItem(differenceId, decisionState, rationale = '') {
  return Object.freeze({
    differenceId,
    decisionState,
    rationale,
    acceptedTargetRecordId: null,
  });
}

function audit() {
  const rows = Object.freeze([
    row({
      id: 'difference:a1:b1', category: 'CHANGED', certainty: 'EXACT', source: 'a1', target: 'b1',
      branch: 'branch:NORTH', type: 'PIPE', revA: 'P-100', revB: 'P-100', reasons: ['GEOMETRY', 'PROPERTIES'],
      properties: [{ propertyKey: 'NOMINAL_DIAMETER', revAValue: 100, revBValue: 150 }],
      geometry: { status: 'AVAILABLE', changed: true, maximumPointDelta: 12.5 },
    }),
    row({
      id: 'difference:none:b2', category: 'ADDED', certainty: 'NOT_APPLICABLE', target: 'b2',
      branch: 'branch:SOUTH', type: 'VALVE', revB: 'V-200', reasons: ['REV_B_ONLY'],
    }),
    row({
      id: 'difference:a3:none', category: 'REMOVED', certainty: 'AMBIGUOUS', source: 'a3',
      branch: 'branch:NORTH', type: 'SUPPORT', revA: 'S-300', reasons: ['REV_A_ONLY'],
      candidateEvidenceId: 'candidate:a3',
    }),
    row({
      id: 'difference:a4:b4', category: 'CHANGED', certainty: 'INFERRED', source: 'a4', target: 'b4',
      branch: 'branch:EAST', type: 'ELBOW', revA: 'E-400A', revB: 'E-400B', reasons: ['PROPERTIES'],
      properties: [{ propertyKey: 'MATERIAL', revAValue: 'A', revBValue: 'B' }],
    }),
  ]);
  return Object.freeze({
    schema: 'RevisionCompareAudit.v1',
    auditId: 'audit-1',
    basisId: 'basis-1',
    revADocumentId: 'doc-a',
    revBDocumentId: 'doc-b',
    engineVersion: 'test',
    configuration: Object.freeze({}),
    differenceRows: rows,
    candidateEvidence: Object.freeze([Object.freeze({
      candidateEvidenceId: 'candidate:a3', candidateCount: 2, candidateLimit: 8,
      reachedCandidateLimit: false, scoreGapOrDecisionBasis: 'AMBIGUOUS_GAP',
    })]),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}

function reviewSession() {
  const items = Object.freeze([
    reviewItem('difference:a1:b1', 'REVIEWED', 'Checked geometry.'),
    reviewItem('difference:none:b2', 'UNREVIEWED'),
    reviewItem('difference:a3:none', 'NEEDS_CLARIFICATION'),
    reviewItem('difference:a4:b4', 'UNRESOLVED'),
  ]);
  return Object.freeze({
    reviewSessionId: 'review-1', auditId: 'audit-1', basisId: 'basis-1',
    revADocumentId: 'doc-a', revBDocumentId: 'doc-b', status: 'CURRENT', revision: 3,
    createdAt: NOW, updatedAt: NOW, items, summary: Object.freeze({}),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}

function decisionLedger() {
  return Object.freeze({
    ledgerId: 'ledger-1', auditId: 'audit-1', basisId: 'basis-1',
    revADocumentId: 'doc-a', revBDocumentId: 'doc-b', status: 'CURRENT', revision: 1,
    createdAt: NOW, updatedAt: NOW,
    decisions: Object.freeze([decisionItem('difference:a3:none', 'DEFERRED', 'Awaiting field check.')]),
    summary: Object.freeze({}), validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}

function compareState(currentAudit) {
  return Object.freeze({
    audit: currentAudit,
    selectedDifferenceId: 'difference:a1:b1',
    queue: Object.freeze({
      categories: Object.freeze(['CHANGED', 'REMOVED']),
      needsDecisionOnly: false,
      changedReasons: Object.freeze(['GEOMETRY', 'PROPERTIES', 'REV_A_ONLY']),
      search: '',
    }),
  });
}

function workspace() {
  return Object.freeze({
    session: Object.freeze({ sessionId: 'session-1' }),
    slots: Object.freeze({
      baseline: Object.freeze({ fileName: 'rev-a.json' }),
      candidate: Object.freeze({ fileName: 'rev-b.json' }),
    }),
    compare: compareState(audit()),
    review: Object.freeze({
      session: reviewSession(), replacementRequired: false,
      filters: Object.freeze({
        reviewStates: Object.freeze(['REVIEWED', 'NEEDS_CLARIFICATION', 'UNRESOLVED']),
        categories: Object.freeze(['CHANGED', 'ADDED', 'REMOVED']),
        certainties: Object.freeze(['EXACT', 'AMBIGUOUS']), search: '',
      }),
    }),
    decision: Object.freeze({
      ledger: decisionLedger(),
      filters: Object.freeze({
        decisionStates: Object.freeze(['UNDECIDED', 'ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH', 'DEFERRED', 'REVOKED']),
        unresolvedOnly: false,
      }),
      preview: Object.freeze({ differenceId: null, candidateIndex: 0 }),
    }),
  });
}

function assertDashboard(state) {
  const readiness = revisionImpactReportReadiness(state);
  assert.equal(readiness.status, 'READY');
  const dashboard = revisionImpactDashboardModel(state);
  assert.equal(dashboard.full.coverage.fullRowCount, 4);
  assert.equal(dashboard.visible.coverage.exportedRowCount, 2);
  assert.equal(dashboard.full.summary.branches.find((entry) => entry.key === 'branch:NORTH').count, 2);
  assert.equal(dashboard.full.summary.geometryChanged, 1);
  assert.equal(dashboard.full.summary.unresolvedDecision, 1);
  assert.equal(dashboard.full.summary.unresolvedReview, 3);
}

async function assertArtifacts(state) {
  const full = await createRevisionImpactReport(state, 'FULL', webcrypto);
  const repeated = await createRevisionImpactReport(state, 'FULL', webcrypto);
  const visible = await createRevisionImpactReport(state, 'VISIBLE', webcrypto);
  assert.equal(full.reportId, repeated.reportId);
  assert.notEqual(full.reportId, visible.reportId);
  const selectionChanged = Object.freeze({ ...state, compare: Object.freeze({ ...state.compare, selectedDifferenceId: 'difference:a3:none' }) });
  const selectionReport = await createRevisionImpactReport(selectionChanged, 'FULL', webcrypto);
  assert.equal(full.reportId, selectionReport.reportId);
  assert.equal(full.rows.length, 4);
  assert.equal(visible.rows.length, 2);
  assert(Object.isFrozen(full));
  const csv = serializeRevisionImpactReportCsv(visible);
  assert.match(csv, /^recordType,section,key,value,differenceId/);
  assert.match(csv, /METRIC,metadata,scope,VISIBLE/);
  assert.match(csv, /DETAIL,differenceRows/);
  assert.match(csv, /difference:a1:b1/);
  assert.equal(csvTest.csvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(csvTest.csvCell(-12.5), '-12.5');
}

function assertMarkup(state) {
  const markup = revisionImpactReportMarkup(state);
  assert.match(markup, /REVISION IMPACT REPORT/);
  assert.match(markup, /4[^<]*All impact rows|All impact rows/);
  assert.match(markup, /data-revc-download-impact-json="FULL"/);
  assert.match(markup, /data-revc-download-impact-json="VISIBLE"/);
  assert.match(markup, /data-revc-download-impact-csv="FULL"/);
  assert.match(markup, /data-revc-download-impact-csv="VISIBLE"/);
  assert.match(markup, /<b>2<\/b> impact row\(s\) are hidden/);
}

async function assertDownloadActions(state) {
  const jsonDownloads = [];
  const textDownloads = [];
  const toasts = [];
  const failures = [];
  const actions = createRevisionImpactReportDownloadActions({
    root: Object.freeze({}), readState: () => state, cryptoRef: webcrypto,
    downloadArtifact: (_root, fileName, artifact) => jsonDownloads.push({ fileName, artifact }),
    downloadText: (_root, fileName, text, mimeType) => textDownloads.push({ fileName, text, mimeType }),
    showToast: (message, tone) => toasts.push({ message, tone }),
    reportFailure: (error) => failures.push(error),
  });
  await actions.downloadImpactJson('FULL');
  await actions.downloadImpactCsv('VISIBLE');
  assert.equal(failures.length, 0);
  assert.equal(jsonDownloads[0].fileName, 'session-1.impact-report.full.json');
  assert.equal(textDownloads[0].fileName, 'session-1.impact-report.visible.csv');
  assert.equal(textDownloads[0].mimeType, 'text/csv;charset=utf-8');
  assert.deepEqual(toasts, [
    { message: 'Full impact report JSON downloaded.', tone: 'success' },
    { message: 'Visible impact report CSV downloaded.', tone: 'success' },
  ]);
}

function assertEventRoute() {
  const calls = [];
  const button = {
    dataset: { revcDownloadImpactJson: 'VISIBLE' },
    hasAttribute: () => false,
    closest: () => button,
  };
  routeRevisionCompareActionClick({
    downloadImpactJson: (scope) => calls.push(scope),
    downloadImpactCsv: () => {},
    transferClick: () => {},
  }, button);
  assert.deepEqual(calls, ['VISIBLE']);
}

function assertBlocked(state) {
  const broken = Object.freeze({
    ...state,
    decision: Object.freeze({ ...state.decision, ledger: Object.freeze({ ...state.decision.ledger, auditId: 'other' }) }),
  });
  assert.equal(revisionImpactReportReadiness(broken).status, 'BLOCKED');
  assert.match(revisionImpactReportMarkup(broken), /data-revc-impact-report="blocked"/);
}

const state = workspace();
assertDashboard(state);
await assertArtifacts(state);
assertMarkup(state);
await assertDownloadActions(state);
assertEventRoute();
assertBlocked(state);
console.log('revision-impact-report: PASS');
