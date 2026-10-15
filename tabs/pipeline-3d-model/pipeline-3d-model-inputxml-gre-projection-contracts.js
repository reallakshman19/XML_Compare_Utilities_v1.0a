export const PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA = 'PipelineInputXmlGreProjectionPlan.v1';
export const PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA = 'PipelineInputXmlGreProjectedElement.v1';
export const PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA = 'PipelineInputXmlGreBendProjection.v1';
export const PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA = 'PipelineInputXmlGreSourceConservation.v1';
export const PIPELINE_INPUTXML_GRE_PROJECTION_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_INPUTXML_GRE_PROJECTION_INPUT_INVALID',
  'PIPELINE_INPUTXML_GRE_MATERIALIZATION_UNAUTHENTICATED',
  'PIPELINE_INPUTXML_GRE_NODE_IDENTITY_INVALID',
  'PIPELINE_INPUTXML_GRE_ELEMENT_IDENTITY_INVALID',
  'PIPELINE_INPUTXML_GRE_BEND_OWNERSHIP_INVALID',
  'PIPELINE_INPUTXML_GRE_INACTIVE_CORNER_REAPPEARED',
  'PIPELINE_INPUTXML_GRE_NODE_ALLOCATION_INVALID',
  'PIPELINE_INPUTXML_GRE_LINEAGE_CONSERVATION_INVALID',
  'PIPELINE_INPUTXML_GRE_ZERO_LENGTH_ELEMENT_UNRESOLVED',
  'PIPELINE_INPUTXML_GRE_PROJECTION_COVERAGE_INVALID',
  'PIPELINE_INPUTXML_GRE_WRITER_ADMISSION_BLOCKED',
]);

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));

export function clonePipelineInputXmlGreProjectionValue(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Projection evidence numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(clonePipelineInputXmlGreProjectionValue);
  if (!plain(value)) throw new TypeError('Projection evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, clonePipelineInputXmlGreProjectionValue(value[key])]));
}
export function freezePipelineInputXmlGreProjectionValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezePipelineInputXmlGreProjectionValue);
  return Object.freeze(value);
}
export function createPipelineInputXmlGreProjectionDiagnostic(code, details = {}) {
  return freezePipelineInputXmlGreProjectionValue({ severity: 'BLOCKING', code: text(code),
    message: text(code), details: clonePipelineInputXmlGreProjectionValue(details) });
}
function rank(code) {
  const index = PIPELINE_INPUTXML_GRE_PROJECTION_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_INPUTXML_GRE_PROJECTION_BLOCKER_ORDER.length : index;
}
export function finalizePipelineInputXmlGreProjectionState(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freezePipelineInputXmlGreProjectionValue({
      severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code),
      details: plain(item.details) ? clonePipelineInputXmlGreProjectionValue(item.details) : {},
    });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
export function safePipelineInputXmlGreProjectionInput(input) {
  try {
    const source = clonePipelineInputXmlGreProjectionValue(input);
    if (plain(source)) return { source, diagnostics: [] };
  } catch { /* Fail closed. */ }
  return { source: {}, diagnostics: [createPipelineInputXmlGreProjectionDiagnostic(
    'PIPELINE_INPUTXML_GRE_PROJECTION_INPUT_INVALID')] };
}
export function createPipelineInputXmlGreProjectionPlan(input = {}, diagnostics = []) {
  const state = finalizePipelineInputXmlGreProjectionState(diagnostics);
  return freezePipelineInputXmlGreProjectionValue({
    schema: PIPELINE_INPUTXML_GRE_PROJECTION_PLAN_SCHEMA,
    sourceMaterializationPlanSchema: text(input.sourceMaterializationPlanSchema),
    sourceMaterializedModelSchema: text(input.sourceMaterializedModelSchema),
    projectedElements: state.ready ? clonePipelineInputXmlGreProjectionValue(input.projectedElements || []) : [],
    bendProjections: state.ready ? clonePipelineInputXmlGreProjectionValue(input.bendProjections || []) : [],
    sourceElementConservation: state.ready
      ? clonePipelineInputXmlGreProjectionValue(input.sourceElementConservation || []) : [],
    inactiveCornerReferences: state.ready
      ? clonePipelineInputXmlGreProjectionValue(input.inactiveCornerReferences || []) : [],
    notApplicableCandidateIds: state.ready
      ? clonePipelineInputXmlGreProjectionValue(input.notApplicableCandidateIds || []) : [],
    coverage: clonePipelineInputXmlGreProjectionValue(input.coverage || {}),
    coordinateRouteAdopted: false, canvasAdopted: false,
    projectionStatus: state.ready ? 'READY' : 'BLOCKED',
    documentAuthorityAdopted: false,
    writerAdmission: state.ready ? 'NOT_ADOPTED' : 'BLOCKED',
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready,
  });
}
export const buildPipelineInputXmlGreProjectionPlanJson = (plan) => JSON.stringify(plan, null, 2);
