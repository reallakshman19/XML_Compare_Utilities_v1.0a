import { buildPipelineProjectOutputs } from './pipeline-3d-model-project-adapter.js?v=20260724-p3d-hard-051-1';
import { CONFIG_FIELDS } from './pipeline-3d-model-config.js?v=20260724-p3d-core-050-1';
import { renderPipelineApprovedCatalogStatus } from './pipeline-3d-model-approved-catalog-status.js';
import { buildKeyPlanLegendHtml, paintKeyPlanCanvas } from './pipeline-3d-model-keyplan.js';
import { createTable2XSVG, createTable3XSVG } from './pipeline-3d-model-preview.js';
import { TABLE_HEADERS } from './pipeline-3d-model-cad-model.js';
import { addPipelineWarning, ensurePipelineWarningLog, renderPipelineWarningLog,
  warningFromError } from './pipeline-3d-model-warning-log.js?v=20260718-warning-log-1';

const INSTANCES = new WeakMap();
const CONFIG_KEYS = Object.freeze(CONFIG_FIELDS.map((field) => field.key));
const RAW_HEADERS = Object.freeze({ 'table2a-raw': TABLE_HEADERS.table2a,
  'table3a-raw': TABLE_HEADERS.table3a, 'table3b-raw': TABLE_HEADERS.table3b,
  'table3c-raw': TABLE_HEADERS.table3c });
const find = (dialog, selector) => dialog.querySelector(selector);
const rawValue = (dialog, name) => find(dialog, `[data-p3d-split="${name}"]`)?.value || '';
function hasRawContent(value) { return String(value || '').trim().length > 0; }
function hasRawRows(value) {
  const lines = String(value || '').split(/\r?\n/).filter((line) => line.trim());
  return lines.length > 1 && lines.slice(1).some((line) => /\d/.test(line));
}
function readProfileRaw(dialog) {
  return Object.freeze({ table2a: rawValue(dialog, 'table2a-raw'),
    table3a: rawValue(dialog, 'table3a-raw'), table3b: rawValue(dialog, 'table3b-raw'),
    table3c: rawValue(dialog, 'table3c-raw') });
}
function profileRawState(dialog) {
  const raw = readProfileRaw(dialog);
  const suppliedTables = Object.entries(raw).filter(([, value]) => hasRawContent(value))
    .map(([name]) => name);
  return Object.freeze({ raw, suppliedTables: Object.freeze(suppliedTables),
    active: suppliedTables.length > 0,
    ready: hasRawRows(raw.table2a) && hasRawRows(raw.table3a) });
}
function hasAuthoritativeProfile(dialog) { return profileRawState(dialog).ready; }
function hasAnyProfileRaw(dialog) { return profileRawState(dialog).active; }
function resolveProfileRawInput(dialog) {
  const state = profileRawState(dialog);
  if (!state.active) return null;
  if (state.ready) return state.raw;
  const error = new Error('Authoritative profile input requires populated Table 2A and Table 3A data.');
  error.code = 'PIPELINE_PROFILE_RAW_INCOMPLETE';
  error.details = Object.freeze({ suppliedTables: state.suppliedTables,
    table2aReady: hasRawRows(state.raw.table2a), table3aReady: hasRawRows(state.raw.table3a) });
  throw error;
}
function readBranchInfo(dialog) {
  const value = (key) => find(dialog, `[data-p3d-field="${key}"]`)?.value?.trim() || '';
  return Object.fromEntries(CONFIG_KEYS.map((key) => [key, value(key)]));
}
function buildInput(dialog) {
  return { table1Text: find(dialog, '[data-p3d="table1"]')?.value || '',
    table2Text: find(dialog, '[data-p3d="table2"]')?.value || '',
    table3Text: find(dialog, '[data-p3d="table3"]')?.value || '',
    profileRaw: resolveProfileRawInput(dialog),
    branchInfo: readBranchInfo(dialog),
    canonicalAnalysisSectionPlan: dialog.pipelineCanonicalAnalysisSectionPlan || null };
}
function setTextArea(dialog, name, value) {
  const element = find(dialog, `[data-p3d="${name}"]`); if (!element) return;
  element.value = value; element.dispatchEvent(new Event('input', { bubbles: true }));
}
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
function splitTsv(value) {
  return String(value || '').split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split('\t'));
}
function renderTsvGrid(value) {
  const [headers = [], ...rows] = splitTsv(value);
  return `<div class="p3d-derived-grid"><table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function markerPoints(output) { return output.combined.filter((point) => point.sources?.includes('marker')); }
function ensureTooltip(dialog) {
  let tooltip = find(dialog, '.p3d-tooltip'); if (tooltip) return tooltip;
  tooltip = dialog.ownerDocument.createElement('div'); tooltip.className = 'p3d-tooltip';
  dialog.appendChild(tooltip); return tooltip;
}
function artifactPanel(dialog) {
  let panel = find(dialog, '[data-p3d-core-artifacts]');
  if (panel) return panel;
  panel = dialog.ownerDocument.createElement('section'); panel.dataset.p3dCoreArtifacts = 'true';
  panel.className = 'p3d-core-artifacts';
  const anchor = find(dialog, '[data-p3d="xml-output"]')?.parentElement || dialog;
  anchor.appendChild(panel); return panel;
}
function renderArtifacts(dialog, output) {
  const panel = artifactPanel(dialog), artifacts = output.artifacts || [];
  panel.innerHTML = `<h4>Engineering evidence artifacts</h4>${artifacts.length
    ? artifacts.map((item, index) => `<button type="button" data-p3d-artifact="${index}">${escapeHtml(item.name)}</button>`).join(' ')
    : '<p>No artifacts available.</p>'}`;
}
function renderOutputs(dialog, output) {
  setTextArea(dialog, 'table2', output.table2Text); setTextArea(dialog, 'table3', output.table3Text);
  const table2Grid = find(dialog, '[data-p3d="table2x-output"]');
  const table3Grid = find(dialog, '[data-p3d="table3x-output"]');
  if (table2Grid) table2Grid.innerHTML = renderTsvGrid(output.table2XText);
  if (table3Grid) table3Grid.innerHTML = renderTsvGrid(output.table3XText);
  const table2Svg = find(dialog, '[data-p3d-split="table2x-preview"]');
  const table3Svg = find(dialog, '[data-p3d-split="table3x-preview"]');
  if (table2Svg) table2Svg.innerHTML = createTable2XSVG(output.table2XText);
  if (table3Svg) table3Svg.innerHTML = createTable3XSVG(output.table3XText);
  const table1Out = find(dialog, '[data-p3d="table1-output"]');
  const coordinateOut = find(dialog, '[data-p3d="coordinate-output"]');
  const xmlOut = find(dialog, '[data-p3d="xml-output"]');
  if (table1Out) table1Out.textContent = output.table1OutputText;
  if (coordinateOut) coordinateOut.textContent = output.coordinateText;
  if (xmlOut) xmlOut.textContent = output.xmlText;
  renderPipelineApprovedCatalogStatus(dialog, output);
  renderArtifacts(dialog, output);
}
function renderKeyPlan(dialog, output) {
  const legend = find(dialog, '[data-p3d="keyplan-legend"]');
  const html = buildKeyPlanLegendHtml(output.table1Points, output.sheets);
  if (legend) { legend.innerHTML = html; legend.hidden = !html; }
  const canvas = find(dialog, '[data-p3d="canvas-keyplan"]');
  if (canvas) paintKeyPlanCanvas(canvas, output.table1Points, output.sheets,
    ensureTooltip(dialog), markerPoints(output));
}
function setWarnings(dialog, instance, warnings = []) {
  instance.warnings = [...warnings]; renderPipelineWarningLog(dialog, instance.warnings);
}
function logWarning(dialog, instance, code, error, details = null) {
  const warning = warningFromError(error, code);
  addPipelineWarning(instance.warnings, warning.code, warning.message, details || error?.details || null);
  renderPipelineWarningLog(dialog, instance.warnings);
}
function publishCanonicalPlan(dialog, output) {
  if (!output?.canonicalAnalysisSectionPlan) return;
  dialog.pipelineCanonicalAnalysisSectionPlan = output.canonicalAnalysisSectionPlan;
  dialog.dispatchEvent(new CustomEvent('pipeline-canonical-analysis-section-plan', {
    bubbles: false, detail: { plan: output.canonicalAnalysisSectionPlan } }));
}
function run(dialog, instance) {
  try {
    const input = buildInput(dialog), output = buildPipelineProjectOutputs(input);
    instance.output = output; publishCanonicalPlan(dialog, output);
    instance.rendering = true;
    try { renderOutputs(dialog, output); renderKeyPlan(dialog, output); }
    finally { instance.rendering = false; }
    const legacyError = find(dialog, '[data-p3d="error-message"]'); if (legacyError) legacyError.style.display = 'none';
    setWarnings(dialog, instance, output.warnings || []); return output;
  } catch (error) { instance.output = null; logWarning(dialog, instance, 'propagation_unavailable', error); return null; }
}
function saveTextFile(filename, value, mime) {
  const blob = new Blob([value], { type: mime }), url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function download(dialog, instance, kind) {
  const output = instance.output || run(dialog, instance); if (!output) return;
  if (kind === 'coordinate') return saveTextFile('pipeline-coordinate-tab.tsv', output.coordinateText, 'text/tab-separated-values');
  if (!output.xmlText) return logWarning(dialog, instance, 'inputxml_blocked',
    `Canonical InputXML is blocked: ${output.orchestration?.blockerCodes?.join(', ') || 'unknown blocker'}.`);
  saveTextFile('pipeline-3d-model.xml', output.xmlText, 'application/xml');
}
function downloadArtifact(dialog, instance, index) {
  const output = instance.output || run(dialog, instance); if (!output) return;
  const item = output.artifacts?.[index]; if (!item) return;
  saveTextFile(item.name, item.text, item.mime || 'application/octet-stream');
}
function rawTextFromPreview(panel) {
  const name = panel.dataset.p3dSplitPanel, headers = RAW_HEADERS[name]; if (!headers) return null;
  const rows = Array.from(panel.querySelectorAll('[data-p3d-split-row]')).map((row) =>
    headers.map((_, index) => row.querySelector(`[data-p3d-split-cell$=":${index}"]`)?.value?.trim() || '—'));
  return { name, text: [headers, ...rows].map((row) => row.join('\t')).join('\n') };
}
function repairPreviewInput(dialog, event) {
  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest('[data-p3d-split-cell]'); if (!cell) return false;
  const update = rawTextFromPreview(cell.closest('[data-p3d-split-panel]')); if (!update) return false;
  event.stopImmediatePropagation(); const raw = find(dialog, `[data-p3d-split="${update.name}"]`);
  if (raw) { raw.value = update.text; queueMicrotask(() => raw.dispatchEvent(new Event('input', { bubbles: true }))); }
  return true;
}
function scheduleRefresh(dialog, instance) {
  if (instance.refreshQueued) return; instance.refreshQueued = true;
  queueMicrotask(() => { instance.refreshQueued = false; run(dialog, instance); });
}
function pipelineSourceInput(target) {
  const data = target?.dataset;
  if (!data) return false;
  if (data.p3dField !== undefined) return true;
  if (['table1', 'table2', 'table3'].includes(data.p3d)) return true;
  return typeof data.p3dSplit === 'string' && data.p3dSplit.endsWith('-raw');
}
function onInput(dialog, instance, event) {
  if (repairPreviewInput(dialog, event)) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!instance.rendering && pipelineSourceInput(target)) instance.output = null;
  if (!instance.rendering && target?.matches('[data-p3d-split$="-raw"]')
    && hasAnyProfileRaw(dialog)) scheduleRefresh(dialog, instance);
}
function onClick(dialog, instance, event) {
  const target = event.target instanceof Element ? event.target.closest('button') : null;
  if (target?.dataset.p3dArtifact !== undefined) {
    event.preventDefault(); downloadArtifact(dialog, instance, Number(target.dataset.p3dArtifact)); return;
  }
  const action = target?.dataset.p3d; if (!['run', 'download-coordinate', 'download-xml'].includes(action)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (action === 'run') run(dialog, instance);
  if (action === 'download-coordinate') download(dialog, instance, 'coordinate');
  if (action === 'download-xml') download(dialog, instance, 'xml');
}
export function installPipelineProfilePropagation(dialog) {
  if (!dialog || INSTANCES.has(dialog)) return INSTANCES.get(dialog)?.destroy || null;
  const controller = new AbortController(), instance = { output: null, refreshQueued: false,
    rendering: false, warnings: [] };
  ensurePipelineWarningLog(dialog); renderPipelineWarningLog(dialog, []);
  dialog.addEventListener('click', (event) => onClick(dialog, instance, event), { capture: true, signal: controller.signal });
  dialog.addEventListener('input', (event) => onInput(dialog, instance, event), { capture: true, signal: controller.signal });
  dialog.addEventListener('pipeline-engineering-configuration-apply', () => { instance.output = null; },
    { signal: controller.signal });
  instance.destroy = () => { controller.abort(); INSTANCES.delete(dialog); };
  INSTANCES.set(dialog, instance); return instance.destroy;
}
export const _test = Object.freeze({ buildInput, readBranchInfo, hasAuthoritativeProfile,
  hasAnyProfileRaw, resolveProfileRawInput, profileRawState, pipelineSourceInput,
  rawTextFromPreview, renderTsvGrid, setWarnings, publishCanonicalPlan });
