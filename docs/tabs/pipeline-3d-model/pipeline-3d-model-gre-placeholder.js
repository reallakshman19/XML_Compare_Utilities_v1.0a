export const GRE_PLACEHOLDER_SCHEMA = 'PipelineGreFittingPlaceholder.v1';

function positive(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null;
}
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
export function resolveGreFittingPlaceholder(settings = {}) {
  const active = settings.designBasis === 'gre';
  const nominalBoreMm = positive(settings.greNominalBoreMm);
  const breakLengthBasis = ['NOMINAL_BORE_MULTIPLIER', 'EXPLICIT_LENGTH']
    .includes(settings.greBendBreakLengthBasis) ? settings.greBendBreakLengthBasis : '';
  const breakMultiplierBore = breakLengthBasis === 'NOMINAL_BORE_MULTIPLIER'
    ? positive(settings.greBendBreakMultiplierBore) : null;
  const explicitLength = positive(settings.greBendBreakLengthMm);
  const breakLengthMm = breakLengthBasis === 'NOMINAL_BORE_MULTIPLIER'
    && nominalBoreMm && breakMultiplierBore ? nominalBoreMm * breakMultiplierBore
    : breakLengthBasis === 'EXPLICIT_LENGTH' ? explicitLength : null;
  return Object.freeze({
    schema: GRE_PLACEHOLDER_SCHEMA, active, policyReady: false, resolverReady: false,
    geometryApplied: false, inputXmlApplied: false,
    requirementReference: text(settings.greRequirementReference),
    bend: Object.freeze({
      radiusBasis: 'GRE_PLACEHOLDER', radiusMm: positive(settings.greBendRadiusMm),
      breakLengthBasis, nominalBoreMm, breakMultiplierBore, breakLengthMm,
      localThicknessMm: positive(settings.greBendLocalThicknessMm), resolverReady: false,
    }),
    tee: Object.freeze({
      breakLengthBasis: 'EXPLICIT_LENGTH',
      breakLengthMm: positive(settings.greTeeBreakLengthMm),
      localThicknessMm: positive(settings.greTeeLocalThicknessMm), resolverReady: false,
    }),
  });
}
