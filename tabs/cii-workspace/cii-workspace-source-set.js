import { ciiSha256, detectCiiNeutralVersion } from './cii-workspace-v11-v14-converter.js';
import { CII_METHOD_A_CONFIDENCE_DEFAULTS, resolveCiiMethodAConfidenceThresholds, validateCiiMethodAConfidenceThresholds } from './cii-workspace-geometry.js';
import { CII_METHOD_A_WEIGHT_DEFAULTS, validateCiiMethodAConfidenceWeights } from './cii-workspace-method-a-weights.js';

export const CII_SOURCE_SET_SCHEMA = 'CIIWorkspaceSourceSet.v1';
export const CII_SOURCE_SET_INSPECTION_SCHEMA = 'CIIWorkspaceSourceSetInspection.v1';
export const CII_PREPARED_SOURCE_SET_SESSION_SCHEMA = 'CIIWorkspacePreparedSourceSetSession.v1';
export const CII_SOURCE_SET_WP2_BLOCKER = 'MULTISOURCE_CORRESPONDENCE_REQUIRES_WP_002';

const DEFAULT_METHOD_A_PHYSICAL_SEARCH_LIMIT = 10;
const MAX_METHOD_A_PHYSICAL_SEARCH_LIMIT = 24;
const DEFAULT_BASE_ANCHOR_DISPLAY_LIMIT = 5;
let multiSourceMethodAPhysicalCandidateLimit = DEFAULT_METHOD_A_PHYSICAL_SEARCH_LIMIT;
let multiSourceMethodAConfidenceThresholds = CII_METHOD_A_CONFIDENCE_DEFAULTS;
let multiSourceMethodAConfidenceWeights = CII_METHOD_A_WEIGHT_DEFAULTS;

function boundedSearchLimit(value) {
  const requested = Number(value); const finite = Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_METHOD_A_PHYSICAL_SEARCH_LIMIT;
  return Math.max(3, Math.min(MAX_METHOD_A_PHYSICAL_SEARCH_LIMIT, finite));
}
export function setCiiMultiSourceMethodAPhysicalCandidateLimit(value) {
  multiSourceMethodAPhysicalCandidateLimit = boundedSearchLimit(value);
  return multiSourceMethodAPhysicalCandidateLimit;
}
export function getCiiMultiSourceMethodAConfidenceOptions() {
  return Object.freeze({
    methodAHighConfidenceThreshold: multiSourceMethodAConfidenceThresholds.high,
    methodAMediumConfidenceThreshold: multiSourceMethodAConfidenceThresholds.medium,
    methodAConfidenceWeights: multiSourceMethodAConfidenceWeights,
  });
}
export function setCiiMultiSourceMethodAConfidenceWeights(weights) {
  // Transactional: a malformed or unbalanced policy never replaces the live one.
  const candidate = validateCiiMethodAConfidenceWeights(weights);
  multiSourceMethodAConfidenceWeights = candidate;
  return candidate;
}
export function setCiiMultiSourceMethodAConfidenceThresholds({ high, medium } = {}) {
  const candidate = validateCiiMethodAConfidenceThresholds({
    high: high ?? multiSourceMethodAConfidenceThresholds.high,
    medium: medium ?? multiSourceMethodAConfidenceThresholds.medium,
  });
  multiSourceMethodAConfidenceThresholds = candidate;
  return candidate;
}
function sourceSetInspectionOptions(options = {}) {
  const current = getCiiMultiSourceMethodAConfidenceOptions();
  const thresholds = validateCiiMethodAConfidenceThresholds({
    high: options.methodAHighConfidenceThreshold ?? current.methodAHighConfidenceThreshold,
    medium: options.methodAMediumConfidenceThreshold ?? current.methodAMediumConfidenceThreshold,
  });
  const weights = validateCiiMethodAConfidenceWeights(options.methodAConfidenceWeights ?? current.methodAConfidenceWeights);
  return {
    ...options,
    methodAHighConfidenceThreshold: thresholds.high,
    methodAMediumConfidenceThreshold: thresholds.medium,
    methodAConfidenceWeights: weights,
    methodAPhysicalCandidateLimit: boundedSearchLimit(options.methodAPhysicalCandidateLimit ?? multiSourceMethodAPhysicalCandidateLimit),
    baseAnchorDisplayLimit: Math.max(1, Number(options.baseAnchorDisplayLimit ?? DEFAULT_BASE_ANCHOR_DISPLAY_LIMIT) || DEFAULT_BASE_ANCHOR_DISPLAY_LIMIT),
  };
}
function value(input, key) {
  return input?.[`${key}Bytes`] ?? input?.[`${key}Text`];
}
function sourceValue(source) { return source?.bytes ?? source?.text; }
function sourceId(source, index) { return String(source?.sourceId || `S${index + 1}`).trim(); }
function sourceFileName(source, index) { return String(source?.fileName || `${sourceId(source, index)}.CII`).trim(); }
function sourceRows(input) {
  const rows = Array.isArray(input) ? input : input?.sources;
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('CII_SOURCE_SET_TWO_OR_MORE_SOURCES_REQUIRED');
  const ids = rows.map(sourceId);
  if (ids.some((id) => !id)) throw new Error('CII_SOURCE_SET_SOURCE_ID_REQUIRED');
  if (new Set(ids).size !== ids.length) throw new Error('CII_SOURCE_SET_DUPLICATE_SOURCE_ID');
  return rows;
}
function authoritySha(member) {
  return String(member?.originalSha256 || member?.authoritySha256 || member?.contentSha256 || '').trim();
}
export function canonicalCiiSourceSetPreimage(members) {
  if (!Array.isArray(members) || !members.length) throw new Error('CII_SOURCE_SET_MEMBERS_REQUIRED');
  return members.map((member, index) => {
    const id = String(member?.sourceId || '').trim(); const sha = authoritySha(member);
    if (!id) throw new Error(`CII_SOURCE_SET_SOURCE_ID_REQUIRED:${index}`);
    if (!/^[0-9a-f]{64}$/i.test(sha)) throw new Error(`CII_SOURCE_SET_SHA256_REQUIRED:${id}`);
    return `${id}:${sha.toLowerCase()}\n`;
  }).join('');
}
export async function ciiSourceSetSha256(members, cryptoRef = globalThis.crypto) {
  return ciiSha256(canonicalCiiSourceSetPreimage(members), cryptoRef);
}
function frozenSourceSet(members, sourceSetSha256, mode) {
  return Object.freeze({
    schema: CII_SOURCE_SET_SCHEMA, status: 'CUSTODY_READY', authority: 'INDEPENDENT_SOURCE_MEMBERS', mode,
    memberCount: members.length, sourceSetSha256, members: Object.freeze(members),
  });
}
export async function intakeCiiWorkspaceSourceSet(input, options = {}) {
  const sources = sourceRows(input); const members = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]; const id = sourceId(source, index); const fileName = sourceFileName(source, index); const raw = sourceValue(source);
    if (raw == null) throw new Error(`CII_SOURCE_SET_SOURCE_BYTES_REQUIRED:${id}`);
    members.push(Object.freeze({
      sourceId: id, fileName,
      originalSha256: await ciiSha256(raw, options.cryptoRef), originalVersion: detectCiiNeutralVersion(raw),
      normalizedSha256: null, normalizedVersion: null, normalizationStatus: 'NOT_RUN',
    }));
  }
  return frozenSourceSet(members, await ciiSourceSetSha256(members, options.cryptoRef), 'RAW_MEMBER_CUSTODY');
}
function bridgeMember(source, index, inspection) {
  const side = inspection?.versionBridge?.source;
  if (!side?.originalSha256 || !side?.normalizedSha256) throw new Error(`CII_SOURCE_SET_BRIDGE_EVIDENCE_REQUIRED:${sourceId(source, index)}`);
  return Object.freeze({
    sourceId: sourceId(source, index), fileName: sourceFileName(source, index),
    originalVersion: side.originalVersion, normalizedVersion: side.normalizedVersion,
    originalSha256: side.originalSha256, normalizedSha256: side.normalizedSha256,
    normalizationStatus: 'PASS_BRIDGE_EVIDENCE', baselineCanonicalSha256: side.baselineCanonicalSha256,
    exactBaselineRoundTrip: side.exactBaselineRoundTrip, summary: inspection.source?.summary || null,
  });
}
function targetCustodyKey(inspection) {
  const target = inspection?.versionBridge?.target;
  return [target?.originalVersion, target?.originalSha256, target?.normalizedSha256, target?.baselineCanonicalSha256].join('|');
}
function assertSharedTargetCustody(inspections) {
  const keys = new Set(inspections.map(targetCustodyKey));
  if (keys.size !== 1 || [...keys][0].includes('undefined')) throw new Error('CII_SOURCE_SET_TARGET_CUSTODY_MISMATCH');
}
function preparedSourceMember(source, index, preparedSource, inspection) {
  const bridge = inspection?.versionBridge?.source;
  if (!bridge?.originalSha256 || !bridge?.normalizedSha256) {
    throw new Error(`CII_PREPARED_SOURCE_SET_SOURCE_BRIDGE_REQUIRED:${sourceId(source, index)}`);
  }
  if (preparedSource?.sourceDocument?.contentSha256 !== bridge.normalizedSha256 || !preparedSource?.sourceGraph) {
    throw new Error(`CII_PREPARED_SOURCE_SET_SOURCE_CUSTODY_MISMATCH:${sourceId(source, index)}`);
  }
  return Object.freeze({
    sourceId: sourceId(source, index),
    fileName: sourceFileName(source, index),
    originalVersion: bridge.originalVersion,
    normalizedVersion: bridge.normalizedVersion,
    originalSha256: bridge.originalSha256,
    normalizedSha256: bridge.normalizedSha256,
    baselineCanonicalSha256: bridge.baselineCanonicalSha256,
    sourceDocument: preparedSource.sourceDocument,
    sourceGraph: preparedSource.sourceGraph,
    bridge: Object.freeze({ ...bridge }),
  });
}
function preparedTargetSession(targetFileName, preparedTarget, firstInspection) {
  const bridge = firstInspection?.versionBridge?.target;
  if (!bridge?.originalSha256 || !bridge?.normalizedSha256) throw new Error('CII_PREPARED_SOURCE_SET_TARGET_BRIDGE_REQUIRED');
  if (preparedTarget?.targetDocument?.contentSha256 !== bridge.normalizedSha256 || !preparedTarget?.targetGraph) {
    throw new Error('CII_PREPARED_SOURCE_SET_TARGET_CUSTODY_MISMATCH');
  }
  return Object.freeze({
    fileName: targetFileName,
    originalVersion: bridge.originalVersion,
    normalizedVersion: bridge.normalizedVersion,
    originalSha256: bridge.originalSha256,
    normalizedSha256: bridge.normalizedSha256,
    baselineCanonicalSha256: bridge.baselineCanonicalSha256,
    targetDocument: preparedTarget.targetDocument,
    targetGraph: preparedTarget.targetGraph,
    bridge: Object.freeze({ ...bridge }),
  });
}

export async function prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge(input, options = {}) {
  const sources = sourceRows(input); const targetInput = value(input, 'target');
  if (targetInput == null) throw new Error('CII_SOURCE_SET_TARGET_REQUIRED');
  const targetFileName = String(input?.targetFileName || 'TARGET.CII'); const inspectionOptions = sourceSetInspectionOptions(options);
  const {
    prepareCiiWorkspaceSourceWithVersionBridge,
    prepareCiiWorkspaceTargetWithVersionBridge,
    inspectCiiWorkspaceModelsWithPreparedPair,
  } = await import('./cii-workspace-writer-version-bridge.js');
  const preparedTarget = await prepareCiiWorkspaceTargetWithVersionBridge(targetInput, targetFileName, { ...inspectionOptions, writerVersion: '2' });
  const inspections = []; const preparedSources = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]; const id = sourceId(source, index); const fileName = sourceFileName(source, index); const raw = sourceValue(source);
    if (raw == null) throw new Error(`CII_SOURCE_SET_SOURCE_BYTES_REQUIRED:${id}`);
    const preparedSource = await prepareCiiWorkspaceSourceWithVersionBridge(raw, fileName, { ...inspectionOptions, writerVersion: '2' });
    const inspection = await inspectCiiWorkspaceModelsWithPreparedPair(preparedSource, preparedTarget, { ...inspectionOptions, writerVersion: '2' });
    preparedSources.push(preparedSource); inspections.push(inspection);
  }
  assertSharedTargetCustody(inspections);
  const members = inspections.map((inspection, index) => bridgeMember(sources[index], index, inspection));
  const sourceSetSha256 = await ciiSourceSetSha256(members, options.cryptoRef);
  const sourceSet = frozenSourceSet(members, sourceSetSha256, 'V11_V14_BRIDGE_MEMBER_CUSTODY');
  const memberInspections = Object.freeze(inspections.map((inspection, index) => Object.freeze({
    sourceId: sourceId(sources[index], index), fileName: sourceFileName(sources[index], index), inspection,
  })));
  const first = inspections[0];
  const inspection = Object.freeze({
    schema: CII_SOURCE_SET_INSPECTION_SCHEMA, status: 'CORRESPONDENCE_INPUT_READY', sourceSet, target: first.target,
    memberInspections,
    baseAnchorSuggestionsBySource: Object.freeze(Object.fromEntries(memberInspections.map((item) => [item.sourceId, item.inspection.baseAnchorSuggestions || Object.freeze([])]))),
    versionBridge: Object.freeze({
      schema: 'CIIWorkspaceSourceSetVersionBridge.v1', mode: 'MULTI_SOURCE_SET_CUSTODY_AND_MEMBER_INSPECTION',
      sourceSetSha256, members: sourceSet.members, target: first.versionBridge.target, conversionSource: first.versionBridge.conversionSource,
    }),
    baseAnchorSuggestions: Object.freeze([]), blockers: Object.freeze([]),
  });
  const preparedMembers = Object.freeze(preparedSources.map((preparedSource, index) =>
    preparedSourceMember(sources[index], index, preparedSource, inspections[index])));
  const preparedSession = Object.freeze({
    schema: CII_PREPARED_SOURCE_SET_SESSION_SCHEMA,
    status: 'PREPARED',
    authority: 'IMMUTABLE_NORMALIZED_MODEL_CUSTODY',
    sourceSetSha256,
    sourceSet,
    target: preparedTargetSession(targetFileName, preparedTarget, first),
    members: preparedMembers,
    versionBridge: Object.freeze({
      schema: 'CIIWorkspacePreparedSourceSetVersionBridge.v1',
      sourceSetSha256,
      target: first.versionBridge.target,
      conversionSource: first.versionBridge.conversionSource,
      v14WritePolicy: first.versionBridge.v14WritePolicy,
    }),
  });
  return Object.freeze({ inspection, preparedSession });
}

export async function inspectCiiWorkspaceSourceSetWithVersionBridge(input, options = {}) {
  const prepared = await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge(input, options);
  return prepared.inspection;
}

export const _test = Object.freeze({
  authoritySha, sourceId, sourceRows, targetCustodyKey, boundedSearchLimit, sourceSetInspectionOptions,
  preparedSourceMember, preparedTargetSession,
});
