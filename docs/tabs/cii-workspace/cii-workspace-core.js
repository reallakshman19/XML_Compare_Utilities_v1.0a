import { CII_WORKSPACE_SCHEMAS, deepFreeze } from './cii-workspace-contracts.js';
import { intakeCiiWorkspaceDocument } from './cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from './cii-workspace-topology-adapter.js';
import { qualifyCiiGeometryTransform } from './cii-workspace-geometry.js';
import { qualifyCiiMultiBaseAuthority } from './cii-workspace-multi-base-anchor.js';
import { buildCiiMultiBaseCorrespondence } from './cii-workspace-multi-base-correspondence.js';
import { suggestCiiLandmarks } from './cii-workspace-landmarks.js';
import { suggestCiiBaseAnchorPairs } from './cii-workspace-anchor-suggestions.js';
import { buildCiiAutomaticPathAudit } from './cii-workspace-topology.js';
import { buildCiiPathCandidateAudit } from './cii-workspace-path-candidates.js';
import { applyCiiNodeCustodyGates } from './cii-workspace-node-custody.js';
import { attachCiiComponentCorrespondence } from './cii-workspace-components.js';
import { bindCiiCorrespondenceIdentity } from './cii-workspace-identity.js';
import { buildCiiEngineeringDeltas } from './cii-workspace-engineering-delta.js';
import { augmentCiiEngineeringDeltasWithWriter1BFields } from './cii-workspace-writer1b-deltas.js';
import { augmentCiiEngineeringDeltasWithRestraintPairing } from './cii-workspace-restraint-transfer.js';
import { augmentCiiEngineeringDeltasWithRestraintSlots } from './cii-workspace-restraint-slot-transfer.js';
import { augmentCiiEngineeringDeltasWithWriter1CSifFields } from './cii-workspace-writer1c-sif-deltas.js';
import { buildCiiCompareReviewModel } from './cii-workspace-compare-review.js';
import { createCiiTransferPreview } from './cii-workspace-transfer-plan.js';
import { normalizeCiiWorkspaceReview } from './cii-workspace-review.js';
import { createCiiWorkspaceStageModel } from './cii-workspace-placeholders.js';
import { applyCiiTargetWriter1A, ciiWriter1AReadiness } from './cii-workspace-target-writer.js';
import { applyCiiTargetWriter1B, ciiWriter1BReadiness } from './cii-workspace-target-writer-1b.js';
import { applyCiiTargetWriterComposite, ciiWriterCompositeReadiness } from './cii-workspace-target-writer-composite.js';
import { applyCiiWriter2CompositePlanContract, ciiWriter2CompositeReadiness } from './cii-workspace-writer2-composite-routing.js';
import { applyCiiWriter2CompositeWithHangerDeleteAll } from './cii-workspace-writer2-composite-hanger.js';
import { applyCiiWriter2CompositeWithRestraintDelete } from './cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriterRoundTrip } from './cii-workspace-writer-validation.js';
import { validateCiiWriter1CRoundTrip } from './cii-workspace-writer1c-validation.js';
import { validateCiiWriterCompositeRoundTrip } from './cii-workspace-writer-composite-validation.js';
import { validateCiiWriter2ProductRoundTrip } from './cii-workspace-writer2-product-validation.js';
import { ciiWorkspaceArtifactBundle } from './cii-workspace-export.js';

function nodeIndex(graph) { return new Map((graph.nodes || []).map((node) => [String(node.id), node])); }
function normalizeAnchorPairs(pairs) {
  return deepFreeze((pairs || []).map((pair) => ({
    schema: CII_WORKSPACE_SCHEMAS.anchor,
    sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId),
    status: 'LOCKED', authority: 'USER_LOCKED', locked: true,
  })));
}
function dedupeAnchors(pairs) {
  const seen = new Set(); const rows = [];
  for (const pair of pairs || []) {
    const key = `${pair.sourceNodeId}=>${pair.targetNodeId}`; if (seen.has(key)) continue; seen.add(key); rows.push(pair);
  }
  return deepFreeze(rows);
}
function inputPayload(input, side) {
  return input?.[`${side}Bytes`] ?? input?.[`${side}Text`];
}
async function intakePair(input, options) {
  const sourceDocument = await intakeCiiWorkspaceDocument(inputPayload(input, 'source'), input?.sourceFileName, { side: 'SOURCE', cryptoRef: options.cryptoRef });
  const targetDocument = await intakeCiiWorkspaceDocument(inputPayload(input, 'target'), input?.targetFileName, { side: 'TARGET', cryptoRef: options.cryptoRef });
  return { sourceDocument, targetDocument,
    sourceGraph: adaptCiiDocumentToTopologyGraph(sourceDocument), targetGraph: adaptCiiDocumentToTopologyGraph(targetDocument) };
}
function sourceOdAtNode(graph, nodeId) {
  const values = [...(graph?.adjacency?.get(String(nodeId)) || [])].map((edge) => Number(edge.diameter)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : null;
}
function geometryPairs(sourceGraph, targetGraph, anchors) {
  const source = nodeIndex(sourceGraph); const target = nodeIndex(targetGraph);
  return anchors.flatMap((pair) => {
    const left = source.get(pair.sourceNodeId)?.position; const right = target.get(pair.targetNodeId)?.position;
    return left && right ? [{ source: left, target: right, sourceOdMm: sourceOdAtNode(sourceGraph, pair.sourceNodeId),
      sourceNodeId: pair.sourceNodeId, targetNodeId: pair.targetNodeId }] : [];
  });
}
function writerVersion(options) {
  return ['1A', '1B', '1C', '2'].includes(options?.writerVersion) ? options.writerVersion : '1B';
}
function writerLabel(version) { return `WRITER_${version}`; }
function writer1APlanContract(plan) {
  if (plan?.mutationAuthority === 'BLOCKED') return plan;
  return deepFreeze({ ...plan, mutationAuthority: 'WRITER_1A_CONDITIONAL', policy: deepFreeze({
    geometryProtected: true, nodeNumberProtected: true, topologyProtected: true, odProtected: true, wallProtected: false,
    processDefault: 'WRITER_1A_P1_T1_T2_WHEN_FIXED_FIELD_QUALIFIED', restraintCardinality: 'EQUAL_CARDINALITY_EXISTING_SLOTS_ONLY',
    sifTeeMutation: 'BLOCKED_SEMANTICS_UNQUALIFIED',
  }) });
}
function writer1CPlanContract(plan) {
  if (plan?.mutationAuthority === 'BLOCKED') return plan;
  return deepFreeze({ ...plan, mutationAuthority: 'WRITER_1C_CONDITIONAL', policy: deepFreeze({
    ...(plan?.policy || {}), nodeNameMutation: 'EXISTING_POINTER_STABLE_FIXED_FIELD_ONLY',
    mixedLowerWriterMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE_1A_1B_1C',
    sifTeeMutation: 'V11_ITEM3_ITEM4_EXISTING_BLOCK_EXPLICIT_GE_1_WITH_CODE_CONTEXT',
  }) });
}
function readinessFor(version, plan, targetDocument, targetGraph) {
  if (version === '1A') return ciiWriter1AReadiness(plan);
  if (version === '1B') return ciiWriter1BReadiness(plan);
  if (version === '1C') return ciiWriterCompositeReadiness(plan, targetDocument);
  if (version === '2') return ciiWriter2CompositeReadiness(plan, targetDocument, targetGraph);
  return Object.freeze({ schema: 'CIIWorkspaceWriterReadiness.v1', status: 'BLOCKED', ready: false,
    mutationCount: 0, blockers: Object.freeze([`WRITER_VERSION_UNSUPPORTED:${version}`]) });
}
function buildAudit(sourceDocument, targetDocument, anchors, geometry, multiBaseAuthority, multiBaseCorrespondence,
  pathAudit, correspondence, review, engineeringDeltas, compareReview, transferPlan, landmarks, writerReadiness, version) {
  const label = writerLabel(version);
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.audit, direction: 'SOURCE_TO_TARGET', writerVersion: version,
    source: Object.freeze({ fileName: sourceDocument.fileName, contentSha256: sourceDocument.contentSha256, summary: sourceDocument.summary }),
    target: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256, summary: targetDocument.summary }),
    lockedAnchors: anchors, landmarkSuggestions: landmarks, geometry, multiBaseAuthority, multiBaseCorrespondence, automaticPathAudit: pathAudit,
    correspondence, review, engineeringDeltas, compareReview, transferPreview: transferPlan, writerReadiness,
    mutationAuthority: Object.freeze({ stage06: writerReadiness.ready ? `${label}_READY` : `${label}_BLOCKED`,
      modifiedTargetCiiExport: writerReadiness.ready ? `${label}_CONDITIONAL` : 'BLOCKED' }),
  });
}
function inspectionSummary(document, graph) {
  const componentCounts = {};
  for (const edge of graph?.edges || []) componentCounts[edge.componentKind] = (componentCounts[edge.componentKind] || 0) + 1;
  return deepFreeze({ ...document.summary,
    terminalCount: (graph?.nodes || []).filter((node) => Number(node.degree) === 1).length,
    branchCount: (graph?.nodes || []).filter((node) => Number(node.degree) >= 3).length, componentCounts });
}
function inspectionSide(document, graph, options) {
  return Object.freeze({ fileName: document.fileName, contentSha256: document.contentSha256,
    summary: inspectionSummary(document, graph), landmarks: suggestCiiLandmarks(graph, options) });
}
function normalizedLoopMethod(value) {
  const method = String(value || '').trim().toUpperCase();
  if (['A', 'METHOD_A', 'METHOD_A_SPATIAL'].includes(method)) return 'METHOD_A_SPATIAL';
  if (['B', 'METHOD_B', 'METHOD_B_NETWORK'].includes(method)) return 'METHOD_B_NETWORK';
  return method;
}
function loopAnchorPairs(loop) {
  if (Array.isArray(loop?.anchorPairs) && loop.anchorPairs.length) return normalizeAnchorPairs(loop.anchorPairs);
  if (loop?.sourceNodeId != null && loop?.targetNodeId != null) return normalizeAnchorPairs([loop]);
  return deepFreeze([]);
}
function acceptedAnchors(input) {
  if (!Array.isArray(input?.baseLoops)) return normalizeAnchorPairs(input?.anchorPairs);
  return dedupeAnchors(input.baseLoops.flatMap((loop) => loopAnchorPairs(loop)));
}
function invalidExplicitAuthority(blockers) {
  return deepFreeze({ schema: CII_WORKSPACE_SCHEMAS.multiBaseAuthority, status: 'BLOCKED', combination: 'OR_WITH_CONFLICT_VETO',
    authority: 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED', inputMode: 'EXPLICIT_BASE_LOOPS', inputBlockers: deepFreeze(blockers),
    readyLoopCount: 0, loopCount: 0, methodAReadyCount: 0, methodBReadyCount: 0,
    loops: deepFreeze([]), conflicts: deepFreeze([]), reason: 'MULTI_BASE_INPUT_INVALID' });
}
function explicitMultiBaseAuthority(input, sourceGraph, targetGraph, options) {
  const methodABases = []; const methodBAnchors = []; const blockers = [];
  for (let index = 0; index < input.baseLoops.length; index += 1) {
    const loop = input.baseLoops[index]; const method = normalizedLoopMethod(loop?.method); const anchors = loopAnchorPairs(loop);
    const baseId = String(loop?.baseId || `BASE_${index + 1}`);
    if (method === 'METHOD_A_SPATIAL') {
      if (!anchors.length) { blockers.push(`METHOD_A_BASE_ANCHORS_REQUIRED:${baseId}`); continue; }
      methodABases.push({ baseId, anchorPairs: geometryPairs(sourceGraph, targetGraph, anchors), probePoints: loop?.probePoints || [] });
    } else if (method === 'METHOD_B_NETWORK') {
      if (anchors.length !== 1) { blockers.push(`METHOD_B_SINGLE_ANCHOR_REQUIRED:${baseId}`); continue; }
      methodBAnchors.push({ baseId, sourceNodeId: anchors[0].sourceNodeId, targetNodeId: anchors[0].targetNodeId });
    } else blockers.push(`UNSUPPORTED_MULTI_BASE_METHOD:${baseId}:${method || 'EMPTY'}`);
  }
  if (blockers.length) return invalidExplicitAuthority(blockers);
  const authority = qualifyCiiMultiBaseAuthority({ sourceGraph, targetGraph, methodABases, methodBAnchors }, options);
  return deepFreeze({ ...authority, inputMode: 'EXPLICIT_BASE_LOOPS', inputBlockers: deepFreeze([]) });
}
function legacyMultiBaseAuthority(anchors, sourceGraph, targetGraph, options) {
  if (!anchors.length) return deepFreeze({ schema: CII_WORKSPACE_SCHEMAS.multiBaseAuthority, status: 'UNAVAILABLE', combination: 'OR_WITH_CONFLICT_VETO',
    authority: 'USER_LOCKED_LEGACY', inputMode: 'LEGACY_ANCHOR_PAIRS', readyLoopCount: 0, loopCount: 0,
    methodAReadyCount: 0, methodBReadyCount: 0, loops: deepFreeze([]), conflicts: deepFreeze([]), reason: 'LOCKED_ANCHOR_PAIR_REQUIRED' });
  const geometry = qualifyCiiGeometryTransform(geometryPairs(sourceGraph, targetGraph, anchors), options);
  const loop = deepFreeze({ loopId: 'LEGACY_LOCKED_BASE_1', method: 'USER_LOCKED_LEGACY', combination: 'INDEPENDENT_OR_LOOP', status: 'READY',
    confidence: 'USER_LOCKED', weight: null, geometry, anchorPairs: deepFreeze(anchors.map((pair) => ({ sourceNodeId: pair.sourceNodeId, targetNodeId: pair.targetNodeId }))) });
  return deepFreeze({ schema: CII_WORKSPACE_SCHEMAS.multiBaseAuthority, status: 'READY', combination: 'OR_WITH_CONFLICT_VETO',
    authority: 'USER_LOCKED_LEGACY', inputMode: 'LEGACY_ANCHOR_PAIRS', readyLoopCount: 1, loopCount: 1,
    methodAReadyCount: 0, methodBReadyCount: 0, loops: deepFreeze([loop]), conflicts: deepFreeze([]), reason: 'LEGACY_LOCKED_BASE_READY' });
}
function workspaceMultiBaseAuthority(input, anchors, sourceGraph, targetGraph, options) {
  return Array.isArray(input?.baseLoops)
    ? explicitMultiBaseAuthority(input, sourceGraph, targetGraph, options)
    : legacyMultiBaseAuthority(anchors, sourceGraph, targetGraph, options);
}
function compatibilityGeometry(multiBaseAuthority, multiBaseCorrespondence) {
  const contributing = new Set(multiBaseCorrespondence?.contributingLoopIds || []);
  const loops = (multiBaseAuthority?.loops || []).filter((loop) => contributing.has(String(loop.loopId)));
  if (loops.length === 1 && loops[0].method === 'METHOD_A_SPATIAL') return loops[0].geometry;
  if (loops.length === 1 && loops[0].method === 'USER_LOCKED_LEGACY') return loops[0].geometry;
  const methodA = loops.filter((loop) => loop.method === 'METHOD_A_SPATIAL');
  if (methodA.length) return deepFreeze({ status: 'MULTI_BASE', mode: 'INDEPENDENT_LOCAL_TRANSFORMS', registeredWeight: 0,
    readyMethodALoopCount: methodA.length, contributingLoopCount: loops.length,
    reason: 'NO_SINGLE_GLOBAL_TRANSFORM_ACROSS_INDEPENDENT_BASES' });
  return deepFreeze({ status: 'UNAVAILABLE', mode: 'NO_GLOBAL_SPATIAL_REGISTRATION', registeredWeight: 0,
    reason: loops.length ? 'CORRESPONDENCE_HAS_NO_SINGLE_METHOD_A_TRANSFORM' : 'NO_CONTRIBUTING_BASE_LOOP' });
}

export async function inspectCiiWorkspaceModels(input, options = {}) {
  const pair = await intakePair(input, options);
  return deepFreeze({ schema: CII_WORKSPACE_SCHEMAS.inspection,
    source: inspectionSide(pair.sourceDocument, pair.sourceGraph, options), target: inspectionSide(pair.targetDocument, pair.targetGraph, options),
    baseAnchorSuggestions: suggestCiiBaseAnchorPairs(pair.sourceGraph, pair.targetGraph, options) });
}

export async function createCiiWorkspacePreview(input, options = {}) {
  const { sourceDocument, targetDocument, sourceGraph, targetGraph } = await intakePair(input, options);
  const version = writerVersion(options); const anchors = acceptedAnchors(input);
  const landmarks = deepFreeze({ source: suggestCiiLandmarks(sourceGraph, options), target: suggestCiiLandmarks(targetGraph, options) });
  const multiBaseAuthority = workspaceMultiBaseAuthority(input, anchors, sourceGraph, targetGraph, options);
  const multiBaseCorrespondence = buildCiiMultiBaseCorrespondence(sourceGraph, targetGraph, multiBaseAuthority, options);
  const geometry = compatibilityGeometry(multiBaseAuthority, multiBaseCorrespondence);
  const pathAudit = deepFreeze({ structural: buildCiiAutomaticPathAudit(sourceGraph, targetGraph, options),
    candidates: buildCiiPathCandidateAudit(sourceGraph, targetGraph, options) });
  const nodeGatedCorrespondence = applyCiiNodeCustodyGates(multiBaseCorrespondence, sourceGraph);
  const componentCorrespondence = attachCiiComponentCorrespondence(nodeGatedCorrespondence, sourceGraph, targetGraph);
  const correspondence = bindCiiCorrespondenceIdentity(componentCorrespondence, sourceDocument, targetDocument, anchors);
  const review = normalizeCiiWorkspaceReview(input?.review, sourceDocument, targetDocument, anchors, correspondence);
  const baseDeltas = buildCiiEngineeringDeltas(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, { ...options, geometryTransform: geometry });
  let engineeringDeltas;
  if (version === '2') {
    engineeringDeltas = augmentCiiEngineeringDeltasWithRestraintSlots(
      baseDeltas, sourceDocument, targetDocument, correspondence,
      sourceDocument.physicalFile.text, targetDocument.physicalFile.text, options,
    );
  } else {
    const extendedWriter = version !== '1A';
    const fieldDeltas = extendedWriter ? augmentCiiEngineeringDeltasWithWriter1BFields(baseDeltas, sourceGraph, targetGraph, correspondence, options) : baseDeltas;
    const pairedDeltas = augmentCiiEngineeringDeltasWithRestraintPairing(fieldDeltas, sourceDocument, targetDocument, correspondence, options);
    const slotDeltas = extendedWriter
      ? augmentCiiEngineeringDeltasWithRestraintSlots(pairedDeltas, sourceDocument, targetDocument, correspondence,
        sourceDocument.physicalFile.text, targetDocument.physicalFile.text, options)
      : pairedDeltas;
    engineeringDeltas = version === '1C'
      ? augmentCiiEngineeringDeltasWithWriter1CSifFields(slotDeltas, sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence)
      : slotDeltas;
  }
  const compareReview = buildCiiCompareReviewModel(sourceDocument, targetDocument, correspondence, review, engineeringDeltas);
  const rawTransferPlan = createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, review, engineeringDeltas,
    { ...options, writerVersion: version });
  const transferPlan = version === '1A' ? writer1APlanContract(rawTransferPlan)
    : version === '1C' ? writer1CPlanContract(rawTransferPlan)
      : version === '2' ? applyCiiWriter2CompositePlanContract(rawTransferPlan) : rawTransferPlan;
  const writerReadiness = readinessFor(version, transferPlan, targetDocument, targetGraph);
  const audit = buildAudit(sourceDocument, targetDocument, anchors, geometry, multiBaseAuthority, multiBaseCorrespondence, pathAudit, correspondence, review, engineeringDeltas,
    compareReview, transferPlan, landmarks, writerReadiness, version);
  const result = { writerVersion: version, stages: createCiiWorkspaceStageModel(writerReadiness), sourceDocument, targetDocument, landmarks,
    geometry, multiBaseAuthority, multiBaseCorrespondence, correspondence, review, engineeringDeltas, compareReview, transferPlan, writerReadiness, audit };
  result.artifacts = ciiWorkspaceArtifactBundle(result);
  return deepFreeze(result);
}

async function currentTargetFor(preview, targetInput, options, label) {
  if (!preview?.targetDocument || !preview?.transferPlan || !preview?.correspondence) throw new Error(`CII_${label}_PREVIEW_REQUIRED`);
  const currentTarget = await intakeCiiWorkspaceDocument(targetInput, preview.targetDocument.fileName, { side: 'TARGET', cryptoRef: options.cryptoRef });
  if (currentTarget.contentSha256 !== preview.targetDocument.contentSha256) throw new Error(`CII_${label}_STALE_TARGET_HASH`);
  return currentTarget;
}
function writer2HasRestraintApply(transferPlan) {
  return (transferPlan?.operations || []).some((operation) => operation?.scopeDecision === 'APPLY' && operation?.family === 'RESTRAINT');
}
function applyLowLevelWriter(version, currentTarget, targetGraph, preview) {
  const targetText = currentTarget.physicalFile.text;
  if (version === '1A') return applyCiiTargetWriter1A({ targetText, targetGraph, correspondence: preview.correspondence, transferPlan: preview.transferPlan });
  if (version === '1B') return applyCiiTargetWriter1B({ targetText, targetGraph, correspondence: preview.correspondence, transferPlan: preview.transferPlan });
  if (version === '1C') return applyCiiTargetWriterComposite({ targetDocument: currentTarget, targetGraph, correspondence: preview.correspondence, transferPlan: preview.transferPlan });
  if (version === '2' && writer2HasRestraintApply(preview.transferPlan)) {
    return applyCiiWriter2CompositeWithRestraintDelete({ targetDocument: currentTarget, targetGraph, transferPlan: preview.transferPlan });
  }
  if (version === '2') {
    return applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument: currentTarget, targetGraph, transferPlan: preview.transferPlan });
  }
  throw new Error(`CII_WRITER_VERSION_UNSUPPORTED:${version}`);
}
async function validateCompositeComponents(currentTarget, targetGraph, writerResult, options, fileName) {
  const validations = {};
  if (writerResult?.components?.lower) {
    const component = writerResult.components.lower;
    const modified = await intakeCiiWorkspaceDocument(component.result.text, fileName, { side: 'TARGET', cryptoRef: options.cryptoRef });
    validations.lower = validateCiiWriterRoundTrip(currentTarget, modified, targetGraph, component.result, component.transferPlan, 'WRITER_1B_COMPONENT');
  }
  if (writerResult?.components?.writer1C) {
    const component = writerResult.components.writer1C;
    const modified = await intakeCiiWorkspaceDocument(component.result.bytes, fileName, { side: 'TARGET', cryptoRef: options.cryptoRef });
    validations.writer1C = validateCiiWriter1CRoundTrip(currentTarget, modified, component.transferPlan, component.result);
  }
  return Object.freeze(validations);
}
async function applyWriter(preview, targetInput, options, version) {
  const label = writerLabel(version);
  if (preview?.writerVersion && preview.writerVersion !== version) throw new Error(`CII_${label}_PREVIEW_WRITER_VERSION_MISMATCH`);
  const currentTarget = await currentTargetFor(preview, targetInput, options, label);
  const targetGraph = adaptCiiDocumentToTopologyGraph(currentTarget);
  const writerResult = applyLowLevelWriter(version, currentTarget, targetGraph, preview);
  const modifiedInput = ['1C', '2'].includes(version) ? writerResult.bytes : writerResult.text;
  const modifiedTarget = await intakeCiiWorkspaceDocument(modifiedInput, preview.targetDocument.fileName, { side: 'TARGET', cryptoRef: options.cryptoRef });
  let validation;
  if (version === '1C') {
    const componentValidations = await validateCompositeComponents(currentTarget, targetGraph, writerResult, options, preview.targetDocument.fileName);
    validation = validateCiiWriterCompositeRoundTrip(currentTarget, modifiedTarget, writerResult, componentValidations);
  } else if (version === '2') {
    validation = validateCiiWriter2ProductRoundTrip(currentTarget, modifiedTarget, targetGraph, preview.transferPlan, writerResult);
  } else {
    validation = validateCiiWriterRoundTrip(currentTarget, modifiedTarget, targetGraph, writerResult, preview.transferPlan, label);
  }
  return deepFreeze({ schema: 'CIIWorkspaceTargetApplyResult.v1', status: 'PASS', writer: label,
    fileName: `Modified_${preview.targetDocument.fileName}`, text: writerResult.text,
    byteString: modifiedTarget.physicalFile.originalByteString, byteLength: modifiedTarget.byteLength,
    sourceTargetSha256: currentTarget.contentSha256, modifiedTargetSha256: modifiedTarget.contentSha256,
    mutationCount: writerResult.mutationCount, mutations: writerResult.mutations, validation });
}

export async function applyCiiWorkspaceTargetWriter1A(preview, targetInput, options = {}) {
  return applyWriter(preview, targetInput, options, '1A');
}
export async function applyCiiWorkspaceTargetWriter1B(preview, targetInput, options = {}) {
  return applyWriter(preview, targetInput, options, '1B');
}
export async function applyCiiWorkspaceTargetWriter1C(preview, targetInput, options = {}) {
  return applyWriter(preview, targetInput, options, '1C');
}
export async function applyCiiWorkspaceTargetWriter2(preview, targetInput, options = {}) {
  return applyWriter(preview, targetInput, options, '2');
}
