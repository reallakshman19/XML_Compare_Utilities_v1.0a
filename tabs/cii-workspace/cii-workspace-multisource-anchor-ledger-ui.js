import {buildCiiMultiSourceActiveAuthorityPlan} from './cii-workspace-multisource-anchor-mode.js';
import {
  ciiQualifiedLoopsForSuggestion,
  ciiSuggestionSelectionKey,
} from './cii-workspace-base-loop-selection.js';
import { ciiEvidenceBandStyle, ciiNodeNameBandStyle } from './cii-workspace-evidence-band-style.js';
import {
  ciiAnchorProposalActionHostMarkup,
  ciiAnchorProposalKey,
} from './cii-workspace-anchor-proposal-actions.js';

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function manualPairs(manualBySource, sourceId) {
  return [...(manualBySource?.get?.(sourceId) || [])];
}

function automaticAuthorityRows(inspection, selectedBySource) {
  const rows = new Map();
  for (const member of inspection?.memberInspections || []) {
    const sourceId = String(member.sourceId || '');
    const selected = selectedBySource?.get?.(sourceId) || new Set();
    for (const suggestion of member?.inspection?.baseAnchorSuggestions || []) {
      const selectionKey = ciiSuggestionSelectionKey(suggestion);
      if (!selected.has(selectionKey)) continue;
      for (const loop of ciiQualifiedLoopsForSuggestion(suggestion)) {
        for (const pair of loop.anchorPairs || []) {
          const row = {
            sourceId,
            authority: loop.method === 'METHOD_A_SPATIAL' ? 'METHOD A' : 'METHOD B',
            sourceNodeId: String(pair.sourceNodeId || ''),
            targetNodeId: String(pair.targetNodeId || ''),
            selectionKey,
            baseId: String(loop.baseId || ''),
          };
          const key = `${sourceId}|${row.authority}|${row.baseId}|${row.sourceNodeId}|${row.targetNodeId}`;
          if (!rows.has(key)) rows.set(key, row);
        }
      }
    }
  }
  return [...rows.values()];
}

function manualAuthorityRows(inspection, manualBySource) {
  return (inspection?.memberInspections || []).flatMap((member) => manualPairs(manualBySource, member.sourceId)
    .map((pair, index) => ({
      sourceId: String(member.sourceId || ''),
      authority: 'USER LOCKED',
      sourceNodeId: String(pair.sourceNodeId || ''),
      targetNodeId: String(pair.targetNodeId || ''),
      manualIndex: index,
    })));
}

function fmt(value, digits = 3) {
  const number = Number(value); return Number.isFinite(number) ? Number(number.toFixed(digits)).toString() : '—';
}
function nodeNameBandClass(evidence) {
  const kind = String(evidence?.kind || 'UNAVAILABLE').toLowerCase();
  return ['exact', 'canonical', 'partial', 'none'].includes(kind) ? kind : 'unavailable';
}
function evidenceBandClass(band) {
  const level = Math.max(0, Math.min(4, Number(band?.level || 0)));
  return `level-${level}`;
}
function proposalSessionKey(inspection) {
  const sourceSetSha256 = String(inspection?.sourceSet?.sourceSetSha256 || '');
  if (sourceSetSha256) return sourceSetSha256;
  return (inspection?.memberInspections || []).map((member) => `${member?.sourceId || ''}:${member?.fileName || ''}`).join('|') || 'session';
}
function approvedProposalKeys(inspection, manualBySource) {
  const keys = new Set();
  for (const member of inspection?.memberInspections || []) {
    const sourceId = String(member?.sourceId || '');
    for (const pair of manualPairs(manualBySource, sourceId)) keys.add(ciiAnchorProposalKey(sourceId, pair.sourceNodeId, pair.targetNodeId));
  }
  return keys;
}
function proposalRationaleRows(inspection, manualBySource = new Map()) {
  const approved = approvedProposalKeys(inspection, manualBySource);
  return (inspection?.memberInspections || []).flatMap((member) => (member?.inspection?.baseAnchorSuggestions || []).map((row) => {
    const discovery = row?.candidateGeneration?.reviewDiscovery || null;
    const sourceRun = row?.methodB?.source?.runs?.[0] || null; const targetRun = row?.methodB?.target?.runs?.[0] || null;
    const sourceAxes = discovery?.sourceAxisCount ?? Number(row?.methodB?.source?.independentAxisRunCount || 0);
    const targetAxes = discovery?.targetAxisCount ?? Number(row?.methodB?.target?.independentAxisRunCount || 0);
    const network = discovery?.oneAxisCompatible
      ? `${sourceRun?.axisLabel || 'axis'} ${fmt(discovery.sourceLengthMm)} mm ↔ ${targetRun?.axisLabel || 'axis'} ${fmt(discovery.targetLengthMm)} mm · Δ ${fmt(discovery.lengthDeltaMm)} mm · tol ${fmt(discovery.toleranceMm)} mm · 1/1 corroboration only`
      : (row?.methodB?.status === 'READY' ? `${sourceAxes}/${targetAxes} independent axes · Method B ${row?.basisMethod === 'METHOD_B_NETWORK' || row?.basisMethod === 'METHOD_A_AND_B' ? 'qualified' : 'review'}` : 'No qualified network corroboration');
    const methodA = row?.methodA?.status === 'READY'
      ? `PASS · registered max residual ${fmt(row?.methodA?.bestBase?.maxResidualMm)} mm`
      : `N/A · ${String(row?.methodA?.reason || row?.methodA?.status || 'no qualified non-collinear base').replaceAll('_', ' ')}`;
    const authority = (row?.basisMethod === 'METHOD_A_SPATIAL' || row?.basisMethod === 'METHOD_B_NETWORK' || row?.basisMethod === 'METHOD_A_AND_B')
      ? `${row.confidence || 'REVIEW'} · ${String(row.basisMethod).replaceAll('_', ' ')}`
      : `REVIEW · ${sourceAxes}/${targetAxes} axes; automatic Method B requires at least 2/2`;
    const nameEvidence = row?.nodeNameEvidence || discovery?.nodeNameEvidence || null;
    const od = row?.odConfidence || discovery?.odConfidence || null;
    const sourceId = String(member?.sourceId || ''); const sourceNodeId = String(row?.sourceNodeId || ''); const targetNodeId = String(row?.targetNodeId || '');
    const proposalKey = ciiAnchorProposalKey(sourceId, sourceNodeId, targetNodeId);
    return {
      sourceId, sourceNodeId, targetNodeId, proposalKey, approved: approved.has(proposalKey),
      sourceNodeName: String(discovery?.sourceNodeName || nameEvidence?.sourceRaw || ''), targetNodeName: String(discovery?.targetNodeName || nameEvidence?.targetRaw || ''),
      canonicalKey: String(discovery?.canonicalKey || nameEvidence?.canonicalKey || ''), nameEvidence, od, methodA, network, authority,
      band: row?.corroborationBand || null, discovery: Boolean(discovery),
    };
  }));
}
function proposalRationaleMarkup(inspection, manualBySource = new Map()) {
  const rows = proposalRationaleRows(inspection, manualBySource);
  if (!rows.length) return '';
  const sessionKey = proposalSessionKey(inspection);
  return `<section class="ciiw-ms-proposal-rationale" data-ciiw-ms-proposal-rationale="1"><header><div><b>Anchor proposal rationale</b><span>Every proposal shows the evidence that made it greener or kept it in review</span></div><span class="ciiw-corroboration">WHY PROPOSED</span></header><p>Node Name is corroboration/discovery only and never creates identity authority by itself. Smart normalization is conservative to SL/PS family + primary number. Automatic Method B still requires at least two independent axes on SOURCE and TARGET. <b>Approve anchor</b> creates only the exact reviewed pair as USER LOCKED authority.</p><table class="ciiw-mini-grid"><thead><tr><th>Source</th><th>Proposed pair</th><th>Evidence band</th><th>Node Name</th><th>M1 spatial</th><th>M2 network</th><th>OD band</th><th>Authority</th><th>Review state</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr data-ciiw-ms-proposal-row="1" data-ciiw-ms-proposal-key="${h(row.proposalKey)}" data-ciiw-ms-proposal-source-id="${h(row.sourceId)}" data-ciiw-ms-proposal-source-node="${h(row.sourceNodeId)}" data-ciiw-ms-proposal-target-node="${h(row.targetNodeId)}" data-ciiw-ms-proposal-state="${row.approved ? 'APPROVED' : 'PENDING'}"><td><b>${h(row.sourceId)}</b></td><td><b>${h(row.sourceNodeId)} ↔ ${h(row.targetNodeId)}</b></td><td><span class="ciiw-evidence-band ${evidenceBandClass(row.band)}" style="${ciiEvidenceBandStyle(row.band?.level)}">${h(row.band?.label || 'RED')} · ${h(row.band?.score ?? 0)}/${h(row.band?.max ?? 0)}</span></td><td>${row.nameEvidence?.available !== false ? `<span class="ciiw-name-band ${nodeNameBandClass(row.nameEvidence)}" style="${ciiNodeNameBandStyle(nodeNameBandClass(row.nameEvidence))}">${h(row.nameEvidence?.kind || 'NONE')}</span><small>${h(row.sourceNodeName || '—')} ↔ ${h(row.targetNodeName || '—')}${row.canonicalKey ? ` · ${h(row.canonicalKey)}` : ''}</small>` : '—'}</td><td>${h(row.methodA)}</td><td>${h(row.network)}</td><td>${row.od?.available ? `<span class="ciiw-confidence ${String(row.od.confidence || 'review').toLowerCase()}">${h(row.od.confidence)}</span><small>${h(row.od.percentError)}% · ${h(fmt(row.od.source))} ↔ ${h(fmt(row.od.target))}</small>` : '<span class="ciiw-confidence review">REVIEW</span><small>OD unavailable</small>'}</td><td>${h(row.authority)}</td><td><b data-ciiw-ms-proposal-state>${row.approved ? 'APPROVED · USER LOCKED' : 'PENDING REVIEW'}</b></td><td class="ciiw-ms-ledger-actions"><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-proposal-action="approve" ${row.approved ? 'disabled' : ''}>Approve anchor</button><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-proposal-action="inspect">Inspect</button><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-proposal-action="reject" ${row.approved ? 'disabled' : ''}>Reject</button></td></tr>`).join('')}</tbody></table>${ciiAnchorProposalActionHostMarkup(sessionKey)}</section>`;
}

export function ciiMultiSourceAnchorLedgerRows(inspection, selectedBySource, manualBySource) {
  return Object.freeze([
    ...manualAuthorityRows(inspection, manualBySource),
    ...automaticAuthorityRows(inspection, selectedBySource),
  ]);
}

function summary(inspection, rows) {
  const memberIds = (inspection?.memberInspections || []).map((item) => String(item.sourceId || ''));
  const covered = new Set(rows.map((row) => row.sourceId));
  const manualCount = rows.filter((row) => row.authority === 'USER LOCKED').length;
  const automaticRows = rows.filter((row) => row.authority !== 'USER LOCKED');
  const automaticPairCount = automaticRows.length;
  const automaticBaseCount = new Set(automaticRows.map((row) => `${row.sourceId}|${row.selectionKey || row.baseId || ''}`)).size;
  return {
    memberCount: memberIds.length,
    coveredCount: memberIds.filter((id) => covered.has(id)).length,
    manualCount,
    automaticCount: automaticPairCount,
    automaticPairCount,
    automaticBaseCount,
  };
}

function manualRowMarkup(row, active) {
  return `<tr data-ciiw-ms-anchor-ledger-row="manual" data-ciiw-ms-ledger-lane="${active ? 'ACTIVE' : 'RETAINED'}"><td><b>${h(row.sourceId)}</b></td><td><span class="ciiw-corroboration">USER LOCKED</span></td>
<td><input class="ciiw-ms-ledger-node" type="text" inputmode="numeric" value="${h(row.sourceNodeId)}" aria-label="${h(row.sourceId)} SOURCE anchor node" data-ciiw-ms-ledger-source data-ciiw-ms-ledger-source-id="${h(row.sourceId)}" data-ciiw-ms-ledger-index="${h(row.manualIndex)}"></td>
<td><input class="ciiw-ms-ledger-node" type="text" inputmode="numeric" value="${h(row.targetNodeId)}" aria-label="${h(row.sourceId)} TARGET anchor node" data-ciiw-ms-ledger-target data-ciiw-ms-ledger-source-id="${h(row.sourceId)}" data-ciiw-ms-ledger-index="${h(row.manualIndex)}"></td>
<td><b>${active ? 'ACTIVE' : 'RETAINED'}</b><small>user-reviewed pair, not certified identity</small></td><td class="ciiw-ms-ledger-actions"><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-ledger-update data-ciiw-ms-ledger-source-id="${h(row.sourceId)}" data-ciiw-ms-ledger-index="${h(row.manualIndex)}">Update</button><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-ledger-remove data-ciiw-ms-ledger-source-id="${h(row.sourceId)}" data-ciiw-ms-ledger-index="${h(row.manualIndex)}">Remove</button></td></tr>`;
}

function automaticRowMarkup(row, active) {
  return `<tr data-ciiw-ms-anchor-ledger-row="automatic" data-ciiw-ms-ledger-lane="${active ? 'ACTIVE' : 'RETAINED'}"><td><b>${h(row.sourceId)}</b></td><td><b>${h(row.authority)}</b><small>${h(row.baseId || 'qualified base')}</small></td><td>${h(row.sourceNodeId)}</td><td>${h(row.targetNodeId)}</td><td><b>${active ? 'ACTIVE' : 'RETAINED'}</b><small>method-qualified; not certified identity</small></td><td class="ciiw-ms-ledger-actions"><button class="ciiw-ms-inline-action" type="button" data-ciiw-ms-ledger-auto-remove data-ciiw-ms-ledger-source-id="${h(row.sourceId)}" data-ciiw-ms-ledger-selection-key="${h(row.selectionKey)}">Remove base</button></td></tr>`;
}

export function ciiMultiSourceAnchorLedgerMarkup(inspection, selectedBySource, manualBySource, modeBySource = new Map()) {
  const rows = ciiMultiSourceAnchorLedgerRows(inspection, selectedBySource, manualBySource);
  const counts = summary(inspection, rows);
  const projection = buildCiiMultiSourceActiveAuthorityPlan(inspection, selectedBySource, manualBySource, modeBySource);
  const activeModeBySource = new Map(projection.rows.map((item) => [item.sourceId, item.activeMode]));
  const activeCount = projection.rows.filter((item) => item.activeReady).length;
  const body = rows.length
    ? `<table class="ciiw-mini-grid ciiw-ms-anchor-ledger-table"><thead><tr><th>Source</th><th>Authority</th><th>SOURCE node</th><th>TARGET node</th><th>State</th><th>Action</th></tr></thead><tbody>${rows.map((row) => {
      const mode = activeModeBySource.get(row.sourceId);
      const active = mode === (row.authority === 'USER LOCKED' ? 'MANUAL' : 'AUTO');
      return row.authority === 'USER LOCKED' ? manualRowMarkup(row, active) : automaticRowMarkup(row, active);
    }).join('')}</tbody></table>`
    : '<p class="ciiw-ms-anchor-ledger-empty">No anchor evidence selected yet. Choose a qualified Method A/B base or add a reviewed manual anchor below.</p>';
  const ready = projection.ready;
  const next = `<div class="ciiw-ms-next-step"><div><b>${ready ? 'Anchor authority READY' : 'Anchor authority incomplete'}</b><span>${ready ? 'Active authority is available per SOURCE. Build S1/S2/S3 correspondence; physical certification remains separate.' : 'Select a nonempty ACTIVE authority lane for every SOURCE before Compare.'}</span></div><button type="button" data-ciiw-ms-compare-now ${ready ? '' : 'disabled'}>Compare models →</button></div>`;
  return `<section class="ciiw-base-set ciiw-ms-anchor-ledger" data-ciiw-ms-anchor-ledger="1"><header><div><b>Source-set Anchor Authority</b><span>${h(activeCount)} / ${h(counts.memberCount)} SOURCE members covered by ACTIVE authority · ${h(counts.manualCount)} manual locked · ${h(counts.automaticBaseCount)} automatic bases · ${h(counts.automaticPairCount)} anchor pairs retained</span></div><span class="ciiw-corroboration">MASTER LEDGER</span></header><p>This ledger preserves both source-evidence lanes, but Compare uses only the ACTIVE lane of each SOURCE. RETAINED evidence is not applied. LOCKED and method-qualified do not mean independently certified physical identity. Editing a row invalidates prior Compare and Writer scope.</p>${body}${next}</section>${proposalRationaleMarkup(inspection, manualBySource)}`;
}

export const _test = Object.freeze({ automaticAuthorityRows, manualAuthorityRows, summary, proposalSessionKey, approvedProposalKeys, proposalRationaleRows, proposalRationaleMarkup });
