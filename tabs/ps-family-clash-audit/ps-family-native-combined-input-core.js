import {
  buildPsFamilyNativeAuditPipeline as buildCorePipeline,
  createPsFamilyNativePipelineReadiness as createCoreReadiness,
} from './ps-family-native-audit-pipeline.js';
import { collectSteelGroups, collectSupportFamilies } from '../support-steel-relationship-builder/support-steel-source-reader.js';
import { parseSupportSteelJson } from '../support-steel-relationship-builder/support-steel-source-utils.js';

export function buildPsFamilyNativeAuditPipeline(input = {}) {
  const combinedInput = parseCombinedInput(input);
  const pipeline = buildCorePipeline({
    ...input,
    supportInput: combinedInput,
    steelInput: combinedInput,
  });
  return {
    ...pipeline,
    inputMode: 'COMBINED_STAGED_MODEL',
    inputSchemas: { combinedModel: sourceSchema(combinedInput) },
  };
}

export function createPsFamilyNativePipelineReadiness(input = {}) {
  let combinedInput;
  try {
    combinedInput = parseCombinedInput(input);
  } catch (error) {
    return Object.freeze({
      schema: 'PsFamilyNativeAuditPipelineReadiness.v1',
      productionMode: 'STAGED_JSON_PIPELINE',
      inputMode: 'COMBINED_STAGED_MODEL',
      xmlRequired: false,
      blocking: true,
      summary: {
        sourceRecordCount: 0,
        supportRecordCount: 0,
        steelRecordCount: 0,
        errorCount: 1,
        warningCount: 0,
      },
      diagnostics: [{
        level: 'ERROR',
        code: 'INVALID_COMBINED_STAGED_MODEL',
        message: error.message || String(error),
      }],
    });
  }
  const readiness = createCoreReadiness({
    ...input,
    supportInput: combinedInput,
    steelInput: combinedInput,
  });
  const supportFamilies = collectSupportFamilies(combinedInput);
  const steelGroups = collectSteelGroups(combinedInput);
  const diagnostics = (readiness.diagnostics || []).filter((row) => (
    !['EMPTY_STAGED_SUPPORT_SOURCE', 'EMPTY_STAGED_STEEL_SOURCE'].includes(row.code)
  ));
  if (!supportFamilies.length) {
    diagnostics.push({
      level: 'ERROR',
      code: 'NO_SUPPORT_FAMILIES_IN_COMBINED_MODEL',
      message: 'No support-family records were detected in the combined staged model.',
    });
  }
  if (!steelGroups.length) {
    diagnostics.push({
      level: 'ERROR',
      code: 'NO_STRUCTURAL_GROUPS_IN_COMBINED_MODEL',
      message: 'No structural steel records were detected in the combined staged model.',
    });
  }
  return Object.freeze({
    ...readiness,
    inputMode: 'COMBINED_STAGED_MODEL',
    blocking: diagnostics.some((row) => row.level === 'ERROR'),
    summary: {
      sourceRecordCount: sourceRecordCount(combinedInput),
      supportRecordCount: supportFamilies.length,
      steelRecordCount: steelGroups.length,
      errorCount: diagnostics.filter((row) => row.level === 'ERROR').length,
      warningCount: diagnostics.filter((row) => row.level === 'WARN').length,
    },
    diagnostics,
  });
}

function parseCombinedInput(input) {
  const value = input.combinedInput
    ?? input.combinedInputText
    ?? input.stagedInput
    ?? input.stagedInputText;
  if (value === undefined || value === null || String(value).trim?.() === '') {
    throw new Error('Combined staged model source is empty.');
  }
  return parseSupportSteelJson(value, 'Combined staged model source');
}

function sourceSchema(value) {
  if (value?.schema) return value.schema;
  return Array.isArray(value) ? 'StagedJsonArray' : 'StagedJsonObject';
}

function sourceRecordCount(value) {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.objects)) return value.objects.length;
  return value && typeof value === 'object' ? 1 : 0;
}
