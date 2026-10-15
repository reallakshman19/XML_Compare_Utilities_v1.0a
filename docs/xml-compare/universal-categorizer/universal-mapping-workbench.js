import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from './universal-source-registry.js';

export const UNIVERSAL_MAPPING_WORKBENCH_SCHEMA = 'universal-mapping-workbench/v1-shadow';
const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createLinewiseUniversalMappingWorkbench(profile = createLinewiseUniversalPreset()) {
  return createUniversalMappingWorkbench({ profile: profile || createLinewiseUniversalPreset() });
}

export function createUniversalMappingWorkbench(input = {}) {
  const profile = normalizeUniversalCategorizerProfile(input.profile || input.profileInput || createLinewiseUniversalPreset());
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow' ? input.registry : createUniversalSourceRegistry(profile, input.sourceInputs || input.sources || {});
  const rows = freeze(profile.sources.flatMap((source) => mappingRowsForSource(profile, registrySourceFor(registry, source), source)));
  const diagnostics = freeze(mappingDiagnostics(profile, registry, rows));
  return freeze({
    schema: UNIVERSAL_MAPPING_WORKBENCH_SCHEMA,
    profileId: profile.profileId,
    title: 'Mapping Workbench',
    kicker: 'Source-to-recipe mapping',
    status: diagnostics.some((item) => item.severity === 'error') ? 'blocked' : 'review-only',
    description: 'Review how source columns are proposed for recipe levels, blocks, keys, and fields. No mapping is applied automatically.',
    summary: freeze({
      sources: profile.sources.length,
      columns: rows.length,
      proposals: rows.filter((row) => row.status === 'Proposed').length,
      keyMappings: rows.filter((row) => row.role.includes('key')).length,
      fieldMappings: rows.filter((row) => row.role.includes('field')).length,
      unmapped: rows.filter((row) => row.status === 'Unmapped').length,
      diagnostics: diagnostics.length,
    }),
    columns: freeze(['Source field', 'Target recipe location', 'Role', 'Status']),
    rows,
    actions: freeze([
      action('accept-mapping', 'Accept mapping'),
      action('edit-target', 'Edit target'),
      action('ignore-column', 'Ignore column'),
      action('create-derived-field', 'Create derived field'),
    ]),
    diagnostics,
  });
}

function mappingRowsForSource(profile, registrySource = {}, source = {}) {
  const columns = sourceColumns(source, registrySource);
  return columns.map((column, index) => mappingRow(profile, source, column, index));
}
function mappingRow(profile, source, column, index) {
  const proposal = proposeTarget(profile, source, column);
  return freeze({
    rowId: `${text(source.sourceId)}:${text(column)}:${index}`,
    sourceId: text(source.sourceId),
    sourceName: text(source.displayName, source.sourceId),
    sourceField: text(column),
    targetLevelId: proposal.targetLevelId,
    targetBlock: proposal.targetBlock,
    targetField: proposal.targetField,
    targetLocation: proposal.targetLocation,
    role: proposal.role,
    status: proposal.status,
    confidence: proposal.confidence,
    reason: proposal.reason,
  });
}
function proposeTarget(profile, source, column) {
  const sourceId = text(source.sourceId);
  const field = text(column);
  const fieldLower = field.toLowerCase();
  const attachment = profile.sideloadAttachments.find((rule) => rule.sourceId === sourceId && keyParts(rule.sourceKey).includes(field));
  if (attachment) return proposal(attachment.attachToLevelId, attachment.blockName, attachment.targetKey || field, 'source key', 'Proposed', 'high', `Matches attachment key ${attachment.sourceKey}.`);
  const blockAttachment = profile.sideloadAttachments.find((rule) => rule.sourceId === sourceId);
  if (blockAttachment && field && !keyParts(blockAttachment.sourceKey).includes(field)) return proposal(blockAttachment.attachToLevelId, blockAttachment.blockName, field, 'attached field', 'Proposed', fieldLower.includes('tag') || fieldLower.includes('global') ? 'high' : 'medium', `Belongs to ${blockAttachment.blockName} sideload source.`);
  if (source.role === 'primary') return proposal('documentRoot', 'DocumentRoot', field || 'documentRoot', 'source anchor', 'Proposed', 'medium', 'Primary source anchors the document root.');
  if (fieldLower.includes('node')) return proposal('node', 'Node', field, 'candidate key', 'Proposed', 'medium', 'Column name looks like a node key.');
  if (fieldLower.includes('line')) return proposal('line', 'LineBlock', field, 'candidate field', 'Proposed', 'medium', 'Column name looks line-related.');
  return proposal('', '', field, 'available field', 'Unmapped', 'low', 'No recipe rule currently targets this column.');
}
function mappingDiagnostics(profile, registry, rows) {
  const diagnostics = [];
  for (const source of arr(registry.sources)) {
    for (const column of arr(source.missingRequiredColumns)) diagnostics.push(diagnostic('warn', 'UXC_MAPPING_REQUIRED_COLUMN_MISSING', source.sourceId, `Required source column ${column} is missing from ${source.displayName || source.sourceId}.`));
  }
  for (const source of profile.sources) {
    const hasRows = rows.some((row) => row.sourceId === source.sourceId);
    if (!hasRows) diagnostics.push(diagnostic('info', 'UXC_MAPPING_SOURCE_HAS_NO_COLUMNS', source.sourceId, `No columns are available yet for ${source.displayName || source.sourceId}.`));
  }
  return diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subjectId}`.localeCompare(`${b.severity}:${b.code}:${b.subjectId}`));
}
function sourceColumns(source = {}, registrySource = {}) {
  const values = [...arr(registrySource.columns), ...arr(source.requiredColumns), ...arr(source.optionalColumns)].map(text).filter(Boolean);
  return freeze([...new Set(values)].sort((a, b) => a.localeCompare(b)));
}
function registrySourceFor(registry, source) { return arr(registry.sources).find((item) => item.sourceId === source.sourceId) || {}; }
function keyParts(value) { return text(value).split('+').map(text).filter(Boolean); }
function proposal(targetLevelId, targetBlock, targetField, role, status, confidence, reason) { return freeze({ targetLevelId, targetBlock, targetField, targetLocation: [targetLevelId, targetBlock, targetField].filter(Boolean).join(' / ') || '—', role, status, confidence, reason }); }
function diagnostic(severity, code, subjectId, message) { return freeze({ severity, code, subjectId, message }); }
function action(actionId, label) { return freeze({ actionId, label, enabled: false, locked: true, lockedReason: 'locked-shadow-mode' }); }

export const _test = freeze({ mappingRowsForSource, mappingRow, proposeTarget, mappingDiagnostics, sourceColumns, registrySourceFor, keyParts, proposal, diagnostic, action });
