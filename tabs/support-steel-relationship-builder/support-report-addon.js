import { buildSupportReportBundle } from './support-report-engine.js?v=20260915-support-primary-hardening-1&trace=20260910-support-report-json-trace-18&rca=20260910-bore-site-zone-19&pos=20260911-support-report-pos-trace-20&location=20260911-support-report-location-attribution-22&prev=20260911-prevname-semantic-22&datum=20260911-datum-metadata-23&primary=20260915-support-primary-hardening-1&count=20260915-support-primary-traversal-safety-1&maintainability=20260929-support-primary-maintainability-1';
import { supportReportToCsv } from './support-report-export.js?v=20260910-support-report-typicality-columns-1';
import {
  supportReportDebugExportFileName,
  supportReportDebugToJson,
  supportReportTraceExportFileName,
  supportReportTraceSummary,
  supportReportTraceToCsv,
} from './support-report-trace-export.js?v=20260911-support-report-trace-export-21&location=20260911-support-report-location-attribution-22&prev=20260911-prevname-semantic-22&datum=20260911-datum-metadata-23&typicalityPublication=20260915-column22-publication-v1';
import {
  buildSupportReportTypicalityComparison,
  projectTypicalityOntoSupportReportBundle,
} from './support-report-typicality-projection.js?v=20260915-axis-typicality-v1&publication=20260915-column22-publication-v1';
import {
  SUPPORT_REPORT_TYPICALITY_FIXED_POLICIES,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  SUPPORT_REPORT_TYPICALITY_UI_SETTINGS,
  profileOverrideFromEntries,
  profileValue,
} from './support-report-typicality-profile.js?v=20260910-support-report-typicality-profile-ui-1';
import { renderSupportReportWorkspace } from './support-report-view.js?v=20260910-support-report-typicality-columns-1&trace=20260910-support-report-json-trace-18&pos=20260911-support-report-pos-trace-20&perf=20260913-support-report-large-xml-1';
import { supportReportToXlsxBytes } from './support-report-xlsx.js?v=20260910-support-report-typicality-columns-1';
import {
  groupSupportReportClashEvidence,
  parseSupportReportClashXml,
} from './support-report-clash-safety.js?v=20260909-support-report-parser-primitives-8&location=20260915-support-report-bore-axis-occurrence-1&typicality=20260910-support-report-typicality-17&perf=20260913-support-report-large-xml-1';
import {
  parseSupportReportXmlAsync,
  SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES,
} from './support-report-parse-client.js?v=20260913-support-report-large-xml-1';
import { assertSupportReportEvidenceReady } from './support-report-build-gate.js?v=20260909-support-report-empty-block-7';
import {
  supportReportCompleteness,
  supportReportExportFileName,
} from './support-report-ui-state.js?v=20260910-support-report-ui-completeness-16';
import { buildSupportSteelRelationshipBundle } from './support-steel-evidence-bundle.js?v=20260909-support-report-1';
import { parseSupportSteelJson } from './support-steel-source-utils.js?v=20260717-startup-parse-hotfix-1';
import {
  buildReferenceSupportPrimaryRelationshipInput,
  buildSupportPrimaryRelationshipInput,
} from './support-primary-input.js?v=20260915-reference-relationship-v1';
import { readOrphanRecoveryConfig } from './support-primary-orphan-ui-addon.js?v=20260929-support-primary-maintainability-1';
import {
  discoverSupportReportZones,
  normalizeSupportReportZoneScope,
  scopeSupportReportRows,
  supportReportZoneScopeSummary,
} from './support-report-zone-scope.js?v=20260915-support-primary-zone-ui-1';

const POPUP_SELECTOR = '[data-ssrb-popup="1"]';
const TAB_KEY = 'support-report';
const SUPPORT_REPORT_FAMILY_PATTERN = '^/((?:PS|SL)-[A-Z0-9_-]+)';
const mounted = new WeakSet();
const stateByPopup = new WeakMap();
let observer = null;

export function installSupportReportAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountAll(doc);
  observer = new MutationObserver(() => mountAll(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}

function mountAll(doc) {
  for (const popup of doc.querySelectorAll(POPUP_SELECTOR)) mount(popup);
}

function mount(popup) {
  if (mounted.has(popup)) return;
  const tabs = popup.querySelector('.ssrb-tabs');
  const workspace = popup.querySelector('.ssrb-workspace');
  if (!tabs || !workspace) return;

  const existingButton = popup.querySelector(`[data-ssrb-tab="${TAB_KEY}"]`);
  const existingPanel = popup.querySelector(`[data-ssrb-panel="${TAB_KEY}"]`);
  if (existingButton && existingPanel) {
    mounted.add(popup);
    return;
  }
  existingButton?.remove();
  existingPanel?.remove();

  mounted.add(popup);
  stateByPopup.set(popup, {
    report: null,
    runAbort: null,
    zoneDiscoveryAbort: null,
    primaryDiscoveryEvidence: null,
    primaryDiscoverySource: null,
    zoneCatalog: { primaryZones: [], secondaryZones: [] },
    zoneSelections: { primary: new Set(), secondary: new Set() },
    xmlFiles: { primary: null, typical: null, relationship: null, referenceRelationship: null },
  });

  const button = popup.ownerDocument.createElement('button');
  button.type = 'button';
  button.dataset.ssrbTab = TAB_KEY;
  button.textContent = 'Support Report';
  tabs.appendChild(button);

  const panel = popup.ownerDocument.createElement('section');
  panel.dataset.ssrbPanel = TAB_KEY;
  panel.hidden = true;
  panel.innerHTML = renderPanel();
  workspace.appendChild(panel);

  button.addEventListener('click', () => showPanel(popup));
  popup.querySelector('[data-ssr-file]')?.addEventListener('change', () => void readXmlFile(popup, 'primary'));
  popup.querySelector('[data-ssr-typical-file]')?.addEventListener('change', () => void readXmlFile(popup, 'typical'));
  popup.querySelector('[data-ssr-relationship-file]')?.addEventListener('change', () => void readRelationshipFile(popup, 'relationship'));
  popup.querySelector('[data-ssr-reference-relationship-file]')?.addEventListener('change', () => void readRelationshipFile(popup, 'referenceRelationship'));
  popup.querySelector('[data-ssr-model-file]')?.addEventListener('change', () => void readModelFile(popup));
  popup.querySelector('[data-ssr-xml]')?.addEventListener('input', () => {
    clearImportedXml(popup, 'primary');
    resetZoneDiscovery(popup);
    invalidate(popup, 'Primary XML changed; rediscover zones and rebuild the Support Report.');
  });
  popup.querySelector('[data-ssr-typical-xml]')?.addEventListener('input', () => {
    clearImportedXml(popup, 'typical');
    invalidate(popup, 'Typical-structure reference XML changed; rebuild the Support Report.');
  });
  popup.querySelector('[data-ssr-relationship-xml]')?.addEventListener('input', () => {
    clearImportedXml(popup, 'relationship');
    invalidate(popup, 'Primary-support relationship XML changed; rebuild the Support Report.');
  });
  popup.querySelector('[data-ssr-reference-relationship-xml]')?.addEventListener('input', () => {
    clearImportedXml(popup, 'referenceRelationship');
    invalidate(popup, 'Reference Primary Support relationship XML changed; rebuild the Support Report.');
  });
  popup.querySelector('[data-ssrb-input="model"]')?.addEventListener('input', () => {
    syncModelStatus(popup, 'Shared combined staged model changed; rebuild the Support Report.');
    invalidate(popup, 'Combined staged model changed; rebuild the Support Report.');
  });
  popup.querySelector('[data-ssr-zone-discover]')?.addEventListener('click', () => void discoverZones(popup));
  for (const side of ['primary', 'secondary']) {
    popup.querySelector(`[data-ssr-zone-search="${side}"]`)?.addEventListener('input', () => renderZoneSelector(popup, side));
    popup.querySelector(`[data-ssr-zone-select="${side}"]`)?.addEventListener('change', (event) => {
      updateZoneSelectionFromVisibleOptions(popup, side, event.currentTarget);
      syncZoneSelectionStatus(popup, side);
      invalidate(popup, 'Zone scope changed; rebuild the Support Report.');
    });
    popup.querySelector(`[data-ssr-zone-clear="${side}"]`)?.addEventListener('click', () => {
      const state = stateByPopup.get(popup);
      state?.zoneSelections?.[side]?.clear();
      renderZoneSelector(popup, side);
      syncZoneSelectionStatus(popup, side);
      invalidate(popup, 'Zone scope changed; rebuild the Support Report.');
    });
  }
  popup.querySelectorAll('[data-ssrb-rule]').forEach((node) => {
    const eventName = node.type === 'checkbox' || node.tagName === 'SELECT' ? 'change' : 'input';
    node.addEventListener(eventName, () => invalidate(popup, 'Relationship rules changed; rebuild the Support Report.'));
  });
  popup.querySelectorAll('[data-ssr-typical-setting]').forEach((node) => {
    const eventName = node.type === 'checkbox' || node.tagName === 'SELECT' ? 'change' : 'input';
    node.addEventListener(eventName, () => invalidate(popup, 'Typicality matching configuration changed; rebuild the Support Report.'));
  });
  popup.querySelector('[data-ssr-build]')?.addEventListener('click', () => void run(popup));
  popup.querySelector('[data-ssr-download-xlsx]')?.addEventListener('click', () => void downloadXlsx(popup));
  popup.querySelector('[data-ssr-download]')?.addEventListener('click', () => downloadCsv(popup));
  popup.querySelector('[data-ssr-download-trace]')?.addEventListener('click', () => downloadTraceCsv(popup));
  popup.querySelector('[data-ssr-download-debug]')?.addEventListener('click', () => downloadDebugJson(popup));
  popup.querySelector('[data-ssr-copy]')?.addEventListener('click', () => void copyCsv(popup));
}

function renderPanel() {
  return `<section class="ssrb-card ssrb-results-card"><header><div><span class="ssrb-step">R</span><b>Build Support Report from Navisworks clash evidence</b></div><span class="ssrb-panel-note">Primary clash XML establishes pipe, secondary family and physical support location. Optional current/reference Clash-within-Supports XML establishes explicit primary-support member connectivity. Exact current-area parent-zone scope can be selected before build; reference relationship scope is derived independently from exact reference-report ancestry.</span></header><div class="ssrb-input-grid">${xmlSourceCard()}${relationshipSourceCard()}${typicalSourceCard()}${referenceRelationshipSourceCard()}${modelSourceCard()}</div>${zoneScopeCard()}${typicalityConfigCard()}<div class="ssrb-build-grid"><div><h3>SupportReportBundle.v1</h3><p>Rows use the governed family + pipe + physical clash-location model. Optional support-member relationship evidence adds stable Primary Support Assembly IDs. Current and reference relationship evidence are independently scoped.</p><div class="ssrb-dialog-actions"><button type="button" class="ssrb-primary" data-ssr-build="1">Build Support Report</button><button type="button" class="ssrb-primary" data-ssr-download-xlsx="1" disabled>Download XLSX</button><button type="button" data-ssr-download="1" disabled>Download Report CSV</button><button type="button" data-ssr-download-trace="1" disabled>Download Trace CSV</button><button type="button" data-ssr-download-debug="1" disabled>Download Debug JSON</button><button type="button" data-ssr-copy="1" disabled>Copy Report CSV</button></div></div><div class="ssrb-run-state" data-ssr-run-state><b>Not built</b><span>Load the primary XML. Zone scope, current/reference relationship XML, staged JSON and typical-structure reference XML are optional evidence/configuration.</span></div></div><div data-ssr-results>${renderSupportReportWorkspace(null)}</div></section>`;
}
function xmlSourceCard() {
  return `<div class="ssrb-source-card"><div class="ssrb-source-head"><b>Primary Support Report clash XML</b><label class="ssrb-file-button">Choose XML<input type="file" accept=".xml,text/xml,application/xml" data-ssr-file="1"></label></div><span>Navisworks clash/clearance XML used to build operational support locations and discover exact primary/secondary parent zones.</span><textarea rows="10" data-ssr-xml spellcheck="false" placeholder="Paste primary SupportreportXML.xml"></textarea><small data-ssr-file-status>No primary Support Report XML selected</small></div>`;
}
function relationshipSourceCard() {
  return `<div class="ssrb-source-card"><div class="ssrb-source-head"><b>Primary Support Relationship XML (optional)</b><label class="ssrb-file-button">Choose XML<input type="file" accept=".xml,text/xml,application/xml" data-ssr-relationship-file="1"></label></div><span>Optional current-area Navisworks “Clash within Supports” XML. Establishes PS/SL member-to-member Primary Support Assembly connectivity before count projection. It does not become Support/Steel carrier authority.</span><textarea rows="10" data-ssr-relationship-xml spellcheck="false" placeholder="Optional: paste current-area Clash within Supports XML"></textarea><small data-ssr-relationship-file-status>No current primary-support relationship XML selected · geometry fallback remains active</small></div>`;
}
function typicalSourceCard() {
  return `<div class="ssrb-source-card"><div class="ssrb-source-head"><b>Typical-structure reference XML</b><label class="ssrb-file-button">Choose second XML<input type="file" accept=".xml,text/xml,application/xml" data-ssr-typical-file="1"></label></div><span>Optional second-area Support Report XML. When present, family structural matching and row-independent piping-support correspondence add comparison columns 22–24.</span><textarea rows="10" data-ssr-typical-xml spellcheck="false" placeholder="Optional: paste reference/second SupportreportXML.xml"></textarea><small data-ssr-typical-file-status>No reference XML selected · legacy 21-column mode</small></div>`;
}
function referenceRelationshipSourceCard() {
  return `<div class="ssrb-source-card"><div class="ssrb-source-head"><b>Reference Primary Support Relationship XML (optional)</b><label class="ssrb-file-button">Choose XML<input type="file" accept=".xml,text/xml,application/xml" data-ssr-reference-relationship-file="1"></label></div><span>Optional reference-area Navisworks “Clash within Supports” XML. It is scoped automatically from exact ancestor zones discovered in the reference Support Report XML; current-area zone selections are never reused.</span><textarea rows="10" data-ssr-reference-relationship-xml spellcheck="false" placeholder="Optional: paste reference-area Clash within Supports XML"></textarea><small data-ssr-reference-relationship-file-status>No reference primary-support relationship XML selected · relationship topology may be unavailable on the reference side</small></div>`;
}
function modelSourceCard() {
  return `<div class="ssrb-source-card"><div class="ssrb-source-head"><b>Staged JSON trace source (optional)</b><label class="ssrb-file-button">Choose JSON<input type="file" accept=".json,application/json" data-ssr-model-file="1"></label></div><span>Uses the same combined staged-model source as the Input tab. Direct PS/SL identity is preferred; JSON trace groups native evidence by staged POS while preserving observed-member mappings.</span><small data-ssr-model-status>No staged JSON imported from Support Report. Existing Input-tab model, if any, will still be used.</small></div>`;
}
function zoneScopeCard() {
  return `<details class="ssrb-card" data-ssr-zone-scope open><summary><b>Support Report zone scope</b> ${infoIcon('Zones are discovered from exact ancestor nodes in the current primary Support Report XML. Empty selections mean no restriction. When both columns have selections, a current report row must match both sides. Reference relationship scope is derived independently from reference evidence.')}</summary><div class="ssrb-dialog-actions"><button type="button" data-ssr-zone-discover="1">Discover zones from primary XML</button><span data-ssr-zone-discovery-status>No zones discovered yet.</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:.75rem"><div class="ssrb-source-card"><b>Primary / piping-support zones</b><input type="search" data-ssr-zone-search="primary" placeholder="Search primary zones" aria-label="Search primary piping-support zones"><select multiple size="8" data-ssr-zone-select="primary" aria-label="Primary piping-support zones" style="width:100%;margin-top:.45rem"></select><div class="ssrb-dialog-actions"><button type="button" data-ssr-zone-clear="primary">Clear selection</button><small data-ssr-zone-status="primary">No restriction</small></div></div><div class="ssrb-source-card"><b>Secondary / support zones</b><input type="search" data-ssr-zone-search="secondary" placeholder="Search secondary zones" aria-label="Search secondary support zones"><select multiple size="8" data-ssr-zone-select="secondary" aria-label="Secondary support zones" style="width:100%;margin-top:.45rem"></select><div class="ssrb-dialog-actions"><button type="button" data-ssr-zone-clear="secondary">Clear selection</button><small data-ssr-zone-status="secondary">No restriction</small></div></div></div></details>`;
}
function typicalityConfigCard() {
  const sections = new Map();
  for (const setting of SUPPORT_REPORT_TYPICALITY_UI_SETTINGS) {
    if (!sections.has(setting.section)) sections.set(setting.section, []);
    sections.get(setting.section).push(setting);
  }
  const controls = [...sections.entries()].map(([section, settings]) => `<div class="ssrb-source-card"><b>${h(section)}</b>${settings.map(renderTypicalitySetting).join('')}</div>`).join('');
  const policies = SUPPORT_REPORT_TYPICALITY_FIXED_POLICIES.map((policy) => `<div><b>${h(policy.label)}</b>: ${h(policy.value)} ${infoIcon(policy.help)}</div>`).join('');
  return `<details class="ssrb-card" data-ssr-typical-config open><summary><b>Typicality matching configuration</b> ${infoIcon('Editable values below feed the comparison profile used in the audit. Defaults are provisional and remain visible rather than hidden in code.')}</summary><p>Active comparison controls. Changing any value invalidates the current report and requires rebuild.</p><div class="ssrb-input-grid">${controls}</div><div class="ssrb-source-card"><b>Declared matcher policies / next structured-sequence seam</b>${policies}</div></details>`;
}
function renderTypicalitySetting(setting) {
  const value = profileValue(SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL, setting.path);
  const common = `data-ssr-typical-setting="${h(setting.path)}" aria-label="${h(setting.label)}"`;
  const control = setting.type === 'checkbox'
    ? `<input type="checkbox" ${common}${value ? ' checked' : ''}>`
    : `<input type="number" ${common} value="${h(value)}"${setting.min != null ? ` min="${h(setting.min)}"` : ''}${setting.max != null ? ` max="${h(setting.max)}"` : ''}${setting.step != null ? ` step="${h(setting.step)}"` : ''}>`;
  return `<label style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center;margin:.45rem 0"><span>${h(setting.label)}${setting.unit ? ` (${h(setting.unit)})` : ''} ${infoIcon(setting.help)}</span>${control}</label>`;
}
function infoIcon(help) {
  return `<span role="img" aria-label="Information: ${h(help)}" title="${h(help)}" style="cursor:help;text-decoration:underline dotted">(i)</span>`;
}

async function readXmlFile(popup, kind) {
  const typical = kind === 'typical';
  const input = popup.querySelector(typical ? '[data-ssr-typical-file]' : '[data-ssr-file]');
  const file = input?.files?.[0];
  if (!file) return;
  const state = stateByPopup.get(popup);
  if (!state) return;
  state.xmlFiles[kind] = file;
  if (!typical) resetZoneDiscovery(popup, { keepFile: true });

  const textarea = popup.querySelector(typical ? '[data-ssr-typical-xml]' : '[data-ssr-xml]');
  if (textarea) {
    if (file.size <= SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES) {
      const text = await file.text();
      if (state.xmlFiles[kind] !== file) return;
      textarea.value = text;
    } else {
      textarea.value = '';
      textarea.placeholder = `${file.name} is staged for background parsing; large-file text preview is intentionally omitted.`;
    }
  }
  const status = popup.querySelector(typical ? '[data-ssr-typical-file-status]' : '[data-ssr-file-status]');
  if (status) status.textContent = file.size > SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES
    ? `${file.name} · ${file.size} bytes · staged for background parsing (text preview omitted)`
    : `${file.name} · ${file.size} bytes`;
  invalidate(popup, typical
    ? 'Typical-structure reference XML changed; rebuild the Support Report.'
    : 'Primary XML changed; rediscover zones and rebuild the Support Report.');
  if (!typical) void discoverZones(popup, { quiet: true });
}

async function readRelationshipFile(popup, kind = 'relationship') {
  const reference = kind === 'referenceRelationship';
  const file = popup.querySelector(reference ? '[data-ssr-reference-relationship-file]' : '[data-ssr-relationship-file]')?.files?.[0];
  if (!file) return;
  const state = stateByPopup.get(popup);
  if (!state) return;
  state.xmlFiles[kind] = file;
  const textarea = popup.querySelector(reference ? '[data-ssr-reference-relationship-xml]' : '[data-ssr-relationship-xml]');
  if (textarea) {
    if (file.size <= SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES) textarea.value = await file.text();
    else {
      textarea.value = '';
      textarea.placeholder = `${file.name} is staged; large relationship XML preview is omitted.`;
    }
  }
  const status = popup.querySelector(reference ? '[data-ssr-reference-relationship-file-status]' : '[data-ssr-relationship-file-status]');
  if (status) status.textContent = `${file.name} · ${file.size} bytes · optional ${reference ? 'reference' : 'current'} Primary Support relationship evidence`;
  invalidate(popup, reference
    ? 'Reference Primary Support relationship XML changed; rebuild the Support Report.'
    : 'Primary-support relationship XML changed; rebuild the Support Report.');
}

async function readModelFile(popup) {
  const file = popup.querySelector('[data-ssr-model-file]')?.files?.[0];
  if (!file) return;
  const text = await file.text();
  const sharedInput = popup.querySelector('[data-ssrb-input="model"]');
  if (!sharedInput) throw new Error('Combined staged model input is unavailable.');
  sharedInput.value = text;
  const sharedStatus = popup.querySelector('[data-ssrb-file-status="model"]');
  if (sharedStatus) sharedStatus.textContent = `${file.name} · ${file.size} bytes · loaded from Support Report`;
  popup.querySelector('[data-ssr-model-status]').textContent = `${file.name} · ${file.size} bytes · shared with Input tab`;
  invalidate(popup, 'Staged JSON changed; rebuild the Support Report.');
}

function syncModelStatus(popup, message) {
  const status = popup.querySelector('[data-ssr-model-status]');
  if (status) status.textContent = message;
}

async function discoverZones(popup, options = {}) {
  const state = stateByPopup.get(popup);
  if (!state) return null;
  const source = xmlSource(popup, 'primary');
  const status = popup.querySelector('[data-ssr-zone-discovery-status]');
  if (!hasXmlSource(source)) {
    if (!options.quiet && status) status.textContent = 'Load primary Support Report XML before discovering zones.';
    return null;
  }
  state.zoneDiscoveryAbort?.abort();
  const controller = new AbortController();
  state.zoneDiscoveryAbort = controller;
  if (status) status.textContent = 'Discovering exact parent zones…';
  try {
    const evidence = assertSupportReportEvidenceReady(await parseSupportReportXmlAsync(source, {}, {
      signal: controller.signal,
      fallbackParser: parseSupportReportClashXml,
    }));
    if (controller.signal.aborted) return null;
    state.primaryDiscoveryEvidence = evidence;
    state.primaryDiscoverySource = source;
    state.zoneCatalog = discoverSupportReportZones(evidence.rows || []);
    trimStaleZoneSelections(state);
    renderZoneSelector(popup, 'primary');
    renderZoneSelector(popup, 'secondary');
    syncZoneSelectionStatus(popup, 'primary');
    syncZoneSelectionStatus(popup, 'secondary');
    if (status) status.textContent = `${state.zoneCatalog.primaryZones.length} primary-zone node(s) · ${state.zoneCatalog.secondaryZones.length} secondary-zone node(s) discovered from exact ancestry.`;
    return evidence;
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    if (status) status.textContent = `Zone discovery blocked: ${error.message || error}`;
    if (!options.quiet) throw error;
    return null;
  } finally {
    if (state.zoneDiscoveryAbort === controller) state.zoneDiscoveryAbort = null;
  }
}

function renderZoneSelector(popup, side) {
  const state = stateByPopup.get(popup);
  const select = popup.querySelector(`[data-ssr-zone-select="${side}"]`);
  const search = popup.querySelector(`[data-ssr-zone-search="${side}"]`);
  if (!state || !select) return;
  const rows = side === 'primary' ? state.zoneCatalog.primaryZones : state.zoneCatalog.secondaryZones;
  const query = String(search?.value || '').trim().toUpperCase();
  const selected = state.zoneSelections[side];
  select.textContent = '';
  for (const row of rows) {
    if (query && !row.zoneId.toUpperCase().includes(query)) continue;
    const option = popup.ownerDocument.createElement('option');
    option.value = row.zoneId;
    option.textContent = `${row.zoneId} · ${row.evidenceRowCount} row${row.evidenceRowCount === 1 ? '' : 's'}`;
    option.selected = selected.has(row.zoneId);
    select.appendChild(option);
  }
}

function updateZoneSelectionFromVisibleOptions(popup, side, select) {
  const state = stateByPopup.get(popup);
  if (!state || !select) return;
  const selected = state.zoneSelections[side];
  for (const option of select.options || []) {
    if (option.selected) selected.add(option.value);
    else selected.delete(option.value);
  }
}

function syncZoneSelectionStatus(popup, side) {
  const state = stateByPopup.get(popup);
  const status = popup.querySelector(`[data-ssr-zone-status="${side}"]`);
  if (!state || !status) return;
  const count = state.zoneSelections[side].size;
  status.textContent = count ? `${count} exact zone${count === 1 ? '' : 's'} selected` : 'No restriction';
}

function trimStaleZoneSelections(state) {
  for (const side of ['primary', 'secondary']) {
    const rows = side === 'primary' ? state.zoneCatalog.primaryZones : state.zoneCatalog.secondaryZones;
    const allowed = new Set(rows.map((row) => row.zoneId));
    for (const id of state.zoneSelections[side]) if (!allowed.has(id)) state.zoneSelections[side].delete(id);
  }
}

function resetZoneDiscovery(popup, options = {}) {
  const state = stateByPopup.get(popup);
  if (!state) return;
  state.zoneDiscoveryAbort?.abort();
  state.zoneDiscoveryAbort = null;
  state.primaryDiscoveryEvidence = null;
  state.primaryDiscoverySource = null;
  state.zoneCatalog = { primaryZones: [], secondaryZones: [] };
  state.zoneSelections.primary.clear();
  state.zoneSelections.secondary.clear();
  renderZoneSelector(popup, 'primary');
  renderZoneSelector(popup, 'secondary');
  syncZoneSelectionStatus(popup, 'primary');
  syncZoneSelectionStatus(popup, 'secondary');
  const status = popup.querySelector('[data-ssr-zone-discovery-status]');
  if (status) status.textContent = 'No zones discovered yet.';
  if (!options.keepFile) clearImportedXml(popup, 'primary');
}

function readZoneScope(popup) {
  const state = stateByPopup.get(popup);
  return normalizeSupportReportZoneScope({
    primaryZoneIds: [...(state?.zoneSelections?.primary || [])],
    secondaryZoneIds: [...(state?.zoneSelections?.secondary || [])],
  });
}

function scopePrimaryEvidence(evidence, popup, zoneScope) {
  const rows = scopeSupportReportRows(evidence?.rows || [], zoneScope);
  if (zoneScope.active && evidence?.rows?.length && !rows.length) {
    throw new Error('Selected zone scope excludes every primary Support Report clash row. Adjust the Primary / Secondary zone selections.');
  }
  return Object.freeze({
    ...evidence,
    rows,
    groups: groupSupportReportClashEvidence(rows, supportReportRules(popup)),
    zoneScopeSummary: supportReportZoneScopeSummary(evidence?.rows || [], zoneScope),
  });
}

async function run(popup) {
  const state = stateByPopup.get(popup);
  const host = popup.querySelector('[data-ssr-results]');
  const runState = popup.querySelector('[data-ssr-run-state]');
  if (!state || !host || !runState) return;

  state.runAbort?.abort();
  const controller = new AbortController();
  state.runAbort = controller;
  setBuildBusy(popup, true);
  setExportEnabled(popup, false);
  runState.innerHTML = '<b>Building Support Report</b><span>Parsing Support Report XML in a background worker…</span>';
  await nextPaint();

  try {
    const primarySource = xmlSource(popup, 'primary');
    if (!hasXmlSource(primarySource)) throw new Error('Primary Support Report clash XML is required.');
    const zoneScope = readZoneScope(popup);
    const orphanRecoveryConfig = readOrphanRecoveryConfig(popup);
    const modelText = popup.querySelector('[data-ssrb-input="model"]')?.value || '';
    let relationshipBundle = null;
    if (modelText.trim()) {
      const combinedInput = parseSupportSteelJson(modelText, 'Combined staged model source');
      relationshipBundle = buildSupportSteelRelationshipBundle({ combinedInput, config: supportReportRules(popup) });
    }

    const rawEvidence = sameXmlSource(state.primaryDiscoverySource, primarySource) && state.primaryDiscoveryEvidence
      ? state.primaryDiscoveryEvidence
      : assertSupportReportEvidenceReady(await parseSupportReportXmlAsync(primarySource, {}, {
        signal: controller.signal,
        fallbackParser: parseSupportReportClashXml,
      }));
    if (controller.signal.aborted) return;
    if (!state.primaryDiscoveryEvidence || !sameXmlSource(state.primaryDiscoverySource, primarySource)) {
      state.primaryDiscoveryEvidence = rawEvidence;
      state.primaryDiscoverySource = primarySource;
      state.zoneCatalog = discoverSupportReportZones(rawEvidence.rows || []);
      trimStaleZoneSelections(state);
      renderZoneSelector(popup, 'primary');
      renderZoneSelector(popup, 'secondary');
    }
    const clashEvidence = scopePrimaryEvidence(rawEvidence, popup, zoneScope);

    let primaryRelationshipInput = null;
    let primaryRelationshipBundle = null;
    const relationshipSource = xmlSource(popup, 'relationship');
    if (hasXmlSource(relationshipSource)) {
      runState.innerHTML = '<b>Building Support Report</b><span>Building scoped Primary Support relationship graph…</span>';
      const relationshipText = await sourceText(relationshipSource);
      if (controller.signal.aborted) return;
      primaryRelationshipInput = buildSupportPrimaryRelationshipInput(relationshipText, {
        zoneScope,
        parserOptions: supportReportRules(popup),
      });
      primaryRelationshipBundle = primaryRelationshipInput.bundle;
    }

    let report = buildSupportReportBundle({
      clashEvidence,
      relationshipBundle,
      primaryRelationshipBundle,
      orphanRecoveryConfig,
    });
    let referenceRelationshipInput = null;
    const referenceSource = xmlSource(popup, 'typical');
    if (hasXmlSource(referenceSource)) {
      runState.innerHTML = '<b>Building Support Report</b><span>Parsing typical-structure reference XML in a background worker…</span>';
      const referenceEvidence = assertSupportReportEvidenceReady(await parseSupportReportXmlAsync(referenceSource, {}, {
        signal: controller.signal,
        fallbackParser: parseSupportReportClashXml,
      }));
      if (controller.signal.aborted) return;

      let referencePrimaryRelationshipBundle = null;
      const referenceRelationshipSource = xmlSource(popup, 'referenceRelationship');
      if (hasXmlSource(referenceRelationshipSource)) {
        runState.innerHTML = '<b>Building Support Report</b><span>Building automatically scoped reference Primary Support relationship graph…</span>';
        const referenceRelationshipText = await sourceText(referenceRelationshipSource);
        if (controller.signal.aborted) return;
        referenceRelationshipInput = buildReferenceSupportPrimaryRelationshipInput(
          referenceRelationshipText,
          referenceEvidence,
          { parserOptions: supportReportRules(popup) },
        );
        referencePrimaryRelationshipBundle = referenceRelationshipInput.bundle;
      }

      const referenceReport = buildSupportReportBundle({
        clashEvidence: referenceEvidence,
        primaryRelationshipBundle: referencePrimaryRelationshipBundle,
        orphanRecoveryConfig,
      });
      const typicalityAudit = buildSupportReportTypicalityComparison(clashEvidence, referenceEvidence, {
        leftReportBundle: report,
        rightReportBundle: referenceReport,
        profile: readTypicalityProfile(popup),
      });
      report = projectTypicalityOntoSupportReportBundle(report, typicalityAudit, clashEvidence);
    }
    if (controller.signal.aborted) return;
    report = attachSupportPrimaryInputAudit(report, {
      zoneScope,
      zoneCatalog: state.zoneCatalog,
      zoneScopeSummary: clashEvidence.zoneScopeSummary,
      primaryRelationshipInput,
      referenceRelationshipInput,
    });
    state.report = report;
    host.innerHTML = renderSupportReportWorkspace(report);
    runState.innerHTML = renderReadyState(report);
    setExportEnabled(popup, true);
  } catch (error) {
    if (error?.name === 'AbortError') return;
    state.report = null;
    host.innerHTML = `<div class="ssrb-empty"><b>Support Report blocked</b><br>${h(error.message || error)}</div>`;
    runState.innerHTML = `<b>Build blocked</b><span>${h(error.message || error)}</span>`;
    setExportEnabled(popup, false);
  } finally {
    if (state.runAbort === controller) {
      state.runAbort = null;
      setBuildBusy(popup, false);
    }
  }
}

function relationshipInputAudit(relation, side) {
  if (!relation) return null;
  return Object.freeze({
    side,
    schema: relation.schema,
    scopeBasis: relation.scopeBasis || '',
    scopeAvailable: relation.scopeAvailable !== false,
    zoneScope: relation.zoneScope || null,
    zoneCatalog: relation.zoneCatalog || null,
    parsedRowCount: relation.parsedRowCount,
    scopedRowCount: relation.scopedRowCount,
    excludedByZoneCount: relation.excludedByZoneCount,
    parsedDiagnostics: relation.parsedDiagnostics,
    bundleSchema: relation.bundle?.schema || '',
    bundleSummary: relation.bundle?.summary || null,
  });
}

function attachSupportPrimaryInputAudit(report, input = {}) {
  return Object.freeze({
    ...report,
    zoneScope: input.zoneScope,
    zoneScopeSummary: input.zoneScopeSummary || null,
    zoneCatalog: Object.freeze({
      primaryZones: Object.freeze([...(input.zoneCatalog?.primaryZones || [])]),
      secondaryZones: Object.freeze([...(input.zoneCatalog?.secondaryZones || [])]),
    }),
    primaryRelationshipInput: relationshipInputAudit(input.primaryRelationshipInput, 'CURRENT'),
    referenceRelationshipInput: relationshipInputAudit(input.referenceRelationshipInput, 'REFERENCE'),
  });
}

function renderReadyState(report) {
  const summary = report?.summary || {};
  const trace = supportReportTraceSummary(report);
  const completeness = supportReportCompleteness(report);
  const metrics = `${summary.clashEvidenceCount || 0} clash rows → ${summary.reportRowCount || 0} report rows · ${summary.enrichedRowCount || 0} enriched · ${summary.multiplePrimarySupportRowCount || 0} multiple-primary-support rows`;
  const traceMetrics = `${trace.posClusterCount} POS clusters · ${trace.unresolvedPosClusterCount} unresolved POS · ${trace.unresolvedMemberMatchCount} unresolved member matches`;
  const scope = report?.zoneScope;
  const scopeMetrics = scope?.active
    ? ` · scoped zones: ${scope.primaryZoneIds.length} primary / ${scope.secondaryZoneIds.length} secondary`
    : ' · all zones';
  const rel = report?.primaryRelationshipInput;
  const relationshipMetrics = rel
    ? ` · current relationships: ${rel.scopedRowCount}/${rel.parsedRowCount} scoped row(s)`
    : ' · current relationships: geometry fallback';
  const referenceRel = report?.referenceRelationshipInput;
  const referenceRelationshipMetrics = referenceRel
    ? ` · reference relationships: ${referenceRel.scopedRowCount}/${referenceRel.parsedRowCount} scoped row(s)`
    : report?.typicalityAudit ? ' · reference relationships: unavailable' : '';
  const comparison = comparisonReadyText(report);
  if (!completeness.partial) return `<b>Support Report ready</b><span>${metrics} · ${traceMetrics}${scopeMetrics}${relationshipMetrics}${referenceRelationshipMetrics} · no XML-only rows remain${comparison}</span>`;
  return `<b>Support Report ready — partial enrichment</b><span>${metrics} · ${traceMetrics}${scopeMetrics}${relationshipMetrics}${referenceRelationshipMetrics} · ${completeness.xmlOnlyRowCount} XML-only row${completeness.xmlOnlyRowCount === 1 ? '' : 's'} remain${comparison}. Report CSV preserves the Owner contract; Trace CSV and Debug JSON expose the decision trail.</span>`;
}

function comparisonReadyText(report) {
  const audit = report?.typicalityAudit;
  if (!audit) return ' · legacy 21-column mode';
  const matches = audit.matches || [];
  const typical = matches.filter((item) => item.result === 'TYPICAL').length;
  const review = matches.filter((item) => item.result === 'REVIEW').length;
  const ambiguous = matches.filter((item) => item.result === 'AMBIGUOUS').length;
  const published = (report?.rows || []).filter((row) => row?.typicalityPublication?.status === 'PUBLISHED').length;
  const withheld = (report?.rows || []).filter((row) => row?.typicalityPublication?.status === 'WITHHELD').length;
  return ` · typicality: ${typical} typical, ${review} review, ${ambiguous} ambiguous · Column 22: ${published} published / ${withheld} withheld row(s) · comparison columns 22–24 enabled · profile ${audit.profileId || 'unknown'}`;
}

function readExistingRules(popup) {
  const values = {};
  popup.querySelectorAll('[data-ssrb-rule]').forEach((node) => {
    const key = node.dataset.ssrbRule;
    values[key] = node.type === 'checkbox' ? node.checked : node.type === 'number' ? Number(node.value) : node.value;
  });
  return values;
}
function readTypicalityProfile(popup) {
  const entries = [...popup.querySelectorAll('[data-ssr-typical-setting]')].map((node) => {
    const value = node.type === 'checkbox' ? node.checked : Number(node.value);
    if (node.type !== 'checkbox' && !Number.isFinite(value)) throw new Error(`Invalid typicality setting: ${node.dataset.ssrTypicalSetting}`);
    return { path: node.dataset.ssrTypicalSetting, value };
  });
  return profileOverrideFromEntries(entries);
}
function supportReportRules(popup) { return { ...readExistingRules(popup), supportFamilyPattern: SUPPORT_REPORT_FAMILY_PATTERN }; }

function clearImportedXml(popup, kind) {
  const state = stateByPopup.get(popup);
  if (state?.xmlFiles) state.xmlFiles[kind] = null;
}
function xmlSource(popup, kind) {
  const state = stateByPopup.get(popup);
  const file = state?.xmlFiles?.[kind];
  if (file) return file;
  const selectors = {
    primary: '[data-ssr-xml]',
    typical: '[data-ssr-typical-xml]',
    relationship: '[data-ssr-relationship-xml]',
    referenceRelationship: '[data-ssr-reference-relationship-xml]',
  };
  return popup.querySelector(selectors[kind])?.value || '';
}
function hasXmlSource(source) {
  if (typeof source === 'string') return Boolean(source.trim());
  return Boolean(source && typeof source.text === 'function' && Number(source.size) > 0);
}
function sameXmlSource(left, right) {
  if (left === right) return true;
  return typeof left === 'string' && typeof right === 'string' && left === right;
}
async function sourceText(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source.text === 'function') return source.text();
  return '';
}
function setBuildBusy(popup, busy) {
  const button = popup.querySelector('[data-ssr-build]');
  if (!button) return;
  button.disabled = Boolean(busy);
  button.setAttribute('aria-busy', String(Boolean(busy)));
}
function nextPaint() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(() => resolve());
    else globalThis.setTimeout(resolve, 0);
  });
}
function invalidate(popup, message) {
  const state = stateByPopup.get(popup);
  if (state) {
    state.runAbort?.abort();
    state.runAbort = null;
    state.report = null;
  }
  const runState = popup.querySelector('[data-ssr-run-state]');
  if (runState) runState.innerHTML = `<b>Inputs changed</b><span>${h(message)}</span>`;
  setBuildBusy(popup, false);
  setExportEnabled(popup, false);
}
function setExportEnabled(popup, enabled) {
  for (const node of popup.querySelectorAll('[data-ssr-copy], [data-ssr-download], [data-ssr-download-xlsx], [data-ssr-download-trace], [data-ssr-download-debug]')) {
    node.disabled = !enabled;
    node.setAttribute('aria-disabled', String(!enabled));
  }
}
async function copyCsv(popup) {
  const report = stateByPopup.get(popup)?.report;
  if (report) await globalThis.navigator?.clipboard?.writeText(reportCsv(report));
}
async function downloadXlsx(popup) {
  const report = stateByPopup.get(popup)?.report;
  if (!report) return;
  const runState = popup.querySelector('[data-ssr-run-state]');
  try {
    const bytes = await supportReportToXlsxBytes(report);
    downloadBlob(popup, supportReportExportFileName(report, 'xlsx'), bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (error) {
    if (runState) runState.innerHTML = `<b>XLSX export blocked</b><span>${h(error.message || error)}</span>`;
  }
}
function downloadCsv(popup) {
  const report = stateByPopup.get(popup)?.report;
  if (report) downloadBlob(popup, supportReportExportFileName(report, 'csv'), `\uFEFF${reportCsv(report)}`, 'text/csv;charset=utf-8');
}
function downloadTraceCsv(popup) {
  const report = stateByPopup.get(popup)?.report;
  if (report) downloadBlob(popup, supportReportTraceExportFileName(report), `\uFEFF${supportReportTraceToCsv(report)}`, 'text/csv;charset=utf-8');
}
function downloadDebugJson(popup) {
  const report = stateByPopup.get(popup)?.report;
  if (report) downloadBlob(popup, supportReportDebugExportFileName(report), supportReportDebugToJson(report), 'application/json;charset=utf-8');
}
function downloadBlob(popup, name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = popup.ownerDocument.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
function reportCsv(report) {
  return supportReportToCsv(report, { includeOrdinalRow: true, legacyBlankPrimarySupportHeader: true });
}
function showPanel(popup) {
  popup.querySelectorAll('[data-ssrb-panel]').forEach((panel) => { panel.hidden = panel.dataset.ssrbPanel !== TAB_KEY; });
  popup.querySelectorAll('[data-ssrb-tab]').forEach((button) => {
    const active = button.dataset.ssrbTab === TAB_KEY;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export const _test = Object.freeze({
  attachSupportPrimaryInputAudit,
  comparisonReadyText,
  hasXmlSource,
  infoIcon,
  readTypicalityProfile,
  referenceRelationshipSourceCard,
  relationshipInputAudit,
  renderPanel,
  renderReadyState,
  renderTypicalitySetting,
  sameXmlSource,
  typicalityConfigCard,
  zoneScopeCard,
});

installSupportReportAddon();