function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function numberText(value, digits = 6) {
  const number = finite(value);
  return number == null ? '—' : Number(number.toFixed(digits)).toString();
}
function keyText(value) {
  return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
}
function vectorText(value, keys, labels) {
  if (!value || typeof value !== 'object' || !keys.every((key) => finite(value[key]) != null)) return null;
  return keys.map((key, index) => `${labels[index]} ${numberText(value[key])}`).join(' · ');
}
function arrayText(values, depth) {
  if (!values.length) return 'empty';
  if (values.every((value) => finite(value) != null)) return values.map((value) => numberText(value)).join(', ');
  return values.map((value, index) => {
    const item = engineeringValueText(value, depth + 1);
    return value && typeof value === 'object' ? `#${index + 1} ${item}` : item;
  }).join(' | ');
}
function objectText(value, depth) {
  const xyz = vectorText(value, ['x', 'y', 'z'], ['X', 'Y', 'Z']); if (xyz) return xyz;
  const dxyz = vectorText(value, ['dx', 'dy', 'dz'], ['ΔX', 'ΔY', 'ΔZ']); if (dxyz) return dxyz;
  if (depth >= 3) return 'structured value';
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (!entries.length) return 'empty';
  return entries.map(([key, item]) => `${keyText(key)} ${engineeringValueText(item, depth + 1)}`).join(' · ');
}
function engineeringValueText(value, depth = 0) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return numberText(value);
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return arrayText(value, depth);
  if (typeof value === 'object') return objectText(value, depth);
  return String(value);
}
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function humanToken(value) { return keyText(value).toUpperCase(); }
function valueMarkup(value) { return `<span class="ciiw-engineering-value">${h(engineeringValueText(value))}</span>`; }
function limitationsMarkup(row) {
  const limitations = row?.limitations || [];
  if (!limitations.length && !row?.authority) return '';
  return `<details><summary>${h(row?.evidenceStatus || 'EVIDENCE')} evidence</summary>${row?.authority ? `<p><b>Authority:</b> ${h(row.authority)}</p>` : ''}${limitations.length ? `<ul>${limitations.map((item) => `<li>${h(item)}</li>`).join('')}</ul>` : ''}</details>`;
}
function transferOperationMap(current) {
  const rows = [...(current?.transferPlan?.operations || []), ...(current?.transferPlan?.excludedOperations || [])]
    .filter((item) => item?.engineeringDeltaId);
  return new Map(rows.map((item) => [String(item.engineeringDeltaId), item]));
}
function boundReviewAuthority(current, correspondenceId) {
  const id = String(correspondenceId || '');
  if ((current?.review?.lockedCorrespondenceIds || []).includes(id)) return 'LOCKED';
  if ((current?.review?.reviewedCorrespondenceIds || []).includes(id)) return 'APPROVED';
  return null;
}
function operationOutcome(operation, writerReady) {
  if (!operation) return null;
  const before = operation.before;
  if (operation.scopeDecision === 'EXCLUDE') return { state: 'EXCLUDED', effective: before, proposed: operation.proposed, willApply: false };
  if (operation.action === 'KEEP') return { state: 'KEEP', effective: before, proposed: operation.proposed, willApply: false };
  if (operation.status === 'PROTECTED') return { state: 'PROTECTED', effective: before, proposed: operation.proposed, willApply: false };
  if (operation.status === 'BLOCKED') return { state: 'BLOCKED', effective: before, proposed: operation.proposed, willApply: false };
  if (!writerReady) return { state: 'WRITER 1B BLOCKED', effective: before, proposed: operation.proposed, willApply: false };
  if (operation.status === 'PREVIEW_READY') return { state: 'WILL APPLY', effective: operation.proposed, proposed: operation.proposed, willApply: true };
  return { state: humanToken(operation.status || 'NOT READY'), effective: before, proposed: operation.proposed, willApply: false };
}
export function ciiDeltaTransferOutcome(current, delta, approval = 'PENDING') {
  const currentTarget = delta?.targetValue;
  const approved = approval === 'APPROVED' || approval === 'LOCKED';
  if (!approved) return Object.freeze({ state: approval === 'REJECTED' ? 'REJECTED' : 'PENDING APPROVAL', effective: currentTarget, proposed: null, willApply: false });
  const bound = boundReviewAuthority(current, delta?.correspondenceId);
  const operation = transferOperationMap(current).get(String(delta?.deltaId || '')) || null;
  if (!bound) return Object.freeze({ state: 'REBUILD PREVIEW', effective: currentTarget, proposed: operation?.proposed ?? delta?.sourceValue, willApply: false });
  if (!operation) return Object.freeze({ state: 'NO QUALIFIED OPERATION', effective: currentTarget, proposed: null, willApply: false });
  return Object.freeze(operationOutcome(operation, current?.writerReadiness?.ready === true));
}
function changeText(row) {
  const semantic = humanToken(row?.semanticChange || (row?.changed ? 'CHANGED' : 'UNCHANGED'));
  if (typeof row?.delta === 'number') return `${semantic} · TARGET − SOURCE = ${numberText(row.delta)}`;
  if (row?.delta !== null && row?.delta !== undefined) return `${semantic} · ${engineeringValueText(row.delta)}`;
  return semantic;
}
function effectiveMarkup(outcome) {
  const value = outcome?.willApply && outcome?.effective == null ? 'CLEARED / REMOVED' : engineeringValueText(outcome?.effective);
  const proposal = !outcome?.willApply && outcome?.proposed !== null && outcome?.proposed !== undefined
    ? `<small>Proposal: ${h(engineeringValueText(outcome.proposed))}</small>` : '';
  return `<b>${h(value)}</b><small>${h(outcome?.state || '—')}</small>${proposal}`;
}
export function ciiEngineeringChangesMarkup(changes = []) {
  if (!changes.length) return '<p>No qualified engineering changes for this correspondence.</p>';
  return `<table><thead><tr><th>Category / property</th><th>SOURCE candidate</th><th>Current TARGET</th><th>Engineering change</th><th>Evidence</th></tr></thead><tbody>${changes.map((row) => `<tr><td><b>${h(row.category)}</b><small>${h(row.property)}</small></td><td>${valueMarkup(row.sourceValue)}</td><td>${valueMarkup(row.targetValue)}</td><td>${h(changeText(row))}</td><td><b>${h(row.evidenceStatus)}</b>${limitationsMarkup(row)}</td></tr>`).join('')}</tbody></table>`;
}
export function ciiEngineeringDeltaMarkup(current, approvalResolver = () => 'PENDING') {
  const rows = current?.engineeringDeltas?.changedRows || [];
  const reviewRows = new Map((current?.compareReview?.rows || []).map((row) => [row.correspondenceId, row]));
  if (!rows.length) return '<p>No qualified engineering changes were detected.</p>';
  return `<table class="ciiw-grid"><thead><tr><th>Approval</th><th>Identity</th><th>Category / property</th><th>SOURCE candidate</th><th>Current TARGET</th><th>Effective TARGET after apply</th><th>Engineering change</th><th>Evidence / authority</th></tr></thead><tbody>${rows.map((row) => {
    const reviewRow = reviewRows.get(row.correspondenceId); const approval = reviewRow ? approvalResolver(reviewRow) : 'PENDING';
    const outcome = ciiDeltaTransferOutcome(current, row, approval);
    return `<tr><td><b>${h(approval)}</b><small>${h(row.identityConfidence)}</small></td><td><b>S ${h(row.sourceIdentity)}</b><small>→ T ${h(row.targetIdentity)}</small></td><td><b>${h(row.category)}</b><small>${h(row.property)}</small></td><td>${valueMarkup(row.sourceValue)}</td><td>${valueMarkup(row.targetValue)}</td><td>${effectiveMarkup(outcome)}</td><td>${h(changeText(row))}</td><td><b>${h(row.evidenceStatus)}</b>${limitationsMarkup(row)}</td></tr>`;
  }).join('')}</tbody></table>`;
}
export function ciiTransferPreviewMarkup(current) {
  const plan = current?.transferPlan; if (!plan) return '<p>Build and approve correspondence before transfer preview.</p>';
  const operations = plan.operations || []; const byAction = plan.summary?.byAction || {}; const review = current?.compareReview?.summary?.review || {};
  const readiness = current?.writerReadiness || { ready: false, blockers: ['Writer 1B readiness unavailable.'] };
  const banner = readiness.ready
    ? '<div class="ciiw-transfer-banner"><b>TARGET MUTATION · WRITER 1B READY</b><span>Effective TARGET values below are the values that will exist if the current approved plan is applied.</span></div>'
    : '<div class="ciiw-transfer-banner"><b>TRANSFER PREVIEW · BLOCKED</b><span>Effective TARGET remains the current TARGET while Writer 1B is blocked. Proposed SOURCE values remain visible for review.</span></div>';
  const table = operations.length ? `<table class="ciiw-grid"><thead><tr><th>Action</th><th>Family / property</th><th>SOURCE candidate</th><th>Current TARGET</th><th>Effective TARGET after apply</th><th>Approval authority</th><th>Writer status / blockers</th></tr></thead><tbody>${operations.map((item) => {
    const outcome = operationOutcome(item, readiness.ready === true);
    const sourceValue = item.sourceEvidence?.value ?? item.proposed;
    return `<tr><td><b>${h(item.action || '—')}</b><small>${h(item.custody || '—')}</small></td><td><b>${h(item.family || '—')}</b><small>${h(item.property)}</small></td><td>${valueMarkup(sourceValue)}</td><td>${valueMarkup(item.before)}</td><td>${effectiveMarkup(outcome)}</td><td><b>${h(item.matchAuthority?.status || '—')}</b><small>${h(item.matchAuthority?.candidateStatus || '')}</small></td><td><b>${h(item.status)}</b><small>${h((item.blockers || []).join(' · ') || 'No row blocker')}</small></td></tr>`;
  }).join('')}</tbody></table>` : '<p>No approved transfer-preview operations are currently proposed.</p>';
  const writerBlockers = readiness.blockers?.length ? `<p><b>Writer 1B blockers:</b> ${h(readiness.blockers.join(' · '))}</p>` : '';
  const planBlockers = plan.blockers?.length ? `<p><b>Plan blockers:</b> ${h(plan.blockers.join(' · '))}</p>` : '';
  return `${banner}<p><b>Preview plan:</b> ${h(plan.status)} · <b>Writer 1B:</b> ${h(readiness.status || 'BLOCKED')} · <b>Approval basis:</b> ${h(review.accepted || 0)} accepted · ${h(review.locked || 0)} locked · ${h(review.rejected || 0)} rejected · ${h(review.pending || 0)} pending.</p><p>${h(plan.summary?.operationCount || 0)} operations · COPY ${h(byAction.COPY || 0)} · CREATE ${h(byAction.CREATE || 0)} · DELETE ${h(byAction.DELETE || 0)} · KEEP ${h(byAction.KEEP || 0)} · ${h(plan.summary?.protectedCount || 0)} protected · ${h(plan.summary?.blockedCount || 0)} blocked</p>${planBlockers}${writerBlockers}${table}<button type="button" ${readiness.ready ? '' : 'disabled'} data-ciiw-apply-target>Apply approved Writer 1B changes to target CII</button>`;
}

export { engineeringValueText as ciiEngineeringValueText };
export const _test = Object.freeze({ operationOutcome, changeText, engineeringValueText });
