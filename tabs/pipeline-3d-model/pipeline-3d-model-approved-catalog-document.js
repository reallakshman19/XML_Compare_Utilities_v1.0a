import {
  PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA,
  resolvePipelineApprovedCatalogRegistry,
} from './pipeline-3d-model-approved-catalog-registry.js';
import {
  PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA,
  resolvePipelineApprovedCatalogRegistryBindingPlan,
} from './pipeline-3d-model-approved-catalog-registry-binding.js';

export const PIPELINE_APPROVED_CATALOG_DOCUMENT_ADOPTION_SCHEMA =
  'PipelineApprovedCatalogDocumentAdoption.v1';

const DOCUMENT_SCHEMA = 'PipelineInputXmlDocumentPlan.v1';
const text = (value) => String(value ?? '').trim();

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

function documentValid(plan) {
  return plain(plan) && plan.schema === DOCUMENT_SCHEMA
    && Array.isArray(plan.elements) && Array.isArray(plan.diagnostics)
    && Array.isArray(plan.blockerCodes);
}

function uniqueDiagnostics(items) {
  const keys = new Set();
  return items.filter((item) => {
    const key = `${text(item?.code)}:${JSON.stringify(item?.details || {})}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function blockerCodes(diagnostics) {
  return freeze([...new Set(diagnostics.map((item) => text(item?.code)).filter(Boolean))]);
}

function invalidDocument(documentPlan) {
  const diagnostics = freeze(uniqueDiagnostics([
    ...(Array.isArray(documentPlan?.diagnostics) ? clone(documentPlan.diagnostics) : []),
    diagnostic('PIPELINE_APPROVED_CATALOG_DOCUMENT_INVALID',
      'Approved catalog adoption requires a Pipeline InputXML document plan.',
      { expectedSchema: DOCUMENT_SCHEMA, actualSchema: documentPlan?.schema }),
  ]));
  const base = plain(documentPlan) ? clone(documentPlan) : {};
  return freeze({
    ...base,
    schema: text(base.schema) || DOCUMENT_SCHEMA,
    diagnostics,
    blockerCodes: blockerCodes(diagnostics),
    ready: false,
  });
}

export function adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
  documentPlan = null,
  approvedCatalogRegistry = null,
} = {}) {
  if (!documentValid(documentPlan)) return invalidDocument(documentPlan);

  const authorityActive = authorityPlanActive(documentPlan.pipingCodeAuthorityPlan)
    || authorityPlanActive(documentPlan.allowableValueAuthorityPlan);
  const active = approvedCatalogRegistry != null || authorityActive;
  if (!active) return documentPlan;

  const registryPlan = resolvePipelineApprovedCatalogRegistry(approvedCatalogRegistry);
  const bindingPlan = resolvePipelineApprovedCatalogRegistryBindingPlan({
    registryPlan: approvedCatalogRegistry == null ? null : registryPlan,
    pipingCodeAuthorityPlan: documentPlan.pipingCodeAuthorityPlan ?? null,
    allowableValueAuthorityPlan: documentPlan.allowableValueAuthorityPlan ?? null,
  });
  const diagnostics = freeze(uniqueDiagnostics([
    ...clone(documentPlan.diagnostics),
    ...(approvedCatalogRegistry == null ? [] : clone(registryPlan.diagnostics)),
    ...clone(bindingPlan.diagnostics),
  ]));
  const adoption = freeze({
    schema: PIPELINE_APPROVED_CATALOG_DOCUMENT_ADOPTION_SCHEMA,
    active: true,
    registryReference: bindingPlan.registryReference ?? registryPlan.registryReference ?? null,
    registryReady: registryPlan.ready === true,
    bindingReady: bindingPlan.ready === true,
    bindingCount: bindingPlan.bindingCount,
    ready: registryPlan.ready === true && bindingPlan.ready === true,
  });

  return freeze({
    ...clone(documentPlan),
    approvedCatalogAdoption: adoption,
    approvedCatalogRegistryPlan: registryPlan,
    approvedCatalogRegistryPlanSchema: PIPELINE_APPROVED_CATALOG_REGISTRY_SCHEMA,
    approvedCatalogRegistryBindingPlan: bindingPlan,
    approvedCatalogRegistryBindingPlanSchema:
      PIPELINE_APPROVED_CATALOG_REGISTRY_BINDING_PLAN_SCHEMA,
    diagnostics,
    blockerCodes: blockerCodes(diagnostics),
    ready: diagnostics.length === 0,
  });
}

export const buildPipelineApprovedCatalogDocumentPlanJson = (plan) =>
  JSON.stringify(plan, null, 2);
