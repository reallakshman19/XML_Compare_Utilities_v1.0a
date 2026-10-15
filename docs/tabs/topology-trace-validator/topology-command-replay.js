/** Topology domain reducer over the shared CommandJournal.v1 active projection. */

import { appendJournalCommand, createCommandJournal, replayCommandJournal } from '../../contracts/command-journal.js';
import { appendAttributeEdit, createAttributeEditLedger } from './topology-attribute-edit-ledger.js';
import { asArray, cleanText, objectRecord, semanticHash } from './topology-validator-values.js';

export const TOPOLOGY_JOURNAL_COMMANDS = Object.freeze({
  TOPOLOGY: 'TOPOLOGY_COMMAND', ATTRIBUTE: 'ATTRIBUTE_EDIT', REMARK: 'REMARK_SET',
});

/** Create one empty journal bound to the active platform context. */
export function createTopologyCommandJournal(context, createdAt) {
  return createCommandJournal({
    journalId: `topology-journal:${context.document.documentId}`,
    sessionId: context.session.sessionId, documentId: context.document.documentId, createdAt,
  });
}

/** Create the deterministic replay basis; no editable state is copied from UI. */
export function createTopologyReplayState(baseDraft) {
  if (baseDraft?.schema !== 'TopologyEditDraft.v1') throw new TypeError('Topology replay requires a TopologyEditDraft.v1 base.');
  return Object.freeze({ draft: baseDraft, attributeLedger: createAttributeEditLedger(), remarks: Object.freeze({}) });
}

function topologyReducer(core, state, envelope) {
  const payload = objectRecord(envelope.payload);
  if (envelope.commandType === TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY) {
    const command = objectRecord(payload.nativeCommand);
    const draft = core.appendTopologyEditCommand(state.draft, cleanText(command.type), objectRecord(command.payload));
    const actual = objectRecord(asArray(draft.commands).at(-1));
    if (cleanText(actual.id) !== cleanText(command.id)) throw new Error(`Topology replay identity mismatch: expected ${command.id}, received ${actual.id}.`);
    return Object.freeze({ ...state, draft });
  }
  if (envelope.commandType === TOPOLOGY_JOURNAL_COMMANDS.ATTRIBUTE) {
    return Object.freeze({ ...state, attributeLedger: appendAttributeEdit(state.attributeLedger, objectRecord(payload.edit)) });
  }
  if (envelope.commandType === TOPOLOGY_JOURNAL_COMMANDS.REMARK) {
    const targetId = cleanText(payload.targetId);
    if (!targetId) throw new TypeError('Remark replay requires targetId.');
    return Object.freeze({ ...state, remarks: Object.freeze({ ...state.remarks, [targetId]: cleanText(payload.value) }) });
  }
  throw new RangeError(`Unsupported topology journal command ${envelope.commandType}.`);
}

/** Replay all active commands from the immutable base draft. */
export function replayTopologyCommandJournal(journal, baseDraft, core) {
  if (typeof core?.appendTopologyEditCommand !== 'function') throw new TypeError('Topology replay requires appendTopologyEditCommand().');
  return replayCommandJournal(journal, createTopologyReplayState(baseDraft), (state, envelope) => topologyReducer(core, state, envelope));
}

function journalBasis(baseDraft) {
  return Object.freeze({ documentHash: cleanText(baseDraft.baseCanonicalTopologyHash), revision: 'TopologyEditDraft.v1' });
}

/** Append one successfully validated native producer command to the journal. */
export function appendTopologyNativeJournalCommand(journal, baseDraft, nativeCommand, origin, updatedAt) {
  const command = objectRecord(nativeCommand), nativeId = cleanText(command.id);
  return appendJournalCommand(journal, {
    commandType: TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY,
    payload: { nativeCommand: command }, basis: journalBasis(baseDraft), origin,
    transactionId: cleanText(command.type) === 'TRANSACTION' ? nativeId : null,
    inverse: { operation: 'REMOVE_NATIVE_COMMAND', nativeCommandId: nativeId },
  }, updatedAt);
}

/** Append a validated native command batch under one journal transaction. */
export function appendTopologyNativeJournalCommands(journal, baseDraft, nativeCommands, origin, updatedAt) {
  const commands = asArray(nativeCommands).map(objectRecord);
  if (!commands.length) throw new TypeError('Native command batch must contain at least one command.');
  const transactionId = `TX-${String(journal.nextSequence).padStart(6, '0')}-${commands.length}`;
  return commands.reduce((current, command) => appendJournalCommand(current, {
    commandType: TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY,
    payload: { nativeCommand: command }, basis: journalBasis(baseDraft), origin, transactionId,
    inverse: { operation: 'REMOVE_NATIVE_COMMAND', nativeCommandId: cleanText(command.id) },
  }, updatedAt), journal);
}

/** Append one deterministic attribute replacement with its inverse value. */
export function appendTopologyAttributeJournalCommand(journal, baseDraft, edit, origin, updatedAt) {
  const record = Object.freeze({ ...edit, appliedAt: origin.issuedAt, origin: `${origin.kind}:${origin.actorId}` });
  return appendJournalCommand(journal, {
    commandType: TOPOLOGY_JOURNAL_COMMANDS.ATTRIBUTE, payload: { edit: record },
    basis: journalBasis(baseDraft), origin, transactionId: null,
    inverse: { operation: 'SET_ATTRIBUTE', sourcePath: cleanText(edit.sourcePath), field: cleanText(edit.field), value: edit.before ?? null },
  }, updatedAt);
}

/** Append a serializable remark replacement including the previous value. */
export function appendTopologyRemarkJournalCommand(journal, baseDraft, targetId, value, previousValue, origin, updatedAt) {
  return appendJournalCommand(journal, {
    commandType: TOPOLOGY_JOURNAL_COMMANDS.REMARK, payload: { targetId: cleanText(targetId), value: cleanText(value) },
    basis: journalBasis(baseDraft), origin, transactionId: null,
    inverse: { operation: 'SET_REMARK', targetId: cleanText(targetId), value: cleanText(previousValue) },
  }, updatedAt);
}

/** Hash the complete replayed editable state for checkpoints. */
export function topologyReplayStateHash(state) {
  return semanticHash({ draft: state.draft, attributeLedger: state.attributeLedger, remarks: state.remarks });
}
