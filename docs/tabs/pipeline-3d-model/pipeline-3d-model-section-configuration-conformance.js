export const PIPELINE_SECTION_CONFIGURATION_CONFORMANCE_SCHEMA = 'PipelineSectionConfigurationConformancePlan.v1';

const PROFILES = Object.freeze(['normal-metallic', 'asme-b31.4', 'gre']);
const ORDER = Object.freeze([
  'PIPELINE_CONFIGURATION_SECTION_PLAN_INVALID',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_MISSING',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_DUPLICATE',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_REORDERED',
  'PIPELINE_CONFIGURATION_SECTION_IDENTITY_STALE',
  'PIPELINE_CONFIGURATION_SECTION_BOUNDARY_MOVED',
  'PIPELINE_CONFIGURATION_PROFILE_REQUIRED',
  'PIPELINE_CONFIGURATION_DIAMETER_REQUIRED',
  'PIPELINE_CONFIGURATION_B314_POLICY_REQUIRED',
  'PIPELINE_CONFIGURATION_GRE_VENDOR_REQUIRED',
]);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const scalar = (value) => value === '' || value === null || value === undefined ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}
function rank(code) { const index = ORDER.indexOf(code); return index < 0 ? ORDER.length : index; }
function finalState(values) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    keyed[`${item.code}:${JSON.stringify(item.details || {})}`] = freeze({ severity: text(item.severity) || 'BLOCKING',
      code: text(item.code), message: text(item.message) || text(item.code), details: freeze({ ...(item.details || {}) }) });
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
function canonical(input, errors) {
  const plan = input?.canonicalAnalysisSectionPlan;
  const valid = plain(plan) && plan.schema === 'PipelineAnalysisSectionPlan.v1' && plan.ready === true
    && Array.isArray(plan.sections) && plan.sections.length > 0;
  if (!valid) errors.push(diagnostic('PIPELINE_CONFIGURATION_SECTION_PLAN_INVALID',
    'A ready canonical PipelineAnalysisSectionPlan.v1 is required.'));
  return valid ? plan : { schema: '', sections: [] };
}
function validateEvidence(canonicalSections, evidence, errors) {
  const counts = Object.create(null);
  evidence.forEach((item) => { const id = text(item?.analysisSectionId); counts[id] = (counts[id] || 0) + 1; });
  Object.keys(counts).sort(compare).filter((id) => counts[id] > 1).forEach((id) => errors.push(diagnostic(
    'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_DUPLICATE', 'Section evidence identity is duplicated.',
    { analysisSectionId: id, count: counts[id] })));
  if (evidence.length !== canonicalSections.length) errors.push(diagnostic(
    'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_MISSING', 'One evidence row is required for every canonical section.',
    { canonicalCount: canonicalSections.length, evidenceCount: evidence.length }));
  canonicalSections.forEach((section, index) => {
    const item = evidence[index];
    if (!item) return;
    if (text(item.analysisSectionId) !== section.analysisSectionId) errors.push(diagnostic(
      evidence.some((candidate) => text(candidate?.analysisSectionId) === section.analysisSectionId)
        ? 'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_REORDERED' : 'PIPELINE_CONFIGURATION_SECTION_IDENTITY_STALE',
      'Section evidence must preserve canonical identity and order.',
      { index, expectedAnalysisSectionId: section.analysisSectionId,
        suppliedAnalysisSectionId: text(item.analysisSectionId) }));
    if (item.startElementIndex !== section.startElementIndex) errors.push(diagnostic(
      'PIPELINE_CONFIGURATION_SECTION_BOUNDARY_MOVED', 'Section startElementIndex must match canonical boundary authority.',
      { analysisSectionId: section.analysisSectionId, expectedStartElementIndex: section.startElementIndex,
        suppliedStartElementIndex: item.startElementIndex }));
  });
}
function configuredSection(canonicalSection, item, errors) {
  const profileId = text(item?.profileId), outsideDiameterMm = scalar(item?.outsideDiameterMm);
  const nominalPipeSizeNps = scalar(item?.nominalPipeSizeNps);
  const greVendorNominalBoreMm = scalar(item?.greVendorNominalBoreMm);
  if (!PROFILES.includes(profileId)) errors.push(diagnostic('PIPELINE_CONFIGURATION_PROFILE_REQUIRED',
    'Every canonical section requires an explicit profile.', { analysisSectionId: canonicalSection.analysisSectionId }));
  if (!(outsideDiameterMm > 0)) errors.push(diagnostic('PIPELINE_CONFIGURATION_DIAMETER_REQUIRED',
    'Every canonical section requires explicit physical outside diameter.',
    { analysisSectionId: canonicalSection.analysisSectionId }));
  if (profileId === 'asme-b31.4' && !(nominalPipeSizeNps > 0)) errors.push(diagnostic(
    'PIPELINE_CONFIGURATION_B314_POLICY_REQUIRED', 'B31.4 sections require canonical NPS evidence.',
    { analysisSectionId: canonicalSection.analysisSectionId }));
  if (profileId === 'gre' && !(greVendorNominalBoreMm > 0)) errors.push(diagnostic(
    'PIPELINE_CONFIGURATION_GRE_VENDOR_REQUIRED', 'GRE sections require vendor nominal bore evidence.',
    { analysisSectionId: canonicalSection.analysisSectionId }));
  return freeze({ analysisSectionId: canonicalSection.analysisSectionId,
    startElementIndex: canonicalSection.startElementIndex, profileId, outsideDiameterMm,
    nominalPipeSizeNps, greVendorNominalBoreMm,
    boundaryAuthority: text(canonicalSection.boundaryAuthority),
    boundarySourceReference: text(canonicalSection.boundarySourceReference),
    sourceAuthority: text(item?.sourceAuthority) || 'ENGINEERING_CONFIGURATION',
    sourceReference: text(item?.sourceReference) || `engineering-configuration:${canonicalSection.analysisSectionId}` });
}
export function buildPipelineSectionConfigurationConformance(input = {}) {
  const errors = [], plan = canonical(input, errors);
  const evidence = Array.isArray(input?.sectionEvidence) ? input.sectionEvidence : [];
  validateEvidence(plan.sections, evidence, errors);
  const configuredSections = plan.sections.map((section, index) => configuredSection(section, evidence[index], errors));
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_SECTION_CONFIGURATION_CONFORMANCE_SCHEMA,
    canonicalAnalysisSectionPlanSchema: text(plan.schema), canonicalSections: plan.sections,
    suppliedSectionEvidence: freeze(evidence.map((item) => freeze({ ...(plain(item) ? item : {}) }))),
    configuredSections, diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready });
}
