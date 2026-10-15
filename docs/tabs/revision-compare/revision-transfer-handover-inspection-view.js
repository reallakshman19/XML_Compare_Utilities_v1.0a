/** Bounded accessible read-only UI for verified imported transfer handovers. */
import { REVISION_COMPARE_HANDOVER_ARTIFACT_ROLES } from './revision-transfer-handover-inspection.js';
import { revisionCompareHandoverInspectionReadiness } from './revision-transfer-handover-inspection-workspace-state.js';

export const REVISION_COMPARE_HANDOVER_INSPECTION_BOUNDARY = 'This view independently verifies and displays an imported Revision Compare transfer handover bundle. It does not reattach the bundle to an editable workspace, authenticate a signer, establish organizational authority, or make the imported transfer current application authority.';
const CSS = '.revc-handover-inspection{display:grid;gap:1rem;padding:1rem;border:1px solid var(--border,#445);border-radius:.75rem}.revc-handover-inspection dl{display:grid;grid-template-columns:minmax(12rem,auto) 1fr;gap:.45rem 1rem}.revc-handover-inspection dt{font-weight:700}.revc-handover-inspection dd{margin:0;overflow-wrap:anywhere}.revc-handover-artifacts{width:100%;border-collapse:collapse}.revc-handover-artifacts th,.revc-handover-artifacts td{padding:.4rem;border:1px solid var(--border,#445);vertical-align:top;overflow-wrap:anywhere}';
function element(documentRef, tag, text, attributes = {}) {
  const value = documentRef.createElement(tag); if (text !== undefined) value.textContent = String(text);
  for (const [name, attribute] of Object.entries(attributes)) value.setAttribute(name, String(attribute));
  return value;
}
function appendFact(documentRef, list, label, value, selector) {
  const term = element(documentRef, 'dt', label); const description = element(documentRef, 'dd', value ?? '—');
  if (selector) description.setAttribute(selector, ''); list.append(term, description);
}
function inspectionFacts(state) {
  const value = state.handoverInspection; const bundle = value.bundle; const payload = bundle.payload;
  const plan = payload.transferPlan; const result = payload.transferResult; const report = payload.completionReport;
  return [
    ['Bundle schema', bundle.schema, 'data-revc-handover-bundle-schema'],
    ['Bundle ID', value.bundleId, 'data-revc-handover-bundle-id'],
    ['Bundle content SHA-256', value.bundleContentSha256, 'data-revc-handover-bundle-sha'],
    ['Session ID', bundle.identity.sessionId, 'data-revc-handover-session-id'],
    ['Evidence package ID', value.evidencePackageId, 'data-revc-handover-package-id'],
    ['Evidence package SHA-256', value.evidencePackageContentSha256, 'data-revc-handover-package-sha'],
    ['Completion report ID', value.completionReportId, 'data-revc-handover-completion-id'],
    ['Completion report SHA-256', value.completionReportContentSha256, 'data-revc-handover-completion-sha'],
    ['Plan ID', value.planId, 'data-revc-handover-plan-id'],
    ['Plan SHA-256', value.planContentSha256, 'data-revc-handover-plan-sha'],
    ['Result ID', value.resultId, 'data-revc-handover-result-id'],
    ['Result SHA-256', value.resultContentSha256, 'data-revc-handover-result-sha'],
    ['Original target document ID', value.originalTargetDocumentId, 'data-revc-handover-original-id'],
    ['Original target SHA-256', value.originalTargetSha256, 'data-revc-handover-original-sha'],
    ['Patched target document ID', value.patchedTargetDocumentId, 'data-revc-handover-patched-id'],
    ['Patched target SHA-256', value.patchedTargetSha256, 'data-revc-handover-patched-sha'],
    ['Operation count', plan.operations.length, 'data-revc-handover-operation-count'],
    ['Applied count', result.summary.appliedOperationCount, 'data-revc-handover-applied-count'],
    ['Skipped count', result.summary.skippedOperationCount, 'data-revc-handover-skipped-count'],
    ['Blocked count', result.summary.blockedOperationCount, 'data-revc-handover-blocked-count'],
    ['Audit row count', payload.transferAudit.rows.length, 'data-revc-handover-audit-count'],
    ['Proof invariant count', Object.keys(payload.transferProof.invariants).length, 'data-revc-handover-proof-count'],
    ['Artifact count', payload.transferArtifacts.length, 'data-revc-handover-artifact-count'],
    ['Self-declared declarant name', report.declaration.declarantName, 'data-revc-handover-declarant-name'],
    ['Self-declared declarant role', report.declaration.declarantRole, 'data-revc-handover-declarant-role'],
    ['Self-declared organization', report.declaration.organization || '—', 'data-revc-handover-organization'],
    ['Declared at', report.declaration.declaredAt, 'data-revc-handover-declared-at'],
    ['Completion declaration', report.declaration.statement, 'data-revc-handover-declaration'],
    ['Completion trust statement', report.trustBoundary.statement, 'data-revc-handover-trust-boundary'],
    ['Bundle validation status', bundle.validation.status, 'data-revc-handover-validation-status'],
  ];
}
function artifactTable(documentRef, bundle) {
  const table = element(documentRef, 'table', undefined, { class: 'revc-handover-artifacts' });
  table.appendChild(element(documentRef, 'caption', 'Embedded transfer artifact inventory'));
  const head = element(documentRef, 'thead'); const row = element(documentRef, 'tr');
  for (const heading of ['Role', 'Filename', 'Schema', 'MIME type', 'UTF-8 bytes', 'SHA-256', 'Action']) {
    row.appendChild(element(documentRef, 'th', heading, { scope: 'col' }));
  }
  head.appendChild(row); table.appendChild(head); const body = element(documentRef, 'tbody');
  bundle.payload.transferArtifacts.forEach((item, index) => {
    const role = REVISION_COMPARE_HANDOVER_ARTIFACT_ROLES[index]; const itemRow = element(documentRef, 'tr');
    for (const value of [role, item.filename, item.schema, item.mimeType, item.sizeBytes, item.contentSha256]) {
      itemRow.appendChild(element(documentRef, 'td', value));
    }
    const action = element(documentRef, 'td'); const button = element(documentRef, 'button', 'Download', {
      type: 'button', 'data-revc-download-imported-transfer-artifact': index,
      'aria-label': `Download ${role.toLowerCase().replaceAll('_', ' ')} artifact ${item.filename}`,
    });
    action.appendChild(button); itemRow.appendChild(action); body.appendChild(itemRow);
  });
  table.appendChild(body); return table;
}
function fileControl(documentRef, section, readiness) {
  const blocker = readiness.blockers[0] ?? '';
  if (blocker) section.appendChild(element(documentRef, 'p', blocker, { 'data-revc-handover-readiness-blocker': '', id: 'revc-handover-readiness' }));
  const label = element(documentRef, 'label', 'Verify one canonical transfer handover JSON file');
  const input = element(documentRef, 'input', undefined, {
    type: 'file', accept: 'application/json,.json', 'data-revc-handover-file': '',
    'aria-describedby': 'revc-handover-readiness',
  });
  input.multiple = false; input.disabled = readiness.status !== 'READY';
  label.appendChild(input); section.appendChild(label);
}
function actionControls(documentRef, section, inspection) {
  if (inspection.status === 'VERIFIED') {
    section.appendChild(element(documentRef, 'button', 'Download verified handover', {
      type: 'button', 'data-revc-download-imported-handover': '',
      'aria-label': 'Download the canonical verified transfer handover bundle',
    }));
  }
  if (inspection.status !== 'IDLE') {
    section.appendChild(element(documentRef, 'button', 'Clear handover inspection', {
      type: 'button', 'data-revc-clear-handover-inspection': '',
    }));
  }
}
export function renderRevisionCompareHandoverInspectionSection(root, state, options = {}) {
  root.querySelector('[data-revc-handover-inspection]')?.remove();
  const host = root.querySelector('.revc-review-side') ?? root.querySelector('.revc-body'); if (!host) return null;
  const documentRef = root.ownerDocument; const inspection = state.handoverInspection;
  const readiness = revisionCompareHandoverInspectionReadiness(state, { ...(options.activity ?? {}), allowImportSupersede: true });
  const section = element(documentRef, 'section', undefined, { class: 'revc-handover-inspection', 'data-revc-handover-inspection': '' });
  const style = element(documentRef, 'style', CSS); section.appendChild(style);
  section.appendChild(element(documentRef, 'h2', 'Verified transfer handover inspection'));
  section.appendChild(element(documentRef, 'p', REVISION_COMPARE_HANDOVER_INSPECTION_BOUNDARY, { 'data-revc-handover-boundary': '' }));
  section.appendChild(element(documentRef, 'strong', inspection.status, {
    role: 'status', 'aria-live': 'polite', 'data-revc-handover-status': '',
  }));
  fileControl(documentRef, section, readiness);
  if (inspection.error) section.appendChild(element(documentRef, 'p', inspection.error, {
    role: 'alert', tabindex: '-1', 'data-revc-handover-error': '',
  }));
  if (inspection.bundle) {
    const facts = element(documentRef, 'dl');
    inspectionFacts(state).forEach(([label, value, selector]) => appendFact(documentRef, facts, label, value, selector));
    section.append(facts, artifactTable(documentRef, inspection.bundle));
  }
  actionControls(documentRef, section, inspection); host.appendChild(section);
  section.querySelector('[data-revc-handover-error]')?.focus(); return section;
}
