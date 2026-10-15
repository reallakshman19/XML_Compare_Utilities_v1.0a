import {
  createPipelineConfigurationDiagnostic,
  createPipelineEngineeringConfigurationDraft,
  createPipelineEngineeringConfigurationMigration,
  createPipelineEngineeringConfigurationPlan,
} from './pipeline-3d-model-engineering-configuration-contracts.js';
import {
  PIPELINE_ENGINEERING_FIELD_DEFINITIONS,
  pipelineEngineeringConfigurationFieldValue as fieldValue,
} from './pipeline-3d-model-engineering-configuration-fields.js';
import { createPipelineAnalysisSectionPlan } from './pipeline-3d-model-analysis-section-contracts.js';
import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { buildPipelineSectionConfigurationConformance } from './pipeline-3d-model-section-configuration-conformance.js';
import { buildPipelineSectionPropertyAssignmentPlan } from './pipeline-3d-model-section-property-assignment.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function requiredField(draft, fieldId, diagnostics) {
  const value = fieldValue(draft, fieldId);
  if (value === null || value === '') diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_FIELD_REQUIRED', 'Required configuration field is missing.', { fieldId }));
  return value;
}
function branchProjection(draft, diagnostics) {
  return {
    jobName: requiredField(draft, 'jobName', diagnostics), issueNo: fieldValue(draft, 'issueNo') || '',
    caesarVersion: requiredField(draft, 'caesarVersion', diagnostics),
    branchName: requiredField(draft, 'branchName', diagnostics), lineNo: requiredField(draft, 'lineNo', diagnostics),
    outsideDiameterMm: fieldValue(draft, 'outsideDiameterMm'), diameter: fieldValue(draft, 'outsideDiameterMm'),
    wallThickness: fieldValue(draft, 'wallThickness'), materialNumber: fieldValue(draft, 'materialNumber'),
    corrosionAllowance: fieldValue(draft, 'corrosionAllowance'),
    insulationThickness: fieldValue(draft, 'insulationThickness'),
    insulationDensity: fieldValue(draft, 'insulationDensity'), fluidDensity: fieldValue(draft, 'fluidDensity'),
    hydroPressure: fieldValue(draft, 'hydroPressure'),
    temperatures: Array.from({ length: 9 }, (_, index) => fieldValue(draft, `temperature${index + 1}`)),
    pressures: Array.from({ length: 9 }, (_, index) => fieldValue(draft, `pressure${index + 1}`)),
  };
}
function bendProjection(draft, profiles, diagnostics) {
  const enabled = requiredField(draft, 'bendScreeningEnabled', diagnostics);
  const basis = { 'normal-metallic': 'default-metallic', 'asme-b31.4': 'asme-b31.4', gre: 'gre' };
  const value = { enabled, emitToInputXml: fieldValue(draft, 'emitToInputXml'),
    screeningOnlyAcknowledged: fieldValue(draft, 'screeningOnlyAcknowledged'),
    requestedDesignBasis: profiles.size === 1 ? basis[[...profiles][0]] : '',
    designBasis: profiles.size === 1 ? basis[[...profiles][0]] : '',
    profileFallbackApplied: false, profileResolutionReason: profiles.size > 1
      ? 'SECTION_PROFILE_ROUTING' : 'EXPLICIT_CONFIGURATION', classificationMode: 'source-authority-auto',
    bendClass: 'auto', diameterSource: 'explicit-od', diameterBasisConfirmed: true,
    explicitOutsideDiameterMm: null };
  if (enabled === true) for (const fieldId of ['minimumPlanTurnAngleDeg', 'minimumProfileTurnAngleDeg',
    'maximumTurnAngleDeg', 'shortElementAnglePolicy', 'minimumAngleElementLengthMm',
    'retainedStraightAllowanceMm', 'detectHorizontal', 'detectVertical', 'detectCompound',
    'preferredStraightTangentMm', 'emitNearPointNode', 'emitMidpointNode', 'bendTypeCode']) {
    value[fieldId] = requiredField(draft, fieldId, diagnostics);
  }
  return value;
}
function normalProjection(draft, diagnostics) {
  const fittingPolicyId = fieldValue(draft, 'normalFittingPolicyId');
  if (!fittingPolicyId) diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_NORMAL_POLICY_REQUIRED', 'Normal fitting policy is required.'));
  const radiusD = fieldValue(draft, 'normalRadiusD'), radiusMm = fieldValue(draft, 'normalRadiusMm');
  if ((radiusD == null) === (radiusMm == null)) diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_NORMAL_POLICY_REQUIRED', 'Normal policy requires exactly one radius basis.'));
  return fittingPolicyId ? { fittingPolicyId, radiusD, radiusMm,
    sourceAuthority: 'USER_SETTINGS_UI', sourceReference: 'engineering-configuration:normal' } : null;
}
function b314Projection(draft, diagnostics) {
  const policies = [], formulaEnabled = fieldValue(draft, 'b314ElasticFormulaEnabled');
  const practicalEnabled = fieldValue(draft, 'b314ElasticPracticalEnabled');
  if (formulaEnabled !== null || practicalEnabled !== null) {
    const item = { radiusPolicyId: 'b31.4-elastic-screening', bendClass: 'elastic', formulaEnabled,
      youngsModulusMpa: fieldValue(draft, 'b314YoungsModulusMpa'),
      allowableBendingStressMpa: fieldValue(draft, 'b314AllowableBendingStressMpa'), practicalEnabled,
      practicalRadiusD: fieldValue(draft, 'b314PracticalRadiusD'), sourceAuthority: 'USER_SETTINGS_UI',
      sourceReference: 'engineering-configuration:b314-elastic' };
    if ((!formulaEnabled && !practicalEnabled) || (formulaEnabled && (!item.youngsModulusMpa
      || !item.allowableBendingStressMpa)) || (practicalEnabled && !item.practicalRadiusD)) diagnostics.push(
      createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_B314_ELASTIC_CRITERIA_REQUIRED'));
    policies.push(item);
  }
  const radiusPolicyId = fieldValue(draft, 'b314ColdPolicyId');
  if (radiusPolicyId) policies.push({ radiusPolicyId, bendClass: 'cold-field',
    qualifiedAlternativeRequested: fieldValue(draft, 'b314QualifiedAlternativeRequested'),
    qualificationEvidenceId: fieldValue(draft, 'b314QualificationEvidenceId') || '',
    projectMinimumEnabled: fieldValue(draft, 'b314ProjectMinimumEnabled'),
    projectMinimumRadiusD: fieldValue(draft, 'b314ProjectMinimumRadiusD'),
    procedureMinimumRadiusD: fieldValue(draft, 'b314ProcedureMinimumRadiusD'),
    projectRadiusD: fieldValue(draft, 'b314ProjectRadiusD'), sourceAuthority: 'USER_SETTINGS_UI',
    sourceReference: 'engineering-configuration:b314-cold' });
  if (!policies.length) diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_B314_POLICY_REQUIRED', 'At least one explicit B31.4 policy is required.'));
  return policies;
}
function greProjection(draft, diagnostics) {
  const value = { vendorId: fieldValue(draft, 'greVendorId'), seriesId: fieldValue(draft, 'greSeriesId'),
    qualificationEvidenceId: fieldValue(draft, 'greQualificationEvidenceId'),
    requirementReference: fieldValue(draft, 'greRequirementReference'),
    sourceAuthority: fieldValue(draft, 'greSourceAuthority'), sourceReference: fieldValue(draft, 'greSourceReference'),
    greVendorNominalBoreMm: fieldValue(draft, 'greVendorNominalBoreMm'),
    bendPolicyId: 'gre-vendor-qualified-bend', bendRadiusMm: fieldValue(draft, 'greBendRadiusMm'),
    bendBreakLengthBasis: fieldValue(draft, 'greBendBreakLengthBasis'),
    bendBreakMultiplierBore: fieldValue(draft, 'greBendBreakMultiplierBore'),
    bendBreakLengthMm: fieldValue(draft, 'greBendBreakLengthMm'),
    bendLocalThicknessMm: fieldValue(draft, 'greBendLocalThicknessMm'),
    teePolicyId: 'gre-vendor-qualified-tee', teeBreakLengthBasis: 'EXPLICIT_LENGTH',
    teeBreakLengthMm: fieldValue(draft, 'greTeeBreakLengthMm'),
    teeLocalThicknessMm: fieldValue(draft, 'greTeeLocalThicknessMm') };
  if (['vendorId', 'seriesId', 'qualificationEvidenceId', 'requirementReference', 'sourceAuthority',
    'sourceReference', 'greVendorNominalBoreMm'].some((key) => !value[key])) diagnostics.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_GRE_VENDOR_REQUIRED'));
  const multiplier = value.bendBreakLengthBasis === 'NOMINAL_BORE_MULTIPLIER';
  const explicit = value.bendBreakLengthBasis === 'EXPLICIT_LENGTH', suppliedLength = value.bendBreakLengthMm;
  const derived = multiplier && value.greVendorNominalBoreMm && value.bendBreakMultiplierBore
    ? value.greVendorNominalBoreMm * value.bendBreakMultiplierBore : null;
  if (multiplier && derived) value.bendBreakLengthMm = derived;
  if (!value.bendRadiusMm || !value.bendLocalThicknessMm || (!multiplier && !explicit)
    || (multiplier && (!derived || suppliedLength !== null))
    || (explicit && (!value.bendBreakLengthMm || value.bendBreakMultiplierBore !== null))) diagnostics.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_GRE_BEND_REQUIRED'));
  if (!value.teeBreakLengthMm || !value.teeLocalThicknessMm) diagnostics.push(
    createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_GRE_TEE_REQUIRED'));
  return value;
}
function migration(draft) {
  return createPipelineEngineeringConfigurationMigration({
    sourceStorageKeys: [...new Set(Object.values(draft.fields).map((item) => item.originalStorageKey).filter(Boolean))],
    observedFieldIds: Object.values(draft.fields).filter((item) => item.legacyObserved).map((item) => item.fieldId),
    confirmedFieldIds: Object.values(draft.fields).filter((item) => item.legacyConfirmed).map((item) => item.fieldId),
    rejectedFieldIds: draft.legacyRejectedFields });
}
function configuredCanonicalPlan(boundaryPlan, sections) {
  if (boundaryPlan?.schema !== 'PipelineAnalysisSectionPlan.v1' || !boundaryPlan.ready) return boundaryPlan || null;
  const byId = Object.fromEntries(sections.map((item) => [item.analysisSectionId, item]));
  const configuredSections = boundaryPlan.sections.map((item) => ({ ...item, ...byId[item.analysisSectionId],
    boundaryAuthority: item.boundaryAuthority, boundarySourceReference: item.boundarySourceReference,
    status: 'CONFIGURED', diagnostics: [], blockerCodes: [] }));
  const elementResolutions = boundaryPlan.elementResolutions.map((item) => {
    const section = byId[item.analysisSectionId], profile = getPipelineEngineeringProfile(section?.profileId);
    return { ...item, profileId: section?.profileId || '', resolvedMode: profile?.resolvedMode || '',
      diagnostics: [], blockerCodes: [], ready: true };
  });
  return createPipelineAnalysisSectionPlan({ sections: configuredSections, elementResolutions });
}
function directValues(sections) {
  return Object.fromEntries(sections.filter((item) => item?.analysisSectionId && item?.directProperties)
    .map((item) => [item.analysisSectionId, item.directProperties]));
}
export function buildPipelineEngineeringConfigurationPlan(draftInput = {}, options = {}) {
  const draft = createPipelineEngineeringConfigurationDraft(draftInput), diagnostics = [...draft.diagnostics];
  for (const [fieldId, definition] of Object.entries(PIPELINE_ENGINEERING_FIELD_DEFINITIONS)) {
    const current = draft.fields[fieldId];
    if (current?.state === 'LEGACY_UNCONFIRMED') diagnostics.push(createPipelineConfigurationDiagnostic(
      'PIPELINE_CONFIGURATION_LEGACY_CONFIRMATION_REQUIRED', 'Legacy field requires review.', { fieldId }));
    if (definition.required) requiredField(draft, fieldId, diagnostics);
  }
  const boundaryPlan = options.canonicalAnalysisSectionPlan || draftInput.canonicalAnalysisSectionPlan || null;
  const sectionConfigurationConformance = buildPipelineSectionConfigurationConformance({
    canonicalAnalysisSectionPlan: boundaryPlan, sectionEvidence: draft.sections });
  const analysisSections = sectionConfigurationConformance.configuredSections;
  const canonicalAnalysisSectionPlan = configuredCanonicalPlan(boundaryPlan, analysisSections);
  const profiles = new Set(analysisSections.map((item) => item.profileId).filter(Boolean));
  const branchInfo = branchProjection(draft, diagnostics);
  const sectionPropertyAssignmentPlan = buildPipelineSectionPropertyAssignmentPlan({
    canonicalAnalysisSectionPlan, branchInfo, assignments: draft.sectionPropertyAssignments,
    sectionDirectValues: directValues(draft.sections), sourceKind: 'BRANCH_INPUT_BLOCK',
    sourceReference: 'engineering-configuration:branch' });
  const bendSettings = bendProjection(draft, profiles, diagnostics);
  const normalFittingPolicy = profiles.has('normal-metallic') ? normalProjection(draft, diagnostics) : null;
  const b314RadiusPolicies = profiles.has('asme-b31.4') ? b314Projection(draft, diagnostics) : [];
  const greVendorSeries = profiles.has('gre') ? [greProjection(draft, diagnostics)] : [];
  return createPipelineEngineeringConfigurationPlan({ draftSchema: draft.schema, migration: migration(draft),
    fields: draft.fields, branchInfo, analysisSections, canonicalAnalysisSectionPlan,
    sectionConfigurationConformance, sectionPropertyAssignmentPlan,
    diameterSections: analysisSections.map((item) => ({ analysisSectionId: item.analysisSectionId,
      startElementIndex: item.startElementIndex, outsideDiameterMm: item.outsideDiameterMm,
      nominalPipeSizeNps: item.nominalPipeSizeNps, greVendorNominalBoreMm: item.greVendorNominalBoreMm,
      sourceAuthority: item.sourceAuthority, sourceReference: item.sourceReference })), bendSettings,
    normalFittingPolicy, normalFittingSections: draft.normalPolicies, b314RadiusPolicies,
    b314RadiusSections: draft.b314Policies, greVendorSeries, greVendorSeriesSections: draft.greVendorSeries,
    diagnostics });
}
export function buildPipelineEngineeringConfigurationTsv(value) {
  const rows = [['FieldId', 'Value', 'Unit', 'State', 'SourceKind', 'SourceReference', 'Ready']];
  for (const fieldId of Object.keys(value?.fields || {}).sort(compare)) {
    const item = value.fields[fieldId]; rows.push([fieldId, item.value ?? '', item.unit, item.state,
      item.sourceKind, item.sourceReference, item.ready ? 'YES' : 'NO']);
  }
  return rows.map((row) => row.join('\t')).join('\n');
}
