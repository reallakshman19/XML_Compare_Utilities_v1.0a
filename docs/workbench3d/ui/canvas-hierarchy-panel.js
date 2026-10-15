/**
 * canvas-hierarchy-panel.js — the Hierarchy (line → path → element) as a
 * collapsible left panel inside the 3D canvas, with multiselect checkboxes.
 * Concise labels (side prefixes stripped); clicking a label still isolates
 * (data-action="isolate-path" / "select-object"); checking boxes accumulates
 * ids for combined isolation (data-action="tree-check").
 */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const short = (id) => String(id ?? '').replace(/^(source|target):/, '');

/** Both models as [{modelId, label, lines:[{lineId, paths:[{pathId, meta, elementIds}]}]}]. */
export function hierarchyTreeModel(graphs) {
  if (!graphs) return [];
  return [['A', 'Source'], ['B', 'Target']].map(([key, label]) => {
    const graph = graphs[key];
    if (!graph) return null;
    return {
      modelId: graph.modelId,
      label: `${label} (${graph.modelId})`,
      lines: (graph.hierarchy ?? []).map((line) => ({
        lineId: line.lineId,
        paths: line.paths.map((p) => {
          const path = graph.paths.find((x) => x.pathId === p.pathId);
          return {
            pathId: p.pathId,
            meta: path ? `${path.startAnchorType}→${path.endAnchorType} · ${p.elementIds.length}` : `${p.elementIds.length}`,
            elementIds: p.elementIds,
          };
        }),
      })),
    };
  }).filter(Boolean);
}

const check = (ids, checkedSet) => {
  const list = ids.join(',');
  const checked = ids.length > 0 && ids.every((id) => checkedSet.has(id));
  return `<input type="checkbox" data-action="tree-check" data-ids="${esc(list)}" ${checked ? 'checked' : ''}>`;
};

/** Collapsible left panel markup. */
export function canvasHierarchyHtml(state) {
  if (!state.graphs) return '';
  const checkedSet = state.treeChecked ?? new Set();
  const open = state.canvasTreeOpen !== false;
  const models = hierarchyTreeModel(state.graphs);
  const body = models.map((model) => `<div><h4>${esc(model.label)}</h4><ul>
    ${model.lines.map((line) => {
      const lineIds = line.paths.flatMap((p) => p.elementIds);
      return `<li><label>${check(lineIds, checkedSet)}<strong>${esc(line.lineId)}</strong></label><ul>
        ${line.paths.map((p) => `<li><label>${check(p.elementIds, checkedSet)}
            <button class="wb3d-link" data-action="isolate-path" data-path="${esc(p.pathId)}" data-model="${esc(model.modelId)}">${esc(short(p.pathId))}</button></label>
            <span class="wb3d-muted">${esc(p.meta)}</span>
          <ul>${p.elementIds.map((id) => `<li><label>${check([id], checkedSet)}
            <button class="wb3d-link" data-action="select-object" data-object="${esc(id)}">${esc(short(id))}</button></label></li>`).join('')}</ul></li>`).join('')}
      </ul></li>`;
    }).join('')}
  </ul></div>`).join('');
  return `<div class="wb3d-canvas-tree-head">
      <button class="wb3d-btn wb3d-btn-mini" data-action="tree-toggle" title="${open ? 'Collapse hierarchy' : 'Expand hierarchy'}">${open ? '◀' : '▶ Tree'}</button>
      ${open ? `<strong>Hierarchy</strong><span class="wb3d-float-spacer"></span>
        <button class="wb3d-btn wb3d-btn-mini" data-action="tree-clear" title="Clear checked selection">✕</button>` : ''}
    </div>
    <div class="wb3d-canvas-tree-body">${body}</div>`;
}
