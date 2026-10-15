import { stableStringify } from './cii-workspace-contracts.js';
import { createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';
import { buildCiiWriter2SifDeleteRelocationPlan, CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';
import { buildCiiWriter2HangerDeletePlan, CII_WRITER_2_HANGER_CREATE_BLOCKER } from './cii-workspace-writer2-hanger-delete.js';
import { buildCiiWriter2RestraintDeleteCompactionPlan, CII_WRITER_2_RESTRAINT_CREATE_BLOCKER } from './cii-workspace-writer2-restraint-delete-compaction-plan.js';
import { _test as legacyValidatorTest } from './cii-workspace-writer2-composite-hanger-validation.js';
import {
  CII_WRITER_2_RESTRAINT_COMPOSITE_AUTHORITY, CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY,
  DELETE_ALL_HANGER_FAMILY, POSTIMAGE_HASH_AUTHORITY, TARGET0_HASH_AUTHORITY,
  actualMutationTestimony, appliedOperations, bytesFromByteString, expectedMutationTestimony,
  hangerExpectedClaims, independentCanonicalSubscope, independentTarget0Custody,
  isHangerCreate, isHangerDelete, isNodeMutation, isRestraintCreate, isRestraintDelete,
  isSifCreate, isSifDelete, operationId, representationCustody, restraintExpectedClaims,
  sameBytes, sorted, exactIds, supportedApply, text,
} from './cii-workspace-writer2-composite-restraint-validation-support.js';

function rejectUnsupported(applied) {
  const families = [
    [applied.filter(isSifCreate), CII_WRITER_2_SIF_CREATE_BLOCKER],
    [applied.filter(isHangerCreate), CII_WRITER_2_HANGER_CREATE_BLOCKER],
    [applied.filter(isRestraintCreate), CII_WRITER_2_RESTRAINT_CREATE_BLOCKER],
  ];
  for (const [operations, blocker] of families) {
    if (operations.length) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_${blocker}:${operations.map(operationId).join(',')}`);
    }
  }
  const unsupported = applied.filter((operation) => !supportedApply(operation));
  if (unsupported.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_UNSUPPORTED_APPLY:${unsupported.map(operationId).join(',')}`);
  }
}

function buildPlans(before, targetGraph, transferPlan, parentCustody, applied) {
  const nodeOperations = applied.filter(isNodeMutation);
  const sifDeletes = applied.filter(isSifDelete);
  const hangerDeletes = applied.filter(isHangerDelete);
  const restraintDeletes = applied.filter(isRestraintDelete);
  if (!restraintDeletes.length) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_RESTRAINT_OPERATION_REQUIRED');
  const nodeScope = nodeOperations.length
    ? independentCanonicalSubscope(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', parentCustody) : null;
  const sifScope = sifDeletes.length
    ? independentCanonicalSubscope(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', parentCustody) : null;
  const hangerScope = hangerDeletes.length
    ? independentCanonicalSubscope(transferPlan, isHangerDelete, 'WRITER_2_HANGER_DELETE', parentCustody) : null;
  const restraintScope = independentCanonicalSubscope(
    transferPlan, isRestraintDelete, CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY, parentCustody,
  );
  return Object.freeze({
    node: nodeScope ? buildCiiWriter2NodeNameRelocationPlan({ targetDocument: before, transferPlan: nodeScope }) : null,
    sif: sifScope ? buildCiiWriter2SifDeleteRelocationPlan({ targetDocument: before, targetGraph, transferPlan: sifScope }) : null,
    hanger: hangerScope ? buildCiiWriter2HangerDeletePlan({ targetDocument: before, transferPlan: hangerScope }) : null,
    restraint: buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument: before, transferPlan: restraintScope }),
    counts: Object.freeze({
      nodeName: nodeOperations.length, sifDelete: sifDeletes.length,
      hangerDelete: hangerDeletes.length, restraintDelete: restraintDeletes.length,
    }),
  });
}

function assertPlansReady(plans) {
  const rows = [
    ['NODE', plans.node], ['SIF', plans.sif], ['HANGER', plans.hanger], ['RESTRAINT', plans.restraint],
  ];
  for (const [label, plan] of rows) {
    if (plan && !plan.ready) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_${label}_PLAN_BLOCKED:${plan.blockers.join('|')}`);
    }
  }
}

function buildExpectedPostimage(before, plans) {
  const original = String(before?.physicalFile?.originalByteString ?? '');
  const expectedClaims = [];
  if (plans.node) expectedClaims.push(...legacyValidatorTest.nodeExpectedClaims(before, plans.node));
  if (plans.sif) expectedClaims.push(...legacyValidatorTest.sifExpectedClaims(before, plans.sif));
  if (plans.hanger) expectedClaims.push(...hangerExpectedClaims(before, plans.hanger));
  expectedClaims.push(...restraintExpectedClaims(before, plans.restraint));
  const arbitrated = legacyValidatorTest.arbitrateExpected(expectedClaims, original);
  const byteString = legacyValidatorTest.applyExpected(original, arbitrated);
  const bytes = bytesFromByteString(byteString);
  const physical = createCiiPhysicalFile(bytes);
  return Object.freeze({ original, arbitrated, byteString, bytes, physical, sha256: sha256CiiByteString(byteString) });
}

function assertActualPostimage(after, expected) {
  const actualByteString = String(after?.physicalFile?.originalByteString ?? '');
  if (actualByteString !== expected.byteString) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_EXACT_COMPLETE_POSTIMAGE_MISMATCH');
  }
  if (stableStringify(after?.physicalFile?.lines || []) !== stableStringify(expected.physical.lines)
    || stableStringify(after?.physicalFile?.lineEndings || {}) !== stableStringify(expected.physical.lineEndings)
    || String(after?.physicalFile?.text ?? '') !== expected.physical.text) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_POSTIMAGE_PHYSICAL_REPRESENTATION_MISMATCH');
  }
  if (!isCiiSha256Hex(after?.contentSha256) || text(after.contentSha256) !== expected.sha256) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_POSTIMAGE_SHA256_MISMATCH');
  }
}

function assertWriterIdentity(writerResult, expected) {
  if (writerResult?.schema !== 'CIIWorkspaceWriter2CompositeRestraintResult.v1'
    || writerResult?.status !== 'APPLIED' || writerResult?.writer !== 'WRITER_2'
    || writerResult?.mode !== 'ONE_ORIGINAL_PREIMAGE_COMPOSITE'
    || writerResult?.authority !== CII_WRITER_2_RESTRAINT_COMPOSITE_AUTHORITY) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_WRITER_AUTHORITY_MISMATCH');
  }
  if (writerResult.byteString !== expected.byteString || !sameBytes(writerResult.bytes, expected.bytes)
    || writerResult.text !== expected.physical.text) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_WRITER_REPRESENTATION_MISMATCH');
  }
}

function assertMutationTestimony(writerResult, expected) {
  const expectedTestimony = expectedMutationTestimony(expected.arbitrated);
  const actualTestimony = actualMutationTestimony(writerResult);
  if (Number(writerResult.mutationCount) !== expected.arbitrated.length
    || stableStringify(actualTestimony) !== stableStringify(expectedTestimony)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_WRITER_MUTATION_TESTIMONY_MISMATCH');
  }
  return expectedTestimony;
}

function assertComponentTestimony(writerResult, expectedTestimony, plans) {
  if (stableStringify(writerResult?.components?.restraintDelete?.relocationPlan) !== stableStringify(plans.restraint)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_RESTRAINT_PLAN_TESTIMONY_MISMATCH');
  }
  const restraintExpected = expectedTestimony.filter((item) => item.authorityFamily === CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY);
  const restraintActual = (writerResult?.components?.restraintDelete?.mutations || []).map((item) => ({
    authorityFamily: CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY, kind: item.kind,
    byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
  if (Number(writerResult?.components?.restraintDelete?.mutationCount) !== restraintExpected.length
    || stableStringify(restraintActual) !== stableStringify(restraintExpected)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_RESTRAINT_COMPONENT_MUTATION_TESTIMONY_MISMATCH');
  }
  const existingExpected = expectedTestimony.filter((item) => item.authorityFamily !== CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY);
  const existingActual = actualMutationTestimony(writerResult?.components?.existingComposite || {});
  if (existingExpected.length !== existingActual.length
    || stableStringify(existingExpected) !== stableStringify(existingActual)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_EXISTING_COMPONENT_TESTIMONY_MISMATCH');
  }
}

function assertCustodyTestimony(writerResult, parentCustody, target0HashCustody, expected) {
  if (stableStringify(writerResult.parentScopeCustody) !== stableStringify(parentCustody)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PARENT_SCOPE_TESTIMONY_MISMATCH');
  }
  const expectedTarget0 = Object.freeze({
    authority: TARGET0_HASH_AUTHORITY, contentSha256: target0HashCustody.contentSha256,
    byteLength: expected.original.length,
  });
  if (stableStringify(writerResult.target0HashCustody) !== stableStringify(expectedTarget0)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_TARGET0_HASH_TESTIMONY_MISMATCH');
  }
  const expectedPostimage = Object.freeze({
    authority: POSTIMAGE_HASH_AUTHORITY, contentSha256: expected.sha256, byteLength: expected.byteString.length,
  });
  if (stableStringify(writerResult.postimageHashCustody) !== stableStringify(expectedPostimage)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_POSTIMAGE_HASH_TESTIMONY_MISMATCH');
  }
  if (stableStringify(writerResult.postimageRepresentationCustody) !== stableStringify(representationCustody(expected.physical))) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_REPRESENTATION_TESTIMONY_MISMATCH');
  }
}

export function validateCiiWriter2CompositeWithRestraintDelete({ before, after, targetGraph, transferPlan, writerResult }) {
  const target0HashCustody = independentTarget0Custody(before);
  const parentCheck = legacyValidatorTest.independentBoundScopeCustody(transferPlan, before);
  if (parentCheck.errors.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PARENT_SCOPE:${parentCheck.errors.join('|')}`);
  }
  const applied = appliedOperations(transferPlan);
  if (!applied.length) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_NO_MUTATIONS');
  rejectUnsupported(applied);
  const plans = buildPlans(before, targetGraph, transferPlan, parentCheck.custody, applied);
  assertPlansReady(plans);
  const expected = buildExpectedPostimage(before, plans);

  // Complete final bytes remain the primary oracle; testimony is secondary.
  assertActualPostimage(after, expected);
  assertWriterIdentity(writerResult, expected);
  const expectedTestimony = assertMutationTestimony(writerResult, expected);
  assertComponentTestimony(writerResult, expectedTestimony, plans);
  assertCustodyTestimony(writerResult, parentCheck.custody, target0HashCustody, expected);

  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositeRestraintValidation.v1', status: 'PASS',
    authority: 'INDEPENDENT_COMPLETE_POSTIMAGE_RESTRAINT_COMPOSITE_VALIDATION',
    expectedSha256: expected.sha256, expectedByteLength: expected.byteString.length,
    mutationCount: expected.arbitrated.length, familyOperationCounts: plans.counts,
    checklist: Object.freeze([
      'INDEPENDENT_TARGET0_SHA256', 'INDEPENDENT_PARENT_SCOPE', 'INDEPENDENT_CANONICAL_CHILD_SCOPES',
      'INDEPENDENT_NODE_PLAN_AND_CLAIMS', 'INDEPENDENT_SIF_PLAN_AND_CLAIMS',
      'INDEPENDENT_HANGER_PLAN_AND_CLAIMS', 'INDEPENDENT_RESTRAINT_PLAN_AND_CLAIMS',
      'GLOBAL_ORIGINAL_COORDINATE_ARBITRATION', 'EXACT_COMPLETE_FINAL_BYTES',
      'POSTIMAGE_SHA256', 'POSTIMAGE_PHYSICAL_REINTAKE', 'WRITER_TESTIMONY_AFTER_BYTES',
    ]),
  });
}

export const _test = Object.freeze({
  rejectUnsupported, buildPlans, assertPlansReady, buildExpectedPostimage, assertActualPostimage,
  assertWriterIdentity, assertMutationTestimony, assertComponentTestimony, assertCustodyTestimony,
  independentCanonicalSubscope, independentTarget0Custody, restraintExpectedClaims, hangerExpectedClaims,
  expectedMutationTestimony, actualMutationTestimony, bytesFromByteString, sameBytes, representationCustody,
  isNodeMutation, isSifDelete, isSifCreate, isHangerDelete, isHangerCreate,
  isRestraintDelete, isRestraintCreate, supportedApply, operationId, text, sorted, exactIds, DELETE_ALL_HANGER_FAMILY,
});
