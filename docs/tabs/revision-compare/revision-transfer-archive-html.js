/** Deterministic self-contained HTML projection of one transfer handover bundle. */
import { canonicalRevisionCompareEvidenceValue } from './revision-evidence-package.js';
import { stableStringify } from './revision-contract-utils.js';

export const REVISION_COMPARE_TRANSFER_ARCHIVE_BOUNDARY = 'This offline archive is a deterministic human-readable projection of the embedded Revision Compare transfer handover bundle. The HTML file and any browser-generated PDF do not replace, modify or authenticate the embedded JSON authorities.';
export const REVISION_COMPARE_TRANSFER_ARCHIVE_TRUST = 'The embedded patched-target completion is self-declared. Declarant identity, organizational authority and cryptographic authenticity are not established.';
const MISSING = '—';
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

export function escapeRevisionCompareTransferArchiveHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}
export function escapeRevisionCompareTransferArchiveJson(text) {
  return String(text).replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function shown(value) {
  if (value === null || value === undefined || value === '') return MISSING;
  return typeof value === 'object' ? stableStringify(value) : String(value);
}
function cell(value) { return `<td>${escapeRevisionCompareTransferArchiveHtml(shown(value))}</td>`; }
function table(caption, headings, rows) {
  const head = headings.map((item) => `<th scope="col">${escapeRevisionCompareTransferArchiveHtml(item)}</th>`).join('');
  const body = rows.length ? rows.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')
    : `<tr><td colspan="${headings.length}">${MISSING}</td></tr>`;
  return `<table><caption>${escapeRevisionCompareTransferArchiveHtml(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function facts(caption, entries) { return table(caption, ['Field', 'Value'], entries); }
function differenceRows(bundle) {
  return bundle.payload.evidencePackage?.payload?.audit?.differenceRows ?? [];
}
function reviewItems(bundle) { return bundle.payload.evidencePackage?.payload?.reviewSession?.items ?? []; }
function decisions(bundle) { return bundle.payload.evidencePackage?.payload?.decisionLedger?.decisions ?? []; }
function operationRows(bundle) { return bundle.payload.transferPlan?.operations ?? []; }
function selectionRows(bundle) {
  return (bundle.payload.transferPlan?.selection?.items ?? []).flatMap((item) =>
    (item.fields ?? []).map((field) => [item.differenceId, item.sourceRecordId, item.targetRecordId, field.propertyKey, field.targetFieldPath]));
}
function proofRows(bundle) { return Object.entries(bundle.payload.transferProof?.invariants ?? {}); }
function artifactRows(bundle) {
  return (bundle.payload.transferArtifacts ?? []).map((item) =>
    [item.filename, item.schema, item.mimeType, item.contentSha256, item.sizeBytes]);
}
function identityTables(bundle) {
  const payload = bundle.payload; const report = payload.completionReport; const result = payload.transferResult;
  const packageValue = payload.evidencePackage; const audit = packageValue?.payload?.audit;
  return [
    facts('Archive classification', [['Classification', 'PRESENTATION_ONLY'], ['HTML SHA-256', 'Descriptor-bound outside HTML'], ['HTML UTF-8 byte size', 'Descriptor-bound outside HTML']]),
    facts('Handover authority', [['Bundle ID', bundle.bundleId], ['Bundle SHA-256', bundle.contentSha256], ['Completion report ID', report?.reportId], ['Completion report SHA-256', report?.contentSha256], ['Session ID', bundle.identity?.sessionId]]),
    facts('Revision identities', [['Rev A document ID', payload.transferPlan?.sourceDocument?.documentId], ['Rev A SHA-256', payload.transferPlan?.sourceDocument?.contentSha256], ['Original Rev B document ID', result?.targetDocumentId], ['Original Rev B SHA-256', result?.originalTargetSha256], ['Patched Rev B document ID', result?.patchedTargetDocumentId], ['Patched Rev B SHA-256', result?.patchedTargetSha256]]),
    facts('Comparison authority', [['Basis ID', audit?.basisId], ['Engine version', audit?.engineVersion], ['Scope', payload.transferPlan?.scope], ['Audit summary', audit?.summary ?? { differenceCount: audit?.differenceRows?.length ?? 0 }]]),
  ].join('');
}
function registerTables(bundle) {
  return [
    table('Complete difference register', ['Difference ID', 'Category', 'Reason', 'Source', 'Target', 'Changed properties'], differenceRows(bundle).map((row) => [row.differenceId, row.differenceCategory, row.changeReason ?? row.reason, row.sourceRecordId ?? row.revARecordId, row.targetRecordId ?? row.revBRecordId, row.changedProperties ?? row.propertyDifferences])),
    table('Complete review register', ['Difference ID', 'Review state', 'Note', 'Updated at'], reviewItems(bundle).map((item) => [item.differenceId, item.reviewState, item.note, item.updatedAt])),
    table('Complete ambiguity-decision register', ['Difference ID', 'Decision', 'Target', 'Rationale', 'Updated at'], decisions(bundle).map((item) => [item.differenceId, item.decisionState, item.targetDifferenceId ?? item.acceptedTargetDifferenceId, item.rationale, item.updatedAt])),
    table('Transfer selection', ['Difference ID', 'Source record', 'Target record', 'Property', 'Target field path'], selectionRows(bundle)),
    table('Transfer operations', ['Operation ID', 'Type', 'Source entity', 'Target entity', 'Canonical target', 'Field', 'Before', 'After', 'Status'], operationRows(bundle).map((item) => [item.operationId, item.operationType, item.sourceEntityId, item.targetEntityId, item.targetCanonicalPath, item.fieldPath, Object.hasOwn(item, 'beforeValue') ? item.beforeValue : 'ABSENT', item.afterValue, item.status])),
    table('Applied transfer audit', ['Operation ID', 'Status', 'Source entity', 'Target entity', 'Field', 'Reason'], (bundle.payload.transferAudit?.rows ?? []).map((item) => [item.operationId, item.status, item.sourceEntityId, item.targetEntityId, item.fieldPath, item.reason])),
    table('Transfer proof invariants', ['Invariant', 'Result'], proofRows(bundle)),
    table('Transfer proof errors', ['Error'], (bundle.payload.transferProof?.errors ?? []).map((item) => [item])),
    table('Transfer artifact inventory', ['Filename', 'Schema', 'MIME type', 'SHA-256', 'UTF-8 bytes'], artifactRows(bundle)),
  ].join('');
}
function declarationTables(bundle) {
  const report = bundle.payload.completionReport; const declaration = report?.declaration ?? {};
  return facts('Patched-target completion declaration', [['Statement', declaration.statement], ['Declarant name', declaration.declarantName], ['Declarant role', declaration.declarantRole], ['Organization', declaration.organization], ['Declared at', declaration.declaredAt], ['Trust boundary', report?.trustBoundary?.statement]]);
}
function css() {
  return `:root{font-family:Arial,sans-serif;color:#111;background:#fff}body{margin:0 auto;max-width:1200px;padding:24px}header,section{margin-bottom:24px}h1,h2{break-after:avoid}p{line-height:1.45}table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:12px}caption{text-align:left;font-weight:700;font-size:15px;margin-bottom:6px}th,td{border:1px solid #777;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eee}.boundary{border:2px solid #333;padding:12px}.mono{font-family:ui-monospace,monospace}@page{size:A4;margin:12mm}@media print{body{padding:0}table{break-inside:auto}tr{break-inside:avoid}}`;
}
export function renderRevisionCompareTransferArchiveHtml(bundle) {
  const canonical = canonicalRevisionCompareEvidenceValue(bundle, 'transferArchiveBundle');
  const embedded = escapeRevisionCompareTransferArchiveJson(JSON.stringify(canonical));
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Revision Compare Offline Transfer Archive</title>\n<style>${css()}</style>\n</head>\n<body>\n<header><p>REVISION COMPARE</p><h1>Offline transfer archive</h1><p class="boundary">${escapeRevisionCompareTransferArchiveHtml(REVISION_COMPARE_TRANSFER_ARCHIVE_BOUNDARY)}</p><p class="boundary">${escapeRevisionCompareTransferArchiveHtml(REVISION_COMPARE_TRANSFER_ARCHIVE_TRUST)}</p></header>\n<main>${identityTables(canonical)}${registerTables(canonical)}${declarationTables(canonical)}</main>\n<script id="revision-compare-transfer-handover" type="application/json">${embedded}</script>\n</body>\n</html>\n`;
}
export function extractRevisionCompareTransferArchiveBundle(html) {
  const match = String(html).match(/<script id="revision-compare-transfer-handover" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Offline transfer archive does not contain the inert handover bundle.');
  return JSON.parse(match[1]);
}
export const _test = Object.freeze({ artifactRows, declarationTables, differenceRows, registerTables, selectionRows, shown, table });
