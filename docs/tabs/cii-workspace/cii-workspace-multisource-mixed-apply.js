import { deepFreeze } from './cii-workspace-contracts.js';
import { intakeCiiWorkspaceDocument } from './cii-workspace-intake.js';
import { ciiPhysicalFileBytes } from './cii-workspace-physical-file.js';
import { applyCiiTargetWriterComposite } from './cii-workspace-target-writer-composite.js';
import { applyCiiWriter2NodeNameRelocation } from './cii-workspace-writer2-nodename-write.js';
import {
  ciiWriter1CNodeNameReplacementOperation,
  ciiWriter2NodeNameCardinalityOperation,
} from './cii-workspace-multisource-bm001-correspondence.js';
import { projectCanonicalV14WriterDelta } from './cii-workspace-v14-change-projection.js';
import { assertCiiV14Writer2FixedFieldAuthority } from './cii-workspace-v14-writer2-fixed-field-authority.js';
import {
  assertCiiWriter2V14ShadowIdentity,
  createCiiWriter2V14LosslessShadow,
} from './cii-workspace-v14-writer2-shadow.js';
import {
  ciiBytesEqual,
  ciiBytesToByteString,
  ciiSha256,
  convertCiiNeutralVersionLossless,
  detectCiiNeutralVersion,
} from './cii-workspace-v11-v14-converter.js';

function text(value) { return String(value ?? '').trim(); }
function applied(operation) { return operation?.scopeDecision === 'APPLY'; }
function appliedMutations(plan) {
  return (plan?.operations || []).filter((operation) => applied(operation) && operation?.action !== 'KEEP');
}
function familyPlan(plan, predicate) {
  return deepFreeze({
    ...plan,
    operations: deepFreeze((plan?.operations || []).filter((operation) => operation?.action === 'KEEP' || (applied(operation) && predicate(operation)))),
    excludedOperations: deepFreeze([]),
  });
}
function fileName(preview) { return preview?.targetDocument?.fileName || 'T.CII'; }
function ensureSourceSetMixedPlan(preview) {
  if (preview?.transferPlan?.sourceAuthorityKind !== 'SOURCE_SET') return null;
  const mutations = appliedMutations(preview.transferPlan);
  const replacements = mutations.filter(ciiWriter1CNodeNameReplacementOperation);
  const structural = mutations.filter(ciiWriter2NodeNameCardinalityOperation);
  const unauthorized = mutations.filter((operation) => !ciiWriter1CNodeNameReplacementOperation(operation)
    && !ciiWriter2NodeNameCardinalityOperation(operation));
  if (unauthorized.length) {
    throw new Error(`CII_MS_MIXED_APPLY_UNAUTHORIZED_OPERATION:${unauthorized.map((operation) => operation?.operationId || 'unknown').join(',')}`);
  }
  if (!replacements.length) return null;
  return Object.freeze({ replacements: Object.freeze(replacements), structural: Object.freeze(structural) });
}
async function intakeTarget(bytes, preview, options) {
  return intakeCiiWorkspaceDocument(bytes, fileName(preview), { side: 'TARGET', cryptoRef: options.cryptoRef });
}
function replacementApply(preview, targetDocument) {
  const plan = familyPlan(preview.transferPlan, ciiWriter1CNodeNameReplacementOperation);
  return applyCiiTargetWriterComposite({
    targetDocument,
    targetGraph: null,
    correspondence: preview.correspondence,
    transferPlan: plan,
  });
}
function structuralPlan(preview) {
  return familyPlan(preview.transferPlan, ciiWriter2NodeNameCardinalityOperation);
}
function combinedMutations(replacementResult, structuralResult) {
  return Object.freeze([
    ...(replacementResult?.mutations || []).map((mutation) => Object.freeze({ phase: 'WRITER_1C_REPLACE', ...mutation })),
    ...(structuralResult?.mutations || []).map((mutation) => Object.freeze({ phase: 'WRITER_2_STRUCTURAL', ...mutation })),
  ]);
}
function outputResult(preview, originalSha256, bytes, replacementResult, structuralResult, validation) {
  const mutations = combinedMutations(replacementResult, structuralResult);
  return {
    schema: 'CIIWorkspaceMixedNodeNameApplyResult.v1',
    status: 'PASS', writer: 'WRITER_1C+WRITER_2', fileName: `Modified_${fileName(preview)}`,
    bytes,
    byteString: ciiBytesToByteString(bytes),
    text: new TextDecoder('utf-8').decode(bytes),
    byteLength: bytes.byteLength,
    sourceTargetSha256: originalSha256,
    mutationCount: mutations.length,
    mutations,
    validation,
  };
}

async function applyDirectV11(preview, replacementDocument, replacementResult, originalSha256, options) {
  const structuralResult = applyCiiWriter2NodeNameRelocation({
    targetDocument: replacementDocument,
    transferPlan: structuralPlan(preview),
  });
  const finalDocument = await intakeTarget(structuralResult.bytes, preview, options);
  const modifiedTargetSha256 = finalDocument.contentSha256;
  return Object.freeze({
    ...outputResult(preview, originalSha256, structuralResult.bytes, replacementResult, structuralResult, deepFreeze({
      status: 'PASS', writer1CReplacement: replacementResult.readiness, writer2Structural: structuralResult.relocationPlan,
    })),
    modifiedTargetSha256,
    versionBridgeValidation: deepFreeze({
      schema: 'CIIWorkspaceWriterVersionBridgeValidation.v2', status: 'PASS', path: 'SOURCE_SET_MIXED_DIRECT_V11',
      originalTargetSha256: originalSha256, modifiedTargetSha256,
      writer1CReplacementMutationCount: replacementResult.mutationCount,
      writer2StructuralMutationCount: structuralResult.relocationPlan?.operationCount ?? null,
    }),
  });
}

async function applyProjectedV14(preview, replacementBytes, replacementResult, originalSha256, options) {
  const bridge = preview.versionBridge;
  const expectedShadow = bridge?.target?.writer2Shadow;
  let conversionInput = replacementBytes; let replacementShadowAudit = null; let replacementShadowValidation = null;
  if (expectedShadow?.enabled) {
    const shadow = createCiiWriter2V14LosslessShadow(replacementBytes);
    replacementShadowValidation = assertCiiWriter2V14ShadowIdentity(expectedShadow.audit, shadow.audit);
    replacementShadowAudit = shadow.audit; conversionInput = shadow.outputBytes;
  }

  const down = await convertCiiNeutralVersionLossless(conversionInput, 11, { fileName: fileName(preview), cryptoRef: options.cryptoRef });
  const normalizedDocument = await intakeTarget(down.outputBytes, preview, options);
  const baselineCanonical = await convertCiiNeutralVersionLossless(down.outputBytes, 14, { fileName: fileName(preview), cryptoRef: options.cryptoRef });
  const structuralResult = applyCiiWriter2NodeNameRelocation({
    targetDocument: normalizedDocument,
    transferPlan: structuralPlan(preview),
  });
  const upgraded = await convertCiiNeutralVersionLossless(structuralResult.bytes, 14, { fileName: fileName(preview), cryptoRef: options.cryptoRef });
  const fixedFieldAuthority = assertCiiV14Writer2FixedFieldAuthority(baselineCanonical.outputBytes, upgraded.outputBytes);
  const canonicalProof = await convertCiiNeutralVersionLossless(upgraded.outputBytes, 11, { fileName: fileName(preview), cryptoRef: options.cryptoRef });
  if (!ciiBytesEqual(structuralResult.bytes, canonicalProof.outputBytes)) {
    throw new Error('CII_MS_MIXED_CANONICAL_STRUCTURAL_ROUNDTRIP_NOT_EXACT');
  }

  const projection = projectCanonicalV14WriterDelta(replacementBytes, baselineCanonical.outputBytes, upgraded.outputBytes);
  if (expectedShadow?.enabled && (projection.changedSections || []).includes('SIF&TEES')) {
    throw new Error('CII_MS_MIXED_V14_PROTECTED_SIF_DELTA');
  }
  let projectedProofInput = projection.outputBytes; let projectedShadowAudit = null; let projectedShadowValidation = null;
  if (expectedShadow?.enabled) {
    const projectedShadow = createCiiWriter2V14LosslessShadow(projection.outputBytes);
    projectedShadowValidation = assertCiiWriter2V14ShadowIdentity(replacementShadowAudit, projectedShadow.audit);
    projectedShadowAudit = projectedShadow.audit; projectedProofInput = projectedShadow.outputBytes;
  }
  const projectedProof = await convertCiiNeutralVersionLossless(projectedProofInput, 11, { fileName: fileName(preview), cryptoRef: options.cryptoRef });
  if (!ciiBytesEqual(structuralResult.bytes, projectedProof.outputBytes)) {
    throw new Error('CII_MS_MIXED_PROJECTED_V14_NORMALIZED_POSTIMAGE_MISMATCH');
  }
  await intakeTarget(projection.outputBytes, preview, options);
  const modifiedTargetSha256 = await ciiSha256(projection.outputBytes, options.cryptoRef);
  return Object.freeze({
    ...outputResult(preview, originalSha256, projection.outputBytes, replacementResult, structuralResult, deepFreeze({
      status: 'PASS', writer1CReplacement: replacementResult.readiness, writer2Structural: structuralResult.relocationPlan,
    })),
    modifiedTargetSha256,
    versionBridgeValidation: deepFreeze({
      schema: 'CIIWorkspaceWriterVersionBridgeValidation.v2', status: 'PASS', path: 'SOURCE_SET_MIXED_V14_REPLACE_THEN_STRUCTURAL',
      originalTargetSha256: originalSha256, modifiedTargetSha256,
      writer1CReplacementMutationCount: replacementResult.mutationCount,
      writer2StructuralMutationCount: structuralResult.relocationPlan?.operationCount ?? null,
      replacementShadowValidation,
      replacementShadowAudit,
      projectedShadowValidation,
      projectedShadowAudit,
      fixedFieldAuthority,
      changedV14Sections: projection.changedSections,
      projectionLedger: projection.ledger,
      untouchedV14SectionCount: projection.untouchedSectionCount,
      canonicalStructuralRoundTripExact: true,
      projectedNormalizedPostimageExact: true,
    }),
  });
}

export async function applyCiiSourceSetMixedNodeNameWithVersionBridge(preview, targetInput, options = {}) {
  const mixed = ensureSourceSetMixedPlan(preview);
  if (!mixed) return null;
  if (preview?.writerReadiness?.ready !== true) {
    throw new Error(`CII_MS_MIXED_WRITER_READINESS_REQUIRED:${(preview?.writerReadiness?.blockers || []).join('|')}`);
  }
  const actualSha256 = await ciiSha256(targetInput, options.cryptoRef);
  const expectedSha256 = text(preview?.targetAuthority?.originalSha256 || preview?.versionBridge?.target?.originalSha256);
  if (!expectedSha256 || actualSha256 !== expectedSha256) throw new Error('CII_MS_MIXED_STALE_ORIGINAL_TARGET_HASH');
  const originalDocument = await intakeTarget(targetInput, preview, options);
  const originalBytes = ciiPhysicalFileBytes(originalDocument.physicalFile);
  const replacementResult = replacementApply(preview, originalDocument);
  const replacementBytes = replacementResult.bytes;
  const replacementDocument = await intakeTarget(replacementBytes, preview, options);
  if (!mixed.structural.length) {
    const modifiedTargetSha256 = replacementDocument.contentSha256;
    return Object.freeze({
      ...outputResult(preview, actualSha256, replacementBytes, replacementResult, null, deepFreeze({
        status: 'PASS', writer1CReplacement: replacementResult.readiness, writer2Structural: null,
      })),
      modifiedTargetSha256,
      versionBridgeValidation: deepFreeze({
        schema: 'CIIWorkspaceWriterVersionBridgeValidation.v2', status: 'PASS', path: 'SOURCE_SET_WRITER1C_DIRECT_ORIGINAL_BYTES',
        originalTargetSha256: actualSha256, modifiedTargetSha256,
        writer1CReplacementMutationCount: replacementResult.mutationCount, writer2StructuralMutationCount: 0,
        originalByteLength: originalBytes.byteLength, replacementByteLength: replacementBytes.byteLength,
      }),
    });
  }
  const version = detectCiiNeutralVersion(replacementBytes);
  if (version === 11) return applyDirectV11(preview, replacementDocument, replacementResult, actualSha256, options);
  if (version === 14) return applyProjectedV14(preview, replacementBytes, replacementResult, actualSha256, options);
  throw new Error(`CII_MS_MIXED_TARGET_VERSION_UNSUPPORTED:${version}`);
}

export const _test = Object.freeze({ appliedMutations, familyPlan, ensureSourceSetMixedPlan });