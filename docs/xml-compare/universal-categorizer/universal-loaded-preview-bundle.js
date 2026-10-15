import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';
import { createLinewiseUniversalTargetPreviewRows } from './universal-attachment-preview.js';
import { createLinewiseUniversalSourcePreviewInputs, createUniversalSourceRegistry, normalizeSourceInputs } from './universal-source-registry.js';
import { normalizeGraphTargetRows } from './universal-graph-builder.js';

export const UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA = 'universal-loaded-preview-bundle/v1-shadow';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createLinewiseUniversalLoadedPreviewBundle(profile = createLinewiseUniversalPreset()) {
  return createUniversalLoadedPreviewBundle({ profile: profile || createLinewiseUniversalPreset(), sourceInputs: createLinewiseUniversalSourcePreviewInputs(), targetRows: createLinewiseUniversalTargetPreviewRows() });
}

export function createUniversalLoadedPreviewBundle(input = {}) {
  const profile = normalizeUniversalCategorizerProfile(input.profile || input.profileInput || createLinewiseUniversalPreset());
  const loadedSources = normalizeLoadedSourceInputs(profile, input.sourceInputs || input.sources || {});
  const targetRows = normalizeLoadedTargetRows(input.targetRows || input.targets || []);
  const registry = createUniversalSourceRegistry(profile, loadedSources.sourceInputs);
  const diagnostics = freeze([...loadedSources.diagnostics, ...targetDiagnostics(targetRows), ...(registry.diagnostics || [])]);
  return freeze({ schema: UNIVERSAL_LOADED_PREVIEW_BUNDLE_SCHEMA, profileId: profile.profileId, sourceInputs: loadedSources.sourceInputs, sources: summarizeLoadedSources(registry), targetRows, registry, diagnostics, summary: freeze({ sources: registry.sources.length, sourceRows: registry.sources.reduce((sum, source) => sum + source.rowCount, 0), targetRows: targetRows.length, diagnostics: diagnostics.length }), exportLocked: true });
}

export function normalizeLoadedSourceInputs(profileInput = createLinewiseUniversalPreset(), sourceInputs = {}) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  const inputBySourceId = normalizeSourceInputs(sourceInputs);
  const normalized = {};
  const diagnostics = [];
  for (const source of profile.sources) {
    const payload = inputBySourceId[source.sourceId] || {};
    const rows = normalizeRows(payload.rows || payload.previewRows || payload.records);
    const columns = normalizeColumns(payload.columns || payload.declaredColumns, rows);
    normalized[source.sourceId] = freeze({ sourceId: source.sourceId, columns, rows });
    if (!inputBySourceId[source.sourceId]) diagnostics.push(diagnostic('warn', 'UXC_LOADED_SOURCE_MISSING', source.sourceId, `No loaded data was supplied for source "${source.sourceId}".`));
    if (!rows.length) diagnostics.push(diagnostic('warn', 'UXC_LOADED_SOURCE_ROWS_EMPTY', source.sourceId, `Loaded source "${source.sourceId}" has no preview rows.`));
  }
  return freeze({ sourceInputs: freeze(normalized), diagnostics: freeze(diagnostics) });
}

export function normalizeLoadedTargetRows(rows = []) { return freeze(normalizeGraphTargetRows(rows).map((row) => freeze(stableObject(row)))); }
function summarizeLoadedSources(registry = {}) { return freeze(arr(registry.sources).map((source) => freeze({ sourceId: source.sourceId, role: source.role, columns: source.columns, requiredColumns: source.requiredColumns, missingRequiredColumns: source.missingRequiredColumns, rowCount: source.rowCount, sampleRows: freeze(arr(source.rows).slice(0, 3).map((row) => freeze(stableObject(row)))), status: source.status }))); }
function targetDiagnostics(targetRows = []) { return targetRows.length ? [] : [diagnostic('warn', 'UXC_LOADED_TARGET_ROWS_EMPTY', 'targetRows', 'No loaded target rows were supplied for Tree/Pivot Preview.')]; }
function normalizeColumns(columns = [], rows = []) { const declared = arr(columns).map((value) => text(value)).filter(Boolean); const rowColumns = [...new Set(arr(rows).flatMap((row) => Object.keys(row || {}).map((key) => text(key)).filter(Boolean)))].sort((a, b) => a.localeCompare(b)); return freeze([...new Set([...declared, ...rowColumns])]); }
function normalizeRows(rows = []) { return freeze(arr(rows).map((row) => row && typeof row === 'object' ? freeze(stableObject(row)) : freeze({}))); }
function stableObject(input = {}) { return Object.fromEntries(Object.entries(input || {}).map(([key, value]) => [text(key), value]).sort(([a], [b]) => a.localeCompare(b))); }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }
export const _test = freeze({ normalizeRows, normalizeColumns, summarizeLoadedSources, targetDiagnostics, stableObject, diagnostic });
