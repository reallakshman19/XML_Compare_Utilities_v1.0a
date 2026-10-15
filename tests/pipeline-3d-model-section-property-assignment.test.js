import assert from 'node:assert/strict';
import {
  PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA,
  buildPipelineSectionPropertyAssignmentPlan,
  pipelineSectionPropertyAssignmentId,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-section-property-assignment.js';

const canonical = Object.freeze({
  schema: 'PipelineAnalysisSectionPlan.v1', ready: true,
  sections: Object.freeze([
    Object.freeze({ analysisSectionId: 'AS1', startElementIndex: 0 }),
    Object.freeze({ analysisSectionId: 'AS2', startElementIndex: 2 }),
  ]),
  elementResolutions: Object.freeze([]),
});
const sourceKind = 'BRANCH_INPUT_BLOCK';
const sourceReference = 'engineering-configuration:branch';
const identity = {
  analysisSectionIds: ['AS2'], fieldIds: ['wallThickness'], sourceKind, sourceReference,
  sourceValues: { wallThickness: 0 }, assignedValues: { wallThickness: 0 },
};
const assignment = Object.freeze({ ...identity,
  transactionId: pipelineSectionPropertyAssignmentId(identity), userConfirmed: true });
function build(overrides = {}) {
  return buildPipelineSectionPropertyAssignmentPlan({ canonicalAnalysisSectionPlan: canonical,
    branchInfo: { wallThickness: 0 }, sourceKind, sourceReference,
    assignments: [assignment], ...overrides });
}

const plan = build();
assert.equal(plan.schema, PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA);
assert.equal(plan.ready, true);
const later = plan.propertyResolutions.find((item) => item.analysisSectionId === 'AS2');
assert.equal(later.value, 0);
assert.equal(later.sourceKind, 'AUTHENTICATED_ASSIGNMENT');
assert.equal(later.transactionId, assignment.transactionId);
assert.equal(Object.hasOwn(plan.sourceValues, 'wallThickness'), true);

const missing = build({ assignments: [] });
assert.equal(missing.ready, false);
assert.ok(missing.blockerCodes.includes('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED'));
const stale = build({ branchInfo: { wallThickness: 6 } });
assert.equal(stale.ready, false);
assert.ok(stale.blockerCodes.includes('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SOURCE_STALE'));
const forged = build({ assignments: [{ ...assignment, transactionId: 'PSPA-forged' }] });
assert.equal(forged.ready, false);
assert.ok(forged.blockerCodes.includes('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_IDENTITY_INVALID'));
const duplicate = build({ assignments: [assignment, assignment] });
assert.equal(duplicate.ready, false);
assert.ok(duplicate.blockerCodes.includes('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_DUPLICATE'));
const blank = buildPipelineSectionPropertyAssignmentPlan({ canonicalAnalysisSectionPlan: canonical,
  branchInfo: { wallThickness: '' }, sourceKind, sourceReference, assignments: [assignment] });
assert.equal(blank.ready, false);
assert.equal(Object.hasOwn(blank.sourceValues, 'wallThickness'), false);

console.log('pipeline-3d-model section property assignment: PASS');
