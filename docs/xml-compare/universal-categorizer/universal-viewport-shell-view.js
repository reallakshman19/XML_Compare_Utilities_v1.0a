const arr = (value) => Array.isArray(value) ? value : [];
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function modeButtons(model) {
  return model.modes.map((mode) => `<button type="button" role="tab" data-uxc-mode="${mode.id}" aria-selected="${model.mode === mode.id}" class="${model.mode === mode.id ? 'is-active' : ''}">${esc(mode.label)}</button>`).join('');
}

export function renderUniversalViewportActions(model) {
  return model.shell.actions.map((action) => `<button type="button" data-uxc-view-action="${esc(action.id)}">${esc(action.label)}</button>`).join('');
}

function optionRows(values, selected) {
  return ['<option value="">All</option>', ...arr(values).map((value) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`)].join('');
}

function searchAndFilters(model) {
  const options = model.filters.options || {};
  return `<div class="uxc-query-toolbar">
    <label class="uxc-search-label">Search previews<input type="search" data-uxc-preview-search value="${esc(model.search.text)}" autocomplete="off" spellcheck="false"></label>
    <button type="button" data-uxc-search-clear>Clear search</button>
    <span data-uxc-tree-count>${model.search.treeCount} / ${model.search.treeTotal} Tree</span>
    <span data-uxc-pivot-count>${model.search.pivotCount} / ${model.search.pivotTotal} Pivot</span>
    <label>Tree level<select data-uxc-tree-filter="level">${optionRows(options.tree?.level, model.filters.tree.level)}</select></label>
    <label>Pivot level<select data-uxc-pivot-filter="level">${optionRows(options.pivot?.level, model.filters.pivot.level)}</select></label>
    <label>Pivot block<select data-uxc-pivot-filter="block">${optionRows(options.pivot?.block, model.filters.pivot.block)}</select></label>
    <label>Pivot source<select data-uxc-pivot-filter="source">${optionRows(options.pivot?.source, model.filters.pivot.source)}</select></label>
  </div>`;
}

function namedViewControls(model) {
  const namedOptions = ['<option value="">Select named view</option>', ...model.namedViews.items.map((view) => `<option value="${esc(view.id)}"${view.id === model.namedViews.selectedId ? ' selected' : ''}>${esc(view.name)}</option>`)].join('');
  return `<div class="uxc-named-view-toolbar">
    <label>View name<input type="text" maxlength="80" data-uxc-named-view-name></label>
    <label>Named views<select data-uxc-named-view-select>${namedOptions}</select></label>
    <button type="button" data-uxc-named-view-action="save">Save current view</button>
    <button type="button" data-uxc-named-view-action="apply">Apply named view</button>
    <button type="button" data-uxc-named-view-action="rename">Rename named view</button>
    <button type="button" data-uxc-named-view-action="delete">Delete named view</button>
    <span data-uxc-named-view-status aria-live="polite"></span>
  </div>`;
}

function treeSurface(model) {
  return `<section class="uxc-viewport-surface uxc-tree-surface" data-uxc-surface="tree" tabindex="0" role="treegrid" aria-label="Tree preview viewport" aria-rowcount="${model.search.treeCount}">
    <div class="uxc-virtual-spacer" data-uxc-virtual-spacer><div class="uxc-virtual-rows" data-uxc-viewport-content></div></div>
    <p class="uxc-empty-results" data-uxc-empty-results hidden>No Tree rows match the current search and filters.</p>
  </section>`;
}

function pivotHeader(preview) {
  return `<div class="uxc-pivot-header" role="row">${arr(preview.pivot.columns).map((column) => `<span role="columnheader">${esc(column)}</span>`).join('')}</div>`;
}

function pivotSurface(model, preview) {
  return `<section class="uxc-viewport-surface uxc-pivot-surface" data-uxc-surface="pivot" tabindex="0" role="grid" aria-label="Pivot preview viewport" aria-rowcount="${model.search.pivotCount}" aria-colcount="${arr(preview.pivot.columns).length}">
    ${pivotHeader(preview)}
    <div class="uxc-virtual-spacer" data-uxc-virtual-spacer><div class="uxc-virtual-rows uxc-pivot-rows" role="rowgroup" data-uxc-viewport-content></div></div>
    <p class="uxc-empty-results" data-uxc-empty-results hidden>No Pivot rows match the current search and filters.</p>
  </section>`;
}

function diagnostics(model, viewModel) {
  const items = [...arr(model.diagnostics), ...arr(viewModel.samplePreview?.advancedDiagnostics?.items), ...arr(model.namedViews.diagnostics)];
  return `<section class="uxc-viewport-diagnostics" data-uxc-surface="diagnostics"><h5>Read-only diagnostics</h5>${items.length ? `<ul>${items.slice(0, 100).map((item) => `<li><b>${esc(item.code)}</b> ${esc(item.message)}</li>`).join('')}</ul>` : '<p>No diagnostics.</p>'}</section>`;
}

export function renderUniversalViewportInspector(model) {
  const item = model.inspector;
  const hidden = item.hidden ? '<p class="uxc-hidden-selection" data-uxc-hidden-selection>Current selection is hidden by search or filters.</p>' : '<p class="uxc-hidden-selection" data-uxc-hidden-selection hidden></p>';
  return `<aside class="uxc-viewport-inspector" aria-live="polite"><b>${model.contextStatus === 'loaded' ? 'Loaded preview' : 'Sample preview'}</b>${hidden}<dl><dt>Path</dt><dd>${esc(item.path)}</dd><dt>Level</dt><dd>${esc(item.level)}</dd><dt>Key</dt><dd>${esc(item.key)}</dd><dt>Block</dt><dd>${esc(item.block)}</dd><dt>Field</dt><dd>${esc(item.field)}</dd><dt>Value / source</dt><dd>${esc(item.value)} · ${esc(item.source)}</dd></dl><small>Context ${esc(model.contextSignature)}</small></aside>`;
}

function rangePalette() {
  return `<form class="uxc-range-palette" data-uxc-range-palette hidden><label>Min X<input name="minX" type="number" step="any"></label><label>Max X<input name="maxX" type="number" step="any"></label><label>Min Y<input name="minY" type="number" step="any"></label><label>Max Y<input name="maxY" type="number" step="any"></label><button type="submit">Apply</button><button type="button" data-uxc-range-cancel>Cancel</button><p data-uxc-range-error></p></form>`;
}

function surfaces(model, preview, viewModel) {
  return `<div class="uxc-preview-surfaces" data-uxc-preview-surfaces data-mode="${esc(model.mode)}"><div class="uxc-side-by-side">${treeSurface(model)}${pivotSurface(model, preview)}</div>${diagnostics(model, viewModel)}</div>`;
}

export function renderUniversalViewportShell(model, viewModel) {
  const preview = viewModel.samplePreview;
  return `<section class="uxc-panel uxc-preview-panel" data-uxc-viewport-shell data-mode="${esc(model.mode)}"><div class="uxc-panel-heading"><div><span class="uxc-panel-kicker">Preview</span><h4>Interactive Tree / Pivot Workbench</h4></div><span class="uxc-status-chip is-locked">Export locked</span></div><div class="uxc-mode-toolbar" role="tablist" aria-label="Preview mode">${modeButtons(model)}</div><div class="uxc-viewport-toolbar">${renderUniversalViewportActions(model)}</div>${searchAndFilters(model)}${namedViewControls(model)}<div class="uxc-viewport-layout">${surfaces(model, preview, viewModel)}${renderUniversalViewportInspector(model)}</div>${rangePalette()}<p class="uxc-viewport-status" data-uxc-viewport-status>${esc(model.shell.statusSegments.join(' · '))}</p></section>`;
}

export function universalViewportStyleHtml() {
  return `<style>
  .universal-xml-categorizer-backdrop{position:fixed;inset:0;background:#07101ed9;z-index:2147482000;display:grid;place-items:center;padding:18px}.universal-xml-categorizer-dialog{width:min(1500px,98vw);height:min(920px,96vh);overflow:auto;background:#101927;color:#e8eef7;border:1px solid #43516a;border-radius:12px;font:14px/1.4 system-ui}.uxc-hero{display:flex;justify-content:space-between;gap:16px;padding:18px;position:sticky;top:0;background:#101927;z-index:4;border-bottom:1px solid #334159}.uxc-hero h3{margin:2px 0;font-size:22px}.uxc-hero p{margin:0;color:#aab7c9}.uxc-hero-actions{display:flex;gap:8px;align-items:center}.uxc-status-chip{padding:4px 8px;border:1px solid #53637d;border-radius:999px}.is-locked{color:#ffc76b}.uxc-workflow,.uxc-readiness-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;padding:12px 18px}.uxc-workflow article,.uxc-readiness-strip article{background:#172337;padding:10px;border-radius:8px}.uxc-builder-workspace{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px 18px 24px}.uxc-panel{background:#142033;border:1px solid #334159;border-radius:10px;padding:12px;min-width:0}.uxc-preview-panel{grid-column:1/-1}.uxc-panel-heading{display:flex;justify-content:space-between;gap:10px;align-items:start}.uxc-panel h4{margin:2px 0 8px}.uxc-panel-kicker{font-size:11px;text-transform:uppercase;color:#79b8ff}.uxc-panel table{width:100%;border-collapse:collapse;font-size:12px}.uxc-panel th,.uxc-panel td{padding:6px;border-bottom:1px solid #2d3a50;text-align:left}.uxc-panel button{background:#243754;color:#eef5ff;border:1px solid #536987;border-radius:6px;padding:6px 9px}.uxc-panel button:disabled{opacity:.55}.uxc-source-card,.uxc-level,.uxc-review-groups article{display:flex;gap:10px;justify-content:space-between;padding:7px;border-bottom:1px solid #2d3a50}.uxc-mode-toolbar,.uxc-viewport-toolbar,.uxc-query-toolbar,.uxc-named-view-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:end}.uxc-query-toolbar label,.uxc-named-view-toolbar label{display:grid;gap:3px}.uxc-query-toolbar input,.uxc-query-toolbar select,.uxc-named-view-toolbar input,.uxc-named-view-toolbar select{min-height:32px;background:#081322;color:#eef5ff;border:1px solid #536987;border-radius:5px;padding:4px 7px}.uxc-search-label{min-width:min(340px,100%)}.uxc-mode-toolbar .is-active{outline:2px solid #69b8ff;background:#174f79}.uxc-viewport-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:10px}.uxc-side-by-side{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:0}.uxc-preview-surfaces[data-mode="tree"] .uxc-pivot-surface,.uxc-preview-surfaces[data-mode="tree"] .uxc-viewport-diagnostics,.uxc-preview-surfaces[data-mode="pivot"] .uxc-tree-surface,.uxc-preview-surfaces[data-mode="pivot"] .uxc-viewport-diagnostics,.uxc-preview-surfaces[data-mode="side-by-side"] .uxc-viewport-diagnostics,.uxc-preview-surfaces[data-mode="diagnostics"] .uxc-side-by-side{display:none}.uxc-preview-surfaces[data-mode="tree"] .uxc-side-by-side,.uxc-preview-surfaces[data-mode="pivot"] .uxc-side-by-side{display:block}.uxc-viewport-surface{height:420px;overflow:auto;background:#07111f;border:1px solid #3c506d;position:relative;contain:strict}.uxc-virtual-spacer{position:relative;min-width:max-content}.uxc-virtual-rows{position:absolute;left:0;top:0;min-width:100%;will-change:transform}.uxc-tree-row{display:grid;grid-template-columns:75px minmax(180px,1fr) minmax(120px,auto);align-items:center;gap:8px;width:calc(100% - var(--uxc-depth)*20px);height:var(--uxc-row-height);text-align:left;margin-left:calc(var(--uxc-depth)*20px);border:0;border-bottom:1px solid #233249;border-radius:0;background:#07111f;overflow:hidden}.uxc-tree-row>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uxc-tree-row.is-selected,.uxc-pivot-row.is-selected{background:#174f79}.uxc-tree-row.is-related,.uxc-pivot-row.is-related{background:#253f59}.uxc-tree-row:focus-visible,.uxc-pivot-row:focus-visible{outline:2px solid #facc15;outline-offset:-2px}.uxc-pivot-header,.uxc-pivot-row{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));min-width:900px}.uxc-pivot-header{position:sticky;top:0;z-index:3;background:#172337;border-bottom:1px solid #536987}.uxc-pivot-header span,.uxc-pivot-row span{padding:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uxc-pivot-row{height:var(--uxc-row-height);background:#07111f;border-bottom:1px solid #233249}.uxc-empty-results{position:sticky;top:48px;padding:16px;color:#fcd34d;background:#07111f}.uxc-viewport-inspector{background:#0c1625;border:1px solid #334159;padding:10px;overflow:auto}.uxc-viewport-inspector dl{display:grid;grid-template-columns:90px 1fr;gap:4px}.uxc-viewport-inspector dt{color:#95a7be}.uxc-viewport-inspector dd{margin:0}.uxc-hidden-selection{padding:7px;border:1px solid #b45309;background:#3b2408;color:#fde68a}.uxc-range-palette{position:fixed;z-index:2147482100;background:#101927;border:1px solid #536987;padding:10px;display:grid;grid-template-columns:repeat(2,120px);gap:7px}.uxc-range-palette[hidden]{display:none}.uxc-range-palette label{display:grid;gap:3px}.uxc-range-palette input{width:100%}.uxc-viewport-diagnostics{height:420px;overflow:auto;background:#07111f;padding:12px}.uxc-viewport-status{font-family:ui-monospace,monospace;color:#a8bfdc}.uxc-locked-actions{display:flex;gap:6px;flex-wrap:wrap}.uxc-eyebrow{color:#79b8ff;text-transform:uppercase;font-size:11px}
  @media(max-width:900px){.uxc-builder-workspace{grid-template-columns:1fr}.uxc-viewport-layout{grid-template-columns:1fr}.uxc-side-by-side{grid-template-columns:1fr}.uxc-viewport-inspector{max-height:220px}}
  </style>`;
}

export const _test = Object.freeze({ modeButtons, optionRows, searchAndFilters, namedViewControls, treeSurface, pivotSurface, rangePalette, surfaces });
