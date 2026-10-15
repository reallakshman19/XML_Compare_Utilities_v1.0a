/** Immutable document and session manifests for trusted Revision Compare intake. */

import { cleanText, deepFreeze, frozenStrings } from './revision-contract-utils.js';

export const PROJECT_DOCUMENT_SCHEMA = 'ProjectDocument.v1';
export const PROJECT_SESSION_SCHEMA = 'ProjectSession.v1';
export const REVISION_SLOT_IDS = Object.freeze(['baseline', 'candidate']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const PROFILE_AUTHORITY = 'BOUNDED_PRODUCT_COMPATIBILITY_PROFILE';
const METADATA_KEYS = Object.freeze(['unit', 'coordinateFrame', 'verticalAxis']);

function known(value) {
  return cleanText(value).toUpperCase() || 'UNKNOWN';
}

function normalizedScope(value) {
  const source = value && typeof value === 'object' ? value : {};
  return deepFreeze({
    wildcard: cleanText(source.wildcard),
    selectedIds: frozenStrings(source.selectedIds),
  });
}

function normalizedStats(value) {
  const source = value && typeof value === 'object' ? value : {};
  const integer = (key) => Math.max(0, Math.trunc(Number(source[key]) || 0));
  return deepFreeze({
    branchCount: integer('branchCount'),
    componentCount: integer('componentCount'),
    recordCount: integer('recordCount'),
    geometryEvidenceCount: integer('geometryEvidenceCount'),
    scanned: integer('scanned'),
    matched: integer('matched'),
    filtered: integer('filtered'),
  });
}

function normalizedMetadataEvidence(value) {
  if (!value) return null;
  return deepFreeze({
    authority: cleanText(value.authority),
    evidenceId: cleanText(value.evidenceId),
    profileId: cleanText(value.profileId),
    sourceHash: cleanText(value.sourceHash).toLowerCase(),
    fields: Object.fromEntries(METADATA_KEYS.map((key) => [key, known(value.fields?.[key])])),
    explanation: cleanText(value.explanation),
  });
}

function timestamp(value) {
  const text = cleanText(value);
  return Number.isNaN(Date.parse(text)) ? '' : text;
}

function metadataEvidenceErrors(document) {
  const evidence = document?.metadataEvidence;
  if (!evidence) return [];
  const errors = [];
  if (evidence.authority !== PROFILE_AUTHORITY) errors.push('metadataEvidence.authority is invalid');
  for (const key of ['evidenceId', 'profileId', 'explanation']) {
    if (!cleanText(evidence[key])) errors.push(`metadataEvidence.${key} is required`);
  }
  if (evidence.sourceHash !== document.sourceHash) errors.push('metadataEvidence.sourceHash must match sourceHash');
  for (const key of METADATA_KEYS) {
    if (known(evidence.fields?.[key]) !== known(document?.[key])) {
      errors.push(`metadataEvidence.fields.${key} must match document metadata`);
    }
  }
  return errors;
}

export function validateProjectDocument(document) {
  const errors = [];
  if (document?.schema !== PROJECT_DOCUMENT_SCHEMA) errors.push(`schema must be ${PROJECT_DOCUMENT_SCHEMA}`);
  if (!REVISION_SLOT_IDS.includes(document?.slotId)) errors.push('slotId must be baseline or candidate');
  for (const key of ['documentId', 'fileName', 'stagedSchema', 'rootShape', 'unit', 'verticalAxis', 'coordinateFrame']) {
    if (!cleanText(document?.[key])) errors.push(`${key} is required`);
  }
  if (!HASH_PATTERN.test(cleanText(document?.sourceHash))) errors.push('sourceHash must be SHA-256');
  if (!HASH_PATTERN.test(cleanText(document?.scopedHash))) errors.push('scopedHash must be SHA-256');
  if (!Number.isInteger(document?.fileSizeBytes) || document.fileSizeBytes < 0) errors.push('fileSizeBytes must be non-negative');
  if (!timestamp(document?.createdAt)) errors.push('createdAt must be an ISO timestamp');
  if (!document?.stats || !document?.scope) errors.push('stats and scope are required');
  errors.push(...metadataEvidenceErrors(document));
  return Object.freeze(errors);
}

export function createProjectDocument(input) {
  const metadataEvidence = normalizedMetadataEvidence(input?.metadataEvidence);
  const document = deepFreeze({
    schema: PROJECT_DOCUMENT_SCHEMA,
    documentId: cleanText(input?.documentId),
    slotId: cleanText(input?.slotId),
    role: cleanText(input?.role),
    fileName: cleanText(input?.fileName),
    fileSizeBytes: Math.max(0, Math.trunc(Number(input?.fileSizeBytes) || 0)),
    sourceHash: cleanText(input?.sourceHash).toLowerCase(),
    scopedHash: cleanText(input?.scopedHash).toLowerCase(),
    stagedSchema: cleanText(input?.stagedSchema) || 'UNKNOWN',
    rootShape: cleanText(input?.rootShape),
    unit: known(input?.unit),
    verticalAxis: known(input?.verticalAxis),
    coordinateFrame: known(input?.coordinateFrame),
    ...(metadataEvidence ? { metadataEvidence } : {}),
    stats: normalizedStats(input?.stats),
    scope: normalizedScope(input?.scope),
    createdAt: cleanText(input?.createdAt),
  });
  const errors = validateProjectDocument(document);
  if (errors.length) throw new TypeError(`Invalid ProjectDocument: ${errors.join('; ')}`);
  return document;
}

export function validateProjectSession(session) {
  const errors = [];
  if (session?.schema !== PROJECT_SESSION_SCHEMA) errors.push(`schema must be ${PROJECT_SESSION_SCHEMA}`);
  if (!cleanText(session?.sessionId)) errors.push('sessionId is required');
  for (const key of ['createdAt', 'updatedAt']) if (!timestamp(session?.[key])) errors.push(`${key} must be an ISO timestamp`);
  for (const slotId of REVISION_SLOT_IDS) {
    const document = session?.documents?.[slotId];
    if (document) errors.push(...validateProjectDocument(document).map((error) => `${slotId}: ${error}`));
    if (document && document.slotId !== slotId) errors.push(`${slotId}: document slot mismatch`);
  }
  return Object.freeze(errors);
}

export function createProjectSession(input) {
  const createdAt = cleanText(input?.createdAt);
  const session = deepFreeze({
    schema: PROJECT_SESSION_SCHEMA,
    sessionId: cleanText(input?.sessionId),
    createdAt,
    updatedAt: createdAt,
    documents: { baseline: null, candidate: null },
  });
  const errors = validateProjectSession(session);
  if (errors.length) throw new TypeError(`Invalid ProjectSession: ${errors.join('; ')}`);
  return session;
}

export function attachProjectDocument(session, document, updatedAt) {
  const errors = [...validateProjectSession(session), ...validateProjectDocument(document)];
  if (errors.length) throw new TypeError(`Cannot attach document: ${errors.join('; ')}`);
  return deepFreeze({
    ...session,
    updatedAt: cleanText(updatedAt),
    documents: { ...session.documents, [document.slotId]: document },
  });
}

export function detachProjectDocument(session, slotId, updatedAt) {
  if (!REVISION_SLOT_IDS.includes(slotId)) throw new RangeError(`Unknown revision slot: ${slotId}`);
  const errors = validateProjectSession(session);
  if (errors.length) throw new TypeError(`Cannot detach document: ${errors.join('; ')}`);
  return deepFreeze({
    ...session,
    updatedAt: cleanText(updatedAt),
    documents: { ...session.documents, [slotId]: null },
  });
}

export function serializeProjectSession(session) {
  const errors = validateProjectSession(session);
  if (errors.length) throw new TypeError(`Cannot serialize ProjectSession: ${errors.join('; ')}`);
  return `${JSON.stringify(session, null, 2)}\n`;
}
