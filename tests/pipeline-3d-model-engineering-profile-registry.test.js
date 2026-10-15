import assert from 'node:assert/strict';
import {
  PIPELINE_ENGINEERING_PROFILE_IDS,
  PIPELINE_ENGINEERING_PROFILE_MODES,
  PIPELINE_ENGINEERING_PROFILE_REGISTRY,
  createPipelineEngineeringProfileRegistry,
  getPipelineEngineeringProfile,
  resolvePipelineEngineeringProfile,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-profile-registry.js';

const IDS = ['normal-metallic', 'asme-b31.4', 'gre'];
const REQUIRED_FIELDS = [
  'schema', 'profileId', 'displayName', 'resolvedMode', 'legacyDesignBasis',
  'materialState', 'materialFamilyPolicy', 'pipingCode', 'codeEditionPolicy',
  'fittingPolicyId', 'fittingResolverId', 'allowedDiameterBases',
  'requiredPropertySeedNames', 'sourceAuthority', 'status',
];

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const item of Object.values(value)) assertDeepFrozen(item);
}

function mutableDescriptors() {
  return PIPELINE_ENGINEERING_PROFILE_REGISTRY.profiles.map((profile) => JSON.parse(JSON.stringify(profile)));
}

function assertCanonicalMutationBlocked(profileIndex, mutate, expectedCode) {
  const inputs = mutableDescriptors();
  mutate(inputs[profileIndex]);
  const registry = createPipelineEngineeringProfileRegistry(inputs);
  assert.equal(registry.ready, false);
  assert.ok(registry.blockerCodes.includes('PIPELINE_PROFILE_REGISTRY_INCOMPLETE'));
  assert.ok(registry.blockerCodes.includes(expectedCode));
  return registry;
}

assert.equal(PIPELINE_ENGINEERING_PROFILE_REGISTRY.schema, 'PipelineEngineeringProfileRegistry.v1');
assert.equal(PIPELINE_ENGINEERING_PROFILE_REGISTRY.ready, true);
assert.deepEqual(PIPELINE_ENGINEERING_PROFILE_REGISTRY.profiles.map((profile) => profile.profileId), IDS);
assert.equal(new Set(PIPELINE_ENGINEERING_PROFILE_REGISTRY.profiles.map((profile) => profile.profileId)).size, 3);
assert.deepEqual(Object.values(PIPELINE_ENGINEERING_PROFILE_IDS), IDS);
assert.deepEqual(Object.values(PIPELINE_ENGINEERING_PROFILE_MODES), ['NORMAL', 'ASME_B31_4', 'GRE']);
for (const profile of PIPELINE_ENGINEERING_PROFILE_REGISTRY.profiles) {
  for (const field of REQUIRED_FIELDS) assert.ok(Object.hasOwn(profile, field), `${profile.profileId} missing ${field}`);
  assert.equal(profile.schema, 'PipelineEngineeringProfile.v1');
  assert.equal(profile.status, 'CONTRACT_ONLY');
  assert.equal(profile.fittingResolverId, 'NOT_BOUND');
}

assert.equal(getPipelineEngineeringProfile('normal-metallic').resolvedMode, 'NORMAL');
assert.equal(getPipelineEngineeringProfile('asme-b31.4').resolvedMode, 'ASME_B31_4');
assert.equal(getPipelineEngineeringProfile('gre').resolvedMode, 'GRE');
assert.equal(getPipelineEngineeringProfile('GRE'), null);
assert.equal(getPipelineEngineeringProfile('Normal-Metallic'), null);

const recognized = resolvePipelineEngineeringProfile('asme-b31.4', {
  sourceAuthority: 'TEST', sourceReference: 'row-7',
});
assert.equal(recognized.schema, 'PipelineEngineeringProfileResolution.v1');
assert.equal(recognized.status, 'RESOLVED');
assert.equal(recognized.ready, true);
assert.equal(recognized.fallbackApplied, false);
assert.equal(recognized.resolvedMode, 'ASME_B31_4');
assert.equal(recognized.profile.profileId, 'asme-b31.4');
assert.equal(recognized.sourceAuthority, 'TEST');
assert.equal(recognized.sourceReference, 'row-7');

const missing = resolvePipelineEngineeringProfile('');
assert.equal(missing.status, 'UNRESOLVED_LEGACY');
assert.equal(missing.resolutionReason, 'LEGACY_PROFILE_NOT_SPECIFIED');
assert.equal(missing.fallbackEligible, true);
assert.equal(missing.fallbackApplied, false);
assert.equal(missing.ready, false);
assert.equal(missing.resolvedProfileId, '');
assert.equal(missing.profile, null);
assert.deepEqual(missing.blockerCodes, []);

const unknown = resolvePipelineEngineeringProfile('normal');
assert.equal(unknown.status, 'BLOCKED');
assert.equal(unknown.resolutionReason, 'PROFILE_ID_NOT_REGISTERED');
assert.equal(unknown.fallbackEligible, false);
assert.equal(unknown.fallbackApplied, false);
assert.equal(unknown.ready, false);
assert.deepEqual(unknown.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const reversed = createPipelineEngineeringProfileRegistry(mutableDescriptors().reverse());
assert.equal(JSON.stringify(reversed), JSON.stringify(PIPELINE_ENGINEERING_PROFILE_REGISTRY));

const duplicateInputs = mutableDescriptors();
duplicateInputs.push(JSON.parse(JSON.stringify(duplicateInputs[0])));
const duplicate = createPipelineEngineeringProfileRegistry(duplicateInputs);
assert.equal(duplicate.ready, false);
assert.ok(duplicate.blockerCodes.includes('PIPELINE_PROFILE_REGISTRY_DUPLICATE'));
assert.ok(duplicate.blockerCodes.includes('PIPELINE_PROFILE_REGISTRY_INCOMPLETE'));

const incompleteInputs = mutableDescriptors();
delete incompleteInputs[1].displayName;
const incomplete = createPipelineEngineeringProfileRegistry(incompleteInputs);
assert.equal(incomplete.ready, false);
assert.ok(incomplete.blockerCodes.includes('PIPELINE_PROFILE_DESCRIPTOR_INVALID'));
assert.ok(incomplete.blockerCodes.includes('PIPELINE_PROFILE_REGISTRY_INCOMPLETE'));

const unsupportedInputs = mutableDescriptors();
unsupportedInputs[2].resolvedMode = 'GRE_UNKNOWN';
const unsupported = createPipelineEngineeringProfileRegistry(unsupportedInputs);
assert.equal(unsupported.ready, false);
assert.deepEqual(unsupported.blockerCodes, [
  'PIPELINE_PROFILE_REGISTRY_INCOMPLETE',
  'PIPELINE_PROFILE_MODE_INVALID',
]);

const mixedInputs = mutableDescriptors();
mixedInputs[0].resolvedMode = 'BAD_MODE';
mixedInputs.push({ ...mixedInputs[0] });
const mixed = createPipelineEngineeringProfileRegistry(mixedInputs.reverse());
assert.deepEqual(mixed.blockerCodes, [
  'PIPELINE_PROFILE_REGISTRY_DUPLICATE',
  'PIPELINE_PROFILE_REGISTRY_INCOMPLETE',
  'PIPELINE_PROFILE_MODE_INVALID',
]);
assert.equal(JSON.stringify(mixed), JSON.stringify(createPipelineEngineeringProfileRegistry(mixedInputs)));

const wrongSchema = assertCanonicalMutationBlocked(
  0, (profile) => { profile.schema = 'PipelineEngineeringProfile.v9'; },
  'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
);
assert.deepEqual(wrongSchema.diagnostics.find(
  (item) => item.code === 'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
).details.mismatchedFields, ['schema']);

assertCanonicalMutationBlocked(
  0, (profile) => { profile.resolvedMode = 'GRE'; },
  'PIPELINE_PROFILE_MODE_INVALID',
);
assertCanonicalMutationBlocked(
  2, (profile) => { profile.materialState = 'METALLIC'; },
  'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
);
assertCanonicalMutationBlocked(
  1, (profile) => { profile.pipingCode = 'PROJECT_DEFINED'; },
  'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
);
assertCanonicalMutationBlocked(
  2, (profile) => { profile.fittingPolicyId = 'NORMAL_METALLIC_FITTING_POLICY'; },
  'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
);

const callerInputs = mutableDescriptors();
const isolated = createPipelineEngineeringProfileRegistry(callerInputs);
callerInputs[0].displayName = 'MUTATED';
callerInputs[0].allowedDiameterBases.push('MUTATED');
assert.equal(isolated.profiles[0].displayName, 'Normal Metallic');
assert.deepEqual(isolated.profiles[0].allowedDiameterBases, ['PROJECT_DEFINED']);

const unsafeInputs = mutableDescriptors();
unsafeInputs[0].extra = new Date(0);
const unsafe = createPipelineEngineeringProfileRegistry(unsafeInputs);
assert.equal(unsafe.ready, false);
assert.ok(unsafe.blockerCodes.includes('PIPELINE_PROFILE_DESCRIPTOR_INVALID'));
assert.doesNotThrow(() => JSON.parse(JSON.stringify(unsafe)));

assertDeepFrozen(PIPELINE_ENGINEERING_PROFILE_REGISTRY);
assertDeepFrozen(recognized);
assertDeepFrozen(missing);
assertDeepFrozen(unknown);
assertDeepFrozen(isolated);
assert.equal(JSON.stringify(recognized), JSON.stringify(resolvePipelineEngineeringProfile('asme-b31.4', {
  sourceAuthority: 'TEST', sourceReference: 'row-7',
})));

console.log('Pipeline engineering profile registry tests passed.');
