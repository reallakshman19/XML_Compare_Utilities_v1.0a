import { anchorPriorityLabel, configuredAnchorSlots } from './navis-tag-anchor-policy.js';
import { DEFAULT_APPLIES_TO_CONFIG } from './navis-tag-applies-to.js';
import { ALTERNATE_MATCH_COLUMN, DEFAULT_ISONOTE_KEYWORD_MAPPINGS, keywordMappingRows } from './navis-tag-final-output.js';
import { renderAnchorPreview, renderAnchorTagDropdown, renderAnchorSupportDropdown, renderFilterBar } from './navis-tag-isonote-ui-view.js';

const STYLE_ID = 'navis-tag-isonote-workflow-style';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function joinList(values) { return (Array.isArray(values) ? values : []).join('\n'); }
function loaded(value) { return Boolean(String(value ?? '').trim()); }
function sourceState(state, key) {
  const names = state.sourceNames || {};
  const types = state.sourceTypes || {};
  const present = key === 'table' ? loaded(state.tableText)
    : key === 'navis' ? loaded(state.navisText)
      : Boolean(state.stagedDocuments?.length);
  return {
    present,
    name: names[key] || (present ? 'Loaded source' : 'Not loaded'),
    type: types[key] || '',
  };
}
function sourceCard(state, key, title, detail, accept) {
  const source = sourceState(state, key);
  return `<article class="nti-source-card ${source.present ? 'is-ready' : ''}">
    <div class="nti-source-card-head"><span class="nti-source-icon">${source.present ? '✓' : '+'}</span><div><b>${esc(title)}</b><span>${esc(detail)}</span></div></div>
    <div class="nti-source-file">${esc(source.name)}</div>
    <div class="nti-source-type">${source.type ? `Type: ${esc(source.type)}` : 'Choose a source file'}</div>
    <label class="nti-btn nti-file-button">Select file<input type="file" data-nti-file="${esc(key)}" accept="${esc(accept)}"></label>
  </article>`;
}
function statusBadge(value) {
  const normalized = String(value || 'NOT BUILT');
  const css = /READY|COMPLETE|CURRENT/.test(normalized) ? 'nti-ok' : /WARN|STALE|PENDING/.test(normalized) ? 'nti-warn' : 'nti-error';
  return `<span class="nti-badge ${css}">${esc(normalized)}</span>`;
}
function anchorBadge(value) {
  const normalized = String(value || 'NOT_CONFIGURED');
  const css = /VALID_HYPOTHESIS/.test(normalized) ? 'nti-ok'
    : /PENDING|NOT_CONFIGURED|INCOMPLETE/.test(normalized) ? 'nti-warn' : 'nti-error';
  return `<span class="nti-badge ${css}">${esc(normalized)}</span>`;
}
function metric(label, value) {
  return `<div class="nti-metric"><span>${esc(label)}</span><strong>${esc(value ?? 0)}</strong></div>`;
}
function homeMetrics(state) {
  const audit = state.audit?.summary || {};
  const trace = state.identityTrace?.summary || {};
  const navis = state.navisParse?.summary || {};
  return `<div class="nti-metrics">
    ${metric('JSON support rows', trace.rowCount || state.resolutionBuild?.summary?.rowCount || 0)}
    ${metric('Valid Navis tags', navis.validTagCount || 0)}
    ${metric('Valid anchor pairs', audit.validAnchorCount || navis.anchorValidCount || 0)}
    ${metric('Direct matches', audit.resolvedCount || 0)}
    ${metric('Propagated rows', audit.propagatedTargetRowCount || 0)}
    ${metric('Final output rows', audit.finalOutputCount || state.audit?.finalRows?.length || 0)}
  </div>`;
}
function unitsSelect(key, value, allowAuto = true) {
  const values = allowAuto ? ['auto','mm','m','cm','ft','in'] : ['mm','m','cm','ft','in'];
  return `<select data-nti-config="${esc(key)}">${values.map((item) => `<option value="${item}" ${value === item ? 'selected' : ''}>${item}</option>`).join('')}</select>`;
}
function field(label, control, help = '') {
  return `<label class="nti-field"><span>${esc(label)}</span>${control}${help ? `<small>${esc(help)}</small>` : ''}</label>`;
}
function textInput(key, value, type = 'text', extra = '') {
  return `<input type="${type}" data-nti-config="${esc(key)}" value="${esc(value)}" ${extra}>`;
}
function textarea(key, value, rows = 4) {
  return `<textarea rows="${rows}" data-nti-config="${esc(key)}">${esc(value)}</textarea>`;
}
function checkbox(key, checked) {
  return `<input type="checkbox" data-nti-config="${esc(key)}" ${checked ? 'checked' : ''}>`;
}
function mappingRows(state) {
  const rows = keywordMappingRows(state.config || {});
  const source = rows.length ? rows : [{ key: '', value: '' }];
  return source.map((row, index) => `<div class="nti-keyword-row" data-nti-keyword-row="${index}">
    <input data-nti-keyword-key value="${esc(row.key)}" aria-label="Tag keyword" placeholder="R">
    <span>→</span>
    <input data-nti-keyword-value value="${esc(row.value)}" aria-label="Expanded instruction" placeholder="REST">
    <button class="nti-icon-btn" type="button" data-nti-action="remove-keyword" data-nti-keyword-index="${index}" title="Remove mapping">×</button>
  </div>`).join('');
}
function anchorAttempt(state, slot) {
  return (state.navisParse?.anchor?.attempts || []).find((row) => Number(row.slot || row.priority) === Number(slot)) || null;
}
function anchorUsage(state, attempt) {
  if (!attempt?.anchorId) return null;
  return (state.audit?.anchorUsage || []).find((row) => row.anchorBasisId === attempt.anchorId) || null;
}
function anchorAttemptDetail(state, attempt, configured) {
  if (!attempt) return configured ? 'Build or Run to evaluate this anchor.' : 'Optional equal-authority slot.';
  const authority = attempt.resolvedSupportIdentity ? ` Resolved pair: Tag ${attempt.resolvedTagId} ↔ /${String(attempt.resolvedSupportIdentity).replace(/^\/+/, '')}.` : '';
  const delta = attempt.valid ? ` Translation: ΔE=${Number(attempt.deltaEMm).toFixed(3)}, ΔN=${Number(attempt.deltaNMm).toFixed(3)}, ΔEL=${Number(attempt.deltaElMm).toFixed(3)} mm.` : '';
  const usage = anchorUsage(state, attempt);
  const usageText = usage ? ` Best basis for ${usage.candidateCount} candidate relationships; selected in ${usage.selectedCount} final decisions.` : '';
  return `${attempt.reason || ''}${authority}${delta}${usageText}`.trim();
}
function renderAnchorPriorityRows(state) {
  return `<div class="nti-anchor-priority-list">${configuredAnchorSlots(state.config || {}, true).map((slot) => {
    const attempt = anchorAttempt(state, slot.slot);
    const status = attempt?.status || (slot.configured ? 'PENDING_BUILD' : 'NOT_CONFIGURED');
    return `<article class="nti-anchor-priority-row" data-nti-anchor-priority="${slot.slot}">
      <div class="nti-anchor-priority"><strong>A${slot.slot}</strong><span>${esc(anchorPriorityLabel(slot.slot))}</span></div>
      <div class="nti-anchor-pair">
        ${field('Navis Tag ID', renderAnchorTagDropdown(state, slot.tagKey))}
        ${field('JSON Support ID', renderAnchorSupportDropdown(state, slot.supportKey, 0))}
      </div>
      <div class="nti-anchor-result">${anchorBadge(status)}<small>${esc(anchorAttemptDetail(state, attempt, slot.configured))}</small></div>
    </article>`;
  }).join('')}</div>`;
}
function renderAnchorSummary(state) {
  const anchor = state.navisParse?.anchor;
  if (!anchor?.active) return '<div class="nti-help">Configure at least one complete Tag ↔ JSON support pair, then Build or Run.</div>';
  if (anchor.validCount === 1 && anchor.globalTransformApplied) return renderAnchorPreview(state);
  return `<div class="nti-help"><b>${esc(anchor.summaryText)}</b><br>Each valid anchor runs a complete Tag-matching loop. Only each loop winner enters the cross-loop comparison, and the selected basis is recorded in the audit and final output.</div>`;
}
function renderHome(state) {
  const readiness = state.readiness?.status || (state.inputsDirty ? 'STALE / NOT BUILT' : 'NOT BUILT');
  const remembered = state.sessionMeta?.restoredAt
    ? `<div class="nti-memory-note"><b>Restored from this browser</b><span>Saved ${esc(state.sessionMeta.restoredAt)}. File names, source types, configuration, and source text that fit local-storage limits were restored.</span></div>`
    : `<div class="nti-memory-note"><b>Browser memory enabled</b><span>The last loaded names, source types, configuration, and restorable source values are saved locally on this device.</span></div>`;
  const anchorCard = `<section class="nti-card nti-anchor-card">
    <div class="nti-section-head"><div>
      <h3>Multi-anchor coordinate matching</h3>
      <p>Each valid Tag ↔ JSON support pair defines an independent complete matching loop. Every loop transforms all Tags and contributes only its closest in-tolerance winner for each support.</p>
    </div></div>
    <div class="nti-anchor-policy"><b>Equal-authority rule:</b> no primary anchor, no fallback order, and no averaging. Anchor-loop winners are compared geometrically; lower-ranked Tags remain audit evidence and cannot create final duplicate rows.</div>
    ${renderAnchorPriorityRows(state)}
    <div class="nti-anchor-preview-wrap">${renderAnchorSummary(state)}</div>
  </section>`;
  return `<section class="nti-workflow-hero">
    <div><span class="nti-eyebrow">NAVIS TAG → ISONOTE</span><h2>Build traceable support notes from Tag evidence</h2><p>Load the model sources, verify coordinate hypotheses, resolve direct Tags, propagate applies-to directives, and export the final support-note table.</p></div>
    <div class="nti-hero-status"><span>Readiness</span>${statusBadge(readiness)}</div>
  </section>
  ${remembered}
  <section class="nti-card">
    <div class="nti-section-head"><div><h3>1. Load source evidence</h3><p>Support table is optional unless table-only mode is selected. Navis XML and staged JSON/ZIP are required for the full workflow.</p></div><button class="nti-btn" data-nti-action="clear-session">Clear remembered sources</button></div>
    <div class="nti-source-grid">
      ${sourceCard(state, 'table', 'Support table', 'CSV, TSV, workbook or pasted values', '.csv,.tsv,.txt,.xlsx,.xlsm,.xlsb,.xls,.ods')}
      ${sourceCard(state, 'navis', 'Navis Tag XML', 'Tag IDs, comments and RLTAG_POS3D', '.xml')}
      ${sourceCard(state, 'staged', 'Managed staged model', 'JSON or ZIP with support hierarchy', '.json,.zip')}
    </div>
    <details class="nti-paste-panel"><summary>Paste or inspect source text</summary><div class="nti-grid-2">
      ${field('Support table preview / paste', `<textarea data-nti-field="tableText" placeholder="Name of the element&#9;PIPE&#9;POS">${esc(state.tableText)}</textarea>`)}
      ${field('Navis Tag XML preview / paste', `<textarea data-nti-field="navisText" placeholder="&lt;exchange units=&quot;m&quot;&gt;...">${esc(state.navisText)}</textarea>`)}
    </div></details>
  </section>
  ${anchorCard}
  <section class="nti-card">
    <div class="nti-section-head"><div><h3>2. Build and resolve</h3><p>Build refreshes hierarchy and anchor hypotheses. Run automatically rebuilds stale inputs before matching.</p></div><button class="nti-btn" data-nti-action="open-config">Open Config</button></div>
    <div class="nti-step-grid">
      <div><b>JSON Trace</b><span>Resolve support families, pipe names and canonical positions.</span></div>
      <div><b>Anchor loops</b><span>Run complete matching independently under every valid anchor translation.</span></div>
      <div><b>Match and propagate</b><span>Compare only the closest winner from each anchor loop, then apply propagation.</span></div>
      <div><b>Final Output</b><span>Retain one highest-score direct owner per Tag and summarize alternates in one column.</span></div>
    </div>
    <div class="nti-actions nti-primary-actions">
      <button class="nti-btn" data-nti-action="build">Build evidence</button>
      <button class="nti-btn nti-btn-primary" data-nti-action="run">Run ISONOTE resolution</button>
      <button class="nti-btn" data-nti-action="open-final" ${state.audit?.finalRows?.length ? '' : 'disabled'}>Open Final Output</button>
    </div>
    <div class="nti-run-status">${esc(state.status)}</div>
  </section>
  ${homeMetrics(state)}`;
}
function renderConfig(state) {
  const cfg = state.config || {};
  const applies = { ...DEFAULT_APPLIES_TO_CONFIG, ...cfg };
  return `<section class="nti-config-intro"><div><span class="nti-eyebrow">DEDICATED CONFIGURATION</span><h2>Mapping, coordinate frames and output vocabulary</h2><p>Changes are stored in browser local storage. A changed setting marks derived evidence stale; Run rebuilds it automatically.</p></div><div class="nti-actions"><button class="nti-btn" data-nti-action="reset-config">Reset defaults</button><button class="nti-btn nti-btn-primary" data-nti-action="save-config">Save configuration</button></div></section>
  <details class="nti-card nti-config-section" open><summary>Final table and Tag keyword expansion</summary>
    <div class="nti-help">The final Support ISONOTE is formatted as <code>:/SUPPORT REST, GUIDE, LINE STOP</code>. A grouped <code>/DATUM</code> identity is preferred; otherwise the smallest numeric suffix is selected.</div>
    <div class="nti-grid">
      ${field('Support ISONOTE prefix', textInput('isonoteOutputPrefix', cfg.isonoteOutputPrefix || ':/'), 'Applied immediately before the selected support identity.')}
    </div>
    <div class="nti-keyword-editor"><div class="nti-section-head"><div><b>Tag keyword mappings</b><span>Original Tag values remain in the Tag column; these mappings create the expanded Support ISONOTE.</span></div><button class="nti-icon-add" type="button" data-nti-action="add-keyword" title="Add keyword mapping">+</button></div>${mappingRows(state)}</div>
  </details>
  <details class="nti-card nti-config-section" open><summary>Coordinate frames and direct Tag tolerances</summary><div class="nti-grid">
    ${field('Support coordinate source', `<select data-nti-config="supportCoordinateSource">${['prefer-table-fallback-json','prefer-json-fallback-table','table-only','json-only','compare-table-json'].map((value) => `<option value="${value}" ${cfg.supportCoordinateSource === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`)}
    ${field('E tolerance mm', textInput('eastingToleranceMm', cfg.eastingToleranceMm, 'number', 'min="0"'))}
    ${field('N tolerance mm', textInput('northingToleranceMm', cfg.northingToleranceMm, 'number', 'min="0"'))}
    ${field('EL / OD-half tolerance mm', textInput('elevationToleranceMm', cfg.elevationToleranceMm, 'number', 'min="0"'))}
    ${field('Table-vs-JSON disagreement mm', textInput('coordinateDisagreementToleranceMm', cfg.coordinateDisagreementToleranceMm, 'number', 'min="0"'))}
    ${field('Navis units', unitsSelect('navisUnits', cfg.navisUnits, true))}
    ${field('Navis coordinate profile', textInput('navisCoordinateProfileName', cfg.navisCoordinateProfileName))}
    ${field('Navis E datum offset mm', textInput('navisEastingDatumMm', cfg.navisEastingDatumMm, 'number'))}
    ${field('Navis N datum offset mm', textInput('navisNorthingDatumMm', cfg.navisNorthingDatumMm, 'number'))}
    ${field('Navis EL datum offset mm', textInput('navisElevationDatumMm', cfg.navisElevationDatumMm, 'number'))}
    ${field('Table units', unitsSelect('tableUnits', cfg.tableUnits, true))}
    ${field('Table coordinate profile', textInput('tableCoordinateProfileName', cfg.tableCoordinateProfileName))}
    ${field('Table E datum mm', textInput('tableEastingDatumMm', cfg.tableEastingDatumMm, 'number'))}
    ${field('Table N datum mm', textInput('tableNorthingDatumMm', cfg.tableNorthingDatumMm, 'number'))}
    ${field('Table EL datum mm', textInput('tableElevationDatumMm', cfg.tableElevationDatumMm, 'number'))}
    ${field('JSON units', unitsSelect('jsonUnits', cfg.jsonUnits, true))}
    ${field('JSON coordinate profile', textInput('jsonCoordinateProfileName', cfg.jsonCoordinateProfileName))}
    ${field('JSON E datum mm', textInput('jsonEastingDatumMm', cfg.jsonEastingDatumMm, 'number'))}
    ${field('JSON N datum mm', textInput('jsonNorthingDatumMm', cfg.jsonNorthingDatumMm, 'number'))}
    ${field('JSON EL datum mm', textInput('jsonElevationDatumMm', cfg.jsonElevationDatumMm, 'number'))}
  </div></details>
  <details class="nti-card nti-config-section" open><summary>Applies-to pipe propagation</summary><div class="nti-grid">
    ${field('Enable applies-to propagation', checkbox('appliesToEnabled', applies.appliesToEnabled))}
    ${field('Directive regex', textarea('appliesToDirectiveRegex', applies.appliesToDirectiveRegex, 3))}
    ${field('Target separator regex', textarea('appliesToTargetSeparatorRegex', applies.appliesToTargetSeparatorRegex, 3))}
    ${field('Line-key regex', textarea('appliesToLineKeyRegex', applies.appliesToLineKeyRegex, 3))}
    ${field('Line-key capture group', textInput('appliesToLineKeyCaptureGroup', applies.appliesToLineKeyCaptureGroup, 'number', 'min="0" step="1"'))}
    ${field('Same-station tolerance mm', textInput('appliesToAlongAxisToleranceMm', applies.appliesToAlongAxisToleranceMm, 'number', 'min="0"'))}
    ${field('Parallel offset tolerance mm', textInput('appliesToParallelOffsetToleranceMm', applies.appliesToParallelOffsetToleranceMm, 'number', 'min="0"'))}
    ${field('Elevation tolerance mm', textInput('appliesToElevationToleranceMm', applies.appliesToElevationToleranceMm, 'number', 'min="0"'))}
    ${field('Axis dominance ratio', textInput('appliesToAxisDominanceRatio', applies.appliesToAxisDominanceRatio, 'number', 'min="1" step="0.05"'))}
    ${field('Minimum span to prove axis mm', textInput('appliesToMinimumAxisSpanMm', applies.appliesToMinimumAxisSpanMm, 'number', 'min="0"'))}
    ${field('Derived audit-note template', textInput('appliesToDerivedNoteTemplate', applies.appliesToDerivedNoteTemplate))}
  </div></details>
  <details class="nti-card nti-config-section"><summary>Source identity and staged JSON paths</summary><div class="nti-grid">
    ${field('Table support identity columns', textarea('tableIdentityColumns', joinList(cfg.tableIdentityColumns)))}
    ${field('Table reference columns', textarea('tableReferenceColumns', joinList(cfg.tableReferenceColumns)))}
    ${field('Table pipe / branch columns', textarea('tablePipeColumns', joinList(cfg.tablePipeColumns)))}
    ${field('Table position mode', `<select data-nti-config="tablePositionMode">${['single','separate'].map((value) => `<option value="${value}" ${cfg.tablePositionMode === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`)}
    ${field('Table single POS column', textInput('tablePositionColumn', cfg.tablePositionColumn))}
    ${field('Table E column', textInput('tableEastingColumn', cfg.tableEastingColumn))}
    ${field('Table N column', textInput('tableNorthingColumn', cfg.tableNorthingColumn))}
    ${field('Table EL column', textInput('tableElevationColumn', cfg.tableElevationColumn))}
    ${field('JSON identity paths', textarea('jsonIdentityPaths', joinList(cfg.jsonIdentityPaths)))}
    ${field('JSON reference paths', textarea('jsonReferencePaths', joinList(cfg.jsonReferencePaths)))}
    ${field('JSON position paths', textarea('jsonPositionPaths', joinList(cfg.jsonPositionPaths)))}
    ${field('JSON branch paths', textarea('jsonBranchPaths', joinList(cfg.jsonBranchPaths)))}
    ${field('JSON pipe paths', textarea('jsonPipePaths', joinList(cfg.jsonPipePaths)))}
    ${field('JSON zone paths', textarea('jsonZonePaths', joinList(cfg.jsonZonePaths)))}
    ${field('JSON OD paths', textarea('jsonOdPaths', joinList(cfg.jsonOdPaths)))}
    ${field('JSON bore paths', textarea('jsonBorePaths', joinList(cfg.jsonBorePaths)))}
  </div></details>
  <details class="nti-card nti-config-section"><summary>Bore-to-OD options</summary><div class="nti-grid">
    ${field('Enable explicit bore→OD lookup', checkbox('boreToOdLookupEnabled', cfg.boreToOdLookupEnabled))}
    ${field('Lookup name', textInput('boreToOdLookupName', cfg.boreToOdLookupName))}
    ${field('OD units', unitsSelect('jsonOdUnits', cfg.jsonOdUnits, false))}
    ${field('Bore units', unitsSelect('jsonBoreUnits', cfg.jsonBoreUnits, false))}
    ${field('Explicit bore→OD lookup JSON', textarea('boreToOdLookup', JSON.stringify(cfg.boreToOdLookup || {}, null, 2), 8))}
  </div></details>
  <div class="nti-actions nti-sticky-actions"><button class="nti-btn nti-btn-primary" data-nti-action="save-config">Save configuration</button><span class="nti-status">${esc(state.status)}</span></div>`;
}
function renderTable(headers, rows, tableClass) {
  if (!rows.length) return '<div class="nti-empty-output">Run ISONOTE resolution to generate the final table.</div>';
  return `<div class="nti-table-wrap"><table class="nti-table ${esc(tableClass)}"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td title="${esc(row[header])}">${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderFinal(state) {
  const rows = state.audit?.finalRows || [];
  const headers = ['Name of the element','PIPE','POS','Navis Tag ID','Navis Tag POS','Tag','Support ISONOTE','confidence','Anchor pair basis',ALTERNATE_MATCH_COLUMN,'Basis'];
  return `<section class="nti-workflow-hero nti-output-hero"><div><span class="nti-eyebrow">FINAL OUTPUT</span><h2>Support ISONOTE delivery table</h2><p>Only the highest-score direct owner for each Navis Tag is retained. Other candidate or support relationships are summarized in ${esc(ALTERNATE_MATCH_COLUMN)} while complete evidence remains in the audit exports.</p></div><div class="nti-hero-status"><span>Rows</span><strong>${esc(rows.length)}</strong></div></section>
  <section class="nti-card"><div class="nti-section-head"><div><h3>Final table</h3><p>There are no separate NOT_SELECTED rows. Ambiguous supports retain only their highest-ranked candidate and leave Support ISONOTE blank.</p></div><div class="nti-actions"><button class="nti-btn nti-btn-primary" data-nti-action="download-final-csv" ${rows.length ? '' : 'disabled'}>Export final CSV</button><button class="nti-btn" data-nti-action="download-audit" ${state.audit ? '' : 'disabled'}>Audit JSON</button></div></div>
    ${renderFilterBar('final-output', 'Filter support, pipe, Tag, confidence, anchor pair, alternate match or basis...')}
    ${renderTable(headers, rows, 'nti-filter-table-final-output')}
  </section>
  <section class="nti-card"><h3>Additional audit exports</h3><div class="nti-help">These files retain complete direct, rejected, anchor-loop, alternate-candidate and propagation evidence behind the consolidated final delivery table.</div><div class="nti-actions">
    <button class="nti-btn" data-nti-action="download-csv" ${state.audit?.augmentedRows?.length ? '' : 'disabled'}>Augmented audit CSV</button>
    <button class="nti-btn" data-nti-action="download-ambiguous" ${state.audit?.ambiguousRows?.length ? '' : 'disabled'}>Ambiguous CSV</button>
    <button class="nti-btn" data-nti-action="download-rejected" ${state.audit?.rejectedRows?.length ? '' : 'disabled'}>Rejected CSV</button>
  </div></section>`;
}

export function renderNavisTagWorkflowPane(state) {
  if (state.activeTab === 'inputs') return renderHome(state);
  if (state.activeTab === 'config') return renderConfig(state);
  if (state.activeTab === 'augmented') return renderFinal(state);
  return null;
}

export function ensureNavisTagWorkflowStyle(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
  .nti-workflow-hero,.nti-config-intro{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:22px;border:1px solid rgba(56,189,248,.28);border-radius:14px;background:linear-gradient(135deg,rgba(29,78,216,.20),rgba(15,23,42,.88));margin-bottom:12px}.nti-workflow-hero h2,.nti-config-intro h2{margin:4px 0 8px;color:#f8fafc;font-size:24px}.nti-workflow-hero p,.nti-config-intro p,.nti-section-head p{margin:0;color:#9fb3ca;font-size:12px;line-height:1.5}.nti-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:#7dd3fc}.nti-hero-status{min-width:120px;text-align:center;padding:14px;border-radius:12px;background:rgba(7,16,31,.78);border:1px solid rgba(148,163,184,.2)}.nti-hero-status>span{display:block;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}.nti-hero-status>strong{font-size:28px;color:#f8fafc}.nti-memory-note{display:flex;gap:12px;align-items:center;padding:10px 12px;margin-bottom:12px;border-radius:10px;background:rgba(14,116,144,.12);border:1px solid rgba(34,211,238,.2)}.nti-memory-note b{color:#a5f3fc;font-size:12px}.nti-memory-note span{color:#94a3b8;font-size:11px}.nti-section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.nti-section-head h3{margin:0 0 4px}.nti-source-grid{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:10px}.nti-source-card{display:grid;gap:10px;padding:14px;border:1px dashed rgba(148,163,184,.32);border-radius:12px;background:#0b1424}.nti-source-card.is-ready{border-style:solid;border-color:rgba(52,211,153,.45);background:rgba(6,78,59,.12)}.nti-source-card-head{display:flex;gap:9px;align-items:flex-start}.nti-source-card-head b{display:block;color:#e0f2fe;font-size:13px}.nti-source-card-head span{display:block;color:#94a3b8;font-size:10px;margin-top:3px}.nti-source-icon{display:grid!important;place-items:center;width:24px;height:24px;border-radius:50%;background:#172033;color:#7dd3fc;font-size:14px!important;margin:0!important}.nti-source-file{color:#e5eefb;font:11px ui-monospace,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nti-source-type{color:#94a3b8;font-size:10px}.nti-file-button{display:inline-flex!important;justify-content:center;position:relative;overflow:hidden}.nti-file-button input{position:absolute;inset:0;opacity:0;cursor:pointer}.nti-paste-panel{margin-top:12px;border-top:1px solid rgba(148,163,184,.15);padding-top:10px}.nti-paste-panel summary,.nti-config-section summary{cursor:pointer;color:#bfdbfe;font-weight:700;font-size:12px}.nti-step-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px}.nti-step-grid>div{padding:12px;border-radius:10px;background:#07101f;border:1px solid rgba(148,163,184,.16)}.nti-step-grid b{display:block;color:#dbeafe;font-size:12px;margin-bottom:5px}.nti-step-grid span{color:#94a3b8;font-size:10px;line-height:1.4}.nti-primary-actions{margin-top:14px}.nti-run-status{margin-top:10px;padding:9px 11px;border-radius:8px;background:#07101f;color:#fbbf24;font-size:11px}.nti-config-section>summary{font-size:14px;padding:2px 0 10px}.nti-config-section[open]>summary{border-bottom:1px solid rgba(148,163,184,.14);margin-bottom:12px}.nti-field small{color:#64748b;font-size:10px}.nti-keyword-editor{margin-top:12px;padding:12px;border-radius:10px;background:#07101f;border:1px solid rgba(148,163,184,.16)}.nti-keyword-row{display:grid;grid-template-columns:minmax(80px,.35fr) 24px minmax(180px,1fr) 34px;gap:7px;align-items:center;margin-top:7px}.nti-keyword-row input{width:100%;box-sizing:border-box;background:#0b1424;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:7px;padding:7px;font:12px ui-monospace,Consolas,monospace}.nti-keyword-row>span{text-align:center;color:#7dd3fc}.nti-icon-btn,.nti-icon-add{border:1px solid rgba(148,163,184,.3);background:#172033;color:#e5eefb;border-radius:8px;cursor:pointer}.nti-icon-btn{height:32px}.nti-icon-add{width:34px;height:34px;font-size:22px;color:#7dd3fc}.nti-sticky-actions{position:sticky;bottom:0;padding:10px;background:rgba(15,23,42,.95);border-top:1px solid rgba(148,163,184,.18);z-index:3}.nti-empty-output{padding:28px;text-align:center;color:#94a3b8}.nti-output-hero{background:linear-gradient(135deg,rgba(5,150,105,.16),rgba(15,23,42,.9))}.nti-anchor-card{border-left:4px solid var(--accent-primary,#0078d4)}.nti-anchor-policy{padding:10px 12px;border-radius:9px;background:rgba(30,64,175,.13);border:1px solid rgba(96,165,250,.22);color:#bfdbfe;font-size:11px}.nti-anchor-priority-list{display:grid;gap:8px;margin-top:10px}.nti-anchor-priority-row{display:grid;grid-template-columns:120px minmax(420px,1fr) minmax(210px,.45fr);gap:10px;align-items:center;padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:#07101f}.nti-anchor-priority{display:grid;gap:3px}.nti-anchor-priority strong{color:#7dd3fc;font-size:18px}.nti-anchor-priority span{color:#94a3b8;font-size:10px}.nti-anchor-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nti-anchor-result{display:grid;gap:5px;justify-items:start}.nti-anchor-result small{color:#94a3b8;font-size:10px;line-height:1.35}.nti-anchor-preview-wrap{margin-top:10px}
  @media(max-width:1100px){.nti-source-grid,.nti-step-grid{grid-template-columns:1fr 1fr}.nti-workflow-hero,.nti-config-intro{align-items:flex-start}.nti-keyword-row{grid-template-columns:80px 20px 1fr 34px}.nti-anchor-priority-row{grid-template-columns:90px 1fr}.nti-anchor-result{grid-column:2}.nti-anchor-pair{grid-template-columns:1fr 1fr}}@media(max-width:700px){.nti-source-grid,.nti-step-grid{grid-template-columns:1fr}.nti-workflow-hero,.nti-config-intro,.nti-section-head,.nti-memory-note{flex-direction:column}.nti-hero-status{width:100%;box-sizing:border-box}.nti-anchor-priority-row,.nti-anchor-pair{grid-template-columns:1fr}.nti-anchor-result{grid-column:auto}}
  `;
  doc.head?.appendChild(style);
}

export const _test = Object.freeze({
  renderHome,
  renderConfig,
  renderFinal,
  mappingRows,
  sourceState,
  renderAnchorPriorityRows,
  DEFAULT_ISONOTE_KEYWORD_MAPPINGS,
});
