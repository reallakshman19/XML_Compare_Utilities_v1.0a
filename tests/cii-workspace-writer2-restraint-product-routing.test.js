import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  applyCiiWorkspaceTargetWriter2,
} from '../tabs/cii-workspace/cii-workspace-core.js';
import {
  applyCiiWriter2CompositePlanContract,
  ciiWriter2CompositeReadiness,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { applyCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2ProductRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-product-validation.js';
import { CII_WRITER_2_RESTRAINT_CREATE_BLOCKER } from '../tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js';
import {
  afterDocumentFromByteString,
  buildFixture,
  nodeCreate,
  restraintDelete,
  targetGraph,
  transferPlan,
} from './cii-workspace-writer2-composite-restraint-fixture.js';

function bytes(value) {
  const input = String(value ?? '');
  const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) out[index] = input.charCodeAt(index) & 0xff;
  return out;
}
function preview(targetDocument, transferPlanValue) {
  return Object.freeze({
    writerVersion: '2',
    targetDocument: Object.freeze({ ...targetDocument, fileName: 'W213_SYNTHETIC.CII' }),
    transferPlan: transferPlanValue,
    correspondence: Object.freeze({ status: 'READY', authority: 'W213_SYNTHETIC_PRODUCT_QUALIFICATION' }),
  });
}

const fixture = buildFixture();
const graph = targetGraph();
const deleteOperation = restraintDelete(2, 30, fixture.restraintSpecs[2], { id: 'W213-RESTRAINT-DELETE-P2' });
const rawPlan = transferPlan(fixture.targetDocument, [deleteOperation]);
const routedPlan = applyCiiWriter2CompositePlanContract(rawPlan);

assert.equal(routedPlan.status, 'PREVIEW_READY', routedPlan.blockers.join('|'));
assert.equal(routedPlan.summary.writer2CompositeMutationCount, 1);
assert.equal(routedPlan.summary.restraintDeleteMutationCount, 1);
assert.equal(routedPlan.policy.restraintCardinality, 'QUALIFIED_DELETE_COMPACTION_ONLY');

const readiness = ciiWriter2CompositeReadiness(routedPlan, fixture.targetDocument, graph);
assert.equal(readiness.ready, true, readiness.blockers.join('|'));
assert.equal(readiness.familyMutationCounts.restraintDelete, 1);
assert.equal(readiness.restraintTransactionClass, 'BLOCK_DELETE_COMPACTION');
assert.equal(readiness.components.restraintDelete?.ready, true);
assert.deepEqual(readiness.components.restraintDelete?.deletedPointers, [2]);
assert.equal(readiness.createAuthority.restraintBlocker, CII_WRITER_2_RESTRAINT_CREATE_BLOCKER);

const direct = applyCiiWriter2CompositeWithRestraintDelete({
  targetDocument: fixture.targetDocument, targetGraph: graph, transferPlan: routedPlan,
});
assert.equal(direct.schema, 'CIIWorkspaceWriter2CompositeRestraintResult.v1');
assert.equal(direct.familyMutationCounts.restraintDeleteOperations, 1);

const after = afterDocumentFromByteString(direct.byteString);
const productValidation = validateCiiWriter2ProductRoundTrip(
  fixture.targetDocument, after, graph, routedPlan, direct,
);
assert.equal(productValidation.status, 'PASS');
assert.equal(productValidation.productValidatorClass, 'RESTRAINT_DELETE_COMPOSITE');
assert.equal(productValidation.unexpectedSemanticDeltaCount, 0);

const originalBytes = bytes(fixture.targetDocument.physicalFile.originalByteString);
const publicResult = await applyCiiWorkspaceTargetWriter2(
  preview(fixture.targetDocument, routedPlan), originalBytes, { cryptoRef: webcrypto },
);
assert.equal(publicResult.status, 'PASS');
assert.equal(publicResult.writer, 'WRITER_2');
assert.equal(publicResult.byteString, direct.byteString);
assert.equal(publicResult.validation.status, 'PASS');
assert.equal(publicResult.validation.productValidatorClass, 'RESTRAINT_DELETE_COMPOSITE');

const create = restraintDelete(2, 30, fixture.restraintSpecs[2], {
  id: 'W213-RESTRAINT-CREATE-P2', action: 'CREATE',
});
const createPlan = applyCiiWriter2CompositePlanContract(transferPlan(fixture.targetDocument, [create]));
assert.equal(createPlan.status, 'BLOCKED');
assert(createPlan.blockers.includes(CII_WRITER_2_RESTRAINT_CREATE_BLOCKER));
assert.equal(createPlan.operations[0].status, 'BLOCKED');

const forgedPolicy = Object.freeze({ ...deleteOperation, operationId: 'W213-UNQUALIFIED-DELETE', policyAuthority: 'FORGED' });
const forgedPlan = applyCiiWriter2CompositePlanContract(transferPlan(fixture.targetDocument, [forgedPolicy]));
assert.equal(forgedPlan.status, 'BLOCKED');
assert(forgedPlan.blockers.includes('NO_WRITER_2_COMPOSITE_TRANSFERABLE_OPERATIONS'));

const missingComponent = Object.freeze({
  ...direct,
  components: Object.freeze({ ...direct.components, restraintDelete: null }),
});
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(fixture.targetDocument, after, graph, routedPlan, missingComponent),
  /RESTRAINT_COMPONENT_TESTIMONY_MISMATCH/,
);

const forgedSchema = Object.freeze({ ...direct, schema: 'CIIWorkspaceWriter2CompositeHangerResult.v1' });
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(fixture.targetDocument, after, graph, routedPlan, forgedSchema),
  /RESTRAINT_RESULT_SCHEMA_MISMATCH/,
);

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(
    preview(fixture.targetDocument, routedPlan), bytes(direct.byteString), { cryptoRef: webcrypto },
  ),
  /CII_WRITER_2_STALE_TARGET_HASH/,
);

const nodePlan = applyCiiWriter2CompositePlanContract(
  transferPlan(fixture.targetDocument, [nodeCreate()]),
);
const nodeReadiness = ciiWriter2CompositeReadiness(nodePlan, fixture.targetDocument, graph);
assert.equal(nodeReadiness.ready, true, nodeReadiness.blockers.join('|'));
assert.equal(nodeReadiness.familyMutationCounts.restraintDelete, 0);
const noRestraintProduct = await applyCiiWorkspaceTargetWriter2(
  preview(fixture.targetDocument, nodePlan), originalBytes, { cryptoRef: webcrypto },
);
assert.equal(noRestraintProduct.status, 'PASS');
assert.equal(noRestraintProduct.validation.productValidatorClass, 'NO_HANGER');

console.log('Writer2 W2.13 synthetic RESTRAINT product routing qualification passed.');
