import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';
import { createUniversalFieldCatalog, uniqueText } from './universal-field-catalog.js';

export const UNIVERSAL_SOURCE_REGISTRY_SCHEMA = 'universal-source-registry/v1-shadow';

export const UXC_001_FORBIDDEN_FILES = Object.freeze([
  'xml-compare/CategorizedInputXmlConverter.js',
  'xml-compare/XmlCompareSideloadEnricher.js',
  'xml-compare/XmlCompareLinewiseWorkflowActions.js',
  'xml-compare/XmlCompareLinewiseWorkflowState.js',
  'xml-compare/table-categorizer/table-categorized-xml-graph-builder.js',
  'xml-compare/table-categorizer/table-categorized-xml-exporter.js',
  'xml-compare/table-categorizer/table-categorized-xml-controller.js',
]);

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createUniversalSourceRegistry(profileInput = createLinewiseUniversalPreset(), sourceInputs = {}) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  const inputBySourceId = normalizeSourceInputs(sourceInputs);
  const duplicateSourceIds = findDuplicates(profile.sources.map((source) => source.sourceId));
  const sourceMap = {};
  const sources = profile.sources.map((source, index) => {
    const payload = inputBySourceId[source.sourceId] || {};
    const rows = normalizeRows(payload.rows || payload.previewRows || payload.records);
    const catalog = createUniversalFieldCatalog({
      ...source,
      ...payload,
      sourceId: source.sourceId,
      requiredColumns: source.requiredColumns,
      optionalColumns: source.optionalColumns,
      rows,
    });
    const diagnostics = [
      ...catalog.diagnostics,
      ...(source.role === 'sideload' && !inputBySourceId[source.sourceId]
        ? [diagnostic('warn', 'UXC_SOURCE_PAYLOAD_MISSING', source.sourceId, `No preview rows were supplied for sideload source "${source.sourceId}".`)]
        : []),
    ];
    const normalized = freeze({
      schema: 'UniversalSource.v1-shadow',
      sourceIndex: index,
      sourceId: source.sourceId,
      displayName: source.displayName,
      role: source.role,
      sourceKind: source.sourceKind,
      requiredColumns: source.requiredColumns,
      optionalColumns: source.optionalColumns,
      columns: catalog.columns,
      presentRequiredColumns: catalog.presentRequiredColumns,
      missingRequiredColumns: catalog.missingRequiredColumns,
      rowCount: rows.length,
      rows,
      fieldCatalog: catalog,
      status: catalog.missingRequiredColumns.length ? 'missing-required-columns' : 'ready',
      diagnostics: freeze(diagnostics),
    });
    sourceMap[normalized.sourceId] = normalized;
    return normalized;
  });

  const duplicateDiagnostics = duplicateSourceIds.map((sourceId) => diagnostic('error', 'UXC_SOURCE_ID_DUPLICATE', sourceId, `Duplicate universal source id "${sourceId}".`));
  const sourceDiagnostics = sources.flatMap((source) => source.diagnostics || []);

  return freeze({
    schema: UNIVERSAL_SOURCE_REGISTRY_SCHEMA,
    profileId: profile.profileId,
    sources: freeze(sources),
    sourceMap: freeze(sourceMap),
    primarySources: freeze(sources.filter((source) => source.role === 'primary')),
    sideloadSources: freeze(sources.filter((source) => source.role === 'sideload')),
    requiredColumns: freeze(Object.fromEntries(sources.map((source) => [source.sourceId, source.requiredColumns]))),
    missingColumns: freeze(Object.fromEntries(sources.map((source) => [source.sourceId, source.missingRequiredColumns]))),
    diagnostics: freeze([...duplicateDiagnostics, ...sourceDiagnostics]),
  });
}

export function normalizeSourceInputs(sourceInputs = {}) {
  if (Array.isArray(sourceInputs)) {
    return freeze(Object.fromEntries(sourceInputs.map((input) => [text(input?.sourceId), normalizeSourceInput(input)]).filter(([sourceId]) => sourceId)));
  }
  if (Array.isArray(sourceInputs.sources)) return normalizeSourceInputs(sourceInputs.sources);
  const entries = Object.entries(sourceInputs || {}).map(([sourceId, input]) => [text(input?.sourceId, sourceId), normalizeSourceInput({ sourceId, ...(input || {}) })]).filter(([sourceId]) => sourceId);
  return freeze(Object.fromEntries(entries));
}

export function findForbiddenUxc001Changes(paths = []) {
  return freeze(arr(paths).map((path) => text(path)).filter(isForbiddenUxc001File));
}

export function isForbiddenUxc001File(path = '') {
  const normalized = text(path).replaceAll('\\', '/');
  if (!normalized) return false;
  if (UXC_001_FORBIDDEN_FILES.includes(normalized)) return true;
  if (normalized.startsWith('canvas/')) return true;
  if (normalized.startsWith('xml-compare/canvas')) return true;
  if (normalized.startsWith('xml-compare/pivot') || normalized.includes('/pivot/')) return true;
  if (normalized.startsWith('xml-compare/table-categorizer/table-categorized-pivot')) return true;
  if (normalized.startsWith('tabs/') && normalized.toLowerCase().includes('pivot')) return true;
  return false;
}

export function createLinewiseUniversalSourcePreviewRegistry() {
  return createUniversalSourceRegistry(createLinewiseUniversalPreset(), createLinewiseUniversalSourcePreviewInputs());
}

export function createLinewiseUniversalSourcePreviewInputs() {
  return freeze({
    mainXml: freeze({ columns: freeze(['DocumentRoot']), rows: freeze([]) }),
    lineIdLookup: freeze({ rows: freeze([
      freeze({ FROM_NODE: '10', TO_NODE: '20', LINE_ID: 'LINE-100' }),
      freeze({ FROM_NODE: '30', TO_NODE: '40', LINE_ID: 'LINE-404' }),
    ]) }),
    coordinateLookup: freeze({ rows: freeze([
      freeze({ NODE: '10', GLOBAL_X: '1000', GLOBAL_Y: '2000', GLOBAL_Z: '3000' }),
      freeze({ NODE: '99', GLOBAL_X: '9000', GLOBAL_Y: '9000', GLOBAL_Z: '9000' }),
    ]) }),
    restraintLookup: freeze({ rows: freeze([
      freeze({ NODE: '20', TYPE: 'GUIDE', STIFFNESS: '1000', GAP: '5', TAG: 'RS-20' }),
    ]) }),
  });
}

function normalizeSourceInput(input = {}) {
  const rows = normalizeRows(input.rows || input.previewRows || input.records);
  const declaredColumns = uniqueText([...(arr(input.columns)), ...(arr(input.declaredColumns))]);
  return freeze({
    sourceId: text(input.sourceId),
    columns: declaredColumns,
    rows,
  });
}

function normalizeRows(rows = []) {
  return freeze(arr(rows).map((row) => {
    if (!row || typeof row !== 'object') return freeze({});
    return freeze(Object.fromEntries(Object.entries(row).map(([key, value]) => [text(key), value])));
  }));
}

function findDuplicates(values = []) {
  const seen = new Set(), duplicates = [];
  for (const value of arr(values)) {
    const normalized = text(value);
    if (!normalized) continue;
    if (seen.has(normalized) && !duplicates.includes(normalized)) duplicates.push(normalized);
    seen.add(normalized);
  }
  return freeze(duplicates);
}

function diagnostic(severity, code, sourceId, message) {
  return freeze({ severity, code, sourceId, message });
}

export const _test = freeze({ normalizeRows, findDuplicates, diagnostic });
