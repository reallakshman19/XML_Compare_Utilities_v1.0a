/**
 * node-workspace-panel.js — node-support visual board (W4, UI-only).
 * Mode tabs over the pure models: 2.5D map · support tree · load matrix ·
 * flow · match matrix. Every clickable emits a DrilldownContext (data-action
 * "nodeviz-pick" with a base64 filter) so the tab's one funnel handles it.
 */

import {
  nodeMapModel, supportTreeModel, loadMatrixModel, supportFlowModel, matchMatrixModel, availableNodeViews, STATUS_GLYPH,
} from './node-workspace-view-models.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** Encode a filter + title for the delegated click handler (ASCII-safe). */
function pick(title, filter) {
  const payload = encodeURIComponent(JSON.stringify({ title, filter }));
  return `data-action="nodeviz-pick" data-pick="${payload}"`;
}

const MODE_LABELS = Object.freeze({ map: '2.5D Map', tree: 'Support Tree', load: 'Load Matrix', flow: 'Type Flow', matrix: 'Match Matrix' });

function mapHtml(audit, graphs, styles) {
  const { points, bounds } = nodeMapModel(audit, graphs);
  if (!points.length) return '<p class="wb3d-muted">No coordinate nodes.</p>';
  const W = 640; const H = 380; const pad = 28;
  const spanE = Math.max(1, bounds.maxE - bounds.minE);
  const spanN = Math.max(1, bounds.maxN - bounds.minN);
  const sx = (e) => pad + (e - bounds.minE) / spanE * (W - 2 * pad);
  // North up: invert y
  const sy = (n) => H - pad - (n - bounds.minN) / spanN * (H - 2 * pad);
  const markers = points.map((p) => {
    const color = styles?.[p.status]?.colorHex ?? '#94a3b8';
    const r = p.loadDeltaPct !== null ? 5 + Math.min(9, p.loadDeltaPct / 8) : 5;
    return `<g class="wb3d-map-node" ${pick(`${p.label} · ${p.status.replaceAll('_', ' ')}`, p.filter)} data-object="${esc(p.objectId)}">
      <circle cx="${sx(p.east).toFixed(1)}" cy="${sy(p.north).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}cc" stroke="#0b1220" stroke-width="1"/>
      <text x="${sx(p.east).toFixed(1)}" y="${(sy(p.north) + 3).toFixed(1)}" class="wb3d-map-glyph">${esc(p.glyph)}</text>
    </g>`;
  }).join('');
  return `
    <div class="wb3d-muted" style="margin-bottom:4px">East → , North ↑ · marker size ∝ load Δ · click to drill down</div>
    <div class="wb3d-map-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:420px">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#081120"/>${markers}
    </svg></div>`;
}

function treeHtml(audit, graphs) {
  const groups = supportTreeModel(audit, graphs);
  if (!groups.length) return '<p class="wb3d-muted">No nodes.</p>';
  return `<div class="wb3d-node-tree">${groups.slice(0, 60).map((g) => `
    <details class="wb3d-block" ${g.changed ? 'open' : ''}>
      <summary><button class="wb3d-link" ${pick(`Parent ${g.parent}`, g.filter)}>${esc(g.parent)}</button>
        <span class="wb3d-muted">${g.children.length} support(s)${g.changed ? ' · changed' : ''}</span></summary>
      <ul class="wb3d-list">${g.children.map((c) => `<li>
        <span class="wb3d-map-glyph-inline">${esc(c.glyph)}</span>
        <button class="wb3d-link" ${pick(c.label, c.filter)} data-object="${esc(c.objectId)}">${esc(c.label)}</button>
        <span class="wb3d-muted">${esc(c.status.replaceAll('_', ' '))}${c.loadDeltaPct !== null && c.loadDeltaPct > 0 ? ` · load Δ ${c.loadDeltaPct.toFixed(0)}%` : ''}</span>
      </li>`).join('')}</ul>
    </details>`).join('')}</div>`;
}

function loadHtml(audit, graphs) {
  const { caseIds, rows } = loadMatrixModel(audit, graphs);
  if (!rows.length) return '<p class="wb3d-muted">No load-case data (map Fx/Fy/Fz columns to the "load" role).</p>';
  const header = `<tr><th>Support</th>${caseIds.map((c) => `<th>${esc(c)}</th>`).join('')}<th>Max Δ%</th></tr>`;
  const body = rows.slice(0, 120).map((r) => {
    const cells = caseIds.map((c) => {
      const cell = r.cases[c];
      if (!cell) return '<td class="wb3d-muted">·</td>';
      const hot = cell.deltaPct >= 25 ? ' wb3d-load-hot' : cell.deltaPct > 0 ? ' wb3d-load-warm' : '';
      return `<td class="wb3d-load-cell${hot}" title="${cell.a ?? '—'} → ${cell.b ?? '—'}">${cell.deltaPct ? `${cell.deltaPct}%` : '='}</td>`;
    }).join('');
    return `<tr class="wb3d-row-click" ${pick(`${r.label} load`, r.filter)} data-object="${esc(r.objectId)}"><td>${esc(r.label)}</td>${cells}<td><strong>${r.maxDeltaPct.toFixed(0)}%</strong></td></tr>`;
  }).join('');
  return `<div class="wb3d-table-wrap"><table>${`<thead>${header}</thead>`}<tbody>${body}</tbody></table></div>`;
}

function flowHtml(audit, graphs) {
  const links = supportFlowModel(audit, graphs);
  if (!links.length) return '<p class="wb3d-muted">No support-type data.</p>';
  const max = Math.max(...links.map((l) => l.count));
  return `<div class="wb3d-flow">${links.map((l) => `
    <button class="wb3d-flow-link ${l.from === l.to ? 'is-same' : l.from === '(added)' ? 'is-added' : l.to === '(removed)' ? 'is-removed' : 'is-moved'}"
      ${pick(`${l.from} → ${l.to}`, { diffIds: l.diffIds })}>
      <span class="wb3d-flow-from">${esc(l.from)}</span>
      <span class="wb3d-flow-arrow" style="flex:${(0.3 + l.count / max).toFixed(2)}">→</span>
      <span class="wb3d-flow-to">${esc(l.to)}</span>
      <span class="wb3d-badge">${l.count}</span>
    </button>`).join('')}</div>`;
}

function matrixHtml(audit, graphs) {
  const { rows, targets } = matchMatrixModel(audit, graphs);
  if (!rows.length) return '<p class="wb3d-muted">No ambiguous matches to review.</p>';
  const header = `<tr><th></th>${targets.map((t) => `<th>${esc(t)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => {
    const cells = targets.map((t) => r.candidates.includes(t)
      ? `<td><button class="wb3d-heat-cell" ${pick(`${r.source} ↔ ${t}`, r.filter)} data-object="${esc(r.sourceObjectId)}" style="background:#a855f7cc">?</button></td>`
      : '<td class="wb3d-heat-empty">·</td>').join('');
    return `<tr><th>${esc(r.source)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="wb3d-table-wrap wb3d-heatmap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
}

/** Only shown for node-wise audits. `state.nodeVizMode` selects the view. */
export function nodeWorkspaceHtml(state, statusStyles) {
  if (state.audit?.compareKind !== 'node-wise') return '';
  const available = availableNodeViews(state.audit, state.graphs);
  const modes = Object.keys(MODE_LABELS).filter((m) => available[m]);
  if (!modes.length) return '';
  const active = modes.includes(state.nodeVizMode) ? state.nodeVizMode : modes[0];
  const bodies = {
    map: () => mapHtml(state.audit, state.graphs, statusStyles),
    tree: () => treeHtml(state.audit, state.graphs),
    load: () => loadHtml(state.audit, state.graphs),
    flow: () => flowHtml(state.audit, state.graphs),
    matrix: () => matrixHtml(state.audit, state.graphs),
  };
  return `
  <section class="wb3d-card">
    <h3>Node visual board <span class="wb3d-muted">support-domain views; click any item to drill down</span></h3>
    <div class="wb3d-seg" role="group">
      ${modes.map((m) => `<button class="wb3d-btn ${m === active ? 'is-active' : ''}" data-action="nodeviz-mode" data-mode="${m}">${MODE_LABELS[m]}</button>`).join('')}
    </div>
    <div class="wb3d-nodeviz-body">${bodies[active]()}</div>
  </section>`;
}
