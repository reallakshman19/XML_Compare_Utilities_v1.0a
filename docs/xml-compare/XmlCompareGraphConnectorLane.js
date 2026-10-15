export const XML_COMPARE_GRAPH_CONNECTOR_LANE_SCHEMA = 'xml-compare-graph-connector-lane/v8';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const clean = (value) => String(value ?? '').trim();

function connectorLabel(conn = {}) {
  if (conn.status === 'approved') return 'APPROVED';
  if (conn.locked) return 'LOCKED';
  return 'LINK';
}

function connectorLine(conn, index, total) {
  const y = total <= 1 ? 50 : 16 + (index * (68 / Math.max(1, total - 1)));
  const cls = conn.status === 'approved' ? 'is-approved' : 'is-manual-preview';
  return `<g class="xml-compare-connector-line ${cls}" data-xml-compare-connector-id="${esc(conn.id)}"><path d="M 4 ${y} C 32 ${Math.max(8, y - 18)}, 68 ${Math.min(92, y + 18)}, 96 ${y}"/><circle cx="4" cy="${y}" r="2.8"/><circle cx="96" cy="${y}" r="2.8"/><text x="50" y="${Math.max(10, y - 5)}">${esc(connectorLabel(conn))}</text></g>`;
}

function pairKey(conn = {}) {
  return `${clean(conn.sourceUid)}->${clean(conn.targetUid)}`;
}

function allConnectors(manualConnectors = []) {
  return Object.freeze([...manualConnectors]);
}

function actionPanel() {
  return '<div class="xml-compare-auto-map-actions"><small>Automatic connector suggestions are disabled.</small></div>';
}

function pendingPanel(preview = null) {
  if (!preview) return '<small>Select Source and Target records to preview a manual connector. Approval requires Approve Link.</small>';
  return `<article class="xml-compare-pending-connector" data-xml-compare-pending-connector><b>Pending connector preview</b><small>Source: ${esc(preview.sourceLabel || preview.sourceUid)}<br>Target: ${esc(preview.targetLabel || preview.targetUid)}<br>Basis: ${esc((preview.basis || []).join(', '))}<br>Confidence: ${Number(preview.confidence || 0).toFixed(2)}</small><div class="xml-compare-candidate-actions"><button type="button" data-xml-compare-action="approve-pending-connector">Approve Link</button><button type="button" data-xml-compare-action="reject-pending-connector">Reject</button><button type="button" data-xml-compare-action="clear-pending-connector">Clear</button></div></article>`;
}

function candidateAction(action, id, label, disabled = false) {
  return `<button type="button" ${disabled ? 'disabled' : ''} data-xml-compare-candidate-action="${esc(action)}" data-xml-compare-candidate-id="${esc(id)}">${esc(label)}</button>`;
}

function candidateDataset(candidate = {}) {
  return `data-source-uid="${esc(candidate.sourceUid)}" data-target-uid="${esc(candidate.targetUid)}" data-source-label="${esc(candidate.sourceLabel)}" data-target-label="${esc(candidate.targetLabel)}" data-source-field="${esc(candidate.sourceField)}" data-target-field="${esc(candidate.targetField)}" data-source-value="${esc(candidate.sourceValue)}" data-target-value="${esc(candidate.targetValue)}" data-score="${esc(candidate.score)}" data-basis="${esc((candidate.basis || []).join('|'))}"`;
}

function candidateRows() {
  return '<small>Selection previews a connector only. Use Approve Link to create MatchDecision.v1 / ApprovedMatchSet.v1.</small>';
}

function candidateRow(candidate, rejected = false) {
  return `<article data-xml-compare-candidate-row="${esc(candidate.id)}" ${candidateDataset(candidate)} ${rejected ? 'data-xml-compare-candidate-rejected="true"' : ''}><small><b>${esc(candidate.sourceLabel)}</b> → <b>${esc(candidate.targetLabel)}</b><br>${esc(candidate.sourceField)} = ${esc(candidate.sourceValue)}${rejected ? '<br><b>Rejected</b>' : ''}</small><div class="xml-compare-candidate-actions">${candidateAction('accept', candidate.id, 'Accept', rejected)}${candidateAction('reject', candidate.id, rejected ? 'Rejected' : 'Reject', rejected)}</div></article>`;
}

function approvalCounts(manualState = null) {
  const approved = manualState?.approvedMatchSet?.approvedMatches || [];
  const manualFallback = Array.isArray(manualState?.connectors) ? manualState.connectors.length : 0;
  const candidatePairs = approved.filter((match) => clean(match.matchType) === 'candidate-accepted' || (match.basis || []).includes('candidate')).length;
  const manual = approved.length ? Math.max(0, approved.length - candidatePairs) : manualFallback;
  return Object.freeze({
    manual,
    candidatePairs,
    total: approved.length || manualFallback,
    rejected: manualState?.approvedMatchSet?.summary?.rejectedCount || 0,
    blockers: manualState?.approvedValidationModel?.summary?.blockerCount || manualState?.approvedMatchSet?.summary?.blockerCount || 0,
  });
}

function countCell(label = '', value = 0) {
  return `<div><b>${esc(label)}</b><span>${esc(value)}</span></div>`;
}

function approvalCountPanel(manualState = null) {
  const counts = approvalCounts(manualState);
  return `<div class="xmlc-approval-counts">${countCell('Manual', counts.manual)}${countCell('Candidate pairs', counts.candidatePairs)}${countCell('Total approved', counts.total)}${countCell('Validation blockers', counts.blockers)}</div>${counts.rejected ? `<small>${esc(counts.rejected)} rejected candidate(s)</small>` : ''}`;
}

export function paintXmlCompareConnectorCanvas(canvas, connectors = [], pendingPreview = null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 2;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const total = connectors.length;
  connectors.forEach((conn, index) => {
    const yPct = total <= 1 ? 50 : 16 + (index * (68 / Math.max(1, total - 1)));
    const y = (yPct / 100) * h;
    const isApproved = conn.status === 'approved';

    ctx.strokeStyle = isApproved ? '#3b82f6' : '#94a3b8';
    ctx.fillStyle = isApproved ? '#3b82f6' : '#94a3b8';

    // Draw bezier curve
    ctx.beginPath();
    ctx.moveTo(w * 0.04, y);
    ctx.bezierCurveTo(w * 0.32, Math.max(h * 0.08, y - 18), w * 0.68, Math.min(h * 0.92, y + 18), w * 0.96, y);
    ctx.stroke();

    // Draw circles
    ctx.beginPath();
    ctx.arc(w * 0.04, y, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.96, y, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw label
    ctx.fillStyle = isApproved ? '#bae6fd' : '#cbd5e1';
    ctx.fillText(connectorLabel(conn), w * 0.5, Math.max(10, y - 10));
  });

  if (pendingPreview && !total) {
    const y = h * 0.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(w * 0.04, y);
    ctx.bezierCurveTo(w * 0.32, y - 20, w * 0.68, y + 20, w * 0.96, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(w * 0.04, y, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.fillText('PENDING', w * 0.5, y - 10);
  }
}

export function renderXmlCompareGraphConnectorLaneHtml({ manualState = null, controlHtml = '' } = {}) {
  return `<section class="xml-compare-graph-connector-lane" data-xml-compare-graph-connector-lane data-xml-compare-connector-overlay><header><b>Connectors</b><span>Approval counts</span></header>${controlHtml}${actionPanel()}${approvalCountPanel(manualState)}${pendingPanel(manualState?.pendingConnectorPreview || null)}</section>`;
}

export const _test = Object.freeze({
  esc,
  connectorLabel,
  pairKey,
  allConnectors,
  actionPanel,
  pendingPanel,
  candidateAction,
  candidateDataset,
  candidateRows,
  candidateRow,
  approvalCounts,
  approvalCountPanel,
});
