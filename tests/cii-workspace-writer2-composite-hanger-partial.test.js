import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerPartialDelete, _test as partialWriterTest } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import {
  applyCiiWriter2CompositeWithHangerDeleteAll,
  _test as compositeTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger.js';
import { validateCiiWriter2CompositeWithPartialHangerRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-composite-hanger-partial-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const PARTIAL_FAMILY = 'WRITER_2_HANGER_PARTIAL_DELETE';
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function packed(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function stringCard(value) {
  const text = String(value || '');
  return `${' '.repeat(7)}${String(text.length).padStart(5, ' ')} ${text}`;
}
function documentFromByteString(byteString, parsed) {
  const bytes = new Uint8Array(byteString.length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  return Object.freeze({
    contentSha256: sha256CiiByteString(byteString), physicalFile, writer1CByteEligible: true,
    hangerEvidence: buildCiiHangerEvidence(physicalFile.text, parsed), parsed,
  });
}
function target() {
  const nodes = [200, 210, 220];
  const parsed = Object.freeze({
    elements: Object.freeze([
      Object.freeze({ index: 0, from: 1000, to: 1010 }),
      Object.freeze({ index: 1, from: 1020, to: 1030 }),
      Object.freeze({ index: 2, from: 1040, to: 1050 }),
    ]),
    nodes: Object.freeze(Object.fromEntries([...nodes, 1000, 1010, 1020, 1030, 1040, 1050]
      .map((node) => [String(node), Object.freeze({})]))),
  });
  const control = [
    numericRow([3, 0, 3, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0]),
  ];
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packed([1, 0, 1, 1, 1])];
  const tail = nodes.flatMap((node, zero) => [
    numericRow([101 + zero, 25, 0, 0, 0, 0]), numericRow([0, 9999, zero + 1, 0, 0]),
    stringCard(`H${node}`), stringCard(''),
  ]);
  const free = nodes.map((node, zero) => packed([node, 0, zero + 1, 0]));
  const body = [
    '#$ CONTROL', ...control,
    '#$ MISCEL_1', numericRow([106, 106, 106]), ...defaults, packed(nodes), ...tail, ...free,
    packed([10, 11, 12]), packed([20, 21, 22]), packed([30, 31, 32]), packed([40, 41, 42]),
    numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3]),
    '#$ UNITS', 'UNITS-CUSTODY',
  ].join('\r\n') + '\r\n';
  const document = documentFromByteString(body, parsed);
  assert.equal(document.hangerEvidence.status, 'QUALIFIED');
  assert.equal(document.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  return document;
}
function hangerOperation() {
  return Object.freeze({
    operationId: 'HANGER-210', family: 'HANGER', property: 'Hanger presence', action: 'DELETE',
    status: 'PREVIEW_READY', blockers: Object.freeze([]), evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: 'SRC-210', value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: '210', value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function basePlan(before) {
  const sourceDocument = Object.freeze({ contentSha256: 'source-sha' });
  const targetDocument = Object.freeze({ contentSha256: before.contentSha256 });
  const contracted = applyCiiWriter2HangerDeletePlanContract(Object.freeze({
    status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']), sourceDocument, targetDocument,
    operations: Object.freeze([hangerOperation()]), policy: Object.freeze({ hangerMutation: 'BLOCKED' }),
  }));
  const operations = Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' })));
  return Object.freeze({
    ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), sourceDocument, targetDocument, operations,
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: 'parent-h3-delete2',
      sourceSha256: sourceDocument.contentSha256, targetSha256: targetDocument.contentSha256,
      candidateOperationIds: Object.freeze(['HANGER-210']), appliedOperationIds: Object.freeze(['HANGER-210']), excludedOperationIds: Object.freeze([]),
    }),
  });
}
function siblingPlan(before) {
  const parent = basePlan(before);
  const node = Object.freeze({
    operationId: 'NODE-999', family: 'NODE_NAME', property: 'Node name / to-name', action: 'DELETE', scopeDecision: 'APPLY',
  });
  const sif = Object.freeze({
    operationId: 'SIF-888', family: 'SIF_TEE', property: 'SIF/Tee record presence', action: 'DELETE', scopeDecision: 'EXCLUDE',
  });
  return Object.freeze({
    ...parent,
    operations: Object.freeze([...parent.operations, node]), excludedOperations: Object.freeze([sif]),
    transferScope: Object.freeze({
      ...parent.transferScope,
      candidateOperationIds: Object.freeze(['HANGER-210', 'NODE-999', 'SIF-888']),
      appliedOperationIds: Object.freeze(['HANGER-210', 'NODE-999']), excludedOperationIds: Object.freeze(['SIF-888']),
    }),
  });
}

const before = target();
const parent = basePlan(before);
const composite = applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: before, targetGraph: null, transferPlan: parent });
assert.equal(composite.status, 'APPLIED');
assert.equal(composite.components.hangerDeleteAll, null);
assert.ok(composite.components.hangerPartialDelete);
assert.equal(composite.familyMutationCounts.hangerDeleteOperations, 1);
assert.equal(composite.familyMutationCounts.hangerDeleteAllOperations, 0);
assert.equal(composite.familyMutationCounts.hangerPartialDeleteOperations, 1);
assert.equal(composite.familyMutationCounts.hangerPartialDeleteClaims, 2);
assert.equal(composite.mutations.every((claim) => claim.authorityFamily === PARTIAL_FAMILY), true);
const after = documentFromByteString(composite.byteString, before.parsed);
assert.equal(after.hangerEvidence.count, 2);
assert.deepEqual(after.hangerEvidence.nodes, ['200', '220']);
assert.equal(validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, null, parent, composite).status, 'PASS');

const parentCustody = compositeTest.assertBoundScopeCustody(parent, before);
const child = compositeTest.projectCanonicalFamilySubscope(parent, compositeTest.isHangerDelete, PARTIAL_FAMILY, parentCustody);
const direct = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: child });
assert.equal(composite.byteString, direct.byteString, 'partial-only composite must equal qualified component result');
assert.deepEqual(partialWriterTest.assertBoundScopeCustody(child, before), direct.scopeCustody);

// Sibling APPLY rows and inherited EXCLUDE rows become a canonical child EXCLUDE set without weakening parent custody.
const withSiblings = siblingPlan(before);
const siblingCustody = compositeTest.assertBoundScopeCustody(withSiblings, before);
const siblingChild = compositeTest.projectCanonicalFamilySubscope(withSiblings, compositeTest.isHangerDelete, PARTIAL_FAMILY, siblingCustody);
assert.deepEqual(siblingChild.transferScope.appliedOperationIds, ['HANGER-210']);
assert.deepEqual(siblingChild.transferScope.excludedOperationIds, ['NODE-999', 'SIF-888']);
assert.deepEqual(siblingChild.transferScope.candidateOperationIds, ['HANGER-210', 'NODE-999', 'SIF-888']);
assert.equal(siblingChild.transferScope.scopeId, `parent-h3-delete2::${PARTIAL_FAMILY}`);
assert.equal(siblingChild.familyProjection.parentScopeId, 'parent-h3-delete2');
assert.equal(siblingChild.familyProjection.projectedScopeId, siblingChild.transferScope.scopeId);
assert.deepEqual(siblingChild.familyProjection.parentAppliedOperationIds, ['HANGER-210', 'NODE-999']);
assert.deepEqual(siblingChild.familyProjection.projectedAppliedOperationIds, ['HANGER-210']);
assert.deepEqual(siblingChild.familyProjection.siblingAppliedOperationIds, ['NODE-999']);
assert.deepEqual(partialWriterTest.assertBoundScopeCustody(siblingChild, before).appliedOperationIds, ['HANGER-210']);
const siblingDirect = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: siblingChild });
assert.equal(siblingDirect.byteString, direct.byteString);

// Canonical child projection refuses malformed non-KEEP rows hiding in the parent operations container.
const malformed = Object.freeze({
  ...parent,
  operations: Object.freeze([...parent.operations, Object.freeze({ operationId: 'BAD-KEEP', action: 'KEEP', scopeDecision: 'EXCLUDE' })]),
});
assert.throws(
  () => compositeTest.projectCanonicalFamilySubscope(malformed, compositeTest.isHangerDelete, PARTIAL_FAMILY, parentCustody),
  /PROJECTED_OPERATION_CONTAINER_INVALID:BAD-KEEP/,
);

// Composite arbitration remains original-coordinate and fails closed on any partial-HANGER overlap.
assert.throws(
  () => compositeTest.arbitrateClaims([
    { authorityFamily: PARTIAL_FAMILY, claim: { kind: 'A', byteStart: 10, byteEnd: 20, beforeField: before.physicalFile.originalByteString.slice(10, 20), afterField: 'A' } },
    { authorityFamily: 'WRITER_2_NODENAME', claim: { kind: 'B', byteStart: 19, byteEnd: 21, beforeField: before.physicalFile.originalByteString.slice(19, 21), afterField: 'B' } },
  ], before.physicalFile.originalByteString),
  /ORIGINAL_SPAN_OVERLAP/,
);

// Exact final bytes remain the composite validator authority; correct Writer testimony cannot excuse unrelated postimage drift.
const tampered = documentFromByteString(composite.byteString.replace('UNITS-CUSTODY', 'XNITS-CUSTODY'), before.parsed);
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, tampered, null, parent, composite),
  /EXACT_PARTIAL_HANGER_COMPOSITE_POSTIMAGE_MISMATCH/,
);

// Partial component plan testimony remains secondary and is independently falsified.
const forged = Object.freeze({
  ...composite,
  components: Object.freeze({
    ...composite.components,
    hangerPartialDelete: Object.freeze({
      ...composite.components.hangerPartialDelete,
      deletePlan: Object.freeze({ ...composite.components.hangerPartialDelete.deletePlan, retainedRecordIndices: Object.freeze([1, 2]) }),
    }),
  }),
});
assert.throws(
  () => validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, null, parent, forged),
  /HANGER_PARTIAL_COMPONENT_PLAN_TESTIMONY_MISMATCH/,
);

console.log('Writer2 one-TARGET0 composite partial-HANGER writer + independent complete-postimage qualification authored.');
