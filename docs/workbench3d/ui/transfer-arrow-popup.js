/**
 * transfer-arrow-popup.js — double-click editor for one transfer arrow.
 * Lists the pair's properties/blocks with per-property drop ("✖") and
 * smart global drop ("✖~"); reads the live plan through transferPairsModel
 * so it always reflects current approvals.
 */

import { transferPairsModel, deltaLabel } from './transfer-overlay-models.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const stripSide = (id) => String(id ?? '').replace(/^(source|target):/, '');

/** Resolve the open popup's pair against the live plan (null when stale). */
export function arrowPopupModel(state) {
  const pairKey = state?.arrowPopup?.pairKey;
  if (!pairKey || !state.plan) return null;
  const pair = transferPairsModel(state.plan).find((p) => p.pairKey === pairKey);
  if (!pair) return null;
  return pair;
}

const APPROVAL_GLYPHS = { APPROVED: '✔', PENDING: '•', REJECTED: '✖', BLOCKED: '⛔' };

function propertyRowHtml(pair, row) {
  const glyph = APPROVAL_GLYPHS[row.approval] ?? '•';
  const droppable = row.approval !== 'BLOCKED' && row.approval !== 'REJECTED';
  const data = `data-source="${esc(pair.sourceObjectId)}" data-target="${esc(pair.targetObjectId)}" data-prop="${esc(row.property)}"`;
  return `<tr class="is-${esc(row.approval.toLowerCase())}">
    <td class="wb3d-arrow-popup-approval" title="${esc(row.approval)}${row.blockedReason ? ` — ${row.blockedReason}` : ''}">${glyph}</td>
    <td>${esc(deltaLabel(row))}</td>
    <td class="wb3d-float-actions">
      ${droppable ? `<button class="wb3d-btn wb3d-btn-mini" data-action="arrow-drop-prop" ${data} title="Drop ${esc(row.property)} from this transfer">✖</button>` : ''}
      <button class="wb3d-btn wb3d-btn-mini" data-action="arrow-smartdrop-prop" data-prop="${esc(row.property)}" title="Smart drop: exclude ${esc(row.property)} from ALL transfers (global override)">✖~</button>
    </td>
  </tr>`;
}

/** Popup markup; caller positions it via updateArrowPopupPosition. */
export function arrowPopupHtml(pair) {
  if (!pair) return '';
  return `<div class="wb3d-float-head">
      <strong>Transfer connector</strong>
      <span class="wb3d-muted">${pair.approvedRows.length}/${pair.rows.length} approved</span>
      <span class="wb3d-float-spacer"></span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="arrow-popup-close" title="Close">✕</button>
    </div>
    <div class="wb3d-arrow-popup-ids">
      <div><b>Source</b> <span>${esc(stripSide(pair.sourceObjectId))}</span></div>
      <div><b>Target</b> <span>${esc(stripSide(pair.targetObjectId))}</span></div>
    </div>
    <div class="wb3d-table-wrap wb3d-float-body"><table>
      <thead><tr><th></th><th>Transfer</th><th>Drop</th></tr></thead>
      <tbody>${pair.rows.map((row) => propertyRowHtml(pair, row)).join('')}</tbody>
    </table></div>`;
}

/**
 * Re-render + position the popup near the arrow's screen midpoint.
 * drawnArrows comes from renderArrowLayer (carries screen points).
 */
export function updateArrowPopup(container, state, drawnArrows) {
  const popup = container.querySelector('[data-wb3d-arrow-popup]');
  if (!popup) return;
  const pair = arrowPopupModel(state);
  if (!pair) { popup.hidden = true; state.arrowPopup = null; return; }
  const drawn = (drawnArrows ?? []).find((a) => a.pairKey === pair.pairKey);
  popup.hidden = false;
  popup.innerHTML = arrowPopupHtml(pair);
  const host = popup.parentElement;
  const width = host?.clientWidth || 800;
  const height = host?.clientHeight || 480;
  const at = drawn?.points?.mid ?? { x: width / 2, y: height / 2 };
  popup.style.left = `${Math.round(Math.min(Math.max(at.x, 10), width - 290))}px`;
  popup.style.top = `${Math.round(Math.min(Math.max(at.y, 10), height - 60))}px`;
}
