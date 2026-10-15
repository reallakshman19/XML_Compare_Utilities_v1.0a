import assert from 'node:assert/strict';
import {
  PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA,
  PIPELINE_ENGINEERING_CONFIGURATION_FIELD_SCHEMA,
  PIPELINE_ENGINEERING_CONFIGURATION_PLAN_SCHEMA,
  createPipelineEngineeringConfigurationDraft,
  createPipelineEngineeringConfigurationField,
  createPipelineEngineeringConfigurationPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-contracts.js';

const unset = createPipelineEngineeringConfigurationField({
  fieldId: 'outsideDiameterMm', value: null, valueType: 'number', unit: 'mm',
  state: 'UNSET', sourceKind: 'NONE',
});
assert.equal(unset.schema, PIPELINE_ENGINEERING_CONFIGURATION_FIELD_SCHEMA);
assert.equal(unset.ready, false);
assert.equal(Object.isFrozen(unset), true);
const zero = createPipelineEngineeringConfigurationField({
  fieldId: 'corrosionAllowance', value: 0, valueType: 'number', unit: 'mm',
  state: 'USER_ENTERED', sourceKind: 'USER_SETTINGS_UI', userConfirmed: true,
});
assert.equal(zero.value, 0);
assert.equal(zero.ready, true);
const legacy = createPipelineEngineeringConfigurationField({
  fieldId: 'normalRadiusD', value: 1.5, valueType: 'number', unit: 'D',
  state: 'LEGACY_UNCONFIRMED', sourceKind: 'NONE', legacyObserved: true,
});
assert.equal(legacy.ready, false);
const draft = createPipelineEngineeringConfigurationDraft({ fields: { outsideDiameterMm: zero } });
assert.equal(draft.schema, PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA);
assert.equal(Object.isFrozen(draft.fields.outsideDiameterMm), true);
const plan = createPipelineEngineeringConfigurationPlan({ fields: draft.fields });
assert.equal(plan.schema, PIPELINE_ENGINEERING_CONFIGURATION_PLAN_SCHEMA);
assert.equal(Object.isFrozen(plan), true);
assert.doesNotThrow(() => createPipelineEngineeringConfigurationDraft({ fields: { x: new Date() } }));
assert.equal(createPipelineEngineeringConfigurationDraft({ fields: { x: new Date() } }).ready, false);
console.log('pipeline-3d-model engineering configuration contracts: PASS');
