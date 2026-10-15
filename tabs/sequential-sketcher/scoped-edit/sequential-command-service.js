/** Stateless Sequential command orchestration over caller-owned authority and publication. */
import { createCommandEnvelope } from '../../../contracts/command-envelope.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  createSequentialNativeCommand,
  sequentialCommandCodedError,
} from './sequential-command-contracts.js';
import { acceptPreparedSequentialCommand } from './sequential-command-acceptance.js';
import { createSequentialCommandJournalState } from './sequential-command-journal.js';
import { sequentialBranchSetFingerprint, deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { prepareSequentialCommand } from './sequential-command-preparation.js';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function current(reader) {
  const value = reader();
  if (!value || typeof value !== 'object') throw new TypeError('Sequential command state is unavailable.');
  return value;
}

export function createSequentialJournalAdoption(input = {}) {
  return createSequentialCommandJournalState({
    documentId: input.documentId,
    sessionId: input.sessionId,
    sourceFingerprint: input.sourceFingerprint,
    branchRegistry: input.branchRegistry,
    branchSetFingerprint: sequentialBranchSetFingerprint(input.branchRegistry),
    adoptedAt: input.adoptedAt,
  });
}

export function createSequentialCommandService(options = {}) {
  const readCurrentState = requiredFunction(options.readCurrentState, 'readCurrentState');
  const publishCandidate = requiredFunction(options.publishCandidate, 'publishCandidate');
  let destroyed = false;
  function requireLive() {
    if (destroyed) throw sequentialCommandCodedError(
      SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      'Sequential command service is destroyed.',
      RangeError,
    );
  }
  function prepare(input = {}) {
    requireLive();
    const state = current(readCurrentState);
    const authority = deriveSequentialEditAuthority(state);
    const nativeCommand = input.nativeCommand?.schema === 'SequentialNativeCommand.v1'
      ? input.nativeCommand
      : createSequentialNativeCommand(input.command);
    const journal = state.journalState?.journal;
    if (!journal) throw sequentialCommandCodedError(
      SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED,
      'Sequential command journal has not been adopted.',
      RangeError,
    );
    const sequence = journal.nextSequence;
    const envelope = createCommandEnvelope({
      commandId: `CJ-${String(sequence).padStart(6, '0')}`,
      sessionId: journal.sessionId,
      documentId: journal.documentId,
      sequence,
      commandType: nativeCommand.commandType,
      payload: nativeCommand,
      basis: { documentHash: authority.sourceFingerprint, revision: authority.authorityId },
      origin: input.origin,
      transactionId: null,
      inverse: null,
    });
    return prepareSequentialCommand({
      ...state,
      envelope,
      nativeCommand,
      expectedAuthority: authority,
    });
  }
  function accept(prepared) {
    requireLive();
    return acceptPreparedSequentialCommand({ prepared, readCurrentState, publishCandidate });
  }
  function execute(input = {}) {
    const prepared = prepare(input);
    return Object.freeze({ prepared, acceptance: accept(prepared) });
  }
  return Object.freeze({
    prepare,
    accept,
    execute,
    destroy() { if (destroyed) return false; destroyed = true; return true; },
  });
}
