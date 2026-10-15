import { previewPipingClassExtraction } from './XmlCompareEnrichmentApply.js';

export const XML_COMPARE_ENRICHMENT_CONFIG_SCHEMA = 'xml-compare-enrichment-config/v4-state-storage';
export const ENRICHMENT_CONFIG_SCHEMA = XML_COMPARE_ENRICHMENT_CONFIG_SCHEMA;
export const XML_COMPARE_ENRICHMENT_STORAGE_KEY = 'xml-compare-enrichment-config';
export const XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY = 'xmlCompare.enrichmentConfig.v1';

const COMP_TYPES = ['ATTA', 'ELBO', 'BRAN', 'OLET', 'RIGID', 'TEE', 'PIPE'];
const DASH = '—';
const DEFAULT_DTXR_TYPE_MAP_TEXT = [
  'TYPE\tKIND\tDTXR_POS', '0\tANCHOR\tANCHOR', '3\tREST\tPIPE SUPPORT',
  '5\tREST\tPIPE SUPPORT', '7\tGUIDE\tGUIDE', '10\tGUIDE\tGUIDE',
  '17\tREST\tPIPE SUPPORT',
].join('\n');
const DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS = Object.freeze([
  Object.freeze({ label: '+Y', from: '17', to: '14' }),
  Object.freeze({ label: 'LIM', from: '7', to: '8' }),
  Object.freeze({ label: 'GUI', from: '10', to: '9' }),
  Object.freeze({ label: 'X', from: '1', to: '2' }),
  Object.freeze({ label: 'Y', from: '2', to: '3' }),
  Object.freeze({ label: 'Z', from: '3', to: '5' }),
  Object.freeze({ label: '', from: '18', to: '15' }),
]);
const DEFAULT_PIPING_CLASS = Object.freeze({
  enabled: true, regex: '([0-9]{5})', group: '1', tokenPosition: '4',
  tokenDelimiter: '-', previewSide: 'source', previewLineId: '', applyToAllConfirmed: false,
});
export const DEFAULT_ENRICHMENT_CONFIG = Object.freeze({
  pipingClass: DEFAULT_PIPING_CLASS,
  rating: Object.freeze({ enabled: true, method: 'table', tableText: '', fixedValue: '' }),
  componentType: Object.freeze({ enabled: true, bendType: 'ELBO', sifType: 'BRAN', rigidType: 'ATTA', defaultType: 'ATTA' }),
  position: Object.freeze({ enabled: false, startX: '', startY: '', startZ: '' }),
  dtxr: Object.freeze({ enabled: true, typeMapText: DEFAULT_DTXR_TYPE_MAP_TEXT }),
  pointPropertiesBasis: Object.freeze({ enabled: true, value: 'TO' }),
  restraintTypeConvert: Object.freeze({ enabled: false, rows: DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS }),
});
const ENR_TABS = Object.freeze([
  { key: 'restraint', label: 'Restraint Types', icon: '⇄', sectionKeys: ['restraintTypeConvert'] },
  { key: 'class', label: 'Classification', icon: '⊞', sectionKeys: ['pipingClass', 'rating'] },
  { key: 'component', label: 'Component', icon: '⬡', sectionKeys: ['componentType', 'dtxr'] },
  { key: 'geometry', label: 'Geometry', icon: '⊕', sectionKeys: ['position', 'pointPropertiesBasis'] },
]);

const clean = (value) => String(value ?? '').trim();
const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const info = (text) => `<span class="enr-info" title="${esc(text)}">(i)</span>`;
const dash = (value) => clean(value) || DASH;
const blankRtcRow = () => ({ label: '', from: '', to: '' });

export function normalizeRestraintRows(rows, fallback = DEFAULT_RESTRAINT_TYPE_CONVERT_ROWS) {
  const source = Array.isArray(rows) ? rows : fallback;
  return source.map((r) => ({ label: String(r?.label ?? ''), from: String(r?.from ?? ''), to: String(r?.to ?? '') }));
}
export function createEnrichmentConfig(overrides = {}) {
  return {
    open: Boolean(overrides.open), activeEnrTab: overrides.activeEnrTab || 'restraint',
    pipingClass: { ...DEFAULT_ENRICHMENT_CONFIG.pipingClass, ...(overrides.pipingClass || {}) },
    rating: { ...DEFAULT_ENRICHMENT_CONFIG.rating, ...(overrides.rating || {}) },
    componentType: { ...DEFAULT_ENRICHMENT_CONFIG.componentType, ...(overrides.componentType || {}) },
    position: { ...DEFAULT_ENRICHMENT_CONFIG.position, ...(overrides.position || {}) },
    dtxr: { ...DEFAULT_ENRICHMENT_CONFIG.dtxr, ...(overrides.dtxr || {}) },
    pointPropertiesBasis: { ...DEFAULT_ENRICHMENT_CONFIG.pointPropertiesBasis, ...(overrides.pointPropertiesBasis || {}) },
    restraintTypeConvert: {
      ...DEFAULT_ENRICHMENT_CONFIG.restraintTypeConvert,
      ...(overrides.restraintTypeConvert || {}),
      rows: normalizeRestraintRows(overrides.restraintTypeConvert?.rows),
    },
  };
}
export function updateRestraintTypeRow(config, index, col, value) {
  if (!['label', 'from', 'to'].includes(col)) return createEnrichmentConfig(config);
  const rows = normalizeRestraintRows(config?.restraintTypeConvert?.rows, []);
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return createEnrichmentConfig(config);
  rows[index] = { ...rows[index], [col]: String(value ?? '') };
  return { ...createEnrichmentConfig(config), restraintTypeConvert: { ...createEnrichmentConfig(config).restraintTypeConvert, rows } };
}
export function addRestraintTypeRow(config) {
  const cfg = createEnrichmentConfig(config);
  return { ...cfg, restraintTypeConvert: { ...cfg.restraintTypeConvert, rows: [...normalizeRestraintRows(cfg.restraintTypeConvert.rows, []), blankRtcRow()] } };
}
export function deleteRestraintTypeRow(config, index) {
  const cfg = createEnrichmentConfig(config);
  const rows = normalizeRestraintRows(cfg.restraintTypeConvert.rows, []);
  const next = Number.isInteger(index) && index >= 0 && index < rows.length ? rows.filter((_, i) => i !== index) : rows;
  return { ...cfg, restraintTypeConvert: { ...cfg.restraintTypeConvert, rows: next } };
}
export function serializableEnrichmentConfig(config) {
  const { open: _open, activeEnrTab: _activeEnrTab, ...rest } = createEnrichmentConfig(config);
  return rest;
}

function storageRef(storage) { return storage || (typeof localStorage !== 'undefined' ? localStorage : null); }
function parseStoredConfig(raw) { return createEnrichmentConfig(JSON.parse(raw)); }
export function loadEnrichmentFromStorage(storage) {
  const store = storageRef(storage);
  if (!store?.getItem) return createEnrichmentConfig();
  const canonical = store.getItem(XML_COMPARE_ENRICHMENT_STORAGE_KEY);
  if (canonical) { try { return parseStoredConfig(canonical); } catch { return createEnrichmentConfig(); } }
  const legacy = store.getItem(XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY);
  if (legacy) { try { return parseStoredConfig(legacy); } catch { return createEnrichmentConfig(); } }
  return createEnrichmentConfig();
}
export function saveEnrichmentToStorage(config, storage) {
  const store = storageRef(storage);
  if (!store?.setItem) return;
  try {
    store.setItem(XML_COMPARE_ENRICHMENT_STORAGE_KEY, JSON.stringify(serializableEnrichmentConfig(config)));
    store.removeItem?.(XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY);
  } catch {}
}

function optionValue(record = {}) { return clean(record.lineNo) || clean(record.branchName) || clean(record.nodeName) || clean(record.displayName) || clean(record.uid); }
function lineOptions(records = []) {
  const seen = new Set(), out = [];
  for (const record of records || []) {
    const value = optionValue(record);
    if (!value || seen.has(value)) continue;
    seen.add(value); out.push({ value, label: value, uid: clean(record.uid) });
  }
  return out;
}
export function buildEnrichmentLineIdOptions(workspace = {}) { return { source: lineOptions(workspace.source?.records || []), target: lineOptions(workspace.target?.records || []) }; }
function labelHtml(label, tip = '') { return `<span>${esc(label)}${tip ? ` ${info(tip)}` : ''}</span>`; }
function enrField(id, label, value, type = 'text', placeholder = '', extra = '', tip = '') { return `<label class="enr-field">${labelHtml(label, tip)}<input type="${type}" data-enr-field="${esc(id)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}></label>`; }
function normalizedOptions(options) { return options.map(o => typeof o === 'string' ? { value: o, label: o } : o); }
function enrSelect(id, label, value, options, tip = '') {
  const opts = normalizedOptions(options).map(o => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<label class="enr-field">${label ? labelHtml(label, tip) : ''}<select data-enr-field="${esc(id)}">${opts}</select></label>`;
}
function enrTextarea(id, label, value, placeholder) { return `<label class="enr-textarea-label"><span>${esc(label)}</span><textarea data-enr-field="${esc(id)}" spellcheck="false" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`; }
function enrSection(toggleKey, title, enabled, body) { return `<section class="enr-section ${enabled ? 'is-enabled' : 'is-disabled'}"><label class="enr-section-toggle"><input type="checkbox" data-enr-toggle="${esc(toggleKey)}" ${enabled ? 'checked' : ''}><span>${esc(title)}</span></label><div class="enr-section-content">${body}</div></section>`; }
function renderRestraintTypeConvertSection(rtc) {
  const rows = normalizeRestraintRows(rtc.rows);
  const tableRows = rows.map((row, i) => `<tr><td><input class="enr-rtc-label" type="text" data-enr-rtc-row="${i}" data-enr-rtc-col="label" value="${esc(row.label)}" placeholder="label"></td><td><input class="enr-rtc-num" type="number" data-enr-rtc-row="${i}" data-enr-rtc-col="from" value="${esc(row.from)}" placeholder="e.g. 17" min="0" step="1"></td><td class="enr-rtc-arrow">→</td><td><input class="enr-rtc-num" type="number" data-enr-rtc-row="${i}" data-enr-rtc-col="to" value="${esc(row.to)}" placeholder="e.g. 14" min="0" step="1"></td><td><button type="button" data-xml-compare-action="delete-restraint-type-row" data-row-index="${i}">Delete</button></td></tr>`).join('');
  return enrSection('restraintTypeConvert', 'Restraint Type Conversion', rtc.enabled, `<p class="enr-help">Convert CAESAR restraint TYPE values before enrichment and analysis.</p><table class="enr-rtc-table"><thead><tr><th>Label</th><th>From TYPE</th><th></th><th>To TYPE</th><th></th></tr></thead><tbody>${tableRows}</tbody></table><button type="button" data-xml-compare-action="add-restraint-type-row">Add row</button>`);
}
function tabButton(tab, active) { return `<button type="button" class="enr-tab ${active ? 'is-active' : ''}" data-xml-compare-action="enr-switch-tab" data-enr-tab-key="${esc(tab.key)}"><span>${esc(tab.icon)}</span>${esc(tab.label)}</button>`; }
function selectedPreview(options, pc = {}) {
  let side = pc.previewSide === 'target' ? 'target' : 'source';
  if (side === 'source' && !options.source.length && options.target.length) side = 'target';
  if (side === 'target' && !options.target.length && options.source.length) side = 'source';
  const sideOptions = options[side] || [];
  const selected = sideOptions.some(o => o.value === pc.previewLineId) ? pc.previewLineId : (sideOptions[0]?.value || '');
  return { side, selected, sideOptions };
}
function previewRows(result) {
  const tokens = result.tokens.length ? result.tokens.join(' | ') : DASH;
  return `<div class="enr-preview-grid"><b>PipingClass</b><span>${esc(dash(result.pipingClass))}</span><b>Rating</b><span>${esc(dash(result.rating))}</span></div><h5>Extraction details</h5><div class="enr-preview-grid"><b>Regex group</b><span>${esc(dash(result.regexValue))}</span><b>Regex error</b><span>${esc(dash(result.regexError))}</span><b>Token value</b><span>${esc(dash(result.tokenValue))}</span><b>Selected result</b><span>${esc(dash(result.selectedValue))}</span><b>Tokens</b><span>${esc(tokens)}</span></div>`;
}
function renderPipingClassPreview(pc, rating, options) {
  const current = selectedPreview(options, pc), lineOpts = current.sideOptions.length ? current.sideOptions : [{ value: '', label: 'No loaded line IDs' }], preview = previewPipingClassExtraction(current.selected, { pipingClass: pc, rating });
  const sideOptions = [{ value: 'source', label: 'Source A' }, { value: 'target', label: 'Target B' }];
  return `${enrSelect('pipingClass.previewSide', 'Source side', current.side, sideOptions)}${enrSelect('pipingClass.previewLineId', 'Example Branch / Line ID', current.selected, lineOpts)}${enrField('pipingClass.regex', 'Regex', pc.regex || '', 'text', '', '', 'Regex is a search pattern. Example: ([0-9]{5}) finds a 5-digit number inside the line ID.')}${enrField('pipingClass.group', 'Group', pc.group || '1', 'number', '', '', 'Group means which bracketed part of the regex to use. Group 1 means the first value inside parentheses.')}${enrField('pipingClass.tokenPosition', 'Token position', pc.tokenPosition || '4', 'number', '', '', 'Token position is the part number after splitting the line ID. With "-" as delimiter, position 4 gives P8810212.')}${enrField('pipingClass.tokenDelimiter', 'Token delimiter', pc.tokenDelimiter || '-', 'text', '', '', 'Token delimiter is the character used to split the line ID, for example "-".')}<button type="button" data-xml-compare-action="enr-apply-pipingclass-to-all">Apply to all ${info('Use these extraction rules for every line ID during enrichment.')}</button><p class="enr-help">${pc.applyToAllConfirmed ? 'These extraction rules will be used for all line IDs during enrichment.' : 'Preview only. The extraction rules are global when saved or applied.'}</p><article class="enr-live-preview"><h4>Derived facts preview</h4>${previewRows(preview)}</article>`;
}
function sectionFor(key, cfg, context = {}) {
  if (key === 'restraintTypeConvert') return renderRestraintTypeConvertSection(cfg.restraintTypeConvert || {});
  if (key === 'pipingClass') return enrSection('pipingClass', 'PipingClass', cfg.pipingClass?.enabled, renderPipingClassPreview(cfg.pipingClass || {}, cfg.rating || {}, buildEnrichmentLineIdOptions(context.workspace || {})));
  if (key === 'rating') return enrSection('rating', 'Rating', cfg.rating?.enabled, `${enrSelect('rating.method','Method',cfg.rating?.method || 'table',['fixed','table'])}${enrField('rating.fixedValue','Fixed value',cfg.rating?.fixedValue || '')}${enrTextarea('rating.tableText','Class→rating table',cfg.rating?.tableText || '', 'PIPINGCLASS\tRATING')}`);
  if (key === 'componentType') return enrSection('componentType', 'ComponentType', cfg.componentType?.enabled, `${enrSelect('componentType.bendType','Bend',cfg.componentType?.bendType || 'ELBO',COMP_TYPES)}${enrSelect('componentType.sifType','SIF',cfg.componentType?.sifType || 'BRAN',COMP_TYPES)}${enrSelect('componentType.rigidType','Rigid',cfg.componentType?.rigidType || 'ATTA',COMP_TYPES)}${enrSelect('componentType.defaultType','Default',cfg.componentType?.defaultType || 'ATTA',COMP_TYPES)}`);
  if (key === 'dtxr') return enrSection('dtxr', 'DTXR', cfg.dtxr?.enabled, `${enrTextarea('dtxr.typeMapText','TYPE map',cfg.dtxr?.typeMapText || '', 'TYPE\tKIND\tDTXR_POS')}`);
  if (key === 'position') return enrSection('position', 'Position', cfg.position?.enabled, `${enrField('position.startX','Start X',cfg.position?.startX || '0','number')}${enrField('position.startY','Start Y',cfg.position?.startY || '0','number')}${enrField('position.startZ','Start Z',cfg.position?.startZ || '0','number')}`);
  if (key === 'pointPropertiesBasis') return enrSection('pointPropertiesBasis', 'Point basis', cfg.pointPropertiesBasis?.enabled, `${enrSelect('pointPropertiesBasis.value','Value',cfg.pointPropertiesBasis?.value || 'TO',['FROM','TO'])}`);
  return '';
}
export function renderXmlCompareEnrichmentConfigPopupHtml(config = createEnrichmentConfig(), context = {}) {
  if (!config.open) return '';
  const activeKey = config.activeEnrTab || 'restraint';
  const activeTab = ENR_TABS.find(t => t.key === activeKey) || ENR_TABS[0];
  return `<div class="xml-compare-sideload-backdrop" data-xml-compare-enrichment-popup="true"><section class="xml-compare-sideload-dialog enr-dialog"><header><div><h3>Enrichment Config</h3><p>Configure enrichment before applying sideload XML.</p></div><button type="button" data-xml-compare-action="close-enrichment">Close</button></header><div class="enr-tabs">${ENR_TABS.map(t => tabButton(t, t.key === activeTab.key)).join('')}</div><div class="enr-tab-panel">${activeTab.sectionKeys.map(key => sectionFor(key, config, context)).join('')}</div><footer><button type="button" data-xml-compare-action="save-enrichment">Save</button><small>${esc(activeTab.label)} settings</small></footer></section></div>`;
}
export const _test = Object.freeze({ esc, enrField, enrSelect, enrTextarea, sectionFor, DEFAULT_DTXR_TYPE_MAP_TEXT, optionValue, lineOptions, selectedPreview, renderPipingClassPreview, serializableEnrichmentConfig });
