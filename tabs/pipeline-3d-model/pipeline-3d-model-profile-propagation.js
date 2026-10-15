import { groupPointsIntoSheets, parseTable1, table1ToTabText } from './pipeline-3d-model-geometry.js';
import { PipelineProfileModel } from './pipeline-3d-model-cad-model.js';
import { buildElasticBendLedgerText } from './pipeline-3d-model-elastic-bend.js?v=20260724-p3d-core-050-1';
import { buildPipelineExportContextJson, qualifyPipelineUtilityExport,
  resolvePipelineUtilityExportContext } from './pipeline-3d-model-export-context.js?v=20260724-p3d-hard-051-1';
import { buildPipelineIdentityLedgerText } from './pipeline-3d-model-identity.js?v=20260724-p3d-core-050-1';
import { buildPipelineInputXmlDocumentPlanJson } from './pipeline-3d-model-inputxml-document.js?v=20260722-p3d-base-039-1';
import { buildPipelinePropertySectionLedgerText,
  buildPipelinePropertySectionPlanJson } from './pipeline-3d-model-property-sections.js?v=20260724-p3d-hard-051-1';
import { buildCoordinateRows, coordinateRowsToTabText } from './pipeline-3d-model-xml-builder.js?v=20260722-p3d-base-039-1';
import { buildDepthRules, buildGradeProfile,
  buildProfileRouteContext } from './pipeline-3d-model-profile-coordinate-map.js';
import { assertPlausibleProfileSegments, buildDepthEvents, buildMarkerEvents,
  buildTable2Events, buildTable3AnchorEvents, buildVertexEvents,
  materializeProfileEvents } from './pipeline-3d-model-profile-events.js?v=20260719-table2-elevation-authority-1';
import { buildDerivedTable2Text, buildDerivedTable3Text,
  buildTable2XText, buildTable3XText } from './pipeline-3d-model-profile-output.js';
import { addPipelineWarning } from './pipeline-3d-model-warning-log.js';
import { loadPipelineEngineeringConfigurationDraft } from './pipeline-3d-model-engineering-configuration-storage.js';
import { buildPipelineEngineeringConfigurationPlan } from './pipeline-3d-model-engineering-configuration.js';
import { resolvePipelineAnalysisSectionPlan } from './pipeline-3d-model-analysis-section-planner.js';
import { buildPipelineCoreOutputs } from './pipeline-3d-model-core-runtime.js';
import { resolvePipelineApprovedCatalogProductionOutputState,
  withPipelineApprovedCatalogProductionInputs } from './pipeline-3d-model-approved-catalog-production-input.js';

const PLACEHOLDER_POINT_LABEL = /^at\s+point\s+X\s*=\s*Y\s*=\s*Z\s*=$/i;
const MODES = Object.freeze({ 'normal-metallic': 'default-metallic',
  'asme-b31.4': 'asme-b31.4', gre: 'gre' });
const zeroCounts = Object.freeze({ numElt: 0, numNoz: 0, noHgrs: 0, numBend: 0,
  numRigid: 0, numExpJnt: 0, numRest: 0, numForcMnt: 0, numUnfLoad: 0,
  numWind: 0, numEleOff: 0, numAllow: 0, numISect: 0 });
export function sanitizeTable1Label(label, index) {
  const value = String(label || '').trim();
  return !value || PLACEHOLDER_POINT_LABEL.test(value)
    ? `T1-${String(index + 1).padStart(3, '0')}` : value;
}
const sanitizeTable1Points = (points) => points.map((point, index) =>
  ({ ...point, label: sanitizeTable1Label(point.label, index) }));
function canonicalBoundaryPlan(input, coordinateRows) {
  if (input.canonicalAnalysisSectionPlan?.schema === 'PipelineAnalysisSectionPlan.v1') {
    return input.canonicalAnalysisSectionPlan;
  }
  if (Array.isArray(input.analysisSections) && input.analysisSections.length) return resolvePipelineAnalysisSectionPlan({
    coordinateRows, analysisSections: input.analysisSections }).analysisSectionPlan;
  return null;
}
function configuration(input, canonicalAnalysisSectionPlan) {
  if (input.configurationPlan?.schema === 'PipelineEngineeringConfigurationPlan.v1') return input.configurationPlan;
  const draft = input.configurationDraft || loadPipelineEngineeringConfigurationDraft();
  return buildPipelineEngineeringConfigurationPlan(draft, { canonicalAnalysisSectionPlan });
}
function exportSettings(plan) {
  const profiles = [...new Set(plan.analysisSections.map((item) => item.profileId))];
  const basis = profiles.length === 1 ? MODES[profiles[0]] || '' : 'section-routed';
  return { ...plan.bendSettings, designBasis: basis, requestedDesignBasis: basis,
    profileFallbackApplied: false, profileResolutionReason: profiles.length === 1
      ? 'EXPLICIT_CONFIGURATION' : 'CANONICAL_SECTION_PROFILE_ROUTING',
    explicitOutsideDiameterMm: profiles.length === 1 ? plan.analysisSections[0]?.outsideDiameterMm ?? null : null };
}
function blockedProperty(core) {
  return core.propertySectionPlan || Object.freeze({ schema: 'PipelinePropertySectionPlan.v1',
    lineNo: core.configuration.branchInfo.lineNo, sectionCount: 0, sections: Object.freeze([]),
    elements: Object.freeze([]), diagnostics: core.diagnostics,
    blockerCodes: core.blockerCodes, ready: false });
}
function blockedDocument(core, propertySectionPlan) {
  return core.inputXmlDocumentPlan || Object.freeze({ schema: 'PipelineInputXmlDocumentPlan.v1',
    metadata: Object.freeze({ jobName: core.configuration.branchInfo.jobName,
      issueNo: core.configuration.branchInfo.issueNo,
      caesarVersion: core.configuration.branchInfo.caesarVersion }), counts: zeroCounts,
    propertySectionPlan, elements: Object.freeze([]), diagnostics: core.diagnostics,
    blockerCodes: core.blockerCodes, ready: false });
}
function appendDiagnostics(warnings, core) {
  for (const item of core.diagnostics) addPipelineWarning(warnings, item.code,
    item.severity === 'BLOCKING' ? `[BLOCKING] ${item.message}` : item.message, item.details);
}
function commonOutput(input, source, profileOutput = {}) {
  const coordinateRows = buildCoordinateRows(source.combined,
    resolvePipelineUtilityExportContext({ branchInfo: input.branchInfo || {}, settings: {} }).identity);
  const boundaryPlan = canonicalBoundaryPlan(input, coordinateRows);
  const plan = configuration(input, boundaryPlan), settings = exportSettings(plan);
  const exportContext = resolvePipelineUtilityExportContext({ branchInfo: plan.branchInfo, settings });
  const identityRows = buildCoordinateRows(source.combined, exportContext.identity);
  const core = buildPipelineCoreOutputs(withPipelineApprovedCatalogProductionInputs({
    configurationPlan: plan,
    canonicalAnalysisSectionPlan: plan.canonicalAnalysisSectionPlan, points: source.combined,
    coordinateRows: identityRows, propertySections: input.propertySections, exportContext,
  }, input));
  const propertySectionPlan = blockedProperty(core), inputXmlDocumentPlan = blockedDocument(core, propertySectionPlan);
  const inputXmlRows = core.bendResolution?.geometryRows || identityRows;
  const exportQualification = qualifyPipelineUtilityExport(exportContext,
    inputXmlRows, core.bendResolution, inputXmlDocumentPlan);
  appendDiagnostics(source.warnings, core);
  const bendDiagnostics = core.bendResolution?.diagnostics || {};
  return Object.freeze({ ...source, ...profileOutput, coordinateRows: identityRows,
    identity: exportContext.identity,
    identityText: buildPipelineIdentityLedgerText(exportContext.identity, identityRows),
    configurationPlan: plan, orchestration: core, artifacts: core.artifacts,
    canonicalAnalysisSectionPlan: core.canonicalAnalysisSectionPlan,
    sectionPropertyAssignmentPlan: core.sectionPropertyAssignmentPlan,
    sectionProfileRoutingPlan: core.sectionProfileRoutingPlan,
    analysisDiameterPlan: core.analysisDiameterPlan, bendResolution: core.bendResolution,
    normalFittingPlan: core.normalFittingPlan, b314RadiusPlan: core.b314RadiusPlan,
    greVendorSeriesPlan: core.greVendorSeriesPlan,
    inputXmlProfileAuthorityPlan: core.inputXmlProfileAuthorityPlan,
    exportContext, exportQualification,
    exportContextText: buildPipelineExportContextJson(exportContext, exportQualification),
    inputXmlDocumentPlan,
    inputXmlDocumentPlanText: buildPipelineInputXmlDocumentPlanJson(inputXmlDocumentPlan),
    propertySectionPlan,
    propertySectionPlanText: buildPipelinePropertySectionPlanJson(propertySectionPlan),
    propertySectionLedgerText: buildPipelinePropertySectionLedgerText(propertySectionPlan),
    inputXmlCoordinateRows: inputXmlRows, elasticBends: core.bendResolution,
    table1OutputText: table1ToTabText(source.table1Points),
    coordinateText: coordinateRowsToTabText(identityRows),
    elasticBendText: core.bendResolution ? buildElasticBendLedgerText(core.bendResolution) : '',
    xmlText: core.xmlText, warnings: Object.freeze([...source.warnings]),
    errors: core.diagnostics, diagnostics: Object.freeze({
      ...(profileOutput.profileDiagnostics || {}), warningCount: source.warnings.length,
      pipelineMode: exportContext.profile.resolvedMode, configurationReady: plan.ready,
      orchestrationReady: core.ready, inputXmlDocumentSchema: inputXmlDocumentPlan.schema,
      inputXmlElementCount: inputXmlDocumentPlan.counts?.numElt || 0,
      inputXmlBendCount: inputXmlDocumentPlan.counts?.numBend || 0,
      propertySectionCount: propertySectionPlan.sectionCount || 0,
      inputXmlDocumentBlockerCount: inputXmlDocumentPlan.blockerCodes?.length || 0,
      exportInputXmlAllowed: exportQualification.inputXmlAllowed,
      ...resolvePipelineApprovedCatalogProductionOutputState(inputXmlDocumentPlan),
      elasticBendCandidates: bendDiagnostics.candidateCount || 0,
      elasticBendsEmitted: bendDiagnostics.emittedCount || 0,
      bendBlockingErrors: bendDiagnostics.blockedCount || 0,
      sharedBendSegmentFailures: bendDiagnostics.sharedSegmentFailureCount || 0,
      markerRowsExcludedFromInputXml: bendDiagnostics.excludedMarkerCount || 0 }) });
}
export function buildPipelineNativeOutputBundle(input, source, profileOutput = {}) {
  return commonOutput(input, source, profileOutput);
}
export function buildAuthoritativePipelineOutputs(input) {
  const profile = PipelineProfileModel.fromRaw(input.profileRaw);
  const table1Points = sanitizeTable1Points(parseTable1(input.table1Text));
  const sheets = groupPointsIntoSheets(table1Points), context = buildProfileRouteContext(table1Points, profile);
  const gradeRows = buildGradeProfile(profile, context), table3MarkerRules = buildDepthRules(profile, context);
  const events = [...buildVertexEvents(table1Points, context.segments), ...buildTable2Events(gradeRows),
    ...buildTable3AnchorEvents(profile, context), ...buildDepthEvents(table3MarkerRules),
    ...buildMarkerEvents(profile, context)];
  const combined = materializeProfileEvents(events, context, gradeRows);
  const maxSegment = assertPlausibleProfileSegments(combined, context.total, context.warnings);
  return commonOutput(input, { table1Points, sheets, combined, warnings: context.warnings }, {
    table2Text: buildDerivedTable2Text(gradeRows), table3Text: buildDerivedTable3Text(combined),
    table2XText: buildTable2XText(profile), table3XText: buildTable3XText(profile),
    profileDiagnostics: Object.freeze({ routeLength: context.total,
      routeStartStation: context.routeStartStation, table3OriginRoute: context.table3OriginRoute,
      stationSlope: context.stationAlignment.slope, stationResidual: context.stationAlignment.maxResidual,
      maxSegment, elevationAuthority: 'TABLE_2', table2Rows: gradeRows.length,
      table3LengthRows: profile.table3LengthRows.length, table3DepthRows: profile.table3DepthRows.length,
      table3MarkerRows: profile.table3MarkerRows.length }) });
}
