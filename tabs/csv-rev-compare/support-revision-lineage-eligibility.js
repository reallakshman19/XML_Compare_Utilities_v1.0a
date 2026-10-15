const clean = (value) => String(value ?? '').trim();

/**
 * Civil + PIPE is the logical support-location identity, but identity text alone
 * does not prove an active engineering support. Retained identity-only rows stay
 * in the model/output/audit and are excluded only from automatic lineage.
 */
export function classifySupportLocationEvidence(location) {
  const components = location?.components || [];
  const hasComponentEvidence = components.some((component) => clean(component?.reference) || clean(component?.memberId) || clean(component?.supportType));
  const hasCoordinateEvidence = ['x', 'y', 'z'].some((axis) => clean(location?.position?.[axis]?.raw) || Number.isFinite(location?.position?.[axis]?.directedMm));
  const loadSlots = location?.loads?.slots || location?.loads || [];
  const hasLoadEvidence = loadSlots.some((slot) => clean(slot?.raw ?? slot?.fields?.raw));
  const hasSupportCountEvidence = Boolean(clean(location?.sourceFields?.totalSupportPoints));
  const hasDescriptionEvidence = Boolean(clean(location?.sourceFields?.primarySupportDescription));
  const evidence = Object.freeze({ hasComponentEvidence, hasCoordinateEvidence, hasLoadEvidence, hasSupportCountEvidence, hasDescriptionEvidence });
  const eligible = Object.values(evidence).some(Boolean);
  return Object.freeze({ eligible, classification: eligible ? 'ACTIVE_ENGINEERING_LOCATION' : 'IDENTITY_ONLY_SHELL', reasonCode: eligible ? 'ENGINEERING_PAYLOAD_PRESENT' : 'IDENTITY_WITHOUT_ENGINEERING_PAYLOAD', evidence });
}

export function buildLineageEligibleModel(model) {
  const ignored = [], locations = [];
  for (const location of model?.locations || []) {
    const assessment = classifySupportLocationEvidence(location);
    if (assessment.eligible) locations.push(location);
    else ignored.push(Object.freeze({ nodeId: location.nodeId, sourceRowId: location.sourceRowId, supportLocationIdentity: location.supportLocationIdentity, ...assessment }));
  }
  const locationByNodeId = new Map(locations.map((location) => [location.nodeId, location]));
  return Object.freeze({ model: Object.freeze({ ...model, locations: Object.freeze(locations), locationByNodeId }), ignored: Object.freeze(ignored) });
}

export function attachLineageEligibility(lineage, sourceEligibility, targetEligibility) {
  return Object.freeze({
    ...lineage,
    comparisonEligibility: Object.freeze({
      policy: 'Identity-only rows remain auditable/output-visible but cannot consume automatic active-support lineage.',
      ignoredSourceLocations: sourceEligibility.ignored,
      ignoredTargetLocations: targetEligibility.ignored,
    }),
  });
}
