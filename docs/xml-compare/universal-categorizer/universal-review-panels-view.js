const arr = (value) => Array.isArray(value) ? value : [];
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function heading(kicker, title, status = '') {
  return `<div class="uxc-panel-heading"><div><span class="uxc-panel-kicker">${esc(kicker)}</span><h4>${esc(title)}</h4></div>${status ? `<span class="uxc-status-chip">${esc(status)}</span>` : ''}</div>`;
}

function table(headers, rows, empty) {
  return `<table><thead><tr>${headers.map((item) => `<th>${esc(item)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table>`;
}

function sourcePanel(preview) {
  const sourceRows = arr(preview.sources?.rows).map((source) => {
    const columns = arr(source.columns).map((column) => typeof column === 'string' ? column : column.name);
    return `<article class="uxc-source-card"><b>${esc(source.displayName)}</b><small>${esc(source.sourceId)} · ${esc(source.role)} · ${esc(source.rowCount)} rows</small><p>${esc(columns.join(', ') || 'No detected columns')}</p></article>`;
  });
  return `<section class="uxc-panel uxc-source-panel">${heading('Source', preview.sources?.title || 'Source column review', 'Review only')}<p>${esc(preview.sources?.description || '')}</p>${sourceRows.join('')}</section>`;
}

function rolePanel(preview) {
  const review = preview.columnRoleReview || {};
  const rows = arr(review.rows).slice(0, 18).map((row) => `<tr><td>${esc(row.sourceName || row.sourceId)}</td><td>${esc(row.column)}</td><td>${esc(row.inferredRole)}</td><td>${esc(row.pendingRole)}</td><td>${esc(row.reason)}</td></tr>`);
  return `<section class="uxc-panel uxc-column-role-panel">${heading(review.kicker || 'Role overrides', review.title || 'Column role review', review.status || 'Locked')}<p>${esc(review.description || '')}</p>${table(['Source', 'Column', 'Inferred role', 'Pending role', 'Reason'], rows, 'No source columns are available for role review.')}${lockedActions(review.actions)}</section>`;
}

function recipePanel(preview) {
  const builder = preview.builder || {};
  const levels = arr(builder.levels).map((level) => `<article class="uxc-level" data-depth="${esc(level.depth)}"><b>${esc(level.displayName)}</b><small>${esc(level.levelId)} · ${esc(arr(level.blocks).join(', ') || 'No blocks')}</small></article>`).join('');
  return `<section class="uxc-panel uxc-builder-panel">${heading('Recipe Builder', builder.title || 'Structure Recipe Builder', 'Edit locked')}<p>${esc(builder.description || '')}</p><div class="uxc-recipe-tree">${levels}</div>${lockedActions(builder.lockedActions)}</section>`;
}

function propertiesPanel(preview) {
  const selected = preview.builder?.selectedItem || {};
  const blocks = arr(selected.attachedBlocks).map((block) => `<li>${esc(block.blockName)} · ${esc(block.createMode)}</li>`).join('');
  const mappings = arr(selected.mappedFields).map((row) => `<li>${esc(row.sourceId)}: ${esc(row.sourceKey)} → ${esc(row.targetKey)}</li>`).join('');
  return `<section class="uxc-panel uxc-properties-panel">${heading('Properties', selected.title || 'Selected item properties', 'Review only')}<dl><dt>Level</dt><dd>${esc(selected.displayName || '—')}</dd><dt>Key column</dt><dd>${esc(selected.keyColumn || '—')}</dd></dl><h5>Attached blocks</h5><ul>${blocks || '<li>None</li>'}</ul><h5>Field mappings</h5><ul>${mappings || '<li>None</li>'}</ul></section>`;
}

function mappingWorkbenchPanel(preview) {
  const model = preview.mappingWorkbench || {};
  const rows = arr(model.rows).slice(0, 18).map((row) => `<tr><td>${esc(row.sourceName)}<br><code>${esc(row.sourceField)}</code></td><td>${esc(row.targetLocation)}</td><td>${esc(row.role)}</td><td>${esc(row.status)}</td></tr>`);
  return `<section class="uxc-panel uxc-mapping-workbench-panel">${heading('Mapping', model.title || 'Mapping Workbench', model.status || 'Review only')}<p>${esc(model.description || '')}</p>${table(['Source field', 'Target recipe location', 'Role', 'Status'], rows, 'No mapping rows.')}${lockedActions(model.actions)}</section>`;
}

function mappingReviewPanel(preview) {
  const model = preview.mappingReview || {};
  const groups = arr(model.groups).map((group) => `<article><b>${esc(group.label)}</b><span>${esc(group.count)} items</span><small>${esc(group.status)}</small></article>`).join('');
  return `<section class="uxc-panel uxc-mapping-review-panel">${heading('Review queue', model.title || 'Mapping review queue', model.status || 'Review required')}<p>${esc(model.description || '')}</p><div class="uxc-review-groups">${groups}</div><article><h5>${esc(model.selected?.title || 'Selected mapping detail')}</h5><p>${esc(model.selected?.reason || '')}</p></article>${lockedActions(model.decisions)}</section>`;
}

function tracePanel(preview) {
  const model = preview.mappingTrace || {};
  const rows = arr(model.rows).slice(0, 24).map((row) => `<tr><td>${esc(row.sourceRow)}</td><td>${esc(row.sourceField)}</td><td>${esc(row.sampleValue)}</td><td>${esc(row.targetLocation)}</td><td>${esc(row.traceStatus)}</td></tr>`);
  return `<section class="uxc-panel uxc-mapping-trace-panel">${heading('Sample trace', model.title || 'Sample value mapping trace', model.status || 'Preview only')}<p>${esc(model.description || '')}</p>${table(['Source row', 'Source field', 'Sample value', 'Target', 'Trace status'], rows, 'No sample trace rows.')}</section>`;
}

function confidencePanel(preview) {
  const model = preview.mappingConfidence || {};
  const rows = arr(model.rows).slice(0, 18).map((row) => `<tr><td>${esc(row.sourceField)}</td><td>${esc(row.targetLocation)}</td><td>${esc(row.confidenceLevel)}</td><td>${esc(row.qualityScore)}</td><td>${esc(row.readinessStatus)}</td></tr>`);
  return `<section class="uxc-panel uxc-mapping-confidence-panel">${heading('Quality scoring', model.title || 'Mapping confidence', model.status || 'Preview only')}<p>${esc(model.description || '')}</p>${table(['Source field', 'Target', 'Confidence', 'Score', 'Readiness'], rows, 'No mapping confidence rows.')}</section>`;
}

function exportPanel(preview) {
  const plan = preview.exportPlan || {};
  return `<section class="uxc-panel uxc-export-panel">${heading('Export', 'XML export locked', plan.status || 'Locked')}<p>${esc(plan.reason || '')}</p><ul>${arr(plan.guidanceItems).map((item) => `<li>${esc(item)}</li>`).join('')}</ul><button type="button" disabled>Export XML</button></section>`;
}

function diagnosticsPanel(viewModel, preview) {
  const diagnostics = [...arr(preview.advancedDiagnostics?.items), ...arr(viewModel.recipeDesigner?.diagnostics)];
  const rows = diagnostics.slice(0, 80).map((item) => `<tr><td>${esc(item.severity)}</td><td>${esc(item.code)}</td><td>${esc(item.subject || item.subjectId)}</td><td>${esc(item.message)}</td></tr>`);
  return `<section class="uxc-panel uxc-advanced-panel">${heading('Advanced', 'Advanced / Developer diagnostics', `${diagnostics.length} items`)}${table(['Severity', 'Code', 'Subject', 'Message'], rows, 'No diagnostics.')}</section>`;
}

function lockedActions(actions) {
  return `<div class="uxc-locked-actions">${arr(actions).map((action) => `<button type="button" disabled>${esc(action.label)}</button>`).join('')}</div>`;
}

export function renderUniversalReviewPanels(viewModel) {
  const preview = viewModel.samplePreview;
  return [
    sourcePanel(preview), rolePanel(preview), recipePanel(preview), propertiesPanel(preview),
    mappingWorkbenchPanel(preview), mappingReviewPanel(preview), tracePanel(preview),
    confidencePanel(preview), exportPanel(preview), diagnosticsPanel(viewModel, preview),
  ].join('');
}

export const _test = Object.freeze({ sourcePanel, rolePanel, recipePanel, propertiesPanel, mappingWorkbenchPanel, mappingReviewPanel, tracePanel, confidencePanel, exportPanel, diagnosticsPanel });
