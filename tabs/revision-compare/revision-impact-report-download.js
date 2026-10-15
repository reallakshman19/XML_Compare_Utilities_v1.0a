/**
 * This component enables the Revision Impact Report by connecting report generation
 * to the existing browser JSON download path and the new CSV text download path.
 */
import { serializeRevisionImpactReportCsv } from './revision-impact-report-csv.js';
import { createRevisionImpactReport, REVISION_IMPACT_REPORT_SCOPES } from './revision-impact-report-model.js';

function normalizedScope(scope) {
  const value = String(scope ?? '').toUpperCase();
  if (!REVISION_IMPACT_REPORT_SCOPES.includes(value)) throw new RangeError(`Unknown impact report scope ${scope}.`);
  return value;
}

function safeName(value) {
  return String(value ?? 'revision-compare').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'revision-compare';
}

export function revisionImpactReportFileName(state, scope, extension) {
  const normalized = normalizedScope(scope).toLowerCase();
  const session = safeName(state?.session?.sessionId);
  const suffix = String(extension ?? '').replace(/^\./, '').toLowerCase();
  if (!['json', 'csv'].includes(suffix)) throw new RangeError(`Unsupported impact report extension ${extension}.`);
  return `${session}.impact-report.${normalized}.${suffix}`;
}

function authoritySnapshot(state, scope) {
  const visible = normalizedScope(scope) === 'VISIBLE';
  return Object.freeze({
    audit: state.compare.audit,
    reviewSession: state.review.session,
    decisionLedger: state.decision.ledger,
    slots: state.slots,
    compareQueue: visible ? state.compare.queue : null,
    reviewFilters: visible ? state.review.filters : null,
    decisionFilters: visible ? state.decision.filters : null,
  });
}

function authorityMatches(snapshot, state, scope) {
  const current = authoritySnapshot(state, scope);
  return Object.keys(snapshot).every((key) => snapshot[key] === current[key]);
}

function successMessage(format, scope) {
  return `${normalizedScope(scope) === 'VISIBLE' ? 'Visible' : 'Full'} impact report ${format} downloaded.`;
}

async function buildCurrentReport(context, scope) {
  const captured = context.readState();
  const snapshot = authoritySnapshot(captured, scope);
  const report = await createRevisionImpactReport(captured, scope, context.cryptoRef);
  if (!authorityMatches(snapshot, context.readState(), scope)) {
    throw new Error('Impact report authority changed during generation. Download the report again.');
  }
  return Object.freeze({ captured, report });
}

async function downloadJson(context, scope) {
  const result = await buildCurrentReport(context, scope);
  const fileName = revisionImpactReportFileName(result.captured, scope, 'json');
  context.downloadArtifact(context.root, fileName, result.report);
  context.showToast?.(successMessage('JSON', scope), 'success');
}

async function downloadCsv(context, scope) {
  const result = await buildCurrentReport(context, scope);
  const fileName = revisionImpactReportFileName(result.captured, scope, 'csv');
  const csv = serializeRevisionImpactReportCsv(result.report);
  context.downloadText(context.root, fileName, csv, 'text/csv;charset=utf-8');
  context.showToast?.(successMessage('CSV', scope), 'success');
}

function guarded(context, operation) {
  return async (scope) => {
    try {
      await operation(context, normalizedScope(scope));
    } catch (error) {
      context.reportFailure(error);
    }
  };
}

export function createRevisionImpactReportDownloadActions(context) {
  if (typeof context?.readState !== 'function') throw new TypeError('Impact report state reader is required.');
  if (typeof context?.downloadArtifact !== 'function') throw new TypeError('Impact report JSON downloader is required.');
  if (typeof context?.downloadText !== 'function') throw new TypeError('Impact report text downloader is required.');
  return Object.freeze({
    downloadImpactJson: guarded(context, downloadJson),
    downloadImpactCsv: guarded(context, downloadCsv),
  });
}

export const _test = Object.freeze({ authorityMatches, authoritySnapshot, normalizedScope, safeName, successMessage });
