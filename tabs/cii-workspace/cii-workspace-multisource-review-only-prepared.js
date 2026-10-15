import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';
import { ciiWorkspaceArtifactBundle } from './cii-workspace-export.js';
import { CII_PREPARED_SOURCE_SET_SESSION_SCHEMA } from './cii-workspace-source-set.js';
import {
  createCiiWorkspaceCommonAnalysis,
  projectCiiWorkspacePreviewFromCommonAnalysis,
} from './cii-workspace-core.js';
import {
  canonicalCiiPreparedCommonAnalysisCustody,
  ciiCommonAnalysisAuthorityKey,
} from './cii-workspace-common-analysis-key.js';

const COMMON_CACHE_SCHEMA = 'CIIWorkspaceCommonAnalysisCache.v1';

function text(value) { return String(value ?? '').trim(); }

function preparedMembers(preparedSession) {
  if (preparedSession?.schema !== CII_PREPARED_SOURCE_SET_SESSION_SCHEMA || preparedSession?.status !== 'PREPARED') {
    throw new Error('CII_MS_REVIEW_ONLY_PREPARED_SESSION_REQUIRED');
  }
  const members = preparedSession.members || [];
  if (members.length < 2) throw new Error('CII_MS_REVIEW_ONLY_PREPARED_TWO_OR_MORE_SOURCES_REQUIRED');
  const ids = members.map((member) => text(member?.sourceId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error('CII_MS_REVIEW_ONLY_PREPARED_SOURCE_ID_CUSTODY_INVALID');
  }
  return members;
}

function memberInput(input, id) {
  const baseLoops = input?.baseLoopsBySource?.[id];
  const anchorPairs = input?.anchorPairsBySource?.[id];
  const review = input?.reviewBySource?.[id] || input?.reviews?.[id];
  return {
    ...(baseLoops ? { baseLoops } : {}),
    ...(anchorPairs ? { anchorPairs, anchorPairMode: 'INDEPENDENT_SEEDS' } : {}),
    ...(review ? { review } : {}),
  };
}

function memberModels(preparedSession, member) {
  const target = preparedSession?.target;
  if (!member?.sourceDocument || !member?.sourceGraph || !target?.targetDocument || !target?.targetGraph) {
    throw new Error(`CII_MS_REVIEW_ONLY_PREPARED_MODELS_REQUIRED:${text(member?.sourceId)}`);
  }
  if (member.sourceDocument.contentSha256 !== member.normalizedSha256) {
    throw new Error(`CII_MS_REVIEW_ONLY_PREPARED_SOURCE_HASH_MISMATCH:${text(member?.sourceId)}`);
  }
  if (target.targetDocument.contentSha256 !== target.normalizedSha256) {
    throw new Error('CII_MS_REVIEW_ONLY_PREPARED_TARGET_HASH_MISMATCH');
  }
  return {
    sourceDocument: member.sourceDocument,
    sourceGraph: member.sourceGraph,
    targetDocument: target.targetDocument,
    targetGraph: target.targetGraph,
  };
}

function memberVersionBridge(preparedSession, member) {
  const source = member?.bridge;
  const target = preparedSession?.target?.bridge;
  const shared = preparedSession?.versionBridge;
  if (!source?.originalSha256 || !source?.normalizedSha256 || !target?.originalSha256 || !target?.normalizedSha256) {
    throw new Error(`CII_MS_REVIEW_ONLY_PREPARED_BRIDGE_REQUIRED:${text(member?.sourceId)}`);
  }
  if (!shared?.conversionSource || !shared?.v14WritePolicy) {
    throw new Error('CII_MS_REVIEW_ONLY_PREPARED_BRIDGE_POLICY_REQUIRED');
  }
  const mode = target?.writer2Shadow?.enabled
    ? 'V14_TARGET_SHADOW_CHANGE_ISOLATED_VIA_V11'
    : (Number(source.originalVersion) === 11 && Number(target.originalVersion) === 11
      ? 'DIRECT_V11' : 'CHANGE_ISOLATED_V14_VIA_V11');
  return deepFreeze({
    schema: 'CIIWorkspaceWriterVersionBridge.v2',
    mode,
    source,
    target,
    conversionSource: shared.conversionSource,
    v14WritePolicy: shared.v14WritePolicy,
  });
}

function attachVersionBridge(preview, versionBridge) {
  const audit = deepFreeze({ ...(preview?.audit || {}), versionBridge });
  const result = { ...preview, versionBridge, audit };
  result.artifacts = ciiWorkspaceArtifactBundle(result);
  return deepFreeze(result);
}

function analysisOptions(options = {}) {
  const { commonAnalysisCache: _cache, previewFactory: _factory, ...rest } = options || {};
  return rest;
}

function commonCache(options = {}) {
  const cache = options?.commonAnalysisCache;
  if (cache == null) return null;
  if (cache?.schema !== COMMON_CACHE_SCHEMA || !(cache.entries instanceof Map)) {
    throw new Error('CII_MS_REVIEW_ONLY_COMMON_ANALYSIS_CACHE_REQUIRED');
  }
  if (cache.sessionIdentity == null && cache.entries.size) {
    throw new Error('CII_MS_REVIEW_ONLY_COMMON_ANALYSIS_CACHE_STATE_INVALID');
  }
  return cache;
}

function sessionIdentity(preparedSession) {
  const ids = (preparedSession?.members || []).map((member) => text(member?.sourceId)).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!ids.length) throw new Error('CII_MS_REVIEW_ONLY_PREPARED_SOURCE_MEMBER_REQUIRED');
  return stableStringify(canonicalCiiPreparedCommonAnalysisCustody(preparedSession, ids[0]));
}

function ensureSession(cache, identity, instrumentation) {
  if (!cache) return;
  if (cache.sessionIdentity == null) {
    cache.sessionIdentity = identity;
    return;
  }
  if (cache.sessionIdentity === identity) return;
  cache.entries.clear();
  cache.sessionIdentity = identity;
  instrumentation?.record?.('CII_COMMON_ANALYSIS_CACHE_RESET', 1);
}

async function commonForMember(preparedSession, member, payload, options, cache, identity) {
  const commonOptions = analysisOptions(options);
  if (!cache) {
    return createCiiWorkspaceCommonAnalysis(payload, commonOptions, memberModels(preparedSession, member));
  }
  ensureSession(cache, identity, commonOptions.instrumentation);
  const id = text(member?.sourceId);
  const key = await ciiCommonAnalysisAuthorityKey({
    preparedSession,
    sourceId: id,
    input: payload,
    options: commonOptions,
  }, commonOptions.cryptoRef);
  const existing = cache.entries.get(id);
  if (existing?.key === key && existing?.commonAnalysis) {
    commonOptions.instrumentation?.record?.('CII_COMMON_ANALYSIS_CACHE_HIT', 1);
    return existing.commonAnalysis;
  }
  commonOptions.instrumentation?.record?.('CII_COMMON_ANALYSIS_CACHE_MISS', 1);
  const common = await createCiiWorkspaceCommonAnalysis(
    payload,
    commonOptions,
    memberModels(preparedSession, member),
  );
  cache.entries.set(id, { key, commonAnalysis: common });
  return common;
}

export async function createPreparedReviewOnlyMemberPreviews(preparedSession, input = {}, options = {}) {
  const members = preparedMembers(preparedSession);
  const cache = commonCache(options);
  const identity = cache ? sessionIdentity(preparedSession) : null;
  ensureSession(cache, identity, options.instrumentation);
  const commonOptions = analysisOptions(options);
  const memberPreviews = [];

  for (const member of members) {
    const id = text(member?.sourceId);
    const payload = memberInput(input, id);
    const common = await commonForMember(preparedSession, member, payload, options, cache, identity);
    const preview = attachVersionBridge(
      projectCiiWorkspacePreviewFromCommonAnalysis(
        common,
        payload,
        { ...commonOptions, writerVersion: '2' },
      ),
      memberVersionBridge(preparedSession, member),
    );
    memberPreviews.push(deepFreeze({ sourceId: id, preview }));
  }

  const sources = members.map((member) => deepFreeze({
    sourceId: text(member?.sourceId),
    fileName: text(member?.fileName),
  }));
  return deepFreeze({ sources: deepFreeze(sources), memberPreviews: deepFreeze(memberPreviews) });
}

export const _test = Object.freeze({
  preparedMembers,
  memberInput,
  memberModels,
  memberVersionBridge,
  analysisOptions,
  commonCache,
  sessionIdentity,
  ensureSession,
});
