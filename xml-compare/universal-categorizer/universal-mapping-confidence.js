import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from './universal-source-registry.js';
import { createUniversalMappingWorkbench } from './universal-mapping-workbench.js';
import { createUniversalMappingReview } from './universal-mapping-review.js';
import { createUniversalMappingTrace } from './universal-mapping-trace.js';

export const UNIVERSAL_MAPPING_CONFIDENCE_SCHEMA = 'universal-mapping-confidence/v1-shadow';
const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();
const clamp = (value) => Math.max(0, Math.min(100, value));

export function createLinewiseUniversalMappingConfidence(profile = createLinewiseUniversalPreset()) {
  const registry = createUniversalSourceRegistry(profile || createLinewiseUniversalPreset());
  const mappingWorkbench = createUniversalMappingWorkbench({ profile, registry });
  const mappingReview = createUniversalMappingReview({ mappingWorkbench });
  const mappingTrace = createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview });
  return createUniversalMappingConfidence({ mappingWorkbench, mappingReview, mappingTrace });
}

export function createUniversalMappingConfidence(input = {}) {
  const profile = input.profile || createLinewiseUniversalPreset();
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow' ? input.registry : createUniversalSourceRegistry(profile, input.sourceInputs || input.sources || {});
  const mappingWorkbench = input.mappingWorkbench?.schema === 'universal-mapping-workbench/v1-shadow' ? input.mappingWorkbench : createUniversalMappingWorkbench({ ...input, profile, registry });
  const mappingReview = input.mappingReview?.schema === 'universal-mapping-review/v1-shadow' ? input.mappingReview : createUniversalMappingReview({ mappingWorkbench });
  const mappingTrace = input.mappingTrace?.schema === 'universal-mapping-trace/v1-shadow' ? input.mappingTrace : createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview });
  const rows = freeze(confidenceRows({ mappingWorkbench, mappingTrace }));
  const diagnostics = freeze(confidenceDiagnostics({ rows, mappingWorkbench, mappingReview, mappingTrace }));
  return freeze({
    schema: UNIVERSAL_MAPPING_CONFIDENCE_SCHEMA,
    profileId: mappingWorkbench.profileId,
    title: 'Mapping confidence',
    kicker: 'Quality scoring',
    status: rows.some((row) => row.readinessStatus === 'blocked') ? 'review-required' : 'preview-only',
    description: 'Explain why each source-to-recipe proposal is high, medium, or low confidence before any mapping write is enabled.',
    columns: freeze(['Source field', 'Target recipe location', 'Role', 'Confidence', 'Quality score', 'Readiness']),
    summary: freeze({
      rows: rows.length,
      high: rows.filter((row) => row.confidenceLevel === 'high').length,
      medium: rows.filter((row) => row.confidenceLevel === 'medium').length,
      low: rows.filter((row) => row.confidenceLevel === 'low').length,
      risks: rows.reduce((total, row) => total + row.riskFlags.length, 0),
      diagnostics: diagnostics.length,
    }),
    rows,
    selected: freeze(selectedConfidenceRow(rows, mappingReview)),
    diagnostics,
  });
}

function confidenceRows({ mappingWorkbench = {}, mappingTrace = {} } = {}) {
  const traceByField = new Map(arr(mappingTrace.rows).map((row) => [traceKey(row.sourceId, row.sourceField, row.targetLocation), row]));
  return arr(mappingWorkbench.rows).map((mapping) => confidenceRow(mapping, traceByField.get(traceKey(mapping.sourceId, mapping.sourceField, mapping.targetLocation)))).sort((a, b) => `${a.sourceId}:${a.sourceField}:${a.targetLocation}`.localeCompare(`${b.sourceId}:${b.sourceField}:${b.targetLocation}`));
}
function confidenceRow(mapping = {}, trace = null) {
  const evidence = [];
  const risks = [];
  let score = confidenceBaseScore(mapping.confidence);
  if (mapping.status === 'Proposed') { evidence.push('Mapping Workbench proposed this source-to-target location.'); score += 5; }
  if (text(mapping.role).includes('key')) { evidence.push('Source field participates in key resolution.'); score += 10; }
  if (text(mapping.role).includes('field')) { evidence.push('Source field is proposed as an attached recipe field.'); score += 5; }
  if (trace?.traceStatus === 'Traced') { evidence.push('Sample value trace confirms at least one source value.'); score += 10; }
  if (!trace || trace.traceStatus === 'No sample row') { risks.push('no-sample-row'); score -= 12; }
  if (trace?.traceStatus === 'Missing sample value') { risks.push('missing-sample-value'); score -= 18; }
  if (mapping.status === 'Unmapped') { risks.push('unmapped-source-field'); score -= 30; }
  if (mapping.confidence === 'low') risks.push('low-workbench-confidence');
  const qualityScore = clamp(score);
  return freeze({
    rowId: text(mapping.rowId, mapping.sourceField),
    sourceId: text(mapping.sourceId),
    sourceName: text(mapping.sourceName, mapping.sourceId),
    sourceField: text(mapping.sourceField),
    targetLocation: text(mapping.targetLocation, '—'),
    role: text(mapping.role, '—'),
    workbenchConfidence: text(mapping.confidence, 'low'),
    confidenceLevel: qualityScore >= 80 ? 'high' : qualityScore >= 60 ? 'medium' : 'low',
    qualityScore,
    readinessStatus: risks.includes('unmapped-source-field') ? 'blocked' : risks.length ? 'review' : 'ready',
    evidenceReasons: freeze(evidence.length ? evidence : ['No positive mapping evidence is available yet.']),
    riskFlags: freeze(risks),
  });
}
function confidenceDiagnostics({ rows = [], mappingWorkbench = {}, mappingReview = {}, mappingTrace = {} } = {}) {
  const diagnostics = [];
  const low = arr(rows).filter((row) => row.confidenceLevel === 'low').length;
  const blocked = arr(rows).filter((row) => row.readinessStatus === 'blocked').length;
  const missingTrace = arr(rows).filter((row) => row.riskFlags.includes('no-sample-row') || row.riskFlags.includes('missing-sample-value')).length;
  if (low) diagnostics.push(diagnostic('warn', 'UXC_MAPPING_CONFIDENCE_LOW_SCORE', 'mapping-confidence', `${low} mapping proposals have low confidence.`));
  if (blocked) diagnostics.push(diagnostic('error', 'UXC_MAPPING_CONFIDENCE_BLOCKED', 'mapping-confidence', `${blocked} mapping proposals are blocked until reviewed.`));
  if (missingTrace) diagnostics.push(diagnostic('info', 'UXC_MAPPING_CONFIDENCE_TRACE_EVIDENCE_MISSING', 'mapping-confidence', `${missingTrace} mapping proposals need sample trace evidence.`));
  for (const item of arr(mappingWorkbench.diagnostics)) diagnostics.push(diagnostic(item.severity || 'info', item.code || 'UXC_MAPPING_WORKBENCH_DIAGNOSTIC', item.subjectId || item.sourceId || 'mapping-workbench', item.message || 'Mapping Workbench diagnostic.'));
  for (const item of arr(mappingReview.diagnostics)) diagnostics.push(diagnostic(item.severity || 'info', item.code || 'UXC_MAPPING_REVIEW_DIAGNOSTIC', item.subjectId || 'mapping-review', item.message || 'Mapping Review diagnostic.'));
  for (const item of arr(mappingTrace.diagnostics)) diagnostics.push(diagnostic(item.severity || 'info', item.code || 'UXC_MAPPING_TRACE_DIAGNOSTIC', item.subjectId || 'mapping-trace', item.message || 'Mapping Trace diagnostic.'));
  return diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subjectId}`.localeCompare(`${b.severity}:${b.code}:${b.subjectId}`));
}
function confidenceBaseScore(confidence) { if (confidence === 'high') return 75; if (confidence === 'medium') return 55; return 35; }
function selectedConfidenceRow(rows = [], mappingReview = {}) { const selectedField = mappingReview.selected?.sourceField; return arr(rows).find((row) => row.sourceField === selectedField) || arr(rows)[0] || { rowId: '', sourceField: '', targetLocation: '—', confidenceLevel: 'low', qualityScore: 0, readinessStatus: 'blocked', evidenceReasons: [], riskFlags: ['no-confidence-row'] }; }
function traceKey(sourceId, sourceField, targetLocation) { return `${text(sourceId)}::${text(sourceField)}::${text(targetLocation)}`; }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }
export const _test = freeze({ confidenceRows, confidenceRow, confidenceDiagnostics, confidenceBaseScore, selectedConfidenceRow, traceKey, diagnostic });
