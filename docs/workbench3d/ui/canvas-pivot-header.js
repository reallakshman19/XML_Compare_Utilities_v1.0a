/**
 * canvas-pivot-header.js — the Pivot summary (line × diff-status matrix) as a
 * compact strip docked at the top of the 3D canvas. Count buttons keep the
 * existing data-action="isolate-pivot" contract.
 */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const STATUS_SHORT = Object.freeze({
  MATCHED_UNCHANGED: '=',
  PROPERTY_CHANGED: 'Δp',
  GEOMETRY_CHANGED: 'Δg',
  MISSING_IN_TARGET: '−',
  NEW_IN_TARGET: '+',
  AMBIGUOUS: '?',
  SPLIT: '⑂',
  MERGE: '⨝',
});

/** line → status → Set<objectId>, plus the status column order. */
export function pivotModel(audit, graphs) {
  if (!audit || !graphs) return { statuses: [], lines: [] };
  const lineOf = new Map();
  for (const graph of [graphs.A, graphs.B]) {
    for (const object of graph?.objects ?? []) lineOf.set(object.objectId, object.lineId || '(model)');
  }
  const statuses = [...new Set(audit.objectDiff.rows.map((r) => r.status))];
  const buckets = new Map();
  for (const row of audit.objectDiff.rows) {
    for (const id of [row.sourceObjectId, row.targetObjectId]) {
      if (!id) continue;
      const line = lineOf.get(id) ?? '(model)';
      if (!buckets.has(line)) buckets.set(line, new Map());
      const perStatus = buckets.get(line);
      if (!perStatus.has(row.status)) perStatus.set(row.status, new Set());
      perStatus.get(row.status).add(id);
    }
  }
  const lines = [...buckets.entries()].map(([line, perStatus]) => ({
    line,
    counts: statuses.map((status) => ({ status, count: perStatus.get(status)?.size ?? 0 })),
    total: [...perStatus.values()].reduce((sum, ids) => sum + ids.size, 0),
  }));
  return { statuses, lines };
}

/** Compact header strip; one row of icon-counts per line. */
export function canvasPivotHeaderHtml(state) {
  const model = pivotModel(state.audit, state.graphs);
  if (!model.lines.length) return '';
  const cell = ({ status, count }, line) => (count
    ? `<button class="wb3d-link" data-action="isolate-pivot" data-line="${esc(line)}" data-status="${esc(status)}"
        title="${esc(status)} — ${count} in ${esc(line)} (click to isolate in 3D)">${esc(STATUS_SHORT[status] ?? status)}${count}</button>`
    : '');
  const rows = model.lines.map((entry) => `<span class="wb3d-pivot-line">
    <b>${esc(entry.line)}</b> ${entry.counts.map((c) => cell(c, entry.line)).filter(Boolean).join(' ')}
    <span class="wb3d-muted">Σ${entry.total}</span>
  </span>`).join('<span class="wb3d-chip-sep"></span>');
  return `<div class="wb3d-pivot-strip" title="Pivot summary — line × status">${rows}</div>`;
}
