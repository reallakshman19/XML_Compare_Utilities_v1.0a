/** Shared immutable baseline/candidate project document and session contracts. */

import { isIsoTimestamp } from './contract-values.js';

export const PROJECT_DOCUMENT_SCHEMA = 'ProjectDocument.v1';
export const PROJECT_SESSION_SCHEMA = 'ProjectSession.v1';
export const REVISION_SLOT_IDS = Object.freeze(['baseline', 'candidate']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function text(value) { return String(value ?? '').trim(); }
function known(value) { const result = text(value).toUpperCase(); return result || 'UNKNOWN'; }
function frozenArray(value) { return Object.freeze(Array.isArray(value) ? [...value] : []); }

function normalizeStats(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    branchCount: Number(source.branchCount) || 0,
    componentCount: Number(source.componentCount) || 0,
    scanned: Number(source.scanned) || 0,
    matched: Number(source.matched) || 0,
    filtered: Number(source.filtered) || 0,
  });
}

function normalizeScope(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    wildcard: text(source.wildcard),
    selectedIds: Object.freeze(frozenArray(source.selectedIds).map(text).filter(Boolean)),
  });
}

/** Validate a ProjectDocument without mutating it. */
export function validateProjectDocument(document) {
  const errors = [];
  if (document?.schema !== PROJECT_DOCUMENT_SCHEMA) errors.push(`schema must be ${PROJECT_DOCUMENT_SCHEMA}`);
  if (!REVISION_SLOT_IDS.includes(document?.slotId)) errors.push('slotId must be baseline or candidate');
  for (const key of ['documentId', 'fileName', 'stagedSchema', 'rootShape', 'unit', 'verticalAxis', 'coordinateFrame']) if (!text(document?.[key])) errors.push(`${key} is required`);
  if (!isIsoTimestamp(document?.createdAt)) errors.push('createdAt must be an exact ISO timestamp');
  for (const key of ['sourceHash', 'scopedHash']) if (!HASH_PATTERN.test(text(document?.[key]))) errors.push(`${key} must be SHA-256`);
  if (!document?.stats || typeof document.stats !== 'object') errors.push('stats are required');
  if (!document?.scope || typeof document.scope !== 'object') errors.push('scope is required');
  for (const key of ['branchCount', 'componentCount', 'scanned', 'matched', 'filtered']) {
    if (!Number.isInteger(document?.stats?.[key]) || document.stats[key] < 0) errors.push(`stats.${key} must be a non-negative integer`);
  }
  if (!Array.isArray(document?.scope?.selectedIds)) errors.push('scope.selectedIds must be an array');
  return Object.freeze(errors);
}

/** Create an immutable manifest for one loaded revision slot. */
export function createProjectDocument(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Project document input is required.');
  const document = Object.freeze({
    schema: PROJECT_DOCUMENT_SCHEMA, documentId: text(input.documentId), slotId: text(input.slotId),
    fileName: text(input.fileName), sourceHash: text(input.sourceHash).toLowerCase(),
    scopedHash: text(input.scopedHash).toLowerCase(), stagedSchema: text(input.stagedSchema) || 'UNDECLARED',
    rootShape: text(input.rootShape), unit: known(input.unit), verticalAxis: known(input.verticalAxis),
    coordinateFrame: known(input.coordinateFrame), stats: normalizeStats(input.stats),
    scope: normalizeScope(input.scope), createdAt: text(input.createdAt),
  });
  const errors = validateProjectDocument(document);
  if (errors.length) throw new TypeError(`Invalid ProjectDocument: ${errors.join('; ')}`);
  return document;
}

/** Validate the serializable session envelope and its document references. */
export function validateProjectSession(session) {
  const errors = [];
  if (session?.schema !== PROJECT_SESSION_SCHEMA) errors.push(`schema must be ${PROJECT_SESSION_SCHEMA}`);
  if (!text(session?.sessionId)) errors.push('sessionId is required');
  for (const key of ['createdAt', 'updatedAt']) if (!isIsoTimestamp(session?.[key])) errors.push(`${key} must be an exact ISO timestamp`);
  if (!session?.documents || typeof session.documents !== 'object') errors.push('documents are required');
  for (const slotId of REVISION_SLOT_IDS) {
    const document = session?.documents?.[slotId];
    if (document) errors.push(...validateProjectDocument(document).map((error) => `${slotId}: ${error}`));
    if (document && document.slotId !== slotId) errors.push(`${slotId}: document slot mismatch`);
  }
  return Object.freeze(errors);
}

/** Create an empty baseline/candidate project session. */
export function createProjectSession(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Project session input is required.');
  const session = Object.freeze({
    schema: PROJECT_SESSION_SCHEMA, sessionId: text(input.sessionId), createdAt: text(input.createdAt),
    updatedAt: text(input.createdAt), documents: Object.freeze({ baseline: null, candidate: null }),
  });
  const errors = validateProjectSession(session);
  if (errors.length) throw new TypeError(`Invalid ProjectSession: ${errors.join('; ')}`);
  return session;
}

/** Return a new session containing the supplied revision document. */
export function attachProjectDocument(session, document, updatedAt) {
  const errors = [...validateProjectSession(session), ...validateProjectDocument(document)];
  if (errors.length) throw new TypeError(`Cannot attach document: ${errors.join('; ')}`);
  const documents = Object.freeze({ ...session.documents, [document.slotId]: document });
  return Object.freeze({ ...session, updatedAt: text(updatedAt), documents });
}

function compareMetadata(left, right, key, label, blockers, warnings) {
  const a = known(left[key]), b = known(right[key]);
  if (a === 'UNKNOWN' || b === 'UNKNOWN') warnings.push(`${label} is not declared on both revisions.`);
  else if (a !== b) blockers.push(`${label} mismatch: ${a} vs ${b}.`);
}

/** Produce explicit blockers/warnings before any comparison can run. */
export function projectSessionPreflight(session) {
  const errors = validateProjectSession(session);
  if (errors.length) return Object.freeze({ status: 'BLOCKED', blockers: errors, warnings: Object.freeze([]), notes: Object.freeze([]) });
  const left = session.documents.baseline, right = session.documents.candidate;
  if (!left || !right) {
    const missing = REVISION_SLOT_IDS.filter((slotId) => !session.documents[slotId]);
    return Object.freeze({ status: 'INCOMPLETE', blockers: Object.freeze(missing.map((slot) => `${slot} revision is not loaded.`)), warnings: Object.freeze([]), notes: Object.freeze([]) });
  }
  const blockers = [], warnings = [], notes = [];
  if (left.stagedSchema !== 'UNDECLARED' && right.stagedSchema !== 'UNDECLARED' && left.stagedSchema !== right.stagedSchema) blockers.push(`Schema mismatch: ${left.stagedSchema} vs ${right.stagedSchema}.`);
  if (left.rootShape !== right.rootShape) warnings.push(`Root shape differs: ${left.rootShape} vs ${right.rootShape}; each writer must preserve its target shape.`);
  compareMetadata(left, right, 'unit', 'Unit', blockers, warnings);
  compareMetadata(left, right, 'verticalAxis', 'Vertical axis', blockers, warnings);
  compareMetadata(left, right, 'coordinateFrame', 'Coordinate frame', blockers, warnings);
  if (left.sourceHash === right.sourceHash) notes.push('Baseline and candidate source hashes are identical.');
  return Object.freeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers: Object.freeze(blockers), warnings: Object.freeze(warnings), notes: Object.freeze(notes) });
}

/** Serialize the reviewable manifest; raw staged JSON is intentionally absent. */
export function serializeProjectSession(session) {
  const errors = validateProjectSession(session);
  if (errors.length) throw new TypeError(`Cannot serialize ProjectSession: ${errors.join('; ')}`);
  return `${JSON.stringify({ ...session, preflight: projectSessionPreflight(session) }, null, 2)}\n`;
}
