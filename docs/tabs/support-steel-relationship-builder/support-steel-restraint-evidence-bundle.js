import { buildSupportRestraintFunctionBundle } from './support-restraint-function-engine.js';
import { buildSupportSteelRelationshipBundle as buildBaseBundle } from './support-steel-evidence-bundle.js';

export function buildSupportSteelRelationshipBundle(input = {}) {
  const bundle = buildBaseBundle(input);
  const restraintFunction = buildSupportRestraintFunctionBundle({
    supportFamilies: bundle.supportFamilies || [],
    carrierObjects: bundle.supportCarrierResolution?.carrierObjects || [],
    carrierAttachment: bundle.supportCarrierAttachment || {},
    carrierToStructurePath: bundle.supportCarrierToStructurePath || {},
    supportMemberChain: bundle.supportMemberChain || {},
    config: input.config || {},
  });
  return {
    ...bundle,
    restraintFunctionSchema: restraintFunction.schema,
    carrierLocalFrameSchema: restraintFunction.carrierFrameSchema,
    bundlePurpose: `${bundle.bundlePurpose || 'RELATIONSHIP_AUDIT'}_AND_RESTRAINT_FUNCTION_VALIDATION`,
    analyticalRestraintFunctionEvidenceAvailable: restraintFunction.restraintEdges.length > 0,
    supportRestraintFunction: restraintFunction,
    summary: {
      ...(bundle.summary || {}),
      restraintFunctionAssessmentCount: restraintFunction.summary.assessmentCount,
      restraintFunctionConfirmedFamilyCount: restraintFunction.summary.confirmedFamilyCount,
      restraintFunctionPartiallyConfirmedFamilyCount: restraintFunction.summary.partiallyConfirmedFamilyCount,
      restraintFunctionConflictFamilyCount: restraintFunction.summary.conflictFamilyCount,
      restraintFunctionAmbiguousFamilyCount: restraintFunction.summary.ambiguousFamilyCount,
      restraintFunctionNotProvenFamilyCount: restraintFunction.summary.notProvenFamilyCount,
      restraintFunctionExceptionCount: restraintFunction.summary.exceptionCount,
    },
    diagnostics: [
      ...(bundle.diagnostics || []),
      ...(restraintFunction.diagnostics || []),
    ],
  };
}
