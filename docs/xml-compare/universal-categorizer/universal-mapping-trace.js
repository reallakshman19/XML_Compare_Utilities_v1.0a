import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from './universal-source-registry.js';
import { createUniversalMappingWorkbench } from './universal-mapping-workbench.js';
import { createUniversalMappingReview } from './universal-mapping-review.js';

export const UNIVERSAL_MAPPING_TRACE_SCHEMA = 'universal-mapping-trace/v1-shadow';
const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createLinewiseUniversalMappingTrace(profile = createLinewiseUniversalPreset()) {
  const registry = createUniversalSourceRegistry(profile || createLinewiseUniversalPreset());
  const mappingWorkbench = createUniversalMappingWorkbench({ profile, registry });
  const mappingReview = createUniversalMappingReview({ mappingWorkbench });
  return createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview });
}

export function createUniversalMappingTrace(input = {}) {
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow' ? input.registry : createUniversalSourceRegistry(input.profile || createLinewiseUniversalPreset(), input.sourceInputs || input.sources || {});
  const mappingWorkbench = input.mappingWorkbench?.schema === 'universal-mapping-workbench/v1-shadow' ? input.mappingWorkbench : createUniversalMappingWorkbench({ ...input, registry });
  const mappingReview = input.mappingReview?.schema === 'universal-mapping-review/v1-shadow' ? input.mappingReview : createUniversalMappingReview({ mappingWorkbench });
  const rows = freeze(traceRows({ registry, mappingWorkbench }));
  const diagnostics = freeze(traceDiagnostics({ rows, mappingReview }));
  return freeze({ schema: UNIVERSAL_MAPPING_TRACE_SCHEMA, profileId: mappingWorkbench.profileId, title: 'Sample value mapping trace', kicker: 'Sample trace', status: rows.some((row) => row.traceStatus === 'Missing sample value') ? 'review-required' : 'preview-only', description: 'Preview source sample values beside the proposed recipe target. This trace does not apply mappings or mutate the recipe.', columns: freeze(['Source row', 'Source field', 'Sample value', 'Target recipe location', 'Trace status']), summary: freeze({ rows: rows.length, traced: rows.filter((row) => row.traceStatus === 'Traced').length, missing: rows.filter((row) => row.traceStatus !== 'Traced').length, diagnostics: diagnostics.length }), selectedTrace: freeze(selectedTrace(rows, mappingReview)), rows, diagnostics });
}

function traceRows({ registry = {}, mappingWorkbench = {} } = {}) {
  const sources = new Map(arr(registry.sources).map((source) => [source.sourceId, source]));
  const rows = [];
  for (const mapping of arr(mappingWorkbench.rows)) {
    const source = sources.get(mapping.sourceId) || {};
    const samples = arr(source.rows).length ? arr(source.rows).slice(0, 3) : [null];
    samples.forEach((sample, sampleIndex) => rows.push(traceRow(mapping, sample, sampleIndex)));
  }
  return rows.sort((a, b) => `${a.sourceId}:${a.sourceRow}:${a.sourceField}:${a.targetLocation}`.localeCompare(`${b.sourceId}:${b.sourceRow}:${b.sourceField}:${b.targetLocation}`));
}
function traceRow(mapping = {}, sample = null, sampleIndex = 0) {
  const hasSample = !!sample;
  const value = hasSample ? sample[mapping.sourceField] : undefined;
  const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
  return freeze({ traceId: `${mapping.rowId || mapping.sourceField}:${sampleIndex}`, sourceId: text(mapping.sourceId), sourceName: text(mapping.sourceName, mapping.sourceId), sourceRow: hasSample ? `Row ${sampleIndex + 1}` : 'No sample row', sourceField: text(mapping.sourceField), sampleValue: hasValue ? String(value) : '—', targetLocation: text(mapping.targetLocation, '—'), role: text(mapping.role, '—'), confidence: text(mapping.confidence, '—'), traceStatus: !hasSample ? 'No sample row' : hasValue ? 'Traced' : 'Missing sample value' });
}
function selectedTrace(rows = [], mappingReview = {}) { const selectedField = mappingReview.selected?.sourceField; return arr(rows).find((row) => row.sourceField === selectedField) || arr(rows)[0] || { traceId: '', sourceField: '', sampleValue: '—', targetLocation: '—', traceStatus: 'No trace row' }; }
function traceDiagnostics({ rows = [], mappingReview = {} } = {}) { const diagnostics = []; const missing = arr(rows).filter((row) => row.traceStatus !== 'Traced').length; if (missing) diagnostics.push(diagnostic('info', 'UXC_MAPPING_TRACE_SAMPLE_VALUE_MISSING', 'sample-trace', `${missing} trace rows do not have sample values yet.`)); if (!mappingReview.selected?.rowId) diagnostics.push(diagnostic('info', 'UXC_MAPPING_TRACE_NO_SELECTED_MAPPING', 'sample-trace', 'No selected mapping review row is available for focused trace preview.')); return diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subjectId}`.localeCompare(`${b.severity}:${b.code}:${b.subjectId}`)); }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }
export const _test = freeze({ traceRows, traceRow, selectedTrace, traceDiagnostics, diagnostic });
