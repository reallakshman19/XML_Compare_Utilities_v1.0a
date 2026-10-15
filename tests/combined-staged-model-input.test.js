import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPsFamilyNativeAuditPipeline,
  createPsFamilyNativePipelineReadiness,
} from '../tabs/ps-family-clash-audit/ps-family-native-combined-input.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';
import { SUPPORT_STEEL_SAMPLE_COMBINED } from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

test('one combined staged model reconstructs support and structural evidence', () => {
  const bundle = buildSupportSteelRelationshipBundle({
    combinedInput: SUPPORT_STEEL_SAMPLE_COMBINED,
  });
  assert.equal(bundle.inputMode, 'COMBINED_STAGED_MODEL');
  assert.ok(bundle.supportFamilies.length > 0);
  assert.ok(bundle.steelGroups.length > 0);
  assert.ok(bundle.supportFamilies.some((row) => row.familyId === '/PS-14259'));
  assert.ok(bundle.steelGroups.some((row) => row.steelGroupId === '/SL-4201'));
});

test('native combined wrapper exposes one input schema and classified readiness', () => {
  const readiness = createPsFamilyNativePipelineReadiness({
    combinedInput: SUPPORT_STEEL_SAMPLE_COMBINED,
  });
  assert.equal(readiness.inputMode, 'COMBINED_STAGED_MODEL');
  assert.equal(readiness.blocking, false);
  assert.ok(readiness.summary.sourceRecordCount > 0);
  assert.ok(readiness.summary.supportRecordCount > 0);
  assert.ok(readiness.summary.steelRecordCount > 0);

  const pipeline = buildPsFamilyNativeAuditPipeline({
    combinedInput: SUPPORT_STEEL_SAMPLE_COMBINED,
  });
  assert.equal(pipeline.inputMode, 'COMBINED_STAGED_MODEL');
  assert.deepEqual(Object.keys(pipeline.inputSchemas), ['combinedModel']);
  assert.equal(pipeline.relationshipBundle.inputMode, 'COMBINED_STAGED_MODEL');
  assert.ok(pipeline.summary.supportFamilyCount > 0);
  assert.ok(pipeline.summary.steelGroupCount > 0);
});

test('combined readiness blocks a model without structural records', () => {
  const supportOnly = SUPPORT_STEEL_SAMPLE_COMBINED.filter((row) => row.type !== 'STEEL_GROUP');
  const readiness = createPsFamilyNativePipelineReadiness({ combinedInput: supportOnly });
  assert.equal(readiness.blocking, true);
  assert.ok(readiness.diagnostics.some((row) => row.code === 'NO_STRUCTURAL_GROUPS_IN_COMBINED_MODEL'));
});
