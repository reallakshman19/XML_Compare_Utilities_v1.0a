import { DEFAULT_NAVIS_TAG_ISONOTE_CONFIG, normalizeConfig } from './navis-tag-isonote-contracts.js';
import { buildSupportTableRecords, parseSupportTableText, rowsToCsv } from './navis-tag-table-source.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from './navis-tag-staged-tree.js';
import { refineStagedSupportIndex } from './navis-tag-index-refinement.js';
import { buildResolutionSupportRecords } from './navis-tag-resolution-source.js';
import { parseNavisTagXml } from './navis-tag-xml-parser.js';
import { attachNavisResolutionToIdentityTrace, buildIdentityNodeTrace } from './navis-tag-identity-trace.js';
import { resolveNavisTagIsonotes } from './navis-tag-proximity-engine.js';
import { buildNavisTagIsonoteReadiness } from './navis-tag-readiness.js';
import { buildFinalOutputRows, keywordMappingRows } from './navis-tag-final-output.js';
import { ensureNavisTagIsonoteStyle } from './navis-tag-isonote-ui-style.js';
import { ensureNavisTagWorkflowStyle, renderNavisTagWorkflowPane } from './navis-tag-isonote-ui-workflow.js';
import { renderNavisTagIsonotePane } from './navis-tag-isonote-ui-view.js';
import { renderNavisTagIsonoteEvidencePane } from './navis-tag-isonote-ui-evidence.js';
import { downloadNavisTagFile, readNavisTagStagedFile, readNavisTagTableFile } from './navis-tag-isonote-ui-io.js';

const POPUP_TITLE_ID = 'navis-tag-isonote-title';
const CONFIG_STORE = 'navisTagIsonote.config.v4';
const SESSION_STORE = 'navisTagIsonote.session.v1';
const STAGED_STORE = 'navisTagIsonote.staged.v1';
const MAX_SOURCE_TEXT_CHARS = 900000;
const MAX_SESSION_CHARS = 3600000;
const ACTIVATE = 'click';

function storage() { return globalThis.localStorage; }
function readConfig() {
  try { return normalizeConfig(JSON.parse(storage()?.getItem(CONFIG_STORE) || '{}')); }
  catch { return normalizeConfig(DEFAULT_NAVIS_TAG_ISONOTE_CONFIG); }
}
function saveConfig(config) {
  try { storage()?.setItem(CONFIG_STORE, JSON.stringify(config)); } catch {}
}
function readSession() {
  try {
    const value = JSON.parse(storage()?.getItem(SESSION_STORE) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
function readStoredStagedDocuments(legacyDocuments = []) {
  try {
    const serialized = storage()?.getItem(STAGED_STORE) || '';
    if (serialized) {
      const documents = JSON.parse(serialized);
      if (Array.isArray(documents)) return { documents, source: 'DEDICATED_STORE', serializedSize: serialized.length };
    }
  } catch {}
  const documents = Array.isArray(legacyDocuments) ? legacyDocuments : [];
  let serializedSize = 0;
  try { serializedSize = documents.length ? JSON.stringify(documents).length : 0; } catch {}
  return { documents, source: documents.length ? 'LEGACY_SESSION' : 'NONE', serializedSize };
}
function saveStagedDocuments(state) {
  if (!state.stagedStorageDirty) return state.stagedStorageMeta || { stored: Boolean(state.stagedDocuments?.length), count: state.stagedDocuments?.length || 0, serializedSize: 0 };
  const documents = Array.isArray(state.stagedDocuments) ? state.stagedDocuments : [];
  if (!documents.length) {
    try { storage()?.removeItem(STAGED_STORE); } catch {}
    state.stagedStorageDirty = false;
    state.stagedStorageMeta = { stored: false, count: 0, serializedSize: 0, savedAt: new Date().toISOString() };
    return state.stagedStorageMeta;
  }
  let serialized = '';
  try {
    serialized = JSON.stringify(documents);
    storage()?.setItem(STAGED_STORE, serialized);
    state.stagedStorageDirty = false;
    state.stagedStorageMeta = { stored: true, count: documents.length, serializedSize: serialized.length, savedAt: new Date().toISOString() };
  } catch (error) {
    try { storage()?.removeItem(STAGED_STORE); } catch {}
    state.stagedStorageMeta = {
      stored: false,
      count: documents.length,
      serializedSize: serialized.length,
      storageError: true,
      message: `Staged JSON could not be retained in browser storage: ${error?.message || error || 'storage quota exceeded'}`,
    };
  }
  return state.stagedStorageMeta;
}
function compactTableImport(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    ...value,
    candidates: Array.isArray(value.candidates) ? value.candidates.slice(0, 25) : [],
    diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics.slice(0, 100) : [],
  };
}
function sourceSnapshot(state, stagedMeta = state.stagedStorageMeta || {}) {
  const omitted = {};
  const tableText = String(state.tableText || '');
  const navisText = String(state.navisText || '');
  if (stagedMeta.storageError) omitted.staged = stagedMeta.message || 'Staged documents could not be retained and must be reloaded.';
  if (tableText.length > MAX_SOURCE_TEXT_CHARS) omitted.table = `Support table exceeded ${MAX_SOURCE_TEXT_CHARS} characters and must be reloaded.`;
  if (navisText.length > MAX_SOURCE_TEXT_CHARS) omitted.navis = `Navis XML exceeded ${MAX_SOURCE_TEXT_CHARS} characters and must be reloaded.`;
  const payload = {
    version: 2,
    savedAt: new Date().toISOString(),
    tableText: omitted.table ? '' : tableText,
    navisText: omitted.navis ? '' : navisText,
    tableImport: compactTableImport(state.tableImport),
    sourceNames: { ...(state.sourceNames || {}) },
    sourceTypes: { ...(state.sourceTypes || {}) },
    omitted,
    stagedDocumentCount: Number(stagedMeta.count ?? state.stagedDocuments?.length ?? 0),
    stagedSize: Number(stagedMeta.serializedSize || 0),
    stagedStored: Boolean(stagedMeta.stored),
  };
  let serialized = JSON.stringify(payload);
  if (serialized.length > MAX_SESSION_CHARS && payload.navisText) {
    payload.navisText = '';
    payload.omitted.navis = `Session exceeded ${MAX_SESSION_CHARS} characters; Navis XML must be reloaded.`;
    serialized = JSON.stringify(payload);
  }
  if (serialized.length > MAX_SESSION_CHARS && payload.tableText) {
    payload.tableText = '';
    payload.omitted.table = `Session exceeded ${MAX_SESSION_CHARS} characters; support table must be reloaded.`;
    serialized = JSON.stringify(payload);
  }
  return { payload, serialized };
}
function saveSession(state) {
  try {
    const stagedMeta = saveStagedDocuments(state);
    const snapshot = sourceSnapshot(state, stagedMeta);
    storage()?.setItem(SESSION_STORE, snapshot.serialized);
    state.sessionMeta = { restoredAt: snapshot.payload.savedAt, omitted: snapshot.payload.omitted, staged: stagedMeta };
  } catch {
    state.sessionMeta = { ...(state.sessionMeta || {}), storageError: true };
  }
}
function clearSessionStorage() {
  try {
    storage()?.removeItem(SESSION_STORE);
    storage()?.removeItem(STAGED_STORE);
  } catch {}
}
function configSignature(config) { return JSON.stringify(normalizeConfig(config || {})); }
function markInputsDirty(state) { state.inputsDirty = true; state.audit = null; }
function hasRestoredSources(session, stagedDocuments = []) {
  return Boolean(session.tableText || session.navisText || stagedDocuments.length || Object.values(session.sourceNames || {}).some(Boolean));
}
function createState() {
  const session = readSession();
  const stagedRestore = readStoredStagedDocuments(session.stagedDocuments);
  const restored = hasRestoredSources(session, stagedRestore.documents);
  const state = {
    config: readConfig(),
    activeTab: 'inputs',
    tableText: String(session.tableText || ''),
    tableImport: session.tableImport || null,
    navisText: String(session.navisText || ''),
    stagedDocuments: stagedRestore.documents,
    stagedStorageDirty: stagedRestore.source === 'LEGACY_SESSION',
    stagedStorageMeta: {
      stored: stagedRestore.source === 'DEDICATED_STORE',
      count: stagedRestore.documents.length,
      serializedSize: stagedRestore.serializedSize,
      restoredFrom: stagedRestore.source,
    },
    sourceNames: { table: '', navis: '', staged: '', ...(session.sourceNames || {}) },
    sourceTypes: { table: '', navis: '', staged: '', ...(session.sourceTypes || {}) },
    sessionMeta: { restoredAt: session.savedAt || '', omitted: session.omitted || {}, staged: { restoredFrom: stagedRestore.source } },
    tableParsed: null,
    tableBuild: null,
    resolutionBuild: null,
    tree: null,
    rawStagedIndex: null,
    stagedIndex: null,
    identityTrace: null,
    navisParse: null,
    readiness: null,
    audit: null,
    inputsDirty: true,
    status: restored
      ? 'Previous source names, types, anchor configuration and restorable source values were loaded from browser storage.'
      : 'Load Navis Tag XML and managed staged JSON/ZIP. The support table is optional unless table-only mode is selected.',
    running: false,
  };
  if (state.tableText || state.navisText || state.stagedDocuments.length) {
    try { buildAll(state); } catch {}
  }
  return state;
}
function collectConfig(root, state) {
  const previousConfigSignature = configSignature(state.config);
  const next = { ...state.config };
  root.querySelectorAll('[data-nti-config]').forEach((input) => {
    const key = input.dataset.ntiConfig;
    if (input.type === 'number') next[key] = Number(input.value);
    else if (input.type === 'checkbox') next[key] = input.checked;
    else next[key] = input.value;
  });
  root.querySelectorAll('[data-nti-path-select]').forEach((select) => {
    next[select.dataset.ntiPathSelect] = [...select.selectedOptions].map((option) => option.value).filter(Boolean);
  });
  const keywordRows = [...root.querySelectorAll('[data-nti-keyword-row]')];
  if (keywordRows.length) {
    next.isonoteKeywordMappings = keywordRows.map((row) => ({
      key: row.querySelector('[data-nti-keyword-key]')?.value || '',
      value: row.querySelector('[data-nti-keyword-value]')?.value || '',
    }));
  }
  state.config = normalizeConfig(next);
  if (configSignature(state.config) !== previousConfigSignature) {
    markInputsDirty(state);
    saveConfig(state.config);
  }
  const table = root.querySelector('[data-nti-field="tableText"]');
  const navis = root.querySelector('[data-nti-field="navisText"]');
  if (table) {
    const nextText = table.value;
    if (nextText !== state.tableText) {
      state.tableImport = {
        kind: 'manual', fileName: '', sheetCount: 0, selectedSheetName: '', selectedSheetIndex: -1,
        headerRowNumber: nextText ? 1 : 0, candidateDataRowCount: Math.max(0, nextText.split(/\r?\n/).filter((line) => line.trim()).length - 1),
        identityValueCount: 0, selectionMode: 'MANUAL_TEXT', candidates: [], diagnostics: [],
      };
      state.sourceNames.table = nextText ? 'Pasted / edited table' : '';
      state.sourceTypes.table = nextText ? 'MANUAL_TEXT' : '';
      markInputsDirty(state);
    }
    state.tableText = nextText;
  }
  if (navis) {
    const nextText = navis.value;
    if (nextText !== state.navisText) {
      state.sourceNames.navis = nextText ? 'Pasted / edited Navis XML' : '';
      state.sourceTypes.navis = nextText ? 'MANUAL_XML' : '';
      markInputsDirty(state);
    }
    state.navisText = nextText;
  }
}
function emptyTableBuild(config) {
  return {
    config,
    headers: [],
    records: [],
    diagnostics: [],
    summary: { rowCount: 0, identityCount: 0, referenceCount: 0, positionedRowCount: 0, pipeCount: 0 },
  };
}
function buildAll(state) {
  if (state.tableText.trim()) {
    state.tableParsed = parseSupportTableText(state.tableText);
    state.tableBuild = buildSupportTableRecords(state.tableParsed, state.config);
  } else {
    state.tableParsed = { delimiter: '\t', headers: [], rows: [], diagnostics: [] };
    state.tableBuild = emptyTableBuild(state.config);
  }
  if (state.tableImport?.diagnostics?.length) state.tableBuild.diagnostics.unshift(...state.tableImport.diagnostics);
  state.tree = buildStagedJsonHierarchy(state.stagedDocuments, state.config);
  state.rawStagedIndex = buildStagedSupportIndex(state.tree, state.config);
  state.stagedIndex = refineStagedSupportIndex(state.rawStagedIndex, state.tree, state.config);
  state.resolutionBuild = buildResolutionSupportRecords(state.tableBuild, state.stagedIndex, state.config);
  state.identityTrace = buildIdentityNodeTrace(state.resolutionBuild.records, state.stagedIndex, state.config);
  state.navisParse = parseNavisTagXml(state.navisText, state.config, state.identityTrace);
  state.readiness = buildNavisTagIsonoteReadiness({
    config: state.config,
    tableBuild: state.tableBuild,
    resolutionBuild: state.resolutionBuild,
    tableImport: state.tableImport,
    tree: state.tree,
    stagedIndex: state.stagedIndex,
    identityTrace: state.identityTrace,
    navisParse: state.navisParse,
    hasSourceText: Boolean(state.tableText || state.navisText || state.stagedDocuments.length),
  });
  state.audit = null;
  state.inputsDirty = false;
  const suppressed = (state.stagedIndex.summary.suppressedMirrorEntryCount || 0) + (state.stagedIndex.summary.suppressedDuplicateEntryCount || 0);
  const sheet = state.tableImport?.selectedSheetName ? ` from worksheet "${state.tableImport.selectedSheetName}"` : '';
  const resolutionSource = state.resolutionBuild.sourceKind === 'STAGED_JSON' ? 'staged JSON' : `support table${sheet}`;
  state.status = `${state.readiness.status}: Stage 1 has ${state.resolutionBuild.summary.rowCount} JSON resolution rows from ${resolutionSource}; Stage 2 has ${state.navisParse.summary.validTagCount} valid Navis tags; ${state.tree.summary.nodeCount} JSON nodes and ${state.stagedIndex.summary.indexedNodeCount} refined identity entries (${suppressed} mirrors/duplicates suppressed).`;
}
function needsRebuild(state) {
  return Boolean(state.inputsDirty || !state.identityTrace || !state.navisParse || !state.readiness || !state.resolutionBuild);
}
function runResolution(state) {
  if (needsRebuild(state)) buildAll(state);
  if (!state.readiness.canResolve) {
    const details = state.readiness.blockers.map((item) => `${item.code}: ${item.message}`).join(' | ') || 'readiness failed';
    throw new Error(`Resolution blocked. ${details}`);
  }
  state.audit = resolveNavisTagIsonotes(state.resolutionBuild, state.identityTrace, state.navisParse, state.config);
  state.audit.finalRows = buildFinalOutputRows(state.audit, state.config);
  state.audit.summary = { ...(state.audit.summary || {}), finalOutputCount: state.audit.finalRows.length };
  state.identityTrace = attachNavisResolutionToIdentityTrace(state.identityTrace, state.audit);
  const source = state.resolutionBuild.sourceKind === 'STAGED_JSON' ? 'staged JSON coordinate groups' : 'support-table rows';
  state.status = `Stage 3 complete: ${state.audit.summary.resolvedCount} direct JSON ↔ Navis matches, ${state.audit.summary.propagatedTargetRowCount || 0} propagated target rows, and ${state.audit.finalRows.length} final output rows across ${state.identityTrace.summary.rowCount} ${source}.`;
}
function resetRememberedSources(state) {
  clearSessionStorage();
  state.activeTab = 'inputs';
  state.tableText = '';
  state.tableImport = null;
  state.navisText = '';
  state.stagedDocuments = [];
  state.stagedStorageDirty = false;
  state.stagedStorageMeta = { stored: false, count: 0, serializedSize: 0 };
  state.sourceNames = { table: '', navis: '', staged: '' };
  state.sourceTypes = { table: '', navis: '', staged: '' };
  state.sessionMeta = { restoredAt: '', omitted: {} };
  state.tableParsed = null;
  state.tableBuild = null;
  state.resolutionBuild = null;
  state.tree = null;
  state.rawStagedIndex = null;
  state.stagedIndex = null;
  state.identityTrace = null;
  state.navisParse = null;
  state.readiness = null;
  state.audit = null;
  state.inputsDirty = true;
  state.status = 'Remembered source values were cleared from this browser. Configuration was retained.';
}
function tabDataState(state, id) {
  const has = {
    hierarchy: Boolean(state.identityTrace?.rows?.length),
    identity: Boolean(state.navisParse?.tags?.length),
    candidates: Boolean(state.audit || state.identityTrace?.rows?.length),
    augmented: Boolean(state.audit?.finalRows?.length),
    diagnostics: Boolean(state.tableBuild?.diagnostics?.length || state.resolutionBuild?.diagnostics?.length || state.identityTrace?.diagnostics?.length || state.navisParse?.diagnostics?.length || state.audit?.diagnostics?.length),
  }[id];
  return has ? (id === 'diagnostics' ? 'has-warning' : 'has-data') : '';
}
function bindFilters(root) {
  root.querySelectorAll('[data-nti-table-filter]').forEach((input) => input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    root.querySelectorAll(`.nti-filter-table-${input.dataset.ntiTableFilter} tbody tr`).forEach((row) => row.classList.toggle('is-filtered', Boolean(query && !row.textContent.toLowerCase().includes(query))));
  }));
  root.querySelectorAll('[data-nti-filter-target]').forEach((input) => input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    root.querySelectorAll(input.dataset.ntiFilterTarget).forEach((node) => node.classList.toggle('is-filtered', Boolean(query && !node.textContent.toLowerCase().includes(query))));
  }));
  root.querySelectorAll('[data-nti-copy-filtered]').forEach((btn) => btn.addEventListener('click', async () => {
    const filterId = btn.dataset.ntiCopyFiltered;
    const table = root.querySelector(`.nti-filter-table-${filterId}`);
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim().replace(/\s+/g, ' '));
    const visibleRows = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('is-filtered') && tr.style.display !== 'none');
    const lines = [headers.join('\t')];
    for (const tr of visibleRows) {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim().replace(/\s+/g, ' '));
      if (cells.length) lines.push(cells.join('\t'));
    }
    const text = lines.join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const orig = btn.innerHTML;
      btn.innerHTML = `<span aria-hidden="true">✓</span><span>Copied (${visibleRows.length})</span>`;
      btn.style.borderColor = 'var(--ok-color, #28a745)';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.borderColor = '';
      }, 2000);
    } catch {
      btn.innerHTML = `<span aria-hidden="true">!</span><span>Copy failed</span>`;
      setTimeout(() => { btn.innerHTML = `<span aria-hidden="true">📋</span><span>Copy filtered</span>`; }, 2000);
    }
  }));
}
function downloadAudit(state) {
  const replacer = (key, value) => {
    if (['selectedEntry', 'tableRecord', 'node', 'raw', 'byId', 'byIdentity', 'byRoot'].includes(key)) return undefined;
    if (value instanceof Map) return [...value.entries()];
    return value;
  };
  downloadNavisTagFile('navis-tag-support-isonote-audit.json', JSON.stringify({
    audit: state.audit,
    readiness: state.readiness,
    tableImport: state.tableImport,
    resolutionSource: state.resolutionBuild?.sourceKind || '',
    hierarchySummary: state.tree?.summary,
    rawIndexSummary: state.rawStagedIndex?.summary,
    refinedIndexSummary: state.stagedIndex?.summary,
    pathCatalogue: state.tree?.pathCatalogue,
    pathRecommendations: state.tree?.pathRecommendations,
    identityTrace: state.identityTrace,
    navisSummary: state.navisParse?.summary,
    navisTags: state.navisParse?.tags,
    sourceNames: state.sourceNames,
    sourceTypes: state.sourceTypes,
    sessionMeta: state.sessionMeta,
  }, replacer, 2), 'application/json');
}
function render(root, state) {
  const tabs = [
    ['inputs','Home'],
    ['config','Config'],
    ['hierarchy','1. JSON Trace'],
    ['identity','2. Navis Tag Coordinates'],
    ['candidates','3. Tag ↔ JSON Match'],
    ['augmented','Final Output / Export Results'],
    ['diagnostics','Diagnostics'],
  ];
  const pane = renderNavisTagWorkflowPane(state) ?? renderNavisTagIsonoteEvidencePane(state) ?? renderNavisTagIsonotePane(state);
  root.innerHTML = `<div class="nti-tabs">${tabs.map(([id, label]) => `<button class="nti-tab ${state.activeTab === id ? 'is-active' : ''} ${tabDataState(state, id)}" data-nti-tab="${id}">${label}</button>`).join('')}</div><div class="nti-body">${pane}</div>`;
  root.querySelectorAll('[data-nti-config="navisAnchorTagId"], [data-nti-config="navisAnchorSupportIdentity"]').forEach((input) => input.addEventListener('change', () => {
    collectConfig(root, state);
    saveSession(state);
    state.status = 'Anchor selection saved in browser storage. Build or Run to refresh the coordinate transformation.';
    render(root, state);
  }));
  root.querySelectorAll('[data-nti-tab]').forEach((button) => button.addEventListener(ACTIVATE, () => {
    collectConfig(root, state);
    saveSession(state);
    state.activeTab = button.dataset.ntiTab;
    render(root, state);
  }));
  root.querySelector('[data-nti-action="open-config"]')?.addEventListener(ACTIVATE, () => { collectConfig(root, state); saveSession(state); state.activeTab = 'config'; render(root, state); });
  root.querySelector('[data-nti-action="open-final"]')?.addEventListener(ACTIVATE, () => { collectConfig(root, state); saveSession(state); state.activeTab = 'augmented'; render(root, state); });
  root.querySelector('[data-nti-action="save-config"]')?.addEventListener(ACTIVATE, () => {
    collectConfig(root, state);
    saveConfig(state.config);
    saveSession(state);
    state.status = state.inputsDirty ? 'Configuration saved. Derived coordinates are stale; Build or Run will refresh them.' : 'Configuration saved.';
    render(root, state);
  });
  root.querySelector('[data-nti-action="reset-config"]')?.addEventListener(ACTIVATE, () => {
    state.config = normalizeConfig(DEFAULT_NAVIS_TAG_ISONOTE_CONFIG);
    markInputsDirty(state);
    saveConfig(state.config);
    state.status = 'Configuration reset to defaults. Build or Run to refresh evidence.';
    render(root, state);
  });
  root.querySelector('[data-nti-action="add-keyword"]')?.addEventListener(ACTIVATE, () => {
    collectConfig(root, state);
    state.config = normalizeConfig({
      ...state.config,
      isonoteKeywordMappings: [...keywordMappingRows(state.config), { key: '', value: '' }],
    });
    markInputsDirty(state);
    render(root, state);
  });
  root.querySelectorAll('[data-nti-action="remove-keyword"]').forEach((button) => button.addEventListener(ACTIVATE, () => {
    collectConfig(root, state);
    const rows = keywordMappingRows(state.config);
    rows.splice(Number(button.dataset.ntiKeywordIndex), 1);
    state.config = normalizeConfig({ ...state.config, isonoteKeywordMappings: rows });
    markInputsDirty(state);
    render(root, state);
  }));
  root.querySelectorAll('[data-nti-action="clear-session"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => { resetRememberedSources(state); render(root, state); }));
  root.querySelectorAll('[data-nti-action="build"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => {
    try {
      collectConfig(root, state);
      buildAll(state);
      saveSession(state);
      state.activeTab = 'hierarchy';
    } catch (error) {
      state.status = error?.message || String(error);
    }
    render(root, state);
  }));
  root.querySelectorAll('[data-nti-action="run"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => {
    try {
      collectConfig(root, state);
      runResolution(state);
      saveSession(state);
      state.activeTab = 'candidates';
    } catch (error) {
      state.status = error?.message || String(error);
      state.activeTab = 'inputs';
    }
    render(root, state);
  }));
  root.querySelectorAll('[data-nti-action="download-final-csv"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadNavisTagFile('navis-tag-final-isonote.csv', rowsToCsv(state.audit?.finalRows || []), 'text/csv')));
  root.querySelectorAll('[data-nti-action="download-csv"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadNavisTagFile('navis-tag-support-isonote-audit.csv', rowsToCsv(state.audit?.augmentedRows || []), 'text/csv')));
  root.querySelectorAll('[data-nti-action="download-trace"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadNavisTagFile('navis-tag-end-to-end-identity-trace.csv', rowsToCsv(state.identityTrace?.rows || []), 'text/csv')));
  root.querySelectorAll('[data-nti-action="download-audit"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadAudit(state)));
  root.querySelectorAll('[data-nti-action="download-ambiguous"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadNavisTagFile('navis-tag-support-isonote-ambiguous.csv', rowsToCsv(state.audit?.ambiguousRows || []), 'text/csv')));
  root.querySelectorAll('[data-nti-action="download-rejected"]').forEach((btn) => btn.addEventListener(ACTIVATE, () => downloadNavisTagFile('navis-tag-support-isonote-rejected.csv', rowsToCsv(state.audit?.rejectedRows || []), 'text/csv')));
  root.querySelectorAll('[data-nti-file]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    state.status = `Loading ${file.name}...`;
    render(root, state);
    try {
      if (input.dataset.ntiFile === 'table') {
        const imported = await readNavisTagTableFile(file, {
          returnMetadata: true,
          identityColumns: state.config.tableIdentityColumns,
          referenceColumns: state.config.tableReferenceColumns,
          pipeColumns: state.config.tablePipeColumns,
          positionColumn: state.config.tablePositionColumn,
        });
        state.tableText = imported.text;
        state.tableImport = imported.meta;
        const sheet = imported.meta.selectedSheetName ? ` › ${imported.meta.selectedSheetName}` : '';
        state.sourceNames.table = `${file.name}${sheet}`;
        state.sourceTypes.table = String(imported.meta.kind || file.name.split('.').pop() || 'TABLE').toUpperCase();
        markInputsDirty(state);
        state.status = imported.meta.kind === 'workbook'
          ? `${file.name}: selected worksheet "${imported.meta.selectedSheetName || '(none)'}"; header row ${imported.meta.headerRowNumber || 0}; ${imported.meta.candidateDataRowCount || 0} candidate data rows.`
          : `${file.name} loaded. Build evidence to refresh the workflow.`;
      }
      if (input.dataset.ntiFile === 'navis') {
        state.navisText = await file.text();
        state.sourceNames.navis = file.name;
        state.sourceTypes.navis = file.type || 'XML';
        markInputsDirty(state);
        state.status = `${file.name} loaded. Build evidence to inspect Tag coordinate transformations.`;
      }
      if (input.dataset.ntiFile === 'staged') {
        state.stagedDocuments = await readNavisTagStagedFile(file);
        state.stagedStorageDirty = true;
        state.sourceNames.staged = file.name;
        state.sourceTypes.staged = `${file.name.toLowerCase().endsWith('.zip') ? 'ZIP' : 'JSON'} · ${state.stagedDocuments.length} document(s)`;
        markInputsDirty(state);
        state.status = `${file.name} loaded and queued for browser-storage persistence. Build evidence to create the JSON trace.`;
      }
      try {
        if (state.tableText || state.navisText || state.stagedDocuments.length) {
          buildAll(state);
        }
      } catch {}
      saveSession(state);
      if (state.stagedStorageMeta?.storageError) state.status += ` ${state.stagedStorageMeta.message}`;
    } catch (error) {
      state.status = `Load failed: ${error?.message || error}`;
    }
    render(root, state);
  }));
  bindFilters(root);
}
export function renderNavisTagIsonoteTab(container) {
  const doc = container?.ownerDocument || document;
  ensureNavisTagIsonoteStyle(doc);
  ensureNavisTagWorkflowStyle(doc);
  const state = createState();
  render(container, state);
  return () => { container.innerHTML = ''; };
}
function renderLauncher() {
  return `<button type="button" class="psmap-card psmap-tile nti-launcher" data-nti-open="1" title="Open Navis Tag to ISONOTE"><span class="nti-launcher-icon" aria-hidden="true">TAG→ISO</span><b>Navis Tag to ISONOTE</b><span>Resolve direct Tags, propagate pipe instructions, and export final support notes</span></button>`;
}
function mountPopup(root, onClose) {
  const doc = root?.ownerDocument || document;
  ensureNavisTagIsonoteStyle(doc);
  ensureNavisTagWorkflowStyle(doc);
  const modal = document.createElement('div');
  modal.className = 'nti-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'psmap-card nti-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', POPUP_TITLE_ID);
  dialog.innerHTML = `<div class="nti-head"><div><b id="${POPUP_TITLE_ID}">Navis Tag to ISONOTE</b><span>Load evidence → configure coordinate frames → resolve Tags → export final support notes.</span></div><button class="nti-close" data-nti-close="1">Close</button></div><div data-nti-host style="display:contents"></div>`;
  modal.appendChild(dialog);
  (document.body || root).appendChild(modal);
  renderNavisTagIsonoteTab(dialog.querySelector('[data-nti-host]'));
  modal.addEventListener(ACTIVATE, (event) => {
    if (event.target === modal || event.target.closest?.('[data-nti-close="1"]')) {
      modal.remove();
      onClose();
    }
  });
  return modal;
}
export function installNavisTagIsonoteUtilityTile(container) {
  ensureNavisTagIsonoteStyle(container?.ownerDocument || document);
  ensureNavisTagWorkflowStyle(container?.ownerDocument || document);
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-nti-launcher]')) return null;
  const launcher = document.createElement('section');
  launcher.dataset.ntiLauncher = '1';
  launcher.innerHTML = renderLauncher();
  utilitiesRoot.appendChild(launcher);
  let popup = null;
  launcher.querySelector('[data-nti-open="1"]').addEventListener(ACTIVATE, () => {
    if (!popup) popup = mountPopup(utilitiesRoot, () => { popup = null; });
  });
  return () => { popup?.remove(); launcher.remove(); };
}
export const _test = Object.freeze({
  renderLauncher,
  createState,
  buildAll,
  runResolution,
  tabDataState,
  configSignature,
  markInputsDirty,
  needsRebuild,
  readSession,
  readStoredStagedDocuments,
  saveSession,
  saveStagedDocuments,
  sourceSnapshot,
  resetRememberedSources,
});
