import {
  PIPELINE_CORE_ORCHESTRATION_SCHEMA,
  createPipelineConfigurationDiagnostic,
  orderPipelineConfigurationDiagnostics,
  pipelineConfigurationBlockerCodes,
  buildPipelineEngineeringConfigurationJson,
  buildPipelineEngineeringConfigurationBlockerText,
} from './pipeline-3d-model-engineering-configuration-contracts.js';
import {
  buildPipelineEngineeringConfigurationPlan,
  buildPipelineEngineeringConfigurationTsv,
} from './pipeline-3d-model-engineering-configuration.js';
import {
  buildPipelineSectionPropertyAssignmentJson,
  buildPipelineSectionPropertyAssignmentTsv,
} from './pipeline-3d-model-section-property-assignment.js';
import { buildPipelineSectionProfileRoutingJson } from './pipeline-3d-model-section-profile-routing.js';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
};
const json = (value) => JSON.stringify(value, null, 2);
const requiredFunctions = Object.freeze([
  'buildGeometryRoute', 'resolveSectionAwareBends', 'resolvePropertySectionPlan',
  'resolvePropertyReseedPlan', 'resolveDiameterPlan', 'resolveNormalFittingPlan',
  'resolveB314RadiusPlan', 'resolveGreVendorSeriesPlan', 'buildInputXmlDocumentPlan',
  'buildInputXmlXml',
]);
function dependencyDiagnostics(dependencies) {
  return requiredFunctions.filter((name) => typeof dependencies?.[name] !== 'function')
    .map((name) => createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_RUNTIME_BLOCKED',
      'Required orchestration dependency is unavailable.', { dependency: name }));
}
function step(name, run, diagnostics) {
  try { return run(); } catch (error) {
    diagnostics.push(createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_RUNTIME_BLOCKED',
      'Core orchestration step threw.', { step: name, message: text(error?.message) }));
    return null;
  }
}
function profileBasis(profileId) {
  return { 'normal-metallic': 'default-metallic', 'asme-b31.4': 'asme-b31.4', gre: 'gre' }[profileId] || '';
}
function b314Settings(plan, settings) {
  const elastic = plan.b314RadiusPolicies.find((item) => item.bendClass === 'elastic');
  const cold = plan.b314RadiusPolicies.find((item) => item.bendClass === 'cold-field');
  if (elastic) Object.assign(settings, {
    useFormulaMinimum: elastic.formulaEnabled, youngsModulusMpa: elastic.youngsModulusMpa,
    allowableBendingStressMpa: elastic.allowableBendingStressMpa,
    usePracticalMinimum: elastic.practicalEnabled,
    practicalRadiusMultiplierD: elastic.practicalRadiusD,
  });
  if (!cold) return;
  const sizeBand = cold.radiusPolicyId === 'b31.4-cold-field-size-band';
  Object.assign(settings, {
    coldFieldRadiusMode: sizeBand ? 'b31.4-size-band' : 'project-multiplier',
    coldFieldRadiusMultiplierD: cold.projectRadiusD,
    useColdFieldProjectMinimum: cold.projectMinimumEnabled,
    coldFieldProjectRadiusMultiplierD: cold.projectMinimumRadiusD,
    coldFieldProcedureMinimumRadiusD: cold.procedureMinimumRadiusD,
    useQualified18DAlternative: cold.qualifiedAlternativeRequested,
    qualificationEvidenceId: cold.qualificationEvidenceId,
  });
}
function greSettings(plan, section, settings) {
  const gre = plan.greVendorSeries.find((item) =>
    item.greVendorNominalBoreMm === section.greVendorNominalBoreMm);
  if (!gre) return;
  Object.assign(settings, { greNominalBoreMm: gre.greVendorNominalBoreMm,
    greBendRadiusMm: gre.bendRadiusMm, greBendBreakLengthBasis: gre.bendBreakLengthBasis,
    greBendBreakMultiplierBore: gre.bendBreakMultiplierBore, greBendBreakLengthMm: gre.bendBreakLengthMm,
    greBendLocalThicknessMm: gre.bendLocalThicknessMm, greTeeBreakLengthMm: gre.teeBreakLengthMm,
    greTeeLocalThicknessMm: gre.teeLocalThicknessMm, greRequirementReference: gre.requirementReference });
}
function sectionSettings(plan) {
  return freeze(Object.fromEntries(plan.analysisSections.map((section) => {
    const settings = { ...plan.bendSettings, designBasis: profileBasis(section.profileId),
      requestedDesignBasis: profileBasis(section.profileId), profileFallbackApplied: false,
      profileResolutionReason: 'CANONICAL_SECTION_OWNERSHIP',
      explicitOutsideDiameterMm: section.outsideDiameterMm,
      nominalPipeSizeNps: section.nominalPipeSizeNps };
    if (section.profileId === 'normal-metallic' && plan.normalFittingPolicy) {
      settings.bendClass = 'standard';
      settings.standardRadiusMultiplierD = plan.normalFittingPolicy.radiusD
        ?? (plan.normalFittingPolicy.radiusMm / section.outsideDiameterMm);
    }
    if (section.profileId === 'asme-b31.4') b314Settings(plan, settings);
    if (section.profileId === 'gre') greSettings(plan, section, settings);
    return [section.analysisSectionId, freeze(settings)];
  })));
}
function assignedPropertySections(configuration) {
  const assignment = configuration.sectionPropertyAssignmentPlan;
  const bySection = Object.create(null);
  for (const item of assignment?.propertyResolutions || []) {
    if (!bySection[item.analysisSectionId]) bySection[item.analysisSectionId] = { values: {}, sources: {} };
    bySection[item.analysisSectionId].values[item.fieldId] = item.value;
    bySection[item.analysisSectionId].sources[item.fieldId] = item.transactionId
      ? `AUTHENTICATED_ASSIGNMENT:${item.transactionId}`
      : `${item.sourceKind}:${item.sourceReference}`;
  }
  return configuration.analysisSections.slice(1).map((section) => ({
    startElementIndex: section.startElementIndex, diameter: section.outsideDiameterMm,
    ...(bySection[section.analysisSectionId]?.values || {}), forceSection: true,
    analysisSectionId: section.analysisSectionId,
    propertySources: { diameter: `ANALYSIS_SECTION_INPUT:${section.sourceReference}`,
      ...(bySection[section.analysisSectionId]?.sources || {}) },
    sourceAuthority: section.sourceAuthority, sourceReference: section.sourceReference,
  }));
}
function grePlaceholder(plan) {
  const gre = plan.greVendorSeries[0], multiplier = gre?.bendBreakLengthBasis === 'NOMINAL_BORE_MULTIPLIER';
  return freeze({ schema: 'PipelineGreFittingPlaceholder.v1', active: Boolean(gre),
    policyReady: false, resolverReady: false, geometryApplied: false, inputXmlApplied: false,
    requirementReference: gre?.requirementReference || '', bend: freeze({ radiusBasis: 'GRE_PLACEHOLDER',
      radiusMm: gre?.bendRadiusMm ?? null, breakLengthBasis: gre?.bendBreakLengthBasis || 'EXPLICIT_LENGTH',
      nominalBoreMm: gre?.greVendorNominalBoreMm ?? null,
      breakMultiplierBore: multiplier ? gre.bendBreakMultiplierBore : null,
      breakLengthMm: gre?.bendBreakLengthMm ?? null, localThicknessMm: gre?.bendLocalThicknessMm ?? null,
      resolverReady: false }), tee: freeze({ breakLengthBasis: 'EXPLICIT_LENGTH',
      breakLengthMm: gre?.teeBreakLengthMm ?? null, localThicknessMm: gre?.teeLocalThicknessMm ?? null,
      resolverReady: false }) });
}
function artifact(fileId, name, sourceSchema, content, mime = 'application/json') {
  return freeze({ fileId, name, sourceSchema, mime, role: 'ENGINEERING_EVIDENCE', text: content });
}
function artifacts(configuration, plans, xmlText) {
  const result = [
    artifact('pipeline-engineering-configuration', 'pipeline-engineering-configuration.json',
      configuration.schema, buildPipelineEngineeringConfigurationJson(configuration)),
    artifact('pipeline-engineering-configuration-tsv', 'pipeline-engineering-configuration.tsv',
      configuration.schema, buildPipelineEngineeringConfigurationTsv(configuration), 'text/tab-separated-values'),
    artifact('pipeline-engineering-configuration-blockers', 'pipeline-engineering-configuration-blockers.tsv',
      configuration.schema, buildPipelineEngineeringConfigurationBlockerText(configuration), 'text/tab-separated-values'),
  ];
  if (plans.sectionPropertyAssignmentPlan) result.push(
    artifact('sectionPropertyAssignmentPlan', 'pipeline-section-property-assignments.json',
      plans.sectionPropertyAssignmentPlan.schema, buildPipelineSectionPropertyAssignmentJson(plans.sectionPropertyAssignmentPlan)),
    artifact('sectionPropertyAssignmentPlanTsv', 'pipeline-section-property-assignments.tsv',
      plans.sectionPropertyAssignmentPlan.schema, buildPipelineSectionPropertyAssignmentTsv(plans.sectionPropertyAssignmentPlan),
      'text/tab-separated-values'));
  if (plans.sectionProfileRoutingPlan) result.push(artifact('sectionProfileRoutingPlan',
    'pipeline-section-profile-routing.json', plans.sectionProfileRoutingPlan.schema,
    buildPipelineSectionProfileRoutingJson(plans.sectionProfileRoutingPlan)));
  const records = [
    ['canonicalAnalysisSectionPlan', 'pipeline-analysis-section-plan.json'],
    ['analysisDiameterPlan', 'pipeline-analysis-diameter-plan.json'],
    ['normalFittingPlan', 'pipeline-normal-fitting-plan.json'],
    ['b314RadiusPlan', 'pipeline-b314-radius-plan.json'],
    ['greVendorSeriesPlan', 'pipeline-gre-vendor-series-plan.json'],
    ['inputXmlProfileAuthorityPlan', 'pipeline-inputxml-profile-authority.json'],
    ['inputXmlDocumentPlan', 'pipeline-inputxml-document-plan.json'],
  ];
  for (const [key, name] of records) if (plans[key]) result.push(
    artifact(key, name, plans[key].schema || '', json(plans[key])));
  if (xmlText) result.push(freeze({ fileId: 'pipeline-inputxml', name: 'pipeline-3d-model.xml',
    sourceSchema: 'InputXML.Canonical.v1', mime: 'application/xml', role: 'INPUTXML', text: xmlText }));
  return Object.freeze(result);
}
function finalResult(configuration, plans, diagnostics, xmlText) {
  const ordered = orderPipelineConfigurationDiagnostics([
    ...configuration.diagnostics, ...diagnostics,
    ...Object.values(plans).filter(plain).flatMap((plan) => plan.diagnostics || []),
  ]), blockerCodes = pipelineConfigurationBlockerCodes(ordered);
  return freeze({ schema: PIPELINE_CORE_ORCHESTRATION_SCHEMA, configuration, ...plans,
    artifacts: artifacts(configuration, plans, xmlText), xmlText, diagnostics: ordered, blockerCodes,
    ready: blockerCodes.length === 0 && Boolean(xmlText) });
}
export function buildPipelineCoreOrchestration(input = {}, dependencies = {}) {
  const diagnostics = dependencyDiagnostics(dependencies);
  const configuration = input.configurationPlan?.schema === 'PipelineEngineeringConfigurationPlan.v1'
    ? input.configurationPlan : buildPipelineEngineeringConfigurationPlan(input.configurationDraft || {}, {
      canonicalAnalysisSectionPlan: input.canonicalAnalysisSectionPlan });
  const plans = { canonicalAnalysisSectionPlan: configuration.canonicalAnalysisSectionPlan || null,
    analysisSectionPlan: configuration.canonicalAnalysisSectionPlan || null,
    sectionPropertyAssignmentPlan: configuration.sectionPropertyAssignmentPlan || null };
  if (!configuration.ready || diagnostics.length) return finalResult(configuration, plans, diagnostics, '');
  const geometryRoute = step('geometryRoute', () => dependencies.buildGeometryRoute(
    input.points || [], input.coordinateRows || []), diagnostics);
  const bendBundle = step('bendResolution', () => dependencies.resolveSectionAwareBends({ geometryRoute,
    canonicalAnalysisSectionPlan: plans.canonicalAnalysisSectionPlan,
    sectionSettingsById: sectionSettings(configuration), branchInfo: configuration.branchInfo }), diagnostics);
  plans.bendResolution = bendBundle?.bendResolution || null;
  plans.sectionProfileRoutingPlan = bendBundle?.sectionProfileRoutingPlan || null;
  if (plans.sectionProfileRoutingPlan?.ready !== true) return finalResult(configuration, plans, diagnostics, '');
  const rows = geometryRoute?.coordinateRows || input.coordinateRows || [];
  plans.propertySectionPlan = step('propertySectionPlan', () => dependencies.resolvePropertySectionPlan({
    branchInfo: configuration.branchInfo, coordinateRows: rows,
    propertySections: assignedPropertySections(configuration) }), diagnostics);
  plans.analysisPropertyReseedPlan = step('propertyReseed', () => dependencies.resolvePropertyReseedPlan({
    analysisSectionPlan: plans.canonicalAnalysisSectionPlan, propertySectionPlan: plans.propertySectionPlan }), diagnostics);
  plans.analysisDiameterPlan = step('diameterPlan', () => dependencies.resolveDiameterPlan({
    analysisSectionPlan: plans.canonicalAnalysisSectionPlan,
    analysisPropertyReseedPlan: plans.analysisPropertyReseedPlan,
    diameterSections: configuration.diameterSections, branchInfo: configuration.branchInfo,
    settings: configuration.bendSettings, sourceAuthority: 'ENGINEERING_CONFIGURATION',
    sourceReference: 'pipeline-engineering-configuration-v1' }), diagnostics);
  plans.normalFittingPlan = step('normalFittingPlan', () => dependencies.resolveNormalFittingPlan({
    analysisSectionPlan: plans.canonicalAnalysisSectionPlan, analysisDiameterPlan: plans.analysisDiameterPlan,
    bendResolution: plans.bendResolution, normalFittingPolicy: configuration.normalFittingPolicy,
    normalFittingSections: configuration.normalFittingSections,
    normalFittingOverrides: configuration.normalFittingOverrides,
    sourceAuthority: 'ENGINEERING_CONFIGURATION', sourceReference: 'pipeline-engineering-configuration-v1' }), diagnostics);
  plans.b314RadiusPlan = step('b314RadiusPlan', () => dependencies.resolveB314RadiusPlan({
    analysisSectionPlan: plans.canonicalAnalysisSectionPlan, analysisDiameterPlan: plans.analysisDiameterPlan,
    bendResolution: plans.bendResolution, b314RadiusPolicies: configuration.b314RadiusPolicies,
    b314RadiusSections: configuration.b314RadiusSections, b314RadiusOverrides: configuration.b314RadiusOverrides,
    sourceAuthority: 'ENGINEERING_CONFIGURATION', sourceReference: 'pipeline-engineering-configuration-v1' }), diagnostics);
  plans.greVendorSeriesPlan = step('greVendorSeriesPlan', () => dependencies.resolveGreVendorSeriesPlan({
    analysisSectionPlan: plans.canonicalAnalysisSectionPlan, analysisDiameterPlan: plans.analysisDiameterPlan,
    grePlaceholder: grePlaceholder(configuration), greVendorSeries: configuration.greVendorSeries,
    greVendorSeriesSections: configuration.greVendorSeriesSections,
    sourceAuthority: 'ENGINEERING_CONFIGURATION', sourceReference: 'pipeline-engineering-configuration-v1' }), diagnostics);
  plans.inputXmlDocumentPlan = step('inputXmlDocumentPlan', () => dependencies.buildInputXmlDocumentPlan({
    exportContext: input.exportContext || {}, coordinateRows: rows, bendResolution: plans.bendResolution,
    propertySections: assignedPropertySections(configuration), sectionPropertyAssignmentPlan: plans.sectionPropertyAssignmentPlan,
    sectionProfileRoutingPlan: plans.sectionProfileRoutingPlan, profileAuthorityPlans: {
      analysisSectionPlan: plans.canonicalAnalysisSectionPlan, analysisDiameterPlan: plans.analysisDiameterPlan,
      normalFittingPlan: plans.normalFittingPlan, b314RadiusPlan: plans.b314RadiusPlan,
      greVendorSeriesPlan: plans.greVendorSeriesPlan, sectionPropertyAssignmentPlan: plans.sectionPropertyAssignmentPlan,
      sectionProfileRoutingPlan: plans.sectionProfileRoutingPlan } }), diagnostics);
  plans.inputXmlProfileAuthorityPlan = plans.inputXmlDocumentPlan?.profileAuthorityPlan || null;
  const xmlText = plans.inputXmlDocumentPlan?.ready === true
    ? step('inputXmlWriter', () => dependencies.buildInputXmlXml(plans.inputXmlDocumentPlan), diagnostics) || '' : '';
  if (!xmlText) diagnostics.push(createPipelineConfigurationDiagnostic(
    'PIPELINE_CONFIGURATION_INPUTXML_BLOCKED', 'InputXML is suppressed until all authority evidence is ready.'));
  return finalResult(configuration, plans, diagnostics, xmlText);
}
