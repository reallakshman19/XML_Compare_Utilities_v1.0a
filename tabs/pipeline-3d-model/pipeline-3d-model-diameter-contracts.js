import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js';

export const PIPELINE_DIAMETER_SEMANTIC_REGISTRY_SCHEMA = 'PipelineDiameterSemanticRegistry.v1';
export const PIPELINE_DIAMETER_SEMANTIC_DESCRIPTOR_SCHEMA = 'PipelineDiameterSemanticDescriptor.v1';
export const PIPELINE_DIAMETER_MIGRATION_SCHEMA = 'PipelineDiameterMigration.v1';
export const PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA = 'PipelineAnalysisDiameterPlan.v1';
export const PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA = 'PipelineAnalysisDiameterResolution.v1';
export const PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA = 'PipelineElementDiameterResolution.v1';
export const PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA = 'PipelinePropertySectionPlan.v1';

export const PIPELINE_DIAMETER_BASIS_IDS = Object.freeze({
  OUTSIDE_DIAMETER_MM: 'outside-diameter-mm',
  NOMINAL_PIPE_SIZE_NPS: 'nominal-pipe-size-nps',
  GRE_VENDOR_NOMINAL_BORE_MM: 'gre-vendor-nominal-bore-mm',
});
export const PIPELINE_DIAMETER_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_DIAMETER_INPUT_INVALID', 'PIPELINE_DIAMETER_BASIS_INVALID',
  'PIPELINE_DIAMETER_BASIS_UNCONFIRMED', 'PIPELINE_OUTSIDE_DIAMETER_REQUIRED',
  'PIPELINE_OUTSIDE_DIAMETER_INVALID', 'PIPELINE_OUTSIDE_DIAMETER_CONFLICT',
  'PIPELINE_NPS_INVALID', 'PIPELINE_GRE_VENDOR_BORE_REQUIRED',
  'PIPELINE_GRE_VENDOR_BORE_INVALID', 'PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE',
  'PIPELINE_DIAMETER_SOURCE_CONFLICT', 'PIPELINE_DIAMETER_CHANGE_REQUIRES_ANALYSIS_SECTION',
  'PIPELINE_DIAMETER_PROPERTY_MISMATCH', 'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID',
]);
const DESCRIPTORS = Object.freeze([
  Object.freeze({ schema: PIPELINE_DIAMETER_SEMANTIC_DESCRIPTOR_SCHEMA,
    basisId: 'outside-diameter-mm', displayName: 'Physical Outside Diameter',
    semanticRole: 'PHYSICAL_OUTSIDE_DIAMETER', unit: 'mm', physicalMeasurement: true,
    caesarDiameterEligible: true, physicalDMultiplierEligible: true, sizeBandInputEligible: false,
    vendorSeriesInputEligible: false, sourceAuthority: 'P3D-PROF-042', status: 'CONTRACT_ONLY' }),
  Object.freeze({ schema: PIPELINE_DIAMETER_SEMANTIC_DESCRIPTOR_SCHEMA,
    basisId: 'nominal-pipe-size-nps', displayName: 'Nominal Pipe Size',
    semanticRole: 'NOMINAL_PIPE_SIZE', unit: 'NPS', physicalMeasurement: false,
    caesarDiameterEligible: false, physicalDMultiplierEligible: false, sizeBandInputEligible: true,
    vendorSeriesInputEligible: false, sourceAuthority: 'P3D-PROF-042', status: 'CONTRACT_ONLY' }),
  Object.freeze({ schema: PIPELINE_DIAMETER_SEMANTIC_DESCRIPTOR_SCHEMA,
    basisId: 'gre-vendor-nominal-bore-mm', displayName: 'GRE Vendor Nominal Bore',
    semanticRole: 'GRE_VENDOR_NOMINAL_BORE', unit: 'mm-or-vendor-designation', physicalMeasurement: false,
    caesarDiameterEligible: false, physicalDMultiplierEligible: false, sizeBandInputEligible: false,
    vendorSeriesInputEligible: true, sourceAuthority: 'P3D-PROF-042', status: 'CONTRACT_ONLY' }),
]);
const text = (value) => String(value ?? '').trim();
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
function cloneJson(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!plain(value)) throw new TypeError('Diameter contract input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, cloneJson(value[key])]));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return deepFreeze({ severity: 'BLOCKING', code, message, details: cloneJson(details) });
}
const rank = (code) => {
  const index = PIPELINE_DIAMETER_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_DIAMETER_BLOCKER_ORDER.length : index;
};
function normalizedDiagnostics(values = []) {
  const keyed = Object.create(null);
  (Array.isArray(values) ? values : []).filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const value = deepFreeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message), details: plain(item.details) ? cloneJson(item.details) : {} });
    keyed[`${value.code}:${JSON.stringify(value.details)}`] = value;
  });
  return Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compareText(a.code, b.code) || compareText(JSON.stringify(a.details), JSON.stringify(b.details))));
}
function orderedCodes(diagnostics, supplied = []) {
  const keyed = Object.create(null);
  [...(Array.isArray(supplied) ? supplied : []), ...diagnostics.map((item) => item.code)]
    .map(text).filter(Boolean).forEach((code) => { keyed[code] = true; });
  return Object.freeze(Object.keys(keyed).sort((a, b) => rank(a) - rank(b) || compareText(a, b)));
}
function safeInput(input, code) {
  try {
    const source = cloneJson(input);
    if (plain(source)) return { source, errors: [] };
  } catch { /* Deterministic blocked contract. */ }
  return { source: {}, errors: [diagnostic(code, 'Input must be JSON-safe plain data.')] };
}
function finalState(source, generated, extraCodes = []) {
  const diagnostics = normalizedDiagnostics([...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...generated]);
  const blockerCodes = orderedCodes(diagnostics, [
    ...(Array.isArray(source.blockerCodes) ? source.blockerCodes : []), ...extraCodes,
  ]);
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
export function parsePipelinePositiveScalar(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function canonical(value) {
  return JSON.stringify(Object.fromEntries(Object.keys(value || {}).sort(compareText).map((key) => [key, value[key]])));
}
export function createPipelineDiameterSemanticRegistry(descriptors = DESCRIPTORS) {
  const safe = safeInput({ descriptors }, 'PIPELINE_DIAMETER_BASIS_INVALID');
  const values = Array.isArray(safe.source.descriptors) ? safe.source.descriptors : [];
  const valid = values.length === DESCRIPTORS.length && values.every((item, index) =>
    plain(item) && item.basisId === DESCRIPTORS[index].basisId && canonical(item) === canonical(DESCRIPTORS[index]));
  const errors = [...safe.errors];
  if (!valid) errors.push(diagnostic('PIPELINE_DIAMETER_BASIS_INVALID',
    'Diameter semantic registry must contain the exact canonical descriptors in canonical order.'));
  const final = finalState({}, errors);
  return deepFreeze({ schema: PIPELINE_DIAMETER_SEMANTIC_REGISTRY_SCHEMA,
    descriptors: Object.freeze((valid ? values : []).map(cloneJson).map(deepFreeze)),
    diagnostics: final.diagnostics, blockerCodes: final.blockerCodes, ready: final.ready });
}
export const PIPELINE_DIAMETER_SEMANTIC_REGISTRY = createPipelineDiameterSemanticRegistry();
export function getPipelineDiameterSemanticDescriptor(basisId, registry = PIPELINE_DIAMETER_SEMANTIC_REGISTRY) {
  if (registry?.schema !== PIPELINE_DIAMETER_SEMANTIC_REGISTRY_SCHEMA || registry?.ready !== true) return null;
  return (registry.descriptors || []).find((item) => item.basisId === text(basisId)) || null;
}
function uniqueText(values) {
  const keyed = Object.create(null);
  (Array.isArray(values) ? values : []).map(text).filter(Boolean).forEach((value) => { keyed[value] = true; });
  return Object.freeze(Object.keys(keyed).sort(compareText));
}
export function createPipelineDiameterMigration(input = {}) {
  const safe = safeInput(input, 'PIPELINE_DIAMETER_INPUT_INVALID'), source = safe.source;
  const errors = [...safe.errors];
  for (const field of ['outsideDiameterSourceKinds', 'nominalPipeSizeSourceKinds', 'greVendorNominalBoreSourceKinds']) {
    if (source[field] !== undefined && !Array.isArray(source[field])) errors.push(diagnostic(
      'PIPELINE_DIAMETER_INPUT_INVALID', `${field} must be an array when supplied.`));
  }
  if (source.npsToOutsideDiameterConversionApplied === true || source.greVendorBoreToOutsideDiameterConversionApplied === true) {
    errors.push(diagnostic('PIPELINE_DIAMETER_BASIS_INVALID', 'Forbidden diameter conversion evidence cannot be accepted.'));
  }
  if (source.legacyDiameterEvidenceObserved === true && source.legacyDiameterBasisConfirmed !== true) {
    errors.push(diagnostic('PIPELINE_DIAMETER_BASIS_UNCONFIRMED', 'Observed legacy diameter evidence is not confirmed as physical OD.'));
  }
  const final = finalState(source, errors);
  return deepFreeze({ schema: PIPELINE_DIAMETER_MIGRATION_SCHEMA,
    outsideDiameterSourceKinds: uniqueText(source.outsideDiameterSourceKinds),
    nominalPipeSizeSourceKinds: uniqueText(source.nominalPipeSizeSourceKinds),
    greVendorNominalBoreSourceKinds: uniqueText(source.greVendorNominalBoreSourceKinds),
    legacyDiameterEvidenceObserved: source.legacyDiameterEvidenceObserved === true,
    legacyDiameterBasisConfirmed: source.legacyDiameterBasisConfirmed === true,
    npsToOutsideDiameterConversionApplied: false, greVendorBoreToOutsideDiameterConversionApplied: false,
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    diagnostics: final.diagnostics, blockerCodes: final.blockerCodes, ready: final.ready });
}
function quantityValues(source, includeProperty = false) {
  return { outsideDiameterMm: parsePipelinePositiveScalar(source.outsideDiameterMm),
    nominalPipeSizeNps: parsePipelinePositiveScalar(source.nominalPipeSizeNps),
    greVendorNominalBoreMm: parsePipelinePositiveScalar(source.greVendorNominalBoreMm),
    caesarDiameterMm: parsePipelinePositiveScalar(source.caesarDiameterMm),
    propertyDiameterMm: includeProperty ? parsePipelinePositiveScalar(source.propertyDiameterMm) : null };
}
function quantityErrors(source, includeProperty = false) {
  const pairs = [['outsideDiameterMm', 'PIPELINE_OUTSIDE_DIAMETER_INVALID'],
    ['nominalPipeSizeNps', 'PIPELINE_NPS_INVALID'], ['greVendorNominalBoreMm', 'PIPELINE_GRE_VENDOR_BORE_INVALID'],
    ['caesarDiameterMm', 'PIPELINE_OUTSIDE_DIAMETER_INVALID']];
  if (includeProperty) pairs.push(['propertyDiameterMm', 'PIPELINE_OUTSIDE_DIAMETER_INVALID']);
  return pairs.filter(([field]) => source[field] !== undefined && source[field] !== null)
    .filter(([field]) => parsePipelinePositiveScalar(source[field]) == null)
    .map(([field, code]) => diagnostic(code, `${field} must be a finite positive scalar when supplied.`, { value: source[field] }));
}
function profileErrors(source, values, validateMode) {
  const errors = [], profile = getPipelineEngineeringProfile(text(source.profileId));
  if (!profile) return [diagnostic('PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE',
    'profileId must be an exact canonical engineering profile identifier.', { profileId: text(source.profileId) })];
  if (validateMode && text(source.resolvedMode) !== profile.resolvedMode) errors.push(diagnostic(
    'PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE', 'resolvedMode does not match the canonical profile.',
    { profileId: profile.profileId, expectedMode: profile.resolvedMode, actualMode: text(source.resolvedMode) }));
  const metallic = profile.resolvedMode !== 'GRE';
  if (metallic && values.outsideDiameterMm == null) errors.push(diagnostic(
    'PIPELINE_OUTSIDE_DIAMETER_REQUIRED', 'Metallic profiles require physical outside diameter.', { profileId: profile.profileId }));
  if (!metallic && values.greVendorNominalBoreMm == null) errors.push(diagnostic(
    'PIPELINE_GRE_VENDOR_BORE_REQUIRED', 'GRE requires vendor nominal-bore evidence.', { profileId: profile.profileId }));
  if (metallic && values.greVendorNominalBoreMm != null) errors.push(diagnostic(
    'PIPELINE_DIAMETER_PROFILE_INCOMPATIBLE', 'GRE vendor bore is incompatible with a metallic profile.', { profileId: profile.profileId }));
  if (values.caesarDiameterMm !== values.outsideDiameterMm) errors.push(diagnostic(
    'PIPELINE_DIAMETER_BASIS_INVALID', 'CAESAR diameter must equal independently resolved physical outside diameter.'));
  return errors;
}
export function createPipelineAnalysisDiameterResolution(input = {}) {
  const safe = safeInput(input, 'PIPELINE_DIAMETER_INPUT_INVALID'), source = safe.source;
  const values = quantityValues(source), errors = [...safe.errors, ...quantityErrors(source)];
  if (!/^AS[1-9]\d*$/.test(text(source.analysisSectionId)) || !Number.isInteger(source.startElementIndex)
    || source.startElementIndex < 0 || !text(source.sourceKind)) errors.push(diagnostic(
    'PIPELINE_DIAMETER_INPUT_INVALID', 'Valid AS identity, start index and sourceKind are required.'));
  errors.push(...profileErrors(source, values, true));
  const final = finalState(source, errors);
  return deepFreeze({ schema: PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA,
    analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
    resolvedMode: text(source.resolvedMode), startElementIndex: Number.isInteger(source.startElementIndex) ? source.startElementIndex : null,
    outsideDiameterMm: values.outsideDiameterMm, nominalPipeSizeNps: values.nominalPipeSizeNps,
    greVendorNominalBoreMm: values.greVendorNominalBoreMm, caesarDiameterMm: values.caesarDiameterMm,
    physicalDiameterReady: values.outsideDiameterMm != null, sizeBandInputReady: values.nominalPipeSizeNps != null,
    vendorSeriesInputReady: values.greVendorNominalBoreMm != null, sourceKind: text(source.sourceKind) || 'UNRESOLVED',
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    quantitySources: deepFreeze(plain(source.quantitySources) ? cloneJson(source.quantitySources) : {}),
    status: final.ready ? 'RESOLVED' : 'BLOCKED', diagnostics: final.diagnostics,
    blockerCodes: final.blockerCodes, ready: final.ready });
}
export function createPipelineElementDiameterResolution(input = {}) {
  const safe = safeInput(input, 'PIPELINE_DIAMETER_INPUT_INVALID'), source = safe.source;
  const values = quantityValues(source, true), errors = [...safe.errors, ...quantityErrors(source, true)];
  if (!Number.isInteger(source.elementIndex) || source.elementIndex < 0
    || text(source.elementId) !== `E${source.elementIndex + 1}` || !/^AS[1-9]\d*$/.test(text(source.analysisSectionId))
    || !['SECTION_START', 'INHERITED'].includes(text(source.diameterDisposition)) || !text(source.sourceKind)) {
    errors.push(diagnostic('PIPELINE_DIAMETER_INPUT_INVALID', 'Canonical E/AS identity, disposition and sourceKind are required.'));
  }
  errors.push(...profileErrors(source, values, false));
  const final = finalState(source, errors);
  return deepFreeze({ schema: PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA,
    elementIndex: Number.isInteger(source.elementIndex) ? source.elementIndex : null,
    elementId: text(source.elementId), analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
    ...values, diameterDisposition: text(source.diameterDisposition), sourceKind: text(source.sourceKind) || 'UNRESOLVED',
    diagnostics: final.diagnostics, blockerCodes: final.blockerCodes, ready: final.ready });
}
function coverageErrors(sections, elements) {
  const errors = [], byId = Object.create(null), starts = Object.create(null), indexes = Object.create(null);
  if (!sections.length || !elements.length) errors.push(diagnostic('PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID',
    'At least one section and one element diameter resolution are required.'));
  sections.forEach((section, index) => {
    if (section.analysisSectionId !== `AS${index + 1}` || section.startElementIndex !== (index ? section.startElementIndex : 0)
      || byId[section.analysisSectionId] || starts[section.startElementIndex]) errors.push(diagnostic(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', 'Sections require canonical AS order, unique starts and AS1 at element zero.',
      { analysisSectionId: section.analysisSectionId, startElementIndex: section.startElementIndex }));
    byId[section.analysisSectionId] = section; starts[section.startElementIndex] = true;
  });
  elements.forEach((element, index) => {
    indexes[element.elementIndex] = true;
    if (element.elementIndex !== index || element.elementId !== `E${index + 1}`) errors.push(diagnostic(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', 'Elements require canonical contiguous E identity.', { elementIndex: element.elementIndex }));
    const expected = sections.filter((section) => section.startElementIndex <= element.elementIndex).at(-1);
    if (!expected || expected.analysisSectionId !== element.analysisSectionId || expected.profileId !== element.profileId) errors.push(diagnostic(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', 'Element ownership must follow analysis-section intervals.', { elementIndex: element.elementIndex }));
    const mismatch = expected && ['outsideDiameterMm', 'nominalPipeSizeNps', 'greVendorNominalBoreMm', 'caesarDiameterMm']
      .some((field) => expected[field] !== element[field]);
    if (mismatch) errors.push(diagnostic('PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID',
      'Element diameter quantities must match the owning section.', { elementIndex: element.elementIndex }));
    const shouldStart = expected?.startElementIndex === element.elementIndex;
    if ((element.diameterDisposition === 'SECTION_START') !== shouldStart) errors.push(diagnostic(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', 'Diameter disposition must match the owning section start.', { elementIndex: element.elementIndex }));
  });
  sections.forEach((section) => {
    if (section.startElementIndex >= elements.length) errors.push(diagnostic('PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID',
      'Section start must identify an existing element.', { analysisSectionId: section.analysisSectionId }));
  });
  return errors;
}
export function createPipelineAnalysisDiameterPlan(input = {}) {
  const safe = safeInput(input, 'PIPELINE_DIAMETER_INPUT_INVALID'), source = safe.source;
  const sectionInputs = Array.isArray(source.sectionResolutions) ? source.sectionResolutions : [];
  const elementInputs = Array.isArray(source.elementResolutions) ? source.elementResolutions : [];
  const sections = Object.freeze(sectionInputs.map(createPipelineAnalysisDiameterResolution)
    .sort((a, b) => a.startElementIndex - b.startElementIndex || compareText(a.analysisSectionId, b.analysisSectionId)));
  const elements = Object.freeze(elementInputs.map(createPipelineElementDiameterResolution)
    .sort((a, b) => a.elementIndex - b.elementIndex || compareText(a.elementId, b.elementId)));
  const migration = createPipelineDiameterMigration(source.migration || {}), errors = [...safe.errors];
  if (source.analysisSectionPlanSchema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    || source.propertySectionPlanSchema !== PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA) errors.push(diagnostic(
    'PIPELINE_DIAMETER_INPUT_INVALID', 'Exact analysis-section and property-plan schemas are required.'));
  if (!Array.isArray(source.sectionResolutions) || !Array.isArray(source.elementResolutions)) errors.push(diagnostic(
    'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', 'sectionResolutions and elementResolutions must be arrays.'));
  errors.push(...coverageErrors(sections, elements));
  const records = [migration, ...sections, ...elements];
  const nestedDiagnostics = records.flatMap((item) => item.diagnostics);
  const nestedCodes = records.flatMap((item) => item.blockerCodes);
  const final = finalState(source, [...errors, ...nestedDiagnostics], nestedCodes);
  return deepFreeze({ schema: PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA,
    analysisSectionPlanSchema: text(source.analysisSectionPlanSchema), propertySectionPlanSchema: text(source.propertySectionPlanSchema),
    migration, sectionResolutions: sections, elementResolutions: elements,
    diagnostics: final.diagnostics, blockerCodes: final.blockerCodes,
    ready: final.ready && records.every((item) => item.ready) });
}
