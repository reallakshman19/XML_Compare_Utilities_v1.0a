import assert from 'node:assert/strict';
import { buildPipelineEngineeringConfigurationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration.js';
import { createEmptyPipelineEngineeringConfigurationDraft, setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-fields.js';
import { PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY,
  confirmPipelineEngineeringConfigurationFields, loadPipelineEngineeringConfigurationDraft,
  rejectPipelineEngineeringConfigurationFields } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-storage.js';
class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}
function set(draft, fieldId, value) { return setPipelineEngineeringConfigurationField(draft, fieldId, value); }
function normalDraft() {
  let draft = createEmptyPipelineEngineeringConfigurationDraft(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
  for (const [key, value] of Object.entries({
    jobName: 'JOB-1', caesarVersion: '11.00', branchName: 'BR-1', lineNo: 'LINE-1',
    outsideDiameterMm: 100, wallThickness: 0, materialNumber: 0, corrosionAllowance: 0,
    insulationThickness: 0, insulationDensity: 0, fluidDensity: 0, hydroPressure: 0,
    bendScreeningEnabled: true, emitToInputXml: true, screeningOnlyAcknowledged: true,
    detectHorizontal: true, detectVertical: true, detectCompound: true,
    minimumPlanTurnAngleDeg: 0.25, minimumProfileTurnAngleDeg: 0.25, maximumTurnAngleDeg: 45,
    shortElementAnglePolicy: 'include-all', minimumAngleElementLengthMm: 0,
    retainedStraightAllowanceMm: 0, preferredStraightTangentMm: 2000,
    emitNearPointNode: true, emitMidpointNode: true, bendTypeCode: 0,
    normalFittingPolicyId: 'normal-explicit-radius-bend', normalRadiusMm: 150,
  })) draft = set(draft, key, value);
  return updatePipelineEngineeringConfigurationDraftCollections(draft, {
    sections: [{ startElementIndex: 0, profileId: 'normal-metallic', outsideDiameterMm: 100 }],
  });
}
const emptyPlan = buildPipelineEngineeringConfigurationPlan(createEmptyPipelineEngineeringConfigurationDraft());
assert.equal(emptyPlan.ready, false);
assert.ok(emptyPlan.blockerCodes.includes('PIPELINE_CONFIGURATION_PROFILE_REQUIRED'));
const ready = buildPipelineEngineeringConfigurationPlan(normalDraft());
assert.equal(ready.ready, true, JSON.stringify(ready.blockerCodes));
assert.equal(ready.branchInfo.wallThickness, 0); assert.equal(ready.branchInfo.materialNumber, 0);
assert.equal(ready.normalFittingPolicy.radiusMm, 150); assert.equal(ready.normalFittingPolicy.radiusD, null);
const corrupt = loadPipelineEngineeringConfigurationDraft(new MemoryStorage({
  [PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY]: '{bad',
}));
assert.ok(corrupt.blockerCodes.includes('PIPELINE_CONFIGURATION_STORAGE_INVALID'));
const migrated = loadPipelineEngineeringConfigurationDraft(new MemoryStorage({
  'pipeline-3d-model-bend-settings-v3': JSON.stringify({ designBasis: 'default-metallic',
    standardRadiusMultiplierD: 1.5, youngsModulusMpa: 207000 }),
}));
assert.equal(migrated.fields.profileId.state, 'LEGACY_UNCONFIRMED');
assert.equal(migrated.fields.normalRadiusD.ready, false);
const confirmed = confirmPipelineEngineeringConfigurationFields(migrated, ['profileId']);
assert.equal(confirmed.fields.profileId.state, 'CONFIRMED');
assert.equal(confirmed.fields.profileId.value, 'normal-metallic');
const rejected = rejectPipelineEngineeringConfigurationFields(migrated, ['normalRadiusD']);
assert.equal(rejected.fields.normalRadiusD.state, 'NOT_APPLICABLE');
assert.equal(rejected.fields.normalRadiusD.value, null);
assert.equal(rejected.fields.normalRadiusD.originalLegacyValue, 1.5);
assert.equal(rejected.fields.normalRadiusD.originalStorageKey, 'pipeline-3d-model-bend-settings-v3');
assert.equal(rejected.legacyRejectedFields.includes('normalRadiusD'), true);
console.log('pipeline-3d-model engineering configuration: PASS');
