export const PIPELINE_ENGINEERING_CONFIGURATION_SCHEMA = 'PipelineEngineeringConfiguration.v1';
export const PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA = 'PipelineEngineeringConfigurationDraft.v1';
export const PIPELINE_ENGINEERING_CONFIGURATION_FIELD_SCHEMA = 'PipelineEngineeringConfigurationField.v1';
export const PIPELINE_ENGINEERING_SECTION_CONFIGURATION_SCHEMA = 'PipelineEngineeringSectionConfiguration.v1';
export const PIPELINE_INPUTXML_BRANCH_CONFIGURATION_SCHEMA = 'PipelineInputXmlBranchConfiguration.v1';
export const PIPELINE_ENGINEERING_CONFIGURATION_MIGRATION_SCHEMA = 'PipelineEngineeringConfigurationMigration.v1';
export const PIPELINE_ENGINEERING_CONFIGURATION_PLAN_SCHEMA = 'PipelineEngineeringConfigurationPlan.v1';
export const PIPELINE_CORE_ORCHESTRATION_SCHEMA = 'PipelineCoreOrchestration.v1';

export const PIPELINE_CONFIGURATION_FIELD_STATES = Object.freeze([
  'UNSET', 'SOURCE_DERIVED', 'USER_ENTERED', 'LEGACY_UNCONFIRMED',
  'CONFIRMED', 'NOT_APPLICABLE', 'INVALID',
]);
export const PIPELINE_CONFIGURATION_SOURCE_KINDS = Object.freeze([
  'SOURCE_TABLE', 'BRANCH_INPUT_BLOCK', 'ANALYSIS_SECTION_INPUT', 'AUTHENTICATED_ASSIGNMENT',
  'USER_SETTINGS_UI', 'CONFIRMED_LEGACY_STORAGE', 'NONE',
]);
export const PIPELINE_CONFIGURATION_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_CONFIGURATION_INPUT_INVALID',
  'PIPELINE_CONFIGURATION_FIELD_REQUIRED',
  'PIPELINE_CONFIGURATION_FIELD_INVALID',
  'PIPELINE_CONFIGURATION_PROFILE_REQUIRED',
  'PIPELINE_CONFIGURATION_USER_CONFIRMATION_REQUIRED',
  'PIPELINE_CONFIGURATION_LEGACY_CONFIRMATION_REQUIRED',
  'PIPELINE_CONFIGURATION_STORAGE_INVALID',
  'PIPELINE_CONFIGURATION_SECTION_PLAN_INVALID',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_MISSING',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_DUPLICATE',
  'PIPELINE_CONFIGURATION_SECTION_EVIDENCE_REORDERED',
  'PIPELINE_CONFIGURATION_SECTION_IDENTITY_STALE',
  'PIPELINE_CONFIGURATION_SECTION_BOUNDARY_MOVED',
  'PIPELINE_CONFIGURATION_SECTION_COVERAGE_INVALID',
  'PIPELINE_CONFIGURATION_DIAMETER_REQUIRED',
  'PIPELINE_CONFIGURATION_PROPERTY_REQUIRED',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_INPUT_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SECTION_PLAN_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_IDENTITY_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PROVENANCE_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SOURCE_STALE',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_TARGET_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_FIELD_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_CONFIRMATION_REQUIRED',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_DUPLICATE',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED',
  'PIPELINE_CONFIGURATION_NORMAL_POLICY_REQUIRED',
  'PIPELINE_CONFIGURATION_B314_POLICY_REQUIRED',
  'PIPELINE_CONFIGURATION_B314_ELASTIC_CRITERIA_REQUIRED',
  'PIPELINE_CONFIGURATION_B314_COLD_FIELD_CRITERIA_REQUIRED',
  'PIPELINE_CONFIGURATION_GRE_VENDOR_REQUIRED',
  'PIPELINE_CONFIGURATION_GRE_BEND_REQUIRED',
  'PIPELINE_CONFIGURATION_GRE_TEE_REQUIRED',
  'PIPELINE_SECTION_PROFILE_ROUTING_INPUT_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_SECTION_PLAN_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_CANDIDATE_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_DUPLICATE_CANDIDATE',
  'PIPELINE_SECTION_PROFILE_ROUTING_UNOWNED_CANDIDATE',
  'PIPELINE_SECTION_PROFILE_ROUTING_PROFILE_INVALID',
  'PIPELINE_SECTION_PROFILE_ROUTING_COVERAGE_INVALID',
  'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED',
  'PIPELINE_CONFIGURATION_RUNTIME_BLOCKED',
  'PIPELINE_CONFIGURATION_INPUTXML_BLOCKED',
]);

const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function clone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Configuration evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function rank(code) {
  const index = PIPELINE_CONFIGURATION_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_CONFIGURATION_BLOCKER_ORDER.length : index;
}
export function createPipelineConfigurationDiagnostic(code, message = code, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
export function orderPipelineConfigurationDiagnostics(values = []) {
  const keyed = Object.create(null);
  for (const item of values) {
    if (!plain(item) || !text(item.code)) continue;
    const normalized = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code), details: plain(item.details) ? clone(item.details) : {} });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  }
  return Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
}
export function pipelineConfigurationBlockerCodes(diagnostics = []) {
  return Object.freeze([...new Set(diagnostics.filter((item) => item.severity === 'BLOCKING')
    .map((item) => item.code))].sort((a, b) => rank(a) - rank(b) || compare(a, b)));
}
function valueMatches(value, valueType) {
  if (value === null) return true;
  if (valueType === 'string') return typeof value === 'string';
  if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (valueType === 'boolean') return typeof value === 'boolean';
  if (valueType === 'json') return Array.isArray(value) || plain(value);
  return false;
}
function fieldDiagnostics(source, value, state, sourceKind) {
  const errors = [];
  if (!text(source.fieldId) || !['string', 'number', 'boolean', 'json'].includes(source.valueType)) errors.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_INVALID',
      'fieldId and exact valueType are required.', { fieldId: source.fieldId, valueType: source.valueType }));
  if (!PIPELINE_CONFIGURATION_FIELD_STATES.includes(state)
    || !PIPELINE_CONFIGURATION_SOURCE_KINDS.includes(sourceKind) || !valueMatches(value, source.valueType)) errors.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_INVALID',
      'Configuration field state, source kind or value type is invalid.', { fieldId: source.fieldId }));
  if (['UNSET', 'NOT_APPLICABLE'].includes(state) && value !== null) errors.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_INVALID',
      'UNSET and NOT_APPLICABLE fields must not carry a value.', { fieldId: source.fieldId }));
  if (state === 'LEGACY_UNCONFIRMED' && (source.legacyObserved !== true
    || source.legacyConfirmed === true || source.userConfirmed === true)) errors.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_LEGACY_CONFIRMATION_REQUIRED',
      'Legacy evidence must remain unconfirmed until an explicit review action.', { fieldId: source.fieldId }));
  if (['SOURCE_DERIVED', 'USER_ENTERED', 'CONFIRMED'].includes(state) && value === null) errors.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_REQUIRED',
      'An authoritative field state requires a value.', { fieldId: source.fieldId }));
  return errors;
}
export function createPipelineEngineeringConfigurationField(input = {}) {
  let source;
  try { source = clone(input); if (!plain(source)) throw new TypeError(); } catch { source = {}; }
  const state = text(source.state) || 'UNSET', sourceKind = text(source.sourceKind) || 'NONE';
  const value = source.value === undefined || source.value === '' ? null : source.value;
  const diagnostics = orderPipelineConfigurationDiagnostics([
    ...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...fieldDiagnostics(source, value, state, sourceKind),
  ]);
  const blockerCodes = pipelineConfigurationBlockerCodes(diagnostics);
  return freeze({ schema: PIPELINE_ENGINEERING_CONFIGURATION_FIELD_SCHEMA,
    fieldId: text(source.fieldId), value, valueType: text(source.valueType), unit: text(source.unit),
    state: blockerCodes.length ? 'INVALID' : state, sourceKind,
    sourceReference: text(source.sourceReference), userConfirmed: source.userConfirmed === true,
    legacyObserved: source.legacyObserved === true, legacyConfirmed: source.legacyConfirmed === true,
    originalLegacyValue: source.originalLegacyValue === undefined ? null : clone(source.originalLegacyValue),
    originalStorageKey: text(source.originalStorageKey), diagnostics, blockerCodes,
    ready: blockerCodes.length === 0 && !['UNSET', 'LEGACY_UNCONFIRMED', 'INVALID'].includes(state) });
}
function normalizedFields(values) {
  if (!plain(values)) return Object.freeze({});
  return freeze(Object.fromEntries(Object.keys(values).sort(compare).map((key) => [key,
    createPipelineEngineeringConfigurationField({ fieldId: key, ...values[key] })])));
}
function rootRecord(schema, source, extra = {}) {
  const diagnostics = orderPipelineConfigurationDiagnostics(Array.isArray(source.diagnostics)
    ? source.diagnostics : []), blockerCodes = pipelineConfigurationBlockerCodes(diagnostics);
  return freeze({ schema, ...extra, diagnostics, blockerCodes, ready: blockerCodes.length === 0 });
}
export function createPipelineEngineeringConfigurationDraft(input = {}) {
  let source;
  try { source = clone(input); if (!plain(source)) throw new TypeError(); } catch {
    source = { diagnostics: [createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_INPUT_INVALID')] };
  }
  const fields = normalizedFields(source.fields);
  const sections = freeze(Array.isArray(source.sections) ? source.sections.map(clone) : []);
  const diagnostics = [...(Array.isArray(source.diagnostics) ? source.diagnostics : []),
    ...Object.values(fields).flatMap((field) => field.diagnostics)];
  return rootRecord(PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA, { diagnostics }, {
    storageKey: text(source.storageKey), fields, sections,
    sectionPropertyAssignments: freeze(Array.isArray(source.sectionPropertyAssignments)
      ? source.sectionPropertyAssignments.map(clone) : []),
    normalPolicies: freeze(Array.isArray(source.normalPolicies) ? source.normalPolicies.map(clone) : []),
    b314Policies: freeze(Array.isArray(source.b314Policies) ? source.b314Policies.map(clone) : []),
    greVendorSeries: freeze(Array.isArray(source.greVendorSeries) ? source.greVendorSeries.map(clone) : []),
    legacyRejectedFields: freeze(Array.isArray(source.legacyRejectedFields)
      ? [...new Set(source.legacyRejectedFields.map(text).filter(Boolean))].sort(compare) : []) });
}
export function createPipelineEngineeringConfigurationMigration(input = {}) {
  const source = plain(input) ? input : {};
  return rootRecord(PIPELINE_ENGINEERING_CONFIGURATION_MIGRATION_SCHEMA, source, {
    sourceStorageKeys: freeze(Array.isArray(source.sourceStorageKeys)
      ? [...new Set(source.sourceStorageKeys.map(text).filter(Boolean))].sort(compare) : []),
    observedFieldIds: freeze(Array.isArray(source.observedFieldIds)
      ? [...new Set(source.observedFieldIds.map(text).filter(Boolean))].sort(compare) : []),
    confirmedFieldIds: freeze(Array.isArray(source.confirmedFieldIds)
      ? [...new Set(source.confirmedFieldIds.map(text).filter(Boolean))].sort(compare) : []),
    rejectedFieldIds: freeze(Array.isArray(source.rejectedFieldIds)
      ? [...new Set(source.rejectedFieldIds.map(text).filter(Boolean))].sort(compare) : []) });
}
function optionalScalar(value) {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function createPipelineEngineeringSectionConfiguration(input = {}) {
  const source = plain(input) ? input : {}, diagnostics = [...(Array.isArray(source.diagnostics) ? source.diagnostics : [])];
  const startElementIndex = source.startElementIndex, outsideDiameterMm = optionalScalar(source.outsideDiameterMm);
  const nominalPipeSizeNps = optionalScalar(source.nominalPipeSizeNps);
  const greVendorNominalBoreMm = optionalScalar(source.greVendorNominalBoreMm);
  if (!/^AS[1-9]\d*$/.test(text(source.analysisSectionId)) || !Number.isInteger(startElementIndex)
    || startElementIndex < 0 || !['normal-metallic', 'asme-b31.4', 'gre'].includes(text(source.profileId))) diagnostics.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_SECTION_COVERAGE_INVALID',
      'Section identity, start and profile must be canonical.', { analysisSectionId: source.analysisSectionId }));
  if (!(outsideDiameterMm > 0)) diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_DIAMETER_REQUIRED', 'Physical outside diameter is required.',
    { analysisSectionId: source.analysisSectionId }));
  const ordered = orderPipelineConfigurationDiagnostics(diagnostics), blockerCodes = pipelineConfigurationBlockerCodes(ordered);
  return freeze({ schema: PIPELINE_ENGINEERING_SECTION_CONFIGURATION_SCHEMA,
    analysisSectionId: text(source.analysisSectionId), startElementIndex, profileId: text(source.profileId),
    outsideDiameterMm, nominalPipeSizeNps, greVendorNominalBoreMm,
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    boundaryAuthority: text(source.boundaryAuthority), boundarySourceReference: text(source.boundarySourceReference),
    diagnostics: ordered, blockerCodes, ready: blockerCodes.length === 0 });
}
export function createPipelineInputXmlBranchConfiguration(input = {}) {
  const source = plain(input) ? input : {}, diagnostics = [...(Array.isArray(source.diagnostics) ? source.diagnostics : [])];
  for (const fieldId of ['jobName', 'caesarVersion', 'branchName', 'lineNo']) if (!text(source[fieldId])) diagnostics.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_REQUIRED',
      'Required branch/InputXML field is missing.', { fieldId }));
  const numeric = (key) => optionalScalar(source[key]);
  const arrays = (key) => freeze(Array.from({ length: 9 }, (_, index) => optionalScalar(source[key]?.[index])));
  const ordered = orderPipelineConfigurationDiagnostics(diagnostics), blockerCodes = pipelineConfigurationBlockerCodes(ordered);
  return freeze({ schema: PIPELINE_INPUTXML_BRANCH_CONFIGURATION_SCHEMA,
    jobName: text(source.jobName), issueNo: text(source.issueNo), caesarVersion: text(source.caesarVersion),
    branchName: text(source.branchName), lineNo: text(source.lineNo),
    outsideDiameterMm: numeric('outsideDiameterMm'), diameter: numeric('outsideDiameterMm'),
    wallThickness: numeric('wallThickness'), materialNumber: numeric('materialNumber'),
    corrosionAllowance: numeric('corrosionAllowance'), insulationThickness: numeric('insulationThickness'),
    insulationDensity: numeric('insulationDensity'), fluidDensity: numeric('fluidDensity'),
    hydroPressure: numeric('hydroPressure'), temperatures: arrays('temperatures'), pressures: arrays('pressures'),
    diagnostics: ordered, blockerCodes, ready: blockerCodes.length === 0 });
}
export function createPipelineEngineeringConfiguration(input = {}) {
  const source = plain(input) ? input : {}, draft = createPipelineEngineeringConfigurationDraft(source.draft || {});
  const plan = createPipelineEngineeringConfigurationPlan(source.plan || {});
  const diagnostics = orderPipelineConfigurationDiagnostics([
    ...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...draft.diagnostics, ...plan.diagnostics]);
  const blockerCodes = pipelineConfigurationBlockerCodes(diagnostics);
  return freeze({ schema: PIPELINE_ENGINEERING_CONFIGURATION_SCHEMA, draft, plan,
    diagnostics, blockerCodes, ready: blockerCodes.length === 0 && plan.ready });
}
function nestedDiagnostics(value) { return plain(value) && Array.isArray(value.diagnostics) ? value.diagnostics : []; }
export function createPipelineEngineeringConfigurationPlan(input = {}) {
  const source = plain(input) ? input : {}, fields = normalizedFields(source.fields);
  const branchInfo = createPipelineInputXmlBranchConfiguration(source.branchInfo || {});
  const analysisSections = freeze((Array.isArray(source.analysisSections) ? source.analysisSections : [])
    .map(createPipelineEngineeringSectionConfiguration));
  const diagnostics = orderPipelineConfigurationDiagnostics([
    ...(Array.isArray(source.diagnostics) ? source.diagnostics : []),
    ...Object.values(fields).flatMap((field) => field.diagnostics), ...branchInfo.diagnostics,
    ...analysisSections.flatMap((section) => section.diagnostics),
    ...nestedDiagnostics(source.sectionConfigurationConformance),
    ...nestedDiagnostics(source.sectionPropertyAssignmentPlan),
  ]), blockerCodes = pipelineConfigurationBlockerCodes(diagnostics);
  return freeze({ schema: PIPELINE_ENGINEERING_CONFIGURATION_PLAN_SCHEMA,
    draftSchema: text(source.draftSchema), migration: source.migration ? freeze(clone(source.migration)) : null,
    fields, branchInfo, analysisSections,
    canonicalAnalysisSectionPlan: source.canonicalAnalysisSectionPlan ? freeze(clone(source.canonicalAnalysisSectionPlan)) : null,
    sectionConfigurationConformance: source.sectionConfigurationConformance
      ? freeze(clone(source.sectionConfigurationConformance)) : null,
    sectionPropertyAssignmentPlan: source.sectionPropertyAssignmentPlan
      ? freeze(clone(source.sectionPropertyAssignmentPlan)) : null,
    diameterSections: freeze(clone(source.diameterSections || [])), bendSettings: freeze(clone(source.bendSettings || {})),
    normalFittingPolicy: source.normalFittingPolicy ? freeze(clone(source.normalFittingPolicy)) : null,
    normalFittingSections: freeze(clone(source.normalFittingSections || [])),
    normalFittingOverrides: freeze(clone(source.normalFittingOverrides || [])),
    b314RadiusPolicies: freeze(clone(source.b314RadiusPolicies || [])),
    b314RadiusSections: freeze(clone(source.b314RadiusSections || [])),
    b314RadiusOverrides: freeze(clone(source.b314RadiusOverrides || [])),
    greVendorSeries: freeze(clone(source.greVendorSeries || [])),
    greVendorSeriesSections: freeze(clone(source.greVendorSeriesSections || [])),
    diagnostics, blockerCodes, ready: blockerCodes.length === 0 });
}
export const buildPipelineEngineeringConfigurationJson = (value) => JSON.stringify(value, null, 2);
export function buildPipelineEngineeringConfigurationBlockerText(value) {
  const header = ['Code', 'Severity', 'FieldId', 'Message'];
  const rows = (value?.diagnostics || []).map((item) => [item.code, item.severity,
    item.details?.fieldId || '', item.message]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
