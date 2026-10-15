/** Two-slot worker-backed intake service with lossless transfer snapshots and compare projection. */
import { createProjectDocument, REVISION_SLOT_IDS } from './revision-session-contracts.js';
import { createRevisionWorkerClient } from './revision-intake-worker-client.js';
import {
  createRevisionCompareJsonDocumentSnapshot,
  rebindRevisionCompareJsonDocumentSnapshot,
} from './revision-json-document.js';
import { sha256Bytes, sha256Text } from './revision-hash.js';
import { cleanText, deepFreeze, frozenStrings } from './revision-contract-utils.js';

const SLOT_ROLES = Object.freeze({ baseline: 'REFERENCE', candidate: 'CANDIDATE' });
const SNAPSHOT_SIDES = Object.freeze({ baseline: 'REV_A', candidate: 'REV_B' });
export class RevisionRequestSupersededError extends Error {
  constructor(slotId) { super(`${slotId} revision request was superseded.`); this.name = 'RevisionRequestSupersededError'; this.code = 'REVISION_REQUEST_SUPERSEDED'; }
}
function assertSlot(slotId) { if (!REVISION_SLOT_IDS.includes(slotId)) throw new RangeError(`Unknown revision slot: ${slotId}`); }
function branchSummary(branchIndex) {
  return deepFreeze({
    branchCount: branchIndex.length, componentCount: branchIndex.reduce((sum, entry) => sum + entry.componentCount, 0),
    recordCount: branchIndex.reduce((sum, entry) => sum + entry.recordCount, 0), geometryEvidenceCount: branchIndex.reduce((sum, entry) => sum + entry.geometryEvidenceCount, 0),
  });
}
function intakeWarnings(metadata, summary) {
  const warnings = [];
  for (const [key, label] of [['unit', 'Units'], ['coordinateFrame', 'Coordinate frame'], ['verticalAxis', 'Vertical axis']]) if (metadata[key] === 'UNKNOWN') warnings.push(`${label} are not declared.`);
  if (!summary.geometryEvidenceCount) warnings.push('Geometry evidence is absent from the staged scope.');
  if (summary.branchCount > 500 || summary.componentCount > 10000) warnings.push('Large revision detected; refine scope deliberately.');
  return Object.freeze(warnings);
}
function metadataEvidence(metadata, sourceHash) {
  const profile = metadata.profile;
  if (!profile) return null;
  return deepFreeze({
    authority: profile.authority,
    evidenceId: `metadata-profile:${sourceHash.slice(0, 24)}:${profile.profileId}`,
    profileId: profile.profileId,
    sourceHash,
    fields: profile.fields,
    explanation: profile.explanation,
  });
}
function normalizeScope(scope) { return deepFreeze({ wildcard: cleanText(scope?.wildcard), selectedIds: frozenStrings(scope?.selectedIds) }); }
function decodeJsonBytes(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new TypeError('Revision input must be valid UTF-8 staged JSON.'); }
}
function parseLosslessJson(text) {
  try { return JSON.parse(text); }
  catch (error) { throw new TypeError(`Revision input must be valid staged JSON: ${error.message}`); }
}
function beginRequest(context, slotId) {
  assertSlot(slotId); if (context.disposed) throw new Error('Revision load service is disposed.');
  const generation = context.generations.get(slotId) + 1; context.generations.set(slotId, generation); return generation;
}
function assertCurrent(context, slotId, generation) {
  if (context.disposed || context.generations.get(slotId) !== generation) throw new RevisionRequestSupersededError(slotId);
}
async function buildDocument(context, slotId, source, filtered, scope, now) {
  const scopedHash = await sha256Text(JSON.stringify(filtered.filtered), context.cryptoRef); assertCurrent(context, slotId, source.generation);
  return createProjectDocument({
    documentId: `${slotId}:${source.sourceHash.slice(0, 20)}`, slotId, role: SLOT_ROLES[slotId], fileName: source.fileName,
    fileSizeBytes: source.fileSizeBytes, sourceHash: source.sourceHash, scopedHash, stagedSchema: source.metadata.stagedSchema,
    rootShape: source.rootShape, unit: source.metadata.unit, verticalAxis: source.metadata.verticalAxis,
    coordinateFrame: source.metadata.coordinateFrame, metadataEvidence: metadataEvidence(source.metadata, source.sourceHash),
    scope, createdAt: now, stats: filtered.stats,
  });
}
function scopeResult(document, filtered) {
  return deepFreeze({ selectedBranchIds: filtered.retainedBranchIds, retainedBranchCount: document.stats.branchCount, retainedComponentCount: document.stats.componentCount, retainedRecordCount: document.stats.recordCount, scopedHash: document.scopedHash });
}
function sourceRecord(generation, fileName, fileSizeBytes, sourceHash, parsed) {
  const summary = branchSummary(parsed.branchIndex);
  return deepFreeze({ generation, fileName, fileSizeBytes, sourceHash, rootShape: parsed.rootShape, metadata: parsed.metadata, branchTree: parsed.branchTree, branchIndex: parsed.branchIndex, branchIndexSummary: summary });
}
async function losslessSnapshot(context, slotId, source, document, parsedValue) {
  const snapshot = await createRevisionCompareJsonDocumentSnapshot({
    side: SNAPSHOT_SIDES[slotId], sourceDocumentId: document.documentId, sourceContentSha256: source.sourceHash,
    fileName: source.fileName, profile: source.metadata.stagedSchema, parsedValue,
  }, context.cryptoRef);
  assertCurrent(context, slotId, source.generation); return snapshot;
}
function loadResult(source, document, jsonSnapshot, filtered) {
  return deepFreeze({
    generation: source.generation, document, jsonSnapshot, branchTree: source.branchTree,
    branchIndex: source.branchIndex, branchIndexSummary: source.branchIndexSummary,
    scopeResult: scopeResult(document, filtered), warnings: intakeWarnings(source.metadata, source.branchIndexSummary), blockers: [],
  });
}
async function loadBytes(context, slotId, fileName, bytesValue, now, suppliedGeneration) {
  assertSlot(slotId); const generation = suppliedGeneration ?? beginRequest(context, slotId);
  const bytes = bytesValue instanceof Uint8Array ? bytesValue : new Uint8Array(bytesValue);
  if (!bytes.length) throw new TypeError(`${slotId} revision file is empty.`);
  const sourceHash = await sha256Bytes(bytes, context.cryptoRef); assertCurrent(context, slotId, generation);
  const text = decodeJsonBytes(bytes); const parsedValue = parseLosslessJson(text);
  const parsed = await context.clients.get(slotId).parse(text, sourceHash); assertCurrent(context, slotId, generation);
  const source = sourceRecord(generation, cleanText(fileName) || `${slotId}.json`, bytes.byteLength, sourceHash, parsed); context.sources.set(slotId, source);
  const filtered = await context.clients.get(slotId).filter({ selectedIds: [] }); assertCurrent(context, slotId, generation);
  const document = await buildDocument(context, slotId, source, filtered, normalizeScope({}), now);
  const jsonSnapshot = await losslessSnapshot(context, slotId, source, document, parsedValue);
  const result = loadResult(source, document, jsonSnapshot, filtered);
  context.sources.set(slotId, deepFreeze({ ...source, initialResult: result }));
  return result;
}
async function applyScope(context, slotId, requestedScope, now) {
  assertSlot(slotId); const source = context.sources.get(slotId);
  if (!source) throw new Error(`${slotId} revision must be loaded before scope can be applied.`);
  const scope = normalizeScope(requestedScope); const filtered = await context.clients.get(slotId).filter(scope); assertCurrent(context, slotId, source.generation);
  if (!filtered.stats.matched) throw new Error(`${slotId} scope retains no branches.`);
  const document = await buildDocument(context, slotId, source, filtered, scope, now);
  return deepFreeze({ generation: source.generation, document, scopeResult: scopeResult(document, filtered), warnings: intakeWarnings(source.metadata, source.branchIndexSummary), blockers: [] });
}
function projectionRequest(slotId, basis) {
  const sideA = slotId === 'baseline';
  return deepFreeze({
    basisId: basis.basisId, side: sideA ? 'A' : 'B', sourceDocumentId: sideA ? basis.revADocumentId : basis.revBDocumentId,
    sourceHash: sideA ? basis.revAContentHash : basis.revBContentHash, scopedHash: sideA ? basis.revAScopeIdentity : basis.revBScopeIdentity,
    selectedBranchIds: sideA ? basis.includedBranchesA : basis.includedBranchesB,
  });
}
async function projectCompareRecords(context, slotId, basis) {
  assertSlot(slotId); const source = context.sources.get(slotId);
  if (!source) throw new Error(`${slotId} revision must be loaded before comparison projection.`);
  assertCurrent(context, slotId, source.generation);
  const projection = await context.clients.get(slotId).projectCompareRecords(projectionRequest(slotId, basis));
  assertCurrent(context, slotId, source.generation); return projection;
}
function swappableSource(context, slotId) {
  const source = context.sources.get(slotId);
  if (!source?.initialResult || source.generation !== context.generations.get(slotId)) {
    throw new Error(`${slotId} revision is not ready to swap.`);
  }
  return source;
}
function rebindDocument(document, slotId) {
  return createProjectDocument({
    ...document,
    documentId: `${slotId}:${document.sourceHash.slice(0, 20)}`,
    slotId,
    role: SLOT_ROLES[slotId],
  });
}
function reboundLoadResult(source, slotId, generation) {
  const document = rebindDocument(source.initialResult.document, slotId);
  const jsonSnapshot = rebindRevisionCompareJsonDocumentSnapshot(
    source.initialResult.jsonSnapshot,
    SNAPSHOT_SIDES[slotId],
    document.documentId,
  );
  return deepFreeze({ ...source.initialResult, generation, document, jsonSnapshot });
}
function swapLoadedSlots(context) {
  if (context.disposed) throw new Error('Revision load service is disposed.');
  const baselineSource = swappableSource(context, 'baseline');
  const candidateSource = swappableSource(context, 'candidate');
  const baselineGeneration = context.generations.get('baseline') + 1;
  const candidateGeneration = context.generations.get('candidate') + 1;
  const baseline = reboundLoadResult(candidateSource, 'baseline', baselineGeneration);
  const candidate = reboundLoadResult(baselineSource, 'candidate', candidateGeneration);
  const baselineClient = context.clients.get('baseline');
  context.clients.set('baseline', context.clients.get('candidate'));
  context.clients.set('candidate', baselineClient);
  context.generations.set('baseline', baselineGeneration);
  context.generations.set('candidate', candidateGeneration);
  context.sources.set('baseline', deepFreeze({ ...candidateSource, generation: baselineGeneration, initialResult: baseline }));
  context.sources.set('candidate', deepFreeze({ ...baselineSource, generation: candidateGeneration, initialResult: candidate }));
  return deepFreeze({ baseline, candidate });
}
async function cancelRequest(context, slotId) {
  const generation = beginRequest(context, slotId); context.sources.delete(slotId); await context.clients.get(slotId).reset(); return generation;
}
function disposeService(context) {
  if (context.disposed) return; context.disposed = true; for (const client of context.clients.values()) client.dispose(); context.clients.clear(); context.sources.clear();
}
export function createRevisionLoadService(cryptoRef, options = {}) {
  const clientFactory = options.clientFactory ?? (() => createRevisionWorkerClient());
  const context = { cryptoRef, clients: new Map(REVISION_SLOT_IDS.map((slotId) => [slotId, clientFactory(slotId)])), sources: new Map(), generations: new Map(REVISION_SLOT_IDS.map((slotId) => [slotId, 0])), disposed: false };
  return Object.freeze({
    begin: (slotId) => beginRequest(context, slotId),
    loadBytes: (slotId, name, bytes, now, generation) => loadBytes(context, slotId, name, bytes, now, generation),
    loadText: (slotId, name, text, now, generation) => loadBytes(context, slotId, name, new TextEncoder().encode(String(text ?? '')), now, generation),
    loadFile: async (slotId, file, now, generation) => {
      if (!file?.arrayBuffer) throw new TypeError(`${slotId} revision file is required.`);
      return loadBytes(context, slotId, file.name, new Uint8Array(await file.arrayBuffer()), now, generation);
    },
    applyScope: (slotId, scope, now) => applyScope(context, slotId, scope, now),
    projectCompareRecords: (slotId, basis) => projectCompareRecords(context, slotId, basis),
    swapLoadedSlots: () => swapLoadedSlots(context),
    cancel: (slotId) => cancelRequest(context, slotId), dispose: () => disposeService(context),
  });
}

export const _test = Object.freeze({ metadataEvidence, reboundLoadResult, rebindDocument, swapLoadedSlots, swappableSource });
