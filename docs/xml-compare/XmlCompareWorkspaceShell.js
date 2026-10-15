import { renderXmlCompareGraphConnectorLaneHtml } from './XmlCompareGraphConnectorLane.js?v=20260704-transfer-review-1';
import { createXmlCompareTransferPreview } from './XmlCompareTransferPreview.js';
import { renderXmlCompareManualValidationBuilderHtml } from './XmlCompareManualValidationBuilderPanel.js';
import { availableCompareFields, normalizeCompareFields } from './XmlCompareFieldCompareModel.js';
import { normalizeToleranceMm, normalizeValidationLayer } from './XmlCompareValidationModel.js';
import { renderXmlCompareTransferModalPopupHtml } from './XmlCompareTransferModalPopup.js?v=20260704-transfer-review-1';

export const XML_COMPARE_WORKSPACE_SHELL_SCHEMA = 'xml-compare-workspace-shell/v31-transfer-review';
let loadSamplePickersPromise = null, loadTableCategorizedPromise = null;
function loadSamplePickers() { if (typeof document !== 'undefined' && !loadSamplePickersPromise) loadSamplePickersPromise = import('../tabs/xml-compare-enriched-sample-pickers.js?v=20260701-bm-cii-categorized-samples-1').catch(() => null); }
function loadTableCategorizedXml() { if (typeof document !== 'undefined' && !loadTableCategorizedPromise) loadTableCategorizedPromise = import('../tabs/xml-compare-table-categorized-runtime.js?v=20260703-extra-tools-1').catch(() => null); }
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
function loadLazyRuntimes() { loadSamplePickers(); loadTableCategorizedXml(); }
function createManualState(input = {}) { return Object.freeze({ connectors: Object.freeze(Array.isArray(input.manualConnectors) ? input.manualConnectors : []), pendingSourceUid: input.pendingConnectorPreview ? input.pendingConnectorPreview.sourceUid : String(input.navStates?.source?.selectedUid || ''), pendingConnectorPreview: input.pendingConnectorPreview || null, approvedMatchSet: input.approvedMatchSet || null, approvedValidationModel: input.approvedValidationModel || null, candidateDecisions: input.candidateDecisions || null }); }
function transferState(input = {}) { return Object.freeze({ transferPreviewPlans: input.transferPreviewPlans || {}, transferStage: input.transferStage || null, transferAudit: input.transferAudit || null, postTransferValidation: input.postTransferValidation || null, transferLastResult: input.transferLastResult || null }); }
function sideHeader(data = {}) { return [data.fileName, data.profile, data.levelView?.label].map(esc).filter(Boolean).join(' | ') || 'not loaded'; }
function sideMetric(label, value) { return `<div><b>${esc(label)}</b><span>${esc(value)}</span></div>`; }
function recordLabel(record = null) { return record ? (record.displayName || record.nodeNumber || record.nodeName || record.elementKey || record.uid) : 'none'; }
function option(value, label, selected) { return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`; }
function levelOptions(levelView = {}) { return (levelView.hierarchyProfile?.levels || []).map((level) => option(level.levelId, `${level.label} (${level.recordCount})`, levelView.levelId)).join(''); }
function fieldOptions(levelView = {}) { return (levelView.fields || []).map((field) => option(field, field, levelView.displayField)).join(''); }
function hierarchyControls(side = 'source', levelView = {}) {
  if (!(levelView.hierarchyProfile?.levels || []).length) return '<div class="xmlc-side-controls is-empty">No hierarchy levels detected</div>';
  return `<div class="xmlc-side-controls"><label>Hierarchy<select data-xml-compare-level-select="levelId" data-xml-compare-side="${esc(side)}">${levelOptions(levelView)}</select></label></div>`;
}
function labelFieldControls(side = 'source', levelView = {}, compareFields = []) {
  if (!(levelView.fields || []).length) return '';
  const selectedCompare = new Set(normalizeCompareFields(compareFields));
  const checkboxList = levelView.fields.map(field => `
    <label style="display:flex; align-items:center; gap:8px; margin-bottom: 2px; cursor: pointer;">
      <input type="checkbox" value="${esc(field)}" data-xml-compare-toggle-compare-field data-xml-compare-side="${esc(side)}" ${selectedCompare.has(field) ? 'checked' : ''}>
      ${esc(field)}
    </label>
  `).join('');
  return `<div class="xmlc-side-label-field" style="display:flex; flex-direction:column; gap:8px;">
    <div style="display:flex; flex-direction:column; gap:4px; max-height: 200px; overflow-y: auto; border: 1px solid var(--xmlc-border-color, #444); padding: 8px; border-radius: 4px;">
      <b>Compare Fields</b>
      ${checkboxList}
    </div>
  </div>`;
}
function compareFieldStrip(compareFields = []) {
  const fields = normalizeCompareFields(compareFields);
  return `<div class="xmlc-side-field-strip"><b>Compare fields</b><span>${fields.length ? fields.map(esc).join(', ') : 'none'}</span></div>`;
}
function connectorOptionLabel(conn = {}) { return `${conn.label}: ${conn.sourceValue} <-> ${conn.targetValue}`; }
function selectedConnectorValue(input = {}) {
  if (input.aim?.basis === 'name') return `same:${(input.availableConnectors || []).find((conn) => conn.sameLevel)?.field || 'nodeName'}`;
  const enabled = new Set(input.enabledConnectorFields || ['lineNo']);
  const active = (input.availableConnectors || []).filter((conn) => !conn.sameLevel && enabled.has(conn.field));
  return active.length === 1 ? `parent:${active[0].field}` : (active.length > 1 ? `parent-multi:${active.map((conn) => conn.field).join('|')}` : 'none');
}
function mainConnectorControls(input = {}) {
  const connectionType = input.aim?.connectionType === 'string' ? 'string' : 'numeric';
  const typeToggle = `<div class="xmlc-conn-type" role="radiogroup" aria-label="Connection type"><span>Connection type</span><label><input type="radio" name="xmlc-connection-type" value="numeric" data-xml-compare-connection-type ${connectionType === 'numeric' ? 'checked' : ''}> Numeric</label><label><input type="radio" name="xmlc-connection-type" value="string" data-xml-compare-connection-type ${connectionType === 'string' ? 'checked' : ''}> String</label></div>`;
  const sel = input.selectedRecords || {};
  const anchorLabel = (record) => esc(record ? (record.displayName || record.nodeNumber || record.uid) : '-');
  if (!input.anchor) {
    const both = Boolean(sel.source && sel.target);
    const setBtn = `<button type="button" class="xmlc-set-anchor" data-xml-compare-action="auto-map-node" ${both ? '' : 'disabled'}>Set anchor pair</button>`;
    const msg = both ? `Ready: ${anchorLabel(sel.source)} <-> ${anchorLabel(sel.target)} - click Set anchor pair.` : 'Pick a Source and a Target node above, then Set anchor pair.';
    return `<div class="xmlc-main-connector is-empty">${typeToggle}<div class="xmlc-anchor-actions">${setBtn}</div><span>${msg}</span></div>`;
  }
  const anchorBar = `<div class="xmlc-anchor-set"><b>Anchor</b><span>${anchorLabel(sel.source)} <-> ${anchorLabel(sel.target)}</span><button type="button" data-xml-compare-action="clear-auto-map">Clear anchor</button></div>`;
  const available = input.availableConnectors || [];
  if (!available.length) return `<div class="xmlc-main-connector">${typeToggle}${anchorBar}<span>No connector fields detected for the anchor.</span></div>`;

  const basis = input.aim?.basis || 'coordinate';
  const enabled = new Set(input.enabledConnectorFields || ['lineNo']);
  const sameLevelConn = available.find((conn) => conn.sameLevel);
  const parentConns = available.filter((conn) => !conn.sameLevel);

  const sameCheckbox = sameLevelConn ? `
    <label style="display:flex; align-items:center; gap:4px; margin-bottom:4px; font-weight:bold; cursor:pointer;">
      <input type="checkbox" value="same:${esc(sameLevelConn.field)}" data-xml-compare-toggle-main-connector ${basis === 'name' ? 'checked' : ''}>
      ${esc(connectorOptionLabel(sameLevelConn))} (Match by Name)
    </label>
  ` : '';

  const parentCheckboxes = parentConns.map(conn => `
    <label style="display:flex; align-items:center; gap:4px; margin-bottom:2px; padding-left:12px; cursor:pointer;">
      <input type="checkbox" value="${esc(conn.field)}" data-xml-compare-toggle-main-connector ${enabled.has(conn.field) ? 'checked' : ''}>
      ${esc(connectorOptionLabel(conn))}
    </label>
  `).join('');

  const connList = `<div style="border: 1px solid var(--xmlc-border-color, #444); padding: 8px; border-radius: 4px; max-height: 250px; overflow-y: auto; background: var(--xmlc-bg-highlight, rgba(0,0,0,0.2));">
    ${sameCheckbox}
    ${parentConns.length > 0 ? `<div style="margin-bottom: 4px; font-weight: bold; margin-top: 8px;">Hierarchy Filters:</div>` : ''}
    <div style="display:flex; flex-direction:column; gap:2px;">
      ${parentCheckboxes}
    </div>
  </div>`;

  return `<div class="xmlc-main-connector" style="display:flex; flex-direction:column; gap:8px;">
    ${typeToggle}
    ${anchorBar}
    <div style="display:flex; flex-direction:column; gap:4px;">
      <b>Connector</b>
      ${connList}
    </div>
    <small>${esc(available.length)} option(s) from selected anchor</small>
  </div>`;
}
function searchLabel(levelView = {}) { const label = String(levelView.label || levelView.levelId || 'record').replace(/\s+/g, ' ').trim().toLowerCase(); return `Find ${label || 'record'}`; }
function sideCard(side, title, data = {}, navState = null, compareFields = []) {
  const selected = (data.records || []).find((record) => record.uid === navState?.selectedUid) || null;
  const originalLevel = data.levelProfile?.levels?.find(l => l.levelId === data.levelView?.levelId);
  const levelRecords = originalLevel?.records || data.levelView?.records || [];
  let searchInput = `<input data-xml-compare-anchor-search="${esc(side)}" placeholder="uid / key / name">`;
  if (levelRecords.length > 0 && levelRecords.length <= 250) {
    const opts = levelRecords.map(r => `<option value="${esc(r.uid)}">${esc(r.displayName || r.key || r.uid)}</option>`).join('');
    searchInput = `<select data-xml-compare-anchor-search="${esc(side)}" style="width:100%;"><option value="" disabled selected>Select ${esc((data.levelView?.label || 'record').toLowerCase())}...</option>${opts}</select>`;
  }
  return `<section class="xml-compare-workspace-side xmlc-side-picker-card is-${esc(side)}" data-xml-compare-canvas-host="${esc(side)}"><header><b>${esc(title || side)}</b><span>${sideHeader(data)}</span></header>${hierarchyControls(side, data.levelView || {})}<div class="xmlc-side-picker"><label style="width:100%; display:flex; flex-direction:column; gap:4px;">${esc(searchLabel(data.levelView || {}))}${searchInput}</label><button type="button" data-xml-compare-action="select-anchor-node" data-xml-compare-side="${esc(side)}" style="margin-top:auto;">Use</button></div>${labelFieldControls(side, data.levelView || {}, compareFields)}${compareFieldStrip(compareFields)}<div class="xml-compare-side-metrics">${sideMetric('Records', data.records?.length || 0)}${sideMetric('Nodes', data.summary?.nodeCount || 0)}${sideMetric('Selected', recordLabel(selected))}</div></section>`;
}
function compareFieldOptions(source = null, target = null, compareFields = []) { const selected = new Set(normalizeCompareFields(compareFields)), fields = availableCompareFields([...(source?.levelView?.fields || []), ...(target?.levelView?.fields || [])]); return fields.map((field) => `<option value="${esc(field)}" ${selected.has(field) ? 'disabled' : ''}>${esc(field)}</option>`).join(''); }
function validationFromRequest(matchMap = null) { return Object.freeze({ layer: normalizeValidationLayer(matchMap?.request?.validationLayer || 'current'), toleranceMm: normalizeToleranceMm(matchMap?.request?.toleranceMm), textRules: matchMap?.request?.textRules || {} }); }
function validationLayerOptions(selected = 'current') { return [['current', 'Current View Level'], ['lineBlock', 'LineBlock'], ['element', 'Element'], ['node', 'Node'], ['nodeEvidence', 'Node Evidence']].map(([value, label]) => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`).join(''); }
function validationControls(matchMap = null) { const settings = validationFromRequest(matchMap), downloads = matchMap?.request ? '<button type="button" data-xml-compare-action="download-validation-json">Download validation JSON</button><button type="button" data-xml-compare-action="download-validation-csv">Download validation CSV</button>' : '', presets = '<button type="button" data-xml-compare-compare-field-preset="coordinates">Coordinates preset</button><button type="button" data-xml-compare-compare-field-preset="element-endpoints">Element endpoints preset</button><button type="button" data-xml-compare-compare-field-preset="line-identity">Line identity preset</button><button type="button" data-xml-compare-compare-field-preset="support">Support preset</button>'; return `<div class="xml-compare-validation-controls" data-xml-compare-validation-controls><label>Applicable Hierarchy Layer<select data-xml-compare-validation-layer>${validationLayerOptions(settings.layer)}</select></label><label>Coordinate tolerance <input type="number" min="0" step="0.1" value="${esc(settings.toleranceMm)}" data-xml-compare-validation-tolerance-mm> mm</label>${presets}${downloads}</div>`; }
function compareFieldControls(source = null, target = null, compareFields = [], matchMap = null, validationBuilder = null, selectedRecords = {}, validation = {}) { const selected = normalizeCompareFields(compareFields); return `<div class="xml-compare-compare-field-controls" data-xml-compare-compare-fields><label>Compare fields<select data-xml-compare-compare-field-picker>${compareFieldOptions(source, target, selected)}</select></label><button type="button" data-xml-compare-add-compare-field>Add Field</button><div class="xml-compare-compare-field-list">${selected.map((field) => `<span class="xml-compare-compare-field-pill" data-xml-compare-compare-field="${esc(field)}">${esc(field)} <button type="button" data-xml-compare-remove-compare-field="${esc(field)}" aria-label="Remove ${esc(field)}">x</button></span>`).join('') || '<small>No compare fields selected.</small>'}</div>${renderXmlCompareManualValidationBuilderHtml({ builder: validationBuilder, compareFields: selected, selectedRecords, validation })}${validationControls(matchMap)}</div>`; }
function patchConnectorLaneActions(html = '', source = null, target = null, compareFields = [], matchMap = null, validationBuilder = null, selectedRecords = {}, validation = {}) { return String(html).replace(/<div class="xml-compare-auto-map-actions">([\s\S]*?)<\/div>/, (panel, body) => `<div class="xml-compare-auto-map-actions">${body}${compareFieldControls(source, target, compareFields, matchMap, validationBuilder, selectedRecords, validation)}</div>`); }
function connectorLane(input = {}, manualState = null) { return renderXmlCompareGraphConnectorLaneHtml({ manualState, controlHtml: mainConnectorControls(input) }); }

export function renderXmlCompareWorkspaceShellHtml(input = {}) {
  loadLazyRuntimes();
  const manualState = createManualState(input), tState = transferState(input), transferPreview = createXmlCompareTransferPreview({ source: input.source, target: input.target, manualConnectors: input.manualConnectors }), stageScope = tState.transferStage?.scope || 'node';
  const approvedCount = manualState?.approvedMatchSet?.summary?.approvedCount || manualState?.connectors?.length || 0;
  const reviewButton = `<button type="button" class="xml-compare-review-btn" data-xml-compare-action="open-transfer-modal">Review & Transfer (${approvedCount} approved)</button>`;
  return `<section class="xml-compare-workspace-shell is-rebuilt" data-xml-compare-workspace-shell data-xml-compare-workspace-shell-schema="${XML_COMPARE_WORKSPACE_SHELL_SCHEMA}"><div class="xml-compare-workspace-grid is-two-canvas">${sideCard('source', 'Source', input.source || {}, input.navStates?.source, input.compareFields)}<div class="xml-compare-connector-lane-container">${connectorLane(input, manualState)}${reviewButton}</div>${sideCard('target', 'Target', input.target || {}, input.navStates?.target, input.compareFields)}</div>${renderXmlCompareTransferModalPopupHtml({ input, tState, stageScope, transferPreview })}</section>`;
}
export const _test = Object.freeze({ esc, createManualState, transferState, compareFieldOptions, compareFieldControls, validationFromRequest, validationLayerOptions, validationControls, patchConnectorLaneActions, loadLazyRuntimes });
