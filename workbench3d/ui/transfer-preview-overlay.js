/**
 * transfer-preview-overlay.js — "Graphical preview of Transfer" stage.
 * Delta-only labels on approved arrows, an icon toolbar mirroring the
 * Transfer preview & approval actions, and the Global override property list.
 * Pure HTML + screen-space positioning (arrow midpoints come from the arrow
 * layer's drawn records) — no three.js.
 */

import { globalPropertyModel } from './transfer-overlay-models.js';

const MAX_LABELS = 80;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Icon toolbar mirroring the Transfer preview & approval actions. */
export function previewToolbarHtml(state) {
  const plan = state.plan;
  const summary = plan?.summary;
  return `<div class="wb3d-preview-toolbar">
    <strong>Transfer preview</strong>
    ${summary ? `<span class="wb3d-muted">${summary.approvedRows ?? 0}✔ / ${summary.pendingRows ?? 0}• / ${summary.blockedRows ?? 0}⛔</span>` : ''}
    <button class="wb3d-btn wb3d-btn-mini" data-action="build-plan" title="Rebuild transfer plan">⟳</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="batch-approve" title="Batch approve ≥ min confidence">✔✔</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="apply-plan" title="Apply approved rows and download transferred target XML">⬇</button>
    <button class="wb3d-btn wb3d-btn-mini" data-action="transfer-preview-toggle" title="Exit graphical preview">✖</button>
  </div>`;
}

/** Global override: every property across all transfers; unchecking drops it everywhere. */
export function globalOverridePanelHtml(state) {
  const rows = globalPropertyModel(state.plan, state.transferConfig?.excludeProperties ?? []);
  if (!rows.length) return '';
  return `<div class="wb3d-global-override">
    <strong>Global override <span class="wb3d-muted">uncheck to drop across all transfers</span></strong>
    ${rows.map((row) => `<label class="wb3d-check ${row.excluded ? 'is-excluded' : ''}">
      <input type="checkbox" data-action="global-drop-prop" data-prop="${esc(row.property)}" ${row.excluded ? '' : 'checked'}>
      ${esc(row.property)} <span class="wb3d-muted">${row.pairCount} pair(s)</span>
    </label>`).join('')}
  </div>`;
}

/** Full preview overlay host content (toolbar + global override list). */
export function previewOverlayHtml(state) {
  if (!state.transferPreview || !state.plan) return '';
  return previewToolbarHtml(state) + globalOverridePanelHtml(state);
}

/**
 * Delta-only labels ("RATING=150") at each drawn arrow's midpoint. Only
 * approved rows are shown — the preview displays exactly what will apply.
 */
export function updateTransferPreviewLabels(container, state, drawnArrows = []) {
  const host = container.querySelector('[data-wb3d-preview-labels]');
  if (!host) return;
  if (!state.transferPreview || !state.plan) { host.innerHTML = ''; return; }
  const labels = [];
  for (const arrow of drawnArrows) {
    if (!arrow.deltaLabels?.length || !arrow.points) continue;
    const text = arrow.deltaLabels.slice(0, 4).join(', ') + (arrow.deltaLabels.length > 4 ? ` +${arrow.deltaLabels.length - 4}` : '');
    labels.push(`<span class="wb3d-preview-label" data-pair-key="${esc(arrow.pairKey)}"
      style="left:${Math.round(arrow.points.mid.x)}px;top:${Math.round(arrow.points.mid.y)}px"
      title="${esc(arrow.deltaLabels.join(', '))}">${esc(text)}</span>`);
    if (labels.length >= MAX_LABELS) break;
  }
  host.innerHTML = labels.join('');
}
