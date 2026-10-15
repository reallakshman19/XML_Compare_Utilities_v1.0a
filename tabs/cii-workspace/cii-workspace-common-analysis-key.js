import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';
import { ciiSha256 } from './cii-workspace-v11-v14-converter.js';

export const CII_COMMON_ANALYSIS_AUTHORITY_KEY_SCHEMA = 'CIIWorkspaceCommonAnalysisAuthorityKey.v1';

export const CII_COMMON_ANALYSIS_OPTION_DEFAULTS = deepFreeze({
  landmarkLimit: 12,
  candidateLimit: 8,
  winnerGap: 8,
  candidatePassingScore: 45,
  highConfidenceScore: 82,
  spatialToleranceMm: 100,
  networkLocalLengthToleranceMm: 250,
  networkPassingScore: 55,
  networkStrongScore: 70,
  diameterRelativeTolerance: 0.10,
  wallRelativeTolerance: 0.10,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
  propagation: false,
  lengthToleranceMm: 6,
  gapPenalty: -28,
  minPathScore: 45,
  pathLengthToleranceMm: 25,
  diameterToleranceMm: 2,
  wallToleranceMm: 1,
  subdivisionMinStraightness: 0.995,
  subdivisionStraightnessTolerance: 0.01,
  minAnchorPathScore: 45,
  maxAnchorPathLengthDivergence: 0.20,
  rerouteAutoScore: 75,
  sourceOdMm: null,
  odToleranceFactor: 2,
  nonCollinearSinTolerance: 1e-4,
  registrationProbePoints: Object.freeze([]),
  runCollinearAngleDeg: 0.5,
  axisLabelSnapDeg: 2,
  independentAxisAngleDeg: 15,
  maxRunElements: 256,
  maxPropagationNodePairs: 10000,
  maxPropagationFrontierDegree: 6,
  maxFrontierAssignments: 720,
  frontierWinnerGap: 8,
  engineeringGeometryToleranceMm: 0.01,
  engineeringNumericTolerance: 1e-9,
  engineeringMassTolerance: 1e-9,
});

export const ANALYSIS_OPTION_KEYS = Object.freeze(Object.keys(CII_COMMON_ANALYSIS_OPTION_DEFAULTS));

const EXCLUDED_NON_ANALYSIS_OPTION_KEYS = new Set([
  'acceptanceResolver',
  'allowNodeNameOverwrite',
  'baseAnchorDisplayLimit',
  'baseAnchorSuggestionLimit',
  'coordinateToleranceMm',
  'coordinateToleranceMm',
  'cryptoRef',
  'diameterToleranceRatio',
  'instrumentation',
  'landmarkLimit',
  'limit',
  'methodAPhysicalCandidateLimit',
  'minimumAutomaticConfidence',
  'review',
  'scoreElementMatch',
  'targetGraph',
  'texpectedRows',
  'bm001ExpectedRows',
  'wallToleranceRatio',
  'writerVersion',
]);

function text(value) { return String(value ?? '').trim(); }
function sha(value, label) {
  const normalized = text(value).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(`CII_COMMON_ANALYSIS_KEY_${label}_SHA256_REQUIRED`);
  return normalized;
}
function finiteSemantic(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : `INVALID:${text(value)}`;
}
function nullishNumber(value, fallback) {
  return finiteSemantic(value ?? fallback);
}
function orNumber(value, fallback) {
  return finiteSemantic(value || fallback);
}
function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function minNumber(value, fallback, minimum, useOr = false) {
  const selected = useOr ? orNumber(value, fallback) : nullishNumber(value, fallback);
  return typeof selected === 'number' ? Math.max(minimum, selected) : selected;
}
function canonicalPoint(value) {
  if (!value || typeof value !== 'object') return value;
  const point = {};
  for (const key of ['x', 'y', 'z']) {
    const parsed = Number(value[key]);
    if (Number.isFinite(parsed)) point[key] = parsed;
  }
  return point;
}
function pointOrder(left, right) {
  return Number(left?.x || 0) - Number(right?.x || 0)
    || Number(left?.y || 0) - Number(right?.y || 0)
    || Number(left?.z || 0) - Number(right?.z || 0);
}
function canonicalProbePoints(rows) {
  return Object.freeze((rows || []).map(canonicalPoint).sort(pointOrder));
}
function pair(value) {
  const sourceNodeId = text(value?.sourceNodeId);
  const targetNodeId = text(value?.targetNodeId);
  if (!sourceNodeId || !targetNodeId) throw new Error('CII_COMMON_ANALYSIS_KEY_ANCHOR_PAIR_REQUIRED');
  return Object.freeze({ sourceNodeId, targetNodeId });
}
function pairToken(value) { return `${value.sourceNodeId}=>${value.targetNodeId}`; }
function canonicalPairs(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const item = pair(row);
    map.set(pairToken(item), item);
  }
  return Object.freeze([...map.values()].sort((a, b) =>
    pairToken(a).localeCompare(pairToken(b), undefined, { numeric: true })));
}
function normalizedMethod(value) {
  const method = text(value).toUpperCase();
  if (['A', 'METHOD_A', 'METHOD_A_SPATIAL'].includes(method)) return 'METHOD_A_SPATIAL';
  if (['B', 'METHOD_B', 'METHOD_B_NETWORK'].includes(method)) return 'METHOD_B_NETWORK';
  if (['USER_LOCKED_SEED', 'INDEPENDENT_SEED'].includes(method)) return 'USER_LOCKED_SEED';
  if (['USER_LOCKED_LEGACY', 'LEGACY'].includes(method)) return 'USER_LOCKED_LEGACY';
  return method;
}
function canonicalLoop(loop, index) {
  const method = normalizedMethod(loop?.method);
  if (!method) throw new Error(`CII_COMMON_ANALYSIS_KEY_LOOP_METHOD_REQUIRED:${index}`);
  const baseId = text(loop?.baseId || loop?.loopId);
  if (!baseId) throw new Error(`CII_COMMON_ANALYSIS_KEY_LOOP_BASE_ID_REQUIRED:${index}`);
  const anchorPairs = canonicalPairs(loop?.anchorPairs
    || (loop?.sourceNodeId != null && loop?.targetNodeId != null ? [loop] : []));
  if (!anchorPairs.length) throw new Error(`CII_COMMON_ANALYSIS_KEY_LOOP_ANCHORS_REQUIRED:${baseId}`);
  return Object.freeze({
    method,
    baseId,
    anchorPairs,
    probePoints: canonicalProbePoints(loop?.probePoints || []),
  });
}
function canonicalLoops(rows) {
  return Object.freeze((rows || []).map(canonicalLoop)
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), undefined, { numeric: true })));
}

export function canonicalCiiCommonAnalysisAuthority(input = {}) {
  if (Array.isArray(input?.baseLoops)) {
    return deepFreeze({
      mode: 'EXPLICIT_BASE_LOOPS',
      loops: canonicalLoops(input.baseLoops),
    });
  }
  const anchorPairs = canonicalPairs(input?.anchorPairs || []);
  const independent = text(input?.anchorPairMode).toUpperCase() === 'INDEPENDENT_SEEDS';
  return deepFreeze({
    mode: independent ? 'INDEPENDENT_MANUAL_SEEDS' : 'LEGACY_ANCHOR_PAIRS',
    anchorPairs,
  });
}

function extraSemanticOptions(options) {
  const extra = {};
  for (const key of Object.keys(options || {}).sort()) {
    if (ANALYSIS_OPTION_KEYS.includes(key) || EXCLUDED_NON_ANALYSIS_OPTION_KEYS.has(key)) continue;
    const value = options[key];
    if (value == null || typeof value === 'function') continue;
    if (key === 'geometryTransform') {
      // A caller-supplied transform can affect path candidate scoring, so it
      // must invalidate the cache even though normal prepared flows derive
      // Method-A geometry from authority.
      extra[key] = stableStringify(value);
      continue;
    }
    if (typeof value === 'object') {
      try { extra[key] = stableStringify(value); } catch { extra[key] = `UNSERIALIZABLE:${key}`; }
    } else extra[key] = value;
  }
  return deepFreeze(extra);
}

export function ciiCommonAnalysisOptions(options = {}) {
  const winnerGap = minNumber(options.winnerGap, 8, 0, true);
  return deepFreeze({
    optionContract: 2,

    landmarkLimit: minNumber(options.limit, 12, 1, true),

    candidateLimit: minNumber(options.candidateLimit, 8, 1, true),
    winnerGap,
    candidatePassingScore: minNumber(options.candidatePassingScore, 45, 0),
    highConfidenceScore: orNumber(options.highConfidenceScore, 82),
    spatialToleranceMm: nullishNumber(options.spatialToleranceMm ?? options.coordinateToleranceMm, 100),
    networkLocalLengthToleranceMm: orNumber(options.networkLocalLengthToleranceMm, 250),
    networkPassingScore: nullishNumber(options.networkPassingScore, 55),
    networkStrongScore: nullishNumber(options.networkStrongScore, 70),
    diameterRelativeTolerance: nullishNumber(options.diameterRelativeTolerance, 0.10),
    wallRelativeTolerance: nullishNumber(options.wallRelativeTolerance, 0.10),
    identityWeight: nullishNumber(options.identityWeight, 50),
    diameterWeight: nullishNumber(options.diameterWeight, 30),
    wallWeight: nullishNumber(options.wallWeight, 30),
    propagation: options.propagation === true,

    lengthToleranceMm: orNumber(options.lengthToleranceMm, 6),
    gapPenalty: nullishNumber(options.gapPenalty, -28),
    minPathScore: orNumber(options.minPathScore, 45),
    pathLengthToleranceMm: orNumber(options.pathLengthToleranceMm, 25),
    diameterToleranceMm: orNumber(options.diameterToleranceMm, 2),
    wallToleranceMm: orNumber(options.wallToleranceMm, 1),
    subdivisionMinStraightness: nullishNumber(options.subdivisionMinStraightness, 0.995),
    subdivisionStraightnessTolerance: nullishNumber(options.subdivisionStraightnessTolerance, 0.01),
    minAnchorPathScore: nullishNumber(options.minAnchorPathScore, 45),
    maxAnchorPathLengthDivergence: nullishNumber(options.maxAnchorPathLengthDivergence, 0.20),
    rerouteAutoScore: nullishNumber(options.rerouteAutoScore, 75),

    sourceOdMm: positiveNumber(options.sourceOdMm, null),
    odToleranceFactor: positiveNumber(options.odToleranceFactor, 2),
    nonCollinearSinTolerance: nullishNumber(options.nonCollinearSinTolerance, 1e-4),
    registrationProbePoints: canonicalProbePoints(options.registrationProbePoints || []),
    runCollinearAngleDeg: nullishNumber(options.runCollinearAngleDeg, 0.5),
    axisLabelSnapDeg: nullishNumber(options.axisLabelSnapDeg, 2),
    independentAxisAngleDeg: nullishNumber(options.independentAxisAngleDeg, 15),
    maxRunElements: minNumber(options.maxRunElements, 256, 1),

    maxPropagationNodePairs: orNumber(options.maxPropagationNodePairs, 10000),
    maxPropagationFrontierDegree: orNumber(options.maxPropagationFrontierDegree, 6),
    maxFrontierAssignments: orNumber(options.maxFrontierAssignments, 720),
    frontierWinnerGap: nullishNumber(options.frontierWinnerGap, winnerGap),

    engineeringGeometryToleranceMm: nullishNumber(options.engineeringGeometryToleranceMm, 0.01),
    engineeringNumericTolerance: nullishNumber(options.engineeringNumericTolerance, 1e-9),
    engineeringMassTolerance: nullishNumber(options.engineeringMassTolerance, 1e-9),

    // Conservative future-proofing: an unknown serializable option changes
    // the key unless it is explicitly classified as non-analysis above.
    extraSemanticOptions: extraSemanticOptions(options),
  });
}

function canonicalPreparedMember(member) {
  const sourceId = text(member?.sourceId);
  if (!sourceId) throw new Error('CII_COMMON_ANALYSIS_KEY_SOURCE_ID_REQUIRED');
  return deepFreeze({
    sourceId,
    fileName: text(member?.fileName),
    originalVersion: Number(member?.originalVersion),
    normalizedVersion: Number(member?.normalizedVersion),
    originalSha256: sha(member?.originalSha256, 'SOURCE_ORIGINAL'),
    normalizedSha256: sha(member?.normalizedSha256, 'SOURCE_NORMALIZED'),
    baselineCanonicalSha256: sha(member?.baselineCanonicalSha256, 'SOURCE_BASELINE_CANONICAL'),
  });
}
function canonicalPreparedTarget(target) {
  if (!target) throw new Error('CII_COMMON_ANALYSIS_KEY_TARGET_CUSTODY_REQUIRED');
  return deepFreeze({
    fileName: text(target.fileName),
    originalVersion: Number(target.originalVersion),
    normalizedVersion: Number(target.normalizedVersion),
    originalSha256: sha(target.originalSha256, 'TARGET_ORIGINAL'),
    normalizedSha256: sha(target.normalizedSha256, 'TARGET_NORMALIZED'),
    baselineCanonicalSha256: sha(target.baselineCanonicalSha256, 'TARGET_BASELINE_CANONICAL'),
  });
}
function canonicalConversionSource(preparedSession) {
  const row = preparedSession?.versionBridge?.conversionSource;
  if (!row || !text(row.repository) || !text(row.commit) || !text(row.policy)) {
    throw new Error('CII_COMMON_ANALYSIS_KEY_CONVERSION_SOURCE_REQUIRED');
  }
  return deepFreeze({
    repository: text(row.repository),
    commit: text(row.commit),
    policy: text(row.policy),
  });
}

export function canonicalCiiPreparedCommonAnalysisCustody(preparedSession, sourceIdValue) {
  if (preparedSession?.schema !== 'CIIWorkspacePreparedSourceSetSession.v1'
    || preparedSession?.status !== 'PREPARED') {
    throw new Error('CII_COMMON_ANALYSIS_KEY_PREPARED_SESSION_REQUIRED');
  }
  const sourceId = text(sourceIdValue);
  if (!sourceId) throw new Error('CII_COMMON_ANALYSIS_KEY_SOURCE_ID_REQUIRED');
  const members = Object.freeze((preparedSession.members || []).map(canonicalPreparedMember)
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId, undefined, { numeric: true })
      || stableStringify(a).localeCompare(stableStringify(b))));
  const matches = members.filter((member) => member.sourceId === sourceId);
  if (matches.length !== 1) throw new Error(`CII_COMMON_ANALYSIS_KEY_SOURCE_MEMBER_REQUIRED:${sourceId}`);
  return deepFreeze({
    // Deliberately not keyed by preparedSession.sourceSetSha256 because the
    // current repository source-set SHA is presentation-order-sensitive.
    members,
    sourceId,
    target: canonicalPreparedTarget(preparedSession.target),
    conversionSource: canonicalConversionSource(preparedSession),
  });
}

export function canonicalCiiCommonAnalysisAuthorityPreimage({
  preparedSession,
  sourceId,
  input = {},
  options = {},
} = {}) {
  return stableStringify({
    schema: CII_COMMON_ANALYSIS_AUTHORITY_KEY_SCHEMA,
    custody: canonicalCiiPreparedCommonAnalysisCustody(preparedSession, sourceId),
    authority: canonicalCiiCommonAnalysisAuthority(input),
    analysisOptions: ciiCommonAnalysisOptions(options),
  });
}

export async function ciiCommonAnalysisAuthorityKey(args = {}, cryptoRef = globalThis.crypto) {
  const preimage = canonicalCiiCommonAnalysisAuthorityPreimage(args);
  const digest = await ciiSha256(preimage, cryptoRef);
  return `cii-common-analysis-v1:${digest}`;
}

export const _test = Object.freeze({
  ANALYSIS_OPTION_KEYS,
  canonicalLoops,
  canonicalPairs,
  canonicalProbePoints,
  normalizedMethod,
  extraSemanticOptions,
});
