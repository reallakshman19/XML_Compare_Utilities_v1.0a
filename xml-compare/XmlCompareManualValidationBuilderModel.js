import { normalizeCompareFields } from './XmlCompareFieldCompareModel.js';
import { textMatchPercent } from './XmlCompareFieldExtractor.js';

export const XML_COMPARE_MANUAL_VALIDATION_BUILDER_SCHEMA = 'xml-compare-manual-validation-builder/v1';
export const XML_COMPARE_VALIDATION_CANDIDATE_SET_SCHEMA = 'validation-candidate-set/v1';
export const VALIDATION_FIELD_TYPES = Object.freeze(['text', 'numeric']);

const clean = (value) => String(value ?? '').trim();
const norm = (value) => clean(value).replace(/\s+/g, ' ').toLowerCase();
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const arr = (items) => Object.freeze(Array.isArray(items) ? [...items] : []);

function valueOf(record = {}, field = '') {
  return clean(field).includes('.') ? clean(field).split('.').reduce((obj, key) => obj?.[key], record) : record?.[field];
}
function numberAt(record = {}, field = '', position = 1) {
  const raw = valueOf(record, field), direct = finite(raw);
  if (direct != null) return direct;
  const matches = clean(raw).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  return finite(matches[Math.max(0, Number(position || 1) - 1)]);
}
function round(value, decimals = 3) {
  const n = finite(value), places = Math.max(0, Math.min(9, Number(decimals || 0)));
  return n == null ? null : Number(n.toFixed(places));
}
function numeric(input = {}) {
  return Object.freeze({ regexPosition: Math.max(1, Number(input.regexPosition || 1)), roundOff: Math.max(0, Math.min(9, Number(input.roundOff ?? 3))), autoAnchorSelectedNodes: Boolean(input.autoAnchorSelectedNodes) });
}
function candidateIds(input = {}) {
  return Object.freeze(arr(input.selectedCandidateIds).map(clean).filter(Boolean));
}
export function normalizeValidationBuilderState(input = {}) {
  const fieldType = VALIDATION_FIELD_TYPES.includes(clean(input.fieldType)) ? clean(input.fieldType) : 'text';
  return Object.freeze({ schema: XML_COMPARE_MANUAL_VALIDATION_BUILDER_SCHEMA, fieldType, numeric: numeric(input.numeric), numericDeltaThreshold: finite(input.numericDeltaThreshold), textSimilarityThreshold: finite(input.textSimilarityThreshold), candidateSet: input.candidateSet || null, selectedCandidateIds: candidateIds(input) });
}
function textRule(validation = {}, field = '') {
  const rule = validation.textRules?.[field] || {};
  return Object.freeze({ mode: clean(rule.mode || 'exact-normalized'), pattern: clean(rule.pattern), groupSpec: clean(rule.groupSpec), direction: clean(rule.direction || 'either-contains'), caseSensitive: Boolean(rule.caseSensitive) });
}
function textMatched(source = '', target = '', rule = {}) {
  const a = rule.caseSensitive ? clean(source) : norm(source), b = rule.caseSensitive ? clean(target) : norm(target);
  if (rule.mode === 'contains' || rule.direction.includes('contains')) return a.includes(b) || b.includes(a);
  if (rule.mode === 'starts-with' || rule.direction.includes('starts')) return a.startsWith(b) || b.startsWith(a);
  if (rule.mode === 'ends-with' || rule.direction.includes('ends')) return a.endsWith(b) || b.endsWith(a);
  if (rule.mode === 'regex' && rule.pattern) return new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i').test(clean(source)) || new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i').test(clean(target));
  return a === b;
}
function textRows(source = {}, target = {}, fields = [], validation = {}) {
  return fields.flatMap((sourceField) => fields.map((targetField) => {
    const rule = textRule(validation, sourceField), sourceValue = clean(valueOf(source, sourceField)), targetValue = clean(valueOf(target, targetField));
    const matched = textMatched(sourceValue, targetValue, rule);
    const sim = Math.round(textMatchPercent(sourceValue, targetValue, { caseSensitive: rule.caseSensitive }) * 100);
    return Object.freeze({ id: `text:${sourceField}->${targetField}`, fieldType: 'text', sourceField, targetField, targetVariant: 'raw', sourceValue, targetValue, delta: sim, absDelta: sim, rank: matched ? 1 : 99, selected: matched, reason: matched ? 'text-rule-match' : 'text-rule-mismatch' });
  }));
}
function anchorOffsets(source = {}, target = {}, fields = [], options = {}) {
  if (!options.autoAnchorSelectedNodes) return Object.freeze({});
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, numberAt(source, field, options.regexPosition) - numberAt(target, field, options.regexPosition)]).filter(([, v]) => Number.isFinite(v))));
}
function numericRow(sourceField, targetField, variant, values, options) {
  const targetValue = variant === 'transformed' ? values.target + (values.offset || 0) : values.target;
  const delta = round(values.source - targetValue, options.roundOff), absDelta = delta == null ? null : Math.abs(delta);
  return Object.freeze({ id: `numeric:${sourceField}->${variant}:${targetField}`, fieldType: 'numeric', sourceField, targetField, targetVariant: variant, sourceValue: round(values.source, options.roundOff), targetValue: round(values.target, options.roundOff), transformedTargetValue: variant === 'transformed' ? round(targetValue, options.roundOff) : null, delta, absDelta, rank: 99, selected: false, reason: variant === 'transformed' ? 'auto-anchor-transform' : 'raw-numeric-compare' });
}
function rankNumeric(rows = []) {
  const sorted = [...rows].sort((a, b) => (a.absDelta ?? Infinity) - (b.absDelta ?? Infinity));
  const ranks = new Map(sorted.map((row, index) => [row.id, index + 1]));
  const bestBySource = new Map();
  for (const row of sorted) if (!bestBySource.has(row.sourceField)) bestBySource.set(row.sourceField, row.id);
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, rank: ranks.get(row.id) || 99, selected: bestBySource.get(row.sourceField) === row.id })));
}
function numericRows(source = {}, target = {}, fields = [], builder = {}) {
  const options = numeric(builder.numeric), offsets = anchorOffsets(source, target, fields, options), rows = [];
  for (const sourceField of fields) for (const targetField of fields) {
    const sourceValue = numberAt(source, sourceField, options.regexPosition), targetValue = numberAt(target, targetField, options.regexPosition);
    if (sourceValue == null || targetValue == null) continue;
    rows.push(numericRow(sourceField, targetField, 'raw', { source: sourceValue, target: targetValue }, options));
    if (options.autoAnchorSelectedNodes) rows.push(numericRow(sourceField, targetField, 'transformed', { source: sourceValue, target: targetValue, offset: offsets[targetField] || 0 }, options));
  }
  return rankNumeric(rows);
}
function diagnostics(source, target, fields = []) {
  const out = [];
  if (!source) out.push({ severity: 'BLOCKER', code: 'source_selection_required', message: 'Select a Source record first.' });
  if (!target) out.push({ severity: 'BLOCKER', code: 'target_selection_required', message: 'Select a Target record first.' });
  if (!fields.length) out.push({ severity: 'BLOCKER', code: 'compare_fields_required', message: 'Select at least one compare field.' });
  return Object.freeze(out.map(Object.freeze));
}
function applySelection(rows = [], selectedIds = []) {
  const chosen = new Set(selectedIds);
  if (!chosen.size) return Object.freeze(rows);
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, selected: chosen.has(row.id) })));
}
export function createValidationCandidateSet({ sourceRecord = null, targetRecord = null, compareFields = [], builder = {}, validation = {} } = {}) {
  const state = normalizeValidationBuilderState(builder), fields = normalizeCompareFields(compareFields), issues = diagnostics(sourceRecord, targetRecord, fields);
  const rows = issues.length ? [] : state.fieldType === 'numeric' ? numericRows(sourceRecord, targetRecord, fields, state) : textRows(sourceRecord, targetRecord, fields, validation);
  const candidates = applySelection(rows, state.selectedCandidateIds);
  return Object.freeze({ schema: XML_COMPARE_VALIDATION_CANDIDATE_SET_SCHEMA, fieldType: state.fieldType, layer: clean(validation.layer || 'current'), sourceUid: clean(sourceRecord?.uid), targetUid: clean(targetRecord?.uid), sourceFields: fields, targetFields: fields, transformPolicy: Object.freeze({ autoAnchorSelectedNodes: state.numeric.autoAnchorSelectedNodes }), candidates, selectedCandidateIds: Object.freeze(candidates.filter((row) => row.selected).map((row) => row.id)), diagnostics: issues, summary: Object.freeze({ candidateCount: candidates.length, selectedCount: candidates.filter((row) => row.selected).length, blockerCount: issues.filter((item) => item.severity === 'BLOCKER').length }) });
}
export function toggleValidationCandidate(builder = {}, candidateId = '', selected = false) {
  const state = normalizeValidationBuilderState(builder), id = clean(candidateId), current = new Set(state.selectedCandidateIds);
  if (selected) current.add(id); else current.delete(id);
  const ids = [...current].filter(Boolean), candidateSet = state.candidateSet ? { ...state.candidateSet, selectedCandidateIds: ids, candidates: state.candidateSet.candidates.map((row) => ({ ...row, selected: ids.includes(row.id) })) } : null;
  return normalizeValidationBuilderState({ ...state, selectedCandidateIds: ids, candidateSet });
}
export function approveAllValidCandidates(builder = {}) {
  const state = normalizeValidationBuilderState(builder);
  if (!state.candidateSet || !state.candidateSet.candidates) return state;
  const isNumeric = state.fieldType === 'numeric';
  const ids = new Set(state.selectedCandidateIds);
  for (const row of state.candidateSet.candidates) {
    if (isNumeric && state.numericDeltaThreshold != null && row.absDelta != null && row.absDelta <= state.numericDeltaThreshold) ids.add(row.id);
    else if (!isNumeric && state.textSimilarityThreshold != null && row.delta != null && row.delta >= state.textSimilarityThreshold) ids.add(row.id);
  }
  const finalIds = [...ids].filter(Boolean);
  const candidateSet = { ...state.candidateSet, selectedCandidateIds: finalIds, candidates: state.candidateSet.candidates.map((row) => ({ ...row, selected: finalIds.includes(row.id) })) };
  return normalizeValidationBuilderState({ ...state, selectedCandidateIds: finalIds, candidateSet });
}
export const _test = Object.freeze({ clean, norm, finite, valueOf, numberAt, round, numeric, candidateIds, textRule, textMatched, textRows, anchorOffsets, numericRow, rankNumeric, numericRows, diagnostics, applySelection });
