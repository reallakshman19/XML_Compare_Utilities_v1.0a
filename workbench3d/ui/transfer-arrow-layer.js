/**
 * transfer-arrow-layer.js — screen-space SVG arrows for transfer pairs.
 *
 * Side-by-side is a scissor split of one shared scene, so world-space lines
 * cannot bridge the panes; arrows are therefore drawn in a full-canvas SVG
 * overlay: source endpoint projected into the left pane, target into the
 * right (viewer.projectPointForPane). In overlay mode both endpoints project
 * into the full viewport. Stroke color = score band (basis gold).
 */

import { scoreBandColor, SCORE_BAND_COLORS, transferPairsModel } from './transfer-overlay-models.js';

const MAX_ARROWS = 150;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const cssColor = (int) => `#${(int ?? 0xcbd5e1).toString(16).padStart(6, '0')}`;

/** Transfer connectors joined with plan pair data → drawable arrow records. */
export function arrowLayerModel(state) {
  if (!state?.plan || !state.connectorModel) return [];
  const pairs = new Map(transferPairsModel(state.plan).map((pair) => [pair.pairKey, pair]));
  const arrows = [];
  for (const connector of state.connectorModel.connectors ?? []) {
    if (connector.type !== 'TRANSFER_CONNECTOR' || !connector.pairKey) continue;
    const pair = pairs.get(connector.pairKey);
    if (!pair) continue;
    arrows.push({
      pairKey: connector.pairKey,
      sourceObjectId: connector.sourceObjectId,
      targetObjectId: connector.targetObjectId,
      sourceXyz: connector.from,
      targetXyz: connector.to,
      status: connector.status,
      colorInt: connector.status === 'TRANSFER_BLOCKED' ? 0x7f1d1d
        : scoreBandColor(pair.score, { basis: connector.basis }) ?? SCORE_BAND_COLORS.mid,
      approvedCount: pair.approvedRows.length,
      rowCount: pair.rows.length,
      deltaLabels: pair.deltaLabels,
    });
    if (arrows.length >= MAX_ARROWS) break;
  }
  return arrows;
}

/** Screen geometry for one arrow, or null when either end is unprojectable. */
export function arrowScreenPoints(viewer, arrow, mode) {
  const sideBySide = mode === 'side-by-side';
  const from = viewer.projectPointForPane(arrow.sourceXyz, sideBySide ? 'source' : 'full');
  const to = viewer.projectPointForPane(arrow.targetXyz, sideBySide ? 'target' : 'full');
  if (!from || !to) return null;
  return { from, to, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } };
}

const markerId = (colorInt) => `wb3d-arrowhead-${(colorInt ?? 0xcbd5e1).toString(16)}`;

function markerDefs(arrows) {
  const colors = [...new Set(arrows.map((a) => a.colorInt ?? 0xcbd5e1))];
  return colors.map((colorInt) => `<marker id="${markerId(colorInt)}" viewBox="0 0 10 10" refX="9" refY="5"
    markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="${cssColor(colorInt)}"/></marker>`).join('');
}

function arrowPathHtml(arrow, points, selected) {
  const color = cssColor(arrow.colorInt);
  // Slight curve keeps overlapping arrows distinguishable.
  const dx = points.to.x - points.from.x;
  const dy = points.to.y - points.from.y;
  const norm = Math.hypot(dx, dy) || 1;
  const bend = Math.min(40, norm * 0.15);
  const cx = points.mid.x - (dy / norm) * bend;
  const cy = points.mid.y + (dx / norm) * bend;
  return `<path d="M ${points.from.x.toFixed(1)} ${points.from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${points.to.x.toFixed(1)} ${points.to.y.toFixed(1)}"
    fill="none" stroke="${color}" stroke-width="${selected ? 3.5 : 2}" opacity="${selected ? 1 : 0.85}"
    marker-end="url(#${markerId(arrow.colorInt)})" class="wb3d-arrow ${selected ? 'is-selected' : ''}"
    data-pair-key="${esc(arrow.pairKey)}"><title>${esc(arrow.sourceObjectId)} → ${esc(arrow.targetObjectId)} · ${arrow.approvedCount}/${arrow.rowCount} approved</title></path>`;
}

/**
 * (Re)draw the arrow SVG layer inside the canvas host. Pure DOM writes; call
 * on camera change, mode change, and after any plan/connector mutation.
 * Returns the drawn arrow records (with screen midpoints) for label overlays.
 */
export function renderArrowLayer(container, state) {
  const layer = container.querySelector('[data-wb3d-arrow-layer]');
  if (!layer) return [];
  const viewer = state.viewer;
  const visible = Boolean(viewer && state.plan && state.audit && state.connectorMode === 'transfer');
  if (!visible) { layer.innerHTML = ''; layer.style.display = 'none'; return []; }
  layer.style.display = '';

  const mode = viewer.getMode?.() ?? 'overlay';
  const host = layer.parentElement;
  const width = host?.clientWidth || 800;
  const height = host?.clientHeight || 480;
  const drawn = [];
  const paths = [];
  for (const arrow of arrowLayerModel(state)) {
    const points = arrowScreenPoints(viewer, arrow, mode);
    if (!points) continue;
    const inside = (p) => p.x >= -40 && p.x <= width + 40 && p.y >= -40 && p.y <= height + 40;
    if (!inside(points.from) && !inside(points.to)) continue;
    drawn.push({ ...arrow, points });
    paths.push(arrowPathHtml(arrow, points, state.arrowPopup?.pairKey === arrow.pairKey));
  }
  layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  layer.innerHTML = `<defs>${markerDefs(drawn)}</defs>${paths.join('')}`;
  return drawn;
}
