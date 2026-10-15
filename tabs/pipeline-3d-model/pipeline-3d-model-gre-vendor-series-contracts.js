import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js';
import { PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA, parsePipelinePositiveScalar } from './pipeline-3d-model-diameter-contracts.js';
import { GRE_PLACEHOLDER_SCHEMA } from './pipeline-3d-model-gre-placeholder.js';
export const PIPELINE_GRE_VENDOR_POLICY_REGISTRY_SCHEMA = 'PipelineGreVendorSeriesPolicyRegistry.v1',
  PIPELINE_GRE_VENDOR_POLICY_DESCRIPTOR_SCHEMA = 'PipelineGreVendorSeriesPolicyDescriptor.v1';
export const PIPELINE_GRE_VENDOR_MIGRATION_SCHEMA = 'PipelineGreVendorSeriesMigration.v1',
  PIPELINE_GRE_VENDOR_PLAN_SCHEMA = 'PipelineGreVendorSeriesPlan.v1';
export const PIPELINE_GRE_VENDOR_SECTION_SCHEMA = 'PipelineGreVendorSeriesSectionResolution.v1',
  PIPELINE_GRE_VENDOR_ELEMENT_SCHEMA = 'PipelineGreVendorSeriesElementResolution.v1';
export const PIPELINE_GRE_VENDOR_POLICY_IDS = Object.freeze({ BEND: 'gre-vendor-qualified-bend', TEE: 'gre-vendor-qualified-tee' });
export const PIPELINE_GRE_VENDOR_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'PIPELINE_GRE_VENDOR_POLICY_INVALID',
  'PIPELINE_GRE_VENDOR_PROFILE_INCOMPATIBLE', 'PIPELINE_GRE_VENDOR_TARGET_INVALID',
  'PIPELINE_GRE_VENDOR_SOURCE_CONFLICT', 'PIPELINE_GRE_VENDOR_AUTHORITY_UNRESOLVED',
  'PIPELINE_GRE_VENDOR_LEGACY_AUTHORITY_UNCONFIRMED', 'PIPELINE_GRE_VENDOR_IDENTITY_INVALID',
  'PIPELINE_GRE_VENDOR_QUALIFICATION_REQUIRED', 'PIPELINE_GRE_VENDOR_REQUIREMENT_REFERENCE_REQUIRED',
  'PIPELINE_GRE_VENDOR_NOMINAL_BORE_REQUIRED', 'PIPELINE_GRE_VENDOR_NOMINAL_BORE_CONFLICT',
  'PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID', 'PIPELINE_GRE_VENDOR_TEE_INPUT_INVALID',
  'PIPELINE_GRE_VENDOR_DIAMETER_PLAN_INVALID', 'PIPELINE_GRE_VENDOR_OWNERSHIP_INVALID',
  'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID',
]);
const DESCRIPTORS = Object.freeze([
  Object.freeze({ schema: PIPELINE_GRE_VENDOR_POLICY_DESCRIPTOR_SCHEMA,
    componentPolicyId: PIPELINE_GRE_VENDOR_POLICY_IDS.BEND, componentKind: 'BEND',
    dimensionalAuthority: 'QUALIFIED_VENDOR_SERIES', sourceAuthority: 'P3D-PROF-045', status: 'CONTRACT_ONLY' }),
  Object.freeze({ schema: PIPELINE_GRE_VENDOR_POLICY_DESCRIPTOR_SCHEMA,
    componentPolicyId: PIPELINE_GRE_VENDOR_POLICY_IDS.TEE, componentKind: 'TEE',
    dimensionalAuthority: 'QUALIFIED_VENDOR_SERIES', sourceAuthority: 'P3D-PROF-045', status: 'CONTRACT_ONLY' }),
]);
const text = (value) => typeof value === 'string' ? value.trim() : ''; const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const supplied = (source, field) => Object.hasOwn(source, field) && source[field] !== null && source[field] !== undefined && !(typeof source[field] === 'string' && !source[field].trim());
const strictStrings = (source, fields) => fields.filter((field) => supplied(source, field) && typeof source[field] !== 'string');
function clone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('GRE vendor-series input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
export const clonePipelineGreVendorJson = clone;
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
export function createPipelineGreVendorDiagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
const rank = (code) => {
  const index = PIPELINE_GRE_VENDOR_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_GRE_VENDOR_BLOCKER_ORDER.length : index;
};
function normalizedDiagnostics(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const value = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message), details: plain(item.details) ? clone(item.details) : {} });
    keyed[`${value.code}:${JSON.stringify(value.details)}`] = value;
  });
  return Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
}
function finalState(source, generated = [], extraCodes = []) {
  const diagnostics = normalizedDiagnostics([...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...generated]);
  const codes = [...(Array.isArray(source.blockerCodes) ? source.blockerCodes : []), ...extraCodes,
    ...diagnostics.map((item) => item.code)].filter((code) => typeof code === 'string').map(text).filter(Boolean);
  const blockerCodes = Object.freeze([...new Set(codes)].sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
function safe(input, code) {
  try { const source = clone(input); if (plain(source)) return { source, errors: [] }; } catch { /* blocked */ }
  return { source: {}, errors: [createPipelineGreVendorDiagnostic(code, 'Input must be JSON-safe plain data.')] };
}
const canonical = (value) => JSON.stringify(Object.fromEntries(Object.keys(value || {}).sort(compare).map((key) => [key, value[key]])));
const uniqueText = (values) => Object.freeze([...new Set(values.map(text).filter(Boolean))].sort(compare));
export function createPipelineGreVendorSeriesPolicyRegistry(descriptors = DESCRIPTORS) {
  const safeValue = safe({ descriptors }, 'PIPELINE_GRE_VENDOR_POLICY_INVALID');
  const values = Array.isArray(safeValue.source.descriptors) ? safeValue.source.descriptors : [];
  const valid = values.length === DESCRIPTORS.length && values.every((item, index) => plain(item)
    && item.componentPolicyId === DESCRIPTORS[index].componentPolicyId
    && canonical(item) === canonical(DESCRIPTORS[index]));
  const errors = [...safeValue.errors];
  if (!valid) errors.push(createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_POLICY_INVALID',
    'Registry must contain exactly the canonical GRE bend and tee policies in canonical order.'));
  const state = finalState({}, errors);
  return freeze({ schema: PIPELINE_GRE_VENDOR_POLICY_REGISTRY_SCHEMA,
    descriptors: Object.freeze((valid ? values : []).map(clone).map(freeze)),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export const PIPELINE_GRE_VENDOR_SERIES_POLICY_REGISTRY = createPipelineGreVendorSeriesPolicyRegistry();
export function createPipelineGreVendorSeriesMigration(input = {}) {
  const safeValue = safe(input, 'PIPELINE_GRE_VENDOR_INPUT_INVALID'), source = safeValue.source;
  const errors = [...safeValue.errors], kinds = Array.isArray(source.sourceKinds) ? source.sourceKinds : [];
  const ids = Array.isArray(source.legacyAnalysisSectionIds) ? source.legacyAnalysisSectionIds : [];
  if (source.schema !== undefined && source.schema !== PIPELINE_GRE_VENDOR_MIGRATION_SCHEMA) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Migration schema must be exact.'));
  if (source.sourceKinds !== undefined && (!Array.isArray(source.sourceKinds)
    || kinds.some((value) => typeof value !== 'string' || !text(value)))) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_INPUT_INVALID', 'sourceKinds must contain nonblank strings.'));
  const invalidIds = ids.some((value) => typeof value !== 'string' || !/^AS[1-9]\d*$/.test(text(value)));
  if (source.legacyAnalysisSectionIds !== undefined && (!Array.isArray(source.legacyAnalysisSectionIds) || invalidIds)) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_INPUT_INVALID', 'legacyAnalysisSectionIds must contain canonical AS IDs.'));
  if (new Set(ids.map(text)).size !== ids.length) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'legacyAnalysisSectionIds must be unique before normalization.'));
  const observed = source.legacyEvidenceObserved === true, confirmed = source.legacyGreVendorSeriesBasisConfirmed === true;
  const confirmedKind = kinds.includes('CONFIRMED_LEGACY_GRE_PLACEHOLDER'), hasIds = ids.length > 0;
  if (observed && !hasIds) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Observed legacy evidence requires at least one legacy analysis section ID.'));
  if (hasIds && !observed) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Legacy analysis section IDs require observed legacy evidence.'));
  if (confirmed && !observed) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Legacy confirmation cannot exist without observed legacy evidence.'));
  if (observed && !confirmed) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_LEGACY_AUTHORITY_UNCONFIRMED', 'Observed legacy GRE vendor-series evidence requires confirmation.'));
  if (confirmedKind && (!observed || !confirmed || !hasIds)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_LEGACY_AUTHORITY_UNCONFIRMED', 'Confirmed legacy source requires observed, confirmed section evidence.'));
  if (hasIds && !confirmedKind) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Legacy section IDs require a selected confirmed-legacy source kind.'));
  const state = finalState(source, errors);
  return freeze({ schema: PIPELINE_GRE_VENDOR_MIGRATION_SCHEMA, sourceKinds: uniqueText(kinds),
    legacyAnalysisSectionIds: uniqueText(ids), legacyEvidenceObserved: observed,
    legacyGreVendorSeriesBasisConfirmed: confirmed, sourceAuthority: text(source.sourceAuthority),
    sourceReference: text(source.sourceReference), diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready });
}
const SERIES_TEXT_FIELDS = Object.freeze(['vendorId', 'seriesId', 'qualificationEvidenceId',
  'requirementReference', 'bendPolicyId', 'bendBreakLengthBasis', 'teePolicyId', 'teeBreakLengthBasis',
  'sourceKind', 'sourceAuthority', 'sourceReference']);
function seriesErrors(source, bore) {
  const errors = [], invalidTypes = strictStrings(source, SERIES_TEXT_FIELDS);
  if (invalidTypes.length) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_IDENTITY_INVALID', 'Identity, evidence and provenance fields must be strings.', { fields: invalidTypes }));
  if (['vendorId', 'seriesId', 'sourceKind', 'sourceAuthority', 'sourceReference'].some((field) => !text(source[field]))) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_IDENTITY_INVALID', 'Vendor, series and provenance identity must be nonblank strings.'));
  if (!text(source.qualificationEvidenceId)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_QUALIFICATION_REQUIRED', 'qualificationEvidenceId must be a nonblank string.'));
  if (!text(source.requirementReference)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_REQUIREMENT_REFERENCE_REQUIRED', 'requirementReference must be a nonblank string.'));
  if (!bore) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_NOMINAL_BORE_REQUIRED', 'A positive GRE vendor nominal bore is required.'));
  const bend = ['bendRadiusMm', 'bendBreakLengthMm', 'bendLocalThicknessMm']
    .map((field) => parsePipelinePositiveScalar(source[field]));
  const basis = text(source.bendBreakLengthBasis), multiplier = parsePipelinePositiveScalar(source.bendBreakMultiplierBore);
  if (source.bendPolicyId !== PIPELINE_GRE_VENDOR_POLICY_IDS.BEND || bend.some((value) => !value)
    || !['NOMINAL_BORE_MULTIPLIER', 'EXPLICIT_LENGTH'].includes(basis)) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID', 'Qualified bend dimensions are invalid.'));
  if (basis === 'NOMINAL_BORE_MULTIPLIER' && (!multiplier || !bore
    || Math.abs(bend[1] - bore * multiplier) > 0.000001)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID', 'Multiplier bend break length must equal bore * multiplier.'));
  if (basis === 'EXPLICIT_LENGTH' && supplied(source, 'bendBreakMultiplierBore')) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_BEND_INPUT_INVALID', 'Explicit bend break length cannot include a multiplier.'));
  if (source.teePolicyId !== PIPELINE_GRE_VENDOR_POLICY_IDS.TEE || text(source.teeBreakLengthBasis) !== 'EXPLICIT_LENGTH'
    || !parsePipelinePositiveScalar(source.teeBreakLengthMm) || !parsePipelinePositiveScalar(source.teeLocalThicknessMm)) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_TEE_INPUT_INVALID', 'Qualified tee dimensions are invalid.'));
  return errors;
}
function identityErrors(source, element = false) {
  const errors = [], profileId = text(source.profileId), sectionId = text(source.analysisSectionId);
  if (strictStrings(source, ['profileId', 'analysisSectionId']).length
    || getPipelineEngineeringProfile(profileId)?.profileId !== 'gre') errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_PROFILE_INCOMPATIBLE', 'GRE resolution requires exact string profileId gre.'));
  if (!/^AS[1-9]\d*$/.test(sectionId)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_OWNERSHIP_INVALID', 'Canonical string analysis-section identity is required.'));
  if (element && (!Number.isInteger(source.elementIndex) || source.elementIndex < 0
    || typeof source.elementId !== 'string' || text(source.elementId) !== `E${source.elementIndex + 1}`
    || typeof source.sectionDisposition !== 'string'
    || !['SECTION_START', 'INHERITED'].includes(text(source.sectionDisposition)))) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_OWNERSHIP_INVALID', 'Canonical element identity and disposition are required.'));
  if (!element && (!Number.isInteger(source.startElementIndex) || source.startElementIndex < 0)) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_OWNERSHIP_INVALID', 'A nonnegative section start is required.'));
  return errors;
}
const blockedAuthority = (source) => source.status === 'BLOCKED'
  && ((Array.isArray(source.blockerCodes) && source.blockerCodes.length)
    || (Array.isArray(source.diagnostics) && source.diagnostics.some((item) => item?.severity === 'BLOCKING')));
export function createPipelineGreVendorSeriesSectionResolution(input = {}) {
  const safeValue = safe(input, 'PIPELINE_GRE_VENDOR_INPUT_INVALID'), source = safeValue.source;
  const bore = parsePipelinePositiveScalar(source.greVendorNominalBoreMm);
  const errors = [...safeValue.errors, ...identityErrors(source)];
  const typeErrors = strictStrings(source, SERIES_TEXT_FIELDS);
  if (blockedAuthority(source) && typeErrors.length) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_IDENTITY_INVALID', 'Supplied identity fields must be strings.', { fields: typeErrors }));
  if (!blockedAuthority(source)) errors.push(...seriesErrors(source, bore));
  const state = finalState(source, errors), scalar = (field) => parsePipelinePositiveScalar(source[field]);
  return freeze({ schema: PIPELINE_GRE_VENDOR_SECTION_SCHEMA, analysisSectionId: text(source.analysisSectionId),
    startElementIndex: Number.isInteger(source.startElementIndex) ? source.startElementIndex : null,
    profileId: text(source.profileId), vendorId: text(source.vendorId), seriesId: text(source.seriesId),
    qualificationEvidenceId: text(source.qualificationEvidenceId), requirementReference: text(source.requirementReference),
    greVendorNominalBoreMm: bore, bendPolicyId: text(source.bendPolicyId), bendRadiusMm: scalar('bendRadiusMm'),
    bendBreakLengthBasis: text(source.bendBreakLengthBasis), bendBreakMultiplierBore: scalar('bendBreakMultiplierBore'),
    bendBreakLengthMm: scalar('bendBreakLengthMm'), bendLocalThicknessMm: scalar('bendLocalThicknessMm'),
    teePolicyId: text(source.teePolicyId), teeBreakLengthBasis: text(source.teeBreakLengthBasis),
    teeBreakLengthMm: scalar('teeBreakLengthMm'), teeLocalThicknessMm: scalar('teeLocalThicknessMm'),
    sourceKind: text(source.sourceKind), sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    status: state.ready ? 'RESOLVED' : 'BLOCKED', diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready });
}
export function createPipelineGreVendorSeriesElementResolution(input = {}) {
  const safeValue = safe(input, 'PIPELINE_GRE_VENDOR_INPUT_INVALID'), source = safeValue.source;
  const bore = parsePipelinePositiveScalar(source.greVendorNominalBoreMm);
  const errors = [...safeValue.errors, ...identityErrors(source, true)];
  const fields = ['vendorId', 'seriesId', 'sourceKind'], invalidTypes = strictStrings(source, fields);
  if (invalidTypes.length) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_IDENTITY_INVALID', 'Element identity and provenance fields must be strings.', { fields: invalidTypes }));
  if (!blockedAuthority(source) && (fields.some((field) => !text(source[field])) || !bore)) errors.push(
    createPipelineGreVendorDiagnostic('PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID', 'Resolved elements require vendor-series identity.'));
  const state = finalState(source, errors);
  return freeze({ schema: PIPELINE_GRE_VENDOR_ELEMENT_SCHEMA,
    elementIndex: Number.isInteger(source.elementIndex) ? source.elementIndex : null,
    elementId: text(source.elementId), analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
    vendorId: text(source.vendorId), seriesId: text(source.seriesId), greVendorNominalBoreMm: bore,
    sectionDisposition: text(source.sectionDisposition), sourceKind: text(source.sourceKind),
    status: state.ready ? 'RESOLVED' : 'BLOCKED', diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready });
}
function coverageErrors(sections, elements, notApplicable) {
  const errors = [], byId = Object.create(null), starts = Object.create(null), excluded = Object.create(null);
  if (sections.length + notApplicable.length === 0) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'The represented section and not-applicable union must be nonempty.'));
  sections.forEach((item, index) => {
    const previous = sections[index - 1], number = Number(item.analysisSectionId.slice(2));
    const ordered = !previous || number > Number(previous.analysisSectionId.slice(2));
    if (byId[item.analysisSectionId] || starts[item.startElementIndex] || !ordered) errors.push(createPipelineGreVendorDiagnostic(
      'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'GRE section identities must be unique and follow increasing starts.'));
    byId[item.analysisSectionId] = item; starts[item.startElementIndex] = true;
  });
  const seenIndexes = Object.create(null), seenIds = Object.create(null);
  elements.forEach((item) => {
    const owner = byId[item.analysisSectionId], expected = owner?.startElementIndex === item.elementIndex ? 'SECTION_START' : 'INHERITED';
    const conserved = owner && item.elementIndex >= owner.startElementIndex
      && ['profileId', 'vendorId', 'seriesId', 'greVendorNominalBoreMm', 'sourceKind']
        .every((field) => item[field] === owner[field]);
    if (seenIndexes[item.elementIndex] || seenIds[item.elementId] || !owner
      || item.sectionDisposition !== expected || !conserved) errors.push(createPipelineGreVendorDiagnostic(
      'PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID', 'Element identity must exactly conserve its owning section assignment.'));
    seenIndexes[item.elementIndex] = true; seenIds[item.elementId] = true;
  });
  sections.forEach((section) => {
    const owned = elements.filter((item) => item.analysisSectionId === section.analysisSectionId);
    if (!owned.length || !owned.some((item) => item.elementIndex === section.startElementIndex
      && item.sectionDisposition === 'SECTION_START')) errors.push(createPipelineGreVendorDiagnostic(
      'PIPELINE_GRE_VENDOR_ELEMENT_COVERAGE_INVALID', 'Every GRE section must own its exact section-start element.'));
  });
  notApplicable.forEach((id) => {
    if (excluded[id] || byId[id] || !/^AS[1-9]\d*$/.test(id)) errors.push(createPipelineGreVendorDiagnostic(
      'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'Not-applicable sections must be canonical, unique and disjoint.'));
    excluded[id] = true;
  });
  const union = [...Object.keys(byId), ...Object.keys(excluded)].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  if (union.some((id, index) => id !== `AS${index + 1}`)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'Represented section coverage must be canonical and complete.'));
  return errors;
}
function migrationCoverageErrors(migration, sections) {
  const errors = [], expectedKinds = uniqueText(sections.map((item) => item.sourceKind));
  const expectedLegacy = uniqueText(sections.filter((item) => item.sourceKind === 'CONFIRMED_LEGACY_GRE_PLACEHOLDER')
    .map((item) => item.analysisSectionId));
  const legacy = expectedLegacy.length > 0;
  if (canonical(migration.sourceKinds) !== canonical(expectedKinds)
    || canonical(migration.legacyAnalysisSectionIds) !== canonical(expectedLegacy)
    || migration.legacyEvidenceObserved !== legacy
    || migration.legacyGreVendorSeriesBasisConfirmed !== legacy) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_SOURCE_CONFLICT', 'Migration evidence must exactly conserve resolved section source kinds.'));
  return errors;
}
export function createPipelineGreVendorSeriesPlan(input = {}) {
  const safeValue = safe(input, 'PIPELINE_GRE_VENDOR_INPUT_INVALID'), source = safeValue.source;
  const errors = [...safeValue.errors];
  if (source.analysisSectionPlanSchema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    || source.analysisDiameterPlanSchema !== PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA
    || source.grePlaceholderSchema !== GRE_PLACEHOLDER_SCHEMA) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_INPUT_INVALID', 'Exact analysis, diameter and GRE placeholder schemas are required.'));
  if (!Array.isArray(source.sectionResolutions) || !Array.isArray(source.elementResolutions)
    || !Array.isArray(source.notApplicableAnalysisSectionIds)) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'Section, element and not-applicable arrays are required.'));
  const migration = createPipelineGreVendorSeriesMigration(source.migration || {});
  const sections = Object.freeze((Array.isArray(source.sectionResolutions) ? source.sectionResolutions : [])
    .map(createPipelineGreVendorSeriesSectionResolution).sort((a, b) => a.startElementIndex - b.startElementIndex));
  const elements = Object.freeze((Array.isArray(source.elementResolutions) ? source.elementResolutions : [])
    .map(createPipelineGreVendorSeriesElementResolution).sort((a, b) => a.elementIndex - b.elementIndex));
  const rawNotApplicable = Array.isArray(source.notApplicableAnalysisSectionIds) ? source.notApplicableAnalysisSectionIds : [];
  if (rawNotApplicable.some((id) => typeof id !== 'string')
    || new Set(rawNotApplicable.map(text)).size !== rawNotApplicable.length) errors.push(createPipelineGreVendorDiagnostic(
    'PIPELINE_GRE_VENDOR_SECTION_COVERAGE_INVALID', 'Not-applicable IDs must be unique canonical strings.'));
  const notApplicable = Object.freeze(rawNotApplicable.map(text).filter(Boolean).sort(compare));
  errors.push(...coverageErrors(sections, elements, notApplicable), ...migrationCoverageErrors(migration, sections));
  const nested = [migration, ...sections, ...elements];
  const state = finalState(source, [...errors, ...nested.flatMap((item) => item.diagnostics)],
    nested.flatMap((item) => item.blockerCodes));
  return freeze({ schema: PIPELINE_GRE_VENDOR_PLAN_SCHEMA,
    analysisSectionPlanSchema: text(source.analysisSectionPlanSchema),
    analysisDiameterPlanSchema: text(source.analysisDiameterPlanSchema), grePlaceholderSchema: text(source.grePlaceholderSchema),
    migration, sectionResolutions: sections, elementResolutions: elements,
    notApplicableAnalysisSectionIds: notApplicable, diagnostics: state.diagnostics,
    blockerCodes: state.blockerCodes, ready: state.ready && nested.every((item) => item.ready) });
}
