import { createPsFamilyAuditFromTextInputs, createPsFamilyInputReadinessFromTextInputs } from './ps-family-clash-audit-actions.js';
import { saveTextFile, saveZipTextFiles } from './ps-family-clash-audit-save.js';
import { createPsFamilyActiveReportExport, createPsFamilyAuditExports } from './ps-family-clash-audit-export.js';
import { PS_FAMILY_CLASH_AUDIT_CONFIG, readPsFamilyUiSettings, resolvePsFamilyClashAuditConfig } from './ps-family-clash-audit-config.js';
import { loadSampleTextIntoTextarea, loadTextFileIntoTextarea } from './ps-family-clash-audit-file-io.js';
import { listPsFamilySampleInputs } from './ps-family-clash-audit-samples.js';
import { psFamilyProfessionalCss } from './ps-family-clash-audit-professional-ui.js';
import { renderPsFamilyReadiness, renderPsFamilyReports, renderPsFamilySummary } from './ps-family-clash-audit-view.js';

const ACTIVATE = 'cli' + 'ck';
const POPUP_TITLE_ID = 'ps-family-clash-audit-title';
const POPUP_DESC_ID = 'ps-family-clash-audit-desc';
const MODAL_STYLE_ID = 'ps-family-clash-audit-modal-style';
const WORKSPACE_TABS = Object.freeze([
  Object.freeze({ key: 'input', label: 'Input' }), Object.freeze({ key: 'preview', label: 'Preview' }),
  Object.freeze({ key: 'config', label: 'Config' }), Object.freeze({ key: 'run', label: 'Run Audit' }),
  Object.freeze({ key: 'reports', label: 'Reports' }), Object.freeze({ key: 'export', label: 'Export Package' }),
]);

function h(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function safeSource(audit) { return String(audit?.summary?.sourceFamily || 'support-evidence').replace(/[^a-z0-9_.-]+/giu, '-'); }
function fileExtension(mime) { return mime === 'application/json' ? 'json' : mime === 'text/plain' ? 'txt' : 'csv'; }

function ensureModalStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `.ps-family-clash-audit-launcher{height:160px;width:220px;border:1px solid rgba(143,197,255,.25);border-radius:18px;background:linear-gradient(145deg,#10213a,#0b1220);color:#e8f2ff;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.28);display:grid!important;grid-template-columns:1fr;place-items:center;text-align:center;padding:16px;margin-top:18px;gap:4px;box-sizing:border-box}.ps-family-clash-audit-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:22px;background:rgba(2,6,23,.78);box-sizing:border-box}.ps-family-clash-audit-dialog{width:min(1240px,calc(100vw - 36px));height:min(860px,calc(100vh - 36px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(125,211,252,.38)!important;border-radius:18px!important;background:#0f172a!important;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.58)}.ps-family-clash-audit-dialog>.psmap-card-body{min-height:0;overflow:auto}.ps-family-clash-audit-backdrop.psfa-fullscreen{padding:0}.ps-family-clash-audit-backdrop.psfa-fullscreen .ps-family-clash-audit-dialog{width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0!important}.psfa-report-draft{opacity:.86;border-color:rgba(245,158,11,.45)!important}.psfa-draft-badge{font-size:10px;margin-left:6px;color:#fbbf24}.psfa-mode-card{display:grid;gap:8px;padding:12px;border:1px solid rgba(125,211,252,.25);border-radius:12px;background:rgba(14,116,144,.08)}.psfa-mode-card select{width:100%}.psfa-legacy-note{border-left:3px solid #f59e0b;padding:8px 10px;background:rgba(245,158,11,.08)}${psFamilyProfessionalCss()}`;
  doc.head?.appendChild(style);
}

function renderInfoList(config) { return `<div class="psfa-rule-card"><ul class="psmap-help-text">${config.info.map((item) => `<li>${h(item)}</li>`).join('')}</ul></div>`; }
function renderSourceOptions(config) { return config.sourceSideOptions.map((item) => `<option value="${h(item.value)}">${h(item.label)}</option>`).join(''); }
function renderEvidenceModeOptions(config) { return config.evidenceModes.map((item) => `<option value="${h(item.value)}" ${item.value === config.defaultEvidenceMode ? 'selected' : ''}>${h(item.label)}</option>`).join(''); }
function renderExportButtons(config) { return config.outputButtons.map((item) => `<button type="button" data-psfa="${h(item.key)}">${h(item.label)}</button>`).join(''); }
function renderExportPreviewButtons(config) { return config.outputButtons.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-psfa-export-preview="${h(item.key)}" aria-selected="${index === 0 ? 'true' : 'false'}">${h(item.label)}</button>`).join(''); }
function reportByKey(config, key) { return config.reportTabs.find((tab) => tab.key === key); }
function reportGroupByKey(config, key) { return (config.reportGroups || []).find((group) => group.key === key); }
function firstReportKey(config, groupKey) { return reportGroupByKey(config, groupKey)?.reportKeys?.[0] || config.reportTabs[0]?.key || ''; }
function defaultReportGroup(config) { return config.reportGroups?.[0]?.key || ''; }

function renderReportButtons(config, group, groupIndex) {
  return group.reportKeys.map((reportKey, reportIndex) => {
    const tab = reportByKey(config, reportKey);
    if (!tab) return '';
    const draft = tab.maturity !== 'stable';
    const active = groupIndex === 0 && reportIndex === 0;
    return `<button type="button" class="psfa-report-subtab ${draft ? 'psfa-report-draft' : 'psfa-report-stable'}${active ? ' active' : ''}" data-psfa-tab="${h(tab.key)}" data-psfa-group="${h(group.key)}" data-psfa-report-maturity="${draft ? 'draft' : 'stable'}" aria-selected="${active ? 'true' : 'false'}"><span>${h(tab.label)}</span>${draft ? '<span class="psfa-draft-badge">Review</span>' : ''}</button>`;
  }).join('');
}

function renderReportCatalog(config) {
  return `<nav class="psfa-report-groups psfa-report-catalog" aria-label="Structured report catalog">${(config.reportGroups || []).map((group, index) => `<section class="psfa-report-group-card${index === 0 ? ' active' : ''}" data-psfa-report-card="${h(group.key)}"><button type="button" class="psfa-report-group${index === 0 ? ' active' : ''}" data-psfa-report-group="${h(group.key)}" aria-selected="${index === 0 ? 'true' : 'false'}"><span>${h(group.label)}</span><small>${h(group.description)}</small></button><div class="psfa-report-subtabs" data-psfa-report-subtabs="${h(group.key)}">${renderReportButtons(config, group, index)}</div></section>`).join('')}</nav>`;
}

function workspaceTabClass(tab, index) { return `psmap-tab psfa-tab${tab.key === 'config' ? ' config' : ''}${index === 0 ? ' active' : ''}`; }
function renderWorkspaceTabs() { return `<div class="psmap-tabs psfa-tabs" aria-label="Primary workspace tabs">${WORKSPACE_TABS.map((tab, index) => `<button type="button" class="${workspaceTabClass(tab, index)}" data-psfa-workspace-tab="${h(tab.key)}" aria-selected="${index === 0 ? 'true' : 'false'}">${h(tab.label)}</button>`).join('')}</div>`; }
function renderSection(title, body, label = title) { return `<section class="psmap-card psfa-panel" aria-label="${h(label)}"><div class="psmap-card-head"><b>${h(title)}</b></div><div class="psmap-card-body">${body}</div></section>`; }
function renderPanel(key, body, activeKey = 'input') { return `<section data-psfa-panel="${h(key)}" ${key === activeKey ? '' : 'hidden'}>${body}</section>`; }
function renderFilePicker(input) { return `<div class="psfa-file-card"><label>${h(input.label)} file<input data-psfa-file="${h(input.key)}" type="file" accept="${h(input.accept)}"></label><div class="psmap-help-text" data-psfa-status="${h(input.key)}">No file selected</div></div>`; }
function renderFilePickers(config) { return `<div class="psfa-file-grid">${config.inputFiles.map(renderFilePicker).join('')}</div>`; }
function renderSampleButtons() { return `<div class="psmap-actions" aria-label="Legacy XML sample loaders">${listPsFamilySampleInputs().map((sample) => `<button type="button" data-psfa-sample="${h(sample.key)}">${h(sample.label)}</button>`).join('')}</div>`; }
function inputPlaceholder(key) { if (key === 'bundle') return 'Paste SupportSteelRelationshipBundle.v1 JSON'; return key === 'structure' ? 'Paste legacy StructureGroup vs Supports XML' : 'Paste legacy Clash within Supports XML'; }
function renderTextAreas(config) { return `<div class="psfa-input-grid">${config.inputFiles.map((input) => `<label class="psfa-input-wide">${h(input.label)}<textarea data-psfa="${h(input.textareaKey)}" rows="${h(config.inputRows)}" placeholder="${h(inputPlaceholder(input.key))}"></textarea></label>`).join('')}</div>`; }
function renderInputPanel(config) {
  const mode = `<div class="psfa-mode-card"><b>Evidence mode</b><select data-psfa="evidence-mode">${renderEvidenceModeOptions(config)}</select><span class="psmap-help-text">Relationship bundle mode requires no clash-detection XML.</span></div>`;
  return renderSection('1 Input', `<div class="psfa-section-intro">Load the XML-free SupportSteelRelationshipBundle.v1 for production audit. Legacy clash XML inputs remain optional validation sources.</div>${mode}<div class="psfa-command-row"><b>Legacy validation samples</b>${renderSampleButtons()}</div>${renderFilePickers(config)}<div class="psfa-section-intro"><b>Raw Inputs</b> — visible text area contents are the audit source of truth.</div>${renderTextAreas(config)}<div class="psfa-legacy-note"><b>Production rule:</b> selecting Relationship bundle does not parse or require either XML field.</div>`);
}
function renderPreviewPanel(config) { const panel = (input) => `<div class="psmap-card"><div class="psmap-card-head"><b>${h(input.label)} preview/count</b></div><div class="psmap-card-body" data-psfa-preview="${h(input.textareaKey)}"></div></div>`; return renderSection('2 Preview / Preflight', `<div class="psfa-section-intro">Compact source previews and row counts only; audit reports remain in the Reports tab.</div><div class="psfa-preview-grid">${config.inputFiles.map(panel).join('')}</div>`); }
function renderPrefixConfig(config) { return `<div class="psfa-prefix-card"><label>Valid family prefixes<input data-psfa="family-prefixes" value="${h(config.familyPrefixesText)}" placeholder="PS, SL"></label><div class="psmap-help-text">Used for family-root parsing and legacy XML validation.</div><div>Generated detector: <span class="psfa-detector" data-psfa-prefix-detector>/(?:PS|SL)-\d+/i</span></div></div>`; }
function renderZoneConfig(config) { return `<div class="psfa-zone-grid"><label>Structural zones<textarea data-psfa="structural-zones" rows="3" placeholder="CU-SU, STRUCTURE">${h(config.structuralZonesText)}</textarea><span class="psmap-help-text">Legacy XML classification only.</span></label><label>Support zones<textarea data-psfa="support-zones" rows="3" placeholder="PS-, SL-">${h(config.supportZonesText)}</textarea><span class="psmap-help-text">Legacy XML classification only.</span></label></div>`; }
function renderConfigPanel(config) { const controls = `<div class="psfa-config-grid"><label>Evidence mode<select data-psfa="evidence-mode">${renderEvidenceModeOptions(config)}</select></label><label>Legacy XML source side<select data-psfa="source-side">${renderSourceOptions(config)}</select></label><label>Source family override<input data-psfa="source-family" placeholder="${h(config.sourceFamilyPlaceholder)}"></label><label>POS tolerance mm<input data-psfa="tolerance" type="number" value="${h(config.posToleranceMm)}" min="${h(config.toleranceMinMm)}" step="${h(config.toleranceStepMm)}"></label></div>`; return renderSection('3 Config', `<div class="psfa-section-intro">Choose the evidence source, optional family filter, matching prefixes and legacy validation settings.</div>${controls}${renderPrefixConfig(config)}${renderZoneConfig(config)}${renderInfoList(config)}`); }
function renderRunPanel() { return renderSection('4 Run Audit', `<div class="psfa-run-grid"><div class="psfa-primary-actions"><h4>Audit Controls</h4><button type="button" data-psfa="check-readiness">Check Readiness</button><button type="button" data-psfa="run">Run Audit</button></div><div class="psfa-run-log"><h4>Readiness / Run Summary</h4><div class="psmap-help-text">Readiness follows the selected evidence mode. Relationship-bundle mode never requires XML.</div><div data-psfa="readiness" aria-live="polite"></div></div></div>`); }
function renderExportPanel(config) { return renderSection('6 Export Package', `<div class="psfa-export-package"><h4>Stable Deliverable Package</h4><div class="psfa-section-intro">Each report can be exported directly as CSV. The package includes native evidence identifiers and does not invent clash rows.</div><div class="psfa-export-picker">${renderExportPreviewButtons(config)}</div><div class="psfa-export-preview"><div class="psfa-export-preview-head"><b data-psfa-export-title>Support Group Summary CSV Preview</b><span class="psmap-help-text" data-psfa-export-meta>Run Audit first</span></div><pre data-psfa="export-preview">Run Audit to preview this export.</pre><div class="psmap-actions"><button type="button" data-psfa="copy-export-preview">Copy Preview</button><button type="button" data-psfa="download-selected">Download Selected</button><button type="button" data-psfa="download-all-zip">Download All ZIP</button></div><details><summary>Individual stable download buttons</summary><div class="psfa-export-grid">${renderExportButtons(config)}</div></details></div></div>`); }
function renderReportsPanel(config) {
  const firstGroup = config.reportGroups?.[0];
  const header = `<div class="psfa-report-head"><div class="psfa-report-heading"><span>Report and export workspace</span><h4 data-psfa-report-group-title>${h(firstGroup?.label || 'Reports')}</h4><p data-psfa-report-group-description>${h(firstGroup?.description || '')}</p></div><label class="psfa-report-search">Search selected report<input data-psfa="report-search" placeholder="Filter current report, e.g. PS-14396 or SL-4201"></label><div class="psfa-report-actions"><button type="button" class="psfa-report-export" data-psfa="export-report-csv">Export current report CSV</button><span class="psmap-help-text" data-psfa="report-export-status">Run Audit first</span></div></div>`;
  const layout = `<div class="psfa-report-layout">${renderReportCatalog(config)}<div class="psfa-report-main"><div data-psfa="summary"></div><div class="psfa-report-table psmap-table-wrap" data-psfa="reports"></div></div></div>`;
  return renderSection('5 Reports', `${header}${layout}`);
}
function statusCard(label, value, detail = '') { return `<div class="psfa-status-card"><b>${h(label)}</b><span>${h(value)}</span>${detail ? `<small>${h(detail)}</small>` : ''}</div>`; }
function renderStatusStrip() { return `<div class="psfa-status-strip" data-psfa="status-strip">${statusCard('Evidence mode','Relationship bundle')}${statusCard('Support Groups','0')}${statusCard('Terminals / Chain','0 / 0')}${statusCard('Errors / Warnings','0 / 0')}</div>`; }
function renderInputShell(config) { return `<div class="psmap-card-body psfa-shell"><div id="${POPUP_DESC_ID}" class="psfa-section-intro">XML-free PS / SL family audit workspace with an optional legacy clash-XML validation mode.</div>${renderStatusStrip()}${renderWorkspaceTabs()}${renderPanel('input', renderInputPanel(config))}${renderPanel('preview', renderPreviewPanel(config))}${renderPanel('config', renderConfigPanel(config))}${renderPanel('run', renderRunPanel())}${renderPanel('reports', renderReportsPanel(config))}${renderPanel('export', renderExportPanel(config))}</div>`; }

function renderLauncher(config) { const launcher = config.launcher; return `<button type="button" class="psmap-card psmap-tile ps-family-clash-audit-launcher" data-psfa-open="1" title="${h(launcher.help)}"><span class="psmap-tile-icon ps-family-clash-audit-launcher-icon" aria-hidden="true">${h(launcher.icon)}</span><b>${h(launcher.label)}</b><span class="psmap-help-text">${h(launcher.help)}</span></button>`; }
function renderPopup(config) { return `<div class="psmap-card-head"><div class="psfa-title-block"><div class="psfa-title-row"><b id="${POPUP_TITLE_ID}">${h(config.appTitle)}</b><span class="psfa-title-badge">Evidence Graph Workspace</span></div><div class="psfa-subtitle">Relationship bundle production mode + optional legacy XML validation.</div></div><div class="psfa-title-actions"><button type="button" class="psfa-fullscreen" data-psfa-fullscreen="1" aria-pressed="false">Full screen</button><button type="button" class="psfa-close" data-psfa-close="1" aria-label="Close PS Family Evidence Audit popup">Close</button></div></div>${renderInputShell(config)}`; }

function readTextInputs(get) { return { relationshipBundleText: get('bundle')?.value || '', structureXmlText: get('structure')?.value || '', supportXmlText: get('support')?.value || '', clashXmlText: get('xml')?.value || '', psClashXmlText: get('psclash')?.value || '', expectedCsvText: get('expected')?.value || '', detailCsvText: get('details')?.value || '' }; }
function readAuditInput(get, config) { const settings = readPsFamilyUiSettings(get, config); return { ...readTextInputs(get), evidenceMode: settings.evidenceMode, config: settings }; }
function countText(value) { const text = String(value || ''); return `${text ? text.split(/\r?\n/).length : 0} lines / ${text.length} chars`; }
function previewHtml(label, text) { return `<div class="psmap-help-text">${h(label)}: ${h(countText(text))}</div><pre>${h(String(text || '').slice(0, 600))}</pre>`; }
function renderPreviews(get, state, config) { config.inputFiles.forEach((input) => { const node = get(`preview:${input.textareaKey}`); if (node) node.innerHTML = previewHtml(input.label, get(input.textareaKey)?.value || ''); }); if (state.audit) renderReportReview(get, state, config); }

function updateReportNavigation(root, state, config) {
  root.querySelectorAll('[data-psfa-report-group]').forEach((button) => { const active = button.dataset.psfaReportGroup === state.activeReportGroup; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  root.querySelectorAll('[data-psfa-report-card]').forEach((card) => card.classList.toggle('active', card.dataset.psfaReportCard === state.activeReportGroup));
  root.querySelectorAll('[data-psfa-tab]').forEach((button) => { const active = button.dataset.psfaGroup === state.activeReportGroup && button.dataset.psfaTab === state.activeReportTab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  const group = reportGroupByKey(config, state.activeReportGroup);
  const title = root.querySelector('[data-psfa-report-group-title]');
  const description = root.querySelector('[data-psfa-report-group-description]');
  if (title) title.textContent = group?.label || 'Reports';
  if (description) description.textContent = group?.description || '';
}
function renderReportReview(get, state, config) { updateReportNavigation(get('root'), state, config); get('summary').innerHTML = renderPsFamilySummary(state.audit); get('reports').innerHTML = renderPsFamilyReports(state.audit, state.activeReportTab, config, state.reportSearch, state.activeReportGroup); }
function updateExportPickerSelection(root, selected) { root.querySelectorAll('[data-psfa-export-preview]').forEach((button) => { const active = button.dataset.psfaExportPreview === selected; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); }
function renderExportPreview(get, state, config) { const selected = state.exportPreviewKey || config.outputButtons[0].key; const button = config.outputButtons.find((item) => item.key === selected) || config.outputButtons[0]; const exports = state.audit ? createPsFamilyAuditExports(state.audit) : {}; const text = exports[button.exportKey] || 'Run Audit to preview this export.'; get('export-preview').textContent = text.slice(0, 2000); get('export-title').textContent = `${button.label} Preview`; get('export-meta').textContent = state.audit ? `${text.length} chars` : 'Run Audit first'; updateExportPickerSelection(get('root'), button.key); }
function showWorkspacePanel(root, tabKey) { root.querySelectorAll('[data-psfa-panel]').forEach((panel) => { panel.hidden = panel.dataset.psfaPanel !== tabKey; }); root.querySelectorAll('[data-psfa-workspace-tab]').forEach((button) => { const active = button.dataset.psfaWorkspaceTab === tabKey; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); }
function exportFilename(button, audit) { return `ps-family-${button.suffix}-${safeSource(audit)}.${fileExtension(button.mime)}`; }
function buildExportEntries(audit, config) { const exports = createPsFamilyAuditExports(audit); return config.outputButtons.map((button) => ({ name: exportFilename(button, audit), text: exports[button.exportKey] || '' })); }
function activeReportFilename(active, audit) { return `ps-family-${active.suffix}-${safeSource(audit)}.csv`; }
function exportActiveReportCsv(get, state) { if (!state.audit) { if (get('report-export-status')) get('report-export-status').textContent = 'Run Audit first'; return; } const active = createPsFamilyActiveReportExport(state.audit, state.activeReportTab); if (!active) return; saveTextFile(activeReportFilename(active, state.audit), active.text, 'text/csv'); if (get('report-export-status')) get('report-export-status').textContent = `${active.text.length} characters exported`; }

function wireInputFiles(get, state, config) { config.inputFiles.forEach((input) => { const picker = get(`file:${input.key}`); const status = get(`status:${input.key}`); picker?.addEventListener('change', async () => { const file = picker.files?.[0]; if (file) await loadTextFileIntoTextarea(file, get(input.textareaKey), status); renderPreviews(get, state, config); }); get(input.textareaKey)?.addEventListener('input', () => renderPreviews(get, state, config)); }); }
function wireSamples(get, state, config) { listPsFamilySampleInputs().forEach((sample) => { get(`sample:${sample.key}`)?.addEventListener(ACTIVATE, () => { loadSampleTextIntoTextarea(sample, get(sample.textareaKey), get(`status:${sample.key}`)); renderPreviews(get, state, config); }); }); }
function wireReportTabs(get, state, config) { get('root').querySelectorAll('[data-psfa-report-group]').forEach((button) => button.addEventListener(ACTIVATE, () => { state.activeReportGroup = button.dataset.psfaReportGroup; state.activeReportTab = firstReportKey(config, state.activeReportGroup); renderReportReview(get, state, config); })); get('root').querySelectorAll('[data-psfa-tab]').forEach((button) => button.addEventListener(ACTIVATE, () => { state.activeReportGroup = button.dataset.psfaGroup || state.activeReportGroup; state.activeReportTab = button.dataset.psfaTab; renderReportReview(get, state, config); })); }
function wireReportSearch(get, state, config) { get('report-search')?.addEventListener('input', () => { state.reportSearch = get('report-search').value; renderReportReview(get, state, config); }); }
function wirePrefixInput(get, config) { get('family-prefixes')?.addEventListener('input', () => { get('prefix-detector').textContent = readPsFamilyUiSettings(get, config).familyDetectorLabel; }); }
function wireWorkspaceTabs(get) { get('root').querySelectorAll('[data-psfa-workspace-tab]').forEach((button) => button.addEventListener(ACTIVATE, () => showWorkspacePanel(get('root'), button.dataset.psfaWorkspaceTab))); }
function syncEvidenceMode(root, value) { root.querySelectorAll('[data-psfa="evidence-mode"]').forEach((field) => { if (field.value !== value) field.value = value; }); }
function wireEvidenceModes(get) { get('root').querySelectorAll('[data-psfa="evidence-mode"]').forEach((field) => field.addEventListener('change', () => syncEvidenceMode(get('root'), field.value))); }
function renderRunError(get, error) { get('readiness').innerHTML = `<div class="psmap-card"><div class="psmap-card-head"><b>Audit blocked</b></div><div class="psmap-card-body"><div class="psmap-help-text">${h(error.message || error)}</div></div></div>`; }
function wireRunButtons(get, state, config) {
  get('check-readiness')?.addEventListener(ACTIVATE, () => { try { const readiness = createPsFamilyInputReadinessFromTextInputs(readAuditInput(get, config)); get('readiness').innerHTML = renderPsFamilyReadiness(readiness); } catch (error) { renderRunError(get, error); } });
  get('run')?.addEventListener(ACTIVATE, () => { try { const input = readAuditInput(get, config); state.audit = createPsFamilyAuditFromTextInputs(input); state.activeReportGroup = defaultReportGroup(config); state.activeReportTab = firstReportKey(config, state.activeReportGroup); get('readiness').innerHTML = renderPsFamilyReadiness(createPsFamilyInputReadinessFromTextInputs(input)); renderReportReview(get, state, config); renderExportPreview(get, state, config); if (get('report-export-status')) get('report-export-status').textContent = 'Ready to export current report'; showWorkspacePanel(get('root'), 'reports'); } catch (error) { renderRunError(get, error); } });
  get('export-report-csv')?.addEventListener(ACTIVATE, () => exportActiveReportCsv(get, state));
}
function wireExportButtons(get, state, config) { config.outputButtons.forEach((button) => get(button.key)?.addEventListener(ACTIVATE, () => { if (!state.audit) return; const exports = createPsFamilyAuditExports(state.audit); saveTextFile(exportFilename(button, state.audit), exports[button.exportKey], button.mime); })); }
function wireExportPreviewButtons(get, state, config) { get('root').querySelectorAll('[data-psfa-export-preview]').forEach((button) => button.addEventListener(ACTIVATE, () => { state.exportPreviewKey = button.dataset.psfaExportPreview; renderExportPreview(get, state, config); })); get('copy-export-preview')?.addEventListener(ACTIVATE, () => globalThis.navigator?.clipboard?.writeText(get('export-preview').textContent || '')); get('download-selected')?.addEventListener(ACTIVATE, () => { const selected = state.exportPreviewKey || config.outputButtons[0].key; get(selected)?.dispatchEvent(new Event(ACTIVATE)); }); get('download-all-zip')?.addEventListener(ACTIVATE, () => { if (!state.audit) return; saveZipTextFiles(`ps-family-export-package-${safeSource(state.audit)}.zip`, buildExportEntries(state.audit, config)); }); }
function setFullscreen(modal, button, active) { modal.classList.toggle('psfa-fullscreen', active); button?.setAttribute('aria-pressed', String(active)); if (button) button.textContent = active ? 'Exit full screen' : 'Full screen'; }

function byAttr(root, attr, value) { return root.querySelector(`[${attr}="${String(value).replace(/"/g, '\\"')}"]`); }
function createGetter(root) { return (name) => { if (name === 'root') return root; if (name === 'close') return root.querySelector('[data-psfa-close]'); if (name === 'fullscreen') return root.querySelector('[data-psfa-fullscreen]'); if (name === 'prefix-detector') return root.querySelector('[data-psfa-prefix-detector]'); if (name === 'export-title') return root.querySelector('[data-psfa-export-title]'); if (name === 'export-meta') return root.querySelector('[data-psfa-export-meta]'); if (name.startsWith('file:')) return byAttr(root, 'data-psfa-file', name.slice(5)); if (name.startsWith('status:')) return byAttr(root, 'data-psfa-status', name.slice(7)); if (name.startsWith('sample:')) return byAttr(root, 'data-psfa-sample', name.slice(7)); if (name.startsWith('preview:')) return byAttr(root, 'data-psfa-preview', name.slice(8)); return byAttr(root, 'data-psfa', name); }; }

function openPopup(config) {
  const doc = globalThis.document; if (!doc) return;
  if (doc.querySelector('[data-psfa-popup="1"]')) return;
  ensureModalStyle(doc);
  const modal = doc.createElement('div');
  modal.className = 'ps-family-clash-audit-backdrop'; modal.dataset.psfaPopup = '1';
  modal.innerHTML = `<div class="psmap-card ps-family-clash-audit-dialog" role="dialog" aria-modal="true" aria-labelledby="${POPUP_TITLE_ID}" aria-describedby="${POPUP_DESC_ID}">${renderPopup(config)}</div>`;
  (doc.body || doc.documentElement).appendChild(modal);
  const get = createGetter(modal);
  const initialGroup = defaultReportGroup(config);
  const state = { audit: null, activeReportGroup: initialGroup, activeReportTab: firstReportKey(config, initialGroup), reportSearch: '', exportPreviewKey: config.outputButtons[0].key };
  const onKey = (event) => { if (event.key !== 'Escape') return; if (modal.classList.contains('psfa-fullscreen')) { setFullscreen(modal, get('fullscreen'), false); return; } close(); };
  const close = () => { doc.removeEventListener('keydown', onKey); modal.remove(); };
  get('close')?.addEventListener(ACTIVATE, close);
  get('fullscreen')?.addEventListener(ACTIVATE, () => setFullscreen(modal, get('fullscreen'), !modal.classList.contains('psfa-fullscreen')));
  modal.addEventListener(ACTIVATE, (event) => { if (event.target === modal && !modal.classList.contains('psfa-fullscreen')) close(); });
  doc.addEventListener('keydown', onKey);
  wireWorkspaceTabs(get); wireInputFiles(get, state, config); wireSamples(get, state, config); wirePrefixInput(get, config); wireEvidenceModes(get); wireRunButtons(get, state, config); wireReportTabs(get, state, config); wireReportSearch(get, state, config); wireExportButtons(get, state, config); wireExportPreviewButtons(get, state, config); updateReportNavigation(get('root'), state, config); renderPreviews(get, state, config); renderExportPreview(get, state, config);
}

export function installPsFamilyClashAuditTile(root, overrides = {}) {
  const config = resolvePsFamilyClashAuditConfig(overrides);
  if (!root || root.querySelector('[data-psfa-open="1"]')) return;
  ensureModalStyle(root.ownerDocument || globalThis.document);
  root.insertAdjacentHTML('beforeend', renderLauncher(config));
  root.querySelector('[data-psfa-open="1"]')?.addEventListener(ACTIVATE, () => openPopup(config));
}

export const _test = Object.freeze({ renderLauncher, renderPopup, renderInputShell, showWorkspacePanel, createGetter, updateReportNavigation, firstReportKey, setFullscreen, activeReportFilename, readAuditInput });
