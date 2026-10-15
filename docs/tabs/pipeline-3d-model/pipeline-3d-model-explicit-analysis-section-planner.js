import { createPipelineAnalysisSectionPlan } from './pipeline-3d-model-analysis-section-contracts.js';
import { resolvePipelineAnalysisSectionPlan } from './pipeline-3d-model-analysis-section-planner.js';

function diagnostic(code, message) {
  return Object.freeze({ severity: 'BLOCKING', code, message, details: Object.freeze({}) });
}
export function resolveExplicitPipelineAnalysisSectionPlan(input = {}) {
  if (Array.isArray(input.analysisSections) && input.analysisSections.length) {
    return resolvePipelineAnalysisSectionPlan(input);
  }
  const item = diagnostic('PIPELINE_CONFIGURATION_PROFILE_REQUIRED',
    'Explicit analysis-section profile evidence is required; Normal is not a fallback.');
  return Object.freeze({
    analysisSectionPlan: createPipelineAnalysisSectionPlan({ sections: [], elementResolutions: [],
      diagnostics: [item], blockerCodes: [item.code] }),
    analysisSectionLedgerText: '', analysisSectionSource: Object.freeze({
      sourceKind: 'NONE', fallbackApplied: false, diagnostics: Object.freeze([item]) }),
  });
}
