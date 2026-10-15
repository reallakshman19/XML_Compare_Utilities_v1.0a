import { convertCategorizedInputXml, inputXmlToCategorizedInputXml } from './CategorizedInputXmlConverter.js';
import { applyXmlCompareSideload, buildXmlCompareSideloadFileName } from './XmlCompareSideloadEnricher.js';
import { selectedElement, selectedLine } from './XmlCompareLinewiseWorkspaceModel.js';
import { createLinewiseWorkflowState, linewiseLineIdOptions, updateLinewiseWorkflowState } from './XmlCompareLinewiseWorkflowState.js';

export const XML_COMPARE_LINEWISE_WORKFLOW_ACTIONS_SCHEMA = 'xml-compare-linewise-workflow-actions/v1';
const clean = (value) => String(value ?? '').trim();
const safeName = (name = 'input.xml') => clean(name || 'input.xml').replace(/\.(xml|txt)$/i, '');

export function currentLine(state = {}) { return selectedLine(state.model, state.lineIndex); }
export function currentElement(state = {}) { return selectedElement(currentLine(state), state.elementIndex); }
export function exportBaseName(state = {}) { return safeName(state.fileName || 'input.xml'); }

export function ensureCategorized(state = {}) {
  if (!clean(state.text)) return '';
  if (state.model?.format === 'CategorizedInputXML') return state.text;
  return inputXmlToCategorizedInputXml(state.text, { sourceName: state.fileName || 'InputXML' });
}

export function ensureInputXml(state = {}) {
  if (!clean(state.text)) return '';
  if (state.model?.format === 'CategorizedInputXML') return convertCategorizedInputXml(state.text, 'categorized-to-input', { sourceName: state.fileName || 'CategorizedInputXML' });
  return state.text;
}

export function previewText(state = {}) {
  if (state.previewMode === 'input') return ensureInputXml(state);
  if (state.previewMode === 'element') return currentElement(state)?.originalElement || '';
  return ensureCategorized(state);
}

export function linewiseAuditJson(state = {}) {
  return JSON.stringify({ schema: 'xml-compare-linewise-audit/v1', fileName: state.fileName || '', format: state.model?.format || '', lineCount: state.model?.lineCount || 0, elementCount: state.model?.elementCount || 0, lines: (state.model?.lines || []).map((line) => ({ lineId: line.lineId, elements: line.elements.map((el) => ({ fromNode: el.fromNode, toNode: el.toNode, elementKey: el.elementKey, blocks: el.blockNames, derivedFacts: el.derivedFacts, nodeBlockCounts: el.nodeBlockCounts, childCounts: el.childCounts })) })) }, null, 2);
}

export function regexSandboxResult(state = {}) {
  const cfg = state.regexSandbox || {}, options = linewiseLineIdOptions(state.model);
  const sample = options.some((o) => o.value === cfg.sample) ? cfg.sample : (options[0]?.value || '');
  let regexValue = '', regexError = '';
  try { const match = new RegExp(cfg.regex || '([0-9]{5})', 'i').exec(sample); regexValue = match?.[Number(cfg.group) || 0] || ''; } catch (error) { regexError = error?.message || String(error); }
  const tokens = clean(sample).replace(/^\/+/, '').replace(/\/B\d+$/i, '').split(cfg.delimiter ?? '-').map((item) => item.trim()).filter(Boolean);
  const tokenValue = tokens[Math.max(0, (Number(cfg.tokenPosition) || 1) - 1)] || '';
  return Object.freeze({ sample, regexValue, regexError, tokenValue, selected: regexValue || tokenValue, tokens });
}

export function applyLinewiseAction(state = {}, action = {}) {
  const type = action.type;
  if (type === 'open-linewise-workflow') return updateLinewiseWorkflowState(state, { open: true, infoRuleOpen: false });
  if (type === 'close-linewise-workflow') return updateLinewiseWorkflowState(state, { open: false, infoRuleOpen: false });
  if (type === 'set-linewise-tab') return updateLinewiseWorkflowState(state, { tab: action.tab || 'import' });
  if (type === 'set-linewise-line-index') return updateLinewiseWorkflowState(state, { lineIndex: Number(action.index) || 0, elementIndex: 0 });
  if (type === 'set-linewise-element-index') return updateLinewiseWorkflowState(state, { elementIndex: Number(action.index) || 0 });
  if (type === 'set-linewise-preview-mode') return updateLinewiseWorkflowState(state, { previewMode: action.previewMode || 'categorized' });
  if (type === 'set-linewise-sideload-field') return updateLinewiseWorkflowState(state, { sideload: { ...state.sideload, [action.field]: String(action.value ?? '') } });
  if (type === 'set-linewise-regex-sandbox-field') return updateLinewiseWorkflowState(state, { regexSandbox: { ...state.regexSandbox, [action.field]: String(action.value ?? '') } });
  if (type === 'open-linewise-info-rule') return updateLinewiseWorkflowState(state, { infoRuleOpen: true });
  if (type === 'close-linewise-info-rule') return updateLinewiseWorkflowState(state, { infoRuleOpen: false });
  return createLinewiseWorkflowState(state);
}

export function importLinewiseText({ fileName = 'input.xml', text = '' } = {}) {
  return updateLinewiseWorkflowState({}, { open: true, fileName, text, tab: 'import' });
}

export function applyLinewiseSideload(state = {}) {
  if (!clean(state.text)) return updateLinewiseWorkflowState(state, { lastCanvasStatus: 'Import XML before applying sideload.' });
  const result = applyXmlCompareSideload(state.text, state.sideload || {});
  return updateLinewiseWorkflowState(state, { text: result.xmlText, fileName: buildXmlCompareSideloadFileName(state.fileName || 'input.xml'), lastEnriched: result.xmlText, lastSideloadReport: result.report || result.stats || null, tab: 'sideload' });
}

export function linewiseCategorizedCanvasPayload(state = {}, side = 'a') {
  const text = ensureCategorized(state), name = `${exportBaseName(state)}_categorized_enriched.xml`;
  return Object.freeze({ side: side === 'b' ? 'b' : 'a', fileName: name, text, status: `Loaded ${name} to ${side === 'b' ? 'Target B' : 'Source A'} canvas.` });
}

export const _test = Object.freeze({ clean, safeName });
