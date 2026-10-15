import { resolveColdFieldBendPolicy } from './pipeline-3d-model-bend-policy.js';
import { normalizeElasticBendSettings } from './pipeline-3d-model-elastic-bend-settings.js?v=20260724-p3d-core-050-1';
import { resolveGreFittingPlaceholder } from './pipeline-3d-model-gre-placeholder.js?v=20260724-p3d-core-050-1';

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
export function bendDiagnostic(severity, code, message, details = {}) {
  return Object.freeze({ severity, code, message, details: Object.freeze({ ...details }) });
}
function resolveOutsideDiameterMm(settings, branchInfo) {
  if (settings.diameterSource === 'explicit-od') return positive(settings.explicitOutsideDiameterMm);
  if (settings.diameterSource === 'branch-diameter' && settings.diameterBasisConfirmed === true) {
    return positive(branchInfo?.outsideDiameterMm ?? branchInfo?.diameter);
  }
  return null;
}
function elasticCriteria(settings, outsideDiameterMm) {
  const formulaRadiusMm = settings.useFormulaMinimum === true && outsideDiameterMm
    && settings.youngsModulusMpa && settings.allowableBendingStressMpa
    ? (settings.youngsModulusMpa * outsideDiameterMm) / (2 * settings.allowableBendingStressMpa) : null;
  const practicalRadiusMm = settings.usePracticalMinimum === true && outsideDiameterMm
    && settings.practicalRadiusMultiplierD
    ? settings.practicalRadiusMultiplierD * outsideDiameterMm : null;
  const criteria = [formulaRadiusMm, practicalRadiusMm].filter(positive);
  return { formulaRadiusMm, practicalRadiusMm,
    elasticGoverningRadiusMm: criteria.length ? Math.max(...criteria) : null };
}
function resolveSizeBandPolicy(settings, outsideDiameterMm) {
  if (settings.designBasis !== 'asme-b31.4'
    || settings.coldFieldRadiusMode !== 'b31.4-size-band') return null;
  return resolveColdFieldBendPolicy({ outsideDiameterMm,
    nominalPipeSizeNps: settings.nominalPipeSizeNps,
    useProjectMinimum: settings.useColdFieldProjectMinimum === true,
    projectMinimumRadiusD: settings.coldFieldProjectRadiusMultiplierD,
    procedureMinimumRadiusD: settings.coldFieldProcedureMinimumRadiusD,
    useQualified18DAlternative: settings.useQualified18DAlternative === true,
    qualificationEvidenceId: settings.qualificationEvidenceId });
}
function globalRadius(settings, outsideDiameterMm, elasticRadiusMm, policy) {
  if (settings.designBasis === 'default-metallic') return outsideDiameterMm
    && settings.standardRadiusMultiplierD ? settings.standardRadiusMultiplierD * outsideDiameterMm : null;
  if (settings.designBasis !== 'asme-b31.4' || settings.classificationMode !== 'legacy-global') return null;
  if (settings.bendClass === 'elastic') return elasticRadiusMm;
  if (settings.bendClass !== 'cold-field') return null;
  return settings.coldFieldRadiusMode === 'project-multiplier'
    ? outsideDiameterMm && settings.coldFieldRadiusMultiplierD
      ? settings.coldFieldRadiusMultiplierD * outsideDiameterMm : null
    : policy?.governingRadiusMm || null;
}
function policyActivation(settings) {
  const autoB314 = settings.designBasis === 'asme-b31.4'
    && settings.classificationMode === 'source-authority-auto';
  return { elasticActive: autoB314 || (settings.designBasis === 'asme-b31.4'
      && settings.bendClass === 'elastic'),
    coldActive: autoB314 || (settings.designBasis === 'asme-b31.4'
      && settings.bendClass === 'cold-field') };
}
function screeningWarnings(settings, screening) {
  const warnings = [], { elasticActive, coldActive } = policyActivation(settings);
  if (!settings.designBasis) warnings.push(bendDiagnostic('BLOCKING',
    'PIPELINE_CONFIGURATION_PROFILE_REQUIRED', 'Select an explicit engineering profile.'));
  if (settings.enabled === true && settings.designBasis !== 'gre' && !screening.outsideDiameterMm) {
    warnings.push(bendDiagnostic('BLOCKING', 'PIPELINE_CONFIGURATION_DIAMETER_REQUIRED',
      'Bend resolution requires an explicitly authorized physical outside diameter.'));
  }
  if (settings.enabled === true && ![settings.detectHorizontal, settings.detectVertical,
    settings.detectCompound].every((value) => typeof value === 'boolean')) warnings.push(bendDiagnostic(
    'BLOCKING', 'PIPELINE_CONFIGURATION_FIELD_REQUIRED',
    'Horizontal, vertical and compound detection choices must be explicit.'));
  if (settings.enabled === true && elasticActive && settings.useFormulaMinimum === true
    && (!settings.youngsModulusMpa || !settings.allowableBendingStressMpa)) warnings.push(bendDiagnostic(
    'BLOCKING', 'PIPELINE_CONFIGURATION_B314_ELASTIC_CRITERIA_REQUIRED',
    'Enabled B31.4 formula screening requires E and allowable bending stress.'));
  if (settings.enabled === true && coldActive && settings.coldFieldRadiusMode === 'b31.4-size-band'
    && !screening.coldFieldPolicy?.normalCodeRadiusD) warnings.push(bendDiagnostic('BLOCKING',
    'PIPELINE_CONFIGURATION_B314_COLD_FIELD_CRITERIA_REQUIRED',
    'B31.4 size-band mode requires authenticated canonical NPS.'));
  if (settings.enabled === true && screening.coldFieldPolicy?.qualificationEvidenceRequired) {
    warnings.push(bendDiagnostic('BLOCKING', 'PIPELINE_CONFIGURATION_B314_COLD_FIELD_CRITERIA_REQUIRED',
      'The qualified alternative requires qualification evidence.'));
  }
  if (settings.enabled === true && settings.designBasis === 'gre') warnings.push(bendDiagnostic(
    'WARNING', 'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED',
    'Qualified GRE evidence is retained, but GRE bend/tee geometry is not constructed.',
    screening.grePlaceholder));
  if (settings.enabled === true && settings.emitToInputXml === true
    && settings.screeningOnlyAcknowledged !== true) warnings.push(bendDiagnostic('BLOCKING',
    'PIPELINE_CONFIGURATION_USER_CONFIRMATION_REQUIRED',
    'InputXML bend emission requires explicit combined-load review acknowledgement.'));
  return warnings;
}
export function calculateElasticBendScreening(settingsInput = {}, branchInfo = {}) {
  const settings = normalizeElasticBendSettings(settingsInput);
  const outsideDiameterMm = resolveOutsideDiameterMm(settings, branchInfo);
  const elastic = elasticCriteria(settings, outsideDiameterMm);
  const coldFieldPolicy = resolveSizeBandPolicy(settings, outsideDiameterMm);
  const grePlaceholder = resolveGreFittingPlaceholder(settings);
  const governingRadiusMm = globalRadius(settings, outsideDiameterMm,
    elastic.elasticGoverningRadiusMm, coldFieldPolicy);
  const stressMpa = elastic.elasticGoverningRadiusMm && outsideDiameterMm
    && settings.youngsModulusMpa
    ? settings.youngsModulusMpa * outsideDiameterMm / (2 * elastic.elasticGoverningRadiusMm) : null;
  const screening = { settings, outsideDiameterMm, ...elastic, coldFieldPolicy, grePlaceholder,
    governingRadiusMm, stressMpa, policyReady: Boolean(settings.designBasis) };
  return Object.freeze({ ...screening,
    warnings: Object.freeze(screeningWarnings(settings, screening)) });
}
