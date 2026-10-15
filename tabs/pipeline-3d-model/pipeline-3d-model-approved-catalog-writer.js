import { buildPipelineInputXmlDocumentPlan, PIPELINE_INPUTXML_DOCUMENT_SCHEMA } from './pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from './pipeline-3d-model-xml-builder.js';
import {
  adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan,
} from './pipeline-3d-model-approved-catalog-document.js';
import {
  pipelineApprovedCatalogAttachedAncestryEqual,
  pipelineApprovedCatalogAttachedAncestryPresent,
  resolvePipelineApprovedCatalogAttachedAuthentication,
} from './pipeline-3d-model-approved-catalog-attached-authentication.js';

export const PIPELINE_APPROVED_CATALOG_WRITER_QUALIFICATION_SCHEMA =
  'PipelineApprovedCatalogWriterQualification.v1';

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

function uniqueDiagnostics(items) {
  const keys = new Set();
  return items.filter((item) => {
    const key = `${text(item?.code)}:${JSON.stringify(item?.details || {})}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function authorityPlanActive(plan) {
  return plain(plan) && (plan.active === true
    || (Array.isArray(plan.authorities) && plan.authorities.length > 0));
}

function baseDocument({ documentPlan, documentInput }) {
  if (documentPlan?.schema === PIPELINE_INPUTXML_DOCUMENT_SCHEMA) return documentPlan;
  return buildPipelineInputXmlDocumentPlan(documentInput || {});
}

export function resolvePipelineApprovedCatalogWriterQualification({
  documentPlan = null,
  documentInput = null,
  approvedCatalogRegistry = null,
} = {}) {
  const base = baseDocument({ documentPlan, documentInput });
  const authorityActive = authorityPlanActive(base.pipingCodeAuthorityPlan)
    || authorityPlanActive(base.allowableValueAuthorityPlan);
  const baseAttached = pipelineApprovedCatalogAttachedAncestryPresent(base);
  const active = approvedCatalogRegistry != null || authorityActive || baseAttached;
  const adopted = active
    ? adoptPipelineApprovedCatalogRegistryIntoInputXmlDocumentPlan({
      documentPlan: base, approvedCatalogRegistry,
    })
    : base;
  const adoptedAuthentication = resolvePipelineApprovedCatalogAttachedAuthentication(adopted);
  const baseAuthentication = baseAttached
    ? resolvePipelineApprovedCatalogAttachedAuthentication(base) : null;
  const diagnostics = freeze(clone(uniqueDiagnostics([
    ...(adopted?.diagnostics || []),
    ...(adoptedAuthentication.diagnostics || []),
    ...(baseAuthentication?.diagnostics || []),
    ...(baseAttached && !pipelineApprovedCatalogAttachedAncestryEqual(base, adopted)
      ? [diagnostic('PIPELINE_APPROVED_CATALOG_WRITER_ATTACHED_ANCESTRY_MISMATCH',
        'Attached registry ancestry must exactly match evidence regenerated from the approved registry.')]
      : []),
  ])));
  const blockerCodes = freeze([...new Set(diagnostics.map((item) => text(item?.code)).filter(Boolean))]);
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_WRITER_QUALIFICATION_SCHEMA,
    active,
    documentPlan: adopted,
    registryReference: adopted?.approvedCatalogAdoption?.registryReference ?? null,
    bindingCount: adopted?.approvedCatalogRegistryBindingPlan?.bindingCount ?? 0,
    diagnostics,
    blockerCodes,
    ready: adopted?.ready === true && adoptedAuthentication.ready === true
      && diagnostics.length === 0,
  });
}

export function buildPipelineApprovedCatalogQualifiedInputXml(input = {}) {
  const qualification = resolvePipelineApprovedCatalogWriterQualification(input);
  if (!qualification.ready) {
    const first = qualification.diagnostics[0];
    const error = new Error(first?.message || 'Approved catalog writer qualification failed.');
    error.code = first?.code || 'PIPELINE_APPROVED_CATALOG_WRITER_BLOCKED';
    error.details = first?.details || {};
    error.blockerCodes = qualification.blockerCodes;
    throw error;
  }
  return buildInputXmlPipingModelXml(qualification.documentPlan);
}

export const buildPipelineApprovedCatalogWriterQualificationJson = (qualification) =>
  JSON.stringify(qualification, null, 2);

export const _internal = Object.freeze({
  pipelineApprovedCatalogAttachedAncestryEqual,
  pipelineApprovedCatalogAttachedAncestryPresent,
  resolvePipelineApprovedCatalogAttachedAuthentication,
});
