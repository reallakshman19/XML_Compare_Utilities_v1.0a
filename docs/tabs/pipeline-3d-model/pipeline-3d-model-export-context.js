import { normalizeElasticBendSettings } from './pipeline-3d-model-elastic-bend-settings.js?v=20260724-p3d-hard-051-1';
import { resolveGreFittingPlaceholder } from './pipeline-3d-model-gre-placeholder.js?v=20260724-p3d-core-050-1';
import { resolvePipelineIdentityContext } from './pipeline-3d-model-identity.js?v=20260724-p3d-core-050-1';

export const PIPELINE_EXPORT_CONTEXT_SCHEMA = 'PipelineUtilityExportContext.v1';
export const PIPELINE_EXPORT_QUALIFICATION_SCHEMA = 'PipelineUtilityExportQualification.v1';
const MODE_BY_BASIS = Object.freeze({ 'default-metallic': 'NORMAL',
  'asme-b31.4': 'ASME_B31_4', gre: 'GRE', 'section-routed': 'MIXED' });
function normalizedBranchInfo(branchInfo, identity) {
  return Object.freeze({ ...(branchInfo || {}), branchName: identity.branchName, lineNo: identity.lineNo });
}
function fittingInputXmlRequested(settings) {
  return settings.designBasis === 'gre' && settings.enabled === true && settings.emitToInputXml === true;
}
function readiness(settings, identity) {
  const requested = fittingInputXmlRequested(settings), blockers = [];
  if (!MODE_BY_BASIS[settings.designBasis]) blockers.push('PIPELINE_CONFIGURATION_PROFILE_REQUIRED');
  if (!identity.branchName) blockers.push('PIPELINE_CONFIGURATION_FIELD_REQUIRED');
  if (!identity.lineNo) blockers.push('PIPELINE_LINE_NUMBER_REQUIRED');
  if (requested) blockers.push('GRE_BEND_POLICY_NOT_IMPLEMENTED');
  return Object.freeze({ baseGeometryReady: blockers.length === 0,
    baseInputXmlReady: blockers.length === 0,
    fittingPolicyReady: ['default-metallic', 'asme-b31.4', 'section-routed'].includes(settings.designBasis),
    fittingResolverReady: ['default-metallic', 'asme-b31.4', 'section-routed'].includes(settings.designBasis),
    fittingInputXmlRequested: requested, preflightInputXmlAllowed: blockers.length === 0,
    blockerCodes: Object.freeze([...new Set(blockers)]) });
}
function profile(settings) {
  return Object.freeze({ requestedDesignBasis: settings.requestedDesignBasis,
    resolvedDesignBasis: settings.designBasis, resolvedMode: MODE_BY_BASIS[settings.designBasis] || '',
    fallbackApplied: false, resolutionReason: settings.profileResolutionReason });
}
export function resolvePipelineUtilityExportContext({ branchInfo = {}, settings = {} } = {}) {
  const normalizedSettings = normalizeElasticBendSettings(settings);
  const identity = resolvePipelineIdentityContext(branchInfo);
  return Object.freeze({ schema: PIPELINE_EXPORT_CONTEXT_SCHEMA, profile: profile(normalizedSettings), identity,
    branchInfo: normalizedBranchInfo(branchInfo, identity), settings: normalizedSettings,
    grePlaceholder: resolveGreFittingPlaceholder(normalizedSettings), readiness: readiness(normalizedSettings, identity) });
}
export function exportContextBranchInfo(input = {}) {
  if (input?.schema === PIPELINE_EXPORT_CONTEXT_SCHEMA) return input.branchInfo;
  const identity = resolvePipelineIdentityContext(input); return normalizedBranchInfo(input, identity);
}
const resolutionCodes = (bendResolution) => (bendResolution?.errors || [])
  .map((item) => String(item?.code || '').trim()).filter(Boolean);
const documentCodes = (documentPlan) => (documentPlan?.blockerCodes || [])
  .map((code) => String(code || '').trim()).filter(Boolean);
const uniqueCodes = (values) => Object.freeze([...new Set(values)]);
export function qualifyPipelineUtilityExport(contextInput, coordinateRows = [], bendResolution = null, documentPlan = null) {
  const context = contextInput?.schema === PIPELINE_EXPORT_CONTEXT_SCHEMA
    ? contextInput : resolvePipelineUtilityExportContext(contextInput);
  const segmentCount = Math.max(0, coordinateRows.length - 1), planCodes = documentCodes(documentPlan);
  const blockerCodes = uniqueCodes([...(documentPlan ? []
    : (segmentCount ? [] : ['PIPELINE_GEOMETRY_SEGMENT_REQUIRED'])),
  ...context.readiness.blockerCodes, ...planCodes, ...resolutionCodes(bendResolution)]);
  const documentReady = documentPlan ? documentPlan.ready === true : segmentCount > 0;
  return Object.freeze({ schema: PIPELINE_EXPORT_QUALIFICATION_SCHEMA,
    resolvedMode: context.profile.resolvedMode, segmentCount,
    bendCandidateCount: bendResolution?.diagnostics?.candidateCount || 0,
    bendEmittedCount: bendResolution?.diagnostics?.emittedCount || 0,
    bendBlockingCount: bendResolution?.diagnostics?.blockedCount || 0,
    documentPlanSchema: documentPlan?.schema || '', documentReady,
    documentBlockerCount: planCodes.length,
    preflightInputXmlAllowed: context.readiness.preflightInputXmlAllowed && documentReady,
    inputXmlAllowed: blockerCodes.length === 0, blockerCodes });
}
export function buildPipelineExportContextJson(contextInput, qualification = null) {
  const context = contextInput?.schema === PIPELINE_EXPORT_CONTEXT_SCHEMA
    ? contextInput : resolvePipelineUtilityExportContext(contextInput);
  return JSON.stringify({ schema: PIPELINE_EXPORT_CONTEXT_SCHEMA, profile: context.profile,
    identity: context.identity, readiness: context.readiness, qualification,
    grePlaceholder: context.grePlaceholder.active ? context.grePlaceholder : null }, null, 2);
}
