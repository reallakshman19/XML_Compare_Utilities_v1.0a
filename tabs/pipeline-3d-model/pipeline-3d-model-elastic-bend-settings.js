export const ELASTIC_BEND_SETTINGS_SCHEMA = 'PipelineBendSettings.v4';
export const ELASTIC_BEND_STORAGE_KEY = 'pipeline-3d-model-bend-settings-v3';
export const V2_ELASTIC_BEND_STORAGE_KEY = 'pipeline-3d-model-elastic-bend-settings-v2';
export const LEGACY_ELASTIC_BEND_STORAGE_KEY = 'pipeline-3d-model-elastic-bend-settings-v1';

export const DEFAULT_ELASTIC_BEND_SETTINGS = Object.freeze({
  schema: ELASTIC_BEND_SETTINGS_SCHEMA,
  enabled: null, emitToInputXml: null, screeningOnlyAcknowledged: null,
  designBasis: '', requestedDesignBasis: '', profileFallbackApplied: false,
  profileResolutionReason: 'PROFILE_NOT_SPECIFIED', classificationMode: '', bendClass: '',
  standardRadiusMultiplierD: null, coldFieldRadiusMode: '', coldFieldRadiusMultiplierD: null,
  detectHorizontal: null, detectVertical: null, detectCompound: null,
  diameterSource: '', diameterBasisConfirmed: null, explicitOutsideDiameterMm: null,
  youngsModulusMpa: null, allowableBendingStressMpa: null,
  useFormulaMinimum: null, usePracticalMinimum: null, practicalRadiusMultiplierD: null,
  nominalPipeSizeNps: null, useColdFieldProjectMinimum: null,
  coldFieldProjectRadiusMultiplierD: null, coldFieldProcedureMinimumRadiusD: null,
  useQualified18DAlternative: null, qualificationEvidenceId: '',
  minimumTurnAngleDeg: null, minimumPlanTurnAngleDeg: null,
  minimumProfileTurnAngleDeg: null, maximumTurnAngleDeg: null,
  shortElementAnglePolicy: '', minimumAngleElementLengthMm: null,
  retainedStraightAllowanceMm: null, preferredStraightTangentMm: null,
  emitNearPointNode: null, emitMidpointNode: null,
  hardFailOnInfeasibleEmission: true, bendTypeCode: null,
  greNominalBoreMm: null, greBendRadiusMm: null, greBendBreakLengthBasis: '',
  greBendBreakMultiplierBore: null, greBendBreakLengthMm: null,
  greBendLocalThicknessMm: null, greTeeBreakLengthMm: null,
  greTeeLocalThicknessMm: null, greRequirementReference: '',
});

const text = (value) => typeof value === 'string' ? value.trim() : '';
function bool(value) {
  if (typeof value === 'boolean') return value;
  if (/^(1|true|yes|on)$/i.test(String(value ?? ''))) return true;
  if (/^(0|false|no|off)$/i.test(String(value ?? ''))) return false;
  return null;
}
function positive(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null;
}
function nonNegative(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null;
}
function exact(value, allowed) {
  const normalized = text(value); return allowed.includes(normalized) ? normalized : '';
}
function profile(seed) {
  const requestedDesignBasis = text(seed.designBasis || seed.requestedDesignBasis);
  const allowed = ['default-metallic', 'asme-b31.4', 'gre', 'section-routed'];
  const designBasis = allowed.includes(requestedDesignBasis) ? requestedDesignBasis : '';
  const reasons = { 'default-metallic': 'EXPLICIT_NORMAL',
    'asme-b31.4': 'EXPLICIT_ASME_B31_4', gre: 'EXPLICIT_GRE',
    'section-routed': 'CANONICAL_SECTION_PROFILE_ROUTING' };
  return { requestedDesignBasis, designBasis, profileFallbackApplied: false,
    profileResolutionReason: designBasis ? reasons[designBasis]
      : requestedDesignBasis ? 'PROFILE_INVALID' : 'PROFILE_NOT_SPECIFIED' };
}
function basis(seed) {
  const resolved = profile(seed);
  const classificationMode = exact(seed.classificationMode, ['source-authority-auto', 'legacy-global']);
  const bendClass = exact(seed.bendClass, ['standard', 'auto', 'elastic', 'cold-field', 'gre-placeholder']);
  return { ...resolved, classificationMode, bendClass };
}
export function normalizeElasticBendSettings(input = {}) {
  const seed = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const minimumPlanTurnAngleDeg = positive(seed.minimumPlanTurnAngleDeg ?? seed.minimumTurnAngleDeg);
  const minimumProfileTurnAngleDeg = positive(seed.minimumProfileTurnAngleDeg ?? seed.minimumTurnAngleDeg);
  const minimumTurnAngleDeg = minimumPlanTurnAngleDeg && minimumProfileTurnAngleDeg
    ? Math.min(minimumPlanTurnAngleDeg, minimumProfileTurnAngleDeg) : null;
  return Object.freeze({ schema: ELASTIC_BEND_SETTINGS_SCHEMA,
    enabled: bool(seed.enabled), emitToInputXml: bool(seed.emitToInputXml),
    screeningOnlyAcknowledged: bool(seed.screeningOnlyAcknowledged), ...basis(seed),
    standardRadiusMultiplierD: positive(seed.standardRadiusMultiplierD),
    coldFieldRadiusMode: exact(seed.coldFieldRadiusMode, ['project-multiplier', 'b31.4-size-band']),
    coldFieldRadiusMultiplierD: positive(seed.coldFieldRadiusMultiplierD),
    detectHorizontal: bool(seed.detectHorizontal), detectVertical: bool(seed.detectVertical),
    detectCompound: bool(seed.detectCompound),
    diameterSource: exact(seed.diameterSource, ['branch-diameter', 'explicit-od']),
    diameterBasisConfirmed: bool(seed.diameterBasisConfirmed),
    explicitOutsideDiameterMm: positive(seed.explicitOutsideDiameterMm),
    youngsModulusMpa: positive(seed.youngsModulusMpa),
    allowableBendingStressMpa: positive(seed.allowableBendingStressMpa),
    useFormulaMinimum: bool(seed.useFormulaMinimum), usePracticalMinimum: bool(seed.usePracticalMinimum),
    practicalRadiusMultiplierD: positive(seed.practicalRadiusMultiplierD),
    nominalPipeSizeNps: positive(seed.nominalPipeSizeNps),
    useColdFieldProjectMinimum: bool(seed.useColdFieldProjectMinimum),
    coldFieldProjectRadiusMultiplierD: positive(seed.coldFieldProjectRadiusMultiplierD),
    coldFieldProcedureMinimumRadiusD: positive(seed.coldFieldProcedureMinimumRadiusD),
    useQualified18DAlternative: bool(seed.useQualified18DAlternative),
    qualificationEvidenceId: text(seed.qualificationEvidenceId), minimumTurnAngleDeg,
    minimumPlanTurnAngleDeg, minimumProfileTurnAngleDeg,
    maximumTurnAngleDeg: positive(seed.maximumTurnAngleDeg),
    shortElementAnglePolicy: exact(seed.shortElementAnglePolicy, ['include-all', 'ignore-below-length']),
    minimumAngleElementLengthMm: nonNegative(seed.minimumAngleElementLengthMm),
    retainedStraightAllowanceMm: nonNegative(seed.retainedStraightAllowanceMm),
    preferredStraightTangentMm: nonNegative(seed.preferredStraightTangentMm),
    emitNearPointNode: bool(seed.emitNearPointNode), emitMidpointNode: bool(seed.emitMidpointNode),
    hardFailOnInfeasibleEmission: true,
    bendTypeCode: [0, 1, 2].includes(Number(seed.bendTypeCode)) ? Number(seed.bendTypeCode) : null,
    greNominalBoreMm: positive(seed.greNominalBoreMm), greBendRadiusMm: positive(seed.greBendRadiusMm),
    greBendBreakLengthBasis: exact(seed.greBendBreakLengthBasis, ['NOMINAL_BORE_MULTIPLIER', 'EXPLICIT_LENGTH']),
    greBendBreakMultiplierBore: positive(seed.greBendBreakMultiplierBore),
    greBendBreakLengthMm: positive(seed.greBendBreakLengthMm),
    greBendLocalThicknessMm: positive(seed.greBendLocalThicknessMm),
    greTeeBreakLengthMm: positive(seed.greTeeBreakLengthMm),
    greTeeLocalThicknessMm: positive(seed.greTeeLocalThicknessMm),
    greRequirementReference: text(seed.greRequirementReference) });
}
export function loadElasticBendSettings() { return normalizeElasticBendSettings(); }
export function saveElasticBendSettings(settings) { return normalizeElasticBendSettings(settings); }
