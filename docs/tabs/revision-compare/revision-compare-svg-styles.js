/** Revision Compare-owned SVG status styling; shared renderer semantics remain unchanged. */
const rawStyles = {
  MATCHED_UNCHANGED: ['Matched / unchanged', 'revc-svg-status-matched', '#22c55e', '', 0.72, 2, 'circle'],
  PROPERTY_CHANGED: ['Property changed', 'revc-svg-status-property', '#eab308', '8 4', 1, 3, 'diamond'],
  GEOMETRY_CHANGED: ['Geometry changed', 'revc-svg-status-geometry', '#f97316', '2 3', 1, 4, 'square'],
  MISSING_IN_TARGET: ['Missing in target', 'revc-svg-status-missing', '#ef4444', '10 4 2 4', 0.62, 3, 'cross'],
  NEW_IN_TARGET: ['New in target', 'revc-svg-status-new', '#3b82f6', '', 1, 4, 'ring'],
  AMBIGUOUS: ['Ambiguous', 'revc-svg-status-ambiguous', '#a855f7', '4 3', 0.9, 4, 'double-ring'],
  SPLIT: ['Split', 'revc-svg-status-split', '#ec4899', '12 3', 0.9, 4, 'fork'],
  MERGE: ['Merge', 'revc-svg-status-merge', '#db2777', '3 2 10 2', 0.9, 4, 'join'],
  CONSUMED: ['Consumed', 'revc-svg-status-consumed', '#64748b', '1 4', 0.45, 2, 'dot'],
  CONFLICT: ['Conflict / blocked', 'revc-svg-status-conflict', '#7f1d1d', '6 2', 1, 5, 'blocked'],
};

export const REVISION_COMPARE_SVG_STATUS_STYLES = Object.freeze(Object.fromEntries(
  Object.entries(rawStyles).map(([status, values]) => [status, Object.freeze({
    status,
    label: values[0],
    className: values[1],
    stroke: values[2],
    dash: values[3],
    opacity: values[4],
    lineWeight: values[5],
    markerTreatment: values[6],
  })]),
));

export const REVISION_COMPARE_SVG_CSS = `
.revc-backend-selector { display: inline-flex; gap: .35rem; margin-right: .75rem; }
.revc-viewer-host [data-revc-svg-overlay-root] { width: 100%; height: 100%; min-height: 26rem; background: #0b1220; }
.revc-svg-side-by-side { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .65rem; min-height: 26rem; }
.revc-svg-pane { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; border: 1px solid #334155; border-radius: .45rem; overflow: hidden; background: #0b1220; }
.revc-svg-pane h3 { margin: 0; padding: .45rem .65rem; color: #cbd5e1; background: #111827; border-bottom: 1px solid #334155; font-size: .82rem; letter-spacing: .04em; }
.revc-svg-pane-host { min-height: 24rem; min-width: 0; }
.revc-svg-pane-host [data-revc-svg-pane-root] { width: 100%; height: 100%; min-height: 24rem; background: #0b1220; }
.revc-viewer-host [data-engineering-svg-root] { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
.revc-viewer-host [data-engineering-svg-root]:active { cursor: grabbing; }
.revc-viewer-host [data-revc-svg-keyboard-surface]:focus-visible {
  outline: 3px solid #f8fafc;
  outline-offset: -5px;
  box-shadow: inset 0 0 0 6px rgba(15, 23, 42, .85);
}
.revc-viewer-host [data-engineering-svg-geometry] { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.revc-viewer-host [data-engineering-svg-geometry="point"] { fill: var(--revc-svg-stroke); }
.revc-viewer-host [data-revc-hidden-fit-authority] { opacity: 0 !important; pointer-events: none !important; }
.revc-viewer-host [data-revc-diff-status] > [data-engineering-svg-geometry] {
  stroke: var(--revc-svg-stroke); stroke-width: var(--revc-svg-weight);
  stroke-dasharray: var(--revc-svg-dash); opacity: var(--revc-svg-opacity);
}
.revc-viewer-host [data-revc-diff-status].is-selected > [data-engineering-svg-geometry] {
  stroke: #f8fafc; fill: #f8fafc; stroke-width: 6; opacity: 1;
}
.revc-viewer-host [data-revc-side="A"] > [data-engineering-svg-geometry] { mix-blend-mode: screen; }
.revc-viewer-host [data-revc-marker-treatment="cross"] > circle,
.revc-viewer-host [data-revc-marker-treatment="blocked"] > circle { fill: transparent; stroke-width: 5; }
`;

export function revisionCompareSvgStatusStyle(status) {
  return REVISION_COMPARE_SVG_STATUS_STYLES[status] ?? null;
}

export function applyRevisionCompareSvgStatus(node, status, side) {
  if (!node) return false;
  for (const style of Object.values(REVISION_COMPARE_SVG_STATUS_STYLES)) node.classList.remove(style.className);
  const style = revisionCompareSvgStatusStyle(status);
  if (!style) {
    node.removeAttribute('data-revc-diff-status');
    return false;
  }
  node.classList.add(style.className);
  node.setAttribute('data-revc-diff-status', style.status);
  node.setAttribute('data-revc-side', side);
  node.setAttribute('data-revc-marker-treatment', style.markerTreatment);
  node.style.setProperty('--revc-svg-stroke', style.stroke);
  node.style.setProperty('--revc-svg-dash', style.dash || 'none');
  node.style.setProperty('--revc-svg-opacity', String(style.opacity));
  node.style.setProperty('--revc-svg-weight', String(style.lineWeight));
  const current = node.getAttribute('aria-label') || 'Engineering entity';
  const base = current.replace(/; status:.*$/, '');
  node.setAttribute('aria-label', `${base}; status: ${style.label}`);
  return true;
}
