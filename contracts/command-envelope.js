/** Versioned platform command envelope; domain engines keep their native payloads. */

import { immutableJson, isIsoTimestamp, requiredContractText } from './contract-values.js';

export const COMMAND_ENVELOPE_SCHEMA = 'CommandEnvelope.v1';
export const COMMAND_ORIGINS = Object.freeze(['USER', 'AUTOFIX', 'SYSTEM', 'LEGACY_IMPORT']);

function normalizeOrigin(value) {
  const source = value && typeof value === 'object' ? value : {};
  const kind = requiredContractText(source.kind, 'Command origin kind').toUpperCase();
  return Object.freeze({ kind, actorId: requiredContractText(source.actorId, 'Command origin actorId'), issuedAt: source.issuedAt ?? null });
}

function normalizeBasis(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    documentHash: requiredContractText(source.documentHash, 'Command basis documentHash'),
    revision: requiredContractText(source.revision, 'Command basis revision'),
  });
}

/** Validate one command envelope without mutating it. */
export function validateCommandEnvelope(envelope) {
  const errors = [];
  if (envelope?.schema !== COMMAND_ENVELOPE_SCHEMA) errors.push(`schema must be ${COMMAND_ENVELOPE_SCHEMA}`);
  for (const key of ['commandId', 'sessionId', 'documentId', 'commandType']) if (!String(envelope?.[key] ?? '').trim()) errors.push(`${key} is required`);
  if (!Number.isInteger(envelope?.sequence) || envelope.sequence < 1) errors.push('sequence must be a positive integer');
  if (!COMMAND_ORIGINS.includes(envelope?.origin?.kind)) errors.push(`origin.kind must be one of ${COMMAND_ORIGINS.join(', ')}`);
  if (!String(envelope?.origin?.actorId ?? '').trim()) errors.push('origin.actorId is required');
  if (envelope?.origin?.kind === 'LEGACY_IMPORT' && envelope.origin.issuedAt !== null) errors.push('legacy import issuedAt must be null');
  if (envelope?.origin?.kind !== 'LEGACY_IMPORT' && !isIsoTimestamp(envelope?.origin?.issuedAt)) errors.push('origin.issuedAt must be an exact ISO timestamp');
  if (!String(envelope?.basis?.documentHash ?? '').trim()) errors.push('basis.documentHash is required');
  if (!String(envelope?.basis?.revision ?? '').trim()) errors.push('basis.revision is required');
  if (!envelope?.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) errors.push('payload must be an object');
  try { immutableJson(envelope?.payload, 'Command payload'); } catch (error) { errors.push(error.message); }
  if (envelope?.inverse !== null) {
    try { immutableJson(envelope?.inverse, 'Command inverse'); } catch (error) { errors.push(error.message); }
  }
  return Object.freeze(errors);
}

/** Create one immutable serializable command envelope. */
export function createCommandEnvelope(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Command envelope input is required.');
  const envelope = Object.freeze({
    schema: COMMAND_ENVELOPE_SCHEMA,
    commandId: requiredContractText(input.commandId, 'commandId'),
    sessionId: requiredContractText(input.sessionId, 'sessionId'),
    documentId: requiredContractText(input.documentId, 'documentId'),
    sequence: Number(input.sequence),
    commandType: requiredContractText(input.commandType, 'commandType').toUpperCase(),
    payload: immutableJson(input.payload, 'Command payload'),
    basis: normalizeBasis(input.basis),
    origin: normalizeOrigin(input.origin),
    transactionId: input.transactionId ? requiredContractText(input.transactionId, 'transactionId') : null,
    inverse: input.inverse === null ? null : immutableJson(input.inverse, 'Command inverse'),
  });
  const errors = validateCommandEnvelope(envelope);
  if (errors.length) throw new TypeError(`Invalid CommandEnvelope: ${errors.join('; ')}`);
  return envelope;
}
