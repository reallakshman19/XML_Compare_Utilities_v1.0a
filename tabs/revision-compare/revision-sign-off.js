/** Deterministic self-declared completion report bound to one evidence package. */
import { assertJsonSafe, deepFreeze } from './revision-contract-utils.js';
import {
  canonicalRevisionCompareEvidenceValue, createRevisionCompareEvidencePackage,
  revisionCompareEvidencePackageReadiness,
} from './revision-evidence-package.js';
import { sha256Text } from './revision-hash.js';
import { REVIEW_SESSION_SCHEMA, reviewSummary } from './revision-review-contracts.js';
import { reviewSessionMatchesAudit } from './revision-review-session.js';
import { DECISION_LEDGER_SCHEMA, decisionSummary } from './revision-decision-contracts.js';
import { decisionLedgerMatchesAudit } from './revision-decision-ledger.js';

export const REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA = 'RevisionCompareSignOffReport.v1';
export const REVISION_COMPARE_SIGN_OFF_STATE_SCHEMA = 'RevisionCompareSignOffState.v1';
export const REVISION_COMPARE_SIGN_OFF_ID_PREFIX = 'revision-sign-off:';
export const REVISION_COMPARE_SIGN_OFF_DECLARATION = 'I confirm that I reviewed the complete Revision Compare evidence set identified by this report and that all review items and ambiguity decisions are resolved in the recorded states.';
export const REVISION_COMPARE_SIGN_OFF_TRUST_STATEMENT = 'This is a self-declared review completion record. Declarant identity and cryptographic authenticity are not established.';
export const REVISION_COMPARE_SIGN_OFF_STATUS = Object.freeze({
  IDLE: 'IDLE', READY: 'READY', CREATED: 'CREATED', STALE: 'STALE', FAILED: 'FAILED',
});

function sameCanonicalValue(left, right) {
  return JSON.stringify(canonicalRevisionCompareEvidenceValue(left))
    === JSON.stringify(canonicalRevisionCompareEvidenceValue(right));
}
function activeSourceLoad(state) {
  return state?.slots?.baseline?.status === 'LOADING' || state?.slots?.candidate?.status === 'LOADING';
}
function activeComparison(state) {
  return ['PROJECTING', 'COMPARING', 'BUILDING_VISUAL'].includes(state?.compare?.status);
}
function reviewErrors(state, errors) {
  const audit = state?.compare?.audit; const session = state?.review?.session;
  if (!session || session.schema !== REVIEW_SESSION_SCHEMA) errors.push('Completion declaration requires a ReviewSession.v1.');
  else if (session.status !== 'CURRENT') errors.push('Completion declaration requires a CURRENT review session.');
  else if (!reviewSessionMatchesAudit(session, audit)) errors.push('The review session does not match the exact audit.');
  if (!session?.items || !sameCanonicalValue(session.summary, reviewSummary(session.items))) errors.push('Review summary does not reconcile with review items.');
  if ((session?.summary?.unreviewed ?? 1) !== 0) errors.push('Every review item must be marked REVIEWED; unreviewed items remain.');
  if ((session?.summary?.needsClarification ?? 1) !== 0) errors.push('Review items needing clarification must be resolved.');
  if ((session?.summary?.unresolved ?? 1) !== 0) errors.push('Unresolved review items must be resolved.');
  if (session?.items?.some((item) => item.reviewState !== 'REVIEWED')) errors.push('Every review item must have reviewState REVIEWED.');
}
function decisionErrors(state, errors) {
  const audit = state?.compare?.audit; const ledger = state?.decision?.ledger;
  if (!ledger || ledger.schema !== DECISION_LEDGER_SCHEMA) errors.push('Completion declaration requires an AmbiguityDecisionLedger.v1.');
  else if (ledger.status !== 'CURRENT') errors.push('Completion declaration requires a CURRENT decision ledger.');
  else if (!decisionLedgerMatchesAudit(ledger, audit)) errors.push('The decision ledger does not match the exact audit.');
  if (!ledger?.decisions || !sameCanonicalValue(ledger.summary, decisionSummary(ledger.decisions))) errors.push('Decision summary does not reconcile with decision items.');
  if ((ledger?.summary?.undecided ?? 1) !== 0) errors.push('Every ambiguity decision must be resolved; undecided items remain.');
  if ((ledger?.summary?.deferred ?? 1) !== 0) errors.push('Deferred ambiguity decisions must be resolved.');
  if ((ledger?.summary?.revoked ?? 1) !== 0) errors.push('Revoked ambiguity decisions must be resolved again.');
  if ((ledger?.summary?.remainingNeedsDecision ?? 1) !== 0) errors.push('Ambiguity decisions still require resolution.');
  if (ledger?.decisions?.some((item) => !['ACCEPTED_CANDIDATE', 'CONFIRMED_NO_MATCH'].includes(item.decisionState))) errors.push('Every decision item must be ACCEPTED_CANDIDATE or CONFIRMED_NO_MATCH.');
}
function readinessErrors(state) {
  const errors = []; const audit = state?.compare?.audit;
  if (state?.basisStatus !== 'CURRENT' || !state?.basis) errors.push('Completion declaration requires a CURRENT comparison basis.');
  if (audit?.schema !== 'RevisionCompareAudit.v1' || audit?.validation?.status !== 'READY') errors.push('Completion declaration requires a READY RevisionCompareAudit.v1.');
  reviewErrors(state, errors); decisionErrors(state, errors);
  const packageReadiness = revisionCompareEvidencePackageReadiness(state);
  if (packageReadiness.status !== 'READY') errors.push(`Evidence package is not export-ready: ${packageReadiness.blockers[0]}`);
  if (activeSourceLoad(state)) errors.push('Wait for active revision source loading to finish.');
  if (activeComparison(state)) errors.push('Wait for the active comparison run to finish.');
  if (state?.evidencePackageImport?.status === 'IMPORTING') errors.push('Wait for evidence-package import verification to finish.');
  if (state?.transferReview?.draft?.pairs?.length || state?.transfer?.selection || state?.transfer?.plan
      || ['APPLYING', 'APPLIED', 'STALE'].includes(state?.transfer?.status)) {
    errors.push('Completion declaration does not cover transfer intent, plans, or patched target output; use the retained transfer result and proof.');
  }
  return errors;
}
export function revisionCompareSignOffReadiness(state) {
  const blockers = Object.freeze(readinessErrors(state));
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers });
}
function normalizedField(value, label, maximum, required) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new RangeError(`${label} is required.`);
  if (text.length > maximum) throw new RangeError(`${label} is limited to ${maximum} characters.`);
  return text;
}
export function normalizeRevisionCompareSignOffDeclarant(input = {}) {
  return deepFreeze({
    declarantName: normalizedField(input.declarantName, 'Declarant name', 120, true),
    declarantRole: normalizedField(input.declarantRole, 'Declarant role', 120, true),
    organization: normalizedField(input.organization, 'Organization', 160, false),
  });
}
function validDeclaredAt(value) {
  const parsed = typeof value === 'string' && value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new RangeError('declaredAt must be a valid ISO timestamp.');
  return value;
}
function reportMaterial(evidencePackage, declarant, declaredAt) {
  const payload = evidencePackage.payload; const identity = evidencePackage.identity;
  return {
    schema: REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA,
    sourceEvidence: {
      packageId: evidencePackage.packageId, packageContentSha256: evidencePackage.contentSha256,
      ...identity, reviewRevision: payload.reviewSession.revision, decisionRevision: payload.decisionLedger.revision,
    },
    completion: {
      status: 'COMPLETE', reviewSummary: payload.reviewSession.summary,
      decisionSummary: payload.decisionLedger.summary, blockers: [],
    },
    declaration: { ...declarant, statement: REVISION_COMPARE_SIGN_OFF_DECLARATION, declaredAt },
    trustBoundary: {
      identityStatus: 'SELF_DECLARED', authenticityStatus: 'NOT_ESTABLISHED',
      statement: REVISION_COMPARE_SIGN_OFF_TRUST_STATEMENT,
    },
    validation: { status: 'READY', errors: [] },
  };
}
export async function createRevisionCompareSignOffReport(state, preflight, input, declaredAt, cryptoRef) {
  const readiness = revisionCompareSignOffReadiness(state);
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const declarant = normalizeRevisionCompareSignOffDeclarant(input); const timestamp = validDeclaredAt(declaredAt);
  const evidencePackage = await createRevisionCompareEvidencePackage(state, preflight, cryptoRef);
  const material = canonicalRevisionCompareEvidenceValue(reportMaterial(evidencePackage, declarant, timestamp), 'signOffMaterial');
  const contentSha256 = await sha256Text(JSON.stringify(material), cryptoRef);
  const report = deepFreeze(canonicalRevisionCompareEvidenceValue({
    ...material, reportId: `${REVISION_COMPARE_SIGN_OFF_ID_PREFIX}${contentSha256}`, contentSha256,
  }, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA));
  assertJsonSafe(report, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA); return report;
}
export function serializeRevisionCompareSignOffReport(report) {
  if (report?.schema !== REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA) throw new TypeError('A RevisionCompareSignOffReport.v1 is required.');
  const canonical = canonicalRevisionCompareEvidenceValue(report, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA);
  assertJsonSafe(canonical, REVISION_COMPARE_SIGN_OFF_REPORT_SCHEMA); return `${JSON.stringify(canonical, null, 2)}\n`;
}
export function revisionCompareSignOffFileName(sessionId, reportId) {
  const session = String(sessionId ?? '').trim(); const report = String(reportId ?? '').trim();
  if (!session || !report) throw new TypeError('Session ID and report ID are required for the completion report filename.');
  const safe = (value) => value.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${safe(session)}.${safe(report)}.json`;
}
export function createRevisionCompareSignOffState() {
  return deepFreeze({ schema: REVISION_COMPARE_SIGN_OFF_STATE_SCHEMA, status: 'IDLE', report: null, sourcePackageId: null, sourcePackageContentSha256: null, error: null });
}
export function signOffStateForReadiness(state) {
  if (state?.signOff?.report) return state.signOff;
  const status = revisionCompareSignOffReadiness(state).status === 'READY' ? 'READY' : 'IDLE';
  return deepFreeze({ ...createRevisionCompareSignOffState(), status });
}
export function staleRevisionCompareSignOffState(signOff) {
  if (!signOff?.report || signOff.status === 'STALE') return signOff ?? createRevisionCompareSignOffState();
  return deepFreeze({ ...signOff, status: 'STALE', error: null });
}
export function revisionCompareSignOffAuthorityMatches(before, after) {
  return before?.basis === after?.basis && before?.compare?.audit === after?.compare?.audit
    && before?.review?.session === after?.review?.session && before?.decision?.ledger === after?.decision?.ledger
    && revisionCompareSignOffReadiness(after).status === 'READY';
}
function appendText(documentRef, parent, tag, text, attribute, value) {
  const node = documentRef.createElement(tag); node.textContent = text;
  if (attribute) node.setAttribute(attribute, value ?? ''); parent.appendChild(node); return node;
}
function appendField(documentRef, form, labelText, selector, maximum) {
  const label = appendText(documentRef, form, 'label', labelText); const input = documentRef.createElement('input');
  input.type = 'text'; input.maxLength = maximum; input.setAttribute(selector, ''); label.appendChild(input); return input;
}
function appendReportFacts(documentRef, section, report) {
  const facts = documentRef.createElement('dl');
  for (const [label, value, selector] of [
    ['Report ID', report.reportId, 'data-revc-sign-off-report-id'], ['Report SHA-256', report.contentSha256, 'data-revc-sign-off-sha'],
    ['Source package ID', report.sourceEvidence.packageId, 'data-revc-sign-off-package-id'], ['Declarant name', report.declaration.declarantName],
    ['Declarant role', report.declaration.declarantRole], ['Organization', report.declaration.organization || '—'], ['Declared at', report.declaration.declaredAt],
  ]) { appendText(documentRef, facts, 'dt', label); appendText(documentRef, facts, 'dd', value, selector); }
  section.appendChild(facts);
}
function appendDeclarationForm(documentRef, section, buttonLabel, buttonSelector) {
  const form = documentRef.createElement('div'); form.setAttribute('data-revc-sign-off-form', '');
  appendField(documentRef, form, 'Declarant name', 'data-revc-sign-off-name', 120);
  appendField(documentRef, form, 'Declarant role', 'data-revc-sign-off-role', 120);
  appendField(documentRef, form, 'Organization (optional)', 'data-revc-sign-off-organization', 160);
  const confirmLabel = appendText(documentRef, form, 'label', REVISION_COMPARE_SIGN_OFF_DECLARATION);
  const confirm = documentRef.createElement('input'); confirm.type = 'checkbox'; confirm.setAttribute('data-revc-sign-off-confirm', ''); confirmLabel.prepend(confirm);
  const button = appendText(documentRef, form, 'button', buttonLabel, buttonSelector); button.type = 'button'; button.disabled = true;
  section.appendChild(form);
}
export function renderRevisionCompareSignOffSection(root, state) {
  const host = root.querySelector('.revc-review-side'); if (!host) return null;
  const documentRef = root.ownerDocument; const section = documentRef.createElement('section'); section.className = 'revc-review-session'; section.setAttribute('data-revc-sign-off', state.signOff.status.toLowerCase());
  appendText(documentRef, section, 'h2', 'Review completion declaration');
  appendText(documentRef, section, 'p', REVISION_COMPARE_SIGN_OFF_TRUST_STATEMENT, 'data-revc-sign-off-trust');
  const readiness = revisionCompareSignOffReadiness(state);
  if (readiness.blockers.length) { const list = documentRef.createElement('ul'); list.setAttribute('data-revc-sign-off-blockers', ''); readiness.blockers.forEach((item) => appendText(documentRef, list, 'li', item)); section.appendChild(list); }
  if (state.signOff.report) appendReportFacts(documentRef, section, state.signOff.report);
  if (state.signOff.status === 'CREATED') {
    const button = appendText(documentRef, section, 'button', 'Download completion report', 'data-revc-download-sign-off'); button.type = 'button';
  } else {
    if (state.signOff.report) {
      appendText(documentRef, section, 'p', 'This historical completion report no longer matches the current evidence package.', 'data-revc-sign-off-stale');
      const download = appendText(documentRef, section, 'button', 'Download completion report', 'data-revc-download-sign-off'); download.type = 'button'; download.disabled = true;
    }
    appendDeclarationForm(documentRef, section, state.signOff.report ? 'Create new completion declaration' : 'Create completion declaration', state.signOff.report ? 'data-revc-create-new-sign-off' : 'data-revc-create-sign-off');
  }
  host.appendChild(section); return section;
}
export function revisionCompareSignOffInput(root) {
  return {
    declarantName: root.querySelector('[data-revc-sign-off-name]')?.value ?? '',
    declarantRole: root.querySelector('[data-revc-sign-off-role]')?.value ?? '',
    organization: root.querySelector('[data-revc-sign-off-organization]')?.value ?? '',
    confirmed: Boolean(root.querySelector('[data-revc-sign-off-confirm]')?.checked),
  };
}
export function syncRevisionCompareSignOffControls(root, state, busy = false) {
  const input = revisionCompareSignOffInput(root); let valid = input.confirmed;
  try { normalizeRevisionCompareSignOffDeclarant(input); } catch { valid = false; }
  const disabled = busy || revisionCompareSignOffReadiness(state).status !== 'READY' || !valid;
  root.querySelectorAll('[data-revc-create-sign-off],[data-revc-create-new-sign-off]').forEach((button) => { button.disabled = disabled; });
}

export const _test = Object.freeze({ readinessErrors, reportMaterial, sameCanonicalValue });
