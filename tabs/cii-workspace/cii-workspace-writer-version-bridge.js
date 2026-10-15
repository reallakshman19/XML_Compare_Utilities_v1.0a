import {
  applyCiiWorkspaceTargetWriter2,
  createCiiWorkspacePreview,
  inspectCiiWorkspaceModels,
} from './cii-workspace-core.js';
import { ciiWorkspaceArtifactBundle } from './cii-workspace-export.js';
import { intakeCiiWorkspaceDocument } from './cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from './cii-workspace-topology-adapter.js';
import { applyCiiSourceSetMixedNodeNameWithVersionBridge } from './cii-workspace-multisource-mixed-apply.js';
import { projectCanonicalV14WriterDelta } from './cii-workspace-v14-change-projection.js';
import { assertCiiV14Writer2FixedFieldAuthority } from './cii-workspace-v14-writer2-fixed-field-authority.js';
import {
  assertCiiWriter2V14ShadowIdentity,
  createCiiWriter2V14LosslessShadow,
} from './cii-workspace-v14-writer2-shadow.js';
import {
  ciiByteStringToBytes,
  ciiBytesEqual,
  ciiBytesToByteString,
  ciiSha256,
  convertCiiNeutralVersionLossless,
  detectCiiNeutralVersion,
} from './cii-workspace-v11-v14-converter.js';

function sideInput(input, side) {
  return input?.[`${side}Bytes`] ?? input?.[`${side}Text`];
}
function withoutSideText(input, side, bytes) {
  const next = { ...(input || {}) };
  delete next[`${side}Text`];
  next[`${side}Bytes`] = bytes;
  return next;
}
function frozenAudit(audit) {
  return audit ? Object.freeze({ ...audit }) : null;
}
function writer2TargetShadowEnabled(side, options = {}) {
  const version = String(options?.writerVersion || '');
  return side === 'TARGET' && (version === '2' || version === '1C');
}

async function normalizeSideToV11(value, fileName, side, cryptoRef, options = {}) {
  const stage = side === 'TARGET' ? 'TARGET_NORMALIZE' : 'SOURCE_NORMALIZE';
  options.instrumentation?.record?.(stage);
  const normalizeStartedAt = performance.now();
  const version = detectCiiNeutralVersion(value);
  if (version === 11) {
    const sourceSha256 = await ciiSha256(value, cryptoRef);
    const result = Object.freeze({
      side,
      originalVersion: 11,
      normalizedVersion: 11,
      normalizedBytes: value,
      sourceSha256,
      normalizedSha256: sourceSha256,
      baselineCanonicalSha256: sourceSha256,
      normalizeAudit: null,
      roundTripAudit: null,
      exactRoundTrip: true,
      writer2Shadow: null,
    });
    options.instrumentation?.record?.(`${stage}_MS`, performance.now() - normalizeStartedAt);
    return result;
  }

  const originalSha256 = await ciiSha256(value, cryptoRef);
  let conversionInput = value;
  let writer2Shadow = null;
  if (writer2TargetShadowEnabled(side, options)) {
    const shadow = createCiiWriter2V14LosslessShadow(value);
    if (shadow.audit.maskedFieldCount > 0) {
      const shadowSha256 = await ciiSha256(shadow.outputBytes, cryptoRef);
      conversionInput = shadow.outputBytes;
      writer2Shadow = Object.freeze({
        enabled: true,
        originalSha256,
        shadowSha256,
        audit: shadow.audit,
      });
    }
  }

  const downStartedAt = performance.now();
  const down = await convertCiiNeutralVersionLossless(conversionInput, 11, { fileName, cryptoRef });
  options.instrumentation?.record?.(`${stage}_CONVERT_DOWN_MS`, performance.now() - downStartedAt);
  const upStartedAt = performance.now();
  const up = await convertCiiNeutralVersionLossless(down.outputBytes, 14, { fileName, cryptoRef });
  options.instrumentation?.record?.(`${stage}_CONVERT_UP_MS`, performance.now() - upStartedAt);
  const result = Object.freeze({
    side,
    originalVersion: 14,
    normalizedVersion: 11,
    normalizedBytes: down.outputBytes,
    sourceSha256: originalSha256,
    normalizedSha256: down.targetSha256,
    baselineCanonicalSha256: up.targetSha256,
    normalizeAudit: frozenAudit(down.audit),
    roundTripAudit: frozenAudit(up.audit),
    exactRoundTrip: ciiBytesEqual(conversionInput, up.outputBytes),
    writer2Shadow,
  });
  options.instrumentation?.record?.(`${stage}_MS`, performance.now() - normalizeStartedAt);
  return result;
}

async function normalizePairInput(input, options = {}) {
  const sourceValue = sideInput(input, 'source');
  const targetValue = sideInput(input, 'target');
  if (sourceValue == null || targetValue == null) throw new Error('CII_VERSION_BRIDGE_SOURCE_TARGET_REQUIRED');
  const [source, target] = await Promise.all([
    normalizeSideToV11(sourceValue, input?.sourceFileName || 'source.cii', 'SOURCE', options.cryptoRef, options),
    normalizeSideToV11(targetValue, input?.targetFileName || 'target.cii', 'TARGET', options.cryptoRef, options),
  ]);
  let normalizedInput = withoutSideText(input, 'source', source.normalizedBytes);
  normalizedInput = withoutSideText(normalizedInput, 'target', target.normalizedBytes);
  return Object.freeze({ source, target, normalizedInput });
}

export async function prepareCiiWorkspaceSourceWithVersionBridge(sourceValue, sourceFileName, options = {}) {
  if (sourceValue == null) throw new Error('CII_VERSION_BRIDGE_SOURCE_TARGET_REQUIRED');
  const fileName = sourceFileName || 'source.cii';
  const source = await normalizeSideToV11(sourceValue, fileName, 'SOURCE', options.cryptoRef, options);
  const sourceDocument = await intakeCiiWorkspaceDocument(source.normalizedBytes, fileName, {
    side: 'SOURCE', cryptoRef: options.cryptoRef, instrumentation: options.instrumentation,
  });
  const sourceGraph = adaptCiiDocumentToTopologyGraph(sourceDocument, { instrumentation: options.instrumentation });
  return Object.freeze({ source, sourceDocument, sourceGraph });
}

export async function prepareCiiWorkspaceTargetWithVersionBridge(targetValue, targetFileName, options = {}) {
  if (targetValue == null) throw new Error('CII_VERSION_BRIDGE_SOURCE_TARGET_REQUIRED');
  const fileName = targetFileName || 'target.cii';
  const target = await normalizeSideToV11(targetValue, fileName, 'TARGET', options.cryptoRef, options);
  const targetDocument = await intakeCiiWorkspaceDocument(target.normalizedBytes, fileName, {
    side: 'TARGET', cryptoRef: options.cryptoRef, instrumentation: options.instrumentation,
  });
  const targetGraph = adaptCiiDocumentToTopologyGraph(targetDocument, { instrumentation: options.instrumentation });
  return Object.freeze({ target, targetDocument, targetGraph });
}

function bridgeSideEvidence(side) {
  return Object.freeze({
    originalVersion: side.originalVersion,
    normalizedVersion: 11,
    originalSha256: side.sourceSha256,
    normalizedSha256: side.normalizedSha256,
    baselineCanonicalSha256: side.baselineCanonicalSha256,
    exactBaselineRoundTrip: side.exactRoundTrip,
    normalizeAudit: side.normalizeAudit,
    roundTripAudit: side.roundTripAudit,
    writer2Shadow: side.writer2Shadow,
  });
}

function buildVersionBridgeEvidence(source, target) {
  return Object.freeze({
    schema: 'CIIWorkspaceWriterVersionBridge.v2',
    mode: target.writer2Shadow?.enabled
      ? 'V14_TARGET_SHADOW_CHANGE_ISOLATED_VIA_V11'
      : (source.originalVersion === 11 && target.originalVersion === 11 ? 'DIRECT_V11' : 'CHANGE_ISOLATED_V14_VIA_V11'),
    source: bridgeSideEvidence(source),
    target: bridgeSideEvidence(target),
    conversionSource: Object.freeze({
      repository: 'reallaksh19/3D_Converters',
      commit: 'ca8d391ac5f829f53bebb3c37adf0547c34a67b4',
      policy: 'FROZEN_BYTE_IDENTICAL_PYTHON_ENGINE_ALLOW_LOSSY_FALSE',
    }),
    v14WritePolicy: Object.freeze({
      policy: 'ORIGINAL_V14_BYTES_PLUS_CANONICAL_WRITER_DELTA',
      wholeFileCanonicalRewriteAllowed: false,
      canonicalBaselineUsedAsOutput: false,
      finalNormalizedPostimageMustEqualWriter2V11: true,
      writer2TargetShadowAllowed: target.writer2Shadow?.enabled === true,
      writer2TargetShadowOutputAuthority: 'ORIGINAL_V14_BYTES_ONLY',
    }),
  });
}

function assertNormalizedIntakeHashes(result, source, target, context) {
  const sourceHash = result?.sourceDocument?.contentSha256 ?? result?.source?.contentSha256;
  const targetHash = result?.targetDocument?.contentSha256 ?? result?.target?.contentSha256;
  if (sourceHash !== source.normalizedSha256) {
    throw new Error(`CII_VERSION_BRIDGE_${context}_SOURCE_NORMALIZED_HASH_MISMATCH`);
  }
  if (targetHash !== target.normalizedSha256) {
    throw new Error(`CII_VERSION_BRIDGE_${context}_TARGET_NORMALIZED_HASH_MISMATCH`);
  }
}

export async function inspectCiiWorkspaceModelsWithVersionBridge(input, options = {}) {
  const normalized = await normalizePairInput(input, options);
  const inspection = await inspectCiiWorkspaceModels(normalized.normalizedInput, options);
  assertNormalizedIntakeHashes(inspection, normalized.source, normalized.target, 'INSPECTION');
  return Object.freeze({
    ...inspection,
    versionBridge: buildVersionBridgeEvidence(normalized.source, normalized.target),
  });
}

function assertPreparedSource(preparedSource) {
  if (!preparedSource?.source || !preparedSource?.sourceDocument || !preparedSource?.sourceGraph) {
    throw new Error('CII_VERSION_BRIDGE_PREPARED_SOURCE_REQUIRED');
  }
  if (preparedSource.sourceDocument.contentSha256 !== preparedSource.source.normalizedSha256) {
    throw new Error('CII_VERSION_BRIDGE_PREPARED_SOURCE_NORMALIZED_HASH_MISMATCH');
  }
}
function assertPreparedTarget(preparedTarget) {
  if (!preparedTarget?.target || !preparedTarget?.targetDocument || !preparedTarget?.targetGraph) {
    throw new Error('CII_VERSION_BRIDGE_PREPARED_TARGET_REQUIRED');
  }
  if (preparedTarget.targetDocument.contentSha256 !== preparedTarget.target.normalizedSha256) {
    throw new Error('CII_VERSION_BRIDGE_PREPARED_TARGET_NORMALIZED_HASH_MISMATCH');
  }
}

export async function inspectCiiWorkspaceModelsWithPreparedPair(preparedSource, preparedTarget, options = {}) {
  assertPreparedSource(preparedSource);
  assertPreparedTarget(preparedTarget);
  const inspection = await inspectCiiWorkspaceModels({}, options, {
    sourceDocument: preparedSource.sourceDocument,
    sourceGraph: preparedSource.sourceGraph,
    targetDocument: preparedTarget.targetDocument,
    targetGraph: preparedTarget.targetGraph,
  });
  assertNormalizedIntakeHashes(inspection, preparedSource.source, preparedTarget.target, 'INSPECTION');
  return Object.freeze({
    ...inspection,
    versionBridge: buildVersionBridgeEvidence(preparedSource.source, preparedTarget.target),
  });
}

export async function inspectCiiWorkspaceModelsWithPreparedTarget(input, preparedTarget, options = {}) {
  assertPreparedTarget(preparedTarget);
  const sourceValue = sideInput(input, 'source');
  if (sourceValue == null) throw new Error('CII_VERSION_BRIDGE_SOURCE_TARGET_REQUIRED');
  const preparedSource = await prepareCiiWorkspaceSourceWithVersionBridge(
    sourceValue,
    input?.sourceFileName || 'source.cii',
    options,
  );
  return inspectCiiWorkspaceModelsWithPreparedPair(preparedSource, preparedTarget, options);
}

export async function createCiiWorkspacePreviewWithVersionBridge(input, options = {}) {
  const normalized = await normalizePairInput(input, options);
  const versionBridge = buildVersionBridgeEvidence(normalized.source, normalized.target);
  const preview = await createCiiWorkspacePreview(normalized.normalizedInput, options);
  assertNormalizedIntakeHashes(preview, normalized.source, normalized.target, 'PREVIEW');
  const audit = Object.freeze({ ...preview.audit, versionBridge });
  const result = { ...preview, versionBridge, audit };
  result.artifacts = ciiWorkspaceArtifactBundle(result);
  return Object.freeze(result);
}

async function normalizeCurrentTarget(preview, targetInput, options = {}) {
  const bridge = preview?.versionBridge;
  if (!bridge) throw new Error('CII_VERSION_BRIDGE_PREVIEW_REQUIRED');
  const expected = Number(bridge.target?.originalVersion);
  const actual = detectCiiNeutralVersion(targetInput);
  if (actual !== expected) throw new Error(`CII_VERSION_BRIDGE_TARGET_VERSION_MISMATCH:${expected}:${actual}`);
  if (actual === 11) return Object.freeze({
    bytes: targetInput, originalBytes: targetInput, audit: null,
    baselineCanonicalBytes: null, baselineCanonicalAudit: null,
    shadowAudit: null, shadowValidation: null,
  });

  const originalSha256 = await ciiSha256(targetInput, options.cryptoRef);
  if (bridge.target?.originalSha256 && originalSha256 !== bridge.target.originalSha256) {
    throw new Error('CII_WRITER_2_STALE_ORIGINAL_V14_TARGET_HASH');
  }

  let conversionInput = targetInput;
  let shadowAudit = null;
  let shadowValidation = null;
  const expectedShadow = bridge.target?.writer2Shadow;
  if (expectedShadow?.enabled) {
    const shadow = createCiiWriter2V14LosslessShadow(targetInput);
    const shadowSha256 = await ciiSha256(shadow.outputBytes, options.cryptoRef);
    if (expectedShadow.shadowSha256 && shadowSha256 !== expectedShadow.shadowSha256) {
      throw new Error('CII_WRITER_2_STALE_V14_TARGET_SHADOW_HASH');
    }
    shadowValidation = assertCiiWriter2V14ShadowIdentity(expectedShadow.audit, shadow.audit);
    shadowAudit = shadow.audit;
    conversionInput = shadow.outputBytes;
  }

  const down = await convertCiiNeutralVersionLossless(conversionInput, 11, {
    fileName: preview?.targetDocument?.fileName || 'target.cii',
    cryptoRef: options.cryptoRef,
  });
  if (!expectedShadow?.enabled && bridge.target?.originalSha256 && down.sourceSha256 !== bridge.target.originalSha256) {
    throw new Error('CII_WRITER_2_STALE_ORIGINAL_V14_TARGET_HASH');
  }
  if (expectedShadow?.enabled && expectedShadow.shadowSha256 && down.sourceSha256 !== expectedShadow.shadowSha256) {
    throw new Error('CII_WRITER_2_V14_TARGET_SHADOW_CONVERTER_SOURCE_HASH_MISMATCH');
  }
  if (bridge.target?.normalizedSha256 && down.targetSha256 !== bridge.target.normalizedSha256) {
    throw new Error('CII_WRITER_2_STALE_NORMALIZED_V11_TARGET_HASH');
  }
  const up = await convertCiiNeutralVersionLossless(down.outputBytes, 14, {
    fileName: preview?.targetDocument?.fileName || 'target.cii',
    cryptoRef: options.cryptoRef,
  });
  if (bridge.target?.baselineCanonicalSha256 && up.targetSha256 !== bridge.target.baselineCanonicalSha256) {
    throw new Error('CII_VERSION_BRIDGE_BASELINE_CANONICAL_SHA_MISMATCH');
  }
  return Object.freeze({
    bytes: down.outputBytes,
    originalBytes: targetInput,
    audit: frozenAudit(down.audit),
    baselineCanonicalBytes: up.outputBytes,
    baselineCanonicalAudit: frozenAudit(up.audit),
    baselineExactRoundTrip: ciiBytesEqual(conversionInput, up.outputBytes),
    shadowAudit,
    shadowValidation,
  });
}

export async function applyCiiWorkspaceTargetWriter2WithVersionBridge(preview, targetInput, options = {}) {
  const bridge = preview?.versionBridge;
  if (!bridge) throw new Error('CII_VERSION_BRIDGE_PREVIEW_REQUIRED');
  const mixed = await applyCiiSourceSetMixedNodeNameWithVersionBridge(preview, targetInput, options);
  if (mixed) return mixed;
  const normalized = await normalizeCurrentTarget(preview, targetInput, options);
  const v11Result = await applyCiiWorkspaceTargetWriter2(preview, normalized.bytes, options);
  if (Number(bridge.target?.originalVersion) === 11) {
    return Object.freeze({
      ...v11Result,
      versionBridgeValidation: Object.freeze({
        schema: 'CIIWorkspaceWriterVersionBridgeValidation.v2',
        status: 'PASS',
        path: 'DIRECT_V11',
      }),
    });
  }

  if (typeof v11Result.byteString !== 'string') throw new Error('CII_VERSION_BRIDGE_V11_POSTIMAGE_BYTES_REQUIRED');
  const v11PostimageBytes = ciiByteStringToBytes(v11Result.byteString);
  const upgraded = await convertCiiNeutralVersionLossless(v11PostimageBytes, 14, {
    fileName: v11Result.fileName,
    cryptoRef: options.cryptoRef,
  });
  if (v11Result.modifiedTargetSha256 && upgraded.sourceSha256 !== v11Result.modifiedTargetSha256) {
    throw new Error('CII_VERSION_BRIDGE_V11_POSTIMAGE_SHA_MISMATCH');
  }

  const fixedFieldAuthority = assertCiiV14Writer2FixedFieldAuthority(
    normalized.baselineCanonicalBytes,
    upgraded.outputBytes,
  );
  const canonicalProof = await convertCiiNeutralVersionLossless(upgraded.outputBytes, 11, {
    fileName: v11Result.fileName,
    cryptoRef: options.cryptoRef,
  });
  if (!ciiBytesEqual(v11PostimageBytes, canonicalProof.outputBytes)) {
    throw new Error('CII_VERSION_BRIDGE_CANONICAL_MODIFIED_ROUNDTRIP_NOT_EXACT');
  }

  const projection = projectCanonicalV14WriterDelta(
    normalized.originalBytes,
    normalized.baselineCanonicalBytes,
    upgraded.outputBytes,
  );
  if (bridge.target?.writer2Shadow?.enabled && (projection.changedSections || []).includes('SIF&TEES')) {
    throw new Error('CII_WRITER_2_V14_TARGET_SHADOW_PROTECTED_SIF_DELTA');
  }

  let projectedProofInput = projection.outputBytes;
  let projectedShadowAudit = null;
  let projectedShadowValidation = null;
  if (bridge.target?.writer2Shadow?.enabled) {
    const projectedShadow = createCiiWriter2V14LosslessShadow(projection.outputBytes);
    projectedShadowValidation = assertCiiWriter2V14ShadowIdentity(normalized.shadowAudit, projectedShadow.audit);
    projectedShadowAudit = projectedShadow.audit;
    projectedProofInput = projectedShadow.outputBytes;
  }
  const projectedProof = await convertCiiNeutralVersionLossless(projectedProofInput, 11, {
    fileName: v11Result.fileName,
    cryptoRef: options.cryptoRef,
  });
  if (!ciiBytesEqual(v11PostimageBytes, projectedProof.outputBytes)) {
    throw new Error('CII_VERSION_BRIDGE_PROJECTED_V14_NORMALIZED_POSTIMAGE_MISMATCH');
  }

  const modifiedTargetSha256 = await ciiSha256(projection.outputBytes, options.cryptoRef);
  const outputText = new TextDecoder('utf-8').decode(projection.outputBytes);
  return Object.freeze({
    ...v11Result,
    text: outputText,
    byteString: ciiBytesToByteString(projection.outputBytes),
    byteLength: projection.outputBytes.byteLength,
    sourceTargetSha256: bridge.target.originalSha256 || v11Result.sourceTargetSha256,
    modifiedTargetSha256,
    versionBridgeValidation: Object.freeze({
      schema: 'CIIWorkspaceWriterVersionBridgeValidation.v2',
      status: 'PASS',
      path: bridge.target?.writer2Shadow?.enabled ? 'V14_TARGET_SHADOW_CHANGE_ISOLATED_VIA_V11' : 'V14_CHANGE_ISOLATED_VIA_V11',
      baselineExactRoundTrip: normalized.baselineExactRoundTrip,
      baselineRoundTripAuthority: bridge.target?.writer2Shadow?.enabled ? 'CONVERSION_SHADOW' : 'ORIGINAL_TARGET',
      canonicalModifiedRoundTripExact: true,
      projectedNormalizedPostimageExact: true,
      originalTargetSha256: bridge.target.originalSha256,
      normalizedTargetSha256: bridge.target.normalizedSha256,
      baselineCanonicalSha256: bridge.target.baselineCanonicalSha256,
      v11PostimageSha256: upgraded.sourceSha256,
      modifiedTargetSha256,
      fixedFieldAuthority,
      changedV14Sections: projection.changedSections,
      projectionLedger: projection.ledger,
      untouchedV14SectionCount: projection.untouchedSectionCount,
      downgradeAudit: normalized.audit,
      baselineCanonicalAudit: normalized.baselineCanonicalAudit,
      upgradeAudit: frozenAudit(upgraded.audit),
      canonicalProofAudit: frozenAudit(canonicalProof.audit),
      projectedProofAudit: frozenAudit(projectedProof.audit),
      writer2TargetShadow: bridge.target?.writer2Shadow || null,
      currentTargetShadowValidation: normalized.shadowValidation,
      projectedTargetShadowValidation: projectedShadowValidation,
      projectedTargetShadowAudit: projectedShadowAudit,
      v11WriterValidation: v11Result.validation,
    }),
  });
}

export const _test = Object.freeze({ writer2TargetShadowEnabled });