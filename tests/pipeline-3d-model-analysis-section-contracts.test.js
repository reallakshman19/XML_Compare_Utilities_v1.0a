import assert from 'node:assert/strict';
import {
  createPipelineAnalysisSection,
  createPipelineAnalysisSectionPlan,
  createPipelineElementSectionResolution,
  isPipelineAnalysisSection,
  isPipelineAnalysisSectionPlan,
  isPipelineElementSectionResolution,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-contracts.js';

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const item of Object.values(value)) assertDeepFrozen(item);
}

const validSectionInput = {
  analysisSectionId: 'AS1',
  startElementIndex: 0,
  profileId: 'normal-metallic',
  boundaryAuthority: 'CALLER_SUPPLIED',
  boundarySourceReference: 'node-100',
  sourceAuthority: 'TEST',
  sourceReference: 'section-row-1',
};
const validSection = createPipelineAnalysisSection(validSectionInput);
assert.equal(validSection.schema, 'PipelineAnalysisSection.v1');
assert.equal(validSection.analysisSectionId, 'AS1');
assert.equal(validSection.startElementIndex, 0);
assert.equal(validSection.profileId, 'normal-metallic');
assert.equal(validSection.status, 'CONTRACT_ONLY');
assert.deepEqual(validSection.blockerCodes, []);
assert.equal(isPipelineAnalysisSection(validSection), true);

const propertyStyle = createPipelineAnalysisSection({ ...validSectionInput, analysisSectionId: 'S1' });
assert.equal(propertyStyle.analysisSectionId, 'S1');
assert.equal(propertyStyle.status, 'BLOCKED');
assert.deepEqual(propertyStyle.blockerCodes, ['PIPELINE_ANALYSIS_SECTION_ID_INVALID']);
assert.equal(propertyStyle.analysisSectionId.startsWith('AS'), false);

const negative = createPipelineAnalysisSection({ ...validSectionInput, startElementIndex: -1 });
assert.equal(negative.startElementIndex, -1);
assert.deepEqual(negative.blockerCodes, ['PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID']);

const fractional = createPipelineAnalysisSection({ ...validSectionInput, startElementIndex: 1.5 });
assert.equal(fractional.startElementIndex, null);
assert.deepEqual(fractional.blockerCodes, ['PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID']);

const numericString = createPipelineAnalysisSection({ ...validSectionInput, startElementIndex: '1' });
assert.equal(numericString.startElementIndex, null);
assert.deepEqual(numericString.blockerCodes, ['PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID']);

const blankProfile = createPipelineAnalysisSection({ ...validSectionInput, profileId: ' ' });
assert.deepEqual(blankProfile.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const unknownProfile = createPipelineAnalysisSection({ ...validSectionInput, profileId: 'unknown-profile' });
assert.equal(unknownProfile.status, 'BLOCKED');
assert.deepEqual(unknownProfile.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const caseAlteredProfile = createPipelineAnalysisSection({ ...validSectionInput, profileId: 'GRE' });
assert.equal(caseAlteredProfile.status, 'BLOCKED');
assert.deepEqual(caseAlteredProfile.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const duplicatePlan = createPipelineAnalysisSectionPlan({
  sections: [validSectionInput, { ...validSectionInput, startElementIndex: 3 }],
});
assert.equal(duplicatePlan.ready, false);
assert.deepEqual(duplicatePlan.blockerCodes, ['PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID']);
assert.equal(duplicatePlan.diagnostics[0].details.analysisSectionId, 'AS1');

const validResolutionInput = {
  elementIndex: 0,
  elementId: 'E1',
  analysisSectionId: 'AS1',
  profileId: 'normal-metallic',
  resolvedMode: 'NORMAL',
  sectionDisposition: 'SECTION_START',
  boundaryNode: 100,
  sourceAuthority: 'TEST',
  sourceReference: 'element-row-1',
};
const validResolution = createPipelineElementSectionResolution(validResolutionInput);
assert.equal(validResolution.schema, 'PipelineElementSectionResolution.v1');
assert.equal(validResolution.elementId, 'E1');
assert.equal(validResolution.analysisSectionId, 'AS1');
assert.equal(validResolution.profileId, 'normal-metallic');
assert.equal(validResolution.resolvedMode, 'NORMAL');
assert.equal(validResolution.ready, true);
assert.equal(isPipelineElementSectionResolution(validResolution), true);

const independentIdentities = createPipelineElementSectionResolution({
  ...validResolutionInput,
  elementIndex: 2,
  elementId: 'E3',
  analysisSectionId: 'AS2',
  profileId: 'gre',
  resolvedMode: 'GRE',
  sectionDisposition: 'INHERITED',
});
assert.equal(independentIdentities.elementId, 'E3');
assert.equal(independentIdentities.analysisSectionId, 'AS2');
assert.notEqual(independentIdentities.elementId, independentIdentities.analysisSectionId);

const unknownResolutionProfile = createPipelineElementSectionResolution({
  ...validResolutionInput, profileId: 'unknown-profile',
});
assert.equal(unknownResolutionProfile.ready, false);
assert.deepEqual(unknownResolutionProfile.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const caseAlteredResolutionProfile = createPipelineElementSectionResolution({
  ...validResolutionInput, profileId: 'Normal-Metallic',
});
assert.equal(caseAlteredResolutionProfile.ready, false);
assert.deepEqual(caseAlteredResolutionProfile.blockerCodes, ['PIPELINE_PROFILE_ID_INVALID']);

const mismatchedMode = createPipelineElementSectionResolution({
  ...validResolutionInput, profileId: 'gre', resolvedMode: 'NORMAL',
});
assert.equal(mismatchedMode.ready, false);
assert.deepEqual(mismatchedMode.blockerCodes, ['PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID']);
assert.equal(mismatchedMode.diagnostics[0].details.expectedMode, 'GRE');
assert.equal(mismatchedMode.diagnostics[0].details.actualMode, 'NORMAL');

const missingIdentity = createPipelineElementSectionResolution({
  profileId: 'normal-metallic', resolvedMode: 'NORMAL', sectionDisposition: 'INHERITED',
});
assert.equal(missingIdentity.ready, false);
assert.deepEqual(missingIdentity.blockerCodes, [
  'PIPELINE_ANALYSIS_SECTION_ID_INVALID',
  'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID',
]);

const routeIgnoredInput = {
  sections: [validSectionInput],
  elementResolutions: [validResolutionInput],
  routeGeometry: [{ x: 'not-read', y: 'not-read', z: 'not-read' }],
};
const routeIgnored = createPipelineAnalysisSectionPlan(routeIgnoredInput);
const noRoute = createPipelineAnalysisSectionPlan({
  sections: [validSectionInput], elementResolutions: [validResolutionInput],
});
assert.equal(JSON.stringify(routeIgnored), JSON.stringify(noRoute));
assert.equal(routeIgnored.ready, true);
assert.equal(isPipelineAnalysisSectionPlan(routeIgnored), true);

const emptyPlan = createPipelineAnalysisSectionPlan();
assert.equal(emptyPlan.ready, true);
assert.deepEqual(emptyPlan.sections, []);
assert.deepEqual(emptyPlan.elementResolutions, []);

const callerInput = {
  sections: [{ ...validSectionInput, diagnostics: [], blockerCodes: [] }],
  elementResolutions: [{ ...validResolutionInput, diagnostics: [], blockerCodes: [] }],
  diagnostics: [],
};
const isolated = createPipelineAnalysisSectionPlan(callerInput);
callerInput.sections[0].analysisSectionId = 'AS99';
callerInput.elementResolutions[0].elementId = 'E99';
callerInput.sections.push(validSectionInput);
assert.equal(isolated.sections[0].analysisSectionId, 'AS1');
assert.equal(isolated.elementResolutions[0].elementId, 'E1');
assert.equal(isolated.sections.length, 1);

const orderedBlockers = createPipelineAnalysisSectionPlan({
  sections: [
    { analysisSectionId: 'S1', startElementIndex: -1, profileId: '' },
    { analysisSectionId: 'S1', startElementIndex: 1.5, profileId: '' },
  ],
});
assert.deepEqual(orderedBlockers.blockerCodes, [
  'PIPELINE_PROFILE_ID_INVALID',
  'PIPELINE_ANALYSIS_SECTION_ID_INVALID',
  'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID',
]);
assert.equal(JSON.stringify(orderedBlockers), JSON.stringify(createPipelineAnalysisSectionPlan({
  sections: [
    { analysisSectionId: 'S1', startElementIndex: -1, profileId: '' },
    { analysisSectionId: 'S1', startElementIndex: 1.5, profileId: '' },
  ],
})));

const unsafe = createPipelineAnalysisSection({ ...validSectionInput, diagnostics: [new Date(0)] });
assert.equal(unsafe.status, 'BLOCKED');
assert.ok(unsafe.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID'));
assert.doesNotThrow(() => JSON.parse(JSON.stringify(unsafe)));

assertDeepFrozen(validSection);
assertDeepFrozen(validResolution);
assertDeepFrozen(routeIgnored);
assertDeepFrozen(isolated);
assert.equal(Object.isFrozen(routeIgnored.sections), true);
assert.equal(Object.isFrozen(routeIgnored.elementResolutions), true);

console.log('Pipeline analysis-section contract tests passed.');
