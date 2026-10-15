import { deepFreeze } from './cii-workspace-contracts.js';
import { createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from './cii-workspace-writer2-composite-hanger.js';
import { applyCiiWriter2RestraintDeleteCompaction } from './cii-workspace-writer2-restraint-delete-write.js';
import { CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';
import { CII_WRITER_2_HANGER_CREATE_BLOCKER } from './cii-workspace-writer2-hanger-delete.js';
import { CII_WRITER_2_RESTRAINT_CREATE_BLOCKER } from './cii-workspace-writer2-restraint-delete-compaction-plan.js';
import {
  POSTIMAGE_HASH_AUTHORITY, appliedOperations, applyClaims, arbitrateClaims, assertBoundScopeCustody,
  byteStringToBytes, exactIds, isExistingCompositeMutation, isHangerCreate, isHangerDelete, isNodeMutation,
  isRestraintCreate, isRestraintDelete, isSifCreate, isSifDelete, normalizeClaim, operationId, projectCanonicalSubscope,
  representationCustody, sameStrings, sorted, supportedApply, target0Custody, text,
} from './cii-workspace-writer2-composite-restraint-support.js';

export const CII_WRITER_2_RESTRAINT_COMPOSITE_AUTHORITY = 'CII_WRITER_2_RESTRAINT_ONE_TARGET0_COMPOSITE';
export const CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY = 'WRITER_2_RESTRAINT_BLOCK_DELETE';

const ALLOWED_RESTRAINT_CLAIM_KINDS = new Set([
  'CONTROL_RESTRAINT_BLOCK_COUNT',
  'ELEMENT_RESTRAINT_POINTER',
  'RESTRAINT_SECTION_PAYLOAD',
]);

function rejectUnsupported(applied) {
  const families = [
    [applied.filter(isSifCreate), CII_WRITER_2_SIF_CREATE_BLOCKER],
    [applied.filter(isHangerCreate), CII_WRITER_2_HANGER_CREATE_BLOCKER],
    [applied.filter(isRestraintCreate), CII_WRITER_2_RESTRAINT_CREATE_BLOCKER],
  ];
  for (const [operations, blocker] of families) {
    if (operations.length) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_${blocker}:${operations.map(operationId).join(',')}`);
    }
  }
  const unsupported = applied.filter((operation) => !supportedApply(operation));
  if (unsupported.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_UNSUPPORTED_APPLY:${unsupported.map(operationId).join(',')}`);
  }
}

function operationCounts(applied) {
  return Object.freeze({
    nodeNameOperations: applied.filter(isNodeMutation).length,
    sifDeleteOperations: applied.filter(isSifDelete).length,
    hangerDeleteOperations: applied.filter(isHangerDelete).length,
    restraintDeleteOperations: applied.filter(isRestraintDelete).length,
  });
}

function buildComponentResults({ targetDocument, targetGraph, transferPlan, parentCustody, counts }) {
  const existingCount = counts.nodeNameOperations + counts.sifDeleteOperations + counts.hangerDeleteOperations;
  const existingPlan = existingCount
    ? projectCanonicalSubscope(transferPlan, isExistingCompositeMutation, 'WRITER_2_EXISTING_NODE_SIF_HANGER_COMPOSITE', parentCustody)
    : null;
  const restraintPlan = projectCanonicalSubscope(
    transferPlan, isRestraintDelete, CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY, parentCustody,
  );
  const existingComposite = existingPlan
    ? applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument, targetGraph, transferPlan: existingPlan })
    : null;
  const restraintDelete = applyCiiWriter2RestraintDeleteCompaction({ targetDocument, transferPlan: restraintPlan });
  return Object.freeze({ existingComposite, restraintDelete });
}

function collectClaims(components, target0HashCustody) {
  const restraintDelete = components.restraintDelete;
  if (text(restraintDelete?.target0HashCustody?.contentSha256) !== target0HashCustody.contentSha256) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_COMPONENT_TARGET0_HASH_MISMATCH');
  }
  for (const claim of restraintDelete?.mutations || []) {
    if (!ALLOWED_RESTRAINT_CLAIM_KINDS.has(claim?.kind)) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_UNEXPECTED_COMPONENT_CLAIM:${claim?.kind || 'UNKNOWN'}`);
    }
  }
  return [
    ...(components.existingComposite?.mutations || []).map((claim) => ({ authorityFamily: claim.authorityFamily, claim })),
    ...(restraintDelete?.mutations || []).map((claim) => ({ authorityFamily: CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY, claim })),
  ];
}

function buildPostimage(original, mutations) {
  const byteString = applyClaims(original, mutations);
  const bytes = byteStringToBytes(byteString);
  const canonical = createCiiPhysicalFile(bytes);
  if (canonical.originalByteString !== byteString) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_POSTIMAGE_REINTAKE_BYTE_MISMATCH');
  }
  return Object.freeze({ byteString, bytes, canonical });
}

export function applyCiiWriter2CompositeWithRestraintDelete({ targetDocument, targetGraph, transferPlan }) {
  const target0HashCustody = target0Custody(targetDocument);
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (transferPlan?.status !== 'PREVIEW_READY') {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_TRANSFER_PLAN_NOT_PREVIEW_READY');
  }
  if ((transferPlan?.blockers || []).length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_TRANSFER_BLOCKED:${transferPlan.blockers.join('|')}`);
  }
  const parentCustody = assertBoundScopeCustody(transferPlan, targetDocument);
  const applied = appliedOperations(transferPlan);
  if (!applied.length) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_NO_MUTATIONS');
  rejectUnsupported(applied);
  const counts = operationCounts(applied);
  if (!counts.restraintDeleteOperations) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_OPERATION_REQUIRED');

  const components = buildComponentResults({ targetDocument, targetGraph, transferPlan, parentCustody, counts });
  const mutations = arbitrateClaims(collectClaims(components, target0HashCustody), original);
  if (!mutations.length) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_NO_PHYSICAL_MUTATIONS');
  const postimage = buildPostimage(original, mutations);
  const postimageHashCustody = deepFreeze({
    authority: POSTIMAGE_HASH_AUTHORITY,
    contentSha256: sha256CiiByteString(postimage.byteString),
    byteLength: postimage.byteString.length,
  });

  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositeRestraintResult.v1', status: 'APPLIED', writer: 'WRITER_2',
    mode: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE', authority: CII_WRITER_2_RESTRAINT_COMPOSITE_AUTHORITY,
    byteString: postimage.byteString, bytes: postimage.bytes, text: postimage.canonical.text,
    byteLengthBefore: original.length, byteLengthAfter: postimage.byteString.length,
    mutationCount: mutations.length, mutations,
    target0HashCustody, postimageHashCustody,
    postimageRepresentationCustody: representationCustody(postimage.canonical),
    parentScopeCustody: parentCustody,
    familyMutationCounts: deepFreeze({
      ...counts,
      existingCompositeClaims: components.existingComposite?.mutations?.length || 0,
      restraintDeleteClaims: components.restraintDelete?.mutations?.length || 0,
    }),
    components,
  });
}

export const _test = deepFreeze({
  text, operationId, sorted, exactIds, sameStrings,
  isNodeMutation, isSifDelete, isSifCreate, isHangerDelete, isHangerCreate,
  isRestraintDelete, isRestraintCreate, isExistingCompositeMutation, supportedApply,
  target0Custody, assertBoundScopeCustody, projectCanonicalSubscope,
  normalizeClaim, arbitrateClaims, applyClaims, byteStringToBytes, representationCustody,
  rejectUnsupported, operationCounts, buildComponentResults, collectClaims, buildPostimage,
});
