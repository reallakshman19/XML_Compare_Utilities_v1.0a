import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-explicit-inputxml.js', import.meta.url), 'utf8');
assert.match(source, /PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA/);
assert.match(source, /PIPELINE_SECTION_PROFILE_ROUTING_PLAN_SCHEMA/);
assert.match(source, /same\(input\.sectionPropertyAssignmentPlan, input\.profileAuthorityPlans\?\.sectionPropertyAssignmentPlan\)/);
assert.match(source, /same\(input\.sectionProfileRoutingPlan, input\.profileAuthorityPlans\?\.sectionProfileRoutingPlan\)/);
assert.match(source, /PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED/);
assert.match(source, /PIPELINE_SECTION_PROFILE_ROUTING_COVERAGE_INVALID/);
console.log('pipeline-3d-model P3D-HARD-051 InputXML static: PASS');
