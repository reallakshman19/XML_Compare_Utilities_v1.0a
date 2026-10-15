import assert from 'assert';
import { createCiiTransferPreview } from '../tabs/cii-workspace/cii-workspace-transfer-plan.js';
import { createCiiWorkspaceReviewLedger } from '../tabs/cii-workspace/cii-workspace-review.js';

const sourceDocument = { fileName: 'source.cii', contentSha256: 'source-sha' };
const targetDocument = { fileName: 'target.cii', contentSha256: 'target-sha' };
const sourceGraph = { nodes: [], edges: [] };
const targetGraph = { nodes: [], edges: [] };
const node130 = { correspondenceId: 'node:130:20130', kind: 'NODE', sourceNodeId: '130', targetNodeId: '20130', status: 'HIGH', authority: 'PROPAGATED' };
const node205 = { correspondenceId: 'node:205:20205', kind: 'NODE', sourceNodeId: '205', targetNodeId: '20205', status: 'REVIEW', authority: 'M2_NETWORK' };
const sif = { correspondenceId: 'element:70-250', kind: 'ELEMENT', sourceElementId: 'S70-250', targetElementIds: ['T20070-20250'], status: 'HIGH', authority: 'PROPAGATED' };
const rigid = { correspondenceId: 'component:113-116', kind: 'COMPONENT', componentKind: 'RIGID', sourceComponentId: 'SR9', targetComponentId: 'TR11', status: 'HIGH', authority: 'POINTER_BOUND_RIGID_COMPONENT_CONTEXT' };
const pipe = { correspondenceId: 'element:250-255', kind: 'ELEMENT', sourceElementId: 'S250-255', targetElementIds: ['T20250-20255'], status: 'REVIEW', authority: 'M2_NETWORK' };
const correspondence = { status: 'READY', correspondenceIdentity: 'corr-transfer-policy', nodeRows: [node130, node205], elementRows: [sif, pipe], componentRows: [rigid] };
const review = createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, [], correspondence, {
  reviewedCorrespondenceIds: [node130.correspondenceId, node205.correspondenceId, sif.correspondenceId, rigid.correspondenceId, pipe.correspondenceId],
});
function delta(row, category, property, sourceValue, targetValue, config = {}) {
  return { deltaId: `delta:${row.correspondenceId}:${property}`, correspondenceId: row.correspondenceId, identityKind: row.kind,
    sourceIdentity: config.sourceIdentity || row.sourceNodeId || row.sourceComponentId || row.sourceElementId,
    targetIdentity: config.targetIdentity || row.targetNodeId || row.targetComponentId || row.targetElementIds?.[0],
    category, property, sourceValue, targetValue, changed: config.changed ?? JSON.stringify(sourceValue) !== JSON.stringify(targetValue),
    semanticChange: config.semanticChange || 'CHANGED', evidenceStatus: config.evidenceStatus || 'QUALIFIED', authority: config.authority || null };
}
const restraintPairing = {
  schema: 'CIIWorkspaceRestraintPairing.v1', status: 'QUALIFIED', authority: 'SINGLETON_EQUAL_CARDINALITY', sourceCount: 1, targetCount: 1,
  blockers: [], assignmentScore: 1, runnerUpScore: null, winnerGap: null, pairs: [{
    source: { pointer: 5, slot: 1, node: '130' }, target: { pointer: 5, slot: 1, node: '20130' },
    before: { pointer: 5, slot: 1, node: '20130', typeCode: 9, stiffness: 1e12, gap: 0, friction: 0.3, connectingNode: 0, directionCosines: { x: 1, y: 0, z: 0 } },
    proposed: { pointer: 5, slot: 1, node: '20130', typeCode: 15, stiffness: 1e12, gap: 0, friction: 0, connectingNode: 0, directionCosines: { x: 1, y: 0, z: 0 } },
    evidence: { strong: false }, changed: true,
  }],
};
const engineeringDeltas = {
  schema: 'CIIWorkspaceEngineeringDeltaSet.v1', rows: [
    delta(node130, 'RESTRAINT', 'Restraint code set', [15], [9], { evidenceStatus: 'PARTIAL', authority: 'PROTECTED_WRITER_RESTRANT_LINE1_LINE2' }),
    delta(node130, 'RESTRAINT', 'Restraint friction values', [0], [0.3], { authority: 'PROTECTED_WRITER_RESTRANT_LINE1_LINE2' }),
    delta(node130, 'RESTRAINT', 'Qualified restraint record pairing', restraintPairing, null, { authority: 'PROTECTED_WRITER_RESTRANT_POINTER_SLOT_PAIRING:SINGLETON_EQUAL_CARDINALITY' }),
    delta(node205, 'HANGER', 'Hanger presence', true, false, { authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE', semanticChange: 'REMOVED_IN_TARGET' }),
    delta(node205, 'HANGER', 'Hanger record count at node', 1, 0, { authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    delta(sif, 'SIF_TEE', 'SIF/Tee raw code (field 2)', 3, 5, { evidenceStatus: 'PARTIAL', authority: 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD' }),
    delta(rigid, 'WEIGHT_RIGID', 'Rigid weight', 111.2, 111.2, { changed: false, semanticChange: 'UNCHANGED', authority: 'ELEMENT_RIGID_POINTER_TO_RIGID_RECORD' }),
    delta(pipe, 'PIPE_SIZE', 'OD', 60.3, 114.3, { authority: 'PARSED_ELEMENT_PIPE_PROPERTY' }),
    delta(pipe, 'WALL', 'Wall thickness', 3.9, 4.7752, { authority: 'PROTECTED_WRITER_ELEMENT_ROW2_WT_FIXED_FIELD' }),
    delta(pipe, 'GEOMETRY', 'Element length', 659.301, 459.301, { authority: 'PARSED_ELEMENT_GEOMETRY' }),
    delta(pipe, 'PROCESS', 'P1', 10, 15, { authority: 'PROTECTED_WRITER_ELEMENT_ROW4_P1_FIXED_FIELD' }),
    delta(pipe, 'PROCESS', 'T1', 200, 250, { authority: 'PROTECTED_WRITER_ELEMENT_ROW2_T1_FIXED_FIELD' }),
    delta(pipe, 'PROCESS', 'T2', 300, 350, { authority: 'PROTECTED_WRITER_ELEMENT_ROW2_T2_FIXED_FIELD' }),
  ],
};
const plan = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, review, engineeringDeltas);
assert.strictEqual(plan.inputAuthority, 'ENGINEERING_DELTA_SET');
assert.strictEqual(plan.mutationAuthority, 'WRITER_1B_CONDITIONAL');
assert.strictEqual(plan.policy.geometryProtected, true);
assert.strictEqual(plan.policy.odProtected, 'CONDITIONAL_WRITER_1B_PLAIN_PIPE_NO_REDUCER');
assert.strictEqual(plan.policy.wallProtected, false);
assert.strictEqual(plan.status, 'PREVIEW_READY', 'blocked individual families do not prevent inspection when qualified operations exist');
const find = (property) => plan.operations.find((item) => item.property === property);
for (const property of ['Restraint code set', 'Restraint friction values']) {
  assert.strictEqual(find(property).action, 'KEEP'); assert.strictEqual(find(property).status, 'PROTECTED');
  assert.strictEqual(find(property).policyAuthority, 'CII_RESTRAINT_AGGREGATE_EVIDENCE_ONLY');
}
assert.strictEqual(find('Qualified restraint record pairing').action, 'COPY');
assert.strictEqual(find('Qualified restraint record pairing').status, 'PREVIEW_READY');
assert.strictEqual(find('Qualified restraint record pairing').policyAuthority, 'CII_WRITER_1A_CARDINALITY_PRESERVING_RESTRAINT_SLOT');
assert.strictEqual(find('Qualified restraint record pairing').proposed.status, 'QUALIFIED');
assert.strictEqual(find('Hanger presence').action, 'CREATE'); assert.strictEqual(find('Hanger presence').status, 'BLOCKED');
assert(find('Hanger presence').blockers.includes('HANGER_CREATE_PAYLOAD_NOT_QUALIFIED'));
assert.strictEqual(find('Hanger record count at node').action, 'BLOCKED'); assert(find('Hanger record count at node').blockers.includes('HANGER_RECORD_COUNT_IS_EVIDENCE_ONLY'));
assert.strictEqual(find('SIF/Tee raw code (field 2)').action, 'COPY'); assert.strictEqual(find('SIF/Tee raw code (field 2)').status, 'BLOCKED');
assert(find('SIF/Tee raw code (field 2)').blockers.includes('SIF_TEE_FIELD_SEMANTICS_UNQUALIFIED'));
assert.strictEqual(find('Rigid weight').action, 'KEEP'); assert.strictEqual(find('Rigid weight').status, 'PREVIEW_READY');
assert.strictEqual(find('OD').action, 'KEEP'); assert.strictEqual(find('OD').status, 'PROTECTED');
assert(find('OD').blockers.includes('OD_WRITER_1B_PLAIN_PIPE_NO_REDUCER_AUTHORITY_REQUIRED'));
assert.strictEqual(find('Element length').action, 'KEEP'); assert.strictEqual(find('Element length').status, 'PROTECTED');
assert(find('Element length').blockers.includes('TARGET_PROPERTY_PROTECTED_BY_DEFAULT'));
assert.strictEqual(find('Wall thickness').action, 'COPY'); assert.strictEqual(find('Wall thickness').status, 'PREVIEW_READY');
for (const property of ['P1', 'T1', 'T2']) {
  assert.strictEqual(find(property).action, 'COPY'); assert.strictEqual(find(property).status, 'PREVIEW_READY');
  assert.strictEqual(find(property).policyAuthority, 'CII_WRITER_1A_CARDINALITY_PRESERVING_ELEMENT_FIELD');
}
assert(plan.summary.byAction.COPY >= 6); assert(plan.summary.byAction.CREATE >= 1); assert(plan.summary.byAction.KEEP >= 5);
assert(plan.summary.byAction.BLOCKED >= 1); assert(plan.summary.protectedCount >= 4); assert(plan.summary.previewReadyCount >= 6);
const rejectedReview = createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, [], correspondence, {
  reviewedCorrespondenceIds: [node130.correspondenceId], rejectedCorrespondenceIds: [node205.correspondenceId],
});
const rejected = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, rejectedReview, engineeringDeltas);
assert(!rejected.operations.some((item) => item.matchAuthority.correspondenceId === node205.correspondenceId));
const stale = createCiiTransferPreview(sourceDocument, { ...targetDocument, contentSha256: 'target-changed' }, sourceGraph, targetGraph, correspondence, review, engineeringDeltas);
assert.strictEqual(stale.status, 'BLOCKED'); assert.strictEqual(stale.operations.length, 0); assert(stale.blockers.includes('STALE_REVIEW_TARGET_IDENTITY'));
console.log('CII Writer 1B transfer-preview policy checks passed.');
