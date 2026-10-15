export const B31_4_COLD_FIELD_POLICY = Object.freeze({
  schema: 'PipelineColdFieldBendPolicy.v1',
  standard: 'ASME B31.4',
  edition: '2025',
  radiusReference: '404.2.2',
  constructionReference: '434.7.1',
  tangentReference: '434.7.1(d)',
  qualifiedAlternativeRadiusD: 18,
});

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

export function normalizeNominalPipeSizeNps(value) {
  return positive(String(value ?? '').replace(/^NPS\s*/i, ''));
}

export function b314NormalColdFieldRadiusD(npsInput) {
  const nps = normalizeNominalPipeSizeNps(npsInput);
  if (!nps) return null;
  if (nps <= 12) return 18;
  if (nps === 14) return 21;
  if (nps === 16) return 24;
  if (nps === 18) return 27;
  if (nps >= 20) return 30;
  return null;
}

function radiusMm(multiplierD, outsideDiameterMm) {
  return multiplierD && outsideDiameterMm ? multiplierD * outsideDiameterMm : null;
}

export function resolveColdFieldBendPolicy(input = {}) {
  const outsideDiameterMm = positive(input.outsideDiameterMm);
  const nominalPipeSizeNps = normalizeNominalPipeSizeNps(input.nominalPipeSizeNps);
  const normalCodeRadiusD = b314NormalColdFieldRadiusD(nominalPipeSizeNps);
  const qualificationEvidenceId = cleanText(input.qualificationEvidenceId);
  const qualificationRequested = Boolean(input.useQualified18DAlternative);
  const qualificationEligible = Boolean(normalCodeRadiusD && nominalPipeSizeNps >= 14);
  const qualifiedAlternativeApplied = Boolean(
    qualificationRequested && qualificationEligible && qualificationEvidenceId,
  );
  const selectedCodeRadiusD = qualifiedAlternativeApplied
    ? B31_4_COLD_FIELD_POLICY.qualifiedAlternativeRadiusD
    : normalCodeRadiusD;
  const projectMinimumRadiusD = input.useProjectMinimum === false
    ? null
    : positive(input.projectMinimumRadiusD);
  const procedureMinimumRadiusD = positive(input.procedureMinimumRadiusD);
  const criteriaD = [selectedCodeRadiusD, projectMinimumRadiusD, procedureMinimumRadiusD]
    .filter((value) => positive(value));
  const governingRadiusD = criteriaD.length ? Math.max(...criteriaD) : null;
  return Object.freeze({
    ...B31_4_COLD_FIELD_POLICY,
    outsideDiameterMm,
    nominalPipeSizeNps,
    normalCodeRadiusD,
    selectedCodeRadiusD,
    projectMinimumRadiusD,
    procedureMinimumRadiusD,
    qualificationRequested,
    qualificationEligible,
    qualificationEvidenceId,
    qualifiedAlternativeApplied,
    qualificationEvidenceRequired: qualificationRequested && !qualifiedAlternativeApplied,
    normalCodeRadiusMm: radiusMm(normalCodeRadiusD, outsideDiameterMm),
    selectedCodeRadiusMm: radiusMm(selectedCodeRadiusD, outsideDiameterMm),
    projectMinimumRadiusMm: radiusMm(projectMinimumRadiusD, outsideDiameterMm),
    procedureMinimumRadiusMm: radiusMm(procedureMinimumRadiusD, outsideDiameterMm),
    governingRadiusD,
    governingRadiusMm: radiusMm(governingRadiusD, outsideDiameterMm),
  });
}
