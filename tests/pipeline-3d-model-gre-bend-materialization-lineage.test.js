import assert from 'node:assert/strict';
import { buildPipelineGreBendElementLineage } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-lineage.js';
import { resolvePipelineGreBendMaterializationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-materialization.js';
import { createPipelineGreMaterializationFixture } from './pipeline-3d-model-gre-bend-materialization-fixtures.js';

const sourceRows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 1000, y: 1000, z: 0 },
];
const materializedElements = [
  { materializedElementId: 'incoming', sourceElementIndexes: [0], candidateId: 'bend:110',
    lineageDisposition: 'SPLIT_BY_INCOMING_BREAK', orderIndex: 0 },
  { materializedElementId: 'bend', sourceElementIndexes: [0, 1], candidateId: 'bend:110',
    lineageDisposition: 'REPLACED_BY_GRE_BEND', orderIndex: 1 },
  { materializedElementId: 'outgoing', sourceElementIndexes: [1], candidateId: 'bend:110',
    lineageDisposition: 'SPLIT_BY_OUTGOING_BREAK', orderIndex: 2 },
];
const lineage = buildPipelineGreBendElementLineage({ sourceRows, materializedElements });
assert.deepEqual(lineage.diagnostics, []);
assert.ok(lineage.elementLineage[0].successorElementIds.includes('bend'));
assert.ok(lineage.elementLineage[1].successorElementIds.includes('bend'));
assert.equal(lineage.coveredSourceElementCount, 2);
assert.equal(lineage.coveredSuccessorElementCount, 3);

const touching = createPipelineGreMaterializationFixture({ twoBends: true, breakLengthMm: 500 });
const touchingPlan = resolvePipelineGreBendMaterializationPlan(touching.input);
assert.equal(touchingPlan.ready, true, touchingPlan.blockerCodes.join(', '));
const contact = touchingPlan.materializedModel.elements.find((item) =>
  item.lineageDisposition === 'COINCIDENT_ENVELOPE_CONTACT');
assert.ok(contact);
assert.equal(contact.lengthMm, 0);
assert.equal(touchingPlan.coverage.appliedCandidateCount, 2);
assert.equal(touchingPlan.coverage.coveredSourceElementCount, 3);

console.log('pipeline-3d-model GRE bend materialization lineage: PASS');
