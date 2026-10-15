function blockerCodes(value) {
  return Array.isArray(value) ? value.map((code) => String(code || '').trim()).filter(Boolean) : [];
}

export function resolvePipelineInputXmlBlockers(output = {}) {
  const blockers = [...new Set([
    ...blockerCodes(output.orchestration?.blockerCodes),
    ...blockerCodes(output.exportQualification?.blockerCodes),
    ...blockerCodes(output.inputXmlDocumentPlan?.blockerCodes),
  ])];
  if (output.exportQualification
    && output.exportQualification.inputXmlAllowed !== true && blockers.length === 0) {
    blockers.push('PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED');
  }
  return Object.freeze(blockers);
}

export function resolvePipelineInputXmlReadiness(output = {}) {
  const blockerCodes = resolvePipelineInputXmlBlockers(output);
  const blocked = blockerCodes.length > 0;
  return Object.freeze({ state: blocked ? 'BLOCKED' : 'READY', blocked, blockerCodes });
}
