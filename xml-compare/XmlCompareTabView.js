import { renderXmlCompareSideloadPopupHtml } from './XmlCompareSideloadPopup.js';
import { renderXmlCompareEnrichmentConfigPopupHtml } from './XmlCompareEnrichmentConfig.js';
import { renderXmlCompareLoadDiagnosticsPanelHtml } from './XmlCompareLoadDiagnosticsPanel.js';
import { renderLinewiseWorkflowPopupHtml, renderLinewiseWorkflowToolbarButtonHtml } from './XmlCompareLinewiseWorkflowView.js';
import { renderUniversalXmlCategorizerButtonHtml } from './universal-categorizer/universal-xml-categorizer-shell.js';
import { renderXmlCompareWorkspaceShellHtml } from './XmlCompareWorkspaceShell.js?v=20260704-transfer-review-1';
import { detectXmlCompareProfile } from './XmlCompareProfileDetector.js';

const clean = (value) => String(value ?? '').trim();
const number = (value, fallback = 0) => { const next = Number(value); return Number.isFinite(next) ? next : fallback; };
export function esc(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
export function bytes(value) { const size = Number(value || 0); if (!Number.isFinite(size) || size <= 0) return '0 B'; if (size < 1024) return `${size} B`; if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`; return `${(size / 1048576).toFixed(2)} MB`; }
function loadedFileCard(label, file, text, sideModel) { const loaded = Boolean(file || text), name = clean(file?.name || sideModel?.fileName || 'No file loaded'), profile = clean(sideModel?.profile || 'unknown'); return `<article class="xml-compare-load-card ${loaded ? 'is-loaded' : 'is-empty'}"><b>${label === 'a' ? 'Source A' : 'Target B'} ${loaded ? 'loaded' : 'not loaded'}</b><span>${esc(name)}</span><small>${loaded ? `${esc(bytes(file?.size || text.length))} - ${text.length.toLocaleString()} chars - profile ${esc(profile)}` : 'Choose a file to begin.'}</small></article>`; }
function loadedFileStrip(state, workspace) { return `<div class="xml-compare-load-strip">${loadedFileCard('a', state.fileA, state.textA, workspace.source)}${loadedFileCard('b', state.fileB, state.textB, workspace.target)}</div>`; }
function issueRow(issue, state) { const selected = state.selectedIssueId === issue.componentId, hidden = state.hiddenComponentIds.has(issue.componentId); return `<tr data-xml-compare-topology-row data-component-id="${esc(issue.componentId)}" class="${selected ? 'is-selected' : ''} ${hidden ? 'is-hidden' : ''}"><td>${esc(issue.severity || '')}</td><td>${esc(issue.code || '')}</td><td>${esc(issue.datasetId || '')}</td><td>${esc(issue.component?.label || issue.componentId || '')}</td><td>${issue.distanceMm != null ? esc(number(issue.distanceMm).toFixed(1)) : '-'}</td></tr>`; }
function filters(state) { return `<div class="xml-compare-topology-filters"><select data-xml-compare-topology-filter="severity"><option value="ALL" ${state.filters.severity === 'ALL' ? 'selected' : ''}>All severities</option><option value="ERROR" ${state.filters.severity === 'ERROR' ? 'selected' : ''}>Errors</option><option value="WARNING" ${state.filters.severity === 'WARNING' ? 'selected' : ''}>Warnings</option></select><input data-xml-compare-topology-filter="search" value="${esc(state.filters.search)}" placeholder="Search issues"></div>`; }
function summary(report) { if (!report) return '<div class="xml-compare-empty">Load XML files to build a comparison report.</div>'; const s = report.topologyIssues.summary; return `<div class="xml-compare-summary-grid"><div><b>Dataset A</b><span>${esc(report.datasets.A.fileName || 'XML A')}</span></div><div><b>Dataset B</b><span>${esc(report.datasets.B.fileName || 'XML B')}</span></div><div><b>Issues</b><span>${s.issueCount}</span></div><div><b>Errors</b><span>${s.severityCounts.ERROR || 0}</span></div><div><b>Warnings</b><span>${s.severityCounts.WARNING || 0}</span></div></div>`; }
function issueDetails(report, state) { const issue = (report?.topologyIssues?.issues || []).find((item) => item.componentId === state.selectedIssueId); if (!issue) return '<div class="xml-compare-empty">Select an issue to inspect it here.</div>'; return `<div class="xml-compare-detail-card"><div><b>Code</b><span>${esc(issue.code)}</span></div><div><b>Severity</b><span>${esc(issue.severity)}</span></div><div><b>Dataset</b><span>${esc(issue.datasetId)}</span></div><div><b>Component</b><span>${esc(issue.component?.label || issue.componentId)}</span></div><div><b>Message</b><span>${esc(issue.message || '')}</span></div></div>`; }
function topologyPanel(issues, state) { const rows = issues.map((issue) => issueRow(issue, state)).join('') || '<tr><td colspan="5">No topology issues.</td></tr>'; return `<section class="xml-compare-panel"><div class="xml-compare-panel-title">Topology check</div>${filters(state)}<div class="xml-compare-topology-actions"><button type="button" data-xml-compare-topology-action="show-all">Show all</button><button type="button" data-xml-compare-topology-action="hide-filtered">Hide filtered</button><button type="button" data-xml-compare-action="export-filtered-csv" ${state.report ? '' : 'disabled'}>Export filtered CSV</button></div><div class="xml-compare-table-scroll"><table class="xml-compare-topology-table"><thead><tr><th>Severity</th><th>Code</th><th>Dataset</th><th>Component</th><th>Delta mm</th></tr></thead><tbody>${rows}</tbody></table></div></section>`; }
function importSection(state) {
  const schemaBadge = (label, xml, fileName) => {
    if (!xml) return `<span class="wb3d-badge">Detected: none</span>`;
    const detected = detectXmlCompareProfile({ name: fileName || '', text: xml });
    if (detected.type === 'unknown') {
      const psi = /<PipeStressExport\b/i.test(xml.slice(0, 4000));
      return psi ? `<span class="wb3d-badge is-ok">${label}: psi-pipestress</span>` : `<span class="wb3d-badge">Detected: unknown</span>`;
    }
    return `<span class="wb3d-badge is-ok">${label}: ${esc(detected.type)}</span>`;
  };
  const sourceName = state.fileA?.name || '';
  const targetName = state.fileB?.name || '';
  return `
  <section class="wb3d-card" style="margin-bottom: 20px;">
    <h3>Import <span class="wb3d-muted">source (property donor) and target (receiver)</span></h3>
    <div class="wb3d-import-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div>
          <label class="wb3d-file" style="cursor: pointer; border: 1px dashed #334155; padding: 6px 12px; display: inline-block; border-radius: 4px;">Source XML/InputXML <input type="file" data-xml-compare-load="a" accept=".xml,.XML,.json,.JSON"></label>
          ${schemaBadge('Detected', state.textA, sourceName)} ${sourceName ? `<span class="wb3d-muted">${esc(sourceName)}</span>` : ''}
        </div>
        <textarea data-xml-compare-field="textA" spellcheck="false" placeholder="…or paste source XML here" style="width: 100%; height: 120px; background: #020617; color: #cbd5e1; border: 1px solid #334155; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; resize: vertical;">${esc(state.textA.length > 400000 ? '' : state.textA)}</textarea>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div>
          <label class="wb3d-file" style="cursor: pointer; border: 1px dashed #334155; padding: 6px 12px; display: inline-block; border-radius: 4px;">Target XML/InputXML <input type="file" data-xml-compare-load="b" accept=".xml,.XML,.json,.JSON"></label>
          ${schemaBadge('Detected', state.textB, targetName)} ${targetName ? `<span class="wb3d-muted">${esc(targetName)}</span>` : ''}
        </div>
        <textarea data-xml-compare-field="textB" spellcheck="false" placeholder="…or paste target XML here" style="width: 100%; height: 120px; background: #020617; color: #cbd5e1; border: 1px solid #334155; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; resize: vertical;">${esc(state.textB.length > 400000 ? '' : state.textB)}</textarea>
      </div>
    </div>
    <div class="wb3d-toolbar" style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center; margin-top: 15px;">
      <label>Short/consume tol mm <input type="number" data-xml-compare-config="shortElementToleranceMm" value="${state.config?.shortElementToleranceMm ?? 6}" step="1" style="width: 60px; background: #07101f; color: #fff; border: 1px solid #334155; padding: 4px; border-radius: 4px;"></label>
      <label>Length tol mm <input type="number" data-xml-compare-config="lengthToleranceMm" value="${state.config?.lengthToleranceMm ?? 6}" step="1" style="width: 60px; background: #07101f; color: #fff; border: 1px solid #334155; padding: 4px; border-radius: 4px;"></label>
      <label>Min score <input type="number" data-xml-compare-config="minCandidateScore" value="${state.config?.minCandidateScore ?? 40}" step="1" style="width: 60px; background: #07101f; color: #fff; border: 1px solid #334155; padding: 4px; border-radius: 4px;"></label>
      <label>Ambiguity gap <input type="number" data-xml-compare-config="ambiguityGap" value="${state.config?.ambiguityGap ?? 8}" step="1" style="width: 60px; background: #07101f; color: #fff; border: 1px solid #334155; padding: 4px; border-radius: 4px;"></label>
      <label class="wb3d-check" style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" data-xml-compare-config="canonicalNormalization" ${(state.config?.canonicalNormalization ?? true) ? 'checked' : ''}> canonical normalization (raw when off)</label>
      <button class="wb3d-btn wb3d-btn-primary" data-xml-compare-action="compare" style="margin-left: auto; padding: 6px 16px; font-weight: 600; background: #3b82f6; border: 0; color: white; border-radius: 4px; cursor: pointer;">Run Compare</button>
    </div>
    <div class="xml-compare-toolbar" style="margin-top: 15px; border-top: 1px solid #26354a; padding-top: 15px; display: flex; flex-wrap: wrap; gap: 8px;">
      <button type="button" data-xml-compare-action="open-sideload-a">Sideload Source A</button>
      <button type="button" data-xml-compare-action="open-sideload-b">Sideload Target B</button>
      <button type="button" data-xml-compare-action="open-enrichment">Enrichment Config</button>
      ${renderLinewiseWorkflowToolbarButtonHtml()}
      ${renderUniversalXmlCategorizerButtonHtml()}
      <button type="button" data-xml-compare-action="download-input-readiness-json">Download Input Readiness JSON</button>
      <button type="button" data-xml-compare-action="download-readiness-gate-json">Download Readiness Gate JSON</button>
      <button type="button" data-xml-compare-action="export-filtered-csv" ${state.report ? '' : 'disabled'}>Export CSV</button>
    </div>
  </section>`;
}

function dashboardSection(state) {
  if (!state.report) return '<section class="wb3d-card" style="margin-bottom: 20px;"><h3>Variance dashboard</h3><p class="wb3d-muted" style="color: #64748b; font-size: 11px;">Run a compare to populate the dashboard.</p></section>';
  const s = state.report.topologyIssues.summary;
  const plain = (label, value) => `<div class="wb3d-tile" style="background: #0d1e36; padding: 10px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; border: 1px solid #1e293b;"><strong>${value ?? 0}</strong><span style="font-size: 10px; color: #94a3b8; margin-top: 4px;">${label}</span></div>`;
  const clickable = (label, value, status) => `
    <button class="wb3d-tile ${status ? `wb3d-tile-${status}` : ''} ${state.filters.severity === status ? 'is-active' : ''}" data-xml-compare-severity-filter="${status || 'ALL'}" style="background: #0d1e36; padding: 10px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; border: 1px solid #1e293b; color: inherit; cursor: pointer;">
      <strong>${value ?? 0}</strong><span style="font-size: 10px; color: #94a3b8; margin-top: 4px;">${label}</span>
    </button>`;
  return `
  <section class="wb3d-card" style="margin-bottom: 20px;">
    <h3>Variance dashboard <span class="wb3d-muted">tiles filter the topology table below</span></h3>
    <div class="wb3d-tiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 10px;">
      ${plain('Dataset A components', state.report.datasets.A.componentCount)}
      ${plain('Dataset B components', state.report.datasets.B.componentCount)}
      ${clickable('Total Issues', s.issueCount, 'ALL')}
      ${clickable('Errors', s.severityCounts.ERROR || 0, 'ERROR')}
      ${clickable('Warnings', s.severityCounts.WARNING || 0, 'WARNING')}
    </div>
  </section>`;
}

function toolbar(state) { return importSection(state); }
export function renderXmlCompareTabView({ state, workspace, issues }) { return `<div class="xml-compare-tab"><header class="xml-compare-header"><h2>Source-target XML comparison workspace</h2><p>Load XML or enriched staged JSON, inspect source and target records, approve connector links explicitly, then validate approved matches.</p></header>${importSection(state)}<div class="xml-compare-status ${esc(state.status.kind)}">${esc(state.status.message)}</div>${renderXmlCompareLoadDiagnosticsPanelHtml(state.loadDiagnostics)}${renderXmlCompareWorkspaceShellHtml(workspace)}<main class="xml-compare-layout">${dashboardSection(state)}${topologyPanel(issues, state)}<section class="xml-compare-panel"><div class="xml-compare-panel-title">Details</div>${issueDetails(state.report, state)}</section></main>${renderXmlCompareSideloadPopupHtml(state.sideload)}${renderXmlCompareEnrichmentConfigPopupHtml(state.enrichmentConfig, { workspace, state })}${renderLinewiseWorkflowPopupHtml({ ...state.linewiseWorkflow, producerAdoption: state.linewiseProducerAdoption })}</div>`; }
export const _test = Object.freeze({ clean, number, loadedFileCard, issueRow, filters, summary, issueDetails, topologyPanel, importSection, dashboardSection, toolbar });
