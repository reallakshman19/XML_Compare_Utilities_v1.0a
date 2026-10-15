export const PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA = 'PipelineApprovedCatalogRegistry.v1';
export const PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SCHEMA = 'PipelineApprovedCatalogRegistrySource.v1';

const PIPING_CODE_ENTRY_SCHEMA = 'PipelinePipingCodeCatalogEntry.v1';
const MATERIAL_ALLOWABLE_ENTRY_SCHEMA = 'PipelineMaterialAllowableCatalogEntry.v1';
const SHA256 = /^[a-f0-9]{64}$/i;
const text = (value) => String(value ?? '').trim();

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (plain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}

export function approvedCatalogRegistryReferenceKey(source) {
  return `${text(source?.registryId)}@${text(source?.revision)}#sha256:${text(source?.sha256).toLowerCase()}`;
}

function normalizedSource(source, diagnostics) {
  if (!plain(source)) {
    diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_INVALID',
      'Approved catalog registry source must be a plain object.'));
    return null;
  }
  const registryId = text(source.registryId);
  const title = text(source.title);
  const revision = text(source.revision);
  const approvalReference = text(source.approvalReference);
  const sha256 = text(source.sha256).toLowerCase();
  const caesarVersion = text(source.caesarVersion);
  if (!registryId || !title || !revision || !approvalReference) {
    diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_FIELD_INVALID',
      'Registry source identity fields must be nonblank.',
      { registryId, title, revision, approvalReference }));
  }
  if (!SHA256.test(sha256)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SHA256_INVALID',
    'Registry source identity requires a 64-hex SHA-256 digest.', { sha256 }));
  if (caesarVersion !== '14.00') diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_REGISTRY_VERSION_INVALID',
    'Approved catalog registry must target the CAESAR 14 writer profile.', { caesarVersion }));
  if (!registryId || !title || !revision || !approvalReference
    || !SHA256.test(sha256) || caesarVersion !== '14.00') return null;
  const identity = {
    schema: PIPELINE_APPROVED_CATALOG_REGISTRY_SOURCE_SCHEMA,
    registryId,
    title,
    revision,
    approvalReference,
    sha256,
    caesarVersion,
  };
  return freeze({ ...identity, referenceKey: approvedCatalogRegistryReferenceKey(identity) });
}

function normalizedEntries(inputs, kind, expectedSchema, diagnostics) {
  const arrayCode = kind === 'PIPING_CODE'
    ? 'PIPELINE_APPROVED_CATALOG_REGISTRY_PIPING_ENTRIES_INVALID'
    : 'PIPELINE_APPROVED_CATALOG_REGISTRY_MATERIAL_ENTRIES_INVALID';
  if (!Array.isArray(inputs)) {
    diagnostics.push(diagnostic(arrayCode, 'Approved catalog registry entries must be an array.', { kind }));
    return [];
  }
  const byId = new Map();
  inputs.forEach((source, entryIndex) => {
    const catalogEntryId = text(source?.catalogEntryId);
    if (!plain(source) || source.schema !== expectedSchema || !catalogEntryId) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_INVALID',
        'Registry entries must be normalized catalog records with nonblank catalogEntryId.',
        { kind, entryIndex, expectedSchema, actualSchema: source?.schema, catalogEntryId }));
      return;
    }
    if (byId.has(catalogEntryId)) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_ENTRY_ID_DUPLICATE',
        'Catalog entry IDs must be unique within each registry namespace.',
        { kind, catalogEntryId, entryIndexes: [byId.get(catalogEntryId).entryIndex, entryIndex] }));
      return;
    }
    byId.set(catalogEntryId, { entryIndex, entry: freeze(clone(source)) });
  });
  return [...byId.values()].map((item) => item.entry)
    .sort((left, right) => left.catalogEntryId.localeCompare(right.catalogEntryId));
}

function finalPlan(active, source, pipingCodeEntries, materialAllowableEntries, diagnostics) {
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA,
    active,
    source,
    registryReference: source?.referenceKey ?? null,
    entryCount: pipingCodeEntries.length + materialAllowableEntries.length,
    pipingCodeEntryCount: pipingCodeEntries.length,
    materialAllowableEntryCount: materialAllowableEntries.length,
    pipingCodeEntries: freeze(pipingCodeEntries),
    materialAllowableEntries: freeze(materialAllowableEntries),
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}

export function resolvePipelineApprovedCatalogRegistry(registry = null) {
  if (registry == null) return finalPlan(false, null, [], [], []);
  const diagnostics = [];
  if (!plain(registry)) {
    diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_INVALID',
      'Approved catalog registry input must be a plain object.'));
    return finalPlan(true, null, [], [], diagnostics);
  }
  const source = normalizedSource(registry.source, diagnostics);
  const pipingCodeEntries = normalizedEntries(registry.pipingCodeEntries,
    'PIPING_CODE', PIPING_CODE_ENTRY_SCHEMA, diagnostics);
  const materialAllowableEntries = normalizedEntries(registry.materialAllowableEntries,
    'MATERIAL_ALLOWABLE', MATERIAL_ALLOWABLE_ENTRY_SCHEMA, diagnostics);
  return finalPlan(true, source, pipingCodeEntries, materialAllowableEntries, diagnostics);
}

export const buildPipelineApprovedCatalogRegistryJson = (plan) => JSON.stringify(plan, null, 2);
