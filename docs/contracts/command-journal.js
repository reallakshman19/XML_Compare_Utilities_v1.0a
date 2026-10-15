/** Append-only CommandJournal.v1 with active/redo projections and checkpoints. */

import { createCommandEnvelope, validateCommandEnvelope } from './command-envelope.js';
import { immutableJson, isIsoTimestamp, requiredContractText } from './contract-values.js';

export const COMMAND_JOURNAL_SCHEMA = 'CommandJournal.v1';
export const COMMAND_CHECKPOINT_SCHEMA = 'CommandCheckpoint.v1';

function freezeIds(value) {
  if (!Array.isArray(value)) throw new TypeError('Journal command id collection must be an array.');
  return Object.freeze(value.map((item) => requiredContractText(item, 'Journal command id')));
}

function validateReferences(journal, errors) {
  const entryIds = new Set(journal.entries?.map((entry) => entry.commandId) ?? []);
  const active = journal.activeCommandIds ?? [], redo = journal.redoCommandIds ?? [];
  for (const id of [...active, ...redo]) if (!entryIds.has(id)) errors.push(`unknown command reference ${id}`);
  if (new Set(active).size !== active.length) errors.push('activeCommandIds must be unique');
  if (new Set(redo).size !== redo.length) errors.push('redoCommandIds must be unique');
  if (active.some((id) => redo.includes(id))) errors.push('active and redo command ids must be disjoint');
  for (const checkpoint of journal.checkpoints ?? []) {
    for (const id of checkpoint.activeCommandIds ?? []) if (!entryIds.has(id)) errors.push(`${checkpoint.checkpointId} references unknown command ${id}`);
  }
}

/** Validate journal identity, envelope integrity and active/redo references. */
export function validateCommandJournal(journal) {
  const errors = [];
  if (journal?.schema !== COMMAND_JOURNAL_SCHEMA) errors.push(`schema must be ${COMMAND_JOURNAL_SCHEMA}`);
  for (const key of ['journalId', 'sessionId', 'documentId']) if (!String(journal?.[key] ?? '').trim()) errors.push(`${key} is required`);
  for (const key of ['createdAt', 'updatedAt']) if (!isIsoTimestamp(journal?.[key])) errors.push(`${key} must be an exact ISO timestamp`);
  if (!Array.isArray(journal?.entries) || !Array.isArray(journal?.activeCommandIds) || !Array.isArray(journal?.redoCommandIds)) errors.push('entries, activeCommandIds and redoCommandIds arrays are required');
  if (!Array.isArray(journal?.checkpoints)) errors.push('checkpoints array is required');
  if (!Number.isInteger(journal?.nextSequence) || journal.nextSequence < 1) errors.push('nextSequence must be a positive integer');
  const ids = new Set();
  for (const entry of journal?.entries ?? []) {
    errors.push(...validateCommandEnvelope(entry).map((error) => `${entry.commandId || 'entry'}: ${error}`));
    if (ids.has(entry.commandId)) errors.push(`duplicate commandId ${entry.commandId}`); else ids.add(entry.commandId);
    if (entry.sessionId !== journal.sessionId || entry.documentId !== journal.documentId) errors.push(`${entry.commandId} journal identity mismatch`);
  }
  const maxSequence = Math.max(0, ...(journal?.entries ?? []).map((entry) => Number(entry.sequence) || 0));
  if (journal?.nextSequence <= maxSequence) errors.push('nextSequence must exceed every entry sequence');
  for (const checkpoint of journal?.checkpoints ?? []) {
    if (checkpoint?.schema !== COMMAND_CHECKPOINT_SCHEMA) errors.push(`checkpoint schema must be ${COMMAND_CHECKPOINT_SCHEMA}`);
    if (!String(checkpoint?.checkpointId ?? '').trim()) errors.push('checkpointId is required');
    if (!isIsoTimestamp(checkpoint?.createdAt)) errors.push(`${checkpoint?.checkpointId || 'checkpoint'} createdAt must be ISO`);
    if (!Number.isInteger(checkpoint?.sequence) || checkpoint.sequence < 0) errors.push(`${checkpoint?.checkpointId || 'checkpoint'} sequence must be non-negative`);
    if (!Array.isArray(checkpoint?.activeCommandIds)) errors.push(`${checkpoint?.checkpointId || 'checkpoint'} activeCommandIds required`);
    if (!String(checkpoint?.stateHash ?? '').trim()) errors.push(`${checkpoint?.checkpointId || 'checkpoint'} stateHash required`);
  }
  validateReferences(journal, errors);
  return Object.freeze(errors);
}

/** Create one empty journal bound to a project session and document. */
export function createCommandJournal(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Command journal input is required.');
  const journal = Object.freeze({
    schema: COMMAND_JOURNAL_SCHEMA, journalId: requiredContractText(input.journalId, 'journalId'),
    sessionId: requiredContractText(input.sessionId, 'sessionId'), documentId: requiredContractText(input.documentId, 'documentId'),
    createdAt: requiredContractText(input.createdAt, 'createdAt'), updatedAt: requiredContractText(input.createdAt, 'createdAt'),
    entries: Object.freeze([]), activeCommandIds: Object.freeze([]), redoCommandIds: Object.freeze([]),
    checkpoints: Object.freeze([]), nextSequence: 1,
  });
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Invalid CommandJournal: ${errors.join('; ')}`);
  return journal;
}

/** Append one immutable envelope and clear only the redo projection. */
export function appendJournalCommand(journal, command, updatedAt) {
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Cannot append to CommandJournal: ${errors.join('; ')}`);
  const sequence = journal.nextSequence;
  const envelope = createCommandEnvelope({
    ...command, commandId: `CJ-${String(sequence).padStart(6, '0')}`,
    sessionId: journal.sessionId, documentId: journal.documentId, sequence,
  });
  return Object.freeze({
    ...journal, updatedAt: requiredContractText(updatedAt, 'updatedAt'),
    entries: Object.freeze([...journal.entries, envelope]),
    activeCommandIds: Object.freeze([...journal.activeCommandIds, envelope.commandId]),
    redoCommandIds: Object.freeze([]), nextSequence: sequence + 1,
  });
}

/** Move the last active command to the front of the redo projection. */
export function undoCommandJournal(journal, updatedAt) {
  if (!journal.activeCommandIds.length) return journal;
  const commandId = journal.activeCommandIds.at(-1);
  return Object.freeze({ ...journal, updatedAt: requiredContractText(updatedAt, 'updatedAt'),
    activeCommandIds: Object.freeze(journal.activeCommandIds.slice(0, -1)),
    redoCommandIds: Object.freeze([commandId, ...journal.redoCommandIds]) });
}

/** Restore the first redo command to the active projection. */
export function redoCommandJournal(journal, updatedAt) {
  if (!journal.redoCommandIds.length) return journal;
  const [commandId, ...redoCommandIds] = journal.redoCommandIds;
  return Object.freeze({ ...journal, updatedAt: requiredContractText(updatedAt, 'updatedAt'),
    activeCommandIds: Object.freeze([...journal.activeCommandIds, commandId]), redoCommandIds: Object.freeze(redoCommandIds) });
}

/** Add a state-hash checkpoint without mutating command history. */
export function checkpointCommandJournal(journal, stateHash, createdAt) {
  const checkpoint = Object.freeze({
    schema: COMMAND_CHECKPOINT_SCHEMA,
    checkpointId: `CP-${String(journal.checkpoints.length + 1).padStart(6, '0')}`,
    createdAt: requiredContractText(createdAt, 'createdAt'), sequence: journal.nextSequence - 1,
    activeCommandIds: freezeIds(journal.activeCommandIds), stateHash: requiredContractText(stateHash, 'stateHash'),
  });
  if (!isIsoTimestamp(checkpoint.createdAt)) throw new TypeError('Checkpoint createdAt must be an exact ISO timestamp.');
  return Object.freeze({ ...journal, updatedAt: checkpoint.createdAt, checkpoints: Object.freeze([...journal.checkpoints, checkpoint]) });
}

/** Return active envelopes in original append order. */
export function activeJournalCommands(journal) {
  const active = new Set(journal.activeCommandIds);
  return Object.freeze(journal.entries.filter((entry) => active.has(entry.commandId)));
}

/** Deterministically replay active envelopes through a caller-owned pure reducer. */
export function replayCommandJournal(journal, initialState, reducer) {
  if (typeof reducer !== 'function') throw new TypeError('Command journal replay requires a reducer.');
  return activeJournalCommands(journal).reduce((state, envelope) => reducer(state, envelope), initialState);
}

/** Serialize one valid journal. */
export function serializeCommandJournal(journal) {
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Cannot serialize CommandJournal: ${errors.join('; ')}`);
  return `${JSON.stringify(journal, null, 2)}\n`;
}

/** Parse and validate persisted journal JSON. */
export function parseCommandJournal(text) {
  const journal = immutableJson(JSON.parse(String(text)), 'Persisted command journal');
  const errors = validateCommandJournal(journal);
  if (errors.length) throw new TypeError(`Invalid persisted CommandJournal: ${errors.join('; ')}`);
  return journal;
}
