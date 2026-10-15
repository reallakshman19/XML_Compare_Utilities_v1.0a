export const PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA =
  'PipelineApprovedCatalogRegistryBindingPlan.v1';
export const PIPELINE_APPROVED_CATALOG_REGISTRY_SECTION_BINDING_SCHEMA =
  'PipelineApprovedCatalogRegistrySectionBinding.v1';
export const PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_KINDS = Object.freeze([
  'PIPING_CODE', 'MATERIAL_ALLOWABLE',
]);

const REGISTRY_SCHEMA = 'PipelineApprovedCatalogRegistry.v1';
const PIPING_PLAN_SCHEMA = 'PipelinePipingCodeAuthorityPlan.v1';
const ALLOWABLE_PLAN_SCHEMA = 'PipelineAllowableValueAuthorityPlan.v1';
const PIPING_ENTRY_SCHEMA = 'PipelinePipingCodeCatalogEntry.v1';
const MATERIAL_ENTRY_SCHEMA = 'PipelineMaterialAllowableCatalogEntry.v1';
const text = (value) => String(value ?? '').trim();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (plain(value)) return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, clone(item)]));
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

function authorityPlanActive(plan) {
  return plain(plan) && (plan.active === true
    || (Array.isArray(plan.authorities) && plan.authorities.length > 0));
}

function registryReady(plan) {
  return plain(plan) && plan.schema === REGISTRY_SCHEMA && plan.active === true
    && plan.ready === true && plain(plan.source) && Boolean(text(plan.registryReference))
    && Array.isArray(plan.pipingCodeEntries) && Array.isArray(plan.materialAllowableEntries)
    && !(plan.blockerCodes || []).length;
}

function authorityPlanReady(plan, expectedSchema) {
  return plain(plan) && plan.schema === expectedSchema && plan.ready === true
    && Array.isArray(plan.authorities) && !(plan.blockerCodes || []).length;
}

function registryMap(entries) {
  return new Map(entries.map((entry) => [entry.catalogEntryId, entry]));
}

function bindAuthorities({ plan, expectedPlanSchema, expectedEntrySchema, kind,
  registryEntries, registryReference, diagnostics }) {
  if (!authorityPlanActive(plan)) return [];
  if (!authorityPlanReady(plan, expectedPlanSchema)) {
    diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_AUTHORITY_PLAN_INVALID',
      'Registry binding requires a ready normalized catalog-bearing authority plan.',
      { kind, expectedPlanSchema, actualSchema: plan?.schema }));
    return [];
  }
  const byId = registryMap(registryEntries);
  const sections = new Map();
  const bindings = [];
  plan.authorities.forEach((authority, authorityIndex) => {
    const analysisSectionId = text(authority?.analysisSectionId);
    const inlineCatalogEntry = authority?.catalogEntry;
    const catalogEntryId = text(inlineCatalogEntry?.catalogEntryId);
    const authorityCatalogEntryId = text(authority?.catalogEntryId);
    const validAuthority = plain(authority) && analysisSectionId && plain(inlineCatalogEntry)
      && inlineCatalogEntry.schema === expectedEntrySchema && catalogEntryId
      && (!authorityCatalogEntryId || authorityCatalogEntryId === catalogEntryId);
    if (!validAuthority) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_AUTHORITY_INVALID',
        'Section authority requires matching section identity and normalized inline catalog evidence.',
        { kind, authorityIndex, analysisSectionId, catalogEntryId,
          authorityCatalogEntryId, expectedEntrySchema,
          actualEntrySchema: inlineCatalogEntry?.schema }));
      return;
    }
    if (sections.has(analysisSectionId)) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_SECTION_DUPLICATE',
        'Each namespace may bind an analysis section only once.',
        { kind, analysisSectionId,
          authorityIndexes: [sections.get(analysisSectionId), authorityIndex] }));
      return;
    }
    sections.set(analysisSectionId, authorityIndex);
    const registryEntry = byId.get(catalogEntryId);
    if (!registryEntry) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISSING',
        'Inline catalog evidence must exist in the matching approved registry namespace.',
        { kind, authorityIndex, analysisSectionId, catalogEntryId }));
      return;
    }
    if (!same(inlineCatalogEntry, registryEntry)) {
      diagnostics.push(diagnostic('PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_ENTRY_MISMATCH',
        'Inline catalog evidence must exactly match the approved registry entry.',
        { kind, authorityIndex, analysisSectionId, catalogEntryId }));
      return;
    }
    bindings.push(freeze({
      schema: PIPELINE_APPROVED_CATALOG_REGISTRY_SECTION_BINDING_SCHEMA,
      kind,
      authorityIndex,
      analysisSectionId,
      catalogEntryId,
      registryReference,
      inlineCatalogEntry: freeze(clone(inlineCatalogEntry)),
      registryEntry: freeze(clone(registryEntry)),
    }));
  });
  return bindings;
}

function finalPlan(active, registryPlan, bindings, diagnostics) {
  const ordered = [...bindings].sort((left, right) => {
    const kindOrder = PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_KINDS
      .indexOf(left.kind) - PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_KINDS.indexOf(right.kind);
    return kindOrder || left.analysisSectionId.localeCompare(right.analysisSectionId)
      || left.catalogEntryId.localeCompare(right.catalogEntryId);
  });
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA,
    active,
    registryReference: registryPlan?.registryReference ?? null,
    registrySource: registryPlan?.source ? freeze(clone(registryPlan.source)) : null,
    bindingCount: ordered.length,
    pipingCodeBindingCount: ordered.filter((item) => item.kind === 'PIPING_CODE').length,
    materialAllowableBindingCount: ordered.filter((item) => item.kind === 'MATERIAL_ALLOWABLE').length,
    bindings: freeze(ordered),
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}

export function resolvePipelineApprovedCatalogRegistryBindingPlan({
  registryPlan = null,
  pipingCodeAuthorityPlan = null,
  allowableValueAuthorityPlan = null,
} = {}) {
  const authorityActive = authorityPlanActive(pipingCodeAuthorityPlan)
    || authorityPlanActive(allowableValueAuthorityPlan);
  const active = registryPlan != null || authorityActive;
  if (!active) return finalPlan(false, null, [], []);
  const diagnostics = [];
  if (authorityActive && registryPlan == null) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_REQUIRED',
    'Active catalog-bearing authority plans require an approved catalog registry.'));
  if (registryPlan != null && !registryReady(registryPlan)) diagnostics.push(diagnostic(
    'PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_REGISTRY_INVALID',
    'Registry binding requires a ready approved catalog registry plan.',
    { actualSchema: registryPlan?.schema }));
  if (!registryReady(registryPlan)) return finalPlan(true, null, [], diagnostics);
  const common = { registryReference: registryPlan.registryReference, diagnostics };
  const pipingBindings = bindAuthorities({
    ...common,
    plan: pipingCodeAuthorityPlan,
    expectedPlanSchema: PIPING_PLAN_SCHEMA,
    expectedEntrySchema: PIPING_ENTRY_SCHEMA,
    kind: 'PIPING_CODE',
    registryEntries: registryPlan.pipingCodeEntries,
  });
  const materialBindings = bindAuthorities({
    ...common,
    plan: allowableValueAuthorityPlan,
    expectedPlanSchema: ALLOWABLE_PLAN_SCHEMA,
    expectedEntrySchema: MATERIAL_ENTRY_SCHEMA,
    kind: 'MATERIAL_ALLOWABLE',
    registryEntries: registryPlan.materialAllowableEntries,
  });
  return finalPlan(true, registryPlan, [...pipingBindings, ...materialBindings], diagnostics);
}

export const buildPipelineApprovedCatalogRegistryBindingPlanJson = (plan) =>
  JSON.stringify(plan, null, 2);
