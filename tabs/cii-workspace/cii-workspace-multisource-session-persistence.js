import { CII_METHOD_A_WEIGHT_DEFAULTS, CII_METHOD_A_WEIGHT_KEYS, validateCiiMethodAConfidenceWeights } from './cii-workspace-method-a-weights.js';
import { deepFreeze } from './cii-workspace-contracts.js';
import {
  ciiQualifiedLoopsForSuggestion,
  ciiSuggestionSelectionKey,
} from './cii-workspace-base-loop-selection.js';

export const CII_MS_SESSION_SCHEMA = 'CIIWorkspaceWriter2Session.v1';
const STORAGE_PREFIX = 'cii-writer2-session-v1:';
const REVIEW_DECISIONS = new Set(['LOCK', 'ACCEPT', 'REJECT']);
const REVIEW_CONFIDENCE_FILTERS = new Set(['ALL', 'HIGH', 'MEDIUM', 'REVIEW', 'UNRESOLVED', 'LOCKED']);
const SCOPE_INTENTS = new Set(['BOUND_EXPECTED_NODENAME']);

function text(value) { return String(value ?? '').trim(); }
function objectEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  return value && typeof value === 'object' ? Object.entries(value) : [];
}
function arrayValue(value) {
  if (value instanceof Set) return [...value];
  return Array.isArray(value) ? value : [];
}
function validNode(value) {
  const raw = text(value); const number = Number(raw);
  return raw && Number.isSafeInteger(number) ? String(number) : null;
}
function frozenObject(entries) { return deepFreeze(Object.fromEntries(entries)); }
function normalizedFilters(value = {}) {
  const confidence = text(value?.confidence || 'ALL').toUpperCase();
  return deepFreeze({
    confidence: REVIEW_CONFIDENCE_FILTERS.has(confidence) ? confidence : 'ALL',
    search: String(value?.search || '').slice(0, 256),
    changedOnly: Boolean(value?.changedOnly),
  });
}
function normalizedScopeIntent(value) {
  const intent = text(value).toUpperCase();
  return SCOPE_INTENTS.has(intent) ? intent : null;
}

export function ciiWriter2SessionStorage(windowRef = globalThis) {
  try { return windowRef?.localStorage || null; } catch { return null; }
}

export function ciiWriter2SessionStorageKey(sourceSetSha256, targetOriginalSha256) {
  const source = text(sourceSetSha256); const target = text(targetOriginalSha256);
  if (!source || !target) return null;
  return `${STORAGE_PREFIX}${source}:${target}`;
}

export function ciiWriter2SessionCustody(inspection) {
  const sourceSetSha256 = text(inspection?.sourceSet?.sourceSetSha256);
  const targetOriginalSha256 = text(inspection?.versionBridge?.target?.originalSha256);
  const storageKey = ciiWriter2SessionStorageKey(sourceSetSha256, targetOriginalSha256);
  return storageKey ? deepFreeze({ sourceSetSha256, targetOriginalSha256, storageKey }) : null;
}

function selectedObject(value) {
  return frozenObject(objectEntries(value).map(([sourceId, rows]) => [text(sourceId), deepFreeze(arrayValue(rows).map(text).filter(Boolean))]));
}
function manualObject(value) {
  return frozenObject(objectEntries(value).map(([sourceId, rows]) => [text(sourceId), deepFreeze(arrayValue(rows).flatMap((row) => {
    const sourceNodeId = validNode(row?.sourceNodeId); const targetNodeId = validNode(row?.targetNodeId);
    return sourceNodeId && targetNodeId ? [deepFreeze({ sourceNodeId, targetNodeId })] : [];
  }))]));
}
function modeObject(value) {
  return frozenObject(objectEntries(value).map(([sourceId,mode])=>{
    if(mode!=='AUTO'&&mode!=='MANUAL')throw Error('CII_MS_UNKNOWN_ANCHOR_MODE');
    return [text(sourceId),mode];
  }));
}
function draftObject(value) {
  return frozenObject(objectEntries(value).map(([sourceId, row]) => [text(sourceId), deepFreeze({
    sourceNodeId: text(row?.sourceNodeId).slice(0, 64),
    targetNodeId: text(row?.targetNodeId).slice(0, 64),
  })]));
}
function reviewObject(value) {
  return frozenObject(objectEntries(value).flatMap(([id, decision]) => {
    const correspondenceId = text(id); const normalized = text(decision).toUpperCase();
    return correspondenceId && REVIEW_DECISIONS.has(normalized) ? [[correspondenceId, normalized]] : [];
  }));
}

// Old sessions have no policy custody and cannot safely restore confidence-based
// approvals after the grading policy becomes configurable.
export function ciiWriter2SessionPolicyMatches(snapshot, policy) {
  const stored = snapshot?.confidencePolicy;
  return stored != null && policy != null
    && Number.isFinite(stored.high) && Number.isFinite(stored.medium)
    && stored.high === Number(policy.methodAHighConfidenceThreshold)
    && stored.medium === Number(policy.methodAMediumConfidenceThreshold)
    && Boolean(stored.weights)
    && CII_METHOD_A_WEIGHT_KEYS.every((key) =>
      Number.isFinite(stored.weights[key])
      && stored.weights[key] === (policy.methodAConfidenceWeights ?? CII_METHOD_A_WEIGHT_DEFAULTS)[key]);
}

export function createCiiWriter2SessionSnapshot(input = {}) {
  const sourceSetSha256 = text(input.sourceSetSha256); const targetOriginalSha256 = text(input.targetOriginalSha256);
  if (!ciiWriter2SessionStorageKey(sourceSetSha256, targetOriginalSha256)) return null;
  return deepFreeze({
    schema: CII_MS_SESSION_SCHEMA,
    sourceSetSha256,
    targetOriginalSha256,
    ...(input.confidencePolicy ? { confidencePolicy: deepFreeze({
      high: Number(input.confidencePolicy.methodAHighConfidenceThreshold),
      medium: Number(input.confidencePolicy.methodAMediumConfidenceThreshold),
      weights: input.confidencePolicy.methodAConfidenceWeights
        ? validateCiiMethodAConfidenceWeights(input.confidencePolicy.methodAConfidenceWeights)
        : CII_METHOD_A_WEIGHT_DEFAULTS,
    }) } : {}),
    selectedBySource: selectedObject(input.selectedBySource),
    manualBySource: manualObject(input.manualBySource),
    authorityModeBySource: modeObject(input.authorityModeBySource),
    manualDraftBySource: draftObject(input.manualDraftBySource),
    reviewFilters: normalizedFilters(input.reviewFilters),
    scopeIntent: normalizedScopeIntent(input.scopeIntent),
    review: deepFreeze({
      correspondenceIdentity: text(input.correspondenceIdentity),
      decisions: reviewObject(input.reviewDecisions),
    }),
  });
}

function validSelectionKeysBySource(inspection) {
  const result = {};
  for (const member of inspection?.memberInspections || []) {
    const sourceId = text(member?.sourceId); if (!sourceId) continue;
    const keys = new Set();
    for (const suggestion of member?.inspection?.baseAnchorSuggestions || []) {
      if (!ciiQualifiedLoopsForSuggestion(suggestion).length) continue;
      const key = ciiSuggestionSelectionKey(suggestion); if (key) keys.add(key);
    }
    result[sourceId] = keys;
  }
  return result;
}

function custodyMatches(snapshot, custody) {
  return snapshot?.schema === CII_MS_SESSION_SCHEMA
    && text(snapshot?.sourceSetSha256) === text(custody?.sourceSetSha256)
    && text(snapshot?.targetOriginalSha256) === text(custody?.targetOriginalSha256);
}

export function restoreCiiWriter2AnchorSnapshot(snapshot, custody, sourceIds = [], rawValidSelectionKeysBySource = {}) {
  if (!custody || !custodyMatches(snapshot, custody)) return null;
  const selected = {}; const manual = {}; const drafts = {}; const authorityModeBySource = {}; const staleSelectionSourceIds = [];
  for (const rawSourceId of sourceIds || []) {
    const sourceId = text(rawSourceId); if (!sourceId) continue;
    const allowedRaw = rawValidSelectionKeysBySource?.[sourceId];
    const allowed = allowedRaw instanceof Set ? allowedRaw : new Set(arrayValue(allowedRaw).map(text).filter(Boolean));
    const persistedKeys = arrayValue(snapshot?.selectedBySource?.[sourceId]).map(text).filter(Boolean);
    if (persistedKeys.some((key) => !allowed.has(key))) staleSelectionSourceIds.push(sourceId);
    selected[sourceId] = deepFreeze(persistedKeys.filter((key) => allowed.has(key)));
    const seen = new Set();
    manual[sourceId] = deepFreeze(arrayValue(snapshot?.manualBySource?.[sourceId]).flatMap((row) => {
      const sourceNodeId = validNode(row?.sourceNodeId); const targetNodeId = validNode(row?.targetNodeId);
      if (!sourceNodeId || !targetNodeId) return [];
      const key = `${sourceNodeId}=>${targetNodeId}`; if (seen.has(key)) return []; seen.add(key);
      return [deepFreeze({ sourceNodeId, targetNodeId })];
    }));
    drafts[sourceId] = deepFreeze({
      sourceNodeId: text(snapshot?.manualDraftBySource?.[sourceId]?.sourceNodeId).slice(0, 64),
      targetNodeId: text(snapshot?.manualDraftBySource?.[sourceId]?.targetNodeId).slice(0, 64),
    });
    const originalMode = snapshot?.authorityModeBySource?.[sourceId];
    // Old persisted sessions deliberately favoured manual if it was present.
    // Preserve that effective mode, but stop discarding qualified saved auto evidence.
    authorityModeBySource[sourceId] = originalMode === 'AUTO' || originalMode === 'MANUAL'
      ? originalMode : manual[sourceId].length ? 'MANUAL' : 'AUTO';
  }
  return deepFreeze({
    custody,
    selectedBySource: frozenObject(Object.entries(selected)),
    manualBySource: frozenObject(Object.entries(manual)),
    authorityModeBySource: frozenObject(Object.entries(authorityModeBySource)),
    manualDraftBySource: frozenObject(Object.entries(drafts)),
    reviewFilters: normalizedFilters(snapshot?.reviewFilters),
    scopeIntent: normalizedScopeIntent(snapshot?.scopeIntent),
    staleSelectionSourceIds: deepFreeze(staleSelectionSourceIds),
  });
}

export function restoreCiiWriter2AnchorSession(snapshot, inspection) {
  const custody = ciiWriter2SessionCustody(inspection);
  const sourceIds = (inspection?.memberInspections || []).map((member) => text(member?.sourceId)).filter(Boolean);
  return restoreCiiWriter2AnchorSnapshot(snapshot, custody, sourceIds, validSelectionKeysBySource(inspection));
}

export function restoreCiiWriter2ReviewDecisions(snapshot, correspondenceIdentity, validCorrespondenceIds = []) {
  const identity = text(correspondenceIdentity);
  if (!identity || text(snapshot?.review?.correspondenceIdentity) !== identity) return deepFreeze({ matched: false, decisions: deepFreeze({}) });
  const allowed = new Set((validCorrespondenceIds || []).map(text).filter(Boolean));
  const decisions = Object.entries(snapshot?.review?.decisions || {}).flatMap(([id, decision]) => {
    const key = text(id); const normalized = text(decision).toUpperCase();
    return key && allowed.has(key) && REVIEW_DECISIONS.has(normalized) ? [[key, normalized]] : [];
  });
  return deepFreeze({ matched: true, decisions: frozenObject(decisions) });
}

export function loadCiiWriter2Session(storage, storageKey) {
  if (!storage || !storageKey) return null;
  try {
    const raw = storage.getItem(storageKey); if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.schema === CII_MS_SESSION_SCHEMA ? parsed : null;
  } catch { return null; }
}

export function saveCiiWriter2Session(storage, storageKey, snapshot) {
  if (!storage || !storageKey || !snapshot) return false;
  try { storage.setItem(storageKey, JSON.stringify(snapshot)); return true; } catch { return false; }
}

export const _test = Object.freeze({
  validNode, selectedObject, manualObject, draftObject, reviewObject, custodyMatches, validSelectionKeysBySource,
  normalizedFilters, normalizedScopeIntent,
});