import { ciiEvidenceBandStyle, ciiNodeNameBandStyle } from './cii-workspace-evidence-band-style.js';
import { ciiMultiSourceSourceTargetAuditMarkup } from './cii-workspace-source-target-audit-ui.js';
import { ciiMultiSourceReviewStateControlHostMarkup } from './cii-workspace-multisource-review-state-controls.js';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function decisionFromRow(row) {
  if (row?.decision === 'LOCKED' || row?.workflowStatus === 'LOCKED') return 'LOCK';
  if (row?.decision === 'ACCEPTED') return 'ACCEPT';
  if (row?.decision === 'REJECTED') return 'REJECT';
  return '';
}
function effectiveDecision(row, decisions) {
  return decisions?.get?.(String(row?.correspondenceId || '')) || decisionFromRow(row);
}
function reviewRows(preview) { return preview?.compareReview?.rows || []; }
function lockedRow(row) { return row?.decision === 'LOCKED' || row?.workflowStatus === 'LOCKED'; }
function bulkEligible(row, decisions, confidence) {
  return row?.confidence === confidence && row?.identityBound === true && !lockedRow(row)
    && effectiveDecision(row, decisions) !== 'ACCEPT';
}
function evidenceBandClass(band) {
  const level = Math.max(0, Math.min(4, Number(band?.level || 0)));
  return `level-${level}`;
}
function nameBandClass(evidence) {
  const kind = String(evidence?.kind || 'UNAVAILABLE').toLowerCase();
  return ['exact', 'canonical', 'partial', 'none'].includes(kind) ? kind : 'unavailable';
}
function fmt(value, digits = 1) {
  const number = Number(value); return Number.isFinite(number) ? Number(number.toFixed(digits)).toString() : '—';
}
function confidenceReason(row) {
  if (row?.decision === 'LOCKED' || row?.workflowStatus === 'LOCKED') return 'Manual reviewed anchor authority.';
  if (row?.adjacentBoundary) {
    const boundary = row.adjacentBoundary;
    if (row?.confidence === 'HIGH') return `HIGH: ${boundary.highCount}/${boundary.requiredHighCount} adjacent matched elements independently carry HIGH identity evidence; this NODE is their shared boundary.`;
    return `REVIEW: adjacent boundary consensus is ${boundary.highCount}/${boundary.requiredHighCount} HIGH; explicit engineering review is required.`;
  }
  if (row?.componentIdentity) {
    const component = row.componentIdentity;
    if (!component.pointerCustodyQualified) return `REVIEW: RIGID pointer custody is not qualified${component.blockers?.length ? ` (${component.blockers.join(', ')})` : ''}.`;
    if (!component.parentIdentityBound) return 'REVIEW: parent ELEMENT identity is not bound by qualified evidence.';
    if (row?.confidence === 'HIGH') return `HIGH: parent ELEMENT identity is ${component.parentConfidence} and RIGID pointer custody is qualified on both sides.`;
    return `REVIEW: RIGID component follows a bound parent ELEMENT at ${component.parentConfidence}; explicit engineering review remains required.`;
  }
  const m1 = row?.methodA; const m2 = row?.methodB; const od = row?.od; const name = row?.nodeName;
  const base = row?.methodABase;
  const weightage = base?.weights ? ' Applied weights: residual ' + fmt(base.weights.residualQuality)
    + ', conditioning ' + fmt(base.weights.conditioning)
    + ', extent ' + fmt(base.weights.spatialExtent)
    + ', redundancy ' + fmt(base.weights.redundancy)
    + ', consensus ' + fmt(base.weights.basisConsensus) + '.' : '';
  if (base && ['HIGH', 'MEDIUM'].includes(row?.confidence)) {
    return `${row.confidence}: qualified Method A base ${fmt(base.score)}/100 from ${base.anchorCount} anchors (HIGH ≥ ${fmt(base.highThreshold)}, MEDIUM ≥ ${fmt(base.mediumThreshold)}). Geometry: residual ${fmt(base.residualQuality)}, conditioning ${fmt(base.conditioning)}, extent ${fmt(base.spatialExtent)}, redundancy ${fmt(base.redundancy)}, consensus ${fmt(base.basisConsensus)}.${weightage}`;
  }
  if (row?.confidence === 'HIGH') {
    if (m1?.available === false) return name?.match
      ? 'HIGH: M1 registration is underdetermined; M2 + OD <10% + Node Name corroboration agree.'
      : 'HIGH: M1 registration is underdetermined; strong M2 network evidence + OD <10% agree.';
    if (m1?.pass && m2?.pass) return 'HIGH: independent M1 and M2 identity evidence agree and OD error is <10%.';
    return 'HIGH: identity is bound by qualified evidence; direct M1/M2 detail is not projected on this row.';
  }
  if (row?.confidence === 'MEDIUM') {
    if (od?.confidence === 'MEDIUM') return 'MEDIUM: identity is supported, but OD error is between 10% and 50%.';
    if (m1?.available === false) return 'MEDIUM: identity is supported but only one independent identity method is available.';
    if (m1 && !m1.pass && m2?.pass) return 'MEDIUM: network identity passes while qualified spatial evidence indicates geometry change.';
    return 'MEDIUM: identity is supported but the evidence set is not strong enough for HIGH.';
  }
  if (row?.candidateStatus === 'AMBIGUOUS' || row?.frontierBlocker) {
    const notes = [];
    const gap = (value, required, label) => {
      if (typeof value !== 'number' || !Number.isFinite(value)
        || typeof required !== 'number' || !Number.isFinite(required)) return null;
      return `${label} gap ${fmt(value)} ${value < required ? '<' : '≥'} required ${fmt(required)}`;
    };
    const frontierGap = gap(row?.frontierGap, row?.frontierRequiredGap, 'frontier winner');
    const candidateGap = gap(row?.winnerGap, row?.requiredWinnerGap, 'candidate winner');
    if (frontierGap) notes.push(frontierGap);
    if (candidateGap) notes.push(candidateGap);
    if (row?.frontierBlocker) notes.push(`frontier blocker: ${row.frontierBlocker}`);
    const reasons = Array.isArray(row?.reasons) ? row.reasons.filter(Boolean) : [];
    if (reasons.length) notes.push(`candidate reasons: ${reasons.join(', ')}`);
    if (row?.frontierBlocker && !row?.target) notes.push('no TARGET ELEMENT assigned at this frontier');
    return `REVIEW: ${row?.frontierBlocker ? 'propagation frontier blocked' : 'candidate is ambiguous'}${notes.length ? `; ${notes.join('; ')}` : '; specific cause unavailable'}.`;
  }
  if (od?.confidence === 'REVIEW') return `REVIEW: OD evidence is ${od?.available ? `outside 50% (${fmt(od.percentError)}%)` : 'unavailable'}.`;
  if (m1?.pass && !m2?.pass) return 'REVIEW: M1 passes but M2 network does not independently support the pair.';
  if (!row?.identityBound) return 'REVIEW: correspondence identity is not bound by qualified evidence.';
  return 'REVIEW: explicit engineering decision required.';
}
function boundarySideLabel(label, side) {
  if (!side) return `${label} unavailable`;
  const m1 = side.m1Pass == null ? 'M1 —' : `M1 ${side.m1Pass ? 'PASS' : 'FAIL'}`;
  const m2 = side.m2Pass == null ? 'M2 —' : `M2 ${side.m2Pass ? 'PASS' : 'FAIL'}`;
  const od = side.odConfidence ? `OD ${side.odConfidence}${side.odPercentError == null ? '' : ` ${fmt(side.odPercentError)}%`}` : 'OD —';
  return `${label} ${side.confidence} · ${m1} · ${m2} · ${od}`;
}
function evidenceMarkup(row) {
  if (row?.adjacentBoundary) {
    const boundary = row.adjacentBoundary;
    const band = { level: row?.confidence === 'HIGH' ? 4 : 2 };
    const label = `ADJACENT CONSENSUS · ${boundary.highCount}/${boundary.requiredHighCount} HIGH`;
    return `<div class="ciiw-evidence-stack"><div><span class="ciiw-evidence-band ${evidenceBandClass(band)}" style="${ciiEvidenceBandStyle(band.level)}">${h(label)}</span></div><small>${h(boundarySideLabel('LEFT', boundary.left))}</small><small>${h(boundarySideLabel('RIGHT', boundary.right))}</small><small class="ciiw-confidence-reason">${h(confidenceReason(row))}</small></div>`;
  }
  if (row?.componentIdentity) {
    const component = row.componentIdentity;
    const level = row?.confidence === 'HIGH' ? 4 : (row?.confidence === 'MEDIUM' ? 3 : 2);
    const pointer = component.pointerCustodyQualified ? 'POINTER CUSTODY PASS' : 'POINTER CUSTODY BLOCKED';
    const label = `RIGID COMPONENT · PARENT ${component.parentConfidence} · ${pointer}`;
    return `<div class="ciiw-evidence-stack"><div><span class="ciiw-evidence-band ${evidenceBandClass({ level })}" style="${ciiEvidenceBandStyle(level)}">${h(label)}</span></div><small>Parent ${h(component.parentCorrespondenceId || '—')} · ${component.parentIdentityBound ? 'BOUND' : 'UNBOUND'}</small><small class="ciiw-confidence-reason">${h(confidenceReason(row))}</small></div>`;
  }
  if (row?.methodABase && ['HIGH', 'MEDIUM'].includes(row?.confidence)) {
    const base = row.methodABase;
    const level = row.confidence === 'HIGH' ? 4 : 3;
    const band = { level };
    return `<div class="ciiw-evidence-stack"><div><span class="ciiw-evidence-band ${evidenceBandClass(band)}" style="${ciiEvidenceBandStyle(level)}">METHOD A BASE · ${h(fmt(base.score))}/100 · ${h(row.confidence)}</span></div><small>Qualified ${h(base.anchorCount)} anchors · HIGH ≥ ${h(fmt(base.highThreshold))} · MEDIUM ≥ ${h(fmt(base.mediumThreshold))}</small><small>Applied weightage: ${h(base.weights ? Object.values(base.weights).join(' / ') : 'default 35 / 25 / 20 / 10 / 10')} (residual / conditioning / extent / redundancy / consensus).</small><small>Direct M1/M2/OD corroboration not projected on this anchor row.</small><small class="ciiw-confidence-reason">${h(confidenceReason(row))}</small></div>`;
  }
  const m1 = row?.methodA; const m2 = row?.methodB; const od = row?.od; const name = row?.nodeName; const band = row?.corroborationBand;
  const m1Label = !m1 ? 'M1 —' : (m1.available === false ? `M1 N/A${m1.registrationStatus ? ` ${m1.registrationStatus}` : ''}` : `M1 ${m1.pass ? 'PASS' : 'FAIL'} ${fmt(m1.distanceMm)} / ${fmt(m1.toleranceMm)} mm`);
  const m2Label = !m2 ? 'M2 —' : `M2 ${m2.pass ? 'PASS' : 'FAIL'} ${fmt(m2.score)} / ${fmt(m2.threshold)}`;
  const odLabel = od?.available ? `OD ${od.confidence || (od.pass ? 'HIGH' : 'REVIEW')} ${fmt(od.percentError)}%` : 'OD REVIEW N/A';
  const nameLabel = name?.available === false || !name ? 'NAME N/A' : `NAME ${name.kind}${name.availableEndpointCount ? ` ${name.matchedEndpointCount}/${name.availableEndpointCount}` : ''}`;
  return `<div class="ciiw-evidence-stack"><div><span class="ciiw-evidence-band ${evidenceBandClass(band)}" style="${ciiEvidenceBandStyle(band?.level)}">${h(band?.label || 'RED')} · ${h(band?.score ?? 0)}/${h(band?.max ?? 0)}</span><span class="ciiw-name-band ${nameBandClass(name)}" style="${ciiNodeNameBandStyle(nameBandClass(name))}">${h(nameLabel)}</span></div><small>${h(m1Label)} · ${h(m2Label)} · ${h(odLabel)}</small><small class="ciiw-confidence-reason">${h(confidenceReason(row))}</small></div>`;
}
function filterRow(row, filters = {}) {
  const confidence = String(filters.confidence || 'ALL');
  if (confidence !== 'ALL') {
    if (confidence === 'LOCKED') {
      if (row?.decision !== 'LOCKED' && row?.workflowStatus !== 'LOCKED') return false;
    } else if (row?.confidence !== confidence) return false;
  }
  if (filters.changedOnly && !row?.changeCount) return false;
  const search = String(filters.search || '').trim().toLowerCase();
  if (!search) return true;
  const haystack = [row?.sourceId, row?.source, row?.target, row?.kind, row?.confidence, row?.identityEvidenceBasis, row?.nodeName?.kind, ...(row?.identityReasons || []), ...(row?.changeFamilies || [])].join(' ').toLowerCase();
  return haystack.includes(search);
}
function decisionControl(row, decisions) {
  const current = effectiveDecision(row, decisions);
  if (row?.decision === 'LOCKED' || row?.workflowStatus === 'LOCKED') return '<span class="ciiw-pill">LOCKED</span>';
  return `<select data-ciiw-ms-decision="${h(row?.correspondenceId)}"><option value="">Review…</option><option value="LOCK" ${current === 'LOCK' ? 'selected' : ''}>Lock</option><option value="ACCEPT" ${current === 'ACCEPT' ? 'selected' : ''}>Accept</option><option value="REJECT" ${current === 'REJECT' ? 'selected' : ''}>Reject</option></select>`;
}

export function seedCiiMultiSourceReviewDecisions(preview, decisions = new Map()) {
  decisions.clear();
  for (const row of reviewRows(preview)) {
    const value = decisionFromRow(row);
    if (value) decisions.set(String(row.correspondenceId), value);
  }
  return decisions;
}

function memberReviewLedgers(preview) {
  return new Map((preview?.memberPreviews || []).map(({ sourceId, preview: member }) => [String(sourceId || ''), member?.review || null]));
}
export function ciiMultiSourceReviewBySource(preview, decisions) {
  const ledgers = memberReviewLedgers(preview); const result = {};
  for (const row of reviewRows(preview)) {
    const sourceId = String(row?.sourceId || ''); const memberId = String(row?.memberCorrespondenceId || '');
    if (!sourceId || !memberId) continue;
    if (!result[sourceId]) result[sourceId] = {
      ...(ledgers.get(sourceId) || {}),
      reviewedCorrespondenceIds: [], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [],
    };
    const decision = effectiveDecision(row, decisions);
    if (decision === 'LOCK') result[sourceId].lockedCorrespondenceIds.push(memberId);
    else if (decision === 'ACCEPT') result[sourceId].reviewedCorrespondenceIds.push(memberId);
    else if (decision === 'REJECT') result[sourceId].rejectedCorrespondenceIds.push(memberId);
  }
  return result;
}

export function ciiMultiSourceBulkEligibleRows(preview, decisions, confidence) {
  const label = String(confidence || '').toUpperCase();
  return Object.freeze(reviewRows(preview).filter((row) => bulkEligible(row, decisions, label)));
}

export function ciiMultiSourceReviewState(preview, decisions = new Map()) {
  const rows = reviewRows(preview);
  const confidence = { HIGH: 0, MEDIUM: 0, REVIEW: 0, UNRESOLVED: 0 };
  const current = { ACCEPT: 0, LOCK: 0, REJECT: 0, PENDING: 0 };
  const changed = { ACCEPT: 0, LOCK: 0, REJECT: 0, PENDING: 0 };
  let locked = 0; let changedDecisionCount = 0;
  for (const row of rows) {
    if (lockedRow(row)) locked += 1;
    else confidence[row?.confidence] = (confidence[row?.confidence] || 0) + 1;
    const baseline = decisionFromRow(row); const effective = effectiveDecision(row, decisions); const key = effective || 'PENDING';
    current[key] = (current[key] || 0) + 1;
    if (baseline !== effective) {
      changedDecisionCount += 1; changed[key] = (changed[key] || 0) + 1;
    }
  }
  const eligible = Object.freeze({
    HIGH: ciiMultiSourceBulkEligibleRows(preview, decisions, 'HIGH').length,
    MEDIUM: ciiMultiSourceBulkEligibleRows(preview, decisions, 'MEDIUM').length,
  });
  return Object.freeze({
    rowCount: rows.length,
    confidence: Object.freeze(confidence),
    locked,
    eligible,
    current: Object.freeze(current),
    changed: Object.freeze(changed),
    changedDecisionCount,
    synchronized: changedDecisionCount === 0,
  });
}

export function bulkAcceptCiiMultiSourceReview(preview, decisions, confidence) {
  const rows = ciiMultiSourceBulkEligibleRows(preview, decisions, confidence);
  for (const row of rows) decisions.set(String(row.correspondenceId), 'ACCEPT');
  return rows.length;
}

export function ciiMultiSourceLockedReviewCount(preview) {
  return reviewRows(preview).filter(lockedRow).length;
}

export function ciiMultiSourceBulkAcceptOutcome(preview, decisions, confidence) {
  const label = String(confidence || '').toUpperCase();
  const count = bulkAcceptCiiMultiSourceReview(preview, decisions, label);
  const state = ciiMultiSourceReviewState(preview, decisions);
  if (count) return Object.freeze({
    count, changed: true, locked: state.locked, state,
    message: `${count} eligible ${label} correspondence row${count === 1 ? '' : 's'} marked Accept. ${state.changedDecisionCount} decision change${state.changedDecisionCount === 1 ? '' : 's'} remain unapplied. Apply approvals to Transfer Preview to rebuild correspondence and Writer2 scope.`,
  });
  return Object.freeze({
    count: 0, changed: false, locked: state.locked, state,
    message: `No ${label} correspondence rows would change. ${state.locked} reviewed anchor row(s) are LOCKED; already-accepted rows are not counted as eligible. Transfer Preview was not changed.`,
  });
}

export function ciiMultiSourceReviewMarkup(preview, decisions = new Map(), filters = {}) {
  const auditMarkup = ciiMultiSourceSourceTargetAuditMarkup(preview, decisions);
  const rows = reviewRows(preview).filter((row) => filterRow(row, filters));
  if (!reviewRows(preview).length) return `<p>No correspondence rows were produced. Recheck the per-source base authority and correspondence blockers.</p>${auditMarkup}`;
  if (!rows.length) return `<p>No correspondence rows match the current filters.</p>${auditMarkup}`;
  const reviewTable = `<table class="ciiw-grid" data-ciiw-ms-review-table="1"><thead><tr><th>Decision</th><th>Source set member</th><th>Kind</th><th>Confidence</th><th>Evidence basis</th><th>SOURCE</th><th>TARGET</th><th>Changed</th><th>Identity</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${decisionControl(row, decisions)}</td><td><b>${h(row.sourceId)}</b></td><td>${h(row.kind || '—')}</td><td><span class="ciiw-confidence ${String(row.confidence || 'review').toLowerCase()}">${h(row.confidence || '—')}</span><small>${h(row.workflowStatus || row.decision || '—')}</small></td><td>${evidenceMarkup(row)}</td><td>${h(row.source || '—')}</td><td>${h(row.target || '—')}</td><td>${row.changeCount ? `<b>${h(row.changeCount)}</b><small>${h((row.changeFamilies || []).join(', '))}</small>` : '—'}</td><td>${row.identityBound ? 'BOUND' : 'REVIEW'}</td></tr>`).join('')}</tbody></table>`;
  return `${reviewTable}${auditMarkup}`;
}

export function ciiMultiSourceReviewSummaryMarkup(preview, decisions = new Map()) {
  const state = ciiMultiSourceReviewState(preview, decisions);
  const pending = state.changedDecisionCount
    ? `<p class="ciiw-family-summary" data-ciiw-ms-review-state="PENDING"><b>${h(state.changedDecisionCount)} unapplied decision change${state.changedDecisionCount === 1 ? '' : 's'}.</b> Pending delta: Accept ${h(state.changed.ACCEPT)} · Lock ${h(state.changed.LOCK)} · Reject ${h(state.changed.REJECT)}. Apply approvals to Transfer Preview before binding Writer2 scope.</p>`
    : '<p class="ciiw-family-summary" data-ciiw-ms-review-state="SYNCHRONIZED"><b>Review decisions synchronized with the current Transfer Preview.</b></p>';
  return `<div class="ciiw-kpis" data-ciiw-ms-review-summary="1"><div><b>${h(state.rowCount)}</b><span>Rows</span></div><div><b>${h(state.confidence.HIGH || 0)}</b><span>HIGH</span></div><div><b>${h(state.eligible.HIGH)}</b><span>HIGH eligible</span></div><div><b>${h(state.confidence.MEDIUM || 0)}</b><span>MEDIUM</span></div><div><b>${h(state.eligible.MEDIUM)}</b><span>MEDIUM eligible</span></div><div><b>${h(state.confidence.REVIEW || 0)}</b><span>REVIEW</span></div><div><b>${h(state.locked)}</b><span>Locked</span></div><div><b>${h(state.current.ACCEPT)}</b><span>Accepted</span></div><div><b>${h(state.current.REJECT)}</b><span>Rejected</span></div><div><b>${h(state.current.PENDING)}</b><span>Undecided</span></div><div><b>${h(state.changedDecisionCount)}</b><span>Unapplied</span></div></div>${pending}${ciiMultiSourceReviewStateControlHostMarkup(state)}`;
}

export const _test = Object.freeze({ decisionFromRow, effectiveDecision, filterRow, memberReviewLedgers, lockedRow, bulkEligible });