export const PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_SCHEMA =
  'PipelineApprovedCatalogProductionInput.v1';

export const PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS = Object.freeze([
  'approvedCatalogRegistry',
  'pipingCodeAuthorities',
  'allowableValueAuthorities',
  'allowableStresses',
]);

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

export function pipelineApprovedCatalogProductionInputs(source = {}) {
  const input = plain(source) ? source : {};
  return Object.freeze(Object.fromEntries(
    PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_FIELDS
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, input[field]]),
  ));
}

export function withPipelineApprovedCatalogProductionInputs(base = {}, source = {}) {
  return { ...base, ...pipelineApprovedCatalogProductionInputs(source) };
}

export function buildPipelineApprovedCatalogProductionSourceEvidence(source = {}) {
  const inputs = pipelineApprovedCatalogProductionInputs(source);
  return freeze({
    schema: PIPELINE_APPROVED_CATALOG_PRODUCTION_INPUT_SCHEMA,
    active: Object.keys(inputs).length > 0,
    suppliedFields: freeze(Object.keys(inputs)),
    inputs: freeze(clone(inputs)),
  });
}

export function resolvePipelineApprovedCatalogProductionOutputState(documentPlan = null) {
  const adoption = documentPlan?.approvedCatalogAdoption;
  const bindingPlan = documentPlan?.approvedCatalogRegistryBindingPlan;
  return freeze({
    approvedCatalogAdoptionActive: adoption?.active === true,
    approvedCatalogAdoptionReady: adoption?.ready === true,
    approvedCatalogRegistryReference: adoption?.registryReference ?? null,
    approvedCatalogBindingCount: Number.isInteger(bindingPlan?.bindingCount)
      ? bindingPlan.bindingCount : 0,
  });
}

export const buildPipelineApprovedCatalogProductionInputJson = (source) =>
  JSON.stringify(buildPipelineApprovedCatalogProductionSourceEvidence(source), null, 2);
