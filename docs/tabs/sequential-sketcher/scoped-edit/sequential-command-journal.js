/** Sequential adoption checkpoint and exact post-checkpoint CommandJournal.v1 authority. */
import { appendJournalCommand, createCommandJournal, validateCommandJournal } from '../../../contracts/command-journal.js';
import { immutableJson, isIsoTimestamp, requiredContractText } from '../../../contracts/contract-values.js';
import { sequentialSessionFingerprint } from '../construction/sequential-session-fingerprint.js';
import {
  SEQUENTIAL_COMMAND_JOURNAL_STATE_SCHEMA,
  SEQUENTIAL_COMMAND_REJECTION,
  SEQUENTIAL_JOURNAL_ADOPTION_CHECKPOINT_SCHEMA,
  sameSequentialContractValue,
  sequentialCommandCodedError,
  sequentialSemanticFingerprint,
} from './sequential-command-contracts.js';

function fail(code, message, Constructor = Error) {
  throw sequentialCommandCodedError(code, message, Constructor);
}
function text(value) { return String(value ?? '').trim(); }
function sortedIds(values = []) { return [...values].sort((left, right) => left.localeCompare(right)); }
function historyEntryEvidence(entry, context) {
  if (entry?.schema !== 'SequentialConstructionUndoEntry.v1') {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `${context} has an unsupported history schema.`, TypeError);
  }
  const beforeFingerprint = sequentialSessionFingerprint(entry.beforeSnapshot);
  const afterFingerprint = sequentialSessionFingerprint(entry.afterSnapshot);
  if (beforeFingerprint !== entry.beforeFingerprint || afterFingerprint !== entry.afterFingerprint) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `${context} snapshot fingerprint is invalid.`, RangeError);
  }
  return {
    transactionId: requiredContractText(entry.transactionId, `${context} transactionId`),
    action: requiredContractText(entry.action, `${context} action`),
    beforeFingerprint,
    afterFingerprint,
    beforeSnapshot: entry.beforeSnapshot,
    afterSnapshot: entry.afterSnapshot,
  };
}
function transactionEvidence(transaction, context, ids, previousAfter) {
  if (transaction?.schema !== 'SequentialConstructionTransaction.v1'
    || !text(transaction.transactionId) || ids.has(transaction.transactionId)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `${context} is invalid.`, TypeError);
  }
  if (!text(transaction.beforeFingerprint) || !text(transaction.afterFingerprint)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `${context} fingerprint evidence is missing.`, TypeError);
  }
  if (previousAfter && transaction.beforeFingerprint !== previousAfter) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `${context} is not continuous with prior transaction evidence.`, RangeError);
  }
  ids.add(transaction.transactionId);
  return transaction;
}
function validateHistoryMapping(rows, transactions, context) {
  const byId = new Map(transactions.map((row) => [row.transactionId, row]));
  for (const row of rows) {
    const transaction = byId.get(row.transactionId);
    if (!transaction) fail(
      SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID,
      `${context} references unknown transaction ${row.transactionId}.`,
      RangeError,
    );
    if (transaction.beforeFingerprint !== row.beforeFingerprint
      || transaction.afterFingerprint !== row.afterFingerprint) {
      fail(
        SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID,
        `${context} does not match transaction ${row.transactionId}.`,
        RangeError,
      );
    }
  }
}
function branchLegacyEvidence(entry) {
  const branchId = requiredContractText(entry?.branchId, 'legacy branchId');
  const session = entry?.snapshot?.session;
  if (session?.schema !== 'SequentialConstructionSession.v1' || session.rootBranchId !== branchId) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `Legacy branch ${branchId} session is invalid.`, TypeError);
  }
  const transactionIds = new Set();
  let previousAfter = null;
  const transactions = (session.transactionLedger || []).map((transaction, index) => {
    const result = transactionEvidence(transaction, `${branchId} transaction ${index}`, transactionIds, previousAfter);
    previousAfter = result.afterFingerprint;
    return result;
  });
  const sessionFingerprint = sequentialSessionFingerprint(session);
  if (transactions.length && transactions.at(-1).afterFingerprint !== sessionFingerprint) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `Legacy branch ${branchId} final transaction does not match current session.`, RangeError);
  }
  const undo = (session.undoStack || []).map((row, index) => historyEntryEvidence(row, `${branchId} undo ${index}`));
  const redo = (session.redoStack || []).map((row, index) => historyEntryEvidence(row, `${branchId} redo ${index}`));
  validateHistoryMapping(undo, transactions, `${branchId} undo history`);
  validateHistoryMapping(redo, transactions, `${branchId} redo history`);
  return { branchId, sessionFingerprint, sessionSnapshot: session, transactions, undo, redo };
}
function legacyMaterial(sourceFingerprint, branchIds, branches) {
  return {
    sourceFingerprint: requiredContractText(sourceFingerprint, 'legacy sourceFingerprint'),
    branchIds: sortedIds(branchIds),
    branches: [...branches].sort((left, right) => left.branchId.localeCompare(right.branchId)),
  };
}

export function createSequentialLegacyHistoryEvidence(input = {}) {
  const branchIds = input.branchRegistry?.ids?.();
  const entries = input.branchRegistry?.entries?.();
  if (!Array.isArray(branchIds) || !Array.isArray(entries)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, 'Sequential branch registry ids and entries are required.', TypeError);
  }
  const entryIds = sortedIds(entries.map((entry) => requiredContractText(entry?.branchId, 'legacy branchId')));
  if (!sameSequentialContractValue(sortedIds(branchIds), entryIds)) {
    fail(
      SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID,
      'Journal adoption requires one materialized workspace snapshot for every Sequential branch.',
      RangeError,
    );
  }
  const material = legacyMaterial(input.sourceFingerprint, branchIds, entries.map(branchLegacyEvidence));
  return immutableJson({
    branchIds: material.branchIds,
    branches: material.branches,
    legacyHistoryFingerprint: sequentialSemanticFingerprint('SLEGACY', material),
  }, 'Sequential legacy history evidence');
}
function checkpointMaterial(input, legacy) {
  return {
    schema: SEQUENTIAL_JOURNAL_ADOPTION_CHECKPOINT_SCHEMA,
    sourceFingerprint: requiredContractText(input.sourceFingerprint, 'checkpoint sourceFingerprint'),
    branchSetFingerprint: requiredContractText(input.branchSetFingerprint, 'checkpoint branchSetFingerprint'),
    legacyHistoryFingerprint: legacy.legacyHistoryFingerprint,
    branchIds: legacy.branchIds,
    branchEvidence: legacy.branches,
    adoptedAt: input.adoptedAt,
  };
}

export function createSequentialJournalAdoptionCheckpoint(input = {}) {
  if (!isIsoTimestamp(input.adoptedAt)) throw new TypeError('Sequential journal adoptedAt must be an exact ISO timestamp.');
  const legacy = createSequentialLegacyHistoryEvidence(input);
  const material = checkpointMaterial(input, legacy);
  return immutableJson({
    ...material,
    checkpointId: sequentialSemanticFingerprint('SADOPT', material),
  }, 'Sequential journal adoption checkpoint');
}

export function createSequentialCommandJournalState(input = {}) {
  const checkpoint = createSequentialJournalAdoptionCheckpoint(input);
  const documentId = requiredContractText(input.documentId, 'Sequential journal documentId');
  const sessionId = requiredContractText(input.sessionId, 'Sequential journal sessionId');
  const journalId = sequentialSemanticFingerprint('SJOURNAL', {
    documentId, sessionId, checkpointId: checkpoint.checkpointId,
  });
  const journal = createCommandJournal({ journalId, documentId, sessionId, createdAt: checkpoint.adoptedAt });
  return immutableJson({
    schema: SEQUENTIAL_COMMAND_JOURNAL_STATE_SCHEMA,
    adoptionCheckpoint: checkpoint,
    journal,
  }, 'Sequential command journal state');
}
function validateLegacyCheckpoint(checkpoint, errors) {
  const branchIds = checkpoint.branchIds || [];
  const branches = checkpoint.branchEvidence || [];
  const evidenceIds = sortedIds(branches.map((branch) => String(branch?.branchId || '')));
  if (!sameSequentialContractValue(sortedIds(branchIds), evidenceIds)) {
    errors.push('legacy branch evidence does not cover the checkpoint branch set');
  }
  const material = legacyMaterial(checkpoint.sourceFingerprint, branchIds, branches);
  if (checkpoint.legacyHistoryFingerprint !== sequentialSemanticFingerprint('SLEGACY', material)) {
    errors.push('legacy history fingerprint is invalid');
  }
  for (const branch of checkpoint.branchEvidence || []) {
    if (sequentialSessionFingerprint(branch.sessionSnapshot) !== branch.sessionFingerprint) {
      errors.push(`legacy branch ${branch.branchId || '(missing)'} session fingerprint is invalid`);
    }
  }
}
function validateCheckpoint(value, errors) {
  const checkpoint = value?.adoptionCheckpoint;
  if (checkpoint?.schema !== SEQUENTIAL_JOURNAL_ADOPTION_CHECKPOINT_SCHEMA) {
    errors.push('journal adoption checkpoint is invalid');
    return;
  }
  if (!isIsoTimestamp(checkpoint.adoptedAt)) errors.push('journal adoption timestamp is invalid');
  validateLegacyCheckpoint(checkpoint, errors);
  const { checkpointId, ...material } = checkpoint;
  if (checkpointId !== sequentialSemanticFingerprint('SADOPT', material)) {
    errors.push('journal adoption checkpoint fingerprint is invalid');
  }
  const journal = value?.journal;
  const expectedJournalId = sequentialSemanticFingerprint('SJOURNAL', {
    documentId: journal?.documentId,
    sessionId: journal?.sessionId,
    checkpointId,
  });
  if (journal?.journalId !== expectedJournalId) errors.push('journal identity does not match adoption checkpoint');
  if (journal?.createdAt !== checkpoint.adoptedAt) errors.push('journal creation time does not match adoption checkpoint');
}

export function validateSequentialCommandJournalState(value) {
  const errors = [];
  if (value?.schema !== SEQUENTIAL_COMMAND_JOURNAL_STATE_SCHEMA) errors.push(`schema must be ${SEQUENTIAL_COMMAND_JOURNAL_STATE_SCHEMA}`);
  try { validateCheckpoint(value, errors); } catch (error) { errors.push(error.message); }
  errors.push(...validateCommandJournal(value?.journal).map((error) => `journal: ${error}`));
  return Object.freeze(errors);
}
function currentBranchEntry(branchRegistry, branchId) {
  return (branchRegistry?.entries?.() || []).find((row) => row.branchId === branchId) || null;
}
function assertLegacyBranchPrefix(branchRegistry, legacyBranch) {
  const current = currentBranchEntry(branchRegistry, legacyBranch.branchId);
  const session = current?.snapshot?.session;
  if (session?.rootBranchId !== legacyBranch.branchId) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, `Legacy branch ${legacyBranch.branchId} is missing.`, RangeError);
  }
  const prefix = (session.transactionLedger || []).slice(0, legacyBranch.transactions.length);
  if (prefix.length !== legacyBranch.transactions.length
    || !sameSequentialContractValue(prefix, legacyBranch.transactions)) {
    fail(
      SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID,
      `Legacy transaction prefix for ${legacyBranch.branchId} no longer matches the adoption checkpoint.`,
      RangeError,
    );
  }
}

export function assertSequentialJournalAdoptionBasis(state, sourceFingerprint, branchRegistry) {
  const errors = validateSequentialCommandJournalState(state);
  if (errors.length) fail(SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED, errors.join('; '), TypeError);
  const checkpoint = state.adoptionCheckpoint;
  if (checkpoint.sourceFingerprint !== sourceFingerprint) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, 'Journal adoption source fingerprint does not match current source evidence.', RangeError);
  }
  const currentIds = branchRegistry?.ids?.();
  if (!Array.isArray(currentIds) || !sameSequentialContractValue(sortedIds(currentIds), checkpoint.branchIds)) {
    fail(SEQUENTIAL_COMMAND_REJECTION.LEGACY_HISTORY_INVALID, 'Journal adoption branch set no longer matches current branches.', RangeError);
  }
  for (const branch of checkpoint.branchEvidence) assertLegacyBranchPrefix(branchRegistry, branch);
  return true;
}

export function sequentialCommandJournalHeadFingerprint(state) {
  const errors = validateSequentialCommandJournalState(state);
  if (errors.length) fail(SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED, errors.join('; '), TypeError);
  return sequentialSemanticFingerprint('SJHEAD', {
    checkpointId: state.adoptionCheckpoint.checkpointId,
    entries: state.journal.entries,
    activeCommandIds: state.journal.activeCommandIds,
    redoCommandIds: state.journal.redoCommandIds,
    nextSequence: state.journal.nextSequence,
  });
}

export function appendSequentialCommandJournal(state, command, updatedAt) {
  const errors = validateSequentialCommandJournalState(state);
  if (errors.length) fail(SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED, errors.join('; '), TypeError);
  const journal = appendJournalCommand(state.journal, command, updatedAt);
  return immutableJson({ ...state, journal }, 'Sequential appended journal state');
}
