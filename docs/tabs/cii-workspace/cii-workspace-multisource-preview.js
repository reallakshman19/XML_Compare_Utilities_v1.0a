import { deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiWorkspaceArtifactBundle } from './cii-workspace-export.js';
import { createCiiWorkspaceStageModel } from './cii-workspace-placeholders.js';
import { intakeCiiWorkspaceSourceSet } from './cii-workspace-source-set.js';
import { ciiWriter2SourceSetNodeNameReadiness } from './cii-workspace-multisource-writer2-readiness.js';
import { createCiiWorkspacePreviewWithVersionBridge } from './cii-workspace-writer-version-bridge.js';
import {
  ciiNodeNameMutationOperation,
  ciiWriter1CNodeNameReplacementOperation,
} from './cii-workspace-multisource-bm001-correspondence.js';
import {
  assertCiiMsBm001Authority,
  ciiMsBm001AliasKey,
  ciiMsBm001AliasSet,
  ciiMsBm001GroupedKey,
} from './cii-workspace-multisource-nodename-authority.js';
import { ciiSha256 } from './cii-workspace-v11-v14-converter.js';

export const CII_MS_PREVIEW_SCHEMA = 'CIIWorkspaceMultiSourcePreview.v1';
export const CII_MS_CORRESPONDENCE_SCHEMA = 'CIIWorkspaceMultiSourceCorrespondence.v1';

function text(value) { return String(value ?? '').trim(); }
function sourceRows(input) {
  const rows = Array.isArray(input?.sources) ? input.sources : [];
  if (rows.length < 2) throw new Error('CII_MS_PREVIEW_TWO_OR_MORE_SOURCES_REQUIRED');
  const ids = rows.map((row, index) => text(row?.sourceId || `S${index + 1}`));
  if (ids.some((id) => !id)) throw new Error('CII_MS_PREVIEW_SOURCE_ID_REQUIRED');
  if (new Set(ids).size !== ids.length) throw new Error('CII_MS_PREVIEW_DUPLICATE_SOURCE_ID');
  return rows;
}
function sourceId(source, index) { return text(source?.sourceId || `S${index + 1}`); }
function sourceFileName(source, index) { return text(source?.fileName || `${sourceId(source, index)}.CII`); }
function sourceBytes(source) { return source?.bytes ?? source?.text; }
function targetBytes(input) { return input?.targetBytes ?? input?.targetText; }
function prefixId(kind, sourceIdValue, id) { return stableId(kind, sourceIdValue, id); }
function memberReview(input, sourceIdValue) {
  return input?.reviewBySource?.[sourceIdValue] || input?.reviews?.[sourceIdValue] || undefined;
}
function memberBaseLoops(input, source, sourceIdValue) {
  return source?.baseLoops || input?.baseLoopsBySource?.[sourceIdValue] || undefined;
}
function memberAnchorPairs(input, source, sourceIdValue) {
  return source?.anchorPairs || input?.anchorPairsBySource?.[sourceIdValue] || undefined;
}
function assertSameTarget(memberPreviews) {
  const keys = new Set(memberPreviews.map(({ preview }) => [
    preview?.targetDocument?.contentSha256,
    preview?.versionBridge?.target?.originalSha256,
    preview?.versionBridge?.target?.normalizedSha256,
    preview?.versionBridge?.target?.baselineCanonicalSha256,
  ].join('|')));
  if (keys.size !== 1 || [...keys][0].includes('undefined')) throw new Error('CII_MS_PREVIEW_TARGET_CUSTODY_MISMATCH');
}
function assertSameMemberCorrespondence(sourceIdValue, preview, replacementPreview) {
  const left = text(preview?.correspondence?.correspondenceIdentity);
  const right = text(replacementPreview?.correspondence?.correspondenceIdentity);
  if (!left || left !== right) throw new Error(`CII_MS_MIXED_WRITER_CORRESPONDENCE_MISMATCH:${sourceIdValue}`);
  if (preview?.targetDocument?.contentSha256 !== replacementPreview?.targetDocument?.contentSha256) {
    throw new Error(`CII_MS_MIXED_WRITER_TARGET_MISMATCH:${sourceIdValue}`);
  }
}
function prefixedRow(row, sourceIdValue, memberCorrespondenceIdentity) {
  const originalId = text(row?.correspondenceId);
  return deepFreeze({
    ...row,
    sourceId: sourceIdValue,
    memberCorrespondenceId: originalId,
    memberCorrespondenceIdentity,
    correspondenceId: prefixId('ms-corr', sourceIdValue, originalId),
  });
}
function prefixedCorrespondence(sourceIdValue, preview) {
  const identity = text(preview?.correspondence?.correspondenceIdentity);
  return deepFreeze({
    sourceId: sourceIdValue,
    memberStatus: preview?.correspondence?.status || 'UNRESOLVED',
    memberCorrespondenceIdentity: identity,
    memberBlockers: deepFreeze([...(preview?.correspondence?.blockers || [])]),
    nodeRows: deepFreeze((preview?.correspondence?.nodeRows || []).map((row) => prefixedRow(row, sourceIdValue, identity))),
    elementRows: deepFreeze((preview?.correspondence?.elementRows || []).map((row) => prefixedRow(row, sourceIdValue, identity))),
    componentRows: deepFreeze((preview?.correspondence?.componentRows || []).map((row) => prefixedRow(row, sourceIdValue, identity))),
  });
}
function sourceIdentity(row) {
  return text(row?.sourceNodeId || row?.sourceComponentId || row?.sourceElementId || (row?.sourceElementIds || []).join('|'));
}
function targetIdentity(row) {
  return text(row?.targetNodeId || row?.targetComponentId || row?.targetElementId || (row?.targetElementIds || []).join('|'));
}
function crossSourceCorrespondenceConflicts(members) {
  const sourceClaims = new Map(); const conflicts = [];
  for (const member of members) for (const row of [...member.nodeRows, ...member.elementRows, ...member.componentRows]) {
    if (['UNRESOLVED', 'CONFLICT'].includes(row?.status)) continue;
    const source = sourceIdentity(row); const target = targetIdentity(row); if (!source || !target) continue;
    const key = `${member.sourceId}|${row.kind}|${source}`;
    const previous = sourceClaims.get(key);
    if (previous && previous.target !== target) {
      conflicts.push(deepFreeze({
        class: 'SOURCE_IDENTITY_TARGET_CONFLICT', sourceId: member.sourceId, kind: row.kind, sourceIdentity: source,
        targetIdentities: deepFreeze([previous.target, target].sort()),
        correspondenceIds: deepFreeze([previous.correspondenceId, row.correspondenceId].sort()),
      }));
    } else sourceClaims.set(key, { target, correspondenceId: row.correspondenceId });
  }
  return conflicts;
}
function combinedCorrespondence(sourceSetSha256, members) {
  const conflicts = crossSourceCorrespondenceConflicts(members);
  const memberBlocked = members.filter((item) => !['READY', 'LOCKED'].includes(item.memberStatus));
  const blockers = [
    ...memberBlocked.flatMap((item) => item.memberBlockers.map((blocker) => `${item.sourceId}:${blocker}`)),
    ...(conflicts.length ? ['MULTISOURCE_TARGET_CUSTODY_CONFLICT'] : []),
  ];
  const status = conflicts.length ? 'CONFLICT' : (memberBlocked.length ? 'UNRESOLVED' : 'READY');
  const nodeRows = members.flatMap((item) => item.nodeRows);
  const elementRows = members.flatMap((item) => item.elementRows);
  const componentRows = members.flatMap((item) => item.componentRows);
  return deepFreeze({
    schema: CII_MS_CORRESPONDENCE_SCHEMA,
    status,
    authority: 'PER_SOURCE_EXISTING_CORRESPONDENCE_PLUS_TARGET_CONFLICT_VETO',
    sourceSetSha256,
    memberCount: members.length,
    members: deepFreeze(members),
    blockers: deepFreeze([...new Set(blockers)]),
    conflicts: deepFreeze(conflicts),
    targetCustodyConflicts: deepFreeze(conflicts),
    nodeRows: deepFreeze(nodeRows), elementRows: deepFreeze(elementRows), componentRows: deepFreeze(componentRows),
    correspondenceIdentity: stableId('ms-correspondence-v1', sourceSetSha256,
      members.map((item) => `${item.sourceId}:${item.memberCorrespondenceIdentity}`).sort().join('|')),
  });
}
function prefixReview(preview, sourceIdValue) {
  const review = preview?.review || {};
  const mapIds = (rows) => (rows || []).map((id) => prefixId('ms-corr', sourceIdValue, id));
  return deepFreeze({
    reviewedCorrespondenceIds: deepFreeze(mapIds(review.reviewedCorrespondenceIds)),
    lockedCorrespondenceIds: deepFreeze(mapIds(review.lockedCorrespondenceIds)),
    rejectedCorrespondenceIds: deepFreeze(mapIds(review.rejectedCorrespondenceIds)),
  });
}
function combinedReview(memberPreviews) {
  return deepFreeze({
    reviewedCorrespondenceIds: deepFreeze(memberPreviews.flatMap(({ sourceId: id, preview }) => prefixReview(preview, id).reviewedCorrespondenceIds)),
    lockedCorrespondenceIds: deepFreeze(memberPreviews.flatMap(({ sourceId: id, preview }) => prefixReview(preview, id).lockedCorrespondenceIds)),
    rejectedCorrespondenceIds: deepFreeze(memberPreviews.flatMap(({ sourceId: id, preview }) => prefixReview(preview, id).rejectedCorrespondenceIds)),
  });
}
function prefixDelta(delta, sourceIdValue) {
  const originalCorrelation = text(delta?.correspondenceId);
  const originalDeltaId = text(delta?.deltaId);
  return deepFreeze({
    ...delta,
    sourceId: sourceIdValue,
    memberCorrespondenceId: originalCorrelation,
    memberEngineeringDeltaId: originalDeltaId,
    correspondenceId: prefixId('ms-corr', sourceIdValue, originalCorrelation),
    deltaId: prefixId('ms-delta', sourceIdValue, originalDeltaId),
  });
}
function combinedEngineeringDeltas(memberPreviews) {
  const rows = memberPreviews.flatMap(({ sourceId: id, preview }) => (preview?.engineeringDeltas?.rows || []).map((row) => prefixDelta(row, id)));
  const changedRows = rows.filter((row) => row.changed);
  const categories = {};
  for (const row of changedRows) categories[row.category] = (categories[row.category] || 0) + 1;
  return deepFreeze({
    schema: 'CIIWorkspaceEngineeringDeltaSet.v1',
    authority: 'PER_SOURCE_ENGINEERING_DELTA_AGGREGATION',
    rows: deepFreeze(rows), changedRows: deepFreeze(changedRows), limitations: deepFreeze([]),
    summary: deepFreeze({ engineeringChangeCount: changedRows.length, changeFamilyCounts: deepFreeze(categories) }),
  });
}
function explicitAcceptanceBinding(input, sourceIdValue, operation) {
  const resolver = input?.acceptanceIdentityResolver;
  if (typeof resolver === 'function') return resolver({ sourceId: sourceIdValue, operation });
  const map = input?.acceptanceIdentityByOperation || {};
  return map[`${sourceIdValue}:${operation.operationId}`] || map[operation.operationId] || null;
}
function normalizedAcceptanceBinding(value) {
  if (!value) return null;
  const sourceNames = Array.isArray(value.sourceNames) ? value.sourceNames.map(text).filter(Boolean)
    : text(value.sourceName).split(',').map((item) => item.trim()).filter(Boolean);
  const targetName = text(value.targetName);
  if (!sourceNames.length || !targetName) return null;
  return deepFreeze({ sourceNames: deepFreeze(sourceNames), targetName, groupedKey: ciiMsBm001GroupedKey(sourceNames, targetName) });
}
function bm001SourceAliasCandidates(sourceName) {
  const value = text(sourceName);
  if (!value) return [];
  return value.startsWith('/') ? [value, value.slice(1)] : [value, `/${value}`];
}
function inferredAcceptanceBinding(operation, aliasSet) {
  const sourceName = text(operation?.sourceEvidence?.value ?? operation?.proposed);
  const targetName = text(operation?.targetEvidence?.value ?? operation?.before);
  const matched = bm001SourceAliasCandidates(sourceName)
    .some((candidate) => aliasSet.has(ciiMsBm001AliasKey(candidate, targetName)));
  if (!sourceName || !targetName || !matched) return null;
  return normalizedAcceptanceBinding({ sourceNames: [sourceName], targetName });
}
function prefixOperation(operation, sourceIdValue, member, input, aliasSet) {
  const originalId = text(operation?.operationId);
  const originalCorrelation = text(operation?.matchAuthority?.correspondenceId);
  const originalDeltaId = text(operation?.engineeringDeltaId);
  const explicit = normalizedAcceptanceBinding(explicitAcceptanceBinding(input, sourceIdValue, operation));
  const acceptance = explicit || inferredAcceptanceBinding(operation, aliasSet);
  return deepFreeze({
    ...operation,
    operationId: prefixId('ms-op', sourceIdValue, originalId),
    engineeringDeltaId: originalDeltaId ? prefixId('ms-delta', sourceIdValue, originalDeltaId) : originalDeltaId,
    sourceId: sourceIdValue,
    sourceMember: deepFreeze({
      sourceId: sourceIdValue, fileName: member.fileName,
      originalSha256: member.originalSha256, normalizedSha256: member.normalizedSha256,
    }),
    matchAuthority: deepFreeze({
      ...(operation?.matchAuthority || {}),
      correspondenceId: prefixId('ms-corr', sourceIdValue, originalCorrelation),
      memberCorrespondenceId: originalCorrelation,
      sourceId: sourceIdValue,
    }),
    bm001Acceptance: acceptance ? deepFreeze({
      benchmark: 'BM-001', status: 'BOUND', ...acceptance,
      sourceSetSha256: member.sourceSetSha256 || null,
      memberOperationId: originalId,
      memberEngineeringDeltaId: originalDeltaId,
    }) : null,
  });
}
function memberMixedOperations(member) {
  const writer2 = member?.preview?.transferPlan?.operations || [];
  const replacements = new Map((member?.replacementPreview?.transferPlan?.operations || [])
    .filter(ciiWriter1CNodeNameReplacementOperation)
    .map((operation) => [text(operation.operationId), operation]));
  return writer2.map((operation) => replacements.get(text(operation?.operationId)) || operation);
}
function targetMutationConflicts(operations) {
  const byTarget = new Map(); const conflicts = [];
  for (const operation of operations) {
    if (!ciiNodeNameMutationOperation(operation)) continue;
    const target = text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId || operation?.matchAuthority?.correspondenceId);
    if (!target) continue;
    const proposal = JSON.stringify(operation?.proposed ?? operation?.sourceEvidence?.value ?? null);
    if (!byTarget.has(target)) byTarget.set(target, []);
    byTarget.get(target).push({ operation, proposal });
  }
  for (const [target, rows] of byTarget) {
    const proposals = [...new Set(rows.map((row) => row.proposal))];
    if (proposals.length <= 1) continue;
    conflicts.push(deepFreeze({
      class: 'TARGET_NODENAME_MUTATION_CONFLICT', targetIdentity: target,
      operationIds: deepFreeze(rows.map((row) => row.operation.operationId).sort()),
      sourceIds: deepFreeze([...new Set(rows.map((row) => row.operation.sourceId))].sort()),
    }));
  }
  return conflicts;
}
function combinedTransferPlan(memberPreviews, sourceSet, targetDocument, targetAuthority, input, aliasSet, correspondence) {
  const memberById = new Map(sourceSet.members.map((member) => [member.sourceId, { ...member, sourceSetSha256: sourceSet.sourceSetSha256 }]));
  const operations = memberPreviews.flatMap((member) => memberMixedOperations(member)
    .map((operation) => prefixOperation(operation, member.sourceId, memberById.get(member.sourceId), input, aliasSet)));
  const conflicts = targetMutationConflicts(operations);
  const preservedBlockers = memberPreviews.flatMap(({ sourceId: id, preview }) => (preview?.transferPlan?.blockers || [])
    .filter((blocker) => !['NO_WRITER_2_COMPOSITE_TRANSFERABLE_OPERATIONS', 'NO_WRITER_2_NODENAME_TRANSFERABLE_OPERATIONS', 'NO_TRANSFERABLE_PREVIEW_OPERATIONS'].includes(blocker))
    .map((blocker) => `${id}:${blocker}`));
  if (correspondence.status !== 'READY') preservedBlockers.push('MULTISOURCE_CORRESPONDENCE_NOT_READY');
  if (conflicts.length) preservedBlockers.push('MULTISOURCE_TARGET_MUTATION_CONFLICT');
  const blockers = [...new Set(preservedBlockers)];
  const byAction = {};
  for (const operation of operations) byAction[operation.action || 'UNKNOWN'] = (byAction[operation.action || 'UNKNOWN'] || 0) + 1;
  const replacementCount = operations.filter(ciiWriter1CNodeNameReplacementOperation).length;
  return deepFreeze({
    schema: 'CIIWorkspaceTransferPlan.v1', direction: 'SOURCE_TO_TARGET', inputAuthority: 'MULTISOURCE_ENGINEERING_DELTA_SET',
    mutationAuthority: blockers.length ? 'BLOCKED' : 'WRITER_1C_REPLACE_PLUS_WRITER_2_CARDINALITY_CONDITIONAL',
    sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: sourceSet.sourceSetSha256,
    sourceAuthority: deepFreeze({ kind: 'SOURCE_SET', sourceSetSha256: sourceSet.sourceSetSha256, members: sourceSet.members }),
    targetAuthorityKind: 'ORIGINAL_TARGET',
    targetAuthority: deepFreeze(targetAuthority),
    targetDocument: deepFreeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: deepFreeze(operations), excludedOperations: deepFreeze([]),
    conflicts: deepFreeze(conflicts), status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: deepFreeze(blockers),
    policy: deepFreeze({
      nodeNameMutation: 'WRITER_1C_REPLACE_OR_WRITER_2_CREATE_DELETE', nodeNameOverwrite: 'WRITER_1C_ONLY',
      structuralNodeNameMutation: 'WRITER_2_CREATE_DELETE_RELOCATION_ONLY',
      processDefault: 'BLOCKED_WRITER_2_COMPOSITE', topologyMutation: 'BLOCKED_WRITER_3_ONLY',
    }),
    summary: deepFreeze({
      operationCount: operations.length,
      previewReadyCount: operations.filter((item) => item.status === 'PREVIEW_READY').length,
      blockedCount: operations.filter((item) => item.status === 'BLOCKED').length,
      protectedCount: operations.filter((item) => item.status === 'PROTECTED').length,
      byAction: deepFreeze(byAction),
      nodeNameReplacementCount: replacementCount,
      bm001BoundCount: operations.filter((item) => item.bm001Acceptance?.status === 'BOUND').length,
    }),
  });
}
function prefixCompareRow(row, sourceIdValue) {
  return deepFreeze({ ...row, sourceId: sourceIdValue, memberCorrespondenceId: row.correspondenceId,
    correspondenceId: prefixId('ms-corr', sourceIdValue, row.correspondenceId) });
}
function combinedCompareReview(memberPreviews, engineeringDeltas) {
  const rows = memberPreviews.flatMap(({ sourceId: id, preview }) => (preview?.compareReview?.rows || []).map((row) => prefixCompareRow(row, id)));
  return deepFreeze({
    schema: 'CIIWorkspaceCompareReview.v1', rows: deepFreeze(rows),
    summary: deepFreeze({
      correspondence: deepFreeze({ total: rows.length, matched: rows.filter((row) => row.identityBound).length }),
      review: deepFreeze({
        accepted: rows.filter((row) => row.decision === 'ACCEPTED').length,
        locked: rows.filter((row) => row.decision === 'LOCKED').length,
        rejected: rows.filter((row) => row.decision === 'REJECTED').length,
        pending: rows.filter((row) => row.decision === 'REVIEW').length,
      }),
      engineering: engineeringDeltas.summary,
    }),
  });
}
function versionBridgeEvidence(sourceSet, memberPreviews) {
  const first = memberPreviews[0].preview.versionBridge;
  return deepFreeze({
    schema: 'CIIWorkspaceWriterVersionBridge.v2',
    mode: 'MULTI_SOURCE_SET_MIXED_NODENAME_V14_VIA_V11',
    sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: sourceSet.sourceSetSha256,
    sourceSet: deepFreeze({
      sourceSetSha256: sourceSet.sourceSetSha256,
      members: deepFreeze(memberPreviews.map(({ sourceId: id, preview }) => deepFreeze({
        sourceId: id,
        originalVersion: preview.versionBridge.source.originalVersion,
        normalizedVersion: preview.versionBridge.source.normalizedVersion,
        originalSha256: preview.versionBridge.source.originalSha256,
        normalizedSha256: preview.versionBridge.source.normalizedSha256,
        baselineCanonicalSha256: preview.versionBridge.source.baselineCanonicalSha256,
      }))),
    }),
    target: first.target,
    conversionSource: first.conversionSource,
    v14WritePolicy: deepFreeze({
      ...first.v14WritePolicy,
      nodeNameReplacementAuthority: 'WRITER_1C_ORIGINAL_BYTES_EXACT_SPAN',
      structuralNodeNameAuthority: 'WRITER_2_V11_RELOCATION_PROJECTED_TO_REPLACEMENT_POSTIMAGE',
    }),
  });
}
function memberInput(input, source, id, index) {
  return {
    sourceBytes: source?.bytes, sourceText: source?.text, sourceFileName: sourceFileName(source, index),
    targetBytes: input?.targetBytes, targetText: input?.targetText, targetFileName: input?.targetFileName || 'T.CII',
    ...(memberBaseLoops(input, source, id) ? { baseLoops: memberBaseLoops(input, source, id) } : {}),
    ...(memberAnchorPairs(input, source, id) ? { anchorPairs: memberAnchorPairs(input, source, id) } : {}),
    ...(memberReview(input, id) ? { review: memberReview(input, id) } : {}),
  };
}

export async function createCiiWriter2SourceSetPreviewWithVersionBridge(input, options = {}) {
  const sources = sourceRows(input); const target = targetBytes(input);
  if (target == null) throw new Error('CII_MS_PREVIEW_TARGET_REQUIRED');
  const sourceSet = await intakeCiiWorkspaceSourceSet(sources.map((source, index) => ({
    sourceId: sourceId(source, index), fileName: sourceFileName(source, index), bytes: sourceBytes(source),
  })), options);
  const originalTargetSha256 = await ciiSha256(target, options.cryptoRef);
  const bm001Authority = await assertCiiMsBm001Authority(sourceSet.sourceSetSha256, originalTargetSha256, options.cryptoRef);
  const aliasSet = ciiMsBm001AliasSet(bm001Authority.rows);
  const memberPreviews = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]; const id = sourceId(source, index); const payload = memberInput(input, source, id, index);
    const preview = await createCiiWorkspacePreviewWithVersionBridge(payload, { ...options, writerVersion: '2' });
    const replacementPreview = await createCiiWorkspacePreviewWithVersionBridge(payload, {
      ...options, writerVersion: '1C', allowNodeNameOverwrite: true,
    });
    assertSameMemberCorrespondence(id, preview, replacementPreview);
    memberPreviews.push(deepFreeze({ sourceId: id, preview, replacementPreview }));
  }
  assertSameTarget(memberPreviews);
  const memberCorrespondences = memberPreviews.map(({ sourceId: id, preview }) => prefixedCorrespondence(id, preview));
  const correspondence = combinedCorrespondence(sourceSet.sourceSetSha256, memberCorrespondences);
  const review = combinedReview(memberPreviews);
  const engineeringDeltas = combinedEngineeringDeltas(memberPreviews);
  const compareReview = combinedCompareReview(memberPreviews, engineeringDeltas);
  const targetDocument = memberPreviews[0].preview.targetDocument;
  const firstTargetBridge = memberPreviews[0].preview.versionBridge.target;
  const targetAuthority = {
    kind: 'ORIGINAL_TARGET', originalSha256: firstTargetBridge.originalSha256,
    originalVersion: firstTargetBridge.originalVersion,
    normalizedSha256: firstTargetBridge.normalizedSha256,
    baselineCanonicalSha256: firstTargetBridge.baselineCanonicalSha256,
  };
  const transferPlan = combinedTransferPlan(memberPreviews, sourceSet, targetDocument, targetAuthority, input, aliasSet, correspondence);
  const versionBridge = versionBridgeEvidence(sourceSet, memberPreviews);
  const writerReadiness = ciiWriter2SourceSetNodeNameReadiness(transferPlan, targetDocument);
  const audit = deepFreeze({
    schema: 'CIIWorkspaceAudit.v1', direction: 'SOURCE_SET_TO_TARGET', writerVersion: '2',
    sourceSet, target: deepFreeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256, originalSha256: originalTargetSha256 }),
    bm001Authority: deepFreeze({ rowCount: bm001Authority.rowCount, sha256: bm001Authority.sha256 }),
    memberPreviews: deepFreeze(memberPreviews.map(({ sourceId: id, preview, replacementPreview }) => deepFreeze({
      sourceId: id, correspondenceStatus: preview.correspondence?.status, transferPlanStatus: preview.transferPlan?.status,
      replacementTransferPlanStatus: replacementPreview.transferPlan?.status,
      originalSha256: preview.versionBridge?.source?.originalSha256, normalizedSha256: preview.versionBridge?.source?.normalizedSha256,
    }))),
    correspondence, review, engineeringDeltas, compareReview, transferPreview: transferPlan, writerReadiness, versionBridge,
  });
  const result = {
    schema: CII_MS_PREVIEW_SCHEMA, writerVersion: '2', sourceSet, sourceSetSha256: sourceSet.sourceSetSha256,
    memberPreviews: deepFreeze(memberPreviews), targetDocument, targetAuthority: deepFreeze(targetAuthority),
    correspondence, review, engineeringDeltas, compareReview, transferPlan, writerReadiness, versionBridge, audit,
    stages: createCiiWorkspaceStageModel(writerReadiness), bm001Authority,
  };
  result.artifacts = ciiWorkspaceArtifactBundle(result);
  return deepFreeze(result);
}

export const _test = Object.freeze({
  prefixId, prefixedRow, sourceIdentity, targetIdentity, crossSourceCorrespondenceConflicts,
  normalizedAcceptanceBinding, inferredAcceptanceBinding, targetMutationConflicts, bm001SourceAliasCandidates,
  memberMixedOperations,
});